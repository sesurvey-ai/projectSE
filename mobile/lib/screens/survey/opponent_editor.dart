import 'package:flutter/material.dart';
import '../../widgets/form_kit.dart';
import '../../widgets/car_damage_diagram.dart';
import '../../data/survey_master.dart';

/// Editor คู่กรณีรายคัน (Phase 3) — คืน {'action':'save','data':{...}} หรือ {'action':'delete'}
class OpponentEditor extends StatefulWidget {
  final Map<String, dynamic> data;
  final List<String> provinces;
  final Map<String, List<String>> provincesData; // จังหวัด → รายการอำเภอ (cascade เขต/อำเภอคู่กรณี)
  final int number; // คันที่ (1-based)
  final bool isNew;
  // สแกนเอกสาร (kind = idcard | license) → คืน fields (parent จัดการถ่าย+เก็บรูป+OCR)
  final Future<Map<String, dynamic>?> Function(String kind)? onScan;
  // เรียกทันทีหลังสแกน OCR สำเร็จ → ส่ง snapshot ปัจจุบันให้ parent เซฟ draft (กันข้อมูลหายถ้าถูก kill ก่อนกด "บันทึก")
  final void Function(Map<String, dynamic> data)? onDraft;
  const OpponentEditor({super.key, required this.data, required this.provinces, this.provincesData = const {}, required this.number, this.isNew = false, this.onScan, this.onDraft});

  @override
  State<OpponentEditor> createState() => _OpponentEditorState();
}

class _OpponentEditorState extends State<OpponentEditor> {
  late final Map<String, TextEditingController> _c;
  final _damage = <Map<String, String>>[];
  String _carType = '', _carBrand = '', _carColor = '', _province = '', _district = '', _gender = '', _title = '', _relation = '', _insurer = '', _licenseType = '', _policyType = '';
  bool _kfk = false;
  bool _hasLicense = false; // สวิตช์ "มีใบขับขี่" — ค่าเริ่มต้น=ปิด (=ไม่มีใบขับขี่); สแกนใบขับขี่ = เปิดอัตโนมัติ; ปิด = ซ่อน+เคลียร์

  TextEditingController _ctl(String k) => _c[k] ??= TextEditingController(text: (widget.data[k] ?? '').toString());

  @override
  void initState() {
    super.initState();
    _c = {};
    for (final k in ['owner_name', 'owner_address', 'car_model', 'plate', 'reg_year', 'mileage', 'vin',
      'first_name', 'last_name', 'birthdate', 'age', 'phone', 'address', 'cid', 'license_no', 'license_place', 'license_start', 'license_end',
      'policy_no', 'claim_no', 'estimated_cost']) {
      _c[k] = TextEditingController(text: (widget.data[k] ?? '').toString());
    }
    _carType = (widget.data['car_type'] ?? '').toString();
    _carBrand = (widget.data['car_brand'] ?? '').toString();
    _carColor = (widget.data['car_color'] ?? '').toString();
    _province = (widget.data['province'] ?? '').toString();
    _district = (widget.data['district'] ?? '').toString();
    _gender = (widget.data['gender'] ?? '').toString();
    _title = (widget.data['title'] ?? '').toString();
    _relation = (widget.data['relation'] ?? '').toString();
    _insurer = (widget.data['insurer'] ?? '').toString();
    _licenseType = (widget.data['license_type'] ?? '').toString();
    _policyType = (widget.data['policy_type'] ?? '').toString();
    _kfk = widget.data['kfk'] == true;
    // มีใบขับขี่ = ประเภทเป็นชนิดจริง หรือมีเลขใบขับขี่อยู่แล้ว; ว่าง/ยังไม่กรอก = ไม่มี (สแกนแล้วจะเปิดเอง)
    _hasLicense = (_licenseType.isNotEmpty && _licenseType != 'ไม่มีใบขับขี่') || (widget.data['license_no'] ?? '').toString().trim().isNotEmpty;
    final dmg = widget.data['damage'];
    if (dmg is List) {
      for (final d in dmg) {
        if (d is Map) _damage.add({'part': '${d['part'] ?? ''}', 'pos': '${d['pos'] ?? ''}', 'level': '${d['level'] ?? ''}'});
      }
    }
  }

  @override
  void dispose() {
    for (final c in _c.values) { c.dispose(); }
    super.dispose();
  }

  bool get _hasInsurance => _insurer.isNotEmpty && _insurer != 'ไม่มีบริษัทประกันภัย' && _insurer != 'อื่นๆ';
  bool get _noInsurance => _insurer == 'ไม่มีบริษัทประกันภัย'; // "อื่นๆ" = มีประกัน (บริษัทนอกลิสต์) ห้ามล้างค่า

  Map<String, dynamic> _collect() => {
        'owner_name': _ctl('owner_name').text.trim(),
        'owner_address': _ctl('owner_address').text.trim(),
        'car_type': _carType,
        'car_brand': _carBrand,
        'car_model': _ctl('car_model').text.trim(),
        'car_color': _carColor,
        'plate': _ctl('plate').text.trim(),
        'province': _province,
        'district': _district,
        'reg_year': _ctl('reg_year').text.trim(),
        'mileage': _ctl('mileage').text.trim(),
        'vin': _ctl('vin').text.trim(),
        'gender': _gender,
        'title': _title,
        'first_name': _ctl('first_name').text.trim(),
        'last_name': _ctl('last_name').text.trim(),
        'relation': _relation,
        'birthdate': _ctl('birthdate').text.trim(),
        'age': _ctl('age').text.trim(),
        'phone': _ctl('phone').text.trim(),
        'address': _ctl('address').text.trim(),
        'cid': _ctl('cid').text.trim(),
        'license_no': _ctl('license_no').text.trim(),
        'license_type': _hasLicense ? _licenseType : 'ไม่มีใบขับขี่', // สวิตช์ปิด = เก็บ "ไม่มีใบขับขี่"
        'license_place': _ctl('license_place').text.trim(),
        'license_start': _ctl('license_start').text.trim(),
        'license_end': _ctl('license_end').text.trim(),
        'insurer': _insurer,
        // "ไม่มีบริษัทประกันภัย" → ห้ามเก็บค่าประกันค้าง (ช่องแค่ถูกซ่อน controller ยังถือค่าเดิม
        // เคยทำ record "ไม่มีประกัน" พ่วงเลขกรมธรรม์เก่า + XML เพี้ยน)
        // แต่ "อื่นๆ" = มีประกันกับบริษัทนอกลิสต์ (backend นับ HAVE_INSURANCE=1) — คงค่าที่พิมพ์ไว้
        'policy_no': _noInsurance ? '' : _ctl('policy_no').text.trim(),
        'claim_no': _noInsurance ? '' : _ctl('claim_no').text.trim(),
        'policy_type': _noInsurance ? '' : _policyType,
        'damage': _damage,
        'damage_description': _ctl('damage_description').text.trim(),
        'estimated_cost': _ctl('estimated_cost').text.trim(),
        'kfk': !_noInsurance && _kfk,
      };

  void _save() {
    Navigator.pop(context, {'action': 'save', 'data': _collect()});
  }

  void _delete() {
    Navigator.pop(context, {'action': 'delete'});
  }

  Future<void> _scan(String kind) async {
    if (widget.onScan == null) return;
    final fields = await widget.onScan!(kind);
    if (fields == null || fields.isEmpty || !mounted) return;
    String f(String k) => (fields[k] ?? '').toString().trim();
    setState(() {
      if (kind == 'idcard') {
        if (f('first_name').isNotEmpty) _ctl('first_name').text = f('first_name');
        if (f('last_name').isNotEmpty) _ctl('last_name').text = f('last_name');
        if (f('cid').isNotEmpty) _ctl('cid').text = f('cid');
        if (f('birthdate').isNotEmpty) _ctl('birthdate').text = kNormThaiDateEra(f('birthdate'));
        if (f('address').isNotEmpty) _ctl('address').text = f('address');
        final p = f('prefix');
        if (const ['นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.'].contains(p)) {
          _title = p;
          _gender = (p == 'นาย' || p == 'ด.ช.') ? 'ชาย' : 'หญิง';
        }
      } else {
        _hasLicense = true; // สแกนใบขับขี่ = มีใบขับขี่ (กันช่องยังซ่อนอยู่)
        if (f('license_no').isNotEmpty) _ctl('license_no').text = f('license_no');
        if (f('license_type').isNotEmpty) _licenseType = f('license_type');
        // OCR อาจอ่านฝั่งอังกฤษของใบขับขี่ได้ปี ค.ศ. → normalize เป็น พ.ศ.
        if (f('issue_date').isNotEmpty) _ctl('license_start').text = kNormThaiDateEra(f('issue_date'));
        if (f('expiry_date').isNotEmpty) _ctl('license_end').text = kNormThaiDateEra(f('expiry_date'));
        if (_ctl('first_name').text.trim().isEmpty && f('first_name').isNotEmpty) _ctl('first_name').text = f('first_name');
        if (_ctl('last_name').text.trim().isEmpty && f('last_name').isNotEmpty) _ctl('last_name').text = f('last_name');
      }
    });
    widget.onDraft?.call(_collect());   // autosave ทันทีหลังสแกน — กันข้อมูลหายถ้าแอปถูก kill ก่อนกด "บันทึก"
  }

  Widget _scanBtns() {
    if (widget.onScan == null) return const SizedBox.shrink();
    Widget b(IconData i, String l, String kind) => Expanded(
          child: OutlinedButton.icon(
            onPressed: () => _scan(kind),
            icon: Icon(i, size: 17),
            label: Text(l, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
            style: OutlinedButton.styleFrom(foregroundColor: kPrimary, backgroundColor: kTint, side: BorderSide.none, padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          ),
        );
    return Row(children: [b(Icons.credit_card, 'สแกนบัตรประชาชน', 'idcard'), const SizedBox(width: 8), b(Icons.badge_outlined, 'สแกนใบขับขี่', 'license')]);
  }

  Widget _cidField() {
    final ok = cidChecksum(_ctl('cid').text);
    final has = _ctl('cid').text.replaceAll(RegExp(r'\D'), '').length == 13;
    return kText(_ctl('cid'), 'เลขบัตรประชาชน', keyboardType: TextInputType.number, req: true, onChanged: (_) => setState(() {}),
        suffixIcon: has ? Icon(ok ? Icons.check_circle : Icons.error_outline, size: 18, color: ok ? kOk : kDanger) : null);
  }

  @override
  Widget build(BuildContext context) {
    return EditorScaffold(
      title: 'คู่กรณีคันที่ ${widget.number}',
      subtitle: 'เจ้าของ · รถ · ผู้ขับ · ประกัน · ความเสียหาย',
      onSave: _save,
      onDelete: widget.isNew ? null : _delete,
      saveLabel: 'บันทึกคันนี้',
      children: [
        kSubhead('เจ้าของ / รถ'),
        kText(_ctl('owner_name'), 'เจ้าของคู่กรณี', req: true),
        kText(_ctl('owner_address'), 'ที่อยู่เจ้าของรถ', maxLines: 2),
        kRow2(
          // เปลี่ยนประเภทรถ → ล้างยี่ห้อ (ลิสต์ยี่ห้อของ EMCS ผูกกับประเภทรถ)
          KPickerField(label: 'ประเภทรถ', value: _carType, options: kOpoCarTypes, req: true,
              onSelected: (v) => setState(() { if (v != _carType) _carBrand = ''; _carType = v; })),
          KPickerField(
              label: _carType.isEmpty ? 'ยี่ห้อ (เลือกประเภทรถก่อน)' : 'ยี่ห้อ',
              value: _carBrand, options: carBrandsFor(_carType),
              onSelected: (v) => setState(() => _carBrand = v)),
        ),
        // สีรถ = ตัวเลือกตรง master EMCS (เดิมพิมพ์เอง เช่น 'บรอนซ์เงิน' ไม่ตรงตัวเลือกไหนเลย)
        kRow2(
          kText(_ctl('car_model'), 'รุ่น'),
          KPickerField(label: 'สีรถ', value: _carColor, options: kCarColors, onSelected: (v) => setState(() => _carColor = v)),
        ),
        kRow2(
          kText(_ctl('plate'), 'ทะเบียน', req: true),
          // จังหวัด "ป้ายทะเบียน" ของรถคู่กรณี → ddlCar_Province บน EMCS (บังคับ)
          KPickerField(label: 'จังหวัด', value: _province, options: widget.provinces, req: true, onSelected: (v) => setState(() => _province = v)),
        ),
        // ⛔ เอาช่อง "เขต/อำเภอ" ออก 2026-07-27: EMCS ไม่มีที่ให้ลงเลย —
        // ddlDri_ProvinceID/DistrictID/Sub_DistrictID ของบล็อกคู่กรณีถูก display:none
        // + ไม่มี option ครบทั้ง 20 แผง (ยืนยันทั้งหน้าที่พนักงานกรอกเองและ draft จริง)
        // ที่อยู่คู่กรณีของ EMCS เป็นช่องข้อความเดียว → ให้พิมพ์อำเภอ/จังหวัดในช่อง "ที่อยู่" แทน
        // (ยังเก็บค่าเดิมใน _collect เพื่อไม่ให้ข้อมูลที่เคยกรอกไว้หาย)
        kRow2(kText(_ctl('reg_year'), 'ปีจดทะเบียน (พ.ศ.)'), kNum(_ctl('mileage'), 'เลข กม.')),
        kText(_ctl('vin'), 'หมายเลขตัวถัง (VIN)'),
        kSubhead('ผู้ขับขี่'),
        _scanBtns(),
        Row(children: [
          kChip('ชาย', _gender == 'ชาย', () => setState(() => _gender = 'ชาย'), grow: true),
          const SizedBox(width: 8),
          kChip('หญิง', _gender == 'หญิง', () => setState(() => _gender = 'หญิง'), grow: true),
        ]),
        kRow2(
          KPickerField(label: 'คำนำหน้า', value: _title, options: kTitles, req: true, onSelected: (v) => setState(() => _title = v)),
          KPickerField(label: 'ความสัมพันธ์', value: _relation, options: kRelations, req: true, onSelected: (v) => setState(() => _relation = v)),
        ),
        kRow2(kText(_ctl('first_name'), 'ชื่อ', req: true), kText(_ctl('last_name'), 'นามสกุล', req: true)),
        kRow2(KDateField(_ctl('birthdate'), 'วันเกิด (พ.ศ.)', req: true, defaultYearsAgo: 25, yearsAhead: 0), kNum(_ctl('age'), 'อายุ', req: true)),
        kText(_ctl('phone'), 'โทรศัพท์', keyboardType: TextInputType.phone, req: true),
        kText(_ctl('address'), 'ที่อยู่ปัจจุบัน', req: true, maxLines: 2),
        _cidField(),
        // ── ใบขับขี่ (เปิด/ปิด — บางเคสไม่มีใบขับขี่) ──
        kSwitch('มีใบขับขี่', _hasLicense, (v) => setState(() {
              _hasLicense = v;
              if (!v) {
                _ctl('license_no').clear();
                _ctl('license_place').clear();
                _ctl('license_start').clear();
                _ctl('license_end').clear();
                _licenseType = 'ไม่มีใบขับขี่';
              } else if (_licenseType == 'ไม่มีใบขับขี่') {
                _licenseType = '';
              }
            })),
        if (_hasLicense) ...[
          KPickerField(label: 'ประเภทใบขับขี่', value: _licenseType, options: kLicenseTypes.where((t) => t != 'ไม่มีใบขับขี่').toList(), onSelected: (v) => setState(() => _licenseType = v)),
          // ⛔ เอา "ออกให้ที่" + "วันหมดอายุ" ออก 2026-07-27: บล็อกคู่กรณีของ EMCS
          // ไม่มี txtDri_DrvPlace และไม่มี wuCale_Dri_DrvDate_End (ฝั่งรถประกันมีครบ)
          // → กรอกไปก็ไม่มีที่ลง (OCR ยังเติมค่าให้เบื้องหลังเผื่อใช้ภายใน)
          kText(_ctl('license_no'), 'ใบอนุญาตขับขี่เลขที่', req: true),
          KDateField(_ctl('license_start'), 'วันออกบัตร', yearsAhead: 0),
        ],
        kSubhead('ประกันภัยคู่กรณี'),
        KPickerField(label: 'มีประกันภัยที่', value: _insurer, options: kOpoInsurers, req: true, onSelected: (v) => setState(() {
              _insurer = v;
              _kfk = kKfkInsurers.contains(v);
            })),
        if (_hasInsurance) ...[
          kRow2(kText(_ctl('policy_no'), 'เลขกรมธรรม์', req: true), kText(_ctl('claim_no'), 'เลขเคลม', req: true)),
          KPickerField(label: 'ประเภทประกัน', value: _policyType, options: kPolicyTypes, req: true, onSelected: (v) => setState(() => _policyType = v)),
          GestureDetector(
            onTap: () => setState(() => _kfk = !_kfk),
            child: Row(children: [
              Icon(_kfk ? Icons.check_box : Icons.check_box_outline_blank, color: _kfk ? kPrimary : kMuted2, size: 22),
              const SizedBox(width: 8),
              const Expanded(child: Text('เข้าสัญญา KFK (Knock-for-Knock)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: kInk))),
            ]),
          ),
        ],
        kSubhead('ความเสียหาย'),
        DamageDiagramField(items: _damage, onChanged: () => setState(() {})),
        DamagePartList(items: _damage, onChanged: () => setState(() {})),
        // ⛔ เอา "รายละเอียดความเสียหาย" ออก 2026-07-27: EMCS ไม่มีช่องรองรับ
        // (ความเสียหายลงเป็นรายการชิ้นส่วน+ระดับผ่าน popup เท่านั้น)
        kNum(_ctl('estimated_cost'), 'ค่าเสียหายประมาณ (บาท)', decimal: true),
      ],
    );
  }
}
