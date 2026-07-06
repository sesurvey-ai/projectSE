import 'package:flutter/material.dart';
import '../../widgets/form_kit.dart';
import '../../data/survey_master.dart';

/// Editor ผู้บาดเจ็บ (Phase 3) — คืน {'action':'save','data':{...}} หรือ {'action':'delete'}
class InjuredEditor extends StatefulWidget {
  final Map<String, dynamic> data;
  final List<String> provinces;
  final int number;
  final bool isNew;
  const InjuredEditor({super.key, required this.data, required this.provinces, required this.number, this.isNew = false});

  @override
  State<InjuredEditor> createState() => _InjuredEditorState();
}

class _InjuredEditorState extends State<InjuredEditor> {
  late final Map<String, TextEditingController> _c;
  String _personType = '', _gender = '', _wound = '';

  TextEditingController _ctl(String k) => _c[k]!;

  @override
  void initState() {
    super.initState();
    _c = {
      for (final k in ['name', 'age', 'cid', 'occupation', 'address', 'phone', 'hospital', 'treat_from', 'treat_to', 'treat_cost', 'symptom'])
        k: TextEditingController(text: (widget.data[k] ?? '').toString()),
    };
    _personType = (widget.data['person_type'] ?? '').toString();
    _gender = (widget.data['gender'] ?? '').toString();
    _wound = (widget.data['wound_level'] ?? '').toString();
  }

  @override
  void dispose() {
    for (final c in _c.values) { c.dispose(); }
    super.dispose();
  }

  Map<String, dynamic> _collect() => {
        'person_type': _personType,
        'gender': _gender,
        'name': _ctl('name').text.trim(),
        'age': _ctl('age').text.trim(),
        'cid': _ctl('cid').text.trim(),
        'occupation': _ctl('occupation').text.trim(),
        'address': _ctl('address').text.trim(),
        'phone': _ctl('phone').text.trim(),
        'hospital': _ctl('hospital').text.trim(),
        'treat_from': _ctl('treat_from').text.trim(),
        'treat_to': _ctl('treat_to').text.trim(),
        'treat_cost': _ctl('treat_cost').text.trim(),
        'wound_level': _wound,
        'symptom': _ctl('symptom').text.trim(),
      };

  @override
  Widget build(BuildContext context) {
    return EditorScaffold(
      title: 'ผู้บาดเจ็บคนที่ ${widget.number}',
      subtitle: 'ข้อมูลผู้บาดเจ็บ + การรักษา',
      onSave: () => Navigator.pop(context, {'action': 'save', 'data': _collect()}),
      onDelete: widget.isNew ? null : () => Navigator.pop(context, {'action': 'delete'}),
      children: [
        KPickerField(label: 'ประเภทผู้บาดเจ็บ', value: _personType, options: kPersonTypes, onSelected: (v) => setState(() => _personType = v)),
        Row(children: [
          kChip('ชาย', _gender == 'ชาย', () => setState(() => _gender = 'ชาย'), grow: true),
          const SizedBox(width: 8),
          kChip('หญิง', _gender == 'หญิง', () => setState(() => _gender = 'หญิง'), grow: true),
        ]),
        kText(_ctl('name'), 'ชื่อ-นามสกุลผู้บาดเจ็บ'),
        kRow2(kNum(_ctl('age'), 'อายุ'), kText(_ctl('cid'), 'เลขบัตร/พาสปอร์ต')),
        kText(_ctl('occupation'), 'อาชีพ'),
        kText(_ctl('address'), 'ที่อยู่ปัจจุบัน'),
        kText(_ctl('phone'), 'โทรศัพท์', keyboardType: TextInputType.phone),
        kSubhead('การรักษา'),
        kText(_ctl('hospital'), 'เข้ารักษาที่โรงพยาบาล'),
        kRow2(kText(_ctl('treat_from'), 'เข้ารักษาวันที่'), kText(_ctl('treat_to'), 'ถึงวันที่')),
        kNum(_ctl('treat_cost'), 'ค่ารักษาพยาบาล (บาท)', decimal: true),
        kSubhead('อาการบาดเจ็บ'),
        kFieldLabel('ระดับการบาดเจ็บ'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final w in kWounds)
            kChip(w['label'] as String, _wound == w['label'], () => setState(() => _wound = w['label'] as String), color: Color(w['color'] as int)),
        ]),
        kText(_ctl('symptom'), 'อาการบาดเจ็บ', maxLines: 4),
      ],
    );
  }
}
