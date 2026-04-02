import 'package:flutter/material.dart';
import '../services/notification_service.dart';
import '../services/api_service.dart';

class IncomingSurveyPage extends StatefulWidget {
  final int caseId;
  final String title;
  final String address;
  final int notificationId;
  final VoidCallback? onAccepted;
  final VoidCallback? onDeclined;

  const IncomingSurveyPage({
    super.key,
    required this.caseId,
    required this.title,
    required this.address,
    required this.notificationId,
    this.onAccepted,
    this.onDeclined,
  });

  @override
  State<IncomingSurveyPage> createState() => _IncomingSurveyPageState();
}

class _IncomingSurveyPageState extends State<IncomingSurveyPage> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    // หยุดเสียงเมื่อปิดหน้า
    NotificationService().cancelNotification(widget.notificationId);
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _accept() async {
    await NotificationService().cancelNotification(widget.notificationId);
    await NotificationService().stopAlarm();
    widget.onAccepted?.call();
    if (mounted) Navigator.of(context).pop(true);
  }

  Future<void> _decline() async {
    await NotificationService().cancelNotification(widget.notificationId);
    await NotificationService().stopAlarm();
    // ถอนงานออกจาก surveyor ใน backend
    try {
      await ApiService().declineCase(widget.caseId);
    } catch (e) {
      debugPrint('Decline case error: $e');
    }
    widget.onDeclined?.call();
    if (mounted) Navigator.of(context).pop(false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1B2A),
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(flex: 2),
            // Icon + ripple
            AnimatedBuilder(
              animation: _pulseAnimation,
              builder: (context, child) {
                return Transform.scale(
                  scale: _pulseAnimation.value,
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.orange.withOpacity(0.15),
                      border: Border.all(color: Colors.orange, width: 3),
                    ),
                    child: const Icon(Icons.assignment_turned_in, size: 60, color: Colors.orange),
                  ),
                );
              },
            ),
            const SizedBox(height: 32),
            // Title
            const Text(
              'งานสำรวจใหม่',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 24),
            // Info card
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 32),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white24),
              ),
              child: Column(
                children: [
                  _infoRow(Icons.person, 'ลูกค้า', widget.title),
                  const SizedBox(height: 12),
                  _infoRow(Icons.location_on, 'สถานที่', widget.address),
                ],
              ),
            ),
            const Spacer(flex: 3),
            // Buttons
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Row(
                children: [
                  // ปฏิเสธ
                  Expanded(
                    child: GestureDetector(
                      onTap: _decline,
                      child: Container(
                        height: 64,
                        decoration: BoxDecoration(
                          color: Colors.red.shade700,
                          borderRadius: BorderRadius.circular(32),
                          boxShadow: [BoxShadow(color: Colors.red.withOpacity(0.4), blurRadius: 16, offset: const Offset(0, 4))],
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.close, color: Colors.white, size: 28),
                            SizedBox(width: 8),
                            Text('ปฏิเสธ', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 20),
                  // รับงาน
                  Expanded(
                    child: ScaleTransition(
                      scale: _pulseAnimation,
                      child: GestureDetector(
                        onTap: _accept,
                        child: Container(
                          height: 64,
                          decoration: BoxDecoration(
                            color: Colors.green.shade600,
                            borderRadius: BorderRadius.circular(32),
                            boxShadow: [BoxShadow(color: Colors.green.withOpacity(0.4), blurRadius: 16, offset: const Offset(0, 4))],
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check, color: Colors.white, size: 28),
                              SizedBox(width: 8),
                              Text('รับงาน', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 48),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: Colors.orange, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(color: Colors.white, fontSize: 16)),
            ],
          ),
        ),
      ],
    );
  }
}
