import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api_service.dart';

// Top-level handler for background messages
// new_survey จะถูกจัดการโดย native MyFirebaseMessagingService แล้ว (แสดง custom notification)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('Background message received: ${message.messageId}');
  // new_survey → native Android จัดการแล้ว ไม่ต้องทำซ้ำ
}

class FcmService {
  final ApiService _apiService;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  // Callback for when a notification is tapped with a case ID
  void Function(int caseId)? onNotificationTapWithCaseId;

  // Callback เมื่อได้รับงานสำรวจใหม่ (urgent notification)
  void Function(Map<String, dynamic> data)? onNewSurveyReceived;

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

      // Initialize Firebase Messaging
      await _initializeFirebase();
    } catch (e) {
      debugPrint(
          'FCM initialization failed (Firebase may not be configured): $e');
    }
  }

  Future<void> _initializeFirebase() async {
    try {
      final messaging = FirebaseMessaging.instance;

      // Register background message handler
      FirebaseMessaging.onBackgroundMessage(
          _firebaseMessagingBackgroundHandler);

      // Request notification permissions
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      debugPrint(
          'FCM permission status: ${settings.authorizationStatus}');

      // Get and send FCM token to server
      final String? token = await messaging.getToken();
      if (token != null) {
        debugPrint('FCM token obtained');
        await _sendTokenToServer(token);
      }

      // Listen for token refresh
      messaging.onTokenRefresh.listen((String newToken) {
        debugPrint('FCM token refreshed');
        _sendTokenToServer(newToken);
      });

      // Handle foreground messages
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('Foreground message received: ${message.messageId}');
        final data = message.data;

        // Data message type: new_survey → foreground ไม่ต้องทำอะไร (Socket.IO จัดการแล้ว)
        if (data['type'] == 'new_survey') {
          debugPrint('FCM foreground new_survey — skipped (Socket handles it)');
          return;
        }

        // Regular notification message
        final notification = message.notification;
        if (notification != null) {
          showLocalNotification(
            title: notification.title ?? 'SE Survey',
            body: notification.body ?? '',
            payload: data['case_id'],
          );
        }
      });

      // Handle notification tap when app is in background
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('Notification opened app: ${message.messageId}');
        final caseId = int.tryParse(message.data['case_id'] ?? '');
        if (caseId != null && onNotificationTapWithCaseId != null) {
          onNotificationTapWithCaseId!(caseId);
        }
      });

      // Check if app was opened from a terminated state via notification
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        final caseId =
            int.tryParse(initialMessage.data['case_id'] ?? '');
        if (caseId != null && onNotificationTapWithCaseId != null) {
          onNotificationTapWithCaseId!(caseId);
        }
      }
    } catch (e) {
      debugPrint('Firebase messaging setup failed: $e');
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
