import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/fcm_service.dart';
import '../services/notification_service.dart';
import '../services/consult_background.dart';
import '../services/consult_sync.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _apiService;
  final AuthService _authService;
  final FcmService _fcmService;
  VoidCallback? _onCaseAssignedRefresh;
  // Callback เมื่อมีงานใหม่ — ให้ UI แสดง IncomingSurveyPage
  void Function(Map<String, dynamic> data)? onNewSurveyIncoming;

  User? _user;
  String? _token;
  bool _isLoading = false;
  String? _error;

  AuthProvider({
    required ApiService apiService,
    required FcmService fcmService,
  })  : _apiService = apiService,
        _authService = AuthService(apiService),
        _fcmService = fcmService;

  void setOnCaseAssignedRefresh(VoidCallback callback) {
    _onCaseAssignedRefresh = callback;
  }

  User? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isLoggedIn => _token != null;

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      _token = await _authService.getToken();
      _user = await _authService.getUser();
      // แจ้ง router ทันทีที่ได้ session (ไป /home หรือ /login เร็ว ไม่ต้องรอ Firebase/FCM
      // → logged-in user ไม่เห็นหน้า login แวบก่อนเข้า home)
      notifyListeners();

      if (_token != null) {
        await _ensureServicesInited(); // Firebase/Notification/Consult ต้องพร้อมก่อน FCM (ทำหลัง UI ขึ้น)
        await _initializeFcm();
        _initConsultSync();
      }
    } catch (e) {
      _token = null;
      _user = null;
    }

    _isLoading = false;
    notifyListeners();
  }

  // init บริการที่ FCM ต้องใช้ แบบครั้งเดียว — ย้ายมาจาก main() เพื่อไม่ให้บล็อก runApp (แก้จอขาว)
  // Firebase ต้องพร้อมก่อน FcmService.initialize() ถึงจะ getToken ได้
  bool _servicesInited = false;
  Future<void> _ensureServicesInited() async {
    if (_servicesInited) return;
    _servicesInited = true;
    try { await Firebase.initializeApp(); } catch (e) { debugPrint('Firebase init failed: $e'); }
    try { await NotificationService().initialize(); } catch (e) { debugPrint('Notification init failed: $e'); }
    try { await ConsultBackground.init(); } catch (e) { debugPrint('ConsultBackground init failed: $e'); }
  }

  Future<void> _initializeFcm() async {
    // ตั้ง callback เมื่อ FCM foreground ได้รับ new_survey
    _fcmService.onNewSurveyReceived = (data) async {
      debugPrint('[Auth] FCM new_survey received: $data');
      final caseId = data['case_id'];
      final incidentLocation = (data['incident_location'] ?? '').toString();
      final claimNo = (data['claim_no'] ?? '').toString();
      final insuranceCompany = (data['insurance_company'] ?? '').toString();
      final notifId = caseId is int ? caseId : (int.tryParse(caseId?.toString() ?? '') ?? DateTime.now().millisecondsSinceEpoch ~/ 1000);
      final body = [
        if (incidentLocation.isNotEmpty) incidentLocation,
        if (claimNo.isNotEmpty) 'เคลม $claimNo',
        if (insuranceCompany.isNotEmpty) insuranceCompany,
      ].join(' · ');

      // แสดง notification + เสียง alarm
      try {
        await NotificationService().showUrgentNotification(
          id: notifId,
          title: 'งานสำรวจใหม่',
          body: body,
          payload: caseId?.toString(),
          incidentLocation: incidentLocation,
          claimNo: claimNo,
          insuranceCompany: insuranceCompany,
        );
      } catch (e) {
        debugPrint('[Auth] Failed to show urgent notification: $e');
      }

      // Refresh case list
      _onCaseAssignedRefresh?.call();
      notifyListeners();
    };

    await _fcmService.initialize();
  }

  // ตั้ง background sync ประวัติการโทรปรึกษาหัวหน้า (เฉพาะ surveyor) + sync รอบแรกทันที
  void _initConsultSync() {
    if (_user?.role != 'surveyor') return;
    ConsultBackground.schedule();
    runConsultSync().then((_) {}).catchError((_) {});
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _user = await _authService.login(username, password);
      _token = await _authService.getToken();

      if (_token != null) {
        await _ensureServicesInited();
        await _initializeFcm();
        _initConsultSync();
      }

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    // best-effort (ต้องเรียกก่อน _authService.logout() เพราะยังต้องใช้ token):
    // 1) ปิดรอบเข้างานที่ค้างอยู่ → สถานะเข้างาน = ไม่ (check-out ลบหมุดให้ฝั่ง server ด้วย)
    try {
      await _apiService.checkOutAttendance();
    } catch (_) {}
    // 2) เผื่อไม่มีรอบเปิดค้างแต่ยังมีหมุดค้าง → ลบหมุดอีกชั้น
    try {
      await _apiService.clearMyLocation();
    } catch (_) {}
    await ConsultBackground.cancel();
    await _authService.logout();
    _user = null;
    _token = null;
    _error = null;
    notifyListeners();
  }

  /// เรียกเมื่อ API ตอบ 401 (token หมดอายุ) → เคลียร์ session + ให้ router เด้งกลับหน้า login
  Future<void> handleSessionExpired() async {
    if (_token == null) return; // ออกจากระบบไปแล้ว / กัน 401 ซ้อนหลายตัว
    _token = null;
    _user = null;
    _error = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
    notifyListeners();
    await _authService.logout(); // ล้าง token ในเครื่อง
  }
}
