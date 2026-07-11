import 'dart:io';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import 'auth_token.dart';

class ApiService {
  late final Dio _dio;

  /// เรียกเมื่อ token หมดอายุ/ไม่ถูกต้อง (HTTP 401) — ตั้งค่าใน main.dart
  void Function()? onUnauthorized;

  ApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: ApiConfig.timeout,
      receiveTimeout: ApiConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('token');
        AuthToken.set(token); // sync cache ให้ Image.network ใช้ต่อ
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        // token หมดอายุ/ไม่ถูกต้อง → แจ้งให้ออกจากระบบ (ยกเว้นตอนล็อกอินผิด)
        if (error.response?.statusCode == 401 &&
            !error.requestOptions.path.contains('/auth/login')) {
          onUnauthorized?.call();
        }
        handler.next(error);
      },
    ));
  }

  // Auth
  Future<Response> login(String username, String password) async {
    return _dio.post('/api/auth/login', data: {
      'username': username,
      'password': password,
    });
  }

  Future<Response> getMe() async {
    return _dio.get('/api/users/me');
  }

  // Cases
  Future<Response> getMyCases() async {
    return _dio.get('/api/cases/my');
  }

  Future<Response> getCaseDetail(int caseId) async {
    return _dio.get('/api/cases/$caseId/detail');
  }

  // Survey
  Future<Response> submitSurvey(
      int caseId, Map<String, dynamic> data, List<String> photoPaths) async {
    // อัปโหลดทั้งโฟลเดอร์ขึ้น server (รวม arrival + survey + OCR) — ล้ม → throw ให้ผู้เรียกจัดการ
    // (submitSurveyOffline: network → เข้าคิว retry, อื่นๆ → โชว์ error) ไม่กลืนเงียบเหมือนเดิม
    final claimNo = data['claim_no']?.toString() ?? '';
    final surveyJobNo = data['survey_job_no']?.toString() ?? '';
    await uploadCaseFolder(caseId, claimNo, surveyJobNo);

    return _dio.post('/api/cases/$caseId/survey', data: {
      ...data,
      'photo_paths': <String>[],
    });
  }

  Future<void> uploadCaseFolder(int caseId, String claimNo, String surveyJobNo) async {
    // ใช้ fallback folder เดียวกับที่ฝั่งฟอร์มเซฟรูป (case_<id>/job_<id>) เมื่อเลขเคลม/เซอร์เวย์ว่าง
    // เดิม gate ด้วย "ต้องไม่ว่างทั้งคู่" → รูปไม่ถูกอัปเลยเมื่อ OCR อ่านเลขไม่ออก
    final claimFolder = (claimNo.isNotEmpty ? claimNo : 'case_$caseId').replaceAll(RegExp(r'[/\\?%*:|"<>]'), '_');
    final jobFolder = (surveyJobNo.isNotEmpty ? surveyJobNo : 'job_$caseId').replaceAll(RegExp(r'[/\\?%*:|"<>]'), '_');
    final folder = Directory('/storage/emulated/0/Download/SE_Survey/$claimFolder/$jobFolder');
    if (!folder.existsSync()) return; // ไม่มีโฟลเดอร์ = ไม่มีรูป (ไม่ใช่ error → ไม่ throw)

    final files = folder.listSync().whereType<File>().toList();
    if (files.isEmpty) return; // ไม่มีรูป (surveyor ไม่ถ่าย) → ปกติ

    final formData = FormData();
    formData.fields.add(MapEntry('folder', claimFolder));
    for (final file in files) {
      formData.files.add(MapEntry(
        'photos',
        await MultipartFile.fromFile(file.path, filename: file.path.split('/').last),
      ));
    }

    // ไม่ห่อ try/catch — ให้ error (network/HTTP) เด้งขึ้นไปเป็นส่วนหนึ่งของการ submit
    await _dio.post('/api/cases/$caseId/upload-folder', data: formData);
  }

  Future<Response> updateSurvey(int caseId, Map<String, dynamic> data) async {
    return _dio.put('/api/cases/$caseId/survey', data: data);
  }

  // OCR สแกนใบเคลม (flipped pipeline) → คืน map ฟิลด์ที่อ่านได้ (claim_no, policy_no, incident_location, ...)
  Future<Map<String, dynamic>> ocrClaim(String imagePath) async {
    final form = FormData();
    form.files.add(MapEntry('image', await MultipartFile.fromFile(imagePath, filename: imagePath.split('/').last)));
    final r = await _dio.post('/api/ocr/claim', data: form);
    return (r.data['data'] as Map<String, dynamic>?) ?? {};
  }

  // OCR บัตรประชาชน / ใบขับขี่ (kind = idcard | license) → { fields, confidence, review_needed }
  Future<Map<String, dynamic>> ocrDocument(String imagePath, String kind) async {
    final form = FormData();
    form.files.add(MapEntry('image', await MultipartFile.fromFile(imagePath, filename: imagePath.split('/').last)));
    final r = await _dio.post('/api/ocr/document/$kind', data: form);
    return (r.data['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<List<String>> uploadPhotos(List<String> filePaths) async {
    final formData = FormData();
    for (final path in filePaths) {
      formData.files.add(MapEntry(
        'photos',
        await MultipartFile.fromFile(path),
      ));
    }

    final response = await _dio.post('/api/upload', data: formData);
    final List<dynamic> files = response.data['data'] ?? [];
    return files.map((f) => f['path'].toString()).toList();
  }

  // Case folder
  Future<Response> createCaseFolder(int caseId) async {
    return _dio.post('/api/cases/$caseId/folder');
  }

  // Arrival confirmation
  Future<Response> confirmArrival(int caseId, String photoPath) async {
    return _dio.post('/api/cases/$caseId/arrival', data: {
      'photo_path': photoPath,
    });
  }

  Future<Response> getArrivalPhotos(int caseId) async {
    return _dio.get('/api/cases/$caseId/arrival');
  }

  // ปฏิเสธงาน
  Future<Response> declineCase(int caseId) async {
    return _dio.post('/api/cases/$caseId/decline');
  }

  // FCM token
  Future<Response> updateFcmToken(String token) async {
    return _dio.put('/api/users/me/fcm-token', data: {
      'fcm_token': token,
    });
  }

  // Call consult (โทรปรึกษาหัวหน้า)
  Future<List<dynamic>> getConsultSupervisors() async {
    final r = await _dio.get('/api/consult/supervisors');
    return (r.data['data']?['supervisors'] as List?) ?? [];
  }

  Future<Map<String, dynamic>> syncConsult(List<Map<String, dynamic>> items) async {
    final r = await _dio.post('/api/consult/sync', data: {'items': items});
    return (r.data['data'] as Map<String, dynamic>?) ?? {};
  }

  // ── Leave (ใบลา) ──
  Future<Map<String, dynamic>> createLeave(Map<String, dynamic> data) async {
    final r = await _dio.post('/api/leave', data: data);
    return (r.data['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<List<dynamic>> getMyLeaves() async {
    final r = await _dio.get('/api/leave/mine');
    return (r.data['data']?['requests'] as List?) ?? [];
  }

  // ── Attendance (ลงเวลาเข้า/ออกงาน) ──
  // คืน { sessions: [...รอบของวันนี้], open: รอบที่เปิดค้าง|null }
  Future<Map<String, dynamic>> getTodayAttendance() async {
    final r = await _dio.get('/api/attendance/today');
    return (r.data['data'] as Map<String, dynamic>?) ?? {'sessions': <dynamic>[], 'open': null};
  }

  Future<Map<String, dynamic>> checkInAttendance({double? lat, double? lng, String? photoPath}) async {
    // multipart: รูปถ่าย + พิกัด (เวร/อาสาอ้างอิงจากตารางเวร — คำนวณฝั่งบอร์ดตามเวลาจริง)
    final form = FormData();
    if (lat != null) form.fields.add(MapEntry('lat', lat.toString()));
    if (lng != null) form.fields.add(MapEntry('lng', lng.toString()));
    if (photoPath != null) {
      form.files.add(MapEntry('photo', await MultipartFile.fromFile(photoPath, filename: 'checkin.jpg')));
    }
    final r = await _dio.post('/api/attendance/check-in', data: form);
    return (r.data['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<Map<String, dynamic>> checkOutAttendance({double? lat, double? lng}) async {
    final r = await _dio.post('/api/attendance/check-out', data: {
      'lat': ?lat,
      'lng': ?lng,
    });
    return (r.data['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<List<dynamic>> getMyAttendance() async {
    final r = await _dio.get('/api/attendance/mine');
    return (r.data['data']?['records'] as List?) ?? [];
  }

  // เคลียร์พิกัดตัวเองตอนออกจากระบบ → หมุดหายจากแผนที่ Call Center
  Future<void> clearMyLocation() async {
    await _dio.delete('/api/users/me/location');
  }
}
