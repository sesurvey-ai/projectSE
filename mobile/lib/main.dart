import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'config/app_router.dart';
import 'services/api_service.dart';
import 'services/socket_service.dart';
import 'services/fcm_service.dart';
import 'providers/auth_provider.dart';
import 'providers/case_provider.dart';
import 'config/api_config.dart';
import 'services/notification_service.dart';
import 'screens/incoming_survey_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ตรวจสอบว่าเป็น emulator หรือมือถือจริง
  await ApiConfig.init();
  debugPrint('API URL: ${ApiConfig.baseUrl}');

  // Initialize Firebase
  try {
    await Firebase.initializeApp();
    debugPrint('Firebase initialized successfully');
  } catch (e) {
    debugPrint('Firebase initialization failed: $e');
  }

  // Initialize notification service
  await NotificationService().initialize();

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

    // Auto-refresh case list when a new case is assigned
    _authProvider.setOnCaseAssignedRefresh(() {
      _caseProvider.fetchMyCases();
    });

    // เมื่อได้รับงานใหม่ (Socket.IO) → แสดงหน้ารับงานเต็มจอ
    _authProvider.onNewSurveyIncoming = (data) {
      _showIncomingSurveyPage(data);
    };

    // เมื่อได้รับงานใหม่ (FCM foreground) → แสดงหน้ารับงานเต็มจอ
    widget.fcmService.onNewSurveyReceived = (data) {
      _showIncomingSurveyPage(data);
    };

    // Check auth state on app start
    _authProvider.checkAuth();
  }

  void _showIncomingSurveyPage(Map<String, dynamic> data) {
    final ctx = rootNavigatorKey.currentContext;
    if (ctx == null) return;
    final caseId = int.tryParse(data['case_id']?.toString() ?? '') ?? 0;
    final customerName = data['customer_name']?.toString() ?? data['title']?.toString() ?? 'ลูกค้า';
    final address = data['incident_location']?.toString() ?? data['address']?.toString() ?? '';
    final notifId = caseId > 0 ? caseId : DateTime.now().millisecondsSinceEpoch ~/ 1000;

    Navigator.of(ctx).push(MaterialPageRoute(
      builder: (_) => IncomingSurveyPage(
        caseId: caseId,
        title: customerName,
        address: address,
        notificationId: notifId,
        onAccepted: () {
          _caseProvider.fetchMyCases();
        },
        onDeclined: () {
          _caseProvider.fetchMyCases();
        },
      ),
    ));
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
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [
              Locale('th', 'TH'),
              Locale('en', 'US'),
            ],
            locale: const Locale('th', 'TH'),
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
