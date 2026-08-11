import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../screens/login_screen.dart';
import '../screens/home_screen.dart';
import '../screens/call_log_screen.dart';
import '../screens/leave_screen.dart';
import '../screens/attendance_screen.dart';
import '../screens/case_list_screen.dart';
import '../screens/case_detail_screen.dart';
import '../screens/survey_form_screen.dart';
import '../screens/printer_test_screen.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

GoRouter createRouter(AuthProvider authProvider) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/home',
    refreshListenable: authProvider,
    redirect: (BuildContext context, GoRouterState state) {
      // ยังอ่าน token จาก storage ไม่เสร็จ → อย่าเพิ่ง redirect (กัน cold start เด้ง /login แวบ
      // แล้วเด้งกลับ + ทิ้ง destination ที่ตั้งใจไป); redirect รันซ้ำเมื่อ checkAuth notify
      if (!authProvider.authResolved) return null;

      final isLoggedIn = authProvider.isLoggedIn;
      final isLoggingIn = state.matchedLocation == '/login';

      if (!isLoggedIn && !isLoggingIn) {
        return '/login';
      }

      if (isLoggedIn && isLoggingIn) {
        return '/home';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/calllog',
        builder: (context, state) => const CallLogScreen(),
      ),
      GoRoute(
        path: '/leave',
        builder: (context, state) => const LeaveScreen(),
      ),
      GoRoute(
        path: '/attendance',
        builder: (context, state) => const AttendanceScreen(),
      ),
      // ทดสอบเครื่องพิมพ์พกพา (Phase 0 ใบแจ้งความเสียหาย) — ยังไม่มีปุ่มเข้าจากหน้าไหน
      // เปิดด้วย: adb shell am start -a android.intent.action.VIEW -d "sesurvey://printer-test"
      GoRoute(
        path: '/printer-test',
        builder: (context, state) => const PrinterTestScreen(),
      ),
      GoRoute(
        path: '/cases',
        builder: (context, state) => const CaseListScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) {
              final id = int.parse(state.pathParameters['id']!);
              return CaseDetailScreen(caseId: id);
            },
            routes: [
              GoRoute(
                path: 'survey',
                builder: (context, state) {
                  final id = int.parse(state.pathParameters['id']!);
                  return SurveyFormScreen(caseId: id);
                },
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
