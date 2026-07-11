/// เก็บ token ไว้ในหน่วยความจำ เพื่อให้ Image.network แนบ Authorization header ได้แบบ sync
/// (SharedPreferences อ่านแบบ async ใช้ตอน build widget ไม่ได้)
/// อัปเดตค่าเมื่อ: login, logout, และทุกครั้งที่ยิง API (interceptor) — ให้ตรงกับ prefs เสมอ
class AuthToken {
  static String? _token;

  static void set(String? token) {
    _token = token;
  }

  static String? get value => _token;

  /// header สำหรับโหลดรูปจาก /uploads (ว่างถ้ายังไม่ล็อกอิน)
  static Map<String, String> get imageHeaders =>
      _token == null ? const {} : {'Authorization': 'Bearer $_token'};
}
