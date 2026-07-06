import 'package:flutter/material.dart';

/// แผนภาพความเสียหายรถ (มุมมองบน) — แตะชิ้นส่วนเพื่อระบุระดับความเสียหาย
/// ใช้ layout แบบตาราง (ไม่พึ่ง pixel-positioning) → responsive + แตะง่าย
/// items = [{part, pos, level}] (โครงเดียวกับ _damageItems ในฟอร์ม)
class CarDamageDiagram extends StatelessWidget {
  final List<Map<String, String>> items;
  final void Function(String part) onTapPart;
  const CarDamageDiagram({super.key, required this.items, required this.onTapPart});

  // ระดับ → สี (L เขียว / M เหลือง / H ส้ม / X แดง)
  static const Map<String, Color> _lvlColor = {
    'L': Color(0xFF16A34A),
    'M': Color(0xFFEAB308),
    'H': Color(0xFFEA8600),
    'X': Color(0xFFDC2626),
  };

  String? _levelOf(String part) {
    for (final it in items) {
      if (it['part'] == part && (it['level'] ?? '').isNotEmpty) return it['level'];
    }
    return null;
  }

  Widget _cell(String part, {int flex = 1, double h = 38}) {
    final lvl = _levelOf(part);
    final c = lvl != null ? _lvlColor[lvl] : null;
    return Expanded(
      flex: flex,
      child: Padding(
        padding: const EdgeInsets.all(2),
        child: GestureDetector(
          onTap: () => onTapPart(part),
          child: Container(
            height: h,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(
              color: c != null ? c.withValues(alpha: 0.16) : const Color(0xFFF4F6F9),
              borderRadius: BorderRadius.circular(7),
              border: Border.all(color: c ?? const Color(0xFFDDE1E9), width: c != null ? 1.5 : 1),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(part, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 8.6, height: 1.05, fontWeight: FontWeight.w600, color: c ?? const Color(0xFF737D90))),
                if (lvl != null)
                  Text(lvl, style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: c)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE8EBF1)),
      ),
      child: Column(
        children: [
          // หน้า
          Row(children: [_cell('กันชนหน้า', flex: 3, h: 30)]),
          Row(children: [_cell('ไฟหน้าซ้าย'), _cell('ฝากระโปรงหน้า', flex: 2), _cell('ไฟหน้าขวา')]),
          // ลำตัว: ซ้าย | กลาง(กระจก/หลังคา) | ขวา
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Column(children: [
              Row(children: [_cell('บังโคลนหน้าซ้าย')]),
              Row(children: [_cell('ประตูหน้าซ้าย')]),
              Row(children: [_cell('ประตูหลังซ้าย')]),
              Row(children: [_cell('บังโคลนหลังซ้าย')]),
            ])),
            Expanded(flex: 2, child: Column(children: [
              Row(children: [_cell('กระจกหน้า', h: 30)]),
              Row(children: [_cell('หลังคา', h: 52)]),
              Row(children: [_cell('กระจกหลัง', h: 30)]),
            ])),
            Expanded(child: Column(children: [
              Row(children: [_cell('บังโคลนหน้าขวา')]),
              Row(children: [_cell('ประตูหน้าขวา')]),
              Row(children: [_cell('ประตูหลังขวา')]),
              Row(children: [_cell('บังโคลนหลังขวา')]),
            ])),
          ]),
          // ท้าย
          Row(children: [_cell('ไฟท้ายซ้าย'), _cell('ฝากระโปรงหลัง', flex: 2), _cell('ไฟท้ายขวา')]),
          Row(children: [_cell('กันชนหลัง', flex: 3, h: 30)]),
          const SizedBox(height: 6),
          const Text('แตะชิ้นส่วนเพื่อระบุระดับความเสียหาย',
              style: TextStyle(fontSize: 10.5, color: Color(0xFF9AA3B4))),
        ],
      ),
    );
  }
}
