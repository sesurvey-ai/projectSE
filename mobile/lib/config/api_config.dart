import 'dart:io' show Platform;
import 'package:device_info_plus/device_info_plus.dart';

class ApiConfig {
  // backend production (มือถือพนักงานจริงชี้ที่นี่)
  static const String _prodUrl = 'https://api.sesurvey.cloud';

  // emulator ใช้ 10.0.2.2 (host loopback) ต่อ backend บนเครื่องพัฒนา
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
    if (!Platform.isAndroid) return _prodUrl;
    // emulator = backend dev บนเครื่อง; มือถือจริง = production
    return _isEmulator ? 'http://10.0.2.2:3001' : _prodUrl;
  }

  static String get socketUrl => baseUrl;

  static const Duration timeout = Duration(seconds: 30);
}
