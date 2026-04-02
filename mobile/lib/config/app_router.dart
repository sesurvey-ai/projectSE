import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../screens/login_screen.dart';
import '../screens/case_list_screen.dart';
import '../screens/case_detail_screen.dart';
import '../screens/survey_form_screen.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

GoRouter createRouter(AuthProvider authProvider) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/cases',
    refreshListenable: authProvider,
    redirect: (BuildContext context, GoRouterState state) {
      final isLoggedIn = authProvider.isLoggedIn;
      final isLoggingIn = state.matchedLocation == '/login';

      if (!isLoggedIn && !isLoggingIn) {
        return '/login';
      }

      if (isLoggedIn && isLoggingIn) {
        return '/cases';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
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
