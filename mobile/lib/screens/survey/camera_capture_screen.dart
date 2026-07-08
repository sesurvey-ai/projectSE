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
  List<CameraDescription> _cams = [];
  CameraLensDirection _lens = CameraLensDirection.back;
  ResolutionPreset _preset = ResolutionPreset.high;
  final List<XFile> _shots = [];
  bool _busy = false;
  bool _flashOn = false;
  String? _error;

  static const _primary = Color(0xFF2F6BD8);
  static const _presets = [ResolutionPreset.medium, ResolutionPreset.high, ResolutionPreset.veryHigh, ResolutionPreset.max];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _setup();
  }

  Future<void> _setup() async {
    try {
      if (_cams.isEmpty) _cams = await availableCameras();
      if (_cams.isEmpty) { setState(() => _error = 'ไม่พบกล้องบนอุปกรณ์'); return; }
      final cam = _cams.firstWhere((c) => c.lensDirection == _lens, orElse: () => _cams.first);
      final ctrl = CameraController(cam, _preset, enableAudio: false);
      await ctrl.initialize();
      try { await ctrl.setFlashMode(_flashOn ? FlashMode.torch : FlashMode.off); } catch (_) {}
      if (!mounted) { await ctrl.dispose(); return; }
      setState(() { _controller = ctrl; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = 'เปิดกล้องไม่ได้');
    }
  }

  // ตั้งค่ากล้องใหม่ (สลับหน้า/หลัง หรือเปลี่ยนความละเอียด) → dispose ตัวเดิมแล้วเปิดใหม่
  Future<void> _applyCamera() async {
    final old = _controller;
    setState(() => _controller = null);
    await old?.dispose();
    await _setup();
  }

  bool get _hasFrontAndBack =>
      _cams.any((c) => c.lensDirection == CameraLensDirection.front) &&
      _cams.any((c) => c.lensDirection == CameraLensDirection.back);

  Future<void> _switchCamera() async {
    if (!_hasFrontAndBack || _controller == null) return;
    _lens = _lens == CameraLensDirection.back ? CameraLensDirection.front : CameraLensDirection.back;
    await _applyCamera();
  }

  Future<void> _pickResolution() async {
    final chosen = await showModalBottomSheet<ResolutionPreset>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Padding(padding: EdgeInsets.all(14), child: Text('ความละเอียดรูป', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700))),
          for (final p in _presets)
            ListTile(
              dense: true,
              title: Text(_resLabel(p)),
              trailing: p == _preset ? const Icon(Icons.check, color: _primary, size: 20) : null,
              onTap: () => Navigator.pop(ctx, p),
            ),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (chosen != null && chosen != _preset && mounted) {
      _preset = chosen;
      await _applyCamera();
    }
  }

  String _resLabel(ResolutionPreset p) {
    switch (p) {
      case ResolutionPreset.low: return 'ต่ำ';
      case ResolutionPreset.medium: return 'ปานกลาง';
      case ResolutionPreset.high: return 'สูง';
      case ResolutionPreset.veryHigh: return 'สูงมาก';
      case ResolutionPreset.max: return 'สูงสุด';
      default: return 'สูง';
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
            // ── แถบบน: ปิด · ความละเอียด · หมวด · สลับกล้อง · แฟลช ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(children: [
                _roundBtn(Icons.close, _done),
                const SizedBox(width: 8),
                _pill(
                  onTap: _pickResolution,
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.high_quality_outlined, size: 15, color: Colors.white70),
                    const SizedBox(width: 5),
                    Text(_resLabel(_preset), style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600)),
                  ]),
                ),
                const Spacer(),
                _pill(child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.photo_camera_outlined, size: 14, color: Colors.white70),
                  const SizedBox(width: 5),
                  Text(widget.captureCat, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600)),
                ])),
                const Spacer(),
                if (_hasFrontAndBack) ...[_roundBtn(Icons.cameraswitch_outlined, _switchCamera), const SizedBox(width: 8)],
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

  Widget _pill({required Widget child, VoidCallback? onTap}) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
          decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.55), borderRadius: BorderRadius.circular(999)),
          child: child,
        ),
      );
}
