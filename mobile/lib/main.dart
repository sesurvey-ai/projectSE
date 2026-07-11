import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'config/app_router.dart';
import 'services/api_service.dart';
import 'services/fcm_service.dart';
import 'providers/auth_provider.dart';
import 'providers/case_provider.dart';
import 'config/api_config.dart';
import 'services/notification_service.dart';
import 'screens/incoming_survey_page.dart';
import 'package:flutter_overlay_window/flutter_overlay_window.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // เฉพาะที่ "จำเป็นจริง ๆ ก่อน UI": ตรวจ emulator/มือถือจริง (เร็ว ~ms, ใช้ตั้ง baseUrl)
  await ApiConfig.init();
  debugPrint('API URL: ${ApiConfig.baseUrl}');

  final apiService = ApiService();
  final fcmService = FcmService(apiService);

  // เรียก runApp ทันที → UI ขึ้นเลย ไม่ค้างจอขาว
  // ของหนัก (Firebase / Notification / Consult / overlay) ย้ายไปทำ "หลังแอปขึ้นแล้ว":
  // - Firebase/Notification/Consult → ใน AuthProvider.checkAuth/login (ก่อน FCM, เฉพาะตอนมี session)
  // - overlay permission → ใน _bootstrap() แบบไม่บล็อก (เดิม await ตรงนี้ทำให้ค้างจอขาวจน restart)
  runApp(SeSurveyApp(
    apiService: apiService,
    fcmService: fcmService,
  ));
}

class SeSurveyApp extends StatefulWidget {
  final ApiService apiService;
  final FcmService fcmService;

  const SeSurveyApp({
    super.key,
    required this.apiService,
    required this.fcmService,
  });

  @override
  State<SeSurveyApp> createState() => _SeSurveyAppState();
}

class _SeSurveyAppState extends State<SeSurveyApp> {
  late final AuthProvider _authProvider;
  late final CaseProvider _caseProvider;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _authProvider = AuthProvider(
      apiService: widget.apiService,
      fcmService: widget.fcmService,
    );
    _caseProvider = CaseProvider(apiService: widget.apiService);
    // สร้าง router ครั้งเดียว — refreshListenable(authProvider) จัดการ redirect เมื่อ auth เปลี่ยนเอง
    // (เดิมสร้างใหม่ทุก build จาก context.watch → FCM foreground notify → router ใหม่ → เด้งออกจากฟอร์มกลับ /home)
    _router = createRouter(_authProvider);

    // token หมดอายุ (401) → เคลียร์ session แล้วให้ router เด้งกลับหน้า login
    widget.apiService.onUnauthorized = () => _authProvider.handleSessionExpired();

    // Auto-refresh case list when a new case is assigned
    _authProvider.setOnCaseAssignedRefresh(() {
      _caseProvider.fetchMyCases();
    });

    // เมื่อได้รับงานใหม่ (FCM foreground) → แสดงหน้ารับงานเต็มจอ
    _authProvider.onNewSurveyIncoming = (data) {
      _showIncomingSurveyPage(data);
    };

    // ตั้ง callbacks สำหรับปุ่มรับ/ปฏิเสธบน notification bar
    NotificationService().setCallbacks(
      onAccept: (caseId) {
        _caseProvider.fetchMyCases();
      },
      onDecline: (caseId) async {
        try {
          await widget.apiService.declineCase(caseId);
        } catch (_) {}
        _caseProvider.fetchMyCases();
      },
    );

    // หลังแอปขึ้นแล้ว: restore session (เร็ว) + init บริการหนัก + ขอ overlay permission (ไม่บล็อก)
    _bootstrap();
  }

  // init "หลัง runApp" — ไม่บล็อก UI (แก้อาการเปิดครั้งแรกจอขาวค้างจน restart)
  Future<void> _bootstrap() async {
    // restore session ก่อน (getToken เร็ว → router นำทางทันที); Firebase/FCM ตามมาใน checkAuth
    await _authProvider.checkAuth();
    // ขอ permission "แสดงทับแอปอื่น" แบบ lazy — เดิม await ตรงนี้ใน main() คือต้นเหตุค้างจอขาว
    try {
      if (!await FlutterOverlayWindow.isPermissionGranted()) {
        await FlutterOverlayWindow.requestPermission();
      }
    } catch (_) {}
  }

  void _showIncomingSurveyPage(Map<String, dynamic> data) {
    final ctx = rootNavigatorKey.currentContext;
    if (ctx == null) return;
    final caseId = int.tryParse(data['case_id']?.toString() ?? '') ?? 0;
    final incidentLocation = data['incident_location']?.toString() ?? '';
    final claimNo = data['claim_no']?.toString() ?? '';
    final insuranceCompany = data['insurance_company']?.toString() ?? '';
    final notifId = caseId > 0 ? caseId : DateTime.now().millisecondsSinceEpoch ~/ 1000;

    Navigator.of(ctx).push(MaterialPageRoute(
      builder: (_) => IncomingSurveyPage(
        caseId: caseId,
        incidentLocation: incidentLocation,
        claimNo: claimNo,
        insuranceCompany: insuranceCompany,
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
      child: MaterialApp.router(
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
        routerConfig: _router,
      ),
    );
  }
}
