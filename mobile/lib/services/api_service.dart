import 'dart:io';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiService {
  late final Dio _dio;

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
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
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
    List<String> uploadedPaths = [];
    if (photoPaths.isNotEmpty) {
      uploadedPaths = await uploadPhotos(photoPaths);
    }

    // อัปโหลดทุกไฟล์ในโฟลเดอร์เคสขึ้น server
    final claimNo = data['claim_no']?.toString() ?? '';
    if (claimNo.isNotEmpty) {
      await uploadCaseFolder(caseId, claimNo);
    }

    return _dio.post('/api/cases/$caseId/survey', data: {
      ...data,
      'photo_paths': uploadedPaths,
    });
  }

  Future<void> uploadCaseFolder(int caseId, String claimNo) async {
    try {
      final folderName = claimNo.replaceAll(RegExp(r'[/\\?%*:|"<>]'), '_');
      final folder = Directory('/storage/emulated/0/Download/SE_Survey/$folderName');
      if (!folder.existsSync()) return;

      final files = folder.listSync().whereType<File>().toList();
      if (files.isEmpty) return;

      final formData = FormData();
      formData.fields.add(MapEntry('folder', folderName));
      for (final file in files) {
        formData.files.add(MapEntry(
          'photos',
          await MultipartFile.fromFile(file.path, filename: file.path.split('/').last),
        ));
      }

      await _dio.post('/api/cases/$caseId/upload-folder', data: formData);
    } catch (_) {}
  }

  Future<Response> updateSurvey(int caseId, Map<String, dynamic> data) async {
    return _dio.put('/api/cases/$caseId/survey', data: data);
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

  // FCM token
  Future<Response> updateFcmToken(String token) async {
    return _dio.put('/api/users/me/fcm-token', data: {
      'fcm_token': token,
    });
  }
}
