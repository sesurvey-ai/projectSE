import 'package:flutter/material.dart';

/// กระดานเซ็นชื่อ — เขียนเองด้วย CustomPaint ไม่ต้องพึ่ง package ภายนอก
///
/// ใช้บนใบแจ้งความเสียหาย (คู่กรณี/ผู้เอาประกันเซ็นรับรองรายการความเสียหาย)
/// เส้นเป็นสีดำล้วนหนา 2 px เพราะปลายทางคือเครื่องพิมพ์ความร้อนขาว-ดำ
/// เส้นบางกว่านี้จะขาดเป็นจุด ๆ ตอนพิมพ์
class SignaturePad extends StatefulWidget {
  const SignaturePad({
    super.key,
    required this.controller,
    this.height = 96,
    this.hint = 'เซ็นชื่อในกรอบนี้',
  });

  final SignatureController controller;
  final double height;
  final String hint;

  @override
  State<SignaturePad> createState() => _SignaturePadState();
}

class _SignaturePadState extends State<SignaturePad> {
  final _padKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_redraw);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_redraw);
    super.dispose();
  }

  void _redraw() => setState(() {});

  void _add(Offset p, {bool newStroke = false}) {
    final box = _padKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return;
    final local = box.globalToLocal(p);
    // นิ้วลากเลยขอบกรอบ → หนีบไว้ในกรอบ ไม่ให้เส้นทะลุไปทับข้อความอื่นบนใบ
    final clamped = Offset(
      local.dx.clamp(0.0, box.size.width),
      local.dy.clamp(0.0, box.size.height),
    );
    widget.controller._push(clamped, newStroke: newStroke);
  }

  @override
  Widget build(BuildContext context) {
    // ใบอยู่ใน ListView — ถ้าใช้ GestureDetector(onPan…) ธรรมดา **ListView จะชนะ gesture
    // แนวตั้ง** แล้วการเซ็นกลายเป็นการเลื่อนหน้าจอ (เส้นแนวตั้งของลายเซ็นหายหมด เหลือแต่
    // เส้นแนวนอน) — ยืนยันจากการทดสอบบนเครื่องจริง
    //
    // แก้ด้วย 2 ชั้น:
    //   Listener       → รับ pointer ดิบ วาดได้เสมอ ไม่ต้องแข่งใน gesture arena
    //   GestureDetector → จองแนวตั้งไว้เฉย ๆ (ตัวจัดการว่าง) กัน ListView เลื่อนตาม
    return Listener(
      onPointerDown: (e) => _add(e.position, newStroke: true),
      onPointerMove: (e) => _add(e.position),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onVerticalDragStart: (_) {},
        onVerticalDragUpdate: (_) {},
        child: SizedBox(
          key: _padKey,
          height: widget.height,
          width: double.infinity,
          child: CustomPaint(
            painter: _SignaturePainter(widget.controller.strokes),
            child: widget.controller.isEmpty
                ? Center(
                    child: Text(widget.hint,
                        style: const TextStyle(fontSize: 11, color: Color(0xFFAAAAAA))),
                  )
                : null,
          ),
        ),
      ),
    );
  }
}

/// ถือเส้นลายเซ็นไว้นอก widget — ล้าง/เช็คว่าเซ็นหรือยังได้จากข้างนอก
class SignatureController extends ChangeNotifier {
  final List<List<Offset>> _strokes = [];

  List<List<Offset>> get strokes => _strokes;
  bool get isEmpty => _strokes.every((s) => s.length < 2);
  bool get isNotEmpty => !isEmpty;

  void _push(Offset p, {bool newStroke = false}) {
    if (newStroke || _strokes.isEmpty) {
      _strokes.add([p]);
    } else {
      _strokes.last.add(p);
    }
    notifyListeners();
  }

  void clear() {
    _strokes.clear();
    notifyListeners();
  }
}

class _SignaturePainter extends CustomPainter {
  _SignaturePainter(this.strokes);
  final List<List<Offset>> strokes;

  @override
  void paint(Canvas canvas, Size size) {
    final pen = Paint()
      ..color = Colors.black
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    for (final stroke in strokes) {
      if (stroke.length < 2) {
        // แตะจุดเดียว (จุดบนตัว ิ ี ์) — วาดเป็นจุดกลม ไม่งั้นหายไปเฉย ๆ
        if (stroke.length == 1) {
          canvas.drawCircle(stroke.first, 1.0, pen..style = PaintingStyle.fill);
          pen.style = PaintingStyle.stroke;
        }
        continue;
      }
      final path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
      for (var i = 1; i < stroke.length; i++) {
        path.lineTo(stroke[i].dx, stroke[i].dy);
      }
      canvas.drawPath(path, pen);
    }
  }

  @override
  bool shouldRepaint(_SignaturePainter old) => true;
}
