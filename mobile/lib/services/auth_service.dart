import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import 'api_service.dart';
import 'auth_token.dart';

class AuthService {
  final ApiService _apiService;

  AuthService(this._apiService);

  Future<User> login(String username, String password) async {
    final response = await _apiService.login(username, password);
    final body = response.data;
    final data = body['data'] as Map<String, dynamic>;

    final token = data['token'] as String;
    final userJson = data['user'] as Map<String, dynamic>;
    final user = User.fromJson(userJson);

    // Store token and user
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    await prefs.setString('user', jsonEncode(user.toJson()));
    AuthToken.set(token);

    return user;
  }

  /// ดึงข้อมูล user ล่าสุดจาก server แล้วอัปเดต cache — ข้อมูลใน prefs ค้างตั้งแต่ตอน login
  /// (เช่น admin เพิ่งเติมรหัสพนักงานใน DB จะไม่โชว์จนกว่า re-login) คืน null เมื่อออฟไลน์/พลาด
  Future<User?> refreshUser() async {
    try {
      final res = await _apiService.getMe();
      final data = res.data['data'];
      if (data is! Map<String, dynamic>) return null;
      final user = User.fromJson(data);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user', jsonEncode(user.toJson()));
      return user;
    } catch (_) {
      return null; // เน็ตล่ม → ใช้ cache เดิมต่อ
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
    // watermark ของ consult sync เป็นค่าระดับเครื่อง — user ใหม่บนเครื่องเดิมต้องสแกน
    // ย้อนหลังเต็มช่วง ไม่งั้นสายหัวหน้าของเขาที่เกิดก่อน watermark ของ user เก่าหายถาวร
    await prefs.remove('consult_sync_watermark');
    AuthToken.set(null);
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    AuthToken.set(token);
    return token;
  }

  Future<User?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString('user');
    if (userStr == null) return null;
    try {
      final decoded = jsonDecode(userStr);
      if (decoded is Map<String, dynamic>) {
        return User.fromJson(decoded);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null;
  }
}
