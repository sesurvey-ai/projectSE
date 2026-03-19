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

  // Survey
  Future<Response> submitSurvey(
      int caseId, Map<String, dynamic> data, List<String> photoPaths) async {
    List<String> uploadedPaths = [];
    if (photoPaths.isNotEmpty) {
      uploadedPaths = await uploadPhotos(photoPaths);
    }

    return _dio.post('/api/cases/$caseId/survey', data: {
      'car_model': data['car_model'],
      'car_color': data['car_color'],
      'license_plate': data['license_plate'],
      'notes': data['notes'],
      'photo_paths': uploadedPaths,
    });
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

  // FCM token
  Future<Response> updateFcmToken(String token) async {
    return _dio.put('/api/users/me/fcm-token', data: {
      'fcm_token': token,
    });
  }
}
