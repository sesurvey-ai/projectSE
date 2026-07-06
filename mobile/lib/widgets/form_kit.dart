import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ── Design tokens (ตรงกับ survey_form_screen) ──
const kBg = Color(0xFFEEF0F4);
const kCardBg = Color(0xFFFFFFFF);
const kFill = Color(0xFFF4F6F9);
const kLine = Color(0xFFE8EBF1);
const kLineStrong = Color(0xFFDDE1E9);
const kInk = Color(0xFF1E2330);
const kMuted = Color(0xFF737D90);
const kMuted2 = Color(0xFF9AA3B4);
const kPrimary = Color(0xFF2F6BD8);
const kTint = Color(0xFFEAF1FD);
const kOk = Color(0xFF1F9D6B);
const kOkTint = Color(0xFFE4F6EE);
const kDanger = Color(0xFFDC2626);

InputDecoration kDec(String label, {String? hint, Widget? suffixIcon}) {
  OutlineInputBorder b(Color c) => OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: BorderSide(color: c, width: 1.5));
  return InputDecoration(
    labelText: label,
    hintText: hint,
    floatingLabelBehavior: FloatingLabelBehavior.always,
    labelStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: kMuted),
    hintStyle: const TextStyle(fontSize: 14.5, color: kMuted2),
    filled: true,
    fillColor: kFill,
    isDense: true,
    contentPadding: const EdgeInsets.fromLTRB(13, 10, 13, 10),
    suffixIcon: suffixIcon,
    suffixIconConstraints: const BoxConstraints(minWidth: 36, minHeight: 36),
    border: b(Colors.transparent),
    enabledBorder: b(Colors.transparent),
    focusedBorder: b(kPrimary),
    errorBorder: b(kDanger),
    focusedErrorBorder: b(kDanger),
  );
}

Widget kText(TextEditingController c, String label,
    {TextInputType? keyboardType, int maxLines = 1, void Function(String)? onChanged, String? Function(String?)? validator, Widget? suffixIcon, List<TextInputFormatter>? formatters}) {
  return TextFormField(
    controller: c,
    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: kInk),
    decoration: kDec(label, suffixIcon: suffixIcon),
    keyboardType: keyboardType,
    maxLines: maxLines,
    onChanged: onChanged,
    validator: validator,
    inputFormatters: formatters,
    textInputAction: maxLines == 1 ? TextInputAction.next : TextInputAction.newline,
  );
}

Widget kNum(TextEditingController c, String label, {bool decimal = false}) {
  return TextFormField(
    controller: c,
    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: kInk),
    decoration: kDec(label),
    keyboardType: TextInputType.numberWithOptions(decimal: decimal),
    inputFormatters: decimal ? [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))] : [FilteringTextInputFormatter.digitsOnly],
  );
}

Widget kFieldLabel(String t) =>
    Padding(padding: const EdgeInsets.only(top: 2, bottom: 2), child: Text(t, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kInk)));

Widget kSubhead(String t) => Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 2),
      child: Row(children: [
        Text(t, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: kMuted)),
        const SizedBox(width: 8),
        Expanded(child: Container(height: 1, color: kLine)),
      ]),
    );

Widget kRow2(Widget a, Widget b) =>
    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: a), const SizedBox(width: 10), Expanded(child: b)]);

Widget kChip(String label, bool selected, VoidCallback onTap, {Color? color, bool grow = false}) {
  final c = color ?? kPrimary;
  final chip = GestureDetector(
    onTap: onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 120),
      padding: EdgeInsets.symmetric(horizontal: grow ? 8 : 14, vertical: 9),
      alignment: grow ? Alignment.center : null,
      decoration: BoxDecoration(
        color: selected ? c : Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: selected ? c : kLineStrong, width: 1.5),
      ),
      child: Text(label, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: selected ? Colors.white : (color ?? kMuted))),
    ),
  );
  return grow ? Expanded(child: chip) : chip;
}

// ── ช่องเลือก (เปิด searchable picker) ──
class KPickerField extends StatelessWidget {
  final String label;
  final String value;
  final String hint;
  final List<String> options;
  final ValueChanged<String> onSelected;
  const KPickerField({super.key, required this.label, required this.value, required this.options, required this.onSelected, this.hint = 'เลือก'});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        final r = await showKPicker(context, label, options, current: value);
        if (r != null) onSelected(r);
      },
      child: InputDecorator(
        decoration: kDec(label, suffixIcon: const Icon(Icons.expand_more, color: kMuted, size: 20)),
        child: Text(
          value.isNotEmpty ? value : hint,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: value.isNotEmpty ? kInk : kMuted2),
        ),
      ),
    );
  }
}

Future<String?> showKPicker(BuildContext context, String title, List<String> options, {String? current}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
    builder: (ctx) {
      final q = ValueNotifier<String>('');
      return DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.92,
        expand: false,
        builder: (ctx, scroll) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(children: [
            const SizedBox(height: 8),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: kLineStrong, borderRadius: BorderRadius.circular(2))),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
              child: Row(children: [
                Expanded(child: Text(title, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: kInk))),
                GestureDetector(onTap: () => Navigator.pop(ctx), child: const Icon(Icons.close, color: kMuted)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                autofocus: false,
                onChanged: (v) => q.value = v,
                decoration: kDec('ค้นหา', hint: 'พิมพ์เพื่อค้นหา').copyWith(prefixIcon: const Icon(Icons.search, size: 20, color: kMuted)),
              ),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: ValueListenableBuilder<String>(
                valueListenable: q,
                builder: (ctx, query, _) {
                  final filtered = query.isEmpty ? options : options.where((o) => o.toLowerCase().contains(query.toLowerCase())).toList();
                  return ListView.builder(
                    controller: scroll,
                    itemCount: filtered.length,
                    itemBuilder: (ctx, i) {
                      final o = filtered[i];
                      final sel = o == current;
                      return ListTile(
                        dense: true,
                        title: Text(o, style: TextStyle(fontSize: 14.5, fontWeight: sel ? FontWeight.w700 : FontWeight.w500, color: sel ? kPrimary : kInk)),
                        trailing: sel ? const Icon(Icons.check, color: kPrimary, size: 20) : null,
                        onTap: () => Navigator.pop(ctx, o),
                      );
                    },
                  );
                },
              ),
            ),
          ]),
        ),
      );
    },
  );
}

// ── โครงหน้า editor เต็มจอ (app bar + body scroll + bottom save/delete) ──
class EditorScaffold extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget> children;
  final VoidCallback onSave;
  final VoidCallback? onDelete;
  final String saveLabel;
  const EditorScaffold({super.key, required this.title, this.subtitle, required this.children, required this.onSave, this.onDelete, this.saveLabel = 'บันทึก'});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        foregroundColor: kInk,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        titleSpacing: 0,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
          Text(title, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w700, color: kInk)),
          if (subtitle != null) Text(subtitle!, style: const TextStyle(fontSize: 11, color: kMuted)),
        ]),
        actions: [
          if (onDelete != null)
            IconButton(tooltip: 'ลบ', onPressed: onDelete, icon: const Icon(Icons.delete_outline, color: kDanger)),
        ],
        bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: kLine)),
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(12, 10, 12, 10 + MediaQuery.of(context).padding.bottom),
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: kLine))),
        child: SizedBox(
          height: 50,
          child: ElevatedButton.icon(
            onPressed: onSave,
            icon: const Icon(Icons.check, size: 20),
            label: Text(saveLabel, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            style: ElevatedButton.styleFrom(backgroundColor: kPrimary, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 16, 14, 28),
        children: [
          for (var i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}
