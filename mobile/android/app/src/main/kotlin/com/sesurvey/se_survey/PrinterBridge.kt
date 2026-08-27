package com.sesurvey.se_survey

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.util.Log
import io.flutter.plugin.common.MethodChannel
import java.io.OutputStream
import java.util.UUID

/**
 * ต่อเครื่องพิมพ์พกพาผ่าน Bluetooth Classic (RFCOMM/SPP) แล้วส่ง byte ดิบ
 *
 * **ทำไมไม่ใช้ package สำเร็จรูป:** print_bluetooth_thermal ต่อด้วย
 * `createRfcommSocketToServiceRecord()` อย่างเดียว ซึ่งต้องถาม SDP ก่อนเสมอ —
 * เครื่องพิมพ์ PS-2472E9 ที่ใช้จริงตอบ SDP ไม่ได้ (log ระบบ: `SDP_CFG_FAILED`)
 * จึงต่อไม่ติดทั้งที่จับคู่ไว้แล้วและเครื่องเปิดอยู่
 *
 * ที่นี่ไล่ลอง 3 ชั้นตามลำดับ ชั้นที่ 3 คือตัวที่ข้าม SDP ไปเลย:
 *   1. createRfcommSocketToServiceRecord  — มาตรฐาน (ใช้ SDP)
 *   2. createInsecureRfcommSocketToServiceRecord — ไม่บังคับ encryption (ใช้ SDP)
 *   3. createRfcommSocket(channel) ผ่าน reflection — **ยิงเข้า RFCOMM channel ตรง ๆ
 *      ไม่ถาม SDP** เป็นทางที่ใช้ได้กับเครื่องพิมพ์ราคาถูกที่ SDP พัง
 */
object PrinterBridge {
    private const val TAG = "PrinterBridge"
    private val SPP: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    private var socket: BluetoothSocket? = null
    private var out: OutputStream? = null

    val isConnected: Boolean
        get() = socket?.isConnected == true

    @SuppressLint("MissingPermission")
    fun pairedDevices(): List<Map<String, String>> {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return emptyList()
        return try {
            adapter.bondedDevices.map {
                mapOf("name" to (it.name ?: it.address), "mac" to it.address)
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "อ่านรายชื่อเครื่องที่จับคู่ไม่ได้ (สิทธิ์): ${e.message}")
            emptyList()
        }
    }

    /** คืนข้อความบอกว่าต่อติดด้วยวิธีไหน — เอาไปโชว์ใน log ของแอปเพื่อไล่ปัญหาได้ */
    @SuppressLint("MissingPermission")
    fun connect(mac: String): String {
        disconnect()
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return "FAIL:ไม่มี Bluetooth บนเครื่อง"
        if (!adapter.isEnabled) return "FAIL:Bluetooth ปิดอยู่"

        val device: BluetoothDevice = try {
            adapter.getRemoteDevice(mac)
        } catch (e: Exception) {
            return "FAIL:MAC ไม่ถูกต้อง ($mac)"
        }

        // การสแกนค้างอยู่จะทำให้ต่อช้าและหลุดง่าย — ต้องหยุดก่อนเสมอ
        try { adapter.cancelDiscovery() } catch (_: SecurityException) {}

        val errors = StringBuilder()

        // ชั้น 1-2: ผ่าน SDP
        for ((label, factory) in listOf<Pair<String, () -> BluetoothSocket>>(
            "secure-SDP" to { device.createRfcommSocketToServiceRecord(SPP) },
            "insecure-SDP" to { device.createInsecureRfcommSocketToServiceRecord(SPP) },
        )) {
            tryConnect(label, factory)?.let { return it }
            errors.append("$label ")
        }

        // ชั้น 3: ข้าม SDP — ยิงเข้า channel ตรง ๆ (1 คือช่องมาตรฐานของเครื่องพิมพ์ส่วนใหญ่)
        for (channel in intArrayOf(1, 2, 3)) {
            val ok = tryConnect("raw-ch$channel") {
                val m = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
                m.invoke(device, channel) as BluetoothSocket
            }
            if (ok != null) return ok
            errors.append("raw-ch$channel ")
        }

        return "FAIL:ต่อไม่ติดทุกวิธี (ลองแล้ว: ${errors.toString().trim()})"
    }

    @SuppressLint("MissingPermission")
    private fun tryConnect(label: String, factory: () -> BluetoothSocket): String? {
        var s: BluetoothSocket? = null
        return try {
            s = factory()
            s.connect()
            socket = s
            out = s.outputStream
            Log.i(TAG, "ต่อติดด้วยวิธี $label")
            "OK:$label"
        } catch (e: Exception) {
            Log.w(TAG, "$label ไม่ผ่าน: ${e.message}")
            try { s?.close() } catch (_: Exception) {}
            null
        }
    }

    /**
     * ส่งข้อมูลเข้าเครื่องพิมพ์ทีละก้อน **ช้ากว่าที่สายรับไหวเล็กน้อย**
     *
     * งานพิมพ์รูปเป็นก้อนใหญ่ (หลักแสน byte) — เขียนรวดเดียวทำให้บัฟเฟอร์ของเครื่องล้น
     * แล้วได้กระดาษที่พิมพ์ขาดกลางคัน
     *
     * ⛔ **เขียนเร็วกว่าสาย = พิมพ์ขาด และไม่มี error ใด ๆ ให้เห็น** — socket รับครบ
     *    ตอบ OK ปกติ เพราะข้อมูลไปกองใน buffer ของ OS ส่วนเครื่องพิมพ์ทิ้งที่ล้นเงียบ ๆ
     *    (เจอจริง 27/08/69 เครื่อง `BT-SPP` พิมพ์ใบจริงออกแค่หัวกระดาษ ทั้งที่แถบทดสอบ
     *     5 KB ออกครบ · เครื่อง `PS-2472E9` บัฟเฟอร์ใหญ่กว่าเลยรอดมาตลอด)
     *
     * Bluetooth SPP วิ่งได้จริงราว 10-20 KB/s — 1 KB ทุก 60 ms ≈ 17 KB/s
     * ช้ากว่าเดิม 6 เท่า (ใบยาวใช้เวลา ~7 วิ) แลกกับพิมพ์ครบทุกเครื่อง คุ้มกว่ามาก
     * ⚠️ อย่าเร่งกลับขึ้นไปเพราะ "เครื่องที่มีอยู่ก็เร็วได้" — เครื่องถัดไปอาจเป็นแบบนี้อีก
     */
    fun write(bytes: ByteArray): String {
        val stream = out ?: return "FAIL:ยังไม่ได้เชื่อมต่อ"
        return try {
            var i = 0
            while (i < bytes.size) {
                val end = minOf(i + 1024, bytes.size)
                stream.write(bytes, i, end - i)
                stream.flush()
                i = end
                Thread.sleep(60)
            }
            Log.i(TAG, "ส่งครบ ${bytes.size} byte")
            "OK"
        } catch (e: Exception) {
            Log.e(TAG, "ส่งงานพิมพ์ล้ม: ${e.message}")
            disconnect()
            "FAIL:${e.message}"
        }
    }

    fun disconnect() {
        try { out?.flush() } catch (_: Exception) {}
        try { socket?.close() } catch (_: Exception) {}
        out = null
        socket = null
    }

    fun register(channel: MethodChannel) {
        channel.setMethodCallHandler { call, result: MethodChannel.Result ->
            when (call.method) {
                "paired" -> result.success(pairedDevices())
                "connect" -> {
                    val mac = call.argument<String>("mac") ?: ""
                    // connect() บล็อกได้หลายวินาทีต่อความพยายามหนึ่งครั้ง — ห้ามรันบน UI thread
                    Thread {
                        val r = connect(mac)
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            result.success(r)
                        }
                    }.start()
                }
                "write" -> {
                    val data = call.argument<ByteArray>("bytes") ?: ByteArray(0)
                    Thread {
                        val r = write(data)
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            result.success(r)
                        }
                    }.start()
                }
                "connected" -> result.success(isConnected)
                "disconnect" -> { disconnect(); result.success(true) }
                else -> result.notImplemented()
            }
        }
    }
}
