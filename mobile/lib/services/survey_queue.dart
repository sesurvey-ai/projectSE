import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import 'api_service.dart';

// คิวส่งงานสำรวจแบบออฟไลน์ — เก็บ payload ที่ส่งไม่สำเร็จเพราะไม่มีเน็ต
// แล้วลองส่งใหม่อัตโนมัติ (piggyback บน periodic WorkManager task ของ consult)
const String _kQueueKey = 'survey_submit_queue';

/// เพิ่มงานเข้าคิว (key = caseId, ค่าใหม่ทับค่าเก่าของเคสเดิม)
Future<void> enqueueSurvey(int caseId, Map<String, dynamic> data) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload(); // อ่านค่าล่าสุดจากดิสก์ก่อน (isolate background อาจเพิ่งเขียน)
  final raw = prefs.getString(_kQueueKey);
  final Map<String, dynamic> q = raw != null ? Map<String, dynamic>.from(jsonDecode(raw) as Map) : {};
  q['$caseId'] = data;
  await prefs.setString(_kQueueKey, jsonEncode(q));
}

Future<int> queuedSurveyCount() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload();
  final raw = prefs.getString(_kQueueKey);
  if (raw == null) return 0;
  return (jsonDecode(raw) as Map).length;
}

/// ล้างคิวทั้งหมด (ใช้ตอน logout — กัน survey ของ user เก่าถูกส่งด้วย token ของ user ใหม่)
Future<void> clearSurveyQueue() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_kQueueKey);
}

/// ลองส่งงานที่ค้างในคิวทั้งหมด — คืนจำนวนที่ส่งสำเร็จ
/// ใช้ได้ทั้ง foreground และ background isolate (ApiService อ่าน token จาก prefs เอง)
Future<int> flushSurveyQueue() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload(); // อ่านค่าล่าสุด (กัน cache ต่าง isolate)
  if ((prefs.getString('token') ?? '').isEmpty) return 0;
  final raw = prefs.getString(_kQueueKey);
  if (raw == null) return 0;
  final Map<String, dynamic> q = Map<String, dynamic>.from(jsonDecode(raw) as Map);
  if (q.isEmpty) return 0;

  await ApiConfig.init();
  final api = ApiService();
  var sent = 0;
  final done = <String>[]; // key ที่จัดการเสร็จแล้ว (สำเร็จ หรือ ล้มถาวร 4xx) → เอาออกจากคิว
  for (final entry in q.entries) {
    final caseId = int.tryParse(entry.key);
    if (caseId == null) { done.add(entry.key); continue; }
    try {
      await api.submitSurvey(caseId, Map<String, dynamic>.from(entry.value as Map), const []);
      sent++;
      done.add(entry.key);
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      // 4xx = ล้มถาวร (เช่น 403 เคสไม่อยู่สถานะ assigned = ส่งไปแล้ว/ถูกยกเลิก) → ทิ้ง ไม่ retry ตลอดกาล
      // 5xx / network (response == null) = ชั่วคราว → คงไว้ลองใหม่รอบหน้า
      if (code != null && code >= 400 && code < 500) done.add(entry.key);
    } catch (_) {
      // error อื่น → คงไว้ลองใหม่
    }
  }
  // re-read แล้วลบเฉพาะ key ที่จัดการแล้ว (ไม่ overwrite ทั้ง map — กัน enqueue ที่เกิดระหว่าง flush หาย)
  await prefs.reload();
  final curRaw = prefs.getString(_kQueueKey);
  final Map<String, dynamic> cur = curRaw != null ? Map<String, dynamic>.from(jsonDecode(curRaw) as Map) : {};
  for (final k in done) { cur.remove(k); }
  await prefs.setString(_kQueueKey, jsonEncode(cur));
  return sent;
}
