import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_overlay_window/flutter_overlay_window.dart' hide NotificationVisibility;

// Background action handler (ต้องเป็น top-level function)
@pragma('vm:entry-point')
void onNotificationAction(NotificationResponse response) {
  debugPrint('[Notification] Action: ${response.actionId} payload: ${response.payload}');
  final ns = NotificationService();
  final id = int.tryParse(response.payload ?? '') ?? 0;

  if (response.actionId == 'decline') {
    ns.cancelNotification(id);
    ns._onDeclineAction?.call(id);
  } else {
    // กด 'accept' หรือกดที่ notification body → รับงาน
    ns.cancelNotification(id);
    ns._onAcceptAction?.call(id);
  }
}

class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isPlaying = false;

  // Native MethodChannel for custom notification
  static const _nativeChannel = MethodChannel('com.sesurvey.se_survey/notification');

  // Callbacks
  void Function(int caseId)? _onAcceptAction;
  void Function(int caseId)? _onDeclineAction;

  void setCallbacks({
    void Function(int caseId)? onAccept,
    void Function(int caseId)? onDecline,
  }) {
    _onAcceptAction = onAccept;
    _onDeclineAction = onDecline;
  }

  Future<void> initialize() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    const initSettings = InitializationSettings(android: androidSettings, iOS: iosSettings);

    await _plugin.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: onNotificationAction,
      onDidReceiveBackgroundNotificationResponse: onNotificationAction,
    );

    // ลบ channel เก่าทั้งหมด เพื่อให้สร้างใหม่พร้อมเสียง
    final androidPlugin = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    for (final ch in [
      'se_survey_channel',
      'urgent_survey_channel', 'urgent_survey_channel_v2', 'urgent_survey_channel_v3',
      'urgent_alarm_channel_v4', 'urgent_alarm_channel_v5', 'urgent_alarm_v6',
      'urgent_alarm_v7',
    ]) {
      await androidPlugin?.deleteNotificationChannel(channelId: ch);
    }

    // Listen for native notification actions (accept/decline from custom notification)
    _nativeChannel.setMethodCallHandler((call) async {
      if (call.method == 'onNotificationAction') {
        final action = call.arguments['action'] as String?;
        final caseId = call.arguments['caseId'] as int? ?? 0;
        debugPrint('[Notification] Native action: $action caseId=$caseId');

        await stopAlarm();
        try { await FlutterOverlayWindow.closeOverlay(); } catch (_) {}

        if (action == 'decline') {
          _onDeclineAction?.call(caseId);
        } else {
          _onAcceptAction?.call(caseId);
        }
      }
    });
  }

  /// แจ้งเตือนแบบสายเรียกเข้า LINE — custom layout พร้อมปุ่มรับ/ปฏิเสธ
  Future<void> showUrgentNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    final caseId = int.tryParse(payload ?? '') ?? id;

    try {
      // ใช้ native Android custom notification (LINE-style)
      await _nativeChannel.invokeMethod('showIncomingNotification', {
        'id': id,
        'title': title,
        'body': body,
        'caseId': caseId,
      });
      debugPrint('[Notification] Native incoming notification shown: id=$id');
    } catch (e) {
      debugPrint('[Notification] Native notification error: $e, falling back to flutter');
      // Fallback to flutter_local_notifications
      await _showFlutterNotification(id: id, title: title, body: body, payload: payload);
    }

    // Native MediaPlayer เล่นเสียงอยู่แล้ว — ไม่ต้องเล่นซ้ำจาก Flutter

    // แสดง overlay popup ทับแอปอื่น (ถ้ามี permission)
    try {
      final hasPermission = await FlutterOverlayWindow.isPermissionGranted();
      if (hasPermission) {
        await FlutterOverlayWindow.showOverlay(
          height: 200,
          width: WindowSize.matchParent,
          alignment: OverlayAlignment.topCenter,
          enableDrag: false,
        );
      }
    } catch (e) {
      debugPrint('[Notification] Overlay error: $e');
    }
  }

  /// Fallback notification ด้วย flutter_local_notifications
  Future<void> _showFlutterNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    final androidDetails = AndroidNotificationDetails(
      'urgent_alarm_v7',
      'งานสำรวจเร่งด่วน',
      channelDescription: 'เสียงดังจนกว่าจะกดรับ',
      importance: Importance.max,
      priority: Priority.high,
      sound: const RawResourceAndroidNotificationSound('alarm_loop'),
      playSound: true,
      audioAttributesUsage: AudioAttributesUsage.alarm,
      additionalFlags: Int32List.fromList([4]),
      enableVibration: true,
      vibrationPattern: Int64List.fromList([0, 500, 200, 500, 200, 500]),
      ongoing: false,
      autoCancel: false,
      fullScreenIntent: true,
      category: AndroidNotificationCategory.alarm,
      visibility: NotificationVisibility.public,
      ticker: 'งานสำรวจใหม่',
      styleInformation: BigTextStyleInformation(
        '$body\n\n⬇️ กดปุ่มด้านล่างเพื่อรับหรือปฏิเสธงาน',
        contentTitle: title,
      ),
      actions: const [
        AndroidNotificationAction('accept', '✅ รับงาน', showsUserInterface: true),
        AndroidNotificationAction('decline', '❌ ปฏิเสธ', showsUserInterface: true),
      ],
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: const DarwinNotificationDetails(
        presentAlert: true,
        presentSound: true,
        interruptionLevel: InterruptionLevel.critical,
      ),
    );

    await _plugin.show(
      id: id,
      title: title,
      body: body,
      notificationDetails: details,
      payload: payload,
    );
  }

  Future<void> stopAlarm() async {
    if (!_isPlaying) return;
    _isPlaying = false;
    try {
      await _audioPlayer.stop();
    } catch (e) {
      debugPrint('[Notification] Alarm stop error: $e');
    }
  }

  Future<void> cancelNotification(int id) async {
    await _plugin.cancel(id: id);
    // Cancel native notification too
    try {
      await _nativeChannel.invokeMethod('cancelNotification', {'id': id});
    } catch (_) {}
    await stopAlarm();
    try { await FlutterOverlayWindow.closeOverlay(); } catch (_) {}
  }

  Future<void> cancelAll() async {
    await _plugin.cancelAll();
    await stopAlarm();
    try { await FlutterOverlayWindow.closeOverlay(); } catch (_) {}
  }
}
