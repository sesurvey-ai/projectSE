import 'package:flutter/material.dart';
import '../../widgets/form_kit.dart';

/// Editor ทรัพย์สินเสียหาย (Phase 3) — คืน {'action':'save','data':{...}} หรือ {'action':'delete'}
class PropertyEditor extends StatefulWidget {
  final Map<String, dynamic> data;
  final int number;
  final bool isNew;
  const PropertyEditor({super.key, required this.data, required this.number, this.isNew = false});

  @override
  State<PropertyEditor> createState() => _PropertyEditorState();
}

class _PropertyEditorState extends State<PropertyEditor> {
  late final Map<String, TextEditingController> _c;
  TextEditingController _ctl(String k) => _c[k]!;

  @override
  void initState() {
    super.initState();
    _c = {
      for (final k in ['item', 'cause', 'detail', 'estimated_cost', 'owner_name', 'owner_address', 'owner_phone'])
        k: TextEditingController(text: (widget.data[k] ?? '').toString()),
    };
  }

  @override
  void dispose() {
    for (final c in _c.values) { c.dispose(); }
    super.dispose();
  }

  Map<String, dynamic> _collect() => {
        'item': _ctl('item').text.trim(),
        'cause': _ctl('cause').text.trim(),
        'detail': _ctl('detail').text.trim(),
        'estimated_cost': _ctl('estimated_cost').text.trim(),
        'owner_name': _ctl('owner_name').text.trim(),
        'owner_address': _ctl('owner_address').text.trim(),
        'owner_phone': _ctl('owner_phone').text.trim(),
      };

  @override
  Widget build(BuildContext context) {
    return EditorScaffold(
      title: 'ทรัพย์สินชิ้นที่ ${widget.number}',
      subtitle: 'ทรัพย์สินบุคคลภายนอกที่เสียหาย',
      onSave: () => Navigator.pop(context, {'action': 'save', 'data': _collect()}),
      onDelete: widget.isNew ? null : () => Navigator.pop(context, {'action': 'delete'}),
      children: [
        kText(_ctl('item'), 'รายการทรัพย์สิน'),
        kText(_ctl('cause'), 'สาเหตุที่ทรัพย์สินเสียหาย', maxLines: 3),
        kText(_ctl('detail'), 'รายละเอียด/ลักษณะความเสียหาย', maxLines: 3),
        kNum(_ctl('estimated_cost'), 'ค่าความเสียหายประมาณ (บาท)', decimal: true),
        kSubhead('เจ้าของทรัพย์สิน'),
        kText(_ctl('owner_name'), 'ชื่อเจ้าของทรัพย์สิน'),
        kText(_ctl('owner_address'), 'ที่อยู่ปัจจุบัน'),
        kText(_ctl('owner_phone'), 'โทรศัพท์ที่ติดต่อได้', keyboardType: TextInputType.phone),
      ],
    );
  }
}
