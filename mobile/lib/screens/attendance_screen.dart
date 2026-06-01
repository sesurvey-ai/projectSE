import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../config/api_config.dart';
import '../services/api_service.dart';
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

  Map<String, dynamic>? _today;
  List<dynamic> _history = [];
  bool _loading = true;
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
      if (mounted) setState(() { _today = today; _history = hist; });
    } catch (_) {
      // เงียบ
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? get _checkIn => _today?['check_in_time']?.toString();
  String? get _checkOut => _today?['check_out_time']?.toString();
  String? get _checkInPhoto => _today?['check_in_photo']?.toString();

  String? _photoUrl(String? f) => (f == null || f.isEmpty) ? null : '${ApiConfig.baseUrl}/uploads/$f';

  void _viewPhoto(String url) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          children: [
            InteractiveViewer(child: Center(child: Image.network(url, fit: BoxFit.contain))),
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
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => Container(width: size, height: size, color: _fill, child: const Icon(Icons.image_not_supported_outlined, size: 18, color: _muted)),
          loadingBuilder: (c, child, p) => p == null ? child : Container(width: size, height: size, color: _fill, child: const Center(child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)))),
        ),
      ),
    );
  }

  Future<void> _punch(bool isCheckIn) async {
    String? photoPath;
    if (isCheckIn) {
      // ถ่ายรูปก่อนลงเวลาเข้างาน (เป็นหลักฐาน) — ยกเลิกกล้อง = ยกเลิกการลงเวลา
      try {
        final shot = await _picker.pickImage(
          source: ImageSource.camera,
          preferredCameraDevice: CameraDevice.front,
          imageQuality: 70,
          maxWidth: 1280,
        );
        if (shot == null) return; // ผู้ใช้ยกเลิก
        photoPath = shot.path;
      } catch (_) {
        if (mounted) _snack('เปิดกล้องไม่สำเร็จ', _red);
        return;
      }
    }

    setState(() { _busy = true; _gpsNote = 'กำลังระบุตำแหน่ง…'; });
    double? lat;
    double? lng;
    try {
      // จำกัดเวลาหาพิกัด — ถ้าหาไม่ได้ใน 8 วิ ให้ลงเวลาต่อโดยไม่มี GPS (ไม่ค้างหน้าจอ)
      final pos = await _location.getCurrentPosition().timeout(
        const Duration(seconds: 8),
        onTimeout: () => null,
      );
      if (pos != null) {
        lat = pos.latitude;
        lng = pos.longitude;
      }
    } catch (_) {}
    if (mounted) setState(() => _gpsNote = (lat == null) ? 'บันทึกโดยไม่มีพิกัด GPS' : '');

    try {
      final rec = isCheckIn
          ? await _api.checkInAttendance(lat: lat, lng: lng, photoPath: photoPath)
          : await _api.checkOutAttendance(lat: lat, lng: lng);
      if (!mounted) return;
      setState(() => _today = rec);
      _snack(isCheckIn ? 'ลงเวลาเข้างานแล้ว ${rec['check_in_time'] ?? ''}' : 'ลงเวลาออกงานแล้ว ${rec['check_out_time'] ?? ''}', _green);
      await _load();
    } on DioException catch (e) {
      final msg = e.response?.data is Map ? (e.response?.data['message']?.toString() ?? 'บันทึกเวลาไม่สำเร็จ') : 'บันทึกเวลาไม่สำเร็จ';
      if (mounted) _snack(msg, _red);
    } catch (_) {
      if (mounted) _snack('บันทึกเวลาไม่สำเร็จ', _red);
    } finally {
      if (mounted) setState(() { _busy = false; _gpsNote = ''; });
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
                  _todayCard(),
                  const SizedBox(height: 16),
                  _actionButton(),
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
          Text('วัน$dow', style: const TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 2),
          Text(_thaiShort(now), style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: _timeBox('เข้างาน', _checkIn, Icons.login)),
              Container(width: 1, height: 44, color: Colors.white24),
              Expanded(child: _timeBox('ออกงาน', _checkOut, Icons.logout)),
            ],
          ),
          if (_checkInPhoto != null) ...[
            const SizedBox(height: 16),
            Container(height: 1, color: Colors.white24),
            const SizedBox(height: 14),
            Row(children: [
              Container(
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(11), border: Border.all(color: Colors.white54, width: 1.5)),
                child: _thumb(_checkInPhoto, size: 46),
              ),
              const SizedBox(width: 10),
              const Expanded(child: Text('รูปถ่ายตอนลงเวลาเข้างาน · แตะเพื่อดูเต็ม', style: TextStyle(color: Colors.white70, fontSize: 12))),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _timeBox(String label, String? time, IconData icon) {
    return Column(
      children: [
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 14, color: Colors.white70),
          const SizedBox(width: 5),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 13)),
        ]),
        const SizedBox(height: 6),
        Text(time ?? '--:--', style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
      ],
    );
  }

  Widget _actionButton() {
    // สถานะ: ยังไม่เข้า -> เข้างาน; เข้าแล้วยังไม่ออก -> ออกงาน; ครบแล้ว -> ปิด
    final hasIn = _checkIn != null;
    final hasOut = _checkOut != null;

    if (hasIn && hasOut) {
      return Container(
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: _green.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(15), border: Border.all(color: _green.withValues(alpha: 0.4))),
        child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.check_circle, color: _green, size: 22),
          SizedBox(width: 8),
          Text('ลงเวลาครบแล้ววันนี้', style: TextStyle(color: _green, fontSize: 16, fontWeight: FontWeight.w700)),
        ]),
      );
    }

    final isCheckIn = !hasIn;
    final color = isCheckIn ? _primary : _orange;
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: _busy ? null : () => _punch(isCheckIn),
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
