import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

/// กล้องในแอป — กดชัตเตอร์แล้วได้รูปทันที (ไม่มีจอ "ตกลง"), ถ่ายรัวหลายรูปได้
/// คืนค่าเป็น List<XFile> ของรูปที่ถ่ายในรอบนี้ตอนกดปิด/เสร็จ
class CameraCaptureScreen extends StatefulWidget {
  final String captureCat; // หมวดที่รูปจะเข้า (โชว์ให้ผู้ใช้เห็น)
  const CameraCaptureScreen({super.key, required this.captureCat});

  @override
  State<CameraCaptureScreen> createState() => _CameraCaptureScreenState();
}

class _CameraCaptureScreenState extends State<CameraCaptureScreen> with WidgetsBindingObserver {
  CameraController? _controller;
  final List<XFile> _shots = [];
  bool _busy = false;
  bool _flashOn = false;
  String? _error;

  static const _primary = Color(0xFF2F6BD8);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _setup();
  }

  Future<void> _setup() async {
    try {
      final cams = await availableCameras();
      if (cams.isEmpty) { setState(() => _error = 'ไม่พบกล้องบนอุปกรณ์'); return; }
      final back = cams.firstWhere((c) => c.lensDirection == CameraLensDirection.back, orElse: () => cams.first);
      final ctrl = CameraController(back, ResolutionPreset.high, enableAudio: false);
      await ctrl.initialize();
      try { await ctrl.setFlashMode(FlashMode.off); } catch (_) {}
      if (!mounted) { await ctrl.dispose(); return; }
      setState(() { _controller = ctrl; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = 'เปิดกล้องไม่ได้');
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final ctrl = _controller;
    if (state == AppLifecycleState.inactive) {
      _controller = null;
      ctrl?.dispose();
    } else if (state == AppLifecycleState.resumed && ctrl == null) {
      _setup();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _shoot() async {
    final ctrl = _controller;
    if (ctrl == null || !ctrl.value.isInitialized || _busy) return;
    setState(() => _busy = true);
    try {
      final x = await ctrl.takePicture();
      _shots.add(x);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('ถ่ายไม่สำเร็จ: $e')));
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _toggleFlash() async {
    final ctrl = _controller;
    if (ctrl == null) return;
    _flashOn = !_flashOn;
    try { await ctrl.setFlashMode(_flashOn ? FlashMode.torch : FlashMode.off); } catch (_) {}
    if (mounted) setState(() {});
  }

  void _done() => Navigator.pop(context, _shots);

  @override
  Widget build(BuildContext context) {
    final ctrl = _controller;
    final ready = ctrl != null && ctrl.value.isInitialized;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) { if (!didPop) _done(); },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Column(children: [
            // ── แถบบน: ปิด + หมวด + แฟลช ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(children: [
                _roundBtn(Icons.close, _done),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.55), borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.photo_camera_outlined, size: 15, color: Colors.white70),
                    const SizedBox(width: 6),
                    Text(widget.captureCat, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                  ]),
                ),
                const Spacer(),
                _roundBtn(_flashOn ? Icons.flash_on : Icons.flash_off, _toggleFlash),
              ]),
            ),

            // ── พรีวิว ──
            Expanded(
              child: Container(
                width: double.infinity,
                color: Colors.black,
                child: _error != null
                    ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 15))))
                    : ready
                        ? ClipRect(
                            child: FittedBox(
                              fit: BoxFit.cover,
                              child: SizedBox(
                                width: ctrl.value.previewSize!.height,
                                height: ctrl.value.previewSize!.width,
                                child: CameraPreview(ctrl),
                              ),
                            ),
                          )
                        : const Center(child: CircularProgressIndicator(color: Colors.white)),
              ),
            ),

            // ── แถบล่าง: รูปล่าสุด + ชัตเตอร์ + เสร็จ ──
            Container(
              color: Colors.black,
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
              child: Row(children: [
                SizedBox(
                  width: 64,
                  child: _shots.isEmpty
                      ? const SizedBox()
                      : Stack(clipBehavior: Clip.none, children: [
                          ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(File(_shots.last.path), width: 48, height: 48, fit: BoxFit.cover)),
                          Positioned(
                            right: 0, top: -6,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(color: _primary, borderRadius: BorderRadius.circular(999)),
                              child: Text('${_shots.length}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                            ),
                          ),
                        ]),
                ),
                Expanded(
                  child: Center(
                    child: GestureDetector(
                      onTap: ready ? _shoot : null,
                      child: Container(
                        width: 74, height: 74,
                        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 4)),
                        child: Padding(
                          padding: const EdgeInsets.all(5),
                          child: Container(decoration: BoxDecoration(shape: BoxShape.circle, color: _busy ? Colors.white54 : Colors.white)),
                        ),
                      ),
                    ),
                  ),
                ),
                SizedBox(
                  width: 64,
                  child: TextButton(
                    onPressed: _done,
                    child: Text(_shots.isEmpty ? 'ปิด' : 'เสร็จ', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                  ),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _roundBtn(IconData icon, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40, height: 40,
          decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
          child: Icon(icon, color: Colors.white, size: 22),
        ),
      );
}
