import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/case_provider.dart';
import '../models/case_model.dart';

class CaseDetailScreen extends StatefulWidget {
  final int caseId;

  const CaseDetailScreen({super.key, required this.caseId});

  @override
  State<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends State<CaseDetailScreen> {
  Map<String, dynamic>? _report;
  bool _loadingDetail = true;
  Map<String, List<String>> _provincesData = {};

  @override
  void initState() {
    super.initState();
    _fetchDetail();
    _loadProvinces();
  }

  Future<void> _loadProvinces() async {
    try {
      final raw = await DefaultAssetBundle.of(context).loadString('assets/thai_provinces.json');
      final Map<String, dynamic> parsed = jsonDecode(raw);
      setState(() {
        _provincesData = parsed.map((k, v) => MapEntry(k, List<String>.from(v)));
      });
    } catch (e) {
      debugPrint('Failed to load provinces: $e');
    }
  }

  Future<void> _fetchDetail() async {
    try {
      final caseProvider = context.read<CaseProvider>();
      final report = await caseProvider.fetchCaseDetail(widget.caseId);
      setState(() {
        _report = report;
        _loadingDetail = false;
      });
    } catch (_) {
      setState(() => _loadingDetail = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'assigned':
        return Colors.orange;
      case 'surveyed':
        return Colors.blue;
      case 'reviewed':
        return Colors.green;
      case 'pending':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  String _statusText(String status) {
    switch (status) {
      case 'assigned':
        return 'มอบหมายแล้ว';
      case 'surveyed':
        return 'สำรวจแล้ว';
      case 'reviewed':
        return 'ตรวจสอบแล้ว';
      case 'pending':
        return 'รอดำเนินการ';
      default:
        return status;
    }
  }


  void _showBuddhistDatePicker() {
    final now = DateTime.now();
    final thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    int selDay = now.day;
    int selMonth = now.month;
    int selYear = now.year + 543 - 25; // default ~25 years ago

    // Try parse existing value
    final existing = _val('driver_birthdate');
    if (existing != '-') {
      final parts = existing.split('/');
      if (parts.length == 3) {
        selDay = int.tryParse(parts[0]) ?? selDay;
        selMonth = int.tryParse(parts[1]) ?? selMonth;
        selYear = int.tryParse(parts[2]) ?? selYear;
      }
    }

    showModalBottomSheet(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final maxDay = DateTime(selYear - 543, selMonth + 1, 0).day;
            if (selDay > maxDay) selDay = maxDay;
            return Container(
              height: 320,
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('เลือกวันเกิด', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      TextButton(
                        onPressed: () {
                          final formatted = '${selDay.toString().padLeft(2, '0')}/${selMonth.toString().padLeft(2, '0')}/$selYear';
                          _set('driver_birthdate', formatted);
                          Navigator.pop(ctx);
                        },
                        child: const Text('ตกลง', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: Row(
                      children: [
                        // วัน
                        Expanded(
                          flex: 2,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              const Text('วัน', style: TextStyle(fontSize: 13, color: Colors.grey)),
                              const SizedBox(height: 4),
                              Expanded(
                                child: ListWheelScrollView.useDelegate(
                                  itemExtent: 36,
                                  diameterRatio: 1.5,
                                  physics: const FixedExtentScrollPhysics(),
                                  controller: FixedExtentScrollController(initialItem: selDay - 1),
                                  onSelectedItemChanged: (i) => setModalState(() => selDay = i + 1),
                                  childDelegate: ListWheelChildBuilderDelegate(
                                    childCount: maxDay,
                                    builder: (ctx, i) => Center(child: Text('${i + 1}', style: TextStyle(fontSize: 18, fontWeight: (i + 1) == selDay ? FontWeight.bold : FontWeight.normal))),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // เดือน
                        Expanded(
                          flex: 4,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              const Text('เดือน', style: TextStyle(fontSize: 13, color: Colors.grey)),
                              const SizedBox(height: 4),
                              Expanded(
                                child: ListWheelScrollView.useDelegate(
                                  itemExtent: 36,
                                  diameterRatio: 1.5,
                                  physics: const FixedExtentScrollPhysics(),
                                  controller: FixedExtentScrollController(initialItem: selMonth - 1),
                                  onSelectedItemChanged: (i) => setModalState(() => selMonth = i + 1),
                                  childDelegate: ListWheelChildBuilderDelegate(
                                    childCount: 12,
                                    builder: (ctx, i) => Center(child: Text(thaiMonths[i], style: TextStyle(fontSize: 16, fontWeight: (i + 1) == selMonth ? FontWeight.bold : FontWeight.normal))),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // ปี พ.ศ.
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              const Text('ปี พ.ศ.', style: TextStyle(fontSize: 13, color: Colors.grey)),
                              const SizedBox(height: 4),
                              Expanded(
                                child: ListWheelScrollView.useDelegate(
                                  itemExtent: 36,
                                  diameterRatio: 1.5,
                                  physics: const FixedExtentScrollPhysics(),
                                  controller: FixedExtentScrollController(initialItem: selYear - (now.year + 543 - 100)),
                                  onSelectedItemChanged: (i) => setModalState(() => selYear = (now.year + 543 - 100) + i),
                                  childDelegate: ListWheelChildBuilderDelegate(
                                    childCount: 101,
                                    builder: (ctx, i) {
                                      final y = (now.year + 543 - 100) + i;
                                      return Center(child: Text('$y', style: TextStyle(fontSize: 18, fontWeight: y == selYear ? FontWeight.bold : FontWeight.normal)));
                                    },
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _set(String key, String value) {
    setState(() {
      _report ??= {};
      _report![key] = value;
    });
  }

  String _val(String? key) {
    if (key == null || _report == null) return '-';
    final v = _report![key];
    if (v == null || v.toString().isEmpty) return '-';
    return v.toString();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('รายละเอียดงาน'),
      ),
      body: Consumer<CaseProvider>(
        builder: (context, caseProvider, _) {
          final CaseModel? caseModel = caseProvider.getCaseById(widget.caseId);

          if (caseModel == null) {
            return const Center(
              child: Text('ไม่พบข้อมูลงาน', style: TextStyle(fontSize: 16, color: Colors.grey)),
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status badge
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    decoration: BoxDecoration(
                      color: _statusColor(caseModel.status).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _statusText(caseModel.status),
                      style: TextStyle(
                        color: _statusColor(caseModel.status),
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                const SizedBox(height: 16),

                // Vehicle details card
                if (_loadingDetail)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  )
                else if (_report != null)
                  _buildVehicleCard(),

                const SizedBox(height: 24),

                // Survey button
                if (caseModel.status == 'assigned')
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: () => context.go('/cases/${caseModel.id}/survey'),
                      icon: const Icon(Icons.assignment),
                      label: const Text('เริ่มสำรวจ', style: TextStyle(fontSize: 16)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildVehicleCard() {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Blue header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF0174BE), Color(0xFF4988C4)],
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.directions_car, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'รายละเอียดรถยนต์',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                // Claim type badge
                if (_val('claim_type') != '-')
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _claimTypeLabel(_val('claim_type')),
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ),
              ],
            ),
          ),

          // Company & claim info
          _buildSection('บริษัทประกัน / เคลม', [
            _buildTableRow('บริษัทประกัน', _val('insurance_company')),
            _buildTableRow('สาขา', _val('insurance_branch')),
            _buildTableRow('เลขเรื่องเซอร์เวย์', _val('survey_job_no')),
            _buildTableRow('เลขที่รับแจ้ง', _val('claim_ref_no')),
            _buildTableRow('เลขที่เคลม', _val('claim_no')),
          ]),

          const Divider(height: 1),

          // Policy info
          _buildSection('ข้อมูลกรมธรรม์', [
            _buildTableRow('เลข พ.ร.บ.', _val('prb_number')),
            _buildTableRow('เลขกรมธรรม์', _val('policy_no')),
            _buildTableRow('ผู้ขับตามกรมธรรม์', _val('driver_by_policy')),
            _buildTableRow('เริ่มต้น', _val('policy_start')),
            _buildTableRow('สิ้นสุด', _val('policy_end')),
            _buildTableRow('ชื่อผู้เอาประกัน', _val('assured_name')),
            _buildTableRow('ประเภทกรมธรรม์', _val('policy_type')),
            _buildTableRow('รหัสความเสี่ยง', _val('risk_code')),
            _buildTableRow('ค่าเสียหายส่วนแรก', _val('deductible')),
          ]),

          const Divider(height: 1),

          // Vehicle info
          _buildSection('ข้อมูลรถยนต์', [
            _buildTableRow('หมายเลขทะเบียน', _val('license_plate')),
            _buildTableRow('จังหวัด', _val('car_province')),
            _buildTableRow('ประเภทรถ', _val('car_type')),
            _buildTableRow('ยี่ห้อ', _val('car_brand')),
            _buildTableRow('รุ่น', _val('car_model')),
            _buildTableRow('สี', _val('car_color')),
            _buildTableRow('ปีจดทะเบียน', _val('car_reg_year')),
            _buildTableRow('ประเภท EV', _val('ev_type')),
            _buildTableRow('หมายเลขตัวรถ', _val('chassis_no')),
            _buildTableRow('รุ่นรถ', _val('model_no')),
            _buildTableRow('หมายเลขเครื่อง', _val('engine_no')),
            _buildTableRow('เลขไมล์', _val('mileage')),
          ]),

        ],
      ),
    );
  }

  Widget _inputField(String label, String value, {String? fieldKey}) {
    return TextFormField(
      initialValue: value == '-' ? '' : value,
      readOnly: fieldKey == null,
      style: const TextStyle(fontSize: 13, color: Colors.black87),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 12, color: Colors.grey),
        filled: true,
        fillColor: fieldKey != null ? Colors.white : Colors.grey.shade100,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: Colors.grey.shade300)),
        isDense: true,
      ),
      onChanged: fieldKey != null ? (v) => _set(fieldKey, v) : null,
    );
  }

  Widget _inputRow2(String l1, String v1, String l2, String v2) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Expanded(child: _inputField(l1, v1)),
        const SizedBox(width: 8),
        Expanded(child: _inputField(l2, v2)),
      ]),
    );
  }

  Widget _inputRow1(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: _inputField(label, value),
    );
  }

  Widget _selectField(String label, String? value, List<String> options, {String? fieldKey, ValueChanged<String>? onSelect}) {
    final current = (value != null && value != '-' && options.contains(value)) ? value : options.first;
    final editable = fieldKey != null || onSelect != null;
    return DropdownButtonFormField<String>(
      initialValue: current,
      isExpanded: true,
      style: const TextStyle(fontSize: 13, color: Colors.black87),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 12, color: Colors.grey),
        filled: true,
        fillColor: editable ? Colors.white : Colors.grey.shade100,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: Colors.grey.shade300)),
        isDense: true,
      ),
      items: options.map((o) => DropdownMenuItem(value: o, child: Text(o, style: const TextStyle(fontSize: 13)))).toList(),
      onChanged: editable ? (v) {
        if (v != null) {
          if (fieldKey != null) _set(fieldKey, v);
          onSelect?.call(v);
        }
      } : null,
    );
  }

  Widget _provinceSelect(String label, String value, {String? fieldKey, String? districtFieldKey}) {
    final names = _provincesData.keys.toList()..sort();
    final items = ['-- เลือกจังหวัด --', ...names];
    final current = (value != '-' && names.contains(value)) ? value : items.first;
    return DropdownButtonFormField<String>(
      initialValue: current,
      isExpanded: true,
      style: const TextStyle(fontSize: 13, color: Colors.black87),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 12, color: Colors.grey),
        filled: true, fillColor: fieldKey != null ? Colors.white : Colors.grey.shade100,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: Colors.grey.shade300)),
        isDense: true,
      ),
      items: items.map((o) => DropdownMenuItem(value: o, child: Text(o, style: const TextStyle(fontSize: 13)))).toList(),
      onChanged: fieldKey != null ? (v) {
        if (v != null) {
          _set(fieldKey, v);
          if (districtFieldKey != null) _set(districtFieldKey, '');
        }
      } : null,
    );
  }

  Widget _districtSelect(String label, String value, String province, {String? fieldKey}) {
    final districts = (province != '-' && _provincesData.containsKey(province))
        ? _provincesData[province]!
        : <String>[];
    final items = ['-- เลือกอำเภอ --', ...districts];
    final current = (value != '-' && districts.contains(value)) ? value : items.first;
    return DropdownButtonFormField<String>(
      key: ValueKey('${province}_$fieldKey'),
      initialValue: current,
      isExpanded: true,
      style: const TextStyle(fontSize: 13, color: Colors.black87),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 12, color: Colors.grey),
        filled: true, fillColor: fieldKey != null ? Colors.white : Colors.grey.shade100,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: Colors.grey.shade300)),
        isDense: true,
      ),
      items: items.map((o) => DropdownMenuItem(value: o, child: Text(o, style: const TextStyle(fontSize: 13)))).toList(),
      onChanged: fieldKey != null ? (v) { if (v != null) _set(fieldKey, v); } : null,
    );
  }

  Widget _buildDriverSection() {
    final genderRaw = _val('driver_gender');
    final gender = genderRaw == 'M' ? 'ชาย' : genderRaw == 'F' ? 'หญิง' : 'เพศ';
    final titleRaw = _val('driver_title');
    final title = (titleRaw != '-') ? titleRaw : 'คำนำหน้า';
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ข้อมูลผู้ขับขี่', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0174BE))),
          const SizedBox(height: 10),
          // ปุ่มสแกน
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    // TODO: สแกนบัตรประชาชน
                  },
                  icon: const Icon(Icons.credit_card, size: 18),
                  label: const Text('สแกนบัตรประชาชน', style: TextStyle(fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0174BE),
                    side: const BorderSide(color: Color(0xFF0174BE)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    // TODO: สแกนใบขับขี่
                  },
                  icon: const Icon(Icons.badge, size: 18),
                  label: const Text('สแกนใบขับขี่', style: TextStyle(fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0174BE),
                    side: const BorderSide(color: Color(0xFF0174BE)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ]),
          ),
          // แถว 1: เพศ + คำนำหน้า + วันเกิด
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              Flexible(flex: 2, child: _selectField('เพศ', gender, const ['เพศ', 'ชาย', 'หญิง'], fieldKey: 'driver_gender', onSelect: (v) {
                final code = v == 'ชาย' ? 'M' : v == 'หญิง' ? 'F' : '';
                _set('driver_gender', code);
              })),
              const SizedBox(width: 6),
              Flexible(flex: 3, child: _selectField('คำนำหน้า', title, const ['คำนำหน้า', 'นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.', 'คุณ'], fieldKey: 'driver_title')),
              const SizedBox(width: 6),
              Flexible(
                flex: 3,
                child: GestureDetector(
                  onTap: () => _showBuddhistDatePicker(),
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'วันเกิด',
                      labelStyle: const TextStyle(fontSize: 12, color: Colors.grey),
                      filled: true, fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: Colors.grey.shade300)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: Colors.grey.shade300)),
                      isDense: true,
                      suffixIcon: const Icon(Icons.calendar_today, size: 14, color: Colors.grey),
                    ),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        _val('driver_birthdate') == '-' ? '' : _val('driver_birthdate'),
                        style: const TextStyle(fontSize: 13, color: Colors.black87),
                        maxLines: 1,
                      ),
                    ),
                  ),
                ),
              ),
            ]),
          ),
          // แถว 2: ชื่อ + นามสกุล
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              Expanded(child: _inputField('ชื่อ', _val('driver_first_name'), fieldKey: 'driver_first_name')),
              const SizedBox(width: 8),
              Expanded(child: _inputField('นามสกุล', _val('driver_last_name'), fieldKey: 'driver_last_name')),
            ]),
          ),
          // แถว 3: อายุ + โทรศัพท์ + ความสัมพันธ์
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              SizedBox(width: 55, child: _inputField('อายุ', _val('driver_age'), fieldKey: 'driver_age')),
              const SizedBox(width: 8),
              SizedBox(width: 110, child: _inputField('โทรศัพท์', _val('driver_phone'), fieldKey: 'driver_phone')),
              const SizedBox(width: 8),
              Expanded(child: _selectField('ความสัมพันธ์กับเจ้าของรถ', _val('driver_relation'), const [
                '-- ระบุ --', 'สามี', 'ภรรยา', 'บุตร', 'บิดา', 'มารดา',
                'นายจ้าง', 'ลูกจ้าง', 'ผู้เช่า', 'พี่ชาย', 'พี่สาว',
                'น้องชาย', 'น้องสาว', 'เจ้าของรถ', 'หลาน', 'อา', 'น้า', 'ลุง', 'ป้า',
                'ญาติ', 'เพื่อน', 'แฟน', 'พนักงาน', 'พี่เขย', 'น้องเขย',
                'พี่สะใภ้', 'น้องสะใภ้', 'พนักงานผู้เช่า', 'ลุงเขย', 'น้าเขย',
                'น้าสะใภ้', 'อาเขย', 'อาสะใภ้', 'หุ้นส่วน', 'บุตรหุ้นส่วน',
                'เจ้าของบริษัท', 'เพื่อนบุตรเจ้าของรถ', 'บุตรเขย', 'หลานเขย', 'บุตรสะใภ้',
              ], fieldKey: 'driver_relation')),
            ]),
          ),
          // แถว 4: ที่อยู่
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _inputField('ที่อยู่ปัจจุบัน', _val('driver_address'), fieldKey: 'driver_address'),
          ),
          // แถว 5: จังหวัด
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _provinceSelect('จังหวัด', _val('driver_province'), fieldKey: 'driver_province', districtFieldKey: 'driver_district'),
          ),
          // แถว 6: เขต/อำเภอ
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _districtSelect('เขต/อำเภอ', _val('driver_district'), _val('driver_province'), fieldKey: 'driver_district'),
          ),
          // แถว 6: บัตรประชาชน + ใบขับขี่
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              Expanded(child: _inputField('บัตรประชาชนเลขที่', _val('driver_id_card'), fieldKey: 'driver_id_card')),
              const SizedBox(width: 8),
              Expanded(child: _inputField('ใบอนุญาตขับขี่เลขที่', _val('driver_license_no'), fieldKey: 'driver_license_no')),
            ]),
          ),
          // แถว 8: ประเภทใบขับขี่ + ออกให้ที่
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              Expanded(child: _inputField('ประเภท', _val('driver_license_type'), fieldKey: 'driver_license_type')),
              const SizedBox(width: 8),
              Expanded(child: _inputField('ออกให้ที่', _val('driver_license_place'), fieldKey: 'driver_license_place')),
            ]),
          ),
          // แถว 9: ออกให้วันที่ + หมดอายุ
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              Expanded(child: _inputField('ออกให้วันที่', _val('driver_license_start'), fieldKey: 'driver_license_start')),
              const SizedBox(width: 8),
              Expanded(child: _inputField('หมดอายุวันที่', _val('driver_license_end'), fieldKey: 'driver_license_end')),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> rows) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0174BE))),
          const SizedBox(height: 8),
          ...rows,
        ],
      ),
    );
  }

  Widget _buildTableRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(label, style: const TextStyle(fontSize: 13, color: Colors.grey)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }

  String _claimTypeLabel(String type) {
    switch (type) {
      case 'F': return 'เคลมสด';
      case 'D': return 'เคลมแห้ง';
      case 'A': return 'งานนัดหมาย';
      case 'C': return 'งานติดตาม';
      default: return type;
    }
  }

}
