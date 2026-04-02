import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:audioplayers/audioplayers.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isPlaying = false;

  // Callback เมื่อกดรับงาน
  void Function(int caseId)? onAcceptSurvey;

  Future<void> initialize() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    const initSettings = InitializationSettings(android: androidSettings, iOS: iosSettings);

    await _plugin.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: _onResponse,
    );

    // ลบ channel เก่า
    final androidPlugin = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.deleteNotificationChannel(channelId: 'urgent_survey_channel');
    await androidPlugin?.deleteNotificationChannel(channelId: 'urgent_survey_channel_v2');

    // ตั้ง AudioPlayer ให้วนซ้ำ
    await _audioPlayer.setReleaseMode(ReleaseMode.loop);
    await _audioPlayer.setSource(AssetSource('alarm_loop.wav'));
  }

  void _onResponse(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null) {
      final caseId = int.tryParse(payload);
      if (caseId != null && onAcceptSurvey != null) {
        onAcceptSurvey!(caseId);
      }
    }
    // หยุดเสียงเมื่อกด notification
    stopAlarm();
  }

  /// แจ้งเตือนแบบดังไม่หยุด — notification + เล่นเสียงวนซ้ำ
  Future<void> showUrgentNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    // แสดง notification (ไม่มีเสียงจาก channel — เล่นเสียงเอง)
    final androidDetails = AndroidNotificationDetails(
      'urgent_survey_channel_v3',
      'งานสำรวจเร่งด่วน',
      channelDescription: 'แจ้งเตือนเมื่อมีงานสำรวจใหม่',
      importance: Importance.max,
      priority: Priority.high,
      playSound: false, // ไม่ใช้เสียง channel — เล่นเองผ่าน AudioPlayer
      enableVibration: true,
      vibrationPattern: Int64List.fromList([0, 500, 200, 500, 200, 500]),
      ongoing: true,
      autoCancel: false,
      fullScreenIntent: true,
      category: AndroidNotificationCategory.alarm,
      visibility: NotificationVisibility.public,
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

    // เล่นเสียง alarm วนซ้ำ
    await _startAlarm();
    debugPrint('[Notification] Urgent notification + alarm: id=$id');
  }

  /// เริ่มเล่นเสียง alarm วนซ้ำ
  Future<void> _startAlarm() async {
    if (_isPlaying) return;
    _isPlaying = true;
    try {
      await _audioPlayer.setReleaseMode(ReleaseMode.loop);
      await _audioPlayer.play(AssetSource('alarm_loop.wav'));
      debugPrint('[Notification] Alarm started');
    } catch (e) {
      debugPrint('[Notification] Alarm play error: $e');
    }
  }

  /// หยุดเสียง alarm
  Future<void> stopAlarm() async {
    if (!_isPlaying) return;
    _isPlaying = false;
    try {
      await _audioPlayer.stop();
      debugPrint('[Notification] Alarm stopped');
    } catch (e) {
      debugPrint('[Notification] Alarm stop error: $e');
    }
  }

  /// ยกเลิก notification + หยุดเสียง
  Future<void> cancelNotification(int id) async {
    await _plugin.cancel(id: id);
    await stopAlarm();
    debugPrint('[Notification] Cancelled: id=$id');
  }

  /// ยกเลิกทั้งหมด
  Future<void> cancelAll() async {
    await _plugin.cancelAll();
    await stopAlarm();
  }
}
