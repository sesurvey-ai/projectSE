import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/socket_service.dart';
import '../services/fcm_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService;
  final SocketService _socketService;
  final FcmService _fcmService;

  User? _user;
  String? _token;
  bool _isLoading = false;
  String? _error;

  AuthProvider({
    required ApiService apiService,
    required SocketService socketService,
    required FcmService fcmService,
  })  : _authService = AuthService(apiService),
        _socketService = socketService,
        _fcmService = fcmService;

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

      if (_token != null) {
        _socketService.connect(_token!);
        await _fcmService.initialize();
      }
    } catch (e) {
      _token = null;
      _user = null;
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _user = await _authService.login(username, password);
      _token = await _authService.getToken();

      // Connect socket and initialize FCM after login
      if (_token != null) {
        _socketService.connect(_token!);
        await _fcmService.initialize();
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
    _socketService.disconnect();
    await _authService.logout();
    _user = null;
    _token = null;
    _error = null;
    notifyListeners();
  }
}
