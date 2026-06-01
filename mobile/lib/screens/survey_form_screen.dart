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

class SurveyFormScreen extends StatefulWidget {
  final int caseId;
  const SurveyFormScreen({super.key, required this.caseId});

  @override
  State<SurveyFormScreen> createState() => _SurveyFormScreenState();
}

class _SurveyFormScreenState extends State<SurveyFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final List<String> _photoPaths = [];
  List<String> _provinceNames = [];
  Map<String, List<String>> _provincesData = {};
  List<Map<String, dynamic>> _caseImages = [];
  bool _showImageSheet = false;
  // keys for the section-nav (progress) strip
  final List<GlobalKey> _secKeys = List.generate(8, (_) => GlobalKey());

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

  void _showBuddhistDatePicker() {
    final now = DateTime.now();
    final thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    int selDay = now.day;
    int selMonth = now.month;
    int selYear = now.year + 543 - 25;

    final existing = _driverBirthdateCtl.text.trim();
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
                      const Text('เลือกวันเกิด', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      TextButton(
                        onPressed: () {
                          final formatted = '${selDay.toString().padLeft(2, '0')}/${selMonth.toString().padLeft(2, '0')}/$selYear';
                          setState(() { _driverBirthdateCtl.text = formatted; });
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
      _accCustomerReportDateCtl: 'acc_customer_report_date', _accInsNotifyDateCtl: 'acc_insurance_notify_date',
      _accSurveyArriveDateCtl: 'acc_survey_arrive_date', _accSurveyCompleteDateCtl: 'acc_survey_complete_date',
      _accClaimOpponentCtl: 'acc_claim_opponent', _accClaimAmountCtl: 'acc_claim_amount',
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
  final _accInsNotifyDateCtl = TextEditingController();
  final _accSurveyArriveDateCtl = TextEditingController();
  final _accSurveyCompleteDateCtl = TextEditingController();
  final _accClaimOpponentCtl = TextEditingController();
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
      _driverNameCtl, _driverLastnameCtl, _driverAgeCtl, _driverBirthdateCtl,
      _driverPhoneCtl, _driverAddressCtl, _driverIdCardCtl, _driverLicenseNoCtl,
      _driverLicenseTypeCtl, _driverLicensePlaceCtl, _driverLicenseStartCtl, _driverLicenseEndCtl,
      _driverRelationCtl, _driverProvinceCtl, _driverDistrictCtl,
      _damageDescCtl, _estimatedCostCtl,
      _accDateCtl, _accTimeCtl, _accPlaceCtl, _accProvinceCtl, _accDistrictCtl,
      _accCauseCtl, _accDamageTypeCtl, _accDetailCtl, _accReporterCtl, _accSurveyorCtl,
      _accCustomerReportDateCtl, _accInsNotifyDateCtl, _accSurveyArriveDateCtl, _accSurveyCompleteDateCtl,
      _accClaimOpponentCtl, _accClaimAmountCtl, _accClaimTotalAmountCtl,
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
              itemBuilder: (context, index) => InteractiveViewer(child: Image.network(urls[index], fit: BoxFit.contain)),
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
      setState(() => _photoPaths.add(localPath));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('ไม่สามารถเปิดกล้องได้')));
    }
  }

  void _removePhoto(int index) => setState(() => _photoPaths.removeAt(index));

  String get _draftKey => 'survey_draft_${widget.caseId}';

  Future<void> _saveDraft() async {
    final data = _collectFormData();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_draftKey, jsonEncode(data));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('บันทึกร่างสำเร็จ'),
        backgroundColor: Colors.green,
        duration: Duration(seconds: 1),
      ));
    }
  }

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
      'acc_customer_report_date': _accCustomerReportDateCtl.text.trim(),
      'acc_insurance_notify_date': _accInsNotifyDateCtl.text.trim(),
      'acc_survey_arrive_date': _accSurveyArriveDateCtl.text.trim(),
      'acc_survey_complete_date': _accSurveyCompleteDateCtl.text.trim(),
      'acc_claim_opponent': _accClaimOpponentCtl.text.trim(),
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
    final success = await caseProvider.submitSurvey(widget.caseId, data, _photoPaths);
    if (success) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_draftKey);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('ส่งข้อมูลสำรวจสำเร็จ'), backgroundColor: Colors.green));
      context.go('/cases');
    } else if (mounted) {
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
              SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _progressStrip(),
                      const SizedBox(height: 12),

                      // ── 1. ข้อมูลเคลม ──
                      _card(0, Icons.verified_user_outlined, 'ข้อมูลเคลม', [
                        _fieldLabel('ประเภทเคลม'),
                        Row(children: [
                          _chip('เคลมสด', _claimType == 'F', () => setState(() => _claimType = 'F'), grow: true),
                          const SizedBox(width: 6),
                          _chip('เคลมแห้ง', _claimType == 'D', () => setState(() => _claimType = 'D'), grow: true),
                          const SizedBox(width: 6),
                          _chip('นัดหมาย', _claimType == 'A', () => setState(() => _claimType = 'A'), grow: true),
                          const SizedBox(width: 6),
                          _chip('ติดตาม', _claimType == 'C', () => setState(() => _claimType = 'C'), grow: true),
                        ]),
                        _fieldLabel('ระดับความเสียหาย'),
                        Row(children: [
                          _chip('หนัก', _damageLevel == 'หนัก', () => setState(() => _damageLevel = 'หนัก'), grow: true),
                          const SizedBox(width: 10),
                          _chip('เบา', _damageLevel == 'เบา', () => setState(() => _damageLevel = 'เบา'), grow: true),
                        ]),
                        _txt(_claimRefNoCtl, 'เลขที่รับแจ้ง'),
                        _txt(_claimNoCtl, 'เลขที่เคลม', onChanged: (_) => setState(() {})),
                        _txt(_surveyJobNoCtl, 'เลขเรื่องเซอร์เวย์'),
                      ]),

                      // ── 2. กรมธรรม์ ──
                      _card(1, Icons.description_outlined, 'ข้อมูลกรมธรรม์', [
                        _txt(_policyNoCtl, 'เลขกรมธรรม์'),
                        _txt(_prbNumberCtl, 'เลข พรบ.'),
                        _txt(_driverByPolicyCtl, 'ชื่อผู้ขับขี่ตามกรมธรรม์'),
                        _row2(_txt(_policyStartCtl, 'วันที่เริ่มต้น'), _txt(_policyEndCtl, 'วันที่สิ้นสุด')),
                        _txt(_assuredNameCtl, 'ผู้เอาประกันภัย'),
                        _row2(_txt(_policyTypeCtl, 'ประเภทประกัน'), _txt(_riskCodeCtl, 'รหัสภัยยานยนต์')),
                        _txt(_assuredEmailCtl, 'อีเมลผู้เอาประกัน', keyboardType: TextInputType.emailAddress),
                        _numField(_deductibleCtl, 'ค่าเสียหายส่วนแรก', decimal: true),
                      ]),

                      // ── 3. รายละเอียดรถยนต์ ──
                      _card(2, Icons.directions_car_outlined, 'รายละเอียดรถยนต์', [
                        _txt(_carModelCtl, 'รุ่น'),
                        _row2(
                          _dd('จังหวัด', _carProvinceCtl.text, _provinceNames,
                              (v) => setState(() => _carProvinceCtl.text = v ?? ''),
                              hint: 'เลือกจังหวัด', key: ValueKey('cp_${_carProvinceCtl.text}')),
                          _carTypeDropdown(),
                        ),
                        _row2(_txt(_carBrandCtl, 'ยี่ห้อ'), _txt(_licensePlateCtl, 'หมายเลขทะเบียน')),
                        _row2(_txt(_carColorCtl, 'สีรถ'), _txt(_carRegYearCtl, 'ปีจดทะเบียน')),
                        _txt(_chassisNoCtl, 'หมายเลขตัวถัง'),
                        _row2(_txt(_engineNoCtl, 'หมายเลขเครื่อง'), _txt(_modelNoCtl, 'หมายเลข Model')),
                        _row2(_numField(_mileageCtl, 'หมายเลข กม.'), _evTypeDropdown()),
                      ]),

                      // ── 4. ผู้ขับขี่ ──
                      _card(3, Icons.person_outline, 'ข้อมูลผู้ขับขี่รถประกันภัย', [
                        _scanRow(),
                        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Expanded(flex: 3, child: _genderDropdown()),
                          const SizedBox(width: 8),
                          Expanded(flex: 4, child: _titleDropdown()),
                          const SizedBox(width: 8),
                          Expanded(flex: 5, child: _birthdateField()),
                        ]),
                        _row2(_txt(_driverNameCtl, 'ชื่อ'), _txt(_driverLastnameCtl, 'นามสกุล')),
                        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          SizedBox(width: 64, child: _numField(_driverAgeCtl, 'อายุ')),
                          const SizedBox(width: 8),
                          Expanded(child: _txt(_driverPhoneCtl, 'โทรศัพท์', keyboardType: TextInputType.phone)),
                          const SizedBox(width: 8),
                          Expanded(child: _relationDropdown()),
                        ]),
                        _txt(_driverAddressCtl, 'ที่อยู่ปัจจุบัน'),
                        _dd('จังหวัด', _driverProvinceCtl.text, _provinceNames,
                            (v) => setState(() { _driverProvinceCtl.text = v ?? ''; _driverDistrictCtl.text = ''; }),
                            hint: 'เลือกจังหวัด', key: ValueKey('dp_${_driverProvinceCtl.text}')),
                        _districtDropdown(),
                        _row2(_txt(_driverIdCardCtl, 'บัตรประชาชนเลขที่', keyboardType: TextInputType.number),
                            _txt(_driverLicenseNoCtl, 'ใบอนุญาตขับขี่เลขที่')),
                        _row2(_licenseTypeDropdown(), _txt(_driverLicensePlaceCtl, 'ออกให้ที่')),
                        _row2(_txt(_driverLicenseStartCtl, 'ออกให้วันที่'), _txt(_driverLicenseEndCtl, 'หมดอายุวันที่')),
                      ]),

                      // ── 5. ความเสียหาย ──
                      _card(4, Icons.report_problem_outlined, 'ความเสียหายรถประกันภัย', [
                        _damageList(),
                        _damageDescField(),
                        _numField(_estimatedCostCtl, 'ค่าเสียหายประมาณ (บาท)', decimal: true),
                      ], warn: true),

                      // ── 6. รายละเอียดอุบัติเหตุ ──
                      _card(5, Icons.car_crash_outlined, 'รายละเอียดอุบัติเหตุ', [
                        _row2(_txt(_accDateCtl, 'วันที่เกิดเหตุ (วว/ดด/ปปปป)'), _txt(_accTimeCtl, 'เวลา (นน:นน)')),
                        _txt(_accPlaceCtl, 'สถานที่เกิดเหตุ'),
                        _row2(_txt(_accProvinceCtl, 'จังหวัด'), _txt(_accDistrictCtl, 'เขต/อำเภอ')),
                        _dd('ลักษณะการเกิดเหตุ', _accCauseCtl.text, _accCauseOptions,
                            (v) => setState(() => _accCauseCtl.text = v ?? ''), key: ValueKey('ac_${_accCauseCtl.text}')),
                        _dd('ลักษณะความเสียหาย', _accDamageTypeCtl.text, _accDamageOptions,
                            (v) => setState(() => _accDamageTypeCtl.text = v ?? ''), key: ValueKey('ad_${_accDamageTypeCtl.text}')),
                        _txt(_accDetailCtl, 'รายละเอียดการเกิดเหตุ', maxLines: 5),
                        _fieldLabel('ฝ่ายประมาท'),
                        Wrap(spacing: 8, runSpacing: 8, children: [
                          _chip('รถประกันฝ่ายผิด', _accFault == 'ฝ่ายผิด', () => setState(() => _accFault = 'ฝ่ายผิด')),
                          _chip('ฝ่ายถูกและผิด', _accFault == 'ฝ่ายถูกและผิด', () => setState(() => _accFault = 'ฝ่ายถูกและผิด')),
                          _chip('คู่กรณีผิด', _accFault == 'คู่กรณีผิด', () => setState(() => _accFault = 'คู่กรณีผิด')),
                          _chip('ประมาทร่วม', _accFault == 'ประมาทร่วม', () => setState(() => _accFault = 'ประมาทร่วม')),
                          _chip('รอสรุปผลคดี', _accFault == 'รอสรุปผลคดี', () => setState(() => _accFault = 'รอสรุปผลคดี')),
                          _chip('ยกเลิกการเคลม', _accFault == 'ยกเลิกการเคลม', () => setState(() => _accFault = 'ยกเลิกการเคลม')),
                          _chip('ไปถึงแล้วไม่พบ', _accFault == 'ไปถึงแล้วไม่พบ', () => setState(() => _accFault = 'ไปถึงแล้วไม่พบ')),
                        ]),
                        _txt(_accReporterCtl, 'ผู้แจ้ง'),
                        _txt(_accSurveyorCtl, 'ผู้สำรวจภัย'),
                        _row2(_txt(_accSurveyorBranchCtl, 'สาขา'), _txt(_accSurveyorPhoneCtl, 'โทรศัพท์สำรวจ', keyboardType: TextInputType.phone)),
                        _row2(_txt(_accCustomerReportDateCtl, 'วันที่ลูกค้าแจ้ง บ.ประกัน'), _txt(_accInsNotifyDateCtl, 'วันที่ บ.ประกันแจ้งสำรวจ')),
                        _row2(_txt(_accSurveyArriveDateCtl, 'วันที่ถึงที่เกิดเหตุ'), _txt(_accSurveyCompleteDateCtl, 'วันที่สำรวจเสร็จ')),
                        _txt(_accClaimOpponentCtl, 'การเรียกร้องค่าเสียหายจากคู่กรณี'),
                        _row2(_numField(_accClaimAmountCtl, 'รับเงินจำนวน (บาท)', decimal: true),
                            _numField(_accClaimTotalAmountCtl, 'จากจำนวนเรียกร้องทั้งหมด (บาท)', decimal: true)),
                        _row2(_txt(_accPoliceNameCtl, 'ชื่อพนักงานสอบสวน'), _txt(_accPoliceStationCtl, 'สถานีตำรวจ')),
                        _txt(_accPoliceCommentCtl, 'ความเห็นพนักงานสอบสวน'),
                        _row2(_txt(_accPoliceDateCtl, 'วันที่ (ตำรวจ)'), _txt(_accPoliceBookNoCtl, 'ประจำวันข้อที่')),
                        _txt(_accAlcoholTestCtl, 'ผลการตรวจแอลกอฮอล์'),
                        _followupDropdown(),
                        _txt(_accFollowupCountCtl, 'ครั้งที่นัดหมาย'),
                        _txt(_accFollowupDetailCtl, 'รายละเอียดการนัดหมาย'),
                        _txt(_accFollowupDateCtl, 'วันที่นัดหมาย'),
                      ]),

                      // ── 7. หมายเหตุ ──
                      _card(6, Icons.sticky_note_2_outlined, 'หมายเหตุ', [
                        _txt(_notesCtl, 'หมายเหตุเพิ่มเติม', maxLines: 3),
                      ]),

                      // ── 8. รูปถ่าย ──
                      _card(7, Icons.photo_camera_outlined, 'รูปถ่าย', [
                        _buildPhotoGrid(),
                      ]),
                    ],
                  ),
                ),
              ),
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
            ],
          );
        },
      ),
    );
  }

  // ── topbar (sticky header w/ claim + status chip) ──
  PreferredSizeWidget _topbar() {
    final claimNo = _claimNoCtl.text.trim();
    return AppBar(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      foregroundColor: _ink,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      titleSpacing: 0,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('แบบฟอร์มสำรวจ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: _ink)),
          if (claimNo.isNotEmpty)
            Text('เคลม #$claimNo', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500, color: _muted)),
        ],
      ),
      actions: [
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

  // ── section-nav strip ──
  Widget _progressStrip() {
    const secs = ['เคลม', 'กรมธรรม์', 'รถยนต์', 'ผู้ขับขี่', 'ความเสียหาย', 'อุบัติเหตุ', 'หมายเหตุ', 'รูปถ่าย'];
    return SizedBox(
      height: 32,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: secs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) => GestureDetector(
          onTap: () {
            final ctx = _secKeys[i].currentContext;
            if (ctx != null) {
              Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 350), curve: Curves.easeInOut, alignment: 0.02);
            }
          },
          child: Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 13),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999), border: Border.all(color: _line)),
            child: Text(secs[i], style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: _muted)),
          ),
        ),
      ),
    );
  }

  // ── bottom save bar ──
  Widget _savebar(CaseProvider cp) {
    return Container(
      padding: EdgeInsets.fromLTRB(14, 12, 14, 12 + MediaQuery.of(context).padding.bottom),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: _line))),
      child: Row(children: [
        Expanded(
          child: SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: cp.isSubmitting ? null : _submitSurvey,
              icon: cp.isSubmitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : const Icon(Icons.send_rounded, size: 20),
              label: const Text('ส่งข้อมูลสำรวจ', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600)),
              style: ElevatedButton.styleFrom(
                backgroundColor: _primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          width: 52,
          height: 52,
          child: OutlinedButton(
            onPressed: cp.isSubmitting ? null : _saveDraft,
            style: OutlinedButton.styleFrom(
              foregroundColor: _primary,
              side: const BorderSide(color: _lineStrong),
              padding: EdgeInsets.zero,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: const Icon(Icons.save_outlined, size: 22),
          ),
        ),
      ]),
    );
  }

  // ── card (section) ──
  Widget _card(int idx, IconData icon, String title, List<Widget> children, {bool warn = false}) {
    return Container(
      key: _secKeys[idx],
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
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
                child: Icon(icon, size: 18, color: warn ? _warn : _primary),
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
      if (i < items.length - 1) out.add(const SizedBox(height: 11));
    }
    return out;
  }

  Widget _fieldLabel(String text) =>
      Padding(padding: const EdgeInsets.only(top: 2, bottom: 2), child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _ink)));

  Widget _row2(Widget a, Widget b) =>
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: a), const SizedBox(width: 10), Expanded(child: b)]);

  // ── filled, floating-label decoration ──
  InputDecoration _dec(String label, {Widget? suffixIcon, String? hint}) {
    OutlineInputBorder b(Color c) => OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: BorderSide(color: c, width: 1.5));
    return InputDecoration(
      labelText: label,
      hintText: hint,
      floatingLabelBehavior: FloatingLabelBehavior.always,
      labelStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: _muted),
      hintStyle: const TextStyle(fontSize: 14.5, color: _muted2),
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

  Widget _txt(TextEditingController ctl, String label, {TextInputType? keyboardType, int maxLines = 1, ValueChanged<String>? onChanged}) {
    return TextFormField(
      controller: ctl,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec(label),
      keyboardType: keyboardType,
      maxLines: maxLines,
      textInputAction: maxLines == 1 ? TextInputAction.next : TextInputAction.newline,
      onChanged: onChanged,
    );
  }

  Widget _numField(TextEditingController ctl, String label, {bool decimal = false}) {
    return TextFormField(
      controller: ctl,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec(label),
      keyboardType: TextInputType.numberWithOptions(decimal: decimal),
      inputFormatters: decimal ? [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))] : [FilteringTextInputFormatter.digitsOnly],
      textInputAction: TextInputAction.next,
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
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? _primary : _lineStrong, width: 1.5),
        ),
        child: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: selected ? Colors.white : _muted)),
      ),
    );
    return grow ? Expanded(child: chip) : chip;
  }

  // ── generic string dropdown (filled style) ──
  Widget _dd(String label, String? value, List<String> items, ValueChanged<String?> onChanged, {String hint = '-- ระบุ --', Key? key}) {
    final v = (value != null && value.isNotEmpty && items.contains(value)) ? value : null;
    return DropdownButtonFormField<String>(
      key: key,
      initialValue: v,
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec(label),
      hint: Text(hint, style: const TextStyle(fontSize: 14.5, color: _muted2)),
      items: items.map((e) => DropdownMenuItem(value: e, child: Text(e, style: const TextStyle(fontSize: 14.5), overflow: TextOverflow.ellipsis))).toList(),
      onChanged: onChanged,
    );
  }

  Widget _carTypeDropdown() {
    return DropdownButtonFormField<String>(
      initialValue: _carType,
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec('ประเภทรถ'),
      items: const [
        DropdownMenuItem(value: '0', child: Text('-- ระบุ --', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'A', child: Text('เก๋งเอเชีย', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'E', child: Text('เก๋งยุโรป', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'M', child: Text('รถจักรยานยนต์', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'T', child: Text('กระบะ', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'V', child: Text('รถตู้', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'W', child: Text('รถบรรทุก', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'O', child: Text('รถอื่นๆ', style: TextStyle(fontSize: 14.5))),
      ],
      onChanged: (v) => setState(() => _carType = v!),
    );
  }

  Widget _evTypeDropdown() {
    return DropdownButtonFormField<String>(
      initialValue: _evType.isEmpty ? '' : _evType,
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec('ประเภทรถ EV'),
      items: const [
        DropdownMenuItem(value: '', child: Text('-- ระบุ --', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'BEV', child: Text('BEV (100%)', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'PHEV', child: Text('PHEV', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'HEV', child: Text('HEV', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'FCEV', child: Text('FCEV', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'MEV', child: Text('MEV ดัดแปลง', style: TextStyle(fontSize: 14.5))),
      ],
      onChanged: (v) => setState(() => _evType = v ?? ''),
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
      onChanged: (v) => setState(() => _accFollowup = v ?? 'ไม่มีการนัดหมาย'),
    );
  }

  Widget _genderDropdown() {
    return DropdownButtonFormField<String>(
      key: ValueKey('gender_$_driverGender'),
      initialValue: _driverGender == 'M' ? 'ชาย' : _driverGender == 'F' ? 'หญิง' : 'เพศ',
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec('เพศ'),
      items: const [
        DropdownMenuItem(value: 'เพศ', child: Text('เพศ', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'ชาย', child: Text('ชาย', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'หญิง', child: Text('หญิง', style: TextStyle(fontSize: 14.5))),
      ],
      onChanged: (v) {
        setState(() {
          _driverGender = v == 'ชาย' ? 'M' : v == 'หญิง' ? 'F' : '';
          if (_driverGender == 'M') _driverTitle = 'นาย';
          else if (_driverGender == 'F') _driverTitle = 'นางสาว';
        });
      },
    );
  }

  Widget _titleDropdown() {
    // ตัวเลือกคงที่ 7 รายการ (ไม่ขึ้นกับเพศ) เริ่มต้นที่ '0' = "- คำนำหน้า -"
    const items = ['0', 'นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.', 'คุณ'];
    return DropdownButtonFormField<String>(
      key: ValueKey('title_$_driverTitle'),
      initialValue: items.contains(_driverTitle) ? _driverTitle : '0',
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
      decoration: _dec('คำนำหน้า'),
      items: const [
        DropdownMenuItem(value: '0', child: Text('คำนำหน้า', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'นาย', child: Text('นาย', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'นาง', child: Text('นาง', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'นางสาว', child: Text('นางสาว', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'ด.ช.', child: Text('ด.ช.', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'ด.ญ.', child: Text('ด.ญ.', style: TextStyle(fontSize: 14.5))),
        DropdownMenuItem(value: 'คุณ', child: Text('คุณ', style: TextStyle(fontSize: 14.5))),
      ],
      onChanged: (v) => setState(() => _driverTitle = v ?? '0'),
    );
  }

  Widget _birthdateField() {
    return GestureDetector(
      onTap: _showBuddhistDatePicker,
      child: AbsorbPointer(
        child: TextFormField(
          controller: _driverBirthdateCtl,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: _ink),
          decoration: _dec('วันเกิด', suffixIcon: const Icon(Icons.calendar_today, size: 15, color: _muted2)),
        ),
      ),
    );
  }

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
        key: ValueKey('rel_${_driverRelationCtl.text}'));
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
    Widget btn(IconData icon, String label, VoidCallback onTap) => OutlinedButton.icon(
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
      Expanded(child: btn(Icons.credit_card, 'สแกนบัตรประชาชน', () {})),
      const SizedBox(width: 10),
      Expanded(child: btn(Icons.badge_outlined, 'สแกนใบขับขี่', () {})),
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
                  hintStyle: TextStyle(fontSize: 12.5, color: Colors.grey.shade400),
                  filled: true,
                  fillColor: Colors.white,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _line)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _line)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _primary, width: 1.5)),
                ),
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
                        decoration: BoxDecoration(color: selected ? _primary : Colors.white, borderRadius: BorderRadius.circular(999), border: Border.all(color: selected ? _primary : _lineStrong)),
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
                        decoration: BoxDecoration(color: selected ? colors[lv] : Colors.white, borderRadius: BorderRadius.circular(999), border: Border.all(color: selected ? colors[lv]! : _lineStrong)),
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
