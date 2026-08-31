import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/case_model.dart';
import '../services/api_service.dart';
import '../services/survey_queue.dart';

class CaseProvider extends ChangeNotifier {
  final ApiService _apiService;

  List<CaseModel> _cases = [];
  bool _isLoading = false;
  String? _error;
  bool _isSubmitting = false;

  CaseProvider({required ApiService apiService}) : _apiService = apiService;

  List<CaseModel> get cases => _cases;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isSubmitting => _isSubmitting;

  CaseModel? getCaseById(int id) {
    try {
      return _cases.firstWhere((c) => c.id == id);
    } catch (_) {
      return null;
    }
  }

  /// รายการงานชุดล่าสุดที่โหลดสำเร็จ — เก็บไว้เปิดดูตอนไม่มีเน็ต
  static const _kCacheKey = 'my_cases_cache';
  static const _kCacheAtKey = 'my_cases_cache_at';

  /// กำลังแสดงข้อมูลจาก cache อยู่ไหม (ยิงไม่ผ่าน) + โหลดสำเร็จครั้งล่าสุดเมื่อไหร่
  ///
  /// ⛔ **ต้องบอกผู้ใช้ว่ากำลังดูของเก่า** — ช่างที่ไม่รู้จะทำงานบนข้อมูลที่หัวหน้าแก้ไปแล้ว
  ///    (เช่นงานถูกยกเลิก/ย้ายคน) แล้วไปถึงที่เกิดเหตุฟรี
  bool _fromCache = false;
  DateTime? _cachedAt;
  bool get fromCache => _fromCache;
  DateTime? get cachedAt => _cachedAt;

  Future<void> fetchMyCases() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.getMyCases();
      final responseData = response.data;
      final List<dynamic> list = responseData is Map
          ? (responseData['data'] ?? [])
          : responseData;
      _cases = list.map((json) => CaseModel.fromJson(json)).toList();
      _fromCache = false;
      _cachedAt = DateTime.now();
      // เก็บชุดที่โหลดสำเร็จไว้ — ครั้งหน้าที่ไม่มีเน็ตจะได้มีอะไรให้ดู
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_kCacheKey, jsonEncode(list));
        await prefs.setString(_kCacheAtKey, _cachedAt!.toIso8601String());
      } catch (_) {/* เขียน cache ไม่ได้ = ไม่ใช่เหตุให้โหลดงานล้ม */}
    } catch (e) {
      // โหลดไม่ได้ → ถอยไปใช้ชุดล่าสุดที่เคยโหลดสำเร็จ ดีกว่าปล่อยหน้าว่าง
      final restored = await _loadCachedCases();
      _error = restored ? null : 'ไม่สามารถโหลดข้อมูลได้';
    }

    _isLoading = false;
    notifyListeners();
  }

  /// คืน true เมื่อกู้รายการจาก cache ได้ — ตั้งธง _fromCache ให้หน้าจอเอาไปเตือน
  Future<bool> _loadCachedCases() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kCacheKey);
      if (raw == null) return false;
      final list = jsonDecode(raw) as List<dynamic>;
      _cases = list.map((json) => CaseModel.fromJson(json)).toList();
      _fromCache = true;
      _cachedAt = DateTime.tryParse(prefs.getString(_kCacheAtKey) ?? '');
      return true;
    } catch (_) {
      return false;
    }
  }

  // throw เมื่อโหลดไม่สำเร็จ (network/รูปแบบ response ผิด) — คืน null เฉพาะ "server ยืนยันว่าเคสนี้
  // ยังไม่มี report" (เดิมกลืน error แล้วคืน null เหมือนกันทั้งสองเคส → จอ error หลอกทั้งที่แค่
  // ไม่มีข้อมูล และ retry ไม่มีวันหาย)
  Future<Map<String, dynamic>?> fetchCaseDetail(int caseId) async {
    final response = await _apiService.getCaseDetail(caseId);
    final data = response.data;
    if (data['success'] == true && data['data'] != null) {
      final report = data['data']['report'] as Map<String, dynamic>?;
      // แนบ case_images เข้ากับ report
      if (report != null && data['data']['case_images'] != null) {
        report['case_images'] = data['data']['case_images'];
      }
      // เคลมคู่จาก server (อุบัติเหตุเดียวกัน คนละเคลม) — ฟอร์มใช้โชว์คำเตือนกันข้อมูลปนกัน
      if (report != null && data['data']['linked_cases'] != null) {
        report['linked_cases'] = data['data']['linked_cases'];
      }
      return report;
    }
    throw Exception('unexpected case-detail response');
  }

  Future<bool> submitSurvey(
      int caseId, Map<String, dynamic> data, List<String> photoPaths) async {
    _isSubmitting = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.submitSurvey(caseId, data, photoPaths);
      _isSubmitting = false;
      notifyListeners();

      // Refresh cases after submission
      await fetchMyCases();
      return true;
    } catch (e) {
      String msg = 'ไม่สามารถส่งข้อมูลสำรวจได้';
      if (e is DioException && e.response?.data != null) {
        final data = e.response!.data;
        if (data is Map && data['message'] != null) {
          msg = '$msg: ${data['message']}';
        }
      }
      debugPrint('submitSurvey error: $e');
      _error = msg;
      _isSubmitting = false;
      notifyListeners();
      return false;
    }
  }

  // OCR สแกนใบเคลม → คืน { fields: {...}, confidence: {...} } หรือ null ถ้าพลาด
  Future<Map<String, dynamic>?> ocrClaim(String imagePath) async {
    try {
      return await _apiService.ocrClaim(imagePath);
    } catch (e) {
      debugPrint('ocrClaim error: $e');
      return null;
    }
  }

  // OCR บัตรประชาชน / ใบขับขี่
  Future<Map<String, dynamic>?> ocrDocument(String imagePath, String kind) async {
    try {
      return await _apiService.ocrDocument(imagePath, kind);
    } catch (e) {
      debugPrint('ocrDocument error: $e');
      return null;
    }
  }

  // ส่งงานสำรวจแบบรองรับออฟไลน์ — คืน 'ok' | 'queued' (ไม่มีเน็ต เก็บคิวไว้) | 'error'
  Future<String> submitSurveyOffline(int caseId, Map<String, dynamic> data, List<String> photoPaths) async {
    if (_isSubmitting) return 'busy'; // กันกดส่งซ้ำ (double-tap ก่อนปุ่ม disable)
    _isSubmitting = true;
    _error = null;
    notifyListeners();
    try {
      await _apiService.submitSurvey(caseId, data, photoPaths);
      _isSubmitting = false;
      notifyListeners();
      await fetchMyCases();
      return 'ok';
    } catch (e) {
      _isSubmitting = false;
      final isNetwork = e is DioException &&
          (e.response == null ||
              e.type == DioExceptionType.connectionError ||
              e.type == DioExceptionType.connectionTimeout ||
              e.type == DioExceptionType.sendTimeout ||
              e.type == DioExceptionType.receiveTimeout);
      if (isNetwork) {
        await enqueueSurvey(caseId, data);
        notifyListeners();
        return 'queued';
      }
      String msg = 'ไม่สามารถส่งข้อมูลสำรวจได้';
      if (e is DioException && e.response?.data is Map) {
        final body = e.response!.data as Map;
        if (body['message'] != null) msg = '$msg: ${body['message']}';
        // "Validation error" เฉย ๆ บอกไม่ได้ว่าช่องไหน — server ส่งรายชื่อช่องมาใน errors
        // อยู่แล้ว เอามาโชว์ด้วย (เดิมทิ้ง ทำให้ต้องไล่เดาทีละช่อง)
        final errs = body['errors'];
        if (errs is Map && errs.isNotEmpty) {
          final fields = errs.entries
              .map((x) => '${x.key}: ${x.value is List ? (x.value as List).join(', ') : x.value}')
              .take(4)
              .join(' · ');
          msg = '$msg\n$fields';
        }
      }
      debugPrint('submitSurveyOffline error: $e'
          '${e is DioException ? ' | body=${e.response?.data}' : ''}');
      _error = msg;
      notifyListeners();
      return 'error';
    }
  }

  Future<bool> updateSurvey(int caseId, Map<String, dynamic> data) async {
    if (_isSubmitting) return false; // กันกดซ้ำระหว่างกำลังบันทึก
    _isSubmitting = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.updateSurvey(caseId, data);
      _isSubmitting = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'ไม่สามารถบันทึกข้อมูลได้';
      _isSubmitting = false;
      notifyListeners();
      return false;
    }
  }
}
