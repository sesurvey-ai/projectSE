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
        return data['data']['report'] as Map<String, dynamic>?;
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
      _error = 'ไม่สามารถส่งข้อมูลสำรวจได้';
      _isSubmitting = false;
      notifyListeners();
      return false;
    }
  }
}
