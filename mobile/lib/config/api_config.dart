import 'dart:io' show Platform, Socket;

class ApiConfig {
  // เปลี่ยน IP นี้เป็น IP ของเครื่องที่รัน backend
  static const String _localIp = '192.168.1.135';

  // emulator ใช้ 10.0.2.2, มือถือจริงใช้ IP จริง
  static bool _isEmulator = false;

  static Future<void> init() async {
    if (!Platform.isAndroid) return;
    try {
      final socket = await Socket.connect('10.0.2.2', 3001,
          timeout: const Duration(milliseconds: 500));
      socket.destroy();
      _isEmulator = true;
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
