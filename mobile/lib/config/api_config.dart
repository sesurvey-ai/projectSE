import 'dart:io' show Platform;
import 'package:device_info_plus/device_info_plus.dart';

class ApiConfig {
  // backend production (มือถือพนักงานจริงชี้ที่นี่)
  static const String _prodUrl = 'https://api.sesurvey.cloud';

  // บังคับใช้ prod แม้บน emulator — build: flutter build apk --release --dart-define=FORCE_PROD=true
  // (default = false → พฤติกรรมเดิม: emulator ต่อ backend local)
  static const bool _forceProd = bool.fromEnvironment('FORCE_PROD', defaultValue: false);

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

  // dev override: ชี้ backend เอง (เช่น ทดสอบมือถือจริงกับ backend local ผ่าน adb reverse)
  // build: flutter run --dart-define=LOCAL_API=http://127.0.0.1:3001  (default '' = ปิด ไม่กระทบ prod)
  static const String _localApi = String.fromEnvironment('LOCAL_API', defaultValue: '');

  static String get baseUrl {
    if (_localApi.isNotEmpty) return _localApi;
    if (_forceProd) return _prodUrl;
    if (!Platform.isAndroid) return _prodUrl;
    // emulator = backend dev บนเครื่อง; มือถือจริง = production
    return _isEmulator ? 'http://10.0.2.2:3001' : _prodUrl;
  }

  static String get socketUrl => baseUrl;

  static const Duration timeout = Duration(seconds: 30);
}
