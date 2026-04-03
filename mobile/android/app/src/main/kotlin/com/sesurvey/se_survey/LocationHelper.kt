package com.sesurvey.se_survey

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

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
