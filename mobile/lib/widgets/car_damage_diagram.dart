import 'package:flutter/material.dart';

/// แผนภาพความเสียหาย + จัดการเลือกข้าง/ระดับในตัว (ใช้ใน editor คู่กรณี ฯลฯ)
/// items = list ของ {part, pos, level}; เรียก onChanged เมื่อแก้ไข
class DamageDiagramField extends StatefulWidget {
  final List<Map<String, String>> items;
  final VoidCallback onChanged;
  const DamageDiagramField({super.key, required this.items, required this.onChanged});

  @override
  State<DamageDiagramField> createState() => _DamageDiagramFieldState();
}

class _DamageDiagramFieldState extends State<DamageDiagramField> {
  static const _lvlColor = {'L': Color(0xFF16A34A), 'M': Color(0xFFEAB308), 'H': Color(0xFFEA8600), 'X': Color(0xFFDC2626)};

  void _tap(String part) {
    int idx = widget.items.indexWhere((it) => it['part'] == part);
    if (idx < 0) {
      final defPos = part.contains('ซ้าย') ? 'L' : (part.contains('ขวา') ? 'R' : 'A');
      widget.items.add({'part': part, 'pos': defPos, 'level': ''});
      idx = widget.items.length - 1;
      widget.onChanged();
      setState(() {});
    }
    _sheet(idx);
  }

  void _sheet(int idx) {
    FocusManager.instance.primaryFocus?.unfocus();
    showModalBottomSheet(
      context: context,
      useSafeArea: true, // กันปุ่ม "เสร็จ" โดน nav bar บัง
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
        final item = widget.items[idx];
        Widget seg(String group, Map<String, String> opts, Map<String, Color> colors) => Wrap(spacing: 8, runSpacing: 8, children: [
              for (final e in opts.entries)
                GestureDetector(
                  onTap: () {
                    final sel = item[group] == e.key;
                    setSheet(() => item[group] = sel ? '' : e.key);
                    widget.onChanged();
                    setState(() {});
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: item[group] == e.key ? (colors[e.key] ?? const Color(0xFF2F6BD8)) : Colors.white,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: item[group] == e.key ? (colors[e.key] ?? const Color(0xFF2F6BD8)) : const Color(0xFFDDE1E9), width: 1.5),
                    ),
                    child: Text(e.value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: item[group] == e.key ? Colors.white : const Color(0xFF737D90))),
                  ),
                ),
            ]);
        return SafeArea(
          top: false,
          child: Padding(
          padding: EdgeInsets.fromLTRB(16, 14, 16, 16 + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(item['part'] ?? '', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1E2330)))),
              GestureDetector(
                onTap: () { widget.items.removeAt(idx); widget.onChanged(); setState(() {}); Navigator.pop(ctx); },
                child: Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: Colors.red.shade50, shape: BoxShape.circle), child: Icon(Icons.delete_outline, size: 18, color: Colors.red.shade700)),
              ),
            ]),
            const SizedBox(height: 14),
            const Text('ตำแหน่ง', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF737D90))),
            const SizedBox(height: 8),
            seg('pos', const {'L': 'ซ้าย', 'R': 'ขวา', 'A': 'ทั้งหมด'}, const {}),
            const SizedBox(height: 14),
            const Text('ระดับความเสียหาย', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF737D90))),
            const SizedBox(height: 8),
            seg('level', const {'L': 'ต่ำ', 'M': 'กลาง', 'H': 'สูง', 'X': 'สูงมาก'}, _lvlColor),
            const SizedBox(height: 18),
            SizedBox(width: double.infinity, height: 46, child: ElevatedButton(onPressed: () => Navigator.pop(ctx), style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2F6BD8), foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13))), child: const Text('เสร็จ', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)))),
          ]),
        ));
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      CarDamageDiagram(items: widget.items, onTapPart: _tap),
      if (widget.items.isNotEmpty) ...[
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (int i = 0; i < widget.items.length; i++)
            GestureDetector(
              onTap: () => _sheet(i),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: (_lvlColor[widget.items[i]['level']] ?? const Color(0xFF9AA3B4)).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: _lvlColor[widget.items[i]['level']] ?? const Color(0xFFDDE1E9)),
                ),
                child: Text(
                  '${widget.items[i]['part']}${(widget.items[i]['level'] ?? '').isNotEmpty ? ' · ${widget.items[i]['level']}' : ''}',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _lvlColor[widget.items[i]['level']] ?? const Color(0xFF737D90)),
                ),
              ),
            ),
        ]),
      ],
    ]);
  }
}

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
