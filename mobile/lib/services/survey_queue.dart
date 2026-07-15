import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import 'api_service.dart';

// คิวส่งงานสำรวจแบบออฟไลน์ — เก็บ payload ที่ส่งไม่สำเร็จเพราะไม่มีเน็ต
// แล้วลองส่งใหม่อัตโนมัติ (piggyback บน periodic WorkManager task ของ consult)
//
// โครงเก็บ: หนึ่งเคส = หนึ่ง key ('survey_q_<caseId>') — เดิมเก็บทุกเคสรวมเป็น map เดียว
// ใน key เดียว แล้ว flush (background isolate) กับ enqueue (UI isolate) ทำ read-modify-write
// แข่งกันโดยไม่มี lock → enqueue ที่เบียดเข้า gap ระหว่าง reload กับ setString ของ flush
// ถูกทับหายเงียบ; แยก key ต่อเคสแล้วต่างฝ่ายต่างเขียน/ลบ key ของตัวเอง ไม่มี shared blob ให้ชน
const String _kQueuePrefix = 'survey_q_';
const String _kLegacyQueueKey = 'survey_submit_queue'; // โครงเก่า (map รวม) — migrate แล้วลบ

/// เพิ่มงานเข้าคิว (key ต่อเคส, ค่าใหม่ทับค่าเก่าของเคสเดิม)
Future<void> enqueueSurvey(int caseId, Map<String, dynamic> data) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('$_kQueuePrefix$caseId', jsonEncode(data));
}

/// ย้ายคิวโครงเก่า (map รวมใน key เดียว) → key ต่อเคส (ครั้งเดียว; APK เก่าอัปเป็นตัวใหม่)
Future<void> _migrateLegacyQueue(SharedPreferences prefs) async {
  final raw = prefs.getString(_kLegacyQueueKey);
  if (raw == null) return;
  try {
    final Map<String, dynamic> q = Map<String, dynamic>.from(jsonDecode(raw) as Map);
    for (final e in q.entries) {
      final key = '$_kQueuePrefix${e.key}';
      // reload ก่อนเช็คทุกตัว — containsKey ตอบจาก cache ของ isolate ตัวเอง ถ้าอีก isolate
      // เพิ่ง enqueue ของใหม่ระหว่าง migrate จะมองไม่เห็นแล้วเอาของเก่าทับ
      await prefs.reload();
      // ไม่ทับของใหม่ — ถ้ามี key ต่อเคสอยู่แล้วแปลว่า enqueue ใหม่กว่าเกิดหลัง migrate เริ่ม
      if (!prefs.containsKey(key) && e.value is Map) {
        await prefs.setString(key, jsonEncode(e.value));
      }
    }
  } catch (_) {/* blob เก่าพัง → ทิ้ง (พฤติกรรมเดิมของ corrupt blob) */}
  await prefs.remove(_kLegacyQueueKey);
}

Future<int> queuedSurveyCount() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload();
  await _migrateLegacyQueue(prefs);
  return prefs.getKeys().where((k) => k.startsWith(_kQueuePrefix)).length;
}

/// ล้างคิวทั้งหมด (ใช้ตอน logout — กัน survey ของ user เก่าถูกส่งด้วย token ของ user ใหม่)
Future<void> clearSurveyQueue() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload();
  for (final k in prefs.getKeys().where((k) => k.startsWith(_kQueuePrefix)).toList()) {
    await prefs.remove(k);
  }
  await prefs.remove(_kLegacyQueueKey);
}

/// ลองส่งงานที่ค้างในคิวทั้งหมด — คืนจำนวนที่ส่งสำเร็จ
/// ใช้ได้ทั้ง foreground และ background isolate (ApiService อ่าน token จาก prefs เอง)
Future<int> flushSurveyQueue() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload(); // อ่านค่าล่าสุด (กัน cache ต่าง isolate)
  if ((prefs.getString('token') ?? '').isEmpty) return 0;
  await _migrateLegacyQueue(prefs);
  final keys = prefs.getKeys().where((k) => k.startsWith(_kQueuePrefix)).toList();
  if (keys.isEmpty) return 0;

  await ApiConfig.init();
  final api = ApiService();
  var sent = 0;
  for (final key in keys) {
    final caseId = int.tryParse(key.substring(_kQueuePrefix.length));
    final raw = prefs.getString(key);
    if (caseId == null || raw == null) { await prefs.remove(key); continue; }
    Map<String, dynamic> data;
    try {
      data = Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) { await prefs.remove(key); continue; } // payload พัง → กู้ไม่ได้ ลบทิ้ง
    // ลบ key เฉพาะเมื่อค่าปัจจุบันยังเป็น payload ตัวที่เพิ่งส่ง — submit กินเวลาได้เป็นนาที
    // (อัปโหลดรูป) ระหว่างนั้น UI isolate อาจ enqueue payload ใหม่กว่าทับ key เดิม
    // ถ้าลบดื้อ ๆ ของใหม่หายเงียบแล้ว server ค้างข้อมูลเก่า
    Future<void> removeIfUnchanged() async {
      await prefs.reload();
      if (prefs.getString(key) == raw) await prefs.remove(key);
      // ไม่ตรง = มี payload ใหม่กว่าเข้ามาระหว่างส่ง → เก็บไว้ให้รอบหน้าลอง
    }
    try {
      await api.submitSurvey(caseId, data, const []);
      sent++;
      await removeIfUnchanged();
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      // ทิ้งเฉพาะ code ที่ "ล้มถาวรจริง" (payload/สถานะเดิมไม่มีทางผ่าน เช่น 403 เคสไม่อยู่สถานะ assigned = ส่งไปแล้ว/ยกเลิก)
      // สำคัญ: อย่าเหมา 4xx ทั้งหมด — 401 (token หมดอายุใน background), 408/429 (timeout/rate-limit), 413 = กู้ได้ ต้องคงไว้ retry
      // ไม่งั้น background flush จะทิ้งงานสำรวจที่ส่งเสร็จแล้วทิ้งเงียบ ๆ (ข้อมูลหายกู้ไม่ได้)
      const permanent = [400, 403, 404, 409, 410, 422];
      // ยกเว้น: 404 จาก endpoint อัปโหลด (/upload-folder*) = backend ยังไม่มี route v2
      // (rollback/deploy ไม่ทัน) — กู้ได้เมื่อ backend อัปเดต ห้ามทิ้งงานถาวร
      final uploadRouteMissing = code == 404 && e.requestOptions.path.contains('/upload-folder');
      if (code != null && permanent.contains(code) && !uploadRouteMissing) {
        await removeIfUnchanged(); // payload ใหม่กว่าที่เข้ามาระหว่างส่ง อาจผ่านได้ — อย่าลบเหมา
      }
      // อื่น ๆ (401/408/413/429 / 5xx / network) → คง key ไว้ลองใหม่รอบหน้า
    } catch (_) {
      // error อื่น → คงไว้ลองใหม่
    }
  }
  return sent;
}
