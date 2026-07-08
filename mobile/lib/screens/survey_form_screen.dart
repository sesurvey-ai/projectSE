import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/case_provider.dart';
import '../config/api_config.dart';
import '../widgets/car_damage_diagram.dart';
import '../data/survey_master.dart' show cidChecksum;
import 'survey/opponent_editor.dart';
import 'survey/injured_editor.dart';
import 'survey/property_editor.dart';

// ── Design tokens (from Claude design "survey-form.html") ──
const _bg = Color(0xFFEEF0F4);
const _cardBg = Color(0xFFFFFFFF);
const _fill = Color(0xFFF4F6F9);
const _line = Color(0xFFE8EBF1);
const _lineStrong = Color(0xFFDDE1E9);
const _ink = Color(0xFF1E2330);
const _muted = Color(0xFF737D90);
const _muted2 = Color(0xFF9AA3B4);
const _primary = Color(0xFF2F6BD8);
const _tint = Color(0xFFEAF1FD);
const _warn = Color(0xFFC98A06);
const _warnTint = Color(0xFFFDF3DF);
const _ok = Color(0xFF1F9D6B);
const _okTint = Color(0xFFE4F6EE);

// มุมมองใน Hub-and-Spoke: hub = แดชบอร์ด, s1..s6 = หน้าหมวดเต็มจอ, ที่เหลือ = แท็บอื่น
enum _SView { hub, s1, s2, s3, s4, s5, s6, photos, notes, injured, property, expenses, review }

class SurveyFormScreen extends StatefulWidget {
  final int caseId;
  const SurveyFormScreen({super.key, required this.caseId});

  @override
  State<SurveyFormScreen> createState() => _SurveyFormScreenState();
}

class _SurveyFormScreenState extends State<SurveyFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final List<String> _photoPaths = [];
  final Map<String, String> _photoCat = {}; // path → หมวดรูป (Phase 5)
  static const List<String> _imgCats = ['รถประกัน', 'คู่กรณี', 'ทรัพย์สิน', 'ผู้บาดเจ็บ', 'เอกสาร', 'แผนที่'];
  List<String> _provinceNames = [];
  Map<String, List<String>> _provincesData = {};
  List<Map<String, dynamic>> _caseImages = [];
  bool _showImageSheet = false;
  // มุมมองปัจจุบันของ Hub-and-Spoke (เริ่มที่แดชบอร์ด)
  _SView _view = _SView.hub;
  DateTime? _slaStart; // เวลาลูกค้าแจ้งประกัน (ตั้งต้น SLA 24 ชม.) — จาก report.customer_reported_at
  // keys for the section card wrappers (reused as GlobalKeys)
  final List<GlobalKey> _secKeys = List.generate(8, (_) => GlobalKey());

  // Phase 2: capture tools
  String? _savedAt;      // เวลาบันทึกร่างอัตโนมัติล่าสุด (HH:MM)
  bool _ocrBusy = false; // กำลังสแกน OCR

  // Phase 3: ข้อมูลหลายรายการ (persist เป็น JSONB)
  final List<Map<String, dynamic>> _opponents = [];
  final List<Map<String, dynamic>> _injured = [];
  final List<Map<String, dynamic>> _property = [];

  void _go(_SView v) {
    FocusManager.instance.primaryFocus?.unfocus();
    _autosave();
    setState(() => _view = v);
  }

  // หมวดถัดไปแบบเรียงลำดับ (s1→…→s6) — null = ไม่มีถัดไป (โชว์ปุ่ม "กลับ Hub" แทน)
  static const _sectionOrder = [_SView.s1, _SView.s2, _SView.s3, _SView.s4, _SView.s5, _SView.s6];
  _SView? _nextSectionView() {
    final i = _sectionOrder.indexOf(_view);
    return (i >= 0 && i < _sectionOrder.length - 1) ? _sectionOrder[i + 1] : null;
  }

  _SView? _prevSectionView() {
    final i = _sectionOrder.indexOf(_view);
    return (i > 0) ? _sectionOrder[i - 1] : null;
  }

  String _sectionShortTitle(_SView v) {
    switch (v) {
      case _SView.s2: return 'รถประกัน';
      case _SView.s3: return 'ผู้ขับขี่';
      case _SView.s4: return 'ความเสียหาย';
      case _SView.s5: return 'เหตุการณ์';
      case _SView.s6: return 'คู่กรณี';
      default: return '';
    }
  }

  // บันทึกร่างอัตโนมัติแบบเงียบ (ไม่มี snackbar) + อัปเดตป้ายเวลา
  Future<void> _autosave() async {
    try {
      final data = _collectFormData();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_draftKey, jsonEncode(data));
      final now = DateTime.now();
      final t = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
      if (mounted) setState(() => _savedAt = t);
    } catch (_) {}
  }

  // ── OCR core: ถ่าย 1 ครั้ง → เก็บรูปเข้าเคส (หมวดเอกสาร) + สกัดข้อมูล → คืน fields ──
  // kind = 'claim' | 'idcard' | 'license'
  Future<Map<String, dynamic>?> _captureRetainOcr(String kind) async {
    try {
      final XFile? shot = await _picker.pickImage(source: ImageSource.camera, imageQuality: 88, maxWidth: 2200);
      if (shot == null) return null;
      // เก็บรูปเข้าโฟลเดอร์เคส (retain, หมวดเอกสาร) — ถ่ายครั้งเดียวได้ทั้งรูป + OCR
      final caseFolder = await _getCaseFolder();
      final localPath = '$caseFolder/doc_${DateTime.now().millisecondsSinceEpoch}.jpg';
      await File(shot.path).copy(localPath);
      if (!mounted) return null;
      setState(() { _photoPaths.add(localPath); _photoCat[localPath] = 'เอกสาร'; _ocrBusy = true; });
      final cp = context.read<CaseProvider>();
      final res = kind == 'claim' ? await cp.ocrClaim(localPath) : await cp.ocrDocument(localPath, kind);
      if (!mounted) return null;
      setState(() => _ocrBusy = false);
      final fields = (res?['fields'] as Map?)?.cast<String, dynamic>() ?? {};
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(fields.isEmpty ? 'บันทึกรูปแล้ว แต่อ่านข้อมูลไม่ได้ — ลองถ่ายใหม่ให้ชัด' : 'เก็บรูป + เติมข้อมูลแล้ว (${fields.length} ช่อง)'),
        backgroundColor: fields.isEmpty ? Colors.orange : Colors.green,
        duration: const Duration(seconds: 2),
      ));
      return fields;
    } catch (_) {
      if (mounted) {
        setState(() => _ocrBusy = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('สแกนไม่สำเร็จ')));
      }
      return null;
    }
  }

  // สแกนบัตร ปชช./ใบขับขี่ ของผู้ขับ (s3)
  Future<void> _scanDriverDoc(String kind) async {
    final fields = await _captureRetainOcr(kind);
    if (fields == null || fields.isEmpty || !mounted) return;
    String f(String k) => (fields[k] ?? '').toString().trim();
    if (kind == 'idcard') {
      if (f('first_name').isNotEmpty) _driverNameCtl.text = f('first_name');
      if (f('last_name').isNotEmpty) _driverLastnameCtl.text = f('last_name');
      if (f('cid').isNotEmpty) _driverIdCardCtl.text = f('cid');
      if (f('birthdate').isNotEmpty) _driverBirthdateCtl.text = f('birthdate');
      if (f('address').isNotEmpty) _driverAddressCtl.text = f('address');
      final p = f('prefix');
      if (const ['นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.'].contains(p)) {
        _driverTitle = p;
        _driverGender = (p == 'นาย' || p == 'ด.ช.') ? 'M' : 'F';
      }
    } else {
      if (f('license_no').isNotEmpty) _driverLicenseNoCtl.text = f('license_no');
      if (f('license_type').isNotEmpty) _driverLicenseTypeCtl.text = f('license_type');
      if (f('issue_date').isNotEmpty) _driverLicenseStartCtl.text = f('issue_date');
      if (f('expiry_date').isNotEmpty) _driverLicenseEndCtl.text = f('expiry_date');
      if (_driverNameCtl.text.trim().isEmpty && f('first_name').isNotEmpty) _driverNameCtl.text = f('first_name');
      if (_driverLastnameCtl.text.trim().isEmpty && f('last_name').isNotEmpty) _driverLastnameCtl.text = f('last_name');
    }
    setState(() {});
  }

  // ── แตะชิ้นส่วนบนแผนภาพ → เพิ่ม/แก้รายการ + เลือกข้าง/ระดับใน bottom sheet ──
  void _onTapDiagramPart(String part) {
    int idx = _damageItems.indexWhere((it) => it['part'] == part);
    if (idx < 0) {
      final defPos = part.contains('ซ้าย') ? 'L' : (part.contains('ขวา') ? 'R' : 'A');
      _damageItems.add({'part': part, 'pos': defPos, 'level': ''});
      idx = _damageItems.length - 1;
      _syncDamageDesc();
    }
    _showDamagePartSheet(idx);
  }

  void _showDamagePartSheet(int idx) {
    FocusManager.instance.primaryFocus?.unfocus();
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final item = _damageItems[idx];
          Widget seg(String group, Map<String, String> opts, Map<String, Color> colors) => Wrap(spacing: 8, runSpacing: 8, children: [
                for (final e in opts.entries)
                  GestureDetector(
                    onTap: () {
                      final sel = item[group] == e.key;
                      setSheet(() => item[group] = sel ? '' : e.key);
                      _updateDamageItem(idx, group, item[group] ?? '');
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: item[group] == e.key ? (colors[e.key] ?? _primary) : Colors.white,
                        borderRadius: BorderRadius.circular(11),
                        border: Border.all(color: item[group] == e.key ? (colors[e.key] ?? _primary) : _lineStrong, width: 1.5),
                      ),
                      child: Text(e.value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: item[group] == e.key ? Colors.white : _muted)),
                    ),
                  ),
              ]);
          return SafeArea(
            top: false,
            child: Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 16 + MediaQuery.of(ctx).viewInsets.bottom),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(item['part'] ?? '', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _ink))),
                GestureDetector(
                  onTap: () { setState(() { _damageItems.removeAt(idx); _syncDamageDesc(); }); Navigator.pop(ctx); },
                  child: Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: Colors.red.shade50, shape: BoxShape.circle), child: Icon(Icons.delete_outline, size: 18, color: Colors.red.shade700)),
                ),
              ]),
              const SizedBox(height: 14),
              const Text('ตำแหน่ง', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: _muted)),
              const SizedBox(height: 8),
              seg('pos', const {'L': 'ซ้าย', 'R': 'ขวา', 'A': 'ทั้งหมด'}, const {}),
              const SizedBox(height: 14),
              const Text('ระดับความเสียหาย', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: _muted)),
              const SizedBox(height: 8),
              seg('level', const {'L': 'ต่ำ', 'M': 'กลาง', 'H': 'สูง', 'X': 'สูงมาก'},
                  const {'L': Color(0xFF16A34A), 'M': Color(0xFFEAB308), 'H': Color(0xFFEA8600), 'X': Color(0xFFDC2626)}),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity, height: 46,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(backgroundColor: _primary, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13))),
                  child: const Text('เสร็จ', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ),
            ]),
          ));
        },
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _loadProvinces();
    _loadExistingReport();
  }

  Future<void> _loadProvinces() async {
    try {
      final raw = await DefaultAssetBundle.of(context).loadString('assets/thai_provinces.json');
      final parsed = Map<String, dynamic>.from(jsonDecode(raw));
      setState(() {
        _provincesData = parsed.map((k, v) => MapEntry(k, List<String>.from(v)));
        _provinceNames = _provincesData.keys.toList()..sort();
      });
    } catch (_) {}
  }

  void _showBuddhistDatePicker(TextEditingController target, {String title = 'เลือกวันที่', int defaultYearsAgo = 0, int yearsAhead = 5}) {
    // ปล่อย focus ของช่องข้อความที่ค้างอยู่ ก่อนเปิด bottom sheet → ปิดแล้วไม่เด้ง focus/คีย์บอร์ดกลับ
    FocusManager.instance.primaryFocus?.unfocus();
    final now = DateTime.now();
    final thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    int selDay = now.day;
    int selMonth = now.month;
    int selYear = now.year + 543 - defaultYearsAgo;

    final existing = target.text.trim();
    if (existing.isNotEmpty) {
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
                      Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      TextButton(
                        onPressed: () {
                          final formatted = '${selDay.toString().padLeft(2, '0')}/${selMonth.toString().padLeft(2, '0')}/$selYear';
                          setState(() { target.text = formatted; });
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
                                    childCount: 101 + yearsAhead,
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

  Future<void> _loadExistingReport() async {
    try {
      final caseProvider = context.read<CaseProvider>();
      final report = await caseProvider.fetchCaseDetail(widget.caseId);
      if (report != null && mounted) {
        final images = report['case_images'];
        if (images != null && images is List && images.isNotEmpty) {
          setState(() {
            _caseImages = List<Map<String, dynamic>>.from(
              images.where((img) => img['image_type'] == 'ocr'),
            );
          });
        }
        _populateForm(report);
      }
    } catch (_) {}
    // โหลด draft ทับ (ถ้ามี) เพื่อให้ข้อมูลที่ช่างแก้ไขในเครื่องมีความสำคัญกว่า
    await _loadDraft();
  }

  void _populateForm(Map<String, dynamic> data) {
    setState(() {
      _claimType = data['claim_type'] ?? _claimType;
      _damageLevel = data['damage_level'] ?? _damageLevel;
      final ct = data['car_type'];
      _carType = (ct != null && const ['0','A','E','M','T','V','W','O'].contains(ct)) ? ct : _carType;
      _evType = data['ev_type'] ?? _evType;
      final dg = data['driver_gender'];
      _driverGender = (dg != null && const ['M','F'].contains(dg)) ? dg : _driverGender;
      final dt = data['driver_title'];
      final validMale = ['นาย','ด.ช.','คุณ'];
      final validFemale = ['นาง','นางสาว','ด.ญ.','คุณ'];
      if (dt != null && const ['นาย','นาง','นางสาว','ด.ช.','ด.ญ.','คุณ'].contains(dt)) {
        if (_driverGender == 'M' && validMale.contains(dt)) {
          _driverTitle = dt;
        } else if (_driverGender == 'F' && validFemale.contains(dt)) {
          _driverTitle = dt;
        } else if (_driverGender == '') {
          _driverTitle = '0';
        } else {
          _driverTitle = _driverGender == 'M' ? 'นาย' : 'นางสาว';
        }
      } else {
        if (_driverGender == 'M') _driverTitle = 'นาย';
        else if (_driverGender == 'F') _driverTitle = 'นางสาว';
        else _driverTitle = '0';
      }
      _accFault = data['acc_fault'] ?? _accFault;
      _accFollowup = data['acc_followup'] ?? _accFollowup;
    });

    final mapping = <TextEditingController, String>{
      _surveyCompanyCtl: 'survey_company', _surveyCompanyAddressCtl: 'survey_company_address',
      _surveyCompanyPhoneCtl: 'survey_company_phone',
      _surveyJobNoCtl: 'survey_job_no', _claimRefNoCtl: 'claim_ref_no', _claimNoCtl: 'claim_no',
      _insuranceCompanyCtl: 'insurance_company', _insuranceBranchCtl: 'insurance_branch',
      _prbNumberCtl: 'prb_number', _policyNoCtl: 'policy_no', _driverByPolicyCtl: 'driver_by_policy',
      _policyStartCtl: 'policy_start', _policyEndCtl: 'policy_end',
      _assuredNameCtl: 'assured_name', _policyTypeCtl: 'policy_type',
      _assuredEmailCtl: 'assured_email', _riskCodeCtl: 'risk_code', _deductibleCtl: 'deductible',
      _licensePlateCtl: 'license_plate', _carProvinceCtl: 'car_province',
      _carBrandCtl: 'car_brand', _carModelCtl: 'car_model', _carColorCtl: 'car_color',
      _carRegYearCtl: 'car_reg_year', _chassisNoCtl: 'chassis_no', _engineNoCtl: 'engine_no',
      _modelNoCtl: 'model_no', _mileageCtl: 'mileage',
      _driverNameCtl: 'driver_first_name', _driverLastnameCtl: 'driver_last_name',
      _driverAgeCtl: 'driver_age', _driverBirthdateCtl: 'driver_birthdate',
      _driverPhoneCtl: 'driver_phone', _driverAddressCtl: 'driver_address',
      _driverIdCardCtl: 'driver_id_card', _driverLicenseNoCtl: 'driver_license_no',
      _driverLicenseTypeCtl: 'driver_license_type', _driverLicensePlaceCtl: 'driver_license_place',
      _driverLicenseStartCtl: 'driver_license_start', _driverLicenseEndCtl: 'driver_license_end',
      _driverRelationCtl: 'driver_relation',
      _driverProvinceCtl: 'driver_province', _driverDistrictCtl: 'driver_district',
      _damageDescCtl: 'damage_description', _estimatedCostCtl: 'estimated_cost',
      _accDateCtl: 'acc_date', _accTimeCtl: 'acc_time', _accPlaceCtl: 'acc_place',
      _accProvinceCtl: 'acc_province', _accDistrictCtl: 'acc_district',
      _accCauseCtl: 'acc_cause', _accDamageTypeCtl: 'acc_damage_type', _accDetailCtl: 'acc_detail',
      _accReporterCtl: 'acc_reporter', _accSurveyorCtl: 'acc_surveyor',
      _accSurveyorBranchCtl: 'acc_surveyor_branch', _accSurveyorPhoneCtl: 'acc_surveyor_phone',
      _accClaimAmountCtl: 'acc_claim_amount',
      _accClaimTotalAmountCtl: 'acc_claim_total_amount',
      _accPoliceNameCtl: 'acc_police_name', _accPoliceStationCtl: 'acc_police_station',
      _accPoliceCommentCtl: 'acc_police_comment', _accPoliceDateCtl: 'acc_police_date',
      _accPoliceBookNoCtl: 'acc_police_book_no', _accAlcoholTestCtl: 'acc_alcohol_test',
      _accFollowupCountCtl: 'acc_followup_count', _accFollowupDetailCtl: 'acc_followup_detail',
      _accFollowupDateCtl: 'acc_followup_date', _notesCtl: 'notes',
    };
    for (final entry in mapping.entries) {
      final val = data[entry.value];
      if (val != null) entry.key.text = val.toString();
    }

    // restore ข้อมูลหลายรายการ + แผนภาพความเสียหาย (จาก server report หรือ draft)
    setState(() {
      void restoreList(String key, List<Map<String, dynamic>> target) {
        final v = data[key];
        if (v is List) {
          target
            ..clear()
            ..addAll(v.whereType<Map>().map((e) => Map<String, dynamic>.from(e)));
        }
      }
      restoreList('opposing_parties', _opponents);
      restoreList('injured_persons', _injured);
      restoreList('damaged_property', _property);
      final idmg = data['insured_damage'];
      if (idmg is List) {
        _damageItems
          ..clear()
          ..addAll(idmg.whereType<Map>().map((e) => {'part': '${e['part'] ?? ''}', 'pos': '${e['pos'] ?? ''}', 'level': '${e['level'] ?? ''}'}));
        _syncDamageDesc();
      }
      final cr = data['customer_reported_at'];
      if (cr is String && cr.isNotEmpty) _slaStart = DateTime.tryParse(cr);

      // 4 ไทม์สแตมป์เก็บเป็น "dd/mm/yyyy|HH:mm" → แยกวันที่/เวลา
      void splitDT(String key, TextEditingController d, TextEditingController t) {
        final v = (data[key] ?? '').toString();
        if (v.isEmpty) return;
        final parts = v.split('|');
        d.text = parts[0];
        if (parts.length > 1) t.text = parts[1];
      }
      splitDT('acc_customer_report_date', _accCustomerReportDateCtl, _accCustomerReportTimeCtl);
      splitDT('acc_insurance_notify_date', _accInsNotifyDateCtl, _accInsNotifyTimeCtl);
      splitDT('acc_survey_arrive_date', _accSurveyArriveDateCtl, _accSurveyArriveTimeCtl);
      splitDT('acc_survey_complete_date', _accSurveyCompleteDateCtl, _accSurveyCompleteTimeCtl);

      // การเรียกร้องคู่กรณี: comma-separated → set checkbox
      final oc = (data['acc_claim_opponent'] ?? '').toString();
      _opoClaims
        ..clear()
        ..addAll(oc.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty));

      // สวิตช์ progressive: เปิดถ้ามีข้อมูลอยู่แล้ว
      _hasPrb = _prbNumberCtl.text.trim().isNotEmpty;
      _hasPolice = _accPoliceNameCtl.text.trim().isNotEmpty ||
          _accPoliceStationCtl.text.trim().isNotEmpty ||
          _accPoliceCommentCtl.text.trim().isNotEmpty ||
          _accPoliceBookNoCtl.text.trim().isNotEmpty;
    });
  }

  final ImagePicker _picker = ImagePicker();

  // === บริษัทสำรวจ ===
  final _surveyCompanyCtl = TextEditingController();
  final _surveyCompanyAddressCtl = TextEditingController();
  final _surveyCompanyPhoneCtl = TextEditingController();

  // === เคลม ===
  String _claimType = '';
  String _damageLevel = '';
  bool _carLost = false;
  bool _hasPrb = false;    // สวิตช์ "มี พรบ." — เปิดแล้วโผล่ช่องเลข พรบ.
  bool _hasPolice = false; // สวิตช์ "มีการแจ้งความ/ลงประจำวัน" — เปิดแล้วโผล่ส่วนตำรวจ
  final _insuranceCompanyCtl = TextEditingController();
  final _insuranceBranchCtl = TextEditingController();
  final _surveyJobNoCtl = TextEditingController();
  final _claimRefNoCtl = TextEditingController();
  final _claimNoCtl = TextEditingController();

  // === กรมธรรม์ ===
  final _prbNumberCtl = TextEditingController();
  final _policyNoCtl = TextEditingController();
  final _driverByPolicyCtl = TextEditingController();
  final _policyStartCtl = TextEditingController();
  final _policyEndCtl = TextEditingController();
  final _assuredNameCtl = TextEditingController();
  final _policyTypeCtl = TextEditingController();
  final _assuredEmailCtl = TextEditingController();
  final _riskCodeCtl = TextEditingController();
  final _deductibleCtl = TextEditingController();

  // === รถ ===
  String _carType = '0';
  final _carBrandCtl = TextEditingController();
  final _carModelCtl = TextEditingController();
  final _carColorCtl = TextEditingController();
  final _licensePlateCtl = TextEditingController();
  final _carProvinceCtl = TextEditingController();
  final _chassisNoCtl = TextEditingController();
  final _engineNoCtl = TextEditingController();
  final _mileageCtl = TextEditingController();
  final _carRegYearCtl = TextEditingController();
  String _evType = '';
  final _evBatteryNoCtl = TextEditingController();
  final _evBatteryStartCtl = TextEditingController();
  final _evChargerNoCtl = TextEditingController();
  final _modelNoCtl = TextEditingController();

  // === ผู้ขับขี่ ===
  String _driverGender = '';
  String _driverTitle = '0';
  final _driverNameCtl = TextEditingController();
  final _driverLastnameCtl = TextEditingController();
  final _driverAgeCtl = TextEditingController();
  final _driverBirthdateCtl = TextEditingController();
  final _driverPhoneCtl = TextEditingController();
  final _driverAddressCtl = TextEditingController();
  final _driverIdCardCtl = TextEditingController();
  final _driverLicenseNoCtl = TextEditingController();
  final _driverLicenseTypeCtl = TextEditingController();
  final _driverLicensePlaceCtl = TextEditingController();
  final _driverLicenseStartCtl = TextEditingController();
  final _driverLicenseEndCtl = TextEditingController();
  final _driverRelationCtl = TextEditingController();
  final _driverProvinceCtl = TextEditingController();
  final _driverDistrictCtl = TextEditingController();

  // === ความเสียหาย ===
  final _damageDescCtl = TextEditingController();
  final _estimatedCostCtl = TextEditingController();
  // รายการความเสียหาย: {part: ชื่อชิ้นส่วน, pos: L/R/A, level: O/L/M/H/X}
  final List<Map<String, String>> _damageItems = [];
  bool _damageExpanded = false;

  void _addDamageItem() {
    setState(() {
      _damageItems.add({'part': '', 'pos': '', 'level': ''});
      _damageExpanded = true;
    });
  }

  void _removeDamageItem(int index) {
    setState(() {
      _damageItems.removeAt(index);
      _syncDamageDesc();
    });
  }

  void _updateDamageItem(int index, String key, String value) {
    setState(() {
      _damageItems[index][key] = value;
      _syncDamageDesc();
    });
  }

  void _syncDamageDesc() {
    final posLabels = {'L': 'ซ้าย', 'R': 'ขวา', 'A': 'ทั้งหมด'};
    final levelLabels = {'L': 'ต่ำ', 'M': 'กลาง', 'H': 'สูง', 'X': 'สูงมาก'};
    final lines = <String>[];
    for (int i = 0; i < _damageItems.length; i++) {
      final item = _damageItems[i];
      if (item['part']?.isNotEmpty == true) {
        final pos = posLabels[item['pos']] ?? '';
        final level = levelLabels[item['level']] ?? '';
        final parts = [item['part']!, if (pos.isNotEmpty) pos, if (level.isNotEmpty) level];
        lines.add('${i + 1}. ${parts.join(' - ')}');
      }
    }
    _damageDescCtl.text = lines.join('\n');
  }

  // === อุบัติเหตุ ===
  final _accDateCtl = TextEditingController();
  final _accTimeCtl = TextEditingController();
  final _accPlaceCtl = TextEditingController();
  final _accProvinceCtl = TextEditingController();
  final _accDistrictCtl = TextEditingController();
  final _accCauseCtl = TextEditingController();
  final _accDamageTypeCtl = TextEditingController();
  final _accDetailCtl = TextEditingController();
  String _accFault = 'ฝ่ายผิด';
  final _accReporterCtl = TextEditingController();
  final _accSurveyorCtl = TextEditingController();
  final _accCustomerReportDateCtl = TextEditingController();
  final _accCustomerReportTimeCtl = TextEditingController();
  final _accInsNotifyDateCtl = TextEditingController();
  final _accInsNotifyTimeCtl = TextEditingController();
  final _accSurveyArriveDateCtl = TextEditingController();
  final _accSurveyArriveTimeCtl = TextEditingController();
  final _accSurveyCompleteDateCtl = TextEditingController();
  final _accSurveyCompleteTimeCtl = TextEditingController();
  // การเรียกร้องค่าเสียหายจากคู่กรณี (5 ตัวเลือก, เก็บ comma-separated ลง acc_claim_opponent)
  final Set<String> _opoClaims = {};
  final _accClaimAmountCtl = TextEditingController();
  final _accClaimTotalAmountCtl = TextEditingController();
  final _accPoliceNameCtl = TextEditingController();
  final _accPoliceStationCtl = TextEditingController();
  final _accPoliceCommentCtl = TextEditingController();
  final _accAlcoholTestCtl = TextEditingController();
  String _accFollowup = 'ไม่มีการนัดหมาย';
  final _accFollowupCountCtl = TextEditingController();
  final _accFollowupDetailCtl = TextEditingController();
  final _accFollowupDateCtl = TextEditingController();
  final _accSurveyorBranchCtl = TextEditingController();
  final _accSurveyorPhoneCtl = TextEditingController();
  final _accPoliceDateCtl = TextEditingController();
  final _accPoliceBookNoCtl = TextEditingController();

  // === หมายเหตุ ===
  final _notesCtl = TextEditingController();

  @override
  void dispose() {
    for (final c in [
      _surveyCompanyCtl, _surveyCompanyAddressCtl, _surveyCompanyPhoneCtl,
      _insuranceCompanyCtl, _insuranceBranchCtl, _surveyJobNoCtl, _claimRefNoCtl, _claimNoCtl,
      _prbNumberCtl, _policyNoCtl, _driverByPolicyCtl, _policyStartCtl, _policyEndCtl,
      _assuredNameCtl, _policyTypeCtl, _assuredEmailCtl, _riskCodeCtl, _deductibleCtl,
      _carBrandCtl, _carModelCtl, _carColorCtl, _licensePlateCtl, _carProvinceCtl,
      _chassisNoCtl, _engineNoCtl, _mileageCtl, _carRegYearCtl, _modelNoCtl,
      _evBatteryNoCtl, _evBatteryStartCtl, _evChargerNoCtl,
      _driverNameCtl, _driverLastnameCtl, _driverAgeCtl, _driverBirthdateCtl,
      _driverPhoneCtl, _driverAddressCtl, _driverIdCardCtl, _driverLicenseNoCtl,
      _driverLicenseTypeCtl, _driverLicensePlaceCtl, _driverLicenseStartCtl, _driverLicenseEndCtl,
      _driverRelationCtl, _driverProvinceCtl, _driverDistrictCtl,
      _damageDescCtl, _estimatedCostCtl,
      _accDateCtl, _accTimeCtl, _accPlaceCtl, _accProvinceCtl, _accDistrictCtl,
      _accCauseCtl, _accDamageTypeCtl, _accDetailCtl, _accReporterCtl, _accSurveyorCtl,
      _accCustomerReportDateCtl, _accInsNotifyDateCtl, _accSurveyArriveDateCtl, _accSurveyCompleteDateCtl,
      _accCustomerReportTimeCtl, _accInsNotifyTimeCtl, _accSurveyArriveTimeCtl, _accSurveyCompleteTimeCtl,
      _accClaimAmountCtl, _accClaimTotalAmountCtl,
      _accPoliceNameCtl, _accPoliceStationCtl, _accPoliceCommentCtl, _accPoliceDateCtl, _accPoliceBookNoCtl,
      _accAlcoholTestCtl, _accFollowupCountCtl, _accFollowupDetailCtl, _accFollowupDateCtl,
      _accSurveyorBranchCtl, _accSurveyorPhoneCtl, _notesCtl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _showCardImage(int initialIndex) {
    final urls = _caseImages.map((img) {
      final filePath = img['file_path']?.toString() ?? '';
      return '${ApiConfig.baseUrl}/uploads/$filePath';
    }).toList();
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: EdgeInsets.zero,
        child: Stack(
          children: [
            PageView.builder(
              controller: PageController(initialPage: initialIndex),
              itemCount: urls.length,
              itemBuilder: (context, index) => InteractiveViewer(
                child: Image.network(
                  urls[index],
                  fit: BoxFit.contain,
                  loadingBuilder: (context, child, progress) =>
                      progress == null ? child : const Center(child: CircularProgressIndicator(color: Colors.white)),
                  errorBuilder: (context, error, stackTrace) => const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.image_not_supported_outlined, color: Colors.white54, size: 48),
                        SizedBox(height: 12),
                        Text('ไม่พบรูปภาพ', style: TextStyle(color: Colors.white70, fontSize: 14)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: MediaQuery.of(ctx).padding.top + 8,
              right: 8,
              child: IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(Icons.close, color: Colors.white, size: 28)),
            ),
          ],
        ),
      ),
    );
  }

  Future<String> _getCaseFolder() async {
    final cn = _claimNoCtl.text.trim();
    final sj = _surveyJobNoCtl.text.trim();
    final claimFolder = cn.isNotEmpty ? cn.replaceAll(RegExp(r'[/\\?%*:|"<>]'), '_') : 'case_${widget.caseId}';
    final jobFolder = sj.isNotEmpty ? sj.replaceAll(RegExp(r'[/\\?%*:|"<>]'), '_') : 'job_${widget.caseId}';
    final folder = Directory('/storage/emulated/0/Download/SE_Survey/$claimFolder/$jobFolder');
    if (!folder.existsSync()) folder.createSync(recursive: true);
    return folder.path;
  }

  Future<void> _takePhoto() async {
    try {
      final XFile? photo = await _picker.pickImage(source: ImageSource.camera, imageQuality: 80, maxWidth: 1920);
      if (photo == null) return;
      // Copy to local case folder
      final caseFolder = await _getCaseFolder();
      final localPath = '$caseFolder/survey_${DateTime.now().millisecondsSinceEpoch}.jpg';
      await File(photo.path).copy(localPath);
      setState(() { _photoPaths.add(localPath); _photoCat[localPath] = 'รถประกัน'; });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('ไม่สามารถเปิดกล้องได้')));
    }
  }

  void _removePhoto(int index) => setState(() {
        _photoCat.remove(_photoPaths[index]);
        _photoPaths.removeAt(index);
      });

  // เปลี่ยนหมวดของรูป (Phase 5)
  void _changePhotoCat(int index) async {
    final path = _photoPaths[index];
    final chosen = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Padding(padding: EdgeInsets.all(14), child: Text('เลือกหมวดรูป', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: _ink))),
          for (final c in _imgCats)
            ListTile(
              dense: true,
              title: Text(c, style: const TextStyle(fontSize: 14.5, color: _ink)),
              trailing: _photoCat[path] == c ? const Icon(Icons.check, color: _primary, size: 20) : null,
              onTap: () => Navigator.pop(ctx, c),
            ),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (chosen != null) setState(() => _photoCat[path] = chosen);
  }

  Map<String, int> _photoMin() => {
        'รถประกัน': 8,
        'คู่กรณี': _opponents.isNotEmpty ? 6 : 0,
        'ทรัพย์สิน': _property.isNotEmpty ? 3 : 0,
        'ผู้บาดเจ็บ': _injured.length * 2,
        'เอกสาร': 2,
        'แผนที่': 1,
      };
  int _photoCountOf(String cat) => _photoCat.values.where((c) => c == cat).length;

  // การ์ดเช็คลิสต์ความครบของรูปตามหมวด (เฉพาะหมวดที่ min>0)
  Widget _imgChecklist() {
    final min = _photoMin();
    final rows = min.entries.where((e) => e.value > 0).toList();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: _fill, borderRadius: BorderRadius.circular(13), border: Border.all(color: _line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('เงื่อนไขจำนวนรูปภาพ', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: _ink)),
        const SizedBox(height: 8),
        for (final e in rows) ...[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(children: [
              Icon(_photoCountOf(e.key) >= e.value ? Icons.check_circle : Icons.radio_button_unchecked,
                  size: 15, color: _photoCountOf(e.key) >= e.value ? _ok : _muted2),
              const SizedBox(width: 8),
              Expanded(child: Text(e.key, style: const TextStyle(fontSize: 12.5, color: _ink))),
              Text('${_photoCountOf(e.key)}/${e.value}',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _photoCountOf(e.key) >= e.value ? _ok : _warn)),
            ]),
          ),
        ],
      ]),
    );
  }

  String get _draftKey => 'survey_draft_${widget.caseId}';

  Future<void> _loadDraft() async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString(_draftKey);
    if (json == null) return;
    final data = jsonDecode(json) as Map<String, dynamic>;
    _populateForm(data);
  }

  Map<String, dynamic> _collectFormData() {
    final driverFullName = '$_driverTitle ${_driverNameCtl.text.trim()} ${_driverLastnameCtl.text.trim()}'.trim();
    final data = <String, dynamic>{
      'survey_company': _surveyCompanyCtl.text.trim(),
      'survey_company_address': _surveyCompanyAddressCtl.text.trim(),
      'survey_company_phone': _surveyCompanyPhoneCtl.text.trim(),
      'claim_type': _claimType,
      'damage_level': _damageLevel,
      'car_lost': _carLost,
      'insurance_company': _insuranceCompanyCtl.text.trim(),
      'insurance_branch': _insuranceBranchCtl.text.trim(),
      'survey_job_no': _surveyJobNoCtl.text.trim(),
      'claim_ref_no': _claimRefNoCtl.text.trim(),
      'claim_no': _claimNoCtl.text.trim(),
      'prb_number': _prbNumberCtl.text.trim(),
      'policy_no': _policyNoCtl.text.trim(),
      'driver_by_policy': _driverByPolicyCtl.text.trim(),
      'policy_start': _policyStartCtl.text.trim(),
      'policy_end': _policyEndCtl.text.trim(),
      'assured_name': _assuredNameCtl.text.trim(),
      'policy_type': _policyTypeCtl.text.trim(),
      'assured_email': _assuredEmailCtl.text.trim(),
      'risk_code': _riskCodeCtl.text.trim(),
      'car_brand': _carBrandCtl.text.trim(),
      'car_model': _carModelCtl.text.trim(),
      'car_color': _carColorCtl.text.trim(),
      'car_type': _carType,
      'license_plate': _licensePlateCtl.text.trim(),
      'car_province': _carProvinceCtl.text.trim(),
      'chassis_no': _chassisNoCtl.text.trim(),
      'engine_no': _engineNoCtl.text.trim(),
      'car_reg_year': _carRegYearCtl.text.trim(),
      'ev_type': _evType.isNotEmpty ? _evType : null,
      'ev_battery_no': _evBatteryNoCtl.text.trim(),
      'ev_battery_start': _evBatteryStartCtl.text.trim(),
      'ev_charger_no': _evChargerNoCtl.text.trim(),
      'model_no': _modelNoCtl.text.trim(),
      'driver_gender': _driverGender,
      'driver_title': _driverTitle,
      'driver_name': driverFullName,
      'driver_birthdate': _driverBirthdateCtl.text.trim(),
      'driver_phone': _driverPhoneCtl.text.trim(),
      'driver_address': _driverAddressCtl.text.trim(),
      'driver_id_card': _driverIdCardCtl.text.trim(),
      'driver_license_no': _driverLicenseNoCtl.text.trim(),
      'driver_license_type': _driverLicenseTypeCtl.text.trim(),
      'driver_license_place': _driverLicensePlaceCtl.text.trim(),
      'driver_license_start': _driverLicenseStartCtl.text.trim(),
      'driver_license_end': _driverLicenseEndCtl.text.trim(),
      'driver_relation': _driverRelationCtl.text.trim(),
      'driver_province': _driverProvinceCtl.text.trim(),
      'driver_district': _driverDistrictCtl.text.trim(),
      'damage_description': _damageDescCtl.text.trim(),
      // แผนภาพความเสียหายรถประกัน (structured) → JSONB คอลัมน์ insured_damage
      'insured_damage': _damageItems,
      // ข้อมูลหลายรายการ → JSONB
      'opposing_parties': _opponents,
      'injured_persons': _injured,
      'damaged_property': _property,
      'acc_date': _accDateCtl.text.trim(),
      'acc_time': _accTimeCtl.text.trim(),
      'acc_place': _accPlaceCtl.text.trim(),
      'acc_province': _accProvinceCtl.text.trim(),
      'acc_district': _accDistrictCtl.text.trim(),
      'acc_cause': _accCauseCtl.text.trim(),
      'acc_damage_type': _accDamageTypeCtl.text.trim(),
      'acc_detail': _accDetailCtl.text.trim(),
      'acc_fault': _accFault,
      'acc_reporter': _accReporterCtl.text.trim(),
      'acc_surveyor': _accSurveyorCtl.text.trim(),
      'acc_surveyor_branch': _accSurveyorBranchCtl.text.trim(),
      'acc_surveyor_phone': _accSurveyorPhoneCtl.text.trim(),
      'acc_customer_report_date': _combineDT(_accCustomerReportDateCtl, _accCustomerReportTimeCtl),
      'acc_insurance_notify_date': _combineDT(_accInsNotifyDateCtl, _accInsNotifyTimeCtl),
      'acc_survey_arrive_date': _combineDT(_accSurveyArriveDateCtl, _accSurveyArriveTimeCtl),
      'acc_survey_complete_date': _combineDT(_accSurveyCompleteDateCtl, _accSurveyCompleteTimeCtl),
      'acc_claim_opponent': _opoClaims.join(','),
      'acc_police_name': _accPoliceNameCtl.text.trim(),
      'acc_police_station': _accPoliceStationCtl.text.trim(),
      'acc_police_comment': _accPoliceCommentCtl.text.trim(),
      'acc_police_date': _accPoliceDateCtl.text.trim(),
      'acc_police_book_no': _accPoliceBookNoCtl.text.trim(),
      'acc_alcohol_test': _accAlcoholTestCtl.text.trim(),
      'acc_followup': _accFollowup,
      'acc_followup_count': _accFollowupCountCtl.text.trim(),
      'acc_followup_detail': _accFollowupDetailCtl.text.trim(),
      'acc_followup_date': _accFollowupDateCtl.text.trim(),
      'notes': _notesCtl.text.trim(),
    };
    if (_mileageCtl.text.trim().isNotEmpty) data['mileage'] = int.tryParse(_mileageCtl.text.trim());
    if (_driverAgeCtl.text.trim().isNotEmpty) data['driver_age'] = int.tryParse(_driverAgeCtl.text.trim());
    if (_estimatedCostCtl.text.trim().isNotEmpty) data['estimated_cost'] = double.tryParse(_estimatedCostCtl.text.trim());
    if (_deductibleCtl.text.trim().isNotEmpty) data['deductible'] = double.tryParse(_deductibleCtl.text.trim());
    if (_accClaimAmountCtl.text.trim().isNotEmpty) data['acc_claim_amount'] = double.tryParse(_accClaimAmountCtl.text.trim());
    if (_accClaimTotalAmountCtl.text.trim().isNotEmpty) data['acc_claim_total_amount'] = double.tryParse(_accClaimTotalAmountCtl.text.trim());
    return data;
  }

  Future<void> _submitSurvey() async {
    final data = _collectFormData();
    final caseProvider = context.read<CaseProvider>();
    final r = await caseProvider.submitSurveyOffline(widget.caseId, data, _photoPaths);
    if (!mounted) return;
    if (r == 'ok') {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_draftKey);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('ส่งข้อมูลสำรวจสำเร็จ'), backgroundColor: Colors.green));
      context.go('/cases');
    } else if (r == 'queued') {
      // ไม่มีสัญญาณ — เก็บคิวไว้ ระบบจะส่งอัตโนมัติเมื่อมีเน็ต (draft ยังคงไว้จนส่งได้จริง)
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('ไม่มีสัญญาณเน็ต — บันทึกไว้แล้ว ระบบจะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์'),
        backgroundColor: Colors.orange,
        duration: Duration(seconds: 4),
      ));
      context.go('/cases');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(caseProvider.error ?? 'เกิดข้อผิดพลาด'), backgroundColor: Colors.red));
    }
  }

  // ============================================================
  // UI (Claude design)
  // ============================================================
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: _topbar(),
      bottomNavigationBar: Consumer<CaseProvider>(builder: (c, cp, _) => _savebar(cp)),
      body: Consumer<CaseProvider>(
        builder: (context, caseProvider, _) {
          return Stack(
            children: [
              Column(
                children: [
                  _chipTabs(),
                  Expanded(child: _viewBody()),
                ],
              ),
              ..._overlays(caseProvider),
            ],
          );
        },
      ),
    );
  }

  // ── สลับ body ตามมุมมอง (hub / หมวด / แท็บ) ──
  Widget _viewBody() {
    switch (_view) {
      case _SView.hub:
        return _hubBody();
      case _SView.s1:
        return _sectionScroll(_card(0, Icons.verified_user_outlined, '1. เคลม & กรมธรรม์', _secClaimPolicy(), asset: 'assets/section_icons/s1.png'));
      case _SView.s2:
        return _sectionScroll(_card(2, Icons.directions_car_outlined, '2. รถประกัน', _secCar(), asset: 'assets/section_icons/s2.png'));
      case _SView.s3:
        return _sectionScroll(_card(3, Icons.person_outline, '3. ผู้ขับขี่รถประกัน', _secDriver(), asset: 'assets/section_icons/s3.png'));
      case _SView.s4:
        return _sectionScroll(_card(4, Icons.minor_crash_outlined, '4. ความเสียหาย', _secDamage(), asset: 'assets/section_icons/s4.png'));
      case _SView.s5:
        return _sectionScroll(_card(5, Icons.car_crash_outlined, '5. สถานที่เกิดเหตุ', _secEvent(), asset: 'assets/section_icons/s5.png'));
      case _SView.s6:
        return _opponentsBody();
      case _SView.photos:
        return _sectionScroll(_card(7, Icons.photo_camera_outlined, 'รูปภาพ', [_imgChecklist(), _buildPhotoGrid()]));
      case _SView.notes:
        return _sectionScroll(_card(6, Icons.sticky_note_2_outlined, 'หมายเหตุ', [_txt(_notesCtl, 'หมายเหตุเพิ่มเติม', maxLines: 3)]));
      case _SView.injured:
        return _injuredBody();
      case _SView.property:
        return _propertyBody();
      case _SView.expenses:
        return _soonBody(Icons.receipt_long_outlined, 'ค่าใช้จ่าย', 'อยู่นอกขอบเขตตอนนี้');
      case _SView.review:
        return _reviewBody();
    }
  }

  Widget _sectionScroll(Widget child) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(8, 12, 8, 24),
      child: Form(key: _formKey, child: child),
    );
  }

  Widget _soonBody(IconData icon, String title, String desc) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 64, height: 64, decoration: BoxDecoration(color: _tint, borderRadius: BorderRadius.circular(18)), child: Icon(icon, size: 30, color: _primary)),
          const SizedBox(height: 16),
          Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: _ink)),
          const SizedBox(height: 8),
          Text(desc, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13.5, color: _muted, height: 1.5)),
          const SizedBox(height: 20),
          OutlinedButton.icon(onPressed: () => _go(_SView.hub), icon: const Icon(Icons.arrow_back, size: 18), label: const Text('กลับ Hub'), style: OutlinedButton.styleFrom(foregroundColor: _primary, side: const BorderSide(color: _lineStrong))),
        ]),
      ),
    );
  }

  // ── overlays (submitting + card-image sheet) ──
  List<Widget> _overlays(CaseProvider caseProvider) {
    return [
      if (caseProvider.isSubmitting)
        Container(
          color: Colors.black26,
          child: const Center(child: Card(child: Padding(padding: EdgeInsets.all(32), child: Column(mainAxisSize: MainAxisSize.min, children: [CircularProgressIndicator(), SizedBox(height: 16), Text('กำลังส่งข้อมูล...')])))),
        ),
      if (_showImageSheet && _caseImages.isNotEmpty)
        DraggableScrollableSheet(
          initialChildSize: 0.4,
          minChildSize: 0.15,
          maxChildSize: 0.85,
          builder: (context, scrollController) {
            return Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 10, offset: const Offset(0, -2))],
              ),
              child: Column(
                children: [
                  Container(margin: const EdgeInsets.only(top: 8), width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        const Icon(Icons.credit_card, color: _primary, size: 20),
                        const SizedBox(width: 8),
                        Text('หน้าการ์ด (${_caseImages.length})', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _primary)),
                        const Spacer(),
                        IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => setState(() => _showImageSheet = false), padding: EdgeInsets.zero, constraints: const BoxConstraints()),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: ListView.builder(
                      controller: scrollController,
                      padding: const EdgeInsets.all(12),
                      itemCount: _caseImages.length,
                      itemBuilder: (context, index) {
                        final filePath = _caseImages[index]['file_path']?.toString() ?? '';
                        final imageUrl = '${ApiConfig.baseUrl}/uploads/$filePath';
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: GestureDetector(
                            onTap: () => _showCardImage(index),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                imageUrl,
                                width: double.infinity,
                                fit: BoxFit.fitWidth,
                                loadingBuilder: (context, child, progress) {
                                  if (progress == null) return child;
                                  return const SizedBox(height: 100, child: Center(child: CircularProgressIndicator()));
                                },
                                errorBuilder: (context, error, stackTrace) {
                                  return Container(height: 80, color: Colors.grey.shade200, child: const Center(child: Icon(Icons.broken_image, color: Colors.grey)));
                                },
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        ),
    ];
  }

  // ── Hub dashboard ──
  Widget _hubBody() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _timelineStrip(),
          const SizedBox(height: 16),
          _hubCard(Icons.verified_user_outlined, '1. เคลม & กรมธรรม์', _s1Summary(), _SView.s1, _s1Filled(), asset: 'assets/section_icons/s1.png'),
          _hubCard(Icons.directions_car_outlined, '2. รถประกัน', _s2Summary(), _SView.s2, _s2Filled(), asset: 'assets/section_icons/s2.png'),
          _hubCard(Icons.person_outline, '3. ผู้ขับขี่', _s3Summary(), _SView.s3, _s3Filled(), asset: 'assets/section_icons/s3.png'),
          _hubCard(Icons.minor_crash_outlined, '4. ความเสียหาย', _s4Summary(), _SView.s4, _s4Filled(), asset: 'assets/section_icons/s4.png'),
          _hubCard(Icons.car_crash_outlined, '5. สถานที่เกิดเหตุ', _s5Summary(), _SView.s5, _s5Filled(), asset: 'assets/section_icons/s5.png'),
          _hubCard(Icons.groups_2_outlined, '6. คู่กรณี', _s6Summary(), _SView.s6, _s6Filled(), asset: 'assets/section_icons/s6.png'),
        ],
      ),
    );
  }

  // ไอคอนหมวด 4-6 เป็นรูปแนวกว้าง (เตี้ย) เต็มความกว้าง canvas อยู่แล้ว
  // เลยขยายเป็น asset ไม่ได้ ต้องเรนเดอร์กล่องใหญ่ขึ้นนิดหน่อยให้ดูสมส่วนกับ 1-3
  double _iconScale(String? asset) {
    if (asset == null) return 1;
    if (asset.endsWith('s6.png')) return 1.20;
    if (asset.endsWith('s4.png')) return 1.18;
    if (asset.endsWith('s5.png')) return 1.10;
    return 0.90; // s1/s2/s3 — ลดลงนิดหน่อยให้เข้าชุดกับหมวด 4-6
  }

  Widget _hubCard(IconData icon, String title, String summary, _SView target, bool started, {bool warn = false, String? asset}) {
    final missing = _sectionMissing(target);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: _cardBg,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _go(target),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: _line),
              boxShadow: [BoxShadow(color: const Color(0xFF141E3C).withValues(alpha: 0.035), blurRadius: 20, offset: const Offset(0, 6))],
            ),
            child: Row(children: [
              Container(width: 40, height: 40, decoration: BoxDecoration(color: warn ? _warnTint : _tint, borderRadius: BorderRadius.circular(12)), child: asset != null ? Center(child: Image.asset(asset, width: 28 * _iconScale(asset), height: 28 * _iconScale(asset))) : Icon(icon, size: 21, color: warn ? _warn : _primary)),
              const SizedBox(width: 12),
              Expanded(child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: _ink))),
              const SizedBox(width: 8),
              _statusChipHub(missing, started),
              const Icon(Icons.chevron_right, color: _muted2),
            ]),
          ),
        ),
      ),
    );
  }

  // ป้ายสถานะรายหมวด: ขาด N (เหลือง) / ครบ (เขียว) / ว่าง (เทา)
  Widget _statusChipHub(List<String> missing, bool started) {
    final Color c, bg;
    final String label;
    if (missing.isNotEmpty) {
      c = _warn; bg = _warnTint; label = 'ขาด ${missing.length}';
    } else if (started) {
      c = _ok; bg = _okTint; label = 'ครบ';
    } else {
      c = _muted; bg = _fill; label = 'ว่าง';
    }
    return Container(
      margin: const EdgeInsets.only(right: 4),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(missing.isNotEmpty ? Icons.error_outline : (started ? Icons.check_circle : Icons.circle), size: 11, color: c),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: c)),
      ]),
    );
  }

  Widget _timelineStrip() {
    final nodes = <List<String>>[
      ['ลูกค้าแจ้ง', _accCustomerReportDateCtl.text.trim()],
      ['แจ้งเซอร์เวย์', _accInsNotifyDateCtl.text.trim()],
      ['ถึงที่เกิดเหตุ', _accSurveyArriveDateCtl.text.trim()],
      ['สำรวจเสร็จ', _accSurveyCompleteDateCtl.text.trim()],
    ];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(color: _cardBg, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Row(children: [Icon(Icons.timeline, size: 16, color: _primary), SizedBox(width: 6), Text('ไทม์ไลน์งาน', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _ink))]),
        const SizedBox(height: 12),
        Row(children: [
          for (final n in nodes)
            Expanded(child: Column(children: [
              Container(
                width: 26, height: 26,
                decoration: BoxDecoration(color: n[1].isNotEmpty ? _ok : _fill, shape: BoxShape.circle, border: Border.all(color: n[1].isNotEmpty ? _ok : _lineStrong, width: 1.5)),
                child: Icon(n[1].isNotEmpty ? Icons.check : Icons.circle_outlined, size: 14, color: n[1].isNotEmpty ? Colors.white : _muted2),
              ),
              const SizedBox(height: 5),
              Text(n[0], textAlign: TextAlign.center, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: _ink)),
              Text(n[1].isNotEmpty ? n[1] : '—', textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 9.5, color: _muted)),
            ])),
        ]),
      ]),
    );
  }

  // ── chip tabs (5) ──
  Widget _chipTabs() {
    final inDetail = _view != _SView.injured && _view != _SView.property && _view != _SView.photos && _view != _SView.expenses;
    String cnt(List l) => l.isNotEmpty ? ' (${l.length})' : '';
    final tabs = <List<dynamic>>[
      ['รายละเอียดเหตุ', inDetail, () => _go(_SView.hub)],
      ['ผู้บาดเจ็บ${cnt(_injured)}', _view == _SView.injured, () => _go(_SView.injured)],
      ['ทรัพย์สิน${cnt(_property)}', _view == _SView.property, () => _go(_SView.property)],
      ['รูปภาพ', _view == _SView.photos, () => _go(_SView.photos)],
      ['ค่าใช้จ่าย', _view == _SView.expenses, () => _go(_SView.expenses)],
    ];
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
      child: SizedBox(
        height: 32,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: tabs.length,
          separatorBuilder: (_, _) => const SizedBox(width: 6),
          itemBuilder: (_, i) {
            final active = tabs[i][1] as bool;
            return GestureDetector(
              onTap: tabs[i][2] as VoidCallback,
              child: Container(
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(color: active ? _primary : Colors.white, borderRadius: BorderRadius.circular(11), border: Border.all(color: active ? _primary : _line)),
                child: Text(tabs[i][0] as String, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: active ? Colors.white : _muted)),
              ),
            );
          },
        ),
      ),
    );
  }

  // ── สถานะ/สรุปรายหมวด (Hub) ──
  bool _s1Filled() => _claimType.isNotEmpty || _claimNoCtl.text.trim().isNotEmpty;
  bool _s2Filled() => _licensePlateCtl.text.trim().isNotEmpty || _carBrandCtl.text.trim().isNotEmpty;
  bool _s3Filled() => _driverNameCtl.text.trim().isNotEmpty;
  bool _s4Filled() => _damageItems.isNotEmpty;
  bool _s5Filled() => _accDateCtl.text.trim().isNotEmpty;
  bool _s6Filled() => _opponents.isNotEmpty || _opoClaims.isNotEmpty;
  int _filledCount() {
    const views = [_SView.s1, _SView.s2, _SView.s3, _SView.s4, _SView.s5, _SView.s6];
    final started = [_s1Filled(), _s2Filled(), _s3Filled(), _s4Filled(), _s5Filled(), _s6Filled()];
    var n = 0;
    for (var i = 0; i < views.length; i++) {
      if (_sectionMissing(views[i]).isEmpty && started[i]) n++;
    }
    return n;
  }

  String _s1Summary() {
    final ins = _insuranceCompanyCtl.text.trim();
    final cn = _claimNoCtl.text.trim();
    if (ins.isEmpty && cn.isEmpty && _claimType.isEmpty) return 'ยังไม่กรอกข้อมูลเคลม';
    return [if (ins.isNotEmpty) ins, if (cn.isNotEmpty) 'เคลม $cn'].join(' · ');
  }
  String _s2Summary() {
    final p = _licensePlateCtl.text.trim();
    final b = _carBrandCtl.text.trim();
    if (p.isEmpty && b.isEmpty) return 'ทะเบียน · ยี่ห้อ · รุ่น';
    return [if (p.isNotEmpty) p, if (b.isNotEmpty) b].join(' · ');
  }
  String _s3Summary() {
    final n = '${_driverNameCtl.text.trim()} ${_driverLastnameCtl.text.trim()}'.trim();
    return n.isNotEmpty ? n : 'สแกนบัตร / กรอกผู้ขับขี่';
  }
  String _s4Summary() => _damageItems.isEmpty ? 'ยังไม่มีรายการความเสียหาย' : '${_damageItems.length} รายการ';
  String _s5Summary() {
    final d = _accDateCtl.text.trim();
    final c = _accCauseCtl.text.trim();
    if (d.isEmpty && c.isEmpty) return 'วัน-เวลา · สถานที่ · สาเหตุ';
    return [if (d.isNotEmpty) d, if (c.isNotEmpty) c].join(' · ');
  }
  String _s6Summary() {
    if (_opponents.isNotEmpty) return '${_opponents.length} คัน';
    return _opoClaims.isNotEmpty ? '${_opoClaims.length} รายการเรียกร้อง' : 'ยังไม่มีคู่กรณี';
  }

  // ══ Validation (Phase 4) ══════════════════════════════════════════
  // ตำรวจจำเป็นเมื่อ: ฝ่ายประมาท="รอสรุปผลคดี" หรือ มีผู้บาดเจ็บ ≥1
  bool _policeRequired() => _accFault == 'รอสรุปผลคดี' || _injured.isNotEmpty;
  bool _driverCidValid() {
    final t = _driverIdCardCtl.text.trim();
    return t.isEmpty ? false : cidChecksum(t);
  }

  // รายการ "ที่ยังขาด" ของแต่ละหมวด (label ที่ผู้ใช้อ่านเข้าใจ)
  List<String> _sectionMissing(_SView v) {
    List<String> miss(List<List<dynamic>> checks) => [for (final c in checks) if (!(c[1] as bool)) c[0] as String];
    bool has(TextEditingController c) => c.text.trim().isNotEmpty;
    switch (v) {
      case _SView.s1:
        return miss([
          ['ประเภทเคลม', _claimType.isNotEmpty],
          ['เลขรับแจ้ง/เลขเคลม', has(_claimRefNoCtl) || has(_claimNoCtl)],
          ['เลขกรมธรรม์', has(_policyNoCtl)],
          ['ผู้เอาประกันภัย', has(_assuredNameCtl)],
        ]);
      case _SView.s2:
        return miss([
          ['ทะเบียนรถ', has(_licensePlateCtl)],
          ['จังหวัด', has(_carProvinceCtl)],
          ['ประเภทรถ', _carType != '0'],
          ['เลข กม.', has(_mileageCtl)],
        ]);
      case _SView.s3:
        return miss([
          ['ชื่อ-นามสกุลผู้ขับ', has(_driverNameCtl) && has(_driverLastnameCtl)],
          ['โทรศัพท์', has(_driverPhoneCtl)],
          ['เลขบัตรประชาชน (ถูกต้อง)', _driverCidValid()],
          ['เลขใบขับขี่', has(_driverLicenseNoCtl)],
        ]);
      case _SView.s4:
        return miss([
          ['รายการความเสียหาย ≥1', _damageItems.isNotEmpty],
        ]);
      case _SView.s5:
        final base = miss([
          ['วัน-เวลาเกิดเหตุ', has(_accDateCtl)],
          ['สถานที่เกิดเหตุ', has(_accPlaceCtl)],
          ['ลักษณะการเกิดเหตุ', has(_accCauseCtl)],
          ['รายละเอียดการเกิดเหตุ', has(_accDetailCtl)],
          ['ผู้สำรวจภัย', has(_accSurveyorCtl)],
        ]);
        if (_policeRequired()) {
          base.addAll(miss([
            ['ชื่อพนักงานสอบสวน (มีผู้บาดเจ็บ/รอคดี)', has(_accPoliceNameCtl)],
            ['สถานีตำรวจ', has(_accPoliceStationCtl)],
          ]));
        }
        return base;
      case _SView.s6:
        return const []; // คู่กรณีไม่บังคับ
      default:
        return const [];
    }
  }

  // รวม error ทุกหมวด (สำหรับ gate ตอนส่ง) — key = ชื่อหมวด
  Map<String, List<String>> _collectErrors() {
    final e = <String, List<String>>{};
    const titles = {
      _SView.s1: '1. เคลม & กรมธรรม์', _SView.s2: '2. รถประกัน', _SView.s3: '3. ผู้ขับขี่',
      _SView.s4: '4. ความเสียหาย', _SView.s5: '5. สถานที่เกิดเหตุ',
    };
    for (final entry in titles.entries) {
      final m = _sectionMissing(entry.key);
      if (m.isNotEmpty) e[entry.value] = m;
    }
    return e;
  }

  // ── หน้าตรวจสอบ & ส่ง ──
  Widget _reviewBody() {
    const sections = <List<dynamic>>[
      ['1. เคลม & กรมธรรม์', _SView.s1, Icons.verified_user_outlined],
      ['2. รถประกัน', _SView.s2, Icons.directions_car_outlined],
      ['3. ผู้ขับขี่', _SView.s3, Icons.person_outline],
      ['4. ความเสียหาย', _SView.s4, Icons.minor_crash_outlined],
      ['5. สถานที่เกิดเหตุ', _SView.s5, Icons.car_crash_outlined],
      ['6. คู่กรณี', _SView.s6, Icons.groups_2_outlined],
    ];
    final errors = _collectErrors();
    final total = errors.values.fold<int>(0, (a, b) => a + b.length);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: total == 0 ? _okTint : _warnTint, borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            Icon(total == 0 ? Icons.check_circle : Icons.warning_amber_rounded, color: total == 0 ? _ok : _warn),
            const SizedBox(width: 10),
            Expanded(child: Text(
              total == 0 ? 'ข้อมูลครบ พร้อมส่งรายงาน' : 'ยังขาด $total รายการ — แตะหมวดเพื่อไปแก้ (ส่งได้แต่ควรกรอกให้ครบ)',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: total == 0 ? _ok : _warn, height: 1.4),
            )),
          ]),
        ),
        const SizedBox(height: 14),
        for (final s in sections) _reviewRow(s[0] as String, s[1] as _SView, s[2] as IconData),
        const SizedBox(height: 6),
        _reviewMini('ผู้บาดเจ็บ', '${_injured.length} คน', Icons.healing_outlined, () => _go(_SView.injured)),
        _reviewMini('ทรัพย์สินเสียหาย', '${_property.length} ชิ้น', Icons.chair_outlined, () => _go(_SView.property)),
        _reviewMini('รูปภาพ', '${_photoPaths.length} รูป', Icons.photo_camera_outlined, () => _go(_SView.photos)),
        const SizedBox(height: 10),
        const Text('กด "ส่งรายงาน" ด้านล่างเพื่อส่งเข้าระบบ', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: _muted)),
      ]),
    );
  }

  Widget _reviewRow(String title, _SView v, IconData icon) {
    final started = {
      _SView.s1: _s1Filled(), _SView.s2: _s2Filled(), _SView.s3: _s3Filled(),
      _SView.s4: _s4Filled(), _SView.s5: _s5Filled(), _SView.s6: _s6Filled(),
    }[v]!;
    final missing = _sectionMissing(v);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: _cardBg,
        borderRadius: BorderRadius.circular(15),
        child: InkWell(
          borderRadius: BorderRadius.circular(15),
          onTap: () => _go(v),
          child: Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(15), border: Border.all(color: _line)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(icon, size: 18, color: _primary),
                const SizedBox(width: 9),
                Expanded(child: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _ink))),
                _statusChipHub(missing, started),
              ]),
              if (missing.isNotEmpty) ...[
                const SizedBox(height: 7),
                Text('ขาด: ${missing.join(", ")}', style: const TextStyle(fontSize: 11.5, color: _warn, height: 1.35)),
              ],
            ]),
          ),
        ),
      ),
    );
  }

  Widget _reviewMini(String title, String value, IconData icon, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
          decoration: BoxDecoration(color: _cardBg, borderRadius: BorderRadius.circular(13), border: Border.all(color: _line)),
          child: Row(children: [
            Icon(icon, size: 17, color: _muted),
            const SizedBox(width: 9),
            Expanded(child: Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: _ink))),
            Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: _muted)),
            const Icon(Icons.chevron_right, size: 18, color: _muted2),
          ]),
        ),
      ),
    );
  }

  // ตรวจก่อนส่ง: ถ้าขาด → เปิด error sheet; ครบ → ส่งเลย
  void _submitWithGate() {
    final errors = _collectErrors();
    if (errors.isEmpty) { _submitSurvey(); return; }
    _showErrorSheet(errors);
  }

  void _showErrorSheet(Map<String, List<String>> errors) {
    final total = errors.values.fold<int>(0, (a, b) => a + b.length);
    const titleToView = {
      '1. เคลม & กรมธรรม์': _SView.s1, '2. รถประกัน': _SView.s2, '3. ผู้ขับขี่': _SView.s3,
      '4. ความเสียหาย': _SView.s4, '5. สถานที่เกิดเหตุ': _SView.s5,
    };
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        expand: false,
        builder: (ctx, scroll) => Column(children: [
          const SizedBox(height: 8),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: _lineStrong, borderRadius: BorderRadius.circular(2))),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(children: [
              const Icon(Icons.warning_amber_rounded, color: _warn),
              const SizedBox(width: 8),
              Expanded(child: Text('พบ $total รายการที่ยังไม่ครบ', style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: _ink))),
            ]),
          ),
          Expanded(
            child: ListView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              children: [
                for (final entry in errors.entries) ...[
                  GestureDetector(
                    onTap: () { Navigator.pop(ctx); final v = titleToView[entry.key]; if (v != null) _go(v); },
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: _warnTint, borderRadius: BorderRadius.circular(12)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text(entry.key, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: _warn))),
                          const Icon(Icons.arrow_forward, size: 16, color: _warn),
                        ]),
                        const SizedBox(height: 4),
                        Text('• ${entry.value.join("\n• ")}', style: const TextStyle(fontSize: 12, color: _warn, height: 1.5)),
                      ]),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 4, 16, 12 + MediaQuery.of(ctx).padding.bottom),
            child: Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: OutlinedButton.styleFrom(foregroundColor: _primary, side: const BorderSide(color: _lineStrong), padding: const EdgeInsets.symmetric(vertical: 13), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13))),
                  child: const Text('กลับไปแก้', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () { Navigator.pop(ctx); _submitSurvey(); },
                  style: ElevatedButton.styleFrom(backgroundColor: _warn, foregroundColor: Colors.white, elevation: 0, padding: const EdgeInsets.symmetric(vertical: 13), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13))),
                  child: const Text('ส่งทั้งที่ยังไม่ครบ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  // ── เนื้อหารายหมวด (reuse ฟิลด์เดิมทั้งหมด) ──
  List<Widget> _secClaimPolicy() => [
        _insurerLockField(),
        _fieldLabel('ประเภทเคลม', req: true),
        _claimTypeChips(),
        _fieldLabel('ระดับความเสียหาย', req: true),
        Row(children: [
          _chip('หนัก', _damageLevel == 'หนัก', () => setState(() => _damageLevel = 'หนัก'), grow: true),
          const SizedBox(width: 10),
          _chip('เบา', _damageLevel == 'เบา', () => setState(() => _damageLevel = 'เบา'), grow: true),
        ]),
        _txt(_claimRefNoCtl, 'เลขที่รับแจ้ง'),
        _txt(_claimNoCtl, 'เลขที่เคลม', onChanged: (_) => setState(() {})),
        _txt(_surveyJobNoCtl, 'เลขเรื่องเซอร์เวย์'),
        _subhead('กรมธรรม์'),
        _txt(_policyNoCtl, 'เลขกรมธรรม์', req: true),
        _switchRow('มี พรบ.', _hasPrb, (v) => setState(() { _hasPrb = v; if (!v) _prbNumberCtl.clear(); })),
        if (_hasPrb) _txt(_prbNumberCtl, 'เลข พรบ.', req: true),
        _row2(_dateField(_policyStartCtl, 'วันเริ่มคุ้มครอง', yearsAhead: 1), _dateField(_policyEndCtl, 'วันสิ้นสุด', yearsAhead: 6)),
        _txt(_assuredNameCtl, 'ผู้เอาประกันภัย', req: true),
        _txt(_driverByPolicyCtl, 'ชื่อผู้ขับขี่ตามกรมธรรม์'),
        _row2(_policyTypeField(), _txt(_riskCodeCtl, 'รหัสภัยยานยนต์')),
        _txt(_assuredEmailCtl, 'อีเมลผู้เอาประกัน', keyboardType: TextInputType.emailAddress),
        _numField(_deductibleCtl, 'ค่าเสียหายส่วนแรก', decimal: true),
      ];

  // ประเภทประกัน = dropdown (POL_TYPES) + คงค่าเดิมถ้าไม่อยู่ในลิสต์
  Widget _policyTypeField() {
    const base = ['ชั้น 1', 'ชั้น 2+', 'ชั้น 2', 'ชั้น 3+', 'ชั้น 3', 'พรบ.', 'ไม่พบความคุ้มครอง'];
    final cur = _policyTypeCtl.text.trim();
    final items = [...base, if (cur.isNotEmpty && !base.contains(cur)) cur];
    return _dd('ประเภทประกัน', cur, items, (v) => setState(() => _policyTypeCtl.text = v ?? ''), req: true, key: ValueKey('pt_$cur'));
  }

  List<Widget> _secCar() => [
        _row2(
          _txt(_licensePlateCtl, 'ทะเบียน', req: true),
          _dd('จังหวัด', _carProvinceCtl.text, _provinceNames,
              (v) => setState(() => _carProvinceCtl.text = v ?? ''),
              hint: 'เลือกจังหวัด', req: true, key: ValueKey('cp_${_carProvinceCtl.text}')),
        ),
        _carTypeField(),
        _row2(_carBrandField(), _txt(_carModelCtl, 'รุ่น')),
        _row2(_carColorField(), _txt(_carRegYearCtl, 'ปีจดทะเบียน (พ.ศ.)')),
        _evTypeField(),
        if (_evType.isNotEmpty) ...[
          _row2(_txt(_evBatteryNoCtl, 'หมายเลขแบตเตอรี่'), _txt(_evChargerNoCtl, 'หมายเลขเครื่องชาร์จ')),
          _dateField(_evBatteryStartCtl, 'วันเริ่มใช้งานแบตเตอรี่', yearsAhead: 0),
        ],
        _txt(_chassisNoCtl, 'หมายเลขตัวถัง (VIN)'),
        _row2(_txt(_engineNoCtl, 'หมายเลขเครื่อง'), _txt(_modelNoCtl, 'หมายเลข Model')),
        _numField(_mileageCtl, 'หมายเลข กม.', req: true),
      ];

  // ประเภทรถ = dropdown (ตัวเลือก + ค่าตาม ddlCType จริง)
  Widget _carTypeField() {
    const labels = {'0': '-- ระบุ --', 'A': 'เก๋งเอเชีย', 'E': 'เก๋งยุโรป', 'M': 'รถจักรยานยนต์', 'O': 'รถอื่นๆ', 'T': 'กระบะ', 'V': 'รถตู้', 'W': 'รถบรรทุก'};
    return DropdownButtonFormField<String>(
      initialValue: labels.containsKey(_carType) ? _carType : '0',
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec('ประเภทรถ', req: true),
      // ยังไม่เลือก ('0') → โชว์ "-- ระบุ --" สีเทาจางแบบ placeholder (บังคับกรอก)
      selectedItemBuilder: (context) => labels.entries
          .map((e) => Align(alignment: Alignment.centerLeft, child: Text(e.value, style: TextStyle(fontSize: e.key == '0' ? 13 : 15, color: e.key == '0' ? _muted2 : _ink))))
          .toList(),
      items: labels.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value, style: const TextStyle(fontSize: 14.5)))).toList(),
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      onChanged: (v) => setState(() => _carType = v ?? '0'),
    );
  }

  // รถยนต์ไฟฟ้า (EV) = dropdown
  Widget _evTypeField() {
    // '' = ยังไม่ระบุ (โชว์ placeholder เทาจาง) ; เก็บ null = ไม่ใช่ EV เหมือนเดิม
    const labels = {'': '-- ระบุ --', 'BEV': 'BEV (100%)', 'HEV': 'HEV', 'PHEV': 'PHEV', 'FCEV': 'FCEV', 'MEV': 'MEV ดัดแปลง'};
    return DropdownButtonFormField<String>(
      initialValue: labels.containsKey(_evType) ? _evType : '',
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec('รถยนต์ไฟฟ้า (EV)'),
      selectedItemBuilder: (context) => labels.entries
          .map((e) => Align(alignment: Alignment.centerLeft, child: Text(e.value, style: TextStyle(fontSize: e.key.isEmpty ? 13 : 15, color: e.key.isEmpty ? _muted2 : _ink))))
          .toList(),
      items: labels.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value, style: const TextStyle(fontSize: 14.5)))).toList(),
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      onChanged: (v) => setState(() => _evType = v ?? ''),
    );
  }

  // ยี่ห้อ = dropdown (คงค่าเดิมถ้าไม่อยู่ในลิสต์)
  Widget _carBrandField() {
    const base = ['โตโยต้า', 'ฮอนด้า', 'อีซูซุ', 'นิสสัน', 'มิตซูบิชิ', 'มาสด้า', 'ฟอร์ด', 'เชฟโรเลต', 'เอ็มจี', 'ซูซูกิ', 'ฮุนได', 'เกีย', 'บีเอ็มดับเบิลยู', 'เมอร์เซเดส-เบนซ์', 'ยามาฮ่า', 'เวสป้า', 'อื่นๆ'];
    final cur = _carBrandCtl.text.trim();
    final items = [...base, if (cur.isNotEmpty && !base.contains(cur)) cur];
    return _dd('ยี่ห้อ', cur, items, (v) => setState(() => _carBrandCtl.text = v ?? ''), hint: 'เลือกยี่ห้อ', req: true, key: ValueKey('cb_$cur'));
  }

  // สีรถ = dropdown
  Widget _carColorField() {
    const base = ['ขาว', 'ดำ', 'เทา', 'เงิน', 'บรอนซ์', 'แดง', 'น้ำเงิน', 'ฟ้า', 'เขียว', 'เหลือง', 'ส้ม', 'น้ำตาล', 'ทอง', 'ม่วง', 'ชมพู', 'หลายสี', 'อื่นๆ'];
    final cur = _carColorCtl.text.trim();
    final items = [...base, if (cur.isNotEmpty && !base.contains(cur)) cur];
    return _dd('สีรถ', cur, items, (v) => setState(() => _carColorCtl.text = v ?? ''), hint: 'เลือกสี', key: ValueKey('cc_$cur'));
  }

  List<Widget> _secDriver() => [
        _scanRow(),
        // เพศ (ปุ่ม) | คำนำหน้า — แถวเดียวกัน, dropdown แคบลง
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(flex: 6, child: _genderChips()),
          const SizedBox(width: 12),
          Expanded(flex: 5, child: _titleDropdown()),
        ]),
        _row2(_txt(_driverNameCtl, 'ชื่อ', req: true), _txt(_driverLastnameCtl, 'นามสกุล', req: true)),
        _relationDropdown(),
        // วันเกิด | อายุ
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(flex: 5, child: _birthdateField()),
          const SizedBox(width: 10),
          Expanded(flex: 3, child: _numField(_driverAgeCtl, 'อายุ', req: true)),
        ]),
        _txt(_driverPhoneCtl, 'โทรศัพท์', keyboardType: TextInputType.phone, req: true),
        _driverCidField(),
        _txt(_driverAddressCtl, 'ที่อยู่ปัจจุบัน', req: true),
        _dd('จังหวัด', _driverProvinceCtl.text, _provinceNames,
            (v) => setState(() { _driverProvinceCtl.text = v ?? ''; _driverDistrictCtl.text = ''; }),
            hint: 'เลือกจังหวัด', req: true, key: ValueKey('dp_${_driverProvinceCtl.text}')),
        _districtDropdown(),
        _row2(_txt(_driverLicenseNoCtl, 'ใบอนุญาตขับขี่เลขที่', req: true), _txt(_driverLicensePlaceCtl, 'ออกให้ที่')),
        _licenseTypeDropdown(),
        _row2(_dateField(_driverLicenseStartCtl, 'ออกให้วันที่', yearsAhead: 0), _dateField(_driverLicenseEndCtl, 'หมดอายุวันที่', yearsAhead: 10)),
      ];

  List<Widget> _secDamage() => [
        CarDamageDiagram(items: _damageItems, onTapPart: _onTapDiagramPart),
        _damageList(),
        _damageDescField(),
        _numField(_estimatedCostCtl, 'ค่าเสียหายประมาณ (บาท)', decimal: true),
      ];

  List<Widget> _secEvent() => [
        _dateTime(_accDateCtl, _accTimeCtl, 'วันที่เกิดเหตุ', req: true),
        _txt(_accPlaceCtl, 'สถานที่เกิดเหตุ', req: true),
        _row2(_txt(_accProvinceCtl, 'จังหวัด'), _txt(_accDistrictCtl, 'เขต/อำเภอ')),
        _dd('ลักษณะการเกิดเหตุ', _accCauseCtl.text, _accCauseOptions,
            (v) => setState(() => _accCauseCtl.text = v ?? ''), req: true, key: ValueKey('ac_${_accCauseCtl.text}')),
        _dd('ลักษณะความเสียหาย', _accDamageTypeCtl.text, _accDamageOptions,
            (v) => setState(() => _accDamageTypeCtl.text = v ?? ''), key: ValueKey('ad_${_accDamageTypeCtl.text}')),
        _txt(_accDetailCtl, 'รายละเอียดการเกิดเหตุ', maxLines: 5, req: true),
        _faultDropdown(),
        _txt(_accReporterCtl, 'ผู้แจ้ง'),
        _txt(_accSurveyorCtl, 'ผู้สำรวจภัย', req: true),
        _row2(_txt(_accSurveyorBranchCtl, 'สาขา'), _txt(_accSurveyorPhoneCtl, 'โทรศัพท์สำรวจ', keyboardType: TextInputType.phone)),
        _dateTime(_accCustomerReportDateCtl, _accCustomerReportTimeCtl, 'วันที่ลูกค้าแจ้ง บ.ประกัน'),
        _dateTime(_accInsNotifyDateCtl, _accInsNotifyTimeCtl, 'วันที่ บ.ประกันแจ้งสำรวจ'),
        _dateTime(_accSurveyArriveDateCtl, _accSurveyArriveTimeCtl, 'วันที่ถึงที่เกิดเหตุ'),
        _dateTime(_accSurveyCompleteDateCtl, _accSurveyCompleteTimeCtl, 'วันที่สำรวจเสร็จ'),
        _opoClaimChecks(),
        _row2(_numField(_accClaimAmountCtl, 'รับเงินจำนวน (บาท)', decimal: true),
            _numField(_accClaimTotalAmountCtl, 'จากจำนวนเรียกร้องทั้งหมด (บาท)', decimal: true)),
        _switchRow(_policeRequired() ? 'มีการแจ้งความ / ลงประจำวัน (จำเป็น)' : 'มีการแจ้งความ / ลงประจำวัน',
            _hasPolice || _policeRequired(), (v) => setState(() => _hasPolice = v)),
        if (_hasPolice || _policeRequired()) ...[
          _subhead('ตำรวจ'),
          _row2(_txt(_accPoliceNameCtl, 'ชื่อพนักงานสอบสวน', req: true), _txt(_accPoliceStationCtl, 'สถานีตำรวจ', req: true)),
          _txt(_accPoliceCommentCtl, 'ความเห็นพนักงานสอบสวน'),
          _row2(_dateField(_accPoliceDateCtl, 'วันที่ (ตำรวจ)'), _txt(_accPoliceBookNoCtl, 'ประจำวันข้อที่')),
          _txt(_accAlcoholTestCtl, 'ผลการตรวจแอลกอฮอล์'),
        ],
        _subhead('การติดตามงาน'),
        _followupDropdown(),
        _txt(_accFollowupCountCtl, 'ครั้งที่นัดหมาย'),
        _txt(_accFollowupDetailCtl, 'รายละเอียดการนัดหมาย'),
        _dateField(_accFollowupDateCtl, 'วันที่นัดหมาย'),
      ];

  // ฝ่ายประมาท — dropdown (โชว์ป้ายเต็ม, เก็บค่าเดิมแบบสั้น)
  Widget _faultDropdown() {
    const opts = <String, String>{
      'ฝ่ายผิด': 'รถประกันฝ่ายผิด',
      'ฝ่ายถูกและผิด': 'ฝ่ายถูกและผิด',
      'คู่กรณีผิด': 'คู่กรณีผิด',
      'ประมาทร่วม': 'ประมาทร่วม',
      'รอสรุปผลคดี': 'รอสรุปผลคดี',
      'ยกเลิกการเคลม': 'ยกเลิกการเคลม',
      'ไปถึงแล้วไม่พบ': 'ไปถึงแล้วไม่พบ',
    };
    final keys = opts.keys.toList();
    return DropdownButtonFormField<String>(
      key: ValueKey('fault_$_accFault'),
      initialValue: keys.contains(_accFault) ? _accFault : null,
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec('ฝ่ายประมาท'),
      // ไม่บังคับ → ไม่มี placeholder (ว่างเปล่าเมื่อยังไม่เลือก)
      items: keys.map((k) => DropdownMenuItem(value: k, child: Text(opts[k]!, style: const TextStyle(fontSize: 14.5), overflow: TextOverflow.ellipsis))).toList(),
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      onChanged: (v) => setState(() => _accFault = v ?? _accFault),
    );
  }

  void _snack(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m), duration: const Duration(seconds: 2)));

  // ── list view ทั่วไปของข้อมูลหลายรายการ (คู่กรณี/ผู้บาดเจ็บ/ทรัพย์สิน) ──
  Widget _recordListScroll({
    required IconData icon,
    required String title,
    required List<Map<String, dynamic>> items,
    required String emptyHint,
    required String addLabel,
    required VoidCallback onAdd,
    required String Function(Map<String, dynamic> m, int i) lineTitle,
    required String Function(Map<String, dynamic> m) lineSub,
    required void Function(int) onTap,
    required void Function(int) onDelete,
    List<Widget> footer = const [],
    String? asset,
  }) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(color: _tint, borderRadius: BorderRadius.circular(11)), child: asset != null ? Center(child: Image.asset(asset, width: 24 * _iconScale(asset), height: 24 * _iconScale(asset))) : Icon(icon, size: 19, color: _primary)),
          const SizedBox(width: 10),
          Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _ink))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: items.isEmpty ? _fill : _okTint, borderRadius: BorderRadius.circular(999)),
            child: Text('${items.length} รายการ', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: items.isEmpty ? _muted : _ok)),
          ),
        ]),
        const SizedBox(height: 12),
        if (items.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 16),
            decoration: BoxDecoration(color: _cardBg, borderRadius: BorderRadius.circular(16), border: Border.all(color: _line)),
            child: Center(child: Text(emptyHint, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: _muted))),
          ),
        for (int i = 0; i < items.length; i++) _recordCard(lineTitle(items[i], i), lineSub(items[i]), () => onTap(i), () => onDelete(i)),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add, size: 18),
            label: Text(addLabel, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            style: OutlinedButton.styleFrom(foregroundColor: _primary, backgroundColor: _tint, side: BorderSide.none, padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13))),
          ),
        ),
        ...footer,
      ]),
    );
  }

  Widget _recordCard(String title, String sub, VoidCallback onTap, VoidCallback onDelete) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: _cardBg,
        borderRadius: BorderRadius.circular(15),
        child: InkWell(
          borderRadius: BorderRadius.circular(15),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(15), border: Border.all(color: _line)),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: _ink)),
                const SizedBox(height: 2),
                Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: _muted)),
              ])),
              IconButton(icon: Icon(Icons.delete_outline, size: 20, color: Colors.red.shade400), onPressed: onDelete),
              const Icon(Icons.chevron_right, color: _muted2),
            ]),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmDelete(String what, VoidCallback onYes) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('ลบ$what?'),
        content: Text('ต้องการลบ$whatนี้หรือไม่'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('ยกเลิก')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('ลบ', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (ok == true) { onYes(); _autosave(); }
  }

  // ── คู่กรณี ──
  Widget _opponentsBody() => _recordListScroll(
        icon: Icons.groups_2_outlined,
        asset: 'assets/section_icons/s6.png',
        title: '6. คู่กรณี (${_opponents.length}/20)',
        items: _opponents,
        emptyHint: 'ยังไม่มีคู่กรณีในเคสนี้\nกด "เพิ่มคู่กรณี" เพื่อเริ่ม',
        addLabel: 'เพิ่มคู่กรณี',
        onAdd: _addOpponent,
        onTap: _editOpponent,
        onDelete: (i) => _confirmDelete('คู่กรณีคันที่ ${i + 1}', () => setState(() => _opponents.removeAt(i))),
        lineTitle: (m, i) => 'คันที่ ${i + 1}${(m['plate'] ?? '').toString().trim().isNotEmpty ? ' · ${m['plate']}' : ''}',
        lineSub: (m) {
          final owner = (m['owner_name'] ?? '').toString().trim();
          final ins = (m['insurer'] ?? '').toString().trim();
          return [if (owner.isNotEmpty) owner, ins.isNotEmpty ? ins : 'ไม่ระบุประกัน'].join(' · ');
        },
      );

  Future<void> _addOpponent() async {
    if (_opponents.length >= 20) { _snack('เพิ่มคู่กรณีได้สูงสุด 20 คัน'); return; }
    final res = await Navigator.of(context).push<Map>(MaterialPageRoute(
        builder: (_) => OpponentEditor(data: const {}, provinces: _provinceNames, number: _opponents.length + 1, isNew: true, onScan: _captureRetainOcr)));
    if (!mounted || res == null || res['action'] != 'save') return;
    setState(() => _opponents.add(Map<String, dynamic>.from(res['data'] as Map)));
    _autosave();
  }

  Future<void> _editOpponent(int i) async {
    final res = await Navigator.of(context).push<Map>(MaterialPageRoute(
        builder: (_) => OpponentEditor(data: _opponents[i], provinces: _provinceNames, number: i + 1, onScan: _captureRetainOcr)));
    if (!mounted || res == null) return;
    setState(() {
      if (res['action'] == 'save') {
        _opponents[i] = Map<String, dynamic>.from(res['data'] as Map);
      } else if (res['action'] == 'delete') {
        _opponents.removeAt(i);
      }
    });
    _autosave();
  }

  // ── ผู้บาดเจ็บ ──
  Widget _injuredBody() => _recordListScroll(
        icon: Icons.healing_outlined,
        title: 'ผู้บาดเจ็บ',
        items: _injured,
        emptyHint: 'ยังไม่มีผู้บาดเจ็บ\nกด "เพิ่มผู้บาดเจ็บ" หากมี',
        addLabel: 'เพิ่มผู้บาดเจ็บ',
        onAdd: _addInjured,
        onTap: _editInjured,
        onDelete: (i) => _confirmDelete('ผู้บาดเจ็บคนที่ ${i + 1}', () => setState(() => _injured.removeAt(i))),
        lineTitle: (m, i) => '${i + 1}. ${(m['name'] ?? '').toString().trim().isNotEmpty ? m['name'] : 'ไม่ระบุชื่อ'}',
        lineSub: (m) {
          final t = (m['person_type'] ?? '').toString().trim();
          final w = (m['wound_level'] ?? '').toString().trim();
          return [if (t.isNotEmpty) t, if (w.isNotEmpty) w].join(' · ');
        },
      );

  Future<void> _addInjured() async {
    final res = await Navigator.of(context).push<Map>(MaterialPageRoute(
        builder: (_) => InjuredEditor(data: const {}, provinces: _provinceNames, number: _injured.length + 1, isNew: true, onScan: _captureRetainOcr)));
    if (!mounted || res == null || res['action'] != 'save') return;
    setState(() => _injured.add(Map<String, dynamic>.from(res['data'] as Map)));
    _autosave();
  }

  Future<void> _editInjured(int i) async {
    final res = await Navigator.of(context).push<Map>(MaterialPageRoute(
        builder: (_) => InjuredEditor(data: _injured[i], provinces: _provinceNames, number: i + 1, onScan: _captureRetainOcr)));
    if (!mounted || res == null) return;
    setState(() {
      if (res['action'] == 'save') {
        _injured[i] = Map<String, dynamic>.from(res['data'] as Map);
      } else if (res['action'] == 'delete') {
        _injured.removeAt(i);
      }
    });
    _autosave();
  }

  // ── ทรัพย์สิน ──
  Widget _propertyBody() => _recordListScroll(
        icon: Icons.chair_outlined,
        title: 'ทรัพย์สินเสียหาย',
        items: _property,
        emptyHint: 'ยังไม่มีทรัพย์สินเสียหาย\nกด "เพิ่มทรัพย์สิน" หากมี',
        addLabel: 'เพิ่มทรัพย์สิน',
        onAdd: _addProperty,
        onTap: _editProperty,
        onDelete: (i) => _confirmDelete('ทรัพย์สินชิ้นที่ ${i + 1}', () => setState(() => _property.removeAt(i))),
        lineTitle: (m, i) => '${i + 1}. ${(m['item'] ?? '').toString().trim().isNotEmpty ? m['item'] : 'ไม่ระบุ'}',
        lineSub: (m) {
          final o = (m['owner_name'] ?? '').toString().trim();
          final c = (m['estimated_cost'] ?? '').toString().trim();
          return [if (o.isNotEmpty) o, if (c.isNotEmpty) '฿$c'].join(' · ');
        },
      );

  Future<void> _addProperty() async {
    final res = await Navigator.of(context).push<Map>(MaterialPageRoute(
        builder: (_) => PropertyEditor(data: const {}, number: _property.length + 1, isNew: true)));
    if (!mounted || res == null || res['action'] != 'save') return;
    setState(() => _property.add(Map<String, dynamic>.from(res['data'] as Map)));
    _autosave();
  }

  Future<void> _editProperty(int i) async {
    final res = await Navigator.of(context).push<Map>(MaterialPageRoute(
        builder: (_) => PropertyEditor(data: _property[i], number: i + 1)));
    if (!mounted || res == null) return;
    setState(() {
      if (res['action'] == 'save') {
        _property[i] = Map<String, dynamic>.from(res['data'] as Map);
      } else if (res['action'] == 'delete') {
        _property.removeAt(i);
      }
    });
    _autosave();
  }

  // ชื่อบริษัทประกันแบบย่อ — ตัด "บริษัท" นำหน้า และ "จำกัด (มหาชน)" ท้าย
  String get _shortInsurer {
    var s = _insuranceCompanyCtl.text.trim();
    s = s.replaceFirst(RegExp(r'^บริษัท\s*'), '');
    s = s.replaceFirst(RegExp(r'\s*จำกัด.*$'), '');
    return s.trim();
  }

  // ปุ่มประเภทเคลม — เหลี่ยม + label บรรทัดเดียว (FittedBox ย่อพอดี)
  Widget _claimTypeChips() {
    const opts = [['เคลมสด', 'F'], ['เคลมแห้ง', 'D'], ['นัดหมาย', 'A'], ['ติดตาม', 'C']];
    return Row(children: [
      for (var i = 0; i < opts.length; i++) ...[
        if (i > 0) const SizedBox(width: 6),
        Expanded(
          child: GestureDetector(
            onTap: () => setState(() => _claimType = opts[i][1]),
            child: Container(
              height: 42,
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: _claimType == opts[i][1] ? _primary : Colors.white,
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: _claimType == opts[i][1] ? _primary : _lineStrong, width: 1.5),
              ),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(opts[i][0], maxLines: 1, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _claimType == opts[i][1] ? Colors.white : _muted)),
              ),
            ),
          ),
        ),
      ],
    ]);
  }

  // ── ป้ายบริษัทประกัน (ล็อกจากงานที่ได้รับ) ──
  Widget _insurerLockField() {
    final name = _shortInsurer;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: BoxDecoration(color: _fill, borderRadius: BorderRadius.circular(13), border: Border.all(color: _line)),
      child: Row(children: [
        const Icon(Icons.lock_outline, size: 16, color: _muted),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('บริษัทประกัน', style: TextStyle(fontSize: 11, color: _muted, fontWeight: FontWeight.w500)),
          Text(name.isNotEmpty ? name : 'กำหนดจากงานที่ได้รับ', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _ink)),
        ])),
      ]),
    );
  }

  Widget _subhead(String t) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 2),
        child: Row(children: [
          Text(t, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: _muted)),
          const SizedBox(width: 8),
          Expanded(child: Container(height: 1, color: _line)),
        ]),
      );

  // ช่องเลขบัตร ปชช ผู้ขับ + ตรวจ checksum แสดงไอคอน ✓/⚠
  Widget _driverCidField() {
    final digits = _driverIdCardCtl.text.replaceAll(RegExp(r'\D'), '');
    final ok = digits.length == 13 && cidChecksum(_driverIdCardCtl.text);
    return TextFormField(
      controller: _driverIdCardCtl,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec('บัตรประชาชนเลขที่', req: true, suffixIcon: digits.length == 13 ? Icon(ok ? Icons.check_circle : Icons.error_outline, size: 18, color: ok ? _ok : _warn) : null),
      keyboardType: TextInputType.number,
      onChanged: (_) => setState(() {}),
    );
  }

  // รวมวันที่+เวลา เป็น "dd/mm/yyyy|HH:mm" (ตรงกับที่หน้าเว็บ checker อ่าน)
  String _combineDT(TextEditingController d, TextEditingController t) {
    final ds = d.text.trim();
    final ts = t.text.trim();
    if (ds.isEmpty) return '';
    return ts.isEmpty ? ds : '$ds|$ts';
  }

  Widget _dateTime(TextEditingController d, TextEditingController t, String label, {bool req = false}) {
    // label 2 อันอยู่แถวเดียว, ช่อง input อยู่แถวถัดไปให้ตรงกัน (วัน + เวลา แถวเดียวกัน)
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: _fieldLabel(label, req: req)),
          const SizedBox(width: 8),
          SizedBox(width: 118, child: _fieldLabel('เวลา')),
        ]),
        const SizedBox(height: 4),
        Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          Expanded(child: _dateField(d, label, req: req, yearsAhead: 1, showLabel: false)),
          const SizedBox(width: 8),
          _TimeField(t, key: ValueKey('tm_${identityHashCode(t)}'), showLabel: false),
        ]),
      ]),
    );
  }

  // การเรียกร้องค่าเสียหายจากคู่กรณี — 5 ตัวเลือก (ตรงกับหน้าเว็บ checker)
  Widget _opoClaimChecks() {
    const opts = {
      'คัดประจำวัน': 'คัดประจำวัน',
      'รับหลักฐานจากคู่กรณีผิด': 'รับหลักฐานจากคู่กรณีผิด',
      'บันทึกยอมรับผิด': 'บันทึกยอมรับผิด',
      'บัตรติดต่อ': 'บัตรติดต่อ',
      'รับเงิน': 'รับเงินจำนวน',
    };
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _fieldLabel('การเรียกร้องค่าเสียหายจากคู่กรณี'),
      for (final e in opts.entries)
        GestureDetector(
          onTap: () => setState(() => _opoClaims.contains(e.key) ? _opoClaims.remove(e.key) : _opoClaims.add(e.key)),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(children: [
              Icon(_opoClaims.contains(e.key) ? Icons.check_box : Icons.check_box_outline_blank, color: _opoClaims.contains(e.key) ? _primary : _muted2, size: 22),
              const SizedBox(width: 8),
              Expanded(child: Text(e.value, style: const TextStyle(fontSize: 13.5, color: _ink))),
            ]),
          ),
        ),
    ]);
  }

  // ปุ่ม capture (สแกน/GPS) เต็มความกว้าง มีสถานะ busy

  // ── topbar (sticky header: เลขเคลม + สถานะ; มีปุ่มย้อนกลับเมื่ออยู่ในหมวด) ──
  PreferredSizeWidget _topbar() {
    final claimNo = _claimNoCtl.text.trim();
    final inSection = _view != _SView.hub;
    return AppBar(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      foregroundColor: _ink,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      titleSpacing: inSection ? 0 : 16,
      leading: inSection
          ? IconButton(icon: const Icon(Icons.arrow_back, color: _ink), tooltip: 'กลับ Hub', onPressed: () => _go(_SView.hub))
          : null,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('งานสำรวจ', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: _ink)),
          if (claimNo.isNotEmpty)
            Text('เคลม #$claimNo', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: _muted)),
        ],
      ),
      actions: [
        _slaChip(),
        if (_caseImages.isNotEmpty)
          IconButton(
            tooltip: 'หน้าการ์ด',
            onPressed: () => setState(() => _showImageSheet = !_showImageSheet),
            icon: Icon(_showImageSheet ? Icons.close : Icons.badge_outlined, color: _primary),
          ),
        Padding(padding: const EdgeInsets.only(right: 12, left: 2), child: _statusChip()),
      ],
      bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: _line)),
    );
  }

  // ป้าย SLA 24 ชม. (เฉพาะเคลมสด + มีเวลาลูกค้าแจ้ง) — ซ่อนถ้าไม่มีข้อมูลเวลา
  Widget _slaChip() {
    if (_claimType != 'F' || _slaStart == null) return const SizedBox.shrink();
    final remain = _slaStart!.add(const Duration(hours: 24)).difference(DateTime.now());
    final over = remain.isNegative;
    final hrs = remain.inMinutes.abs() / 60.0;
    final label = over ? 'เกิน SLA' : 'เหลือ ${hrs.toStringAsFixed(hrs < 10 ? 1 : 0)} ชม.';
    final Color c, bg;
    if (over) { c = const Color(0xFFDC2626); bg = const Color(0xFFFDECEC); }
    else if (remain.inHours < 6) { c = _warn; bg = _warnTint; }
    else { c = _ok; bg = _okTint; }
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.timer_outlined, size: 13, color: c),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: c)),
        ]),
      ),
    );
  }

  Widget _statusChip() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(color: _okTint, borderRadius: BorderRadius.circular(999)),
      child: const Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.circle, size: 8, color: _ok),
        SizedBox(width: 6),
        Text('กำลังสำรวจ', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: _ok)),
      ]),
    );
  }

  // ── bottom bar: ความคืบหน้า N/6 + ปุ่มหลัก (hub=ส่ง / หมวด=กลับ Hub) + บันทึกร่าง ──
  Widget _savebar(CaseProvider cp) {
    final inHub = _view == _SView.hub;
    final inReview = _view == _SView.review;
    final n = _filledCount();
    return Container(
      padding: EdgeInsets.fromLTRB(10, 8, 10, 10 + MediaQuery.of(context).padding.bottom),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: _line))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          Text('ครบ $n/6 หมวด', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _muted)),
          const SizedBox(width: 10),
          Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(999), child: LinearProgressIndicator(value: n / 6, minHeight: 6, backgroundColor: _line, color: _ok))),
          if (_savedAt != null) ...[
            const SizedBox(width: 10),
            const Icon(Icons.check_circle, size: 13, color: _ok),
            const SizedBox(width: 3),
            Text('บันทึก $_savedAt', style: const TextStyle(fontSize: 10.5, color: _muted)),
          ],
        ]),
        const SizedBox(height: 8),
        _savebarButtons(cp, inHub, inReview),
      ]),
    );
  }

  // ปุ่มแถวล่าง — มี autosave แล้วจึงตัดปุ่มบันทึกออก
  //  hub/review → ปุ่มหลักเต็มแถว | หมวดหลัก → [Hub ไอคอน] [ก่อนหน้า] [ถัดไป/ตรวจสอบ] | หน้าเสริม → กลับ Hub
  Widget _savebarButtons(CaseProvider cp, bool inHub, bool inReview) {
    ButtonStyle primaryStyle() => ElevatedButton.styleFrom(
          backgroundColor: _primary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        );
    ButtonStyle outlinedStyle() => OutlinedButton.styleFrom(
          foregroundColor: _primary,
          side: const BorderSide(color: _lineStrong),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        );

    if (inHub || inReview) {
      return SizedBox(
        height: 50,
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: cp.isSubmitting ? null : (inReview ? _submitWithGate : () => _go(_SView.review)),
          icon: cp.isSubmitting
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
              : Icon(inReview ? Icons.send_rounded : Icons.fact_check_outlined, size: 20),
          label: Text(inReview ? 'ส่งรายงาน' : 'ตรวจสอบ & ส่ง', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          style: primaryStyle(),
        ),
      );
    }

    final prev = _prevSectionView();
    final next = _nextSectionView();

    // หน้าเสริม (ไม่อยู่ในลำดับหมวด) → ปุ่มกลับ Hub เต็มแถว
    if (prev == null && next == null) {
      return SizedBox(
        height: 50,
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: () => _go(_SView.hub),
          icon: const Icon(Icons.arrow_back, size: 19),
          label: const Text('กลับ Hub', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          style: outlinedStyle(),
        ),
      );
    }

    // ปุ่มขวา: มีถัดไป → "ถัดไป: X" | หมวดสุดท้าย → "ตรวจสอบ & ส่ง"
    final forwardBtn = SizedBox(
      height: 50,
      child: ElevatedButton.icon(
        onPressed: () => _go(next ?? _SView.review),
        icon: Icon(next != null ? Icons.arrow_forward_rounded : Icons.fact_check_outlined, size: 19),
        label: Text(next != null ? 'ถัดไป: ${_sectionShortTitle(next)}' : 'ตรวจสอบ & ส่ง',
            maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
        style: primaryStyle(),
      ),
    );

    return Row(children: [
      SizedBox(
        width: 50,
        height: 50,
        child: OutlinedButton(
          onPressed: () => _go(_SView.hub),
          style: OutlinedButton.styleFrom(
            foregroundColor: _primary,
            side: const BorderSide(color: _lineStrong),
            padding: EdgeInsets.zero,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: const Icon(Icons.grid_view_rounded, size: 20),
        ),
      ),
      const SizedBox(width: 8),
      if (prev != null) ...[
        SizedBox(
          width: 50,
          height: 50,
          child: OutlinedButton(
            onPressed: () => _go(prev),
            style: OutlinedButton.styleFrom(
              foregroundColor: _primary,
              side: const BorderSide(color: _lineStrong),
              padding: EdgeInsets.zero,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: const Icon(Icons.arrow_back_rounded, size: 20),
          ),
        ),
        const SizedBox(width: 8),
      ],
      Expanded(child: forwardBtn),
    ]);
  }

  // ── card (section) ──
  Widget _card(int idx, IconData icon, String title, List<Widget> children, {bool warn = false, String? asset}) {
    return Container(
      key: _secKeys[idx],
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 14),
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _line),
        boxShadow: [BoxShadow(color: const Color(0xFF141E3C).withValues(alpha: 0.035), blurRadius: 24, offset: const Offset(0, 8))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(0, 13, 0, 12),
            margin: const EdgeInsets.only(bottom: 14),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: _line))),
            child: Row(children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(color: warn ? _warnTint : _tint, borderRadius: BorderRadius.circular(10)),
                child: asset != null ? Center(child: Image.asset(asset, width: 22 * _iconScale(asset), height: 22 * _iconScale(asset))) : Icon(icon, size: 18, color: warn ? _warn : _primary),
              ),
              const SizedBox(width: 11),
              Expanded(child: Text(title, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, color: _ink))),
            ]),
          ),
          ..._withGaps(children),
        ],
      ),
    );
  }

  List<Widget> _withGaps(List<Widget> items) {
    final out = <Widget>[];
    for (var i = 0; i < items.length; i++) {
      out.add(items[i]);
      if (i < items.length - 1) out.add(const SizedBox(height: 14));
    }
    return out;
  }

  Widget _fieldLabel(String text, {bool req = false}) => Padding(
        padding: const EdgeInsets.only(top: 2, bottom: 2),
        child: Text.rich(
          TextSpan(text: text, children: req ? const [TextSpan(text: ' ●', style: TextStyle(color: Color(0xFFDC2626)))] : const []),
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _ink),
        ),
      );

  Widget _row2(Widget a, Widget b) =>
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: a), const SizedBox(width: 10), Expanded(child: b)]);

  // ── filled, floating-label decoration (req=true → จุดแดง ● ท้าย label) ──
  InputDecoration _dec(String label, {Widget? suffixIcon, String? hint, bool req = false, bool showLabel = true}) {
    OutlineInputBorder b(Color c) => OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: BorderSide(color: c, width: 1.5));
    const labelStyle = TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: _muted);
    return InputDecoration(
      label: (showLabel && req)
          ? Text.rich(TextSpan(text: label, children: const [TextSpan(text: ' ●', style: TextStyle(color: Color(0xFFDC2626)))]), style: labelStyle)
          : null,
      labelText: (showLabel && !req) ? label : null,
      hintText: hint,
      floatingLabelBehavior: FloatingLabelBehavior.always,
      labelStyle: labelStyle,
      hintStyle: const TextStyle(fontSize: 13, color: _muted2),
      filled: true,
      fillColor: _fill,
      isDense: true,
      contentPadding: const EdgeInsets.fromLTRB(13, 10, 13, 10),
      suffixIcon: suffixIcon,
      suffixIconConstraints: const BoxConstraints(minWidth: 36, minHeight: 36),
      border: b(Colors.transparent),
      enabledBorder: b(Colors.transparent),
      focusedBorder: b(_primary),
    );
  }

  Widget _txt(TextEditingController ctl, String label, {TextInputType? keyboardType, int maxLines = 1, ValueChanged<String>? onChanged, bool req = false}) {
    return TextFormField(
      controller: ctl,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec(label, req: req),
      keyboardType: keyboardType,
      maxLines: maxLines,
      textInputAction: maxLines == 1 ? TextInputAction.next : TextInputAction.newline,
      onChanged: onChanged,
    );
  }

  Widget _numField(TextEditingController ctl, String label, {bool decimal = false, bool req = false}) {
    return TextFormField(
      controller: ctl,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec(label, req: req),
      keyboardType: TextInputType.numberWithOptions(decimal: decimal),
      inputFormatters: decimal ? [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))] : [FilteringTextInputFormatter.digitsOnly],
      textInputAction: TextInputAction.next,
    );
  }

  // ── ช่องวันที่: แตะเปิด date picker พ.ศ. + ไอคอนปฏิทิน (req → จุดแดง) ──
  Widget _dateField(TextEditingController ctl, String label, {bool req = false, int defaultYearsAgo = 0, int yearsAhead = 5, bool showLabel = true}) {
    return GestureDetector(
      onTap: () => _showBuddhistDatePicker(ctl, title: label, defaultYearsAgo: defaultYearsAgo, yearsAhead: yearsAhead),
      child: AbsorbPointer(
        child: TextFormField(
          controller: ctl,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
          decoration: _dec(label, req: req, showLabel: showLabel, hint: req ? 'วว/ดด/ปปปป' : null, suffixIcon: const Icon(Icons.calendar_month_outlined, size: 18, color: _muted)),
        ),
      ),
    );
  }

  // แถวสวิตช์ (progressive disclosure — เปิดแล้วโผล่ช่องเพิ่ม)
  Widget _switchRow(String label, bool value, ValueChanged<bool> onChanged) {
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 2, 8, 2),
      decoration: BoxDecoration(color: _fill, borderRadius: BorderRadius.circular(13), border: Border.all(color: _line)),
      child: Row(children: [
        Expanded(child: Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _ink))),
        Switch(value: value, activeThumbColor: _primary, onChanged: onChanged),
      ]),
    );
  }

  // ── pill chip ──
  Widget _chip(String label, bool selected, VoidCallback onTap, {bool grow = false}) {
    final chip = GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 130),
        // grow chips share row width equally → tighter h-padding so labels fit on one line
        padding: EdgeInsets.symmetric(horizontal: grow ? 8 : 16, vertical: 9),
        // only the full-width (grow) chips center their label; pills size to content
        alignment: grow ? Alignment.center : null,
        decoration: BoxDecoration(
          color: selected ? _primary : Colors.white,
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: selected ? _primary : _lineStrong, width: 1.5),
        ),
        child: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: selected ? Colors.white : _muted)),
      ),
    );
    return grow ? Expanded(child: chip) : chip;
  }

  // ── generic string dropdown (filled style) ──
  Widget _dd(String label, String? value, List<String> items, ValueChanged<String?> onChanged, {String hint = '-- ระบุ --', Key? key, bool req = false}) {
    final v = (value != null && value.isNotEmpty && items.contains(value)) ? value : null;
    return DropdownButtonFormField<String>(
      key: key,
      initialValue: v,
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec(label, req: req),
      hint: req ? Text(hint, style: const TextStyle(fontSize: 13, color: _muted2)) : null,
      items: [
        // ตัวเลือกบนสุด = ล้างค่ากลับเป็น placeholder (dropdown ไม่งั้นล้างค่าเองไม่ได้)
        DropdownMenuItem(value: '', child: Text(hint, style: const TextStyle(fontSize: 14.5, color: _muted2))),
        ...items.map((e) => DropdownMenuItem(value: e, child: Text(e, style: const TextStyle(fontSize: 14.5), overflow: TextOverflow.ellipsis))),
      ],
      // ปล่อย focus ของช่องข้อความที่ค้างอยู่ก่อนเปิดเมนู → พอเลือกเสร็จเมนูปิด จะไม่เด้ง focus/คีย์บอร์ดกลับช่องเดิม
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      onChanged: onChanged,
    );
  }

  // การติดตามงาน — display label ไม่เท่ากับค่าที่เก็บ (ค่าแรกเก็บ 'ไม่มีการนัดหมาย')
  Widget _followupDropdown() {
    const stored = ['ไม่มีการนัดหมาย', 'รอการนัดหมาย', 'มีการนัดหมาย'];
    return DropdownButtonFormField<String>(
      initialValue: stored.contains(_accFollowup) ? _accFollowup : 'ไม่มีการนัดหมาย',
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec('การติดตามงาน'),
      items: const [
        DropdownMenuItem(value: 'ไม่มีการนัดหมาย', child: Text('ไม่มีนัดหมาย', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'รอการนัดหมาย', child: Text('รอการนัดหมาย', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'มีการนัดหมาย', child: Text('มีการนัดหมาย', style: TextStyle(fontSize: 14.5))),
      ],
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      onChanged: (v) => setState(() => _accFollowup = v ?? 'ไม่มีการนัดหมาย'),
    );
  }

  // เพศ — ปุ่มเลือก ชาย/หญิง แบบเหลี่ยม (เก็บค่าเป็น M/F) สูง 48 เท่า dropdown คำนำหน้า → อยู่แถวเดียวกันพอดี
  Widget _genderChips() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel('เพศ', req: true),
          const SizedBox(height: 6),
          Row(children: [
            _genderBtn('ชาย', 'M'),
            const SizedBox(width: 8),
            _genderBtn('หญิง', 'F'),
          ]),
        ],
      );

  Widget _genderBtn(String label, String code) {
    final sel = _driverGender == code;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          _driverGender = code;
          if (_driverTitle == '0' || _driverTitle.isEmpty) {
            _driverTitle = code == 'M' ? 'นาย' : 'นางสาว';
          }
        }),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 130),
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: sel ? _primary : Colors.white,
            borderRadius: BorderRadius.circular(11),
            border: Border.all(color: sel ? _primary : _lineStrong, width: 1.5),
          ),
          child: Text(label, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: sel ? Colors.white : _muted)),
        ),
      ),
    );
  }

  // คำนำหน้า — label ภายนอก + dropdown เตี้ย (สูง 48) ให้อยู่แถวเดียว/ตรงกับปุ่มเพศ และแคบลง
  Widget _titleDropdown() {
    const items = ['0', 'นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.', 'คุณ'];
    const labels = {'0': '-- ระบุ --', 'นาย': 'นาย', 'นาง': 'นาง', 'นางสาว': 'นางสาว', 'ด.ช.': 'ด.ช.', 'ด.ญ.': 'ด.ญ.', 'คุณ': 'คุณ'};
    OutlineInputBorder b(Color c) => OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: BorderSide(color: c, width: 1.5));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _fieldLabel('คำนำหน้า', req: true),
        const SizedBox(height: 6),
        SizedBox(
          height: 48,
          child: DropdownButtonFormField<String>(
            key: ValueKey('title_$_driverTitle'),
            initialValue: items.contains(_driverTitle) ? _driverTitle : '0',
            isExpanded: true,
            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w500, color: _ink),
            decoration: InputDecoration(
              filled: true,
              fillColor: _fill,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
              border: b(Colors.transparent),
              enabledBorder: b(Colors.transparent),
              focusedBorder: b(_primary),
            ),
            // ยังไม่เลือก ('0') → "-- ระบุ --" สีเทาจางแบบ placeholder (บังคับกรอก)
            selectedItemBuilder: (context) => items.map((e) => Align(alignment: Alignment.centerLeft, child: Text(labels[e]!, style: TextStyle(fontSize: 14.5, color: e == '0' ? _muted2 : _ink), overflow: TextOverflow.ellipsis))).toList(),
            items: items.map((e) => DropdownMenuItem(value: e, child: Text(labels[e]!, style: const TextStyle(fontSize: 14.5), overflow: TextOverflow.ellipsis))).toList(),
            onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
            onChanged: (v) => setState(() => _driverTitle = v ?? '0'),
          ),
        ),
      ],
    );
  }

  Widget _birthdateField() => _dateField(_driverBirthdateCtl, 'วันเกิด', req: true, defaultYearsAgo: 25, yearsAhead: 0);

  Widget _relationDropdown() {
    const rel = [
      'สามี', 'ภรรยา', 'บุตร', 'บิดา', 'มารดา',
      'นายจ้าง', 'ลูกจ้าง', 'ผู้เช่า', 'พี่ชาย', 'พี่สาว',
      'น้องชาย', 'น้องสาว', 'เจ้าของรถ', 'หลาน', 'อา', 'น้า', 'ลุง', 'ป้า',
      'ญาติ', 'เพื่อน', 'แฟน', 'พนักงาน', 'พี่เขย', 'น้องเขย',
      'พี่สะใภ้', 'น้องสะใภ้', 'พนักงานผู้เช่า', 'ลุงเขย', 'น้าเขย',
      'น้าสะใภ้', 'อาเขย', 'อาสะใภ้', 'หุ้นส่วน', 'บุตรหุ้นส่วน',
      'เจ้าของบริษัท', 'เพื่อนบุตรเจ้าของรถ', 'บุตรเขย', 'หลานเขย', 'บุตรสะใภ้',
    ];
    return _dd('ความสัมพันธ์', _driverRelationCtl.text, rel,
        (v) => setState(() => _driverRelationCtl.text = v ?? ''),
        req: true, key: ValueKey('rel_${_driverRelationCtl.text}'));
  }

  Widget _districtDropdown() {
    final districts = (_driverProvinceCtl.text.isNotEmpty && _provincesData.containsKey(_driverProvinceCtl.text))
        ? _provincesData[_driverProvinceCtl.text]!
        : <String>[];
    return _dd('เขต/อำเภอ', _driverDistrictCtl.text, districts,
        (v) => setState(() => _driverDistrictCtl.text = v ?? ''),
        hint: 'เลือกเขต/อำเภอ', key: ValueKey('dd_${_driverProvinceCtl.text}_${_driverDistrictCtl.text}'));
  }

  Widget _licenseTypeDropdown() {
    const types = [
      'ใบขับขี่รถยนต์ส่วนบุคคลตลอดชีพ',
      'ใบขับขี่รถจักรยานยนต์ส่วนบุคคลตลอดชีพ',
      'ใบขับขี่รถยนต์ส่วนบุคคลชั่วคราว',
      'ใบขับขี่รถจักรยานยนต์ส่วนบุคคลชั่วคราว',
      'ใบขับขี่รถยนต์ส่วนบุคคล 5 ปีต่ออายุ',
      'ใบขับขี่รถยนต์สาธารณะ',
      'ใบขับขี่สากล',
      'ใบขับขี่รถยนต์ส่วนบุคคลหนึ่งปีต่ออายุ',
      'ใบขับขี่รถจักรยานยนต์ส่วนบุคคลหนึ่งปี',
      'ใบขับขี่รถยนต์ส่วนบุคคล 7 ปีต่ออายุ',
      'ใบขับขี่รถยนต์ส่วนบุคคล',
      'ใบขับขี่รถจักรยานยนต์ส่วนบุคคล',
      'ใบขับขี่ขนส่งชนิดที่1',
      'ใบขับขี่ขนส่งชนิดที่2',
      'ใบขับขี่ขนส่งชนิดที่3',
      'ใบอนุญาติขับขี่ชนิดที่4',
      'ไม่มีใบขับขี่',
      'ใบขับขี่รถยนต์สามล้อส่วนบุคคลสาธารณะ',
      'ใบขับขี่รถยนต์สามล้อส่วนบุคคลชั่วคราว',
      'ใบอนุญาตเป็นผู้ขับรถทุกประเภท',
      'อื่นๆ',
    ];
    return _dd('ประเภท', _driverLicenseTypeCtl.text, types,
        (v) => setState(() => _driverLicenseTypeCtl.text = v ?? ''),
        key: ValueKey('lt_${_driverLicenseTypeCtl.text}'));
  }

  Widget _scanRow() {
    Widget btn(IconData icon, String label, VoidCallback? onTap) => OutlinedButton.icon(
          onPressed: onTap,
          icon: Icon(icon, size: 18),
          label: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          style: OutlinedButton.styleFrom(
            foregroundColor: _primary,
            backgroundColor: _tint,
            side: BorderSide.none,
            padding: const EdgeInsets.symmetric(vertical: 13),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
          ),
        );
    return Row(children: [
      Expanded(child: btn(Icons.credit_card, 'สแกนบัตรประชาชน', _ocrBusy ? null : () => _scanDriverDoc('idcard'))),
      const SizedBox(width: 10),
      Expanded(child: btn(Icons.badge_outlined, 'สแกนใบขับขี่', _ocrBusy ? null : () => _scanDriverDoc('license'))),
    ]);
  }

  // ── damage list (collapsible) ──
  Widget _damageList() {
    return Container(
      decoration: BoxDecoration(color: _fill, borderRadius: BorderRadius.circular(13), border: Border.all(color: _line)),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          key: ValueKey('damage_expanded_$_damageExpanded'),
          initiallyExpanded: _damageExpanded || _damageItems.isNotEmpty,
          onExpansionChanged: (v) => _damageExpanded = v,
          tilePadding: const EdgeInsets.symmetric(horizontal: 13),
          childrenPadding: const EdgeInsets.fromLTRB(13, 0, 13, 13),
          leading: const Icon(Icons.build_circle_outlined, color: _primary, size: 20),
          title: Text('รายการชิ้นส่วนเสียหาย (${_damageItems.length})', style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: _primary)),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            GestureDetector(
              onTap: _addDamageItem,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(color: _tint, borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.add, size: 20, color: _primary),
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.expand_more, color: _muted),
          ]),
          children: [
            if (_damageItems.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Text('กด + เพื่อเพิ่มรายการชิ้นส่วนที่เสียหาย', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ),
            for (int i = 0; i < _damageItems.length; i++) ...[
              if (i > 0) const Divider(color: _line, height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('ชิ้นส่วนที่ ${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _primary)),
                  GestureDetector(
                    onTap: () => _removeDamageItem(i),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(color: Colors.red.shade50, shape: BoxShape.circle),
                      child: Icon(Icons.close, size: 14, color: Colors.red.shade700),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              TextFormField(
                key: ValueKey('damage_part_$i'),
                initialValue: _damageItems[i]['part'],
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: _ink),
                decoration: InputDecoration(
                  hintText: 'ชิ้นส่วน เช่น กันชนหน้า, ประตูหน้า',
                  hintStyle: const TextStyle(fontSize: 13, color: _muted2),
                  filled: true,
                  fillColor: Colors.white,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _line)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _line)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _primary, width: 1.5)),
                ),
                onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
                onChanged: (v) => _updateDamageItem(i, 'part', v),
              ),
              const SizedBox(height: 8),
              Row(children: [
                const Text('ตำแหน่ง ', style: TextStyle(fontSize: 11, color: _muted)),
                ...['L', 'R', 'A'].map((pos) {
                  const labels = {'L': 'ซ้าย', 'R': 'ขวา', 'A': 'ทั้งหมด'};
                  final selected = _damageItems[i]['pos'] == pos;
                  return Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: GestureDetector(
                      onTap: () => _updateDamageItem(i, 'pos', selected ? '' : pos),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(color: selected ? _primary : Colors.white, borderRadius: BorderRadius.circular(11), border: Border.all(color: selected ? _primary : _lineStrong)),
                        child: Text(labels[pos]!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: selected ? Colors.white : _muted)),
                      ),
                    ),
                  );
                }),
              ]),
              const SizedBox(height: 6),
              Row(children: [
                const Text('ระดับ ', style: TextStyle(fontSize: 11, color: _muted)),
                ...['L', 'M', 'H', 'X'].map((lv) {
                  const labels = {'L': 'ต่ำ', 'M': 'กลาง', 'H': 'สูง', 'X': 'สูงมาก'};
                  const colors = {'L': Colors.lightGreen, 'M': Colors.orange, 'H': Colors.red, 'X': Colors.purple};
                  final selected = _damageItems[i]['level'] == lv;
                  return Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: GestureDetector(
                      onTap: () => _updateDamageItem(i, 'level', selected ? '' : lv),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(color: selected ? colors[lv] : Colors.white, borderRadius: BorderRadius.circular(11), border: Border.all(color: selected ? colors[lv]! : _lineStrong)),
                        child: Text(labels[lv]!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: selected ? Colors.white : colors[lv])),
                      ),
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

  Widget _damageDescField() {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 130),
      child: Scrollbar(
        thumbVisibility: true,
        child: TextFormField(
          controller: _damageDescCtl,
          style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w500, color: _ink),
          decoration: _dec('รายละเอียดความเสียหาย'),
          maxLines: null,
          readOnly: _damageItems.isNotEmpty,
        ),
      ),
    );
  }

  Widget _buildPhotoGrid() {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 10, mainAxisSpacing: 10),
      itemCount: _photoPaths.length + 1,
      itemBuilder: (context, index) {
        if (index == _photoPaths.length) {
          return InkWell(
            onTap: _takePhoto,
            borderRadius: BorderRadius.circular(13),
            child: Container(
              decoration: BoxDecoration(color: _fill, border: Border.all(color: _lineStrong), borderRadius: BorderRadius.circular(13)),
              child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.photo_camera_outlined, size: 28, color: _muted),
                SizedBox(height: 4),
                Text('ถ่ายรูป', style: TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w500)),
              ]),
            ),
          );
        }
        return Stack(children: [
          ClipRRect(borderRadius: BorderRadius.circular(13), child: Image.file(File(_photoPaths[index]), fit: BoxFit.cover, width: double.infinity, height: double.infinity)),
          Positioned(
            top: 4, right: 4,
            child: GestureDetector(
              onTap: () => _removePhoto(index),
              child: Container(padding: const EdgeInsets.all(3), decoration: BoxDecoration(color: _ink, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)), child: const Icon(Icons.close, size: 14, color: Colors.white)),
            ),
          ),
          Positioned(
            bottom: 4, left: 4, right: 4,
            child: GestureDetector(
              onTap: () => _changePhotoCat(index),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: _ink.withValues(alpha: 0.72), borderRadius: BorderRadius.circular(6)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Flexible(child: Text(_photoCat[_photoPaths[index]] ?? 'รถประกัน', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.w600))),
                  const Icon(Icons.arrow_drop_down, size: 13, color: Colors.white),
                ]),
              ),
            ),
          ),
        ]);
      },
    );
  }

  static const _accCauseOptions = [
    'ชนท้ายคู่กรณี', 'ชนคนบาดเจ็บ/เสียชีวิต', 'ชนรถคู่กรณีมีการบาดเจ็บ/เสียชีวิต',
    'ชน/เสียหลักหมุน/พลิกคว่ำ/ตกข้างทางมีผู้บาดเจ็บ/เสียชีวิต',
    'ชนทรัพย์สินคู่กรณี', 'ชนคู่กรณีในช่องทางสวน', 'ชนคู่กรณีและถูกชน',
    'ถอยชนคู่กรณี', 'เฉี่ยว/เบียดคู่กรณี', 'เปิดประตูชนรถคู่กรณี',
    'ชนคู่กรณี/หรือถูกชนและไม่ทราบคู่กรณี', 'เลี้ยว/กลับรถ/เปลี่ยนช่องทางชนคู่กรณี',
    'ชนรถคู่กรณีไม่คุ้มครองรถประกัน', 'ชนวัสดุ/สิ่งของ เช่น เสา,กำแพง,ประตู ฯลฯ',
    'ชนฟุตบาท', 'ชนทรัพย์สินตนเอง', 'ชนสัตว์',
    'ทรัพย์สินหล่นใส่คู่กรณี', 'ผู้โดยสารตกรถ',
    'เกี่ยวสายไฟฟ้า/โทรศัพท์/สายน้ำมัน', 'เสียหลักล้ม',
    'ฝากระโปรงหน้าเปิด', 'ยางระเบิด', 'ตกหลุม',
    'ถูกน้ำมันเบรครด', 'ประมาทร่วม', 'ต่างฝ่ายต่างซ่อม',
    'ช่วยเหลือมนุษยธรรม', 'รอคู่กรณีติดต่อ', 'รอตรวจสอบใบขับขี่',
    'แก๊สระเบิด', 'คู่กรณีชนท้าย', 'คู่กรณีชนแล้วหลบหนี',
    'คู่กรณีเฉี่ยวชน', 'คู่กรณีเฉี่ยวชนบุคคลในรถประกันบาดเจ็บ/เสียชีวิต',
    'ชนสัตว์และเรียกร้องเจ้าของ', 'คู่กรณีเปิดประตูชนรถประกัน',
    'คู่กรณีถอยชน', 'คู่กรณีชน/ทรัพย์สินผู้เอาประกันเดียวกัน',
    'คู่กรณีกลั่นแกล้ง', 'ทรัพย์สินคู่กรณีหล่นใส่',
    'เด็กปั๊มประมาทลืมปลดสายน้ำมัน',
    'ความเสียหายของรถประกันที่เกิดจากเหตุภายนอก',
    'รถหายโดยการฉ้อฉล ตามสัญญาประกันภัย',
    'ไฟไหม้จากเหตุภายนอก', 'ถูกก้อนหิน', 'ถูกขูดขีด/กลั่นแกล้ง',
    'วัตถุหล่นใส่', 'รถหายตามสัญญาเช่าซื้อ', 'รถหายโดยการโจรกรรม',
    'ไฟไหม้โดยระบบของตัวรถยนต์', 'ไฟไหม้ที่เกิดจากการชน',
    'น้ำท่วม', 'ภัยธรรมชาติอื่น ๆ', 'ลักทรัพย์อุปกรณ์/ส่วนควบ',
    'ภัยอื่น ๆ', 'ภัยก่อการร้าย',
    'ไม่พบรถประกัน', 'ไม่พบรถคู่กรณี', 'ไม่พบรถประกัน/คู่กรณี',
    'รอผลคดี', 'รอตรวจสอบกรมธรรม์', 'รอเซ็นเคลม',
    'รอรายงานอุบัติเหตุ', 'รอรถประกันติดต่อ',
    'เคลมซ้ำ', 'เปิดเคลมผิดพลาด',
    'ฉ้อฉลจากการชน', 'รถหายโดยการฉ้อฉล',
    'ไฟไหม้โดยการฉ้อฉล', 'การยึดรถ (A.P.HONDA)',
    'เสียหายขณะจอดอยู่', 'กระจกบังลมหน้าแตก', 'กระจกอื่นๆ แตก',
    'รถประกันชนรถคู่กรณีไม่เอาความ', 'สูญเสียการควบคุม',
    'หนูกัดสายไฟ', 'การเสียชีวิตอ้นเกิดจากสาเหตุอื่นๆ',
    'การเสียชีวิตอันเกิดจากการใช้รถ',
  ];

  static const _accDamageOptions = [
    'เคลมแห้ง', 'กระจกแตก', 'กระจกอื่น ๆ แตก', 'ชนคู่กรณีเสียหาย',
    'ถูกคู่กรณีชน', 'ตกถนน', 'พลิกคว่ำ', 'รถประกันไฟไหม้',
    'เฉี่ยวชนวัสดุ', 'ถูกขูดขีดกลั่นแกล้ง', 'ถูกลักอุปกรณ์ส่วนควบ',
    'วัสดุหล่นใส่', 'ยางระเบิด', 'จอดไว้ถูกชนไม่ทราบคู่กรณี',
    'หนูกัดสายไฟ', 'รถหาย', 'น้ำท่วมเสียหาย',
    'ชนคนบาดเจ็บ', 'ผู้โดยสารประกันตกรถ', 'เสียหายทั้งหมด',
  ];
}

// ช่องเวลา: 2 กล่อง (ชม. : นาที) เก็บค่ารวมเป็น "HH:mm" ใน controller เดียว (target)
class _TimeField extends StatefulWidget {
  final TextEditingController target;
  final bool showLabel;
  const _TimeField(this.target, {super.key, this.showLabel = true});
  @override
  State<_TimeField> createState() => _TimeFieldState();
}

class _TimeFieldState extends State<_TimeField> {
  late final TextEditingController _hh;
  late final TextEditingController _mm;

  @override
  void initState() {
    super.initState();
    final p = widget.target.text.split(':');
    _hh = TextEditingController(text: p.isNotEmpty && p[0].trim().isNotEmpty ? p[0].trim() : '');
    _mm = TextEditingController(text: p.length > 1 && p[1].trim().isNotEmpty ? p[1].trim() : '');
  }

  @override
  void dispose() {
    _hh.dispose();
    _mm.dispose();
    super.dispose();
  }

  void _sync() {
    final h = _hh.text.trim();
    final m = _mm.text.trim();
    widget.target.text = (h.isEmpty && m.isEmpty) ? '' : '$h:$m';
  }

  Widget _box(TextEditingController c, String hint) {
    OutlineInputBorder b(Color col) => OutlineInputBorder(borderRadius: BorderRadius.circular(11), borderSide: BorderSide(color: col, width: 1.5));
    return SizedBox(
      width: 50,
      child: TextField(
        controller: c,
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        maxLength: 2,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _ink),
        onChanged: (_) => _sync(),
        decoration: InputDecoration(
          counterText: '',
          hintText: hint,
          hintStyle: const TextStyle(fontSize: 13, color: _muted2),
          filled: true,
          fillColor: _fill,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
          border: b(Colors.transparent),
          enabledBorder: b(Colors.transparent),
          focusedBorder: b(_primary),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final boxes = Row(mainAxisSize: MainAxisSize.min, children: [
      _box(_hh, 'ชม.'),
      const Padding(
        padding: EdgeInsets.symmetric(horizontal: 4),
        child: Text(':', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: _muted)),
      ),
      _box(_mm, 'นาที'),
    ]);
    if (!widget.showLabel) return boxes;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 2, bottom: 2),
          child: Text('เวลา', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _ink)),
        ),
        const SizedBox(height: 6),
        boxes,
      ],
    );
  }
}
