import 'dart:io' show Platform;

class ApiConfig {
  static String get baseUrl =>
      Platform.isAndroid ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
  static String get socketUrl =>
      Platform.isAndroid ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
  static const Duration timeout = Duration(seconds: 30);
}
