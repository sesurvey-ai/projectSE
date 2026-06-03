package com.sesurvey.se_survey

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

object LocationHelper {

    private const val TAG = "LocationHelper"

    fun getLastKnownLocation(context: Context): Location? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "No location permission")
            return null
        }

        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        var best: Location? = null

        // ลองทุก provider หาตำแหน่งล่าสุด
        for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.FUSED_PROVIDER)) {
            try {
                val loc = lm.getLastKnownLocation(provider)
                if (loc != null && (best == null || loc.time > best.time)) {
                    best = loc
                }
            } catch (_: Exception) {}
        }

        Log.d(TAG, "Best location: lat=${best?.latitude} lng=${best?.longitude} provider=${best?.provider}")
        return best
    }

    // จับ GPS "สด" — สั่งให้เครื่องหาพิกัดปัจจุบันจริง ๆ (ให้แม่นเท่าตอนลงเวลาเข้างาน) แทนการอ่านค่าที่จำไว้
    // บล็อกรอ first fix สูงสุด timeoutMs; ถ้าจับไม่ทัน → fallback เป็น last known (ดีกว่าไม่ส่งอะไรเลย)
    fun getFreshLocation(context: Context, timeoutMs: Long = 8_000L): Location? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "No location permission")
            return null
        }

        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

        // เลือก provider ที่เปิดอยู่ — GPS ก่อน (แม่นสุด) แล้วค่อย network
        val provider = when {
            lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> null
        }
        if (provider == null) {
            Log.w(TAG, "No location provider enabled → fallback to last known")
            return getLastKnownLocation(context)
        }

        val latch = CountDownLatch(1)
        val holder = arrayOfNulls<Location>(1)
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                holder[0] = location
                latch.countDown()
            }
            // ต้อง override สำหรับ Android เวอร์ชันเก่า
            override fun onStatusChanged(p: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(p: String) {}
            override fun onProviderDisabled(p: String) {}
        }

        try {
            // เรียกจาก thread ของ FCM ได้ — callback ส่งมาที่ main looper, เราบล็อกรอด้วย latch
            lm.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
        } catch (e: Exception) {
            Log.e(TAG, "requestLocationUpdates failed: $e → fallback to last known")
            return getLastKnownLocation(context)
        }

        try {
            latch.await(timeoutMs, TimeUnit.MILLISECONDS)
        } catch (_: InterruptedException) {}

        try {
            lm.removeUpdates(listener)
        } catch (_: Exception) {}

        val fresh = holder[0]
        Log.d(TAG, "Fresh location: lat=${fresh?.latitude} lng=${fresh?.longitude} provider=$provider")
        return fresh ?: getLastKnownLocation(context)
    }

    fun postLocationToServer(context: Context, latitude: Double, longitude: Double, requestId: String) {
        Thread {
            try {
                val baseUrl = getBaseUrl(context)
                val token = getAuthToken(context)
                if (token == null) {
                    Log.w(TAG, "No auth token, skip posting location")
                    return@Thread
                }

                val url = URL("$baseUrl/api/users/me/location")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.doOutput = true
                conn.connectTimeout = 10000
                conn.readTimeout = 10000

                val json = JSONObject().apply {
                    put("latitude", latitude)
                    put("longitude", longitude)
                    put("request_id", requestId)
                }

                val writer = OutputStreamWriter(conn.outputStream)
                writer.write(json.toString())
                writer.flush()
                writer.close()

                val code = conn.responseCode
                Log.d(TAG, "POST location response: $code")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "POST location error: $e")
            }
        }.start()
    }

    private fun getBaseUrl(context: Context): String {
        // อ่าน base URL จาก SharedPreferences (Flutter เซ็ตไว้) หรือใช้ค่า default
        val prefs = context.getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)
        val url = prefs.getString("flutter.api_base_url", null)
        if (url != null) return url

        // Fallback: ลองเชื่อม emulator ก่อน ถ้าไม่ได้ใช้ IP จริง
        return try {
            val socket = java.net.Socket()
            socket.connect(java.net.InetSocketAddress("10.0.2.2", 3001), 500)
            socket.close()
            "http://10.0.2.2:3001"
        } catch (_: Exception) {
            "http://192.168.1.135:3001"
        }
    }

    private fun getAuthToken(context: Context): String? {
        val prefs = context.getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)
        return prefs.getString("flutter.token", null)
    }
}
