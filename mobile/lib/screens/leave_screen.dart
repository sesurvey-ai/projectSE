import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

// ── tokens (match app design) ──
const _primary = Color(0xFF2F6BD8);
const _bg = Color(0xFFEEF0F4);
const _ink = Color(0xFF1E2330);
const _muted = Color(0xFF737D90);
const _line = Color(0xFFE8EBF1);
const _fill = Color(0xFFF4F6F9);
const _tint = Color(0xFFEAF1FD);
const _green = Color(0xFF1F9D6B);
const _greenTint = Color(0xFFE4F6EE);
const _orange = Color(0xFFC98A06);
const _orangeTint = Color(0xFFFDF3DF);
const _red = Color(0xFFDC2626);
const _redTint = Color(0xFFFCE9E9);

const _thaiMonthsShort = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const _thaiMonthsFull = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const _leaveTypes = [
  ['sick', 'ลาป่วย'],
  ['personal', 'ลากิจ'],
  ['vacation', 'ลาพักร้อน'],
  ['other', 'อื่นๆ'],
];

String _leaveTypeLabel(String? v) {
  final t = _leaveTypes.firstWhere((e) => e[0] == v, orElse: () => ['', '-']);
  return t[1];
}

String _iso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String _thaiShort(DateTime d) => '${d.day} ${_thaiMonthsShort[d.month]} ${d.year + 543}';

/// แปลง "2026-06-10" -> DateTime (เผื่อ backend ส่ง YYYY-MM-DD)
DateTime? _parseIso(String? s) {
  if (s == null || s.length < 10) return null;
  final p = s.substring(0, 10).split('-');
  if (p.length != 3) return null;
  final y = int.tryParse(p[0]), m = int.tryParse(p[1]), d = int.tryParse(p[2]);
  if (y == null || m == null || d == null) return null;
  return DateTime(y, m, d);
}

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  final _api = ApiService();
  final _reasonCtl = TextEditingController();

  String _type = 'sick';
  DateTime? _start;
  DateTime? _end;
  bool _submitting = false;

  List<dynamic> _requests = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reasonCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await _api.getMyLeaves();
      if (mounted) setState(() => _requests = list);
    } catch (_) {
      // เงียบไว้ — แสดงรายการว่างถ้าโหลดไม่ได้
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<DateTime?> _pickDate(DateTime initial) {
    final nowBE = DateTime.now().year + 543;
    const span = 1; // ปีก่อน/หลังปัจจุบัน
    final minYearBE = nowBE - span;
    final maxYearBE = nowBE + span;
    int selDay = initial.day;
    int selMonth = initial.month;
    int selYearBE = (initial.year + 543).clamp(minYearBE, maxYearBE);

    // ปล่อย focus ของช่องข้อความที่ค้างอยู่ ก่อนเปิด bottom sheet → ปิดแล้วไม่เด้ง focus/คีย์บอร์ดกลับ
    FocusManager.instance.primaryFocus?.unfocus();
    return showModalBottomSheet<DateTime>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setM) {
            final maxDay = DateTime(selYearBE - 543, selMonth + 1, 0).day;
            if (selDay > maxDay) selDay = maxDay;
            Widget wheel({required int count, required int initialItem, required ValueChanged<int> onChange, required Widget Function(int) build}) {
              return Expanded(
                child: ListWheelScrollView.useDelegate(
                  itemExtent: 38,
                  diameterRatio: 1.5,
                  physics: const FixedExtentScrollPhysics(),
                  controller: FixedExtentScrollController(initialItem: initialItem),
                  onSelectedItemChanged: onChange,
                  childDelegate: ListWheelChildBuilderDelegate(childCount: count, builder: (c, i) => build(i)),
                ),
              );
            }

            Widget label(String t) => Text(t, style: const TextStyle(fontSize: 13, color: _muted));
            Widget item(String t, bool sel) => Center(child: Text(t, style: TextStyle(fontSize: 18, color: sel ? _primary : _ink, fontWeight: sel ? FontWeight.bold : FontWeight.normal)));

            return SafeArea(
              child: SizedBox(
                height: 330,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('เลือกวันที่', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _ink)),
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, DateTime(selYearBE - 543, selMonth, selDay)),
                            child: const Text('ตกลง', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: _primary)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Expanded(
                        child: Row(
                          children: [
                            Expanded(
                              flex: 2,
                              child: Column(children: [label('วัน'), const SizedBox(height: 4), wheel(count: maxDay, initialItem: selDay - 1, onChange: (i) => setM(() => selDay = i + 1), build: (i) => item('${i + 1}', i + 1 == selDay))]),
                            ),
                            Expanded(
                              flex: 4,
                              child: Column(children: [label('เดือน'), const SizedBox(height: 4), wheel(count: 12, initialItem: selMonth - 1, onChange: (i) => setM(() => selMonth = i + 1), build: (i) => item(_thaiMonthsFull[i + 1], i + 1 == selMonth))]),
                            ),
                            Expanded(
                              flex: 3,
                              child: Column(children: [label('ปี พ.ศ.'), const SizedBox(height: 4), wheel(count: maxYearBE - minYearBE + 1, initialItem: selYearBE - minYearBE, onChange: (i) => setM(() => selYearBE = minYearBE + i), build: (i) => item('${minYearBE + i}', minYearBE + i == selYearBE))]),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _submit() async {
    if (_start == null || _end == null) {
      _snack('กรุณาเลือกวันที่เริ่มและวันที่สิ้นสุด', _red);
      return;
    }
    if (_end!.isBefore(_start!)) {
      _snack('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม', _red);
      return;
    }
    setState(() => _submitting = true);
    try {
      await _api.createLeave({
        'leave_type': _type,
        'start_date': _iso(_start!),
        'end_date': _iso(_end!),
        if (_reasonCtl.text.trim().isNotEmpty) 'reason': _reasonCtl.text.trim(),
      });
      if (!mounted) return;
      _reasonCtl.clear();
      setState(() {
        _start = null;
        _end = null;
        _type = 'sick';
      });
      _snack('ส่งใบลาเรียบร้อย', _green);
      await _load();
    } on DioException catch (e) {
      final msg = e.response?.data is Map ? (e.response?.data['message']?.toString() ?? 'ส่งใบลาไม่สำเร็จ') : 'ส่งใบลาไม่สำเร็จ';
      if (mounted) _snack(msg, _red);
    } catch (_) {
      if (mounted) _snack('ส่งใบลาไม่สำเร็จ', _red);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _snack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color, behavior: SnackBarBehavior.floating));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        foregroundColor: _ink,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: const Text('ลางาน', style: TextStyle(fontWeight: FontWeight.w600)),
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: _line)),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            _formCard(),
            const SizedBox(height: 22),
            const Padding(
              padding: EdgeInsets.only(left: 4, bottom: 10),
              child: Text('ใบลาของฉัน', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: _ink)),
            ),
            if (_loading)
              const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
            else if (_requests.isEmpty)
              _empty()
            else
              ..._requests.map((r) => _requestCard(Map<String, dynamic>.from(r))),
          ],
        ),
      ),
    );
  }

  Widget _formCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ยื่นใบลา', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _ink)),
          const SizedBox(height: 14),
          const Text('ประเภทการลา', style: TextStyle(fontSize: 13, color: _muted, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Row(
            children: _leaveTypes.map((t) {
              final sel = _type == t[0];
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: GestureDetector(
                    onTap: () => setState(() => _type = t[0]),
                    child: Container(
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: sel ? _tint : _fill,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: sel ? _primary : _line, width: sel ? 1.3 : 1),
                      ),
                      child: Text(t[1], style: TextStyle(fontSize: 12.5, color: sel ? _primary : _muted, fontWeight: sel ? FontWeight.w700 : FontWeight.w500)),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _dateField('วันที่เริ่ม', _start, () async {
                final d = await _pickDate(_start ?? DateTime.now());
                if (d != null) setState(() { _start = d; if (_end != null && _end!.isBefore(d)) _end = d; });
              })),
              const SizedBox(width: 12),
              Expanded(child: _dateField('วันที่สิ้นสุด', _end, () async {
                final d = await _pickDate(_end ?? _start ?? DateTime.now());
                if (d != null) setState(() => _end = d);
              })),
            ],
          ),
          if (_start != null && _end != null && !_end!.isBefore(_start!)) ...[
            const SizedBox(height: 8),
            Text('รวม ${_end!.difference(_start!).inDays + 1} วัน', style: const TextStyle(fontSize: 12.5, color: _primary, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 14),
          const Text('เหตุผล (ไม่บังคับ)', style: TextStyle(fontSize: 13, color: _muted, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          TextField(
            controller: _reasonCtl,
            maxLines: 3,
            style: const TextStyle(fontSize: 14, color: _ink),
            decoration: InputDecoration(
              hintText: 'ระบุเหตุผลการลา…',
              hintStyle: const TextStyle(color: _muted, fontSize: 13.5),
              filled: true,
              fillColor: _fill,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _line)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _primary, width: 1.3)),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: _primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
              ),
              child: _submitting
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : const Text('ส่งใบลา', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _dateField(String label, DateTime? value, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: _fill, borderRadius: BorderRadius.circular(12), border: Border.all(color: _line)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 11.5, color: _muted)),
            const SizedBox(height: 3),
            Row(
              children: [
                const Icon(Icons.calendar_today_outlined, size: 15, color: _primary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    value == null ? 'เลือกวันที่' : _thaiShort(value),
                    style: TextStyle(fontSize: 14, color: value == null ? _muted : _ink, fontWeight: value == null ? FontWeight.normal : FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _empty() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 34),
      alignment: Alignment.center,
      child: Column(
        children: const [
          Icon(Icons.event_busy_outlined, size: 42, color: _muted),
          SizedBox(height: 10),
          Text('ยังไม่มีใบลา', style: TextStyle(color: _muted, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _requestCard(Map<String, dynamic> r) {
    final status = r['status']?.toString() ?? 'pending';
    final start = _parseIso(r['start_date']?.toString());
    final end = _parseIso(r['end_date']?.toString());
    final days = (start != null && end != null) ? end.difference(start).inDays + 1 : null;
    final range = (start != null && end != null)
        ? (_iso(start) == _iso(end) ? _thaiShort(start) : '${_thaiShort(start)} – ${_thaiShort(end)}')
        : '-';

    Color sc;
    Color sbg;
    String sl;
    switch (status) {
      case 'approved':
        sc = _green;
        sbg = _greenTint;
        sl = 'อนุมัติแล้ว';
        break;
      case 'rejected':
        sc = _red;
        sbg = _redTint;
        sl = 'ไม่อนุมัติ';
        break;
      default:
        sc = _orange;
        sbg = _orangeTint;
        sl = 'รออนุมัติ';
    }

    final reason = r['reason']?.toString().trim() ?? '';
    final reviewer = r['reviewer_name']?.toString().trim() ?? '';
    final note = r['review_note']?.toString().trim() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: _line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: _tint, borderRadius: BorderRadius.circular(999)),
                child: Text(_leaveTypeLabel(r['leave_type']?.toString()), style: const TextStyle(fontSize: 12, color: _primary, fontWeight: FontWeight.w700)),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: sbg, borderRadius: BorderRadius.circular(999)),
                child: Text(sl, style: TextStyle(fontSize: 12, color: sc, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.date_range_outlined, size: 16, color: _muted),
              const SizedBox(width: 6),
              Expanded(child: Text(range, style: const TextStyle(fontSize: 14, color: _ink, fontWeight: FontWeight.w600))),
              if (days != null) Text('$days วัน', style: const TextStyle(fontSize: 12.5, color: _muted)),
            ],
          ),
          if (reason.isNotEmpty) ...[
            const SizedBox(height: 7),
            Text(reason, style: const TextStyle(fontSize: 13, color: _muted)),
          ],
          if (status != 'pending' && (reviewer.isNotEmpty || note.isNotEmpty)) ...[
            const SizedBox(height: 9),
            Container(height: 1, color: _line),
            const SizedBox(height: 9),
            Row(
              children: [
                Icon(status == 'approved' ? Icons.check_circle_outline : Icons.cancel_outlined, size: 15, color: sc),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    [if (reviewer.isNotEmpty) 'โดย $reviewer', if (note.isNotEmpty) '“$note”'].join(' · '),
                    style: const TextStyle(fontSize: 12.5, color: _muted),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
