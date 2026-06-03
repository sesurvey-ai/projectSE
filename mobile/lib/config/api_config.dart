import 'dart:io' show Platform;
import 'package:device_info_plus/device_info_plus.dart';

class ApiConfig {
  // IP ของเครื่องที่รัน backend (ใช้กับ "มือถือจริง" ในวง LAN เดียวกัน)
  static const String _localIp = '192.168.1.135';

  // emulator ใช้ 10.0.2.2 (host loopback), มือถือจริงใช้ IP จริงในวง LAN
  static bool _isEmulator = false;

  /// ตรวจว่าเป็น emulator หรือมือถือจริง — ใช้คุณสมบัติของอุปกรณ์ (ไม่พึ่ง network)
  /// จึงไม่ผิดพลาดแม้เปิดแอปตอน backend/เครือข่ายยังไม่พร้อม (เช่น หลังรีบูต)
  static Future<void> init() async {
    if (!Platform.isAndroid) return;
    try {
      final info = await DeviceInfoPlugin().androidInfo;
      _isEmulator = !info.isPhysicalDevice;
    } catch (_) {
      _isEmulator = false;
    }
  }

  static String get baseUrl {
    if (!Platform.isAndroid) return 'http://localhost:3001';
    return _isEmulator ? 'http://10.0.2.2:3001' : 'http://$_localIp:3001';
  }

  static String get socketUrl => baseUrl;

  static const Duration timeout = Duration(seconds: 30);
}
