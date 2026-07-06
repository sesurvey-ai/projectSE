import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import 'api_service.dart';

// คิวส่งงานสำรวจแบบออฟไลน์ — เก็บ payload ที่ส่งไม่สำเร็จเพราะไม่มีเน็ต
// แล้วลองส่งใหม่อัตโนมัติ (piggyback บน periodic WorkManager task ของ consult)
const String _kQueueKey = 'survey_submit_queue';

/// เพิ่มงานเข้าคิว (key = caseId, ค่าใหม่ทับค่าเก่าของเคสเดิม)
Future<void> enqueueSurvey(int caseId, Map<String, dynamic> data) async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString(_kQueueKey);
  final Map<String, dynamic> q = raw != null ? Map<String, dynamic>.from(jsonDecode(raw) as Map) : {};
  q['$caseId'] = data;
  await prefs.setString(_kQueueKey, jsonEncode(q));
}

Future<int> queuedSurveyCount() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString(_kQueueKey);
  if (raw == null) return 0;
  return (jsonDecode(raw) as Map).length;
}

/// ลองส่งงานที่ค้างในคิวทั้งหมด — คืนจำนวนที่ส่งสำเร็จ
/// ใช้ได้ทั้ง foreground และ background isolate (ApiService อ่าน token จาก prefs เอง)
Future<int> flushSurveyQueue() async {
  final prefs = await SharedPreferences.getInstance();
  if ((prefs.getString('token') ?? '').isEmpty) return 0;
  final raw = prefs.getString(_kQueueKey);
  if (raw == null) return 0;
  final Map<String, dynamic> q = Map<String, dynamic>.from(jsonDecode(raw) as Map);
  if (q.isEmpty) return 0;

  await ApiConfig.init();
  final api = ApiService();
  var sent = 0;
  final remaining = <String, dynamic>{};
  for (final entry in q.entries) {
    final caseId = int.tryParse(entry.key);
    if (caseId == null) continue;
    try {
      await api.submitSurvey(caseId, Map<String, dynamic>.from(entry.value as Map), const []);
      sent++;
    } catch (_) {
      remaining[entry.key] = entry.value; // ยังส่งไม่ได้ → เก็บไว้ลองใหม่รอบหน้า
    }
  }
  await prefs.setString(_kQueueKey, jsonEncode(remaining));
  return sent;
}
