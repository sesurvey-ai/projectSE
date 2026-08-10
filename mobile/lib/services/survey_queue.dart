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
// เหตุผลที่ส่งไม่ผ่านแบบ "ต้องคนแก้" — เก็บคู่กับ payload ไม่ใช่แทนที่ (ดู _kBlockedPrefix)
const String _kBlockedPrefix = 'survey_qerr_';

/// เพิ่มงานเข้าคิว (key ต่อเคส, ค่าใหม่ทับค่าเก่าของเคสเดิม)
Future<void> enqueueSurvey(int caseId, Map<String, dynamic> data) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('$_kQueuePrefix$caseId', jsonEncode(data));
  // payload ใหม่ = ผู้ใช้แก้แล้ว → ล้างสถานะติดขัดเดิม ให้กลับไปลองส่งอีกครั้ง
  await prefs.remove('$_kBlockedPrefix$caseId');
}

/// งานที่ส่งไม่ผ่านและ "ลองใหม่เองไม่ได้" — ต้องให้ผู้ใช้แก้ก่อน
/// คืน {caseId: ข้อความจากเซิร์ฟเวอร์} ให้หน้าจอเอาไปเตือน
Future<Map<int, String>> blockedSurveys() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.reload();
  final out = <int, String>{};
  for (final k in prefs.getKeys().where((k) => k.startsWith(_kBlockedPrefix))) {
    final id = int.tryParse(k.substring(_kBlockedPrefix.length));
    if (id == null) continue;
    try {
      final m = Map<String, dynamic>.from(jsonDecode(prefs.getString(k) ?? '{}') as Map);
      out[id] = '${m['message'] ?? 'ส่งงานไม่สำเร็จ'}';
    } catch (_) {/* ข้าม record ที่พัง */}
  }
  return out;
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
  for (final k in prefs.getKeys()
      .where((k) => k.startsWith(_kQueuePrefix) || k.startsWith(_kBlockedPrefix))
      .toList()) {
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
    // เคยส่งแล้วติดขัดด้วย payload ชุดเดิม → ข้าม ไม่ต้องลองซ้ำ (รอผู้ใช้แก้)
    // เทียบด้วย payload ที่ล้มไว้ ถ้าผู้ใช้แก้แล้ว payload จะต่าง = กลับมาลองใหม่เอง
    final blockedRaw = prefs.getString('$_kBlockedPrefix$caseId');
    if (blockedRaw != null) {
      try {
        final b = Map<String, dynamic>.from(jsonDecode(blockedRaw) as Map);
        if (b['payload'] == raw) continue;
      } catch (_) {/* record พัง → ปล่อยให้ลองส่งตามปกติ */}
      await prefs.remove('$_kBlockedPrefix$caseId');
    }
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
      // แยก 3 กลุ่ม — เดิมเหมา 6 code เป็น "ลบทิ้ง" เหมือนกันหมด ซึ่งทำให้ฟอร์มที่กรอก
      // มาทั้งวันหายเงียบเมื่อเจอ validation error (400/422) หรือเลขเซอร์เวย์ซ้ำ (409)
      //
      // ก) งานไปถึงปลายทางแล้ว/เคสไม่รับแล้ว → ลบได้ ไม่มีอะไรให้กู้
      //    403 = เคสไม่อยู่สถานะ assigned (ส่งไปแล้ว/ยกเลิก) · 404/410 = เคสหายไป
      const doneOrGone = [403, 404, 410];
      // ข) payload ผิดจริง ลองใหม่กี่รอบก็ผลเดิม แต่ **ห้ามลบ** — ต้องให้คนแก้
      //    400/422 = ข้อมูลไม่ผ่าน validation · 409 = เลขเซอร์เวย์ซ้ำ / สถานะเปลี่ยน
      const needsUserFix = [400, 409, 422];
      // ค) ที่เหลือ (401/408/413/429 / 5xx / network) = กู้ได้ คงคิวไว้ลองรอบหน้า
      //
      // ยกเว้น: 404 จาก endpoint อัปโหลด (/upload-folder*) = backend ยังไม่มี route v2
      // (rollback/deploy ไม่ทัน) — กู้ได้เมื่อ backend อัปเดต ห้ามทิ้งงานถาวร
      final uploadRouteMissing = code == 404 && e.requestOptions.path.contains('/upload-folder');
      if (code != null && doneOrGone.contains(code) && !uploadRouteMissing) {
        await removeIfUnchanged(); // payload ใหม่กว่าที่เข้ามาระหว่างส่ง อาจผ่านได้ — อย่าลบเหมา
      } else if (code != null && needsUserFix.contains(code)) {
        // เก็บ payload ไว้ + จำเหตุผล แล้วหยุดลองอัตโนมัติ (กันวนอัปรูปทั้งโฟลเดอร์ทุก 15 นาที)
        // จะกลับมาลองใหม่เมื่อผู้ใช้แก้ฟอร์มแล้ว enqueue ทับ (enqueueSurvey ล้าง key นี้ให้)
        final body = e.response?.data;
        final msg = (body is Map && body['message'] != null)
            ? '${body['message']}'
            : 'ส่งงานไม่สำเร็จ (รหัส $code) — ตรวจข้อมูลแล้วกดส่งใหม่';
        await prefs.setString('$_kBlockedPrefix$caseId',
            jsonEncode({'code': code, 'message': msg, 'payload': raw}));
      }
    } catch (_) {
      // error อื่น → คงไว้ลองใหม่
    }
  }
  return sent;
}
