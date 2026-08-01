import 'package:flutter/material.dart';
import 'form_kit.dart';

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

  /// 12 ชิ้นที่ฟอร์มความเสียหายของ EMCS **ไม่มี radio ให้เลือกด้าน** (อีก 10 ชิ้นมี L/R/A)
  /// เลือกด้านให้ไปก็ไม่มีที่ลง — บอทติ๊กไม่ได้ ด้านที่ช่างเลือกหายเงียบ
  /// เว็บ (DamageEditor.tsx) ล็อกเป็น 'A' อยู่แล้ว มือถือต้องล็อกให้ตรงกัน
  static const _noSideParts = {
    'กันชนหน้า', 'กันชนหลัง', 'กระจกบังลมหน้า', 'กระจกบังลมหลัง', 'ฝากระโปรงหน้า',
    'ฝากระโปรงหลัง', 'กระจังหน้า', 'กระบะ', 'หลังคา', 'แผงท้าย', 'ฝาปิดท้าย', 'แค็ป',
  };

  Future<void> _tap(String part, [String pos = 'A']) async {
    // ชิ้นส่วนที่ EMCS ไม่มีปุ่มเลือกด้าน → บังคับ 'A' เสมอ (กันข้อมูลเก่าที่เคยเก็บ L/R ไว้
    // แล้วบอทติ๊ก radio ไม่ได้ — ตรงกับ DamageEditor.tsx ฝั่งเว็บ)
    if (_noSideParts.contains(part)) pos = 'A';
    // ชื่อชิ้นส่วนตรง checklist EMCS (ไม่มีข้างในชื่อ) → ต้องจับคู่ด้วย part+pos
    int idx = widget.items.indexWhere(
        (it) => it['part'] == part && (it['pos'] ?? 'A') == pos);
    Map<String, String>? justAdded;
    if (idx < 0) {
      final item = {'part': part, 'pos': pos, 'level': ''};
      widget.items.add(item);
      justAdded = item;
      idx = widget.items.length - 1;
      widget.onChanged();
      setState(() {});
    }
    await _sheet(idx);
    if (!mounted) return; // editor ถูกปิดระหว่าง sheet เปิด (เช่น 401 เด้ง login) — onChanged จะ setState บน parent ที่ dispose แล้ว
    // เพิ่งแตะชิ้นส่วนใหม่แล้วปิด sheet โดยไม่เลือกระดับ → ลบ entry ผี (ในแผนภาพไม่มีสีเลยดูเหมือน
    // ไม่ได้เลือก แต่ DamagePartList นับ + ถูกเซฟไปด้วย); remove ตาม identity ของ map
    if (justAdded != null && (justAdded['level'] ?? '').isEmpty) {
      widget.items.remove(justAdded);
      widget.onChanged();
      setState(() {});
    }
  }

  Future<void> _sheet(int idx) {
    FocusManager.instance.primaryFocus?.unfocus();
    return showModalBottomSheet(
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
            // ชิ้นส่วนที่ EMCS ไม่มี radio ด้าน → ไม่ต้องโชว์ตัวเลือก (บังคับ 'A' ไปแล้วตอนแตะ)
            if (!_noSideParts.contains(item['part'])) ...[
              const SizedBox(height: 14),
              const Text('ตำแหน่ง', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF737D90))),
              const SizedBox(height: 8),
              seg('pos', const {'L': 'ซ้าย', 'R': 'ขวา', 'A': 'ทั้งหมด'}, const {}),
            ],
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
    // แตะแผนภาพ → เพิ่ม/แก้ตำแหน่ง-ระดับ (รายการที่เพิ่มโชว์ใน DamagePartList ด้านล่างแทน chips)
    return CarDamageDiagram(items: widget.items, onTapPart: _tap);
  }
}

/// รายการชิ้นส่วนเสียหาย (พิมพ์ชื่อ + เลือกตำแหน่ง/ระดับ) — reusable (ใช้หน้า 4 ผ่าน _damageList เทียบเท่า + คู่กรณี)
/// items = [{part, pos, level}] โครงเดียวกับ CarDamageDiagram/DamageDiagramField
class DamagePartList extends StatefulWidget {
  final List<Map<String, String>> items;
  final VoidCallback onChanged;
  const DamagePartList({super.key, required this.items, required this.onChanged});

  @override
  State<DamagePartList> createState() => _DamagePartListState();
}

class _DamagePartListState extends State<DamagePartList> {
  // ควบคุมการยุบ/ขยายด้วย controller แทนการเปลี่ยน key ตาม _expanded — เดิม key = ValueKey('dpl_$_expanded')
  // ทำให้ทุก parent rebuild (แตะ chip/picker/แผนภาพ = setState) สร้าง ExpansionTile ใหม่แล้วเด้งกลับเป็น
  // ขยายเสมอ (ยุบไม่อยู่); controller ให้สั่งขยายตอนกด + ได้โดยไม่ยุ่งกับ key
  final _expController = ExpansionTileController();
  int get _filled => widget.items.where((it) => (it['part'] ?? '').trim().isNotEmpty).length;

  void _add() {
    widget.items.add({'part': '', 'pos': '', 'level': ''});
    widget.onChanged();
    setState(() {});
    // ขยายให้เห็นรายการที่เพิ่ง + (ถ้าถูกยุบอยู่) — หลัง build เฟรมถัดไป
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_expController.isExpanded) _expController.expand();
    });
  }

  void _remove(int i) {
    widget.items.removeAt(i);
    widget.onChanged();
    setState(() {});
  }

  void _update(int i, String k, String v) {
    widget.items[i][k] = v;
    widget.onChanged();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: kFill, borderRadius: BorderRadius.circular(13), border: Border.all(color: kLine)),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          controller: _expController,
          initiallyExpanded: widget.items.isNotEmpty, // อ่านครั้งแรกตอน mount เท่านั้น
          tilePadding: const EdgeInsets.symmetric(horizontal: 13),
          childrenPadding: const EdgeInsets.fromLTRB(13, 0, 13, 13),
          leading: const Icon(Icons.build_circle_outlined, color: kPrimary, size: 20),
          title: Text('รายการชิ้นส่วนเสียหาย ($_filled)', style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: kPrimary)),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            GestureDetector(
              onTap: _add,
              child: Container(padding: const EdgeInsets.all(4), decoration: BoxDecoration(color: kTint, borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.add, size: 20, color: kPrimary)),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.expand_more, color: kMuted),
          ]),
          children: [
            if (widget.items.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Text('กด + เพื่อเพิ่มรายการชิ้นส่วนที่เสียหาย', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ),
            for (int i = 0; i < widget.items.length; i++) ...[
              if (i > 0) const Divider(color: kLine, height: 18),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('ชิ้นส่วนที่ ${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kPrimary)),
                GestureDetector(
                  onTap: () => _remove(i),
                  child: Container(padding: const EdgeInsets.all(4), decoration: BoxDecoration(color: Colors.red.shade50, shape: BoxShape.circle), child: Icon(Icons.close, size: 14, color: Colors.red.shade700)),
                ),
              ]),
              const SizedBox(height: 6),
              TextFormField(
                key: ObjectKey(widget.items[i]),
                initialValue: widget.items[i]['part'],
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: kInk),
                decoration: InputDecoration(
                  hintText: 'ชิ้นส่วน เช่น กันชนหน้า, ประตูหน้า',
                  hintStyle: const TextStyle(fontSize: 13, color: kMuted2),
                  filled: true, fillColor: Colors.white, isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kLine)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kLine)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: kPrimary, width: 1.5)),
                ),
                onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
                onChanged: (v) => _update(i, 'part', v),
              ),
              const SizedBox(height: 8),
              Row(children: [
                const Text('ตำแหน่ง ', style: TextStyle(fontSize: 11, color: kMuted)),
                ...['L', 'R', 'A'].map((pos) {
                  const labels = {'L': 'ซ้าย', 'R': 'ขวา', 'A': 'ทั้งหมด'};
                  final selected = widget.items[i]['pos'] == pos;
                  return Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: GestureDetector(
                      onTap: () => _update(i, 'pos', selected ? '' : pos),
                      child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: selected ? kPrimary : Colors.white, borderRadius: BorderRadius.circular(11), border: Border.all(color: selected ? kPrimary : kLineStrong)), child: Text(labels[pos]!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: selected ? Colors.white : kMuted))),
                    ),
                  );
                }),
              ]),
              const SizedBox(height: 6),
              Row(children: [
                const Text('ระดับ ', style: TextStyle(fontSize: 11, color: kMuted)),
                ...['L', 'M', 'H', 'X'].map((lv) {
                  const labels = {'L': 'ต่ำ', 'M': 'กลาง', 'H': 'สูง', 'X': 'สูงมาก'};
                  const colors = {'L': Colors.lightGreen, 'M': Colors.orange, 'H': Colors.red, 'X': Colors.purple};
                  final selected = widget.items[i]['level'] == lv;
                  return Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: GestureDetector(
                      onTap: () => _update(i, 'level', selected ? '' : lv),
                      child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: selected ? colors[lv] : Colors.white, borderRadius: BorderRadius.circular(11), border: Border.all(color: selected ? colors[lv]! : kLineStrong)), child: Text(labels[lv]!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: selected ? Colors.white : colors[lv]))),
                    ),
                  );
                }),
              ]),
            ],
          ],
        ),
      ),
    );
  }
}

/// แผนภาพความเสียหายรถ (มุมมองบน) — แตะชิ้นส่วนเพื่อระบุระดับความเสียหาย
/// ใช้ layout แบบตาราง (ไม่พึ่ง pixel-positioning) → responsive + แตะง่าย
/// items = [{part, pos, level}] (โครงเดียวกับ _damageItems ในฟอร์ม)
class CarDamageDiagram extends StatelessWidget {
  final List<Map<String, String>> items;
  final void Function(String part, String pos) onTapPart;
  const CarDamageDiagram({super.key, required this.items, required this.onTapPart});

  // ระดับ → สี (L เขียว / M เหลือง / H ส้ม / X แดง)
  static const Map<String, Color> _lvlColor = {
    'L': Color(0xFF16A34A),
    'M': Color(0xFFEAB308),
    'H': Color(0xFFEA8600),
    'X': Color(0xFFDC2626),
  };

  // จับคู่ด้วย (ชิ้นส่วน + ด้าน) — ชื่อชิ้นส่วนตรงกับ checklist ของ EMCS ซึ่งไม่มีข้างอยู่ในชื่อ
  // ('ประตูหน้า' ใช้ทั้งซ้ายและขวา) จึงต้องดู pos ประกอบ ไม่งั้น 2 ช่องจะชนกัน
  String? _levelOf(String part, String pos) {
    for (final it in items) {
      if (it['part'] == part && (it['pos'] ?? 'A') == pos && (it['level'] ?? '').isNotEmpty) {
        return it['level'];
      }
    }
    return null;
  }

  /// [pos] = 'L' ซ้าย / 'R' ขวา / 'A' ทั้งคัน (ตรงกับ rdoDam_Left_Right ของ EMCS)
  Widget _cell(String part, {String pos = 'A', String? label, int flex = 1, double h = 38}) {
    final lvl = _levelOf(part, pos);
    final c = lvl != null ? _lvlColor[lvl] : null;
    return Expanded(
      flex: flex,
      child: Padding(
        padding: const EdgeInsets.all(2),
        child: GestureDetector(
          onTap: () => onTapPart(part, pos),
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
                Text(label ?? part, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis,
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
          // ⚠️ ชื่อชิ้นส่วน = ป้าย checklist ของ EMCS verbatim (22 ชิ้น) และ "ด้าน" แยกเป็น pos
          //    EMCS checklist ไม่มีข้างในชื่อ ('ประตูหน้า' + radio L/R/A) — ถ้าใส่ข้างในชื่อ
          //    จะ match checklist ไม่ได้เลย ตกไปช่องอิสระทุกชิ้นพร้อมชื่อเพี้ยน
          //    label = ข้อความบนจอ (ใส่ข้างให้อ่านง่าย) ส่วน part = ค่าที่ส่งจริง
          // หน้า
          Row(children: [_cell('กันชนหน้า', flex: 3, h: 30)]),
          Row(children: [
            _cell('ไฟหน้า', pos: 'L', label: 'ไฟหน้าซ้าย'),
            _cell('ฝากระโปรงหน้า', flex: 2),
            _cell('ไฟหน้า', pos: 'R', label: 'ไฟหน้าขวา'),
          ]),
          Row(children: [
            _cell('ไฟเลี้ยวหน้า', pos: 'L', label: 'ไฟเลี้ยวหน้าซ้าย'),
            _cell('กระจังหน้า', flex: 2),
            _cell('ไฟเลี้ยวหน้า', pos: 'R', label: 'ไฟเลี้ยวหน้าขวา'),
          ]),
          // ลำตัว: ซ้าย | กลาง(กระจก/หลังคา) | ขวา
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Column(children: [
              Row(children: [_cell('บังโคลนหน้า', pos: 'L', label: 'บังโคลนหน้าซ้าย')]),
              Row(children: [_cell('กระจกมองข้าง', pos: 'L', label: 'กระจกมองข้างซ้าย')]),
              Row(children: [_cell('ประตูหน้า', pos: 'L', label: 'ประตูหน้าซ้าย')]),
              Row(children: [_cell('ประตูหลัง', pos: 'L', label: 'ประตูหลังซ้าย')]),
              Row(children: [_cell('บังโคลนหลัง', pos: 'L', label: 'บังโคลนหลังซ้าย')]),
              Row(children: [_cell('บันได', pos: 'L', label: 'บันไดซ้าย')]),
            ])),
            Expanded(flex: 2, child: Column(children: [
              Row(children: [_cell('กระจกบังลมหน้า', h: 30)]),
              Row(children: [_cell('หลังคา', h: 44)]),
              Row(children: [_cell('กระจกบังลมหลัง', h: 30)]),
              Row(children: [_cell('กระบะ', h: 28)]),
              Row(children: [_cell('แค็ป', h: 28)]),
            ])),
            Expanded(child: Column(children: [
              Row(children: [_cell('บังโคลนหน้า', pos: 'R', label: 'บังโคลนหน้าขวา')]),
              Row(children: [_cell('กระจกมองข้าง', pos: 'R', label: 'กระจกมองข้างขวา')]),
              Row(children: [_cell('ประตูหน้า', pos: 'R', label: 'ประตูหน้าขวา')]),
              Row(children: [_cell('ประตูหลัง', pos: 'R', label: 'ประตูหลังขวา')]),
              Row(children: [_cell('บังโคลนหลัง', pos: 'R', label: 'บังโคลนหลังขวา')]),
              Row(children: [_cell('บันได', pos: 'R', label: 'บันไดขวา')]),
            ])),
          ]),
          // ท้าย
          Row(children: [
            _cell('ไฟท้าย', pos: 'L', label: 'ไฟท้ายซ้าย'),
            _cell('ฝากระโปรงหลัง', flex: 2),
            _cell('ไฟท้าย', pos: 'R', label: 'ไฟท้ายขวา'),
          ]),
          Row(children: [
            _cell('ไฟเลี้ยวหลัง', pos: 'L', label: 'ไฟเลี้ยวหลังซ้าย'),
            _cell('ฝาปิดท้าย', flex: 2),
            _cell('ไฟเลี้ยวหลัง', pos: 'R', label: 'ไฟเลี้ยวหลังขวา'),
          ]),
          Row(children: [_cell('แผงท้าย', flex: 3, h: 26)]),
          Row(children: [_cell('กันชนหลัง', flex: 3, h: 30)]),
          const SizedBox(height: 6),
          const Text('แตะชิ้นส่วนเพื่อระบุระดับความเสียหาย',
              style: TextStyle(fontSize: 10.5, color: Color(0xFF9AA3B4))),
        ],
      ),
    );
  }
}
