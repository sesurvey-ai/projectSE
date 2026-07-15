import 'dart:convert';
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
      // sendTimeout จำเป็นสำหรับอัปโหลด: receiveTimeout เริ่มนับ "หลัง" ส่ง body เสร็จ
      // ถ้า socket ค้างระหว่างส่งรูป (เน็ตมือถือสะดุด) โดยไม่มี sendTimeout = จอหมุนค้างไม่มีกำหนด
      // และ branch DioExceptionType.sendTimeout ที่ดักไว้เข้าคิวออฟไลน์ไม่มีวันทำงาน
      sendTimeout: ApiConfig.timeout,
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
    // path รูปจาก draft (photo_paths_local) — กวาดรูปที่ตกค้างนอกโฟลเดอร์ประจำเคสด้วย
    final localPaths = data['photo_paths_local'] is List
        ? (data['photo_paths_local'] as List).map((e) => e.toString()).toList()
        : const <String>[];
    await uploadCaseFolder(caseId, claimNo, surveyJobNo, extraPaths: localPaths);

    return _dio.post('/api/cases/$caseId/survey', data: {
      ...data,
      'photo_paths': <String>[],
    });
  }

  Future<void> uploadCaseFolder(int caseId, String claimNo, String surveyJobNo,
      {List<String> extraPaths = const []}) async {
    // โฟลเดอร์หลักผูกกับ case id (immutable) — เลขเคลม/เลขเซอร์เวย์แก้ไขได้ระหว่างทาง
    // (เปิดฟอร์มออฟไลน์/แก้เลขที่ OCR อ่านผิด) เคยทำให้รูปที่ถ่ายไว้หลุดจากการอัปโหลดทั้งชุดแบบเงียบ
    // ยังกวาดโฟลเดอร์ระบบเก่า (ตั้งชื่อตามเลขเคลม) + path รูปใน draft เผื่อรูปตกค้าง
    String san(String s) => s.replaceAll(RegExp(r'[/\\?%*:|"<>]'), '_');
    const root = '/storage/emulated/0/Download/SE_Survey';
    final canonical = Directory('$root/case_$caseId/job_$caseId');
    final legacyClaim = claimNo.isNotEmpty ? san(claimNo) : 'case_$caseId';
    final legacyJob = surveyJobNo.isNotEmpty ? san(surveyJobNo) : 'job_$caseId';
    final legacy = Directory('$root/$legacyClaim/$legacyJob');

    // รวมไฟล์ (dedup ตามชื่อ — canonical ชนะ): canonical → legacy → path จาก draft
    final byName = <String, File>{};
    void collect(Iterable<File> files) {
      for (final f in files) {
        final name = f.path.split('/').last;
        if (name.endsWith('.part')) continue; // ไฟล์ดาวน์โหลดครึ่งทาง — ห้ามอัปโหลด
        byName.putIfAbsent(name, () => f);
      }
    }
    if (canonical.existsSync()) collect(canonical.listSync().whereType<File>());
    if (legacy.path != canonical.path && legacy.existsSync()) {
      collect(legacy.listSync().whereType<File>());
    }
    collect(extraPaths.map(File.new).where((f) => f.existsSync()));
    if (byName.isEmpty) {
      // ไม่มีไฟล์ในเครื่อง — อาจเป็น "ผู้ใช้ลบรูปทั้งหมด" → ยังต้องส่ง keep ว่างให้ server
      // prune ไฟล์เก่าทิ้ง (ไม่งั้น submit จะ re-link รูปที่ลบแล้วกลับเข้ารายงาน)
      final syncForm = FormData();
      syncForm.fields.add(MapEntry('folder', 'case_$caseId'));
      syncForm.fields.add(MapEntry('keep', '[]'));
      try {
        await _dio.post('/api/cases/$caseId/upload-folder-v2', data: syncForm);
      } on DioException catch (e) {
        // backend เก่าไม่มี v2 → 404: ไม่มีรูปจะส่งอยู่แล้ว ไม่ต้อง fail submit
        if (e.response?.statusCode != 404) rethrow;
      }
      return;
    }

    // ถาม server ว่ามีไฟล์ไหนแล้ว → ข้าม (เน็ตหลุดกลาง upload แล้ว retry ไม่ต้องเริ่มจากศูนย์)
    // ถามไม่ได้ (server เก่า/เน็ตสะดุด) → อัปโหลดทั้งหมด (server เขียนทับชื่อเดิม ไม่เกิดไฟล์ซ้ำ)
    var existing = const <String>{};
    try {
      final r = await _dio.get('/api/cases/$caseId/upload-folder');
      existing = ((r.data['data']?['files'] as List?) ?? const [])
          .map((e) => e.toString())
          .toSet();
    } catch (_) {}

    // ส่งทีละไฟล์ — เดิมยัดทุกรูปใน POST เดียว: เน็ตสะดุดที่ 95% = ทิ้งทุก byte แล้วเริ่มใหม่หมด
    // keep = ชื่อไฟล์ทั้งชุดปัจจุบัน แนบทุกคำขอ → server ลบไฟล์ที่ผู้ใช้ลบออกจากแอปแล้ว (prune)
    final keep = jsonEncode(byName.keys.toList());
    for (final entry in byName.entries) {
      // arrival.jpg ชื่อคงที่ (ถ่ายใหม่เนื้อไฟล์เปลี่ยน) → ส่งซ้ำเสมอ ไม่ skip
      if (existing.contains(entry.key) && entry.key != 'arrival.jpg') continue;
      final formData = FormData();
      formData.fields.add(MapEntry('folder', 'case_$caseId'));
      formData.fields.add(MapEntry('keep', keep));
      formData.files.add(MapEntry(
        'photos',
        await MultipartFile.fromFile(entry.value.path, filename: entry.key),
      ));
      // ไม่ห่อ try/catch — ให้ error (network/HTTP) เด้งขึ้นไปเป็นส่วนหนึ่งของการ submit
      // (ไฟล์ที่ส่งสำเร็จแล้วอยู่บน server → รอบหน้า skip เอง)
      // ใช้ v2 (per-file + keep) — เจอ backend เก่า (ไม่มี v2) = 404 ดัง ๆ ปลอดภัยกว่าโดน v1 wipe เงียบ
      await _dio.post('/api/cases/$caseId/upload-folder-v2', data: formData);
    }
    // คำขอปิดท้าย (keep อย่างเดียว ไม่มีไฟล์) — ครอบเคส "ข้ามทุกไฟล์" ให้ prune รูปที่ถูกลบเสมอ
    final syncForm = FormData();
    syncForm.fields.add(MapEntry('folder', 'case_$caseId'));
    syncForm.fields.add(MapEntry('keep', keep));
    await _dio.post('/api/cases/$caseId/upload-folder-v2', data: syncForm);
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
