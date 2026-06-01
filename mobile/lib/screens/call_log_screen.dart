import 'package:call_log/call_log.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/api_service.dart';
import '../utils/phone.dart';

// ── tokens (match app design) ──
const _primary = Color(0xFF2F6BD8);
const _bg = Color(0xFFEEF0F4);
const _ink = Color(0xFF1E2330);
const _muted = Color(0xFF737D90);
const _lineStrong = Color(0xFFDDE1E9);
const _line = Color(0xFFE8EBF1);
const _green = Color(0xFF1F9D6B);
const _red = Color(0xFFDC2626);
const _orange = Color(0xFFEA580C);

/// 1 รายการสาย
class _Call {
  _Call({
    required this.number,
    this.name,
    required this.startedAt,
    required this.durationSec,
    required this.status,
    required this.isSupervisor,
  });
  final String number;
  final String? name; // ชื่อหัวหน้า (จาก whitelist) หรือชื่อ contact
  final DateTime startedAt;
  final int durationSec;
  final String status; // answered | no_answer | missed | rejected
  final bool isSupervisor;
}

/// หน้าแสดง "การโทรปรึกษาหัวหน้า" — อ่าน call log บนเครื่อง
///  - ค่าเริ่มต้น: แสดงเฉพาะสายที่เป็นเบอร์หัวหน้า (จาก DB) + sync ขึ้น backend
///  - ปุ่ม "ทั้งหมด": แสดงทุกสายบนเครื่อง
class CallLogScreen extends StatefulWidget {
  const CallLogScreen({super.key});

  @override
  State<CallLogScreen> createState() => _CallLogScreenState();
}

class _CallLogScreenState extends State<CallLogScreen> {
  final _api = ApiService();
  List<_Call> _all = [];
  bool _loading = true;
  bool _denied = false;
  bool _showAll = false; // false = เฉพาะหัวหน้า (ค่าเริ่มต้น)
  bool _hasSupervisor = true; // มีเบอร์หัวหน้าใน DB หรือไม่
  String? _error;
  String _syncStatus = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// map CallLogEntry -> status (null = ข้าม) — logic เดียวกับ se-callphone
  static String? _mapStatus(CallLogEntry e) {
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

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _denied = false;
    });

    // 1) สิทธิ์อ่านประวัติการโทร
    final perm = await Permission.phone.request();
    if (!perm.isGranted) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _denied = true;
      });
      return;
    }

    // 2) whitelist เบอร์หัวหน้า (จาก backend) — ไม่ใช่ตัวบล็อก (ถ้าพลาดก็ดู "ทั้งหมด" ได้)
    final supMap = <String, String>{};
    try {
      final sups = await _api.getConsultSupervisors();
      for (final s in sups) {
        final num = normalizePhone(s['number'] as String?);
        if (num.isNotEmpty) supMap[num] = (s['name'] as String?) ?? '';
      }
    } catch (_) {}

    // 3) อ่าน call log ทั้งหมด -> ทำเครื่องหมายว่าเป็นสายหัวหน้าหรือไม่
    try {
      final since = DateTime.now().subtract(const Duration(days: 365)).millisecondsSinceEpoch;
      final entries = await CallLog.query(dateFrom: since);
      final all = <_Call>[];
      final payload = <Map<String, dynamic>>[];
      for (final e in entries) {
        final st = _mapStatus(e);
        if (st == null) continue;
        final ts = e.timestamp ?? 0;
        if (ts <= 0) continue;
        final norm = normalizePhone(e.number);
        final isSup = norm.isNotEmpty && supMap.containsKey(norm);
        final contact = (e.name ?? '').trim();
        final disp = norm.isNotEmpty ? norm : (contact.isEmpty ? 'ไม่ทราบเบอร์' : norm);
        all.add(_Call(
          number: disp.isEmpty ? 'ไม่ทราบเบอร์' : disp,
          name: isSup ? supMap[norm] : (contact.isEmpty ? null : contact),
          startedAt: DateTime.fromMillisecondsSinceEpoch(ts),
          durationSec: e.duration ?? 0,
          status: st,
          isSupervisor: isSup,
        ));
        if (isSup) {
          payload.add({
            'device_call_id': '$ts-$norm',
            'number': norm,
            'started_at': ts,
            'duration_sec': e.duration ?? 0,
            'status': st,
          });
        }
      }
      all.sort((a, b) => b.startedAt.compareTo(a.startedAt));
      if (!mounted) return;
      setState(() {
        _all = all;
        _hasSupervisor = supMap.isNotEmpty;
        _loading = false;
      });
      _syncToServer(payload);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'อ่านประวัติการโทรไม่สำเร็จ';
      });
    }
  }

  Future<void> _syncToServer(List<Map<String, dynamic>> payload) async {
    if (payload.isEmpty) {
      if (mounted) setState(() => _syncStatus = _hasSupervisor ? 'ยังไม่มีสายปรึกษาหัวหน้า' : 'ยังไม่ได้ตั้งค่าเบอร์หัวหน้า');
      return;
    }
    if (mounted) setState(() => _syncStatus = 'กำลังซิงค์...');
    try {
      final res = await _api.syncConsult(payload);
      final up = (res['upserted'] as num?)?.toInt() ?? 0;
      if (mounted) setState(() => _syncStatus = 'ซิงค์ขึ้นระบบแล้ว · $up รายการ');
    } catch (_) {
      if (mounted) setState(() => _syncStatus = 'ซิงค์ไม่สำเร็จ · จะลองใหม่ภายหลัง');
    }
  }

  List<_Call> get _visible => _showAll ? _all : _all.where((c) => c.isSupervisor).toList();

  @override
  Widget build(BuildContext context) {
    final items = _visible;
    final total = items.length;
    final answered = items.where((i) => i.status == 'answered').length;
    final notAns = total - answered;

    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        foregroundColor: _ink,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('การโทรปรึกษาหัวหน้า', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
            if (_syncStatus.isNotEmpty)
              Text(_syncStatus, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500, color: _muted)),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.refresh, color: _muted), tooltip: 'รีเฟรช', onPressed: _load),
        ],
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: _line)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _denied
              ? _msgView(Icons.lock_outline, 'แอปต้องการสิทธิ์อ่านประวัติการโทร\nเพื่อบันทึกการโทรปรึกษาหัวหน้า', 'อนุญาตสิทธิ์', _load, showSettings: true)
              : _error != null
                  ? _msgView(Icons.error_outline, _error!, 'ลองใหม่', _load)
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: Column(
                        children: [
                          _modeToggle(),
                          if (!_showAll && !_hasSupervisor) _noSupervisorHint(),
                          _summary(total, answered, notAns),
                          Expanded(
                            child: items.isEmpty
                                ? ListView(children: [
                                    const SizedBox(height: 80),
                                    Center(
                                      child: Text(
                                        _showAll ? 'ยังไม่มีประวัติการโทร' : 'ยังไม่มีสายโทรปรึกษาหัวหน้า',
                                        style: const TextStyle(color: _muted),
                                      ),
                                    ),
                                  ])
                                : ListView.builder(
                                    padding: const EdgeInsets.fromLTRB(14, 4, 14, 16),
                                    itemCount: items.length,
                                    itemBuilder: (_, i) => _tile(items[i]),
                                  ),
                          ),
                        ],
                      ),
                    ),
    );
  }

  // ── ปุ่มสลับโหมด: เฉพาะหัวหน้า (default) | ทั้งหมด ──
  Widget _modeToggle() {
    Widget pill(String label, bool selected, VoidCallback onTap) => Expanded(
          child: GestureDetector(
            onTap: onTap,
            child: Container(
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: BoxDecoration(
                color: selected ? _primary : Colors.white,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: selected ? _primary : _lineStrong, width: 1.5),
              ),
              child: Text(label,
                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: selected ? Colors.white : _muted)),
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      child: Row(children: [
        pill('เฉพาะหัวหน้า', !_showAll, () => setState(() => _showAll = false)),
        const SizedBox(width: 10),
        pill('ทั้งหมด', _showAll, () => setState(() => _showAll = true)),
      ]),
    );
  }

  Widget _noSupervisorHint() => Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFFDF3DF), borderRadius: BorderRadius.circular(12)),
          child: const Row(children: [
            Icon(Icons.info_outline, size: 18, color: Color(0xFFC98A06)),
            SizedBox(width: 8),
            Expanded(
              child: Text('ยังไม่ได้ตั้งค่าเบอร์หัวหน้า · กด "ทั้งหมด" เพื่อดูทุกสาย',
                  style: TextStyle(fontSize: 12.5, color: Color(0xFF8A6406))),
            ),
          ]),
        ),
      );

  Widget _summary(int total, int answered, int notAns) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
        child: Row(children: [
          _statCard('$total', 'โทรทั้งหมด', _primary),
          const SizedBox(width: 10),
          _statCard('$answered', 'รับสาย', _green),
          const SizedBox(width: 10),
          _statCard('$notAns', 'ไม่รับสาย', _red),
        ]),
      );

  Widget _statCard(String n, String l, Color c) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: _line)),
          child: Column(children: [
            Text(n, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: c)),
            const SizedBox(height: 2),
            Text(l, style: const TextStyle(fontSize: 11.5, color: _muted)),
          ]),
        ),
      );

  Widget _tile(_Call it) {
    final missed = it.status == 'missed';
    final avBg = missed ? const Color(0xFFFFEDD5) : const Color(0xFFEAF1FD);
    final avFg = missed ? _orange : _primary;
    return Container(
      margin: const EdgeInsets.only(bottom: 9),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: avBg, borderRadius: BorderRadius.circular(12)),
          child: Icon(missed ? Icons.call_missed : Icons.call_made, color: avFg, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(
                child: Text(
                  it.name?.isNotEmpty == true ? it.name! : it.number,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _ink),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (_showAll && it.isSupervisor) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(color: const Color(0xFFEAF1FD), borderRadius: BorderRadius.circular(999)),
                  child: const Text('หัวหน้า', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _primary)),
                ),
              ],
            ]),
            const SizedBox(height: 2),
            Text('${it.number} · ${_when(it.startedAt)}', style: const TextStyle(fontSize: 11.5, color: _muted)),
          ]),
        ),
        const SizedBox(width: 8),
        _badge(it),
      ]),
    );
  }

  Widget _badge(_Call it) {
    late Color bg, fg;
    late String txt;
    switch (it.status) {
      case 'answered':
        bg = const Color(0xFFDCFCE7);
        fg = _green;
        txt = 'รับสาย · ${_dur(it.durationSec)}';
        break;
      case 'missed':
        bg = const Color(0xFFFFEDD5);
        fg = _orange;
        txt = 'สายที่พลาด';
        break;
      case 'rejected':
        bg = const Color(0xFFFEE2E2);
        fg = _red;
        txt = 'ปฏิเสธสาย';
        break;
      default: // no_answer
        bg = const Color(0xFFFEE2E2);
        fg = _red;
        txt = 'ไม่รับสาย';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(txt, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
    );
  }

  Widget _msgView(IconData icon, String message, String action, VoidCallback onTap, {bool showSettings = false}) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 48, color: _muted),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: _muted)),
            const SizedBox(height: 20),
            FilledButton(onPressed: onTap, child: Text(action)),
            if (showSettings) ...[
              const SizedBox(height: 8),
              TextButton(onPressed: openAppSettings, child: const Text('เปิดการตั้งค่าแอป')),
            ],
          ]),
        ),
      );

  // ── format helpers ──
  String _two(int n) => n.toString().padLeft(2, '0');
  String _hhmm(DateTime d) => '${_two(d.hour)}:${_two(d.minute)}';
  String _dur(int s) => '${s ~/ 60}:${_two(s % 60)}';
  String _when(DateTime d) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return 'วันนี้ ${_hhmm(d)} น.';
    if (diff == 1) return 'เมื่อวาน ${_hhmm(d)} น.';
    return '${d.day}/${d.month} ${_hhmm(d)} น.';
  }
}
