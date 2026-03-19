import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/app_router.dart';
import 'services/api_service.dart';
import 'services/socket_service.dart';
import 'services/fcm_service.dart';
import 'providers/auth_provider.dart';
import 'providers/case_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Try to initialize Firebase, but don't crash if not configured
  try {
    // Firebase.initializeApp() would go here when Firebase is configured
  } catch (e) {
    debugPrint('Firebase initialization skipped: $e');
  }

  final apiService = ApiService();
  final socketService = SocketService();
  final fcmService = FcmService(apiService);

  runApp(SeSurveyApp(
    apiService: apiService,
    socketService: socketService,
    fcmService: fcmService,
  ));
}

class SeSurveyApp extends StatefulWidget {
  final ApiService apiService;
  final SocketService socketService;
  final FcmService fcmService;

  const SeSurveyApp({
    super.key,
    required this.apiService,
    required this.socketService,
    required this.fcmService,
  });

  @override
  State<SeSurveyApp> createState() => _SeSurveyAppState();
}

class _SeSurveyAppState extends State<SeSurveyApp> {
  late final AuthProvider _authProvider;
  late final CaseProvider _caseProvider;

  @override
  void initState() {
    super.initState();
    _authProvider = AuthProvider(
      apiService: widget.apiService,
      socketService: widget.socketService,
      fcmService: widget.fcmService,
    );
    _caseProvider = CaseProvider(apiService: widget.apiService);

    // Check auth state on app start
    _authProvider.checkAuth();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: _authProvider),
        ChangeNotifierProvider.value(value: _caseProvider),
      ],
      child: Builder(
        builder: (context) {
          final authProvider = context.watch<AuthProvider>();
          final router = createRouter(authProvider);

          return MaterialApp.router(
            title: 'SE Survey',
            debugShowCheckedModeBanner: false,
            theme: ThemeData(
              colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
              useMaterial3: true,
              appBarTheme: const AppBarTheme(
                centerTitle: true,
                elevation: 1,
              ),
            ),
            routerConfig: router,
          );
        },
      ),
    );
  }
}
