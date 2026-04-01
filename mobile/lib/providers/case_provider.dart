import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../models/case_model.dart';
import '../services/api_service.dart';

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
    } catch (e) {
      _error = 'ไม่สามารถโหลดข้อมูลได้';
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>?> fetchCaseDetail(int caseId) async {
    try {
      final response = await _apiService.getCaseDetail(caseId);
      final data = response.data;
      if (data['success'] == true && data['data'] != null) {
        final report = data['data']['report'] as Map<String, dynamic>?;
        // แนบ case_images เข้ากับ report
        if (report != null && data['data']['case_images'] != null) {
          report['case_images'] = data['data']['case_images'];
        }
        return report;
      }
    } catch (_) {}
    return null;
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

  Future<bool> updateSurvey(int caseId, Map<String, dynamic> data) async {
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
