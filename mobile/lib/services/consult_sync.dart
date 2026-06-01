import 'package:call_log/call_log.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import '../utils/phone.dart';
import 'api_service.dart';

/// map CallLogEntry -> status (null = ข้าม) — logic เดียวกับหน้า Call Log / se-callphone
String? consultMapStatus(CallLogEntry e) {
  final dur = e.duration ?? 0;
  switch (e.callType) {
    case CallType.outgoing:
    case CallType.wifiOutgoing:
      return dur > 0 ? 'answered' : 'no_answer';
    case CallType.incoming:
    case CallType.wifiIncoming:
    case CallType.answeredExternally:
      return dur > 0 ? 'answered' : 'missed';
    case CallType.missed:
      return 'missed';
    case CallType.rejected:
      return 'rejected';
    default:
      return null;
  }
}

/// อ่าน call log บนเครื่อง -> กรองเฉพาะเบอร์หัวหน้า (จาก /consult/supervisors) -> sync ขึ้น backend.
/// คืนจำนวน upserted. ใช้ได้ทั้ง foreground และ background isolate
/// (ApiService อ่าน token จาก SharedPreferences ผ่าน interceptor เอง)
Future<int> runConsultSync() async {
  // ยังไม่ล็อกอิน -> ข้าม
  final prefs = await SharedPreferences.getInstance();
  if ((prefs.getString('token') ?? '').isEmpty) return 0;

  await ApiConfig.init();
  final api = ApiService();

  // whitelist เบอร์หัวหน้า
  final supMap = <String, String>{};
  final sups = await api.getConsultSupervisors();
  for (final s in sups) {
    final num = normalizePhone(s['number'] as String?);
    if (num.isNotEmpty) supMap[num] = (s['name'] as String?) ?? '';
  }
  if (supMap.isEmpty) return 0;

  // อ่าน call log -> กรองเฉพาะเบอร์หัวหน้า
  final since = DateTime.now().subtract(const Duration(days: 365)).millisecondsSinceEpoch;
  final entries = await CallLog.query(dateFrom: since);
  final payload = <Map<String, dynamic>>[];
  for (final e in entries) {
    final st = consultMapStatus(e);
    if (st == null) continue;
    final ts = e.timestamp ?? 0;
    if (ts <= 0) continue;
    final norm = normalizePhone(e.number);
    if (!supMap.containsKey(norm)) continue;
    payload.add({
      'device_call_id': '$ts-$norm',
      'number': norm,
      'started_at': ts,
      'duration_sec': e.duration ?? 0,
      'status': st,
    });
  }
  if (payload.isEmpty) return 0;

  final res = await api.syncConsult(payload);
  return (res['upserted'] as num?)?.toInt() ?? 0;
}
