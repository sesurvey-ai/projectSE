import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

// ── tokens (match survey-form / app design) ──
const _primary = Color(0xFF2F6BD8);
const _primaryDark = Color(0xFF2557B4);
const _bg = Color(0xFFEEF0F4);
const _ink = Color(0xFF1E2330);
const _muted = Color(0xFF737D90);
const _line = Color(0xFFE8EBF1);
const _tint = Color(0xFFEAF1FD);

// สีเฉพาะของแต่ละเมนู (ไอคอน + พื้นไอคอนอ่อน ๆ)
const _green = Color(0xFF1F9D6B);
const _greenTint = Color(0xFFE4F5EE);
const _amber = Color(0xFFE0901E);
const _amberTint = Color(0xFFFBF1DD);
const _purple = Color(0xFF7C4DD4);
const _purpleTint = Color(0xFFF0EAFB);

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  String _roleLabel(String role) {
    switch (role) {
      case 'surveyor':
        return 'เจ้าหน้าที่สำรวจ';
      case 'callcenter':
        return 'เจ้าหน้าที่รับแจ้ง';
      case 'checker':
        return 'เจ้าหน้าที่ตรวจงาน';
      case 'admin':
        return 'ผู้ดูแลระบบ';
      default:
        return role;
    }
  }

  Future<void> _logout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ออกจากระบบ'),
        content: const Text('คุณต้องการออกจากระบบหรือไม่?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('ยกเลิก')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('ออกจากระบบ')),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await context.read<AuthProvider>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final name = user == null ? '' : '${user.firstName} ${user.lastName}'.trim();

    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        foregroundColor: _ink,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: const Text('หน้าหลัก', style: TextStyle(fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: _muted),
            tooltip: 'ออกจากระบบ',
            onPressed: () => _logout(context),
          ),
        ],
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: _line)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // greeting / user card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_primary, _primaryDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: _primary.withValues(alpha: 0.3), blurRadius: 18, offset: const Offset(0, 8))],
              ),
              child: Row(children: [
                CircleAvatar(
                  radius: 27,
                  backgroundColor: Colors.white.withValues(alpha: 0.22),
                  child: const Icon(Icons.person, color: Colors.white, size: 30),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('ยินดีต้อนรับ', style: TextStyle(color: Colors.white70, fontSize: 13)),
                      const SizedBox(height: 2),
                      Text(
                        name.isEmpty ? 'ผู้ใช้งาน' : name,
                        style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700),
                      ),
                      if (user != null) ...[
                        const SizedBox(height: 7),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(999)),
                          child: Text(_roleLabel(user.role), style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500)),
                        ),
                      ],
                    ],
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 24),
            const Padding(
              padding: EdgeInsets.only(left: 4, bottom: 12),
              child: Text('เมนู', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: _ink)),
            ),
            _menuCard(
              icon: Icons.assignment_outlined,
              title: 'งานของฉัน',
              subtitle: 'ดูงานสำรวจที่ได้รับมอบหมาย',
              onTap: () => context.go('/cases'),
            ),
            const SizedBox(height: 12),
            _menuCard(
              icon: Icons.access_time_rounded,
              title: 'บันทึกเวลา เข้า / ออก',
              subtitle: 'ลงเวลาเข้า–ออกงานพร้อมพิกัด',
              color: _green,
              tint: _greenTint,
              onTap: () => context.push('/attendance'),
            ),
            const SizedBox(height: 12),
            _menuCard(
              icon: Icons.event_busy_outlined,
              title: 'ลางาน',
              subtitle: 'ยื่นใบลาและดูสถานะอนุมัติ',
              color: _amber,
              tint: _amberTint,
              onTap: () => context.push('/leave'),
            ),
            const SizedBox(height: 12),
            _menuCard(
              icon: Icons.phone_in_talk_outlined,
              title: 'Call Log',
              subtitle: 'ประวัติการโทรบนเครื่อง',
              color: _purple,
              tint: _purpleTint,
              onTap: () => context.push('/calllog'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _menuCard({required IconData icon, required String title, required String subtitle, required VoidCallback onTap, Color color = _primary, Color tint = _tint}) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(14)),
              child: Icon(icon, color: color, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: _ink)),
                  const SizedBox(height: 3),
                  Text(subtitle, style: const TextStyle(fontSize: 12.5, color: _muted)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: _muted),
          ]),
        ),
      ),
    );
  }
}
