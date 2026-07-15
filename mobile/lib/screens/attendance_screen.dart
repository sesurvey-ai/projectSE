import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../config/api_config.dart';
import '../services/api_service.dart';
import '../services/auth_token.dart';
import '../services/location_service.dart';

// ── tokens (match app design) ──
const _primary = Color(0xFF2F6BD8);
const _primaryDark = Color(0xFF2557B4);
const _bg = Color(0xFFEEF0F4);
const _ink = Color(0xFF1E2330);
const _muted = Color(0xFF737D90);
const _line = Color(0xFFE8EBF1);
const _fill = Color(0xFFF4F6F9);
const _green = Color(0xFF1F9D6B);
const _orange = Color(0xFFE08A1E);
const _red = Color(0xFFDC2626);

const _thaiMonthsShort = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const _thaiDows = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

DateTime? _parseIso(String? s) {
  if (s == null || s.length < 10) return null;
  final p = s.substring(0, 10).split('-');
  if (p.length != 3) return null;
  final y = int.tryParse(p[0]), m = int.tryParse(p[1]), d = int.tryParse(p[2]);
  if (y == null || m == null || d == null) return null;
  return DateTime(y, m, d);
}

String _thaiShort(DateTime d) => '${d.day} ${_thaiMonthsShort[d.month]} ${d.year + 543}';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final _api = ApiService();
  final _location = LocationService();
  final _picker = ImagePicker();

  Map<String, dynamic>? _today; // { sessions: [...], open: {...}|null }
  List<dynamic> _history = [];
  bool _loading = true;
  // โหลดสถานะวันนี้ไม่สำเร็จ — สถานะเข้า/ออกที่โชว์เชื่อไม่ได้ ต้องบล็อกปุ่มลงเวลา + ให้ลองใหม่
  // (เดิมพลาดเงียบ: จอโชว์ "ยังไม่เข้างาน" ทั้งที่แค่เน็ตล่ม — คนเข้างานแล้วกดเข้าซ้ำ/สับสน)
  bool _loadFailed = false;
  bool _busy = false;
  String _gpsNote = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final today = await _api.getTodayAttendance();
      final hist = await _api.getMyAttendance();
      if (mounted) setState(() { _today = today; _history = hist; _loadFailed = false; });
    } catch (_) {
      if (mounted) setState(() => _loadFailed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // รอบของ "วันนี้" (เรียงตามเวลาเข้า) + รอบที่ยังเปิดค้าง (ถ้ามี)
  List<Map<String, dynamic>> get _sessions =>
      ((_today?['sessions'] as List?) ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  Map<String, dynamic>? get _open {
    final o = _today?['open'];
    return o == null ? null : Map<String, dynamic>.from(o as Map);
  }

  String? _photoUrl(String? f) => (f == null || f.isEmpty) ? null : '${ApiConfig.baseUrl}/uploads/$f';

  void _viewPhoto(String url) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          children: [
            InteractiveViewer(
              child: Center(
                child: Image.network(
                  url,
                  headers: AuthToken.imageHeaders,
                  fit: BoxFit.contain,
                  loadingBuilder: (context, child, progress) =>
                      progress == null ? child : const Center(child: CircularProgressIndicator(color: Colors.white)),
                  errorBuilder: (context, error, stackTrace) => const Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.image_not_supported_outlined, color: Colors.white54, size: 48),
                      SizedBox(height: 12),
                      Text('ไม่พบรูปภาพ', style: TextStyle(color: Colors.white70, fontSize: 14)),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              top: 4,
              right: 4,
              child: IconButton(icon: const Icon(Icons.close, color: Colors.white), onPressed: () => Navigator.pop(ctx)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _thumb(String? filename, {double size = 44}) {
    final url = _photoUrl(filename);
    if (url == null) return const SizedBox.shrink();
    return GestureDetector(
      onTap: () => _viewPhoto(url),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(11),
        child: Image.network(
          url,
          headers: AuthToken.imageHeaders,
          width: size,
          height: size,
          fit: BoxFit.cover,
          // decode แค่ขนาด thumbnail (x3 สำหรับจอ hi-dpi) — เดิม decode เต็ม resolution ที่อัปโหลด
          cacheWidth: (size * 3).round(),
          errorBuilder: (_, _, _) => Container(width: size, height: size, color: _fill, child: const Icon(Icons.image_not_supported_outlined, size: 18, color: _muted)),
          loadingBuilder: (c, child, p) => p == null ? child : Container(width: size, height: size, color: _fill, child: const Center(child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)))),
        ),
      ),
    );
  }

  Future<void> _punch(bool isCheckIn) async {
    setState(() { _busy = true; _gpsNote = 'กำลังระบุตำแหน่ง…'; });

    // หาพิกัด GPS ก่อน (high-accuracy → fallback last-known ถ้าสัญญาณอ่อนที่หน้างาน)
    double? lat;
    double? lng;
    LocFail? locFail;
    try {
      final loc = await _location.getPositionForCheckIn();
      if (loc.position != null) {
        lat = loc.position!.latitude;
        lng = loc.position!.longitude;
      } else {
        locFail = loc.fail;
      }
    } catch (_) { locFail = LocFail.noFix; }

    // ลงเวลา "เข้างาน" ต้องมี GPS — แยกข้อความตามสาเหตุจริง (อย่าบอกให้เปิด GPS ถ้าแค่สัญญาณอ่อน)
    if (isCheckIn && (lat == null || lng == null)) {
      if (mounted) {
        setState(() { _busy = false; _gpsNote = ''; });
        _snack(
          locFail == LocFail.permission
              ? 'กรุณาเปิด GPS และอนุญาตการเข้าถึงตำแหน่ง แล้วลงเวลาอีกครั้ง'
              : 'หาตำแหน่งไม่ได้ในขณะนี้ — ลองอีกครั้งกลางแจ้งหรือที่สัญญาณดีขึ้น',
          _red);
      }
      return;
    }
    if (mounted) setState(() => _gpsNote = '');

    // ถ่ายรูปก่อนลงเวลาเข้างาน (เป็นหลักฐาน) — ทำหลังได้ GPS แล้ว; ยกเลิกกล้อง = ยกเลิกการลงเวลา
    String? photoPath;
    if (isCheckIn) {
      try {
        final shot = await _picker.pickImage(
          source: ImageSource.camera,
          preferredCameraDevice: CameraDevice.front,
          imageQuality: 70,
          maxWidth: 1280,
        );
        if (shot == null) {
          if (mounted) setState(() => _busy = false);
          return; // ผู้ใช้ยกเลิก
        }
        photoPath = shot.path;
      } catch (_) {
        if (mounted) {
          setState(() => _busy = false);
          _snack('เปิดกล้องไม่สำเร็จ', _red);
        }
        return;
      }
    }

    try {
      final rec = isCheckIn
          ? await _api.checkInAttendance(lat: lat, lng: lng, photoPath: photoPath)
          : await _api.checkOutAttendance(lat: lat, lng: lng);
      if (!mounted) return;
      _snack(isCheckIn ? 'ลงเวลาเข้างานแล้ว ${rec['check_in_time'] ?? ''}' : 'ลงเวลาออกงานแล้ว ${rec['check_out_time'] ?? ''}', _green);
      await _load();
    } on DioException catch (e) {
      if (e.response != null) {
        // server ตอบ error จริง (เช่น 400 รอบค้าง) → โชว์ข้อความจาก server
        final msg = e.response?.data is Map ? (e.response?.data['message']?.toString() ?? 'บันทึกเวลาไม่สำเร็จ') : 'บันทึกเวลาไม่สำเร็จ';
        if (mounted) _snack(msg, _red);
      } else {
        // ไม่มี response = เน็ตหลุด/timeout → อาจ commit ที่ server แล้ว → เช็คสถานะจริงก่อนแจ้ง
        await _reconcileAfterNetworkError(isCheckIn);
      }
    } catch (_) {
      await _reconcileAfterNetworkError(isCheckIn);
    } finally {
      if (mounted) setState(() { _busy = false; _gpsNote = ''; });
    }
  }

  // เน็ตหลุดหลังกดลงเวลา — การลงเวลาอาจสำเร็จที่ server แล้ว → reload ดูสถานะจริงก่อนแจ้งผู้ใช้
  // (กันแจ้ง "ไม่สำเร็จ" แล้วผู้ใช้กดซ้ำไปชนกติกา "รอบค้าง" 400)
  Future<void> _reconcileAfterNetworkError(bool isCheckIn) async {
    await _load();
    if (!mounted) return;
    final hasOpen = _today?['open'] != null;
    if (isCheckIn && hasOpen) {
      _snack('ลงเวลาเข้างานแล้ว (เครือข่ายช้า)', _green);
    } else if (!isCheckIn && !hasOpen) {
      _snack('ลงเวลาออกงานแล้ว (เครือข่ายช้า)', _green);
    } else {
      _snack('เครือข่ายมีปัญหา — ตรวจสอบสถานะให้แล้ว ลองใหม่หากยังไม่อัปเดต', _red);
    }
  }

  void _snack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color, behavior: SnackBarBehavior.floating));
  }

  // ── ยืนยันลงเวลาเข้างาน: เวรอ้างอิงจากตารางเวร, อาสาระบบตรวจจากตารางเวลาให้เอง ──
  void _showCheckInOptions() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        // เผื่อทั้งคีย์บอร์ด (viewInsets) และแถบนำทางระบบ (viewPadding) — กันปุ่มถูกแถบ ||| ○ < ทับ
        padding: EdgeInsets.fromLTRB(20, 14, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom + MediaQuery.of(ctx).viewPadding.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: _line, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            const Text('ลงเวลาเข้างาน', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _ink)),
            const SizedBox(height: 2),
            const Text('เวรอ้างอิงจากตารางเวรอัตโนมัติ — ถ่ายรูปแล้วลงเวลาได้เลย', style: TextStyle(fontSize: 13, color: _muted)),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () { Navigator.pop(ctx); _punch(true); },
                style: ElevatedButton.styleFrom(
                  backgroundColor: _primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('ถ่ายรูปแล้วลงเวลา', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
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
        title: const Text('ลงเวลาเข้า–ออกงาน', style: TextStyle(fontWeight: FontWeight.w600)),
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: _line)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                children: [
                  if (_loadFailed) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: Row(children: [
                        Icon(Icons.wifi_off, size: 18, color: Colors.red.shade400),
                        const SizedBox(width: 8),
                        const Expanded(child: Text('โหลดสถานะลงเวลาไม่สำเร็จ — สถานะที่แสดงอาจไม่ตรงจริง', style: TextStyle(fontSize: 12.5, color: _ink))),
                        TextButton(onPressed: _load, child: const Text('ลองใหม่')),
                      ]),
                    ),
                    const SizedBox(height: 12),
                  ],
                  _todayCard(),
                  const SizedBox(height: 16),
                  _actionButton(),
                  if (_open != null) ...[
                    const SizedBox(height: 9),
                    const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.info_outline, size: 13, color: _muted),
                      SizedBox(width: 5),
                      Text('ลงเวลาออกก่อน จึงจะลงเวลาเข้ารอบใหม่ได้', style: TextStyle(fontSize: 12, color: _muted)),
                    ]),
                  ],
                  if (_gpsNote.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      const Icon(Icons.location_on_outlined, size: 14, color: _muted),
                      const SizedBox(width: 4),
                      Text(_gpsNote, style: const TextStyle(fontSize: 12, color: _muted)),
                    ]),
                  ],
                  const SizedBox(height: 24),
                  const Padding(
                    padding: EdgeInsets.only(left: 4, bottom: 10),
                    child: Text('ประวัติการลงเวลา', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: _ink)),
                  ),
                  if (_history.isEmpty)
                    _empty()
                  else
                    ..._history.map((r) => _historyRow(Map<String, dynamic>.from(r))),
                ],
              ),
            ),
    );
  }

  Widget _todayCard() {
    final now = DateTime.now();
    final dow = _thaiDows[now.weekday];
    final sessions = _sessions;
    final open = _open;
    // รอบเปิดค้างจาก "วันก่อน" (ลืมลงเวลาออก) — ไม่อยู่ในรายการของวันนี้
    final carryOver = open != null && !sessions.any((s) => s['id'] == open['id']);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [_primary, _primaryDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: _primary.withValues(alpha: 0.3), blurRadius: 18, offset: const Offset(0, 8))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('วัน$dow', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 2),
                    Text(_thaiShort(now), style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              if (sessions.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(20)),
                  child: Text('${sessions.length} รอบ', style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w700)),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Container(height: 1, color: Colors.white24),
          const SizedBox(height: 14),
          if (carryOver) _carryOverNote(open),
          if (sessions.isEmpty && !carryOver)
            Row(children: const [
              Icon(Icons.schedule, size: 18, color: Colors.white70),
              SizedBox(width: 8),
              Text('ยังไม่ได้ลงเวลาวันนี้', style: TextStyle(color: Colors.white70, fontSize: 14)),
            ])
          else
            ...sessions.asMap().entries.map((e) => _sessionRow(e.key, e.value)),
        ],
      ),
    );
  }

  // หนึ่งรอบ: หมายเลขรอบ · เข้า → ออก/กำลังทำงาน · รูปถ่าย
  Widget _sessionRow(int idx, Map<String, dynamic> s) {
    final cin = s['check_in_time']?.toString();
    final cout = s['check_out_time']?.toString();
    final photo = s['check_in_photo']?.toString();
    final isOpen = cout == null || cout.isEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), shape: BoxShape.circle),
            child: Text('${idx + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Row(
              children: [
                const Icon(Icons.login, size: 15, color: Colors.white70),
                const SizedBox(width: 5),
                Text(cin ?? '--:--', style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: 0.3)),
                const Padding(padding: EdgeInsets.symmetric(horizontal: 9), child: Icon(Icons.arrow_right_alt, size: 18, color: Colors.white54)),
                if (isOpen)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.22), borderRadius: BorderRadius.circular(20)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: const [
                      _Dot(),
                      SizedBox(width: 5),
                      Text('กำลังทำงาน', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                    ]),
                  )
                else ...[
                  const Icon(Icons.logout, size: 15, color: Colors.white70),
                  const SizedBox(width: 5),
                  Text(cout, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: 0.3)),
                ],
              ],
            ),
          ),
          if (photo != null && photo.isNotEmpty) ...[
            const SizedBox(width: 8),
            Container(
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(11), border: Border.all(color: Colors.white54, width: 1.5)),
              child: _thumb(photo, size: 40),
            ),
          ],
        ],
      ),
    );
  }

  Widget _carryOverNote(Map<String, dynamic> open) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, size: 18, color: Colors.white),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'มีรอบค้างจากวันก่อน · เข้างาน ${open['check_in_time'] ?? '--:--'} — กรุณาลงเวลาออก',
              style: const TextStyle(color: Colors.white, fontSize: 12.5, height: 1.3),
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionButton() {
    // มีรอบเปิดค้าง → ปุ่ม "ลงเวลาออกงาน"; ไม่มี → ปุ่ม "ลงเวลาเข้างาน" (เข้าใหม่ได้เรื่อย ๆ)
    final isCheckIn = _open == null;
    final color = isCheckIn ? _primary : _orange;
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        // โหลดสถานะพลาด → ปุ่มอิงสถานะที่เชื่อไม่ได้ (เช่นโชว์ "เข้างาน" ทั้งที่มีรอบเปิดค้าง) — บล็อกจนกดลองใหม่
        onPressed: (_busy || _loadFailed) ? null : () => isCheckIn ? _showCheckInOptions() : _punch(false),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          elevation: 0,
          disabledBackgroundColor: color.withValues(alpha: 0.6),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        ),
        child: _busy
            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.6, color: Colors.white))
            : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(isCheckIn ? Icons.login : Icons.logout, size: 22),
                const SizedBox(width: 8),
                Text(isCheckIn ? 'ลงเวลาเข้างาน' : 'ลงเวลาออกงาน', style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800)),
              ]),
      ),
    );
  }

  Widget _empty() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 34),
      alignment: Alignment.center,
      child: Column(
        children: const [
          Icon(Icons.history, size: 42, color: _muted),
          SizedBox(height: 10),
          Text('ยังไม่มีประวัติการลงเวลา', style: TextStyle(color: _muted, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _historyRow(Map<String, dynamic> r) {
    final d = _parseIso(r['work_date']?.toString());
    final cin = r['check_in_time']?.toString();
    final cout = r['check_out_time']?.toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)),
      child: Row(
        children: [
          _photoUrl(r['check_in_photo']?.toString()) != null
              ? _thumb(r['check_in_photo']?.toString(), size: 42)
              : Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(color: _fill, borderRadius: BorderRadius.circular(11)),
                  child: const Icon(Icons.event_available_outlined, color: _primary, size: 22),
                ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(d == null ? (r['work_date']?.toString() ?? '-') : _thaiShort(d), style: const TextStyle(fontSize: 14.5, color: _ink, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Row(children: [
                  _miniTime(Icons.login, 'เข้า', cin, _green),
                  const SizedBox(width: 14),
                  _miniTime(Icons.logout, 'ออก', cout, _orange),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniTime(IconData icon, String label, String? time, Color color) {
    return Row(children: [
      Icon(icon, size: 14, color: time == null ? _muted : color),
      const SizedBox(width: 4),
      Text('$label ${time ?? '--:--'}', style: TextStyle(fontSize: 12.5, color: time == null ? _muted : _ink, fontWeight: FontWeight.w500)),
    ]);
  }
}

// จุดวงกลมขาวเล็ก ๆ ใน pill "กำลังทำงาน"
class _Dot extends StatelessWidget {
  const _Dot();
  @override
  Widget build(BuildContext context) =>
      Container(width: 6, height: 6, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle));
}
