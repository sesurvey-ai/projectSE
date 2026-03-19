import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api_service.dart';

class FcmService {
  final ApiService _apiService;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  // Callback for when a notification is tapped with a case ID
  void Function(int caseId)? onNotificationTapWithCaseId;

  FcmService(this._apiService);

  Future<void> initialize() async {
    try {
      // Initialize local notifications
      const androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );
      const initSettings = InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      );

      await _localNotifications.initialize(
        settings: initSettings,
        onDidReceiveNotificationResponse: _onNotificationTap,
      );

      // Try Firebase initialization
      await _initializeFirebase();
    } catch (e) {
      debugPrint(
          'FCM initialization failed (Firebase may not be configured): $e');
    }
  }

  Future<void> _initializeFirebase() async {
    try {
      // Dynamically attempt to use Firebase Messaging.
      // If Firebase is not configured, this will fail gracefully.
      final dynamic messaging = _tryGetFirebaseMessaging();
      if (messaging == null) return;

      await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      final String? token = await messaging.getToken();
      if (token != null) {
        await _sendTokenToServer(token);
      }

      messaging.onTokenRefresh.listen((String newToken) {
        _sendTokenToServer(newToken);
      });
    } catch (e) {
      debugPrint('Firebase messaging setup failed: $e');
    }
  }

  dynamic _tryGetFirebaseMessaging() {
    try {
      // This will be replaced with actual FirebaseMessaging.instance
      // once Firebase is properly configured in the project.
      // For now, return null to avoid crashes.
      return null;
    } catch (e) {
      debugPrint('FirebaseMessaging not available: $e');
      return null;
    }
  }

  Future<void> _sendTokenToServer(String token) async {
    try {
      await _apiService.updateFcmToken(token);
    } catch (e) {
      debugPrint('Failed to send FCM token to server: $e');
    }
  }

  void _onNotificationTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null) {
      final caseId = int.tryParse(payload);
      if (caseId != null && onNotificationTapWithCaseId != null) {
        onNotificationTapWithCaseId!(caseId);
      }
    }
  }

  Future<void> showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'se_survey_channel',
      'SE Survey Notifications',
      channelDescription: 'Notifications for SE Survey app',
      importance: Importance.high,
      priority: Priority.high,
    );
    const iosDetails = DarwinNotificationDetails();
    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: title,
      body: body,
      notificationDetails: details,
      payload: payload,
    );
  }
}
