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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('แบบฟอร์มสำรวจ', style: TextStyle(fontWeight: FontWeight.bold)),
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF0174BE), Color(0xFF4988C4)]))),
        foregroundColor: Colors.white,
        elevation: 2,
      ),
      floatingActionButton: Consumer<CaseProvider>(
        builder: (context, cp, _) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_caseImages.isNotEmpty) ...[
              FloatingActionButton(
                heroTag: 'viewImages',
                onPressed: () => setState(() => _showImageSheet = !_showImageSheet),
                backgroundColor: _showImageSheet ? Colors.orange : const Color(0xFF0174BE),
                mini: true,
                child: Icon(_showImageSheet ? Icons.close : Icons.credit_card, color: Colors.white),
              ),
              const SizedBox(height: 12),
            ],
            FloatingActionButton(
              heroTag: 'saveDraft',
              onPressed: cp.isSubmitting ? null : _saveDraft,
              backgroundColor: const Color(0xFF0174BE),
              child: cp.isSubmitting
                ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Icon(Icons.save, color: Colors.white),
            ),
          ],
        ),
      ),
      body: Consumer<CaseProvider>(
        builder: (context, caseProvider, _) {
          return Stack(
            children: [
              SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // ========== 1. ข้อมูลเคลม ==========
                      _sectionHeader('ข้อมูลเคลม', Icons.shield),
                      const SizedBox(height: 12),
                      Text('ประเภทเคลม', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
                      const SizedBox(height: 8),
                      Row(children: [
                        Expanded(child: _claimChip('เคลมสด', 'F')),
                        const SizedBox(width: 4),
                        Expanded(child: _claimChip('เคลมแห้ง', 'D')),
                        const SizedBox(width: 4),
                        Expanded(child: _claimChip('นัดหมาย', 'A')),
                        const SizedBox(width: 4),
                        Expanded(child: _claimChip('ติดตาม', 'C')),
                      ]),
                      const SizedBox(height: 12),
                      Text('รถเสียหาย', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
                      const SizedBox(height: 8),
                      Row(children: [
                        Expanded(child: _damageChip('หนัก', Colors.red.shade100)),
                        const SizedBox(width: 4),
                        Expanded(child: _damageChip('เบา', Colors.green.shade100)),
                      ]),
                      const SizedBox(height: 8),
                      _txt(_claimRefNoCtl, 'เลขที่รับแจ้ง', Icons.receipt),
                      const SizedBox(height: 12),
                      _txt(_claimNoCtl, 'เลขที่เคลม', Icons.tag),
                      const SizedBox(height: 12),
                      _txt(_surveyJobNoCtl, 'เลขเรื่องเซอร์เวย์', Icons.numbers),
                      const SizedBox(height: 24),

                      // ========== 2. กรมธรรม์ ==========
                      _sectionHeader('ข้อมูลกรมธรรม์', Icons.article),
                      const SizedBox(height: 12),
                      _txt(_policyNoCtl, 'เลขกรมธรรม์', Icons.pin),
                      const SizedBox(height: 12),
                      _txt(_prbNumberCtl, 'เลข พรบ.', Icons.description),
                      const SizedBox(height: 12),
                      _txt(_driverByPolicyCtl, 'ชื่อผู้ขับขี่ตามกรมธรรม์', Icons.person_search),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_policyStartCtl, 'วันที่เริ่มต้น', Icons.calendar_today)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_policyEndCtl, 'วันที่สิ้นสุด', Icons.event)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_assuredNameCtl, 'ผู้เอาประกันภัย', Icons.person_pin),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_policyTypeCtl, 'ประเภทประกัน', Icons.category)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_riskCodeCtl, 'รหัสภัยยานยนต์', Icons.security)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_assuredEmailCtl, 'อีเมลผู้เอาประกัน', Icons.email, keyboardType: TextInputType.emailAddress),
                      const SizedBox(height: 12),
                      _numField(_deductibleCtl, 'ค่าเสียหายส่วนแรก', Icons.money_off, decimal: true),
                      const SizedBox(height: 24),

                      // ========== 3. รายละเอียดรถ ==========
                      _sectionHeader('รายละเอียดรถยนต์', Icons.directions_car),
                      const SizedBox(height: 12),
                      _txt(_licensePlateCtl, 'หมายเลขทะเบียน', Icons.confirmation_number),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            key: ValueKey('car_province_${_carProvinceCtl.text}'),
                            initialValue: _carProvinceCtl.text.isNotEmpty && _provinceNames.contains(_carProvinceCtl.text) ? _carProvinceCtl.text : null,
                            decoration: InputDecoration(
                              labelText: 'จังหวัด',
                              labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                              border: _fieldBorder,
                              enabledBorder: _fieldBorder,
                              focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                              contentPadding: _fieldPadding,
                              isDense: true,
                            ),
                            isExpanded: true,
                            style: const TextStyle(fontSize: 13, color: Colors.black87),
                            hint: const Text('-- เลือกจังหวัด --', style: TextStyle(fontSize: 13, color: Colors.grey)),
                            items: _provinceNames.map((p) => DropdownMenuItem(value: p, child: Text(p, style: const TextStyle(fontSize: 13)))).toList(),
                            onChanged: (v) {
                              setState(() { _carProvinceCtl.text = v ?? ''; });
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _carType,
                            decoration: const InputDecoration(labelText: 'ประเภทรถ', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12)),
                            isExpanded: true,
                            items: const [
                              DropdownMenuItem(value: '0', child: Text('-- ระบุ --')),
                              DropdownMenuItem(value: 'A', child: Text('เก๋งเอเชีย')),
                              DropdownMenuItem(value: 'E', child: Text('เก๋งยุโรป')),
                              DropdownMenuItem(value: 'M', child: Text('รถจักรยานยนต์')),
                              DropdownMenuItem(value: 'T', child: Text('กระบะ')),
                              DropdownMenuItem(value: 'V', child: Text('รถตู้')),
                              DropdownMenuItem(value: 'W', child: Text('รถบรรทุก')),
                              DropdownMenuItem(value: 'O', child: Text('รถอื่นๆ')),
                            ],
                            onChanged: (v) => setState(() => _carType = v!),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_carBrandCtl, 'ยี่ห้อ', Icons.branding_watermark)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_carModelCtl, 'รุ่น', Icons.model_training)),
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_carColorCtl, 'สีรถ', Icons.color_lens)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_carRegYearCtl, 'ปีจดทะเบียน', Icons.date_range)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_chassisNoCtl, 'หมายเลขตัวถัง', Icons.pin),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_engineNoCtl, 'หมายเลขเครื่อง', Icons.settings)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_modelNoCtl, 'หมายเลข Model', Icons.qr_code)),
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _numField(_mileageCtl, 'หมายเลข กม.', Icons.speed)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _evType.isEmpty ? null : _evType,
                            decoration: const InputDecoration(labelText: 'ประเภทรถ EV', border: OutlineInputBorder()),
                            items: const [
                              DropdownMenuItem(value: '', child: Text('-- ระบุ --')),
                              DropdownMenuItem(value: 'BEV', child: Text('BEV (100%)')),
                              DropdownMenuItem(value: 'PHEV', child: Text('PHEV')),
                              DropdownMenuItem(value: 'HEV', child: Text('HEV')),
                              DropdownMenuItem(value: 'FCEV', child: Text('FCEV')),
                              DropdownMenuItem(value: 'MEV', child: Text('MEV ดัดแปลง')),
                            ],
                            onChanged: (v) => setState(() => _evType = v ?? ''),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 24),

                      // ========== 4. ผู้ขับขี่ ==========
                      _sectionHeader('ข้อมูลผู้ขับขี่รถประกันภัย', Icons.person),
                      const SizedBox(height: 12),
                      // ปุ่มสแกน
                      Row(children: [
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
                      const SizedBox(height: 12),
                      // แถว 1: เพศ + คำนำหน้า + วันเกิด
                      Row(children: [
                        Flexible(
                          flex: 3,
                          child: DropdownButtonFormField<String>(
                            key: ValueKey('gender_$_driverGender'),
                            initialValue: _driverGender == 'M' ? 'ชาย' : _driverGender == 'F' ? 'หญิง' : 'เพศ',
                            isExpanded: true,
                            style: const TextStyle(fontSize: 13, color: Colors.black87),
                            decoration: InputDecoration(
                              labelText: 'เพศ',
                              labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                              border: _fieldBorder, enabledBorder: _fieldBorder,
                              focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                              contentPadding: _fieldPadding, isDense: true,
                            ),
                            items: const [
                              DropdownMenuItem(value: 'เพศ', child: Text('เพศ', style: TextStyle(fontSize: 13))),
                              DropdownMenuItem(value: 'ชาย', child: Text('ชาย', style: TextStyle(fontSize: 13))),
                              DropdownMenuItem(value: 'หญิง', child: Text('หญิง', style: TextStyle(fontSize: 13))),
                            ],
                            onChanged: (v) {
                              setState(() {
                                _driverGender = v == 'ชาย' ? 'M' : v == 'หญิง' ? 'F' : '';
                                if (_driverGender == 'M') _driverTitle = 'นาย';
                                else if (_driverGender == 'F') _driverTitle = 'นางสาว';
                              });
                            },
                          ),
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          flex: 4,
                          child: DropdownButtonFormField<String>(
                            key: ValueKey('title_$_driverGender'),
                            initialValue: _driverTitle,
                            isExpanded: true,
                            style: const TextStyle(fontSize: 13, color: Colors.black87),
                            decoration: InputDecoration(
                              labelText: 'คำนำหน้า',
                              labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                              border: _fieldBorder, enabledBorder: _fieldBorder,
                              focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                              contentPadding: _fieldPadding, isDense: true,
                            ),
                            items: _driverGender == 'M'
                              ? const [
                                  DropdownMenuItem(value: 'นาย', child: Text('นาย', style: TextStyle(fontSize: 13))),
                                  DropdownMenuItem(value: 'ด.ช.', child: Text('ด.ช.', style: TextStyle(fontSize: 13))),
                                  DropdownMenuItem(value: 'คุณ', child: Text('คุณ', style: TextStyle(fontSize: 13))),
                                ]
                              : _driverGender == 'F'
                              ? const [
                                  DropdownMenuItem(value: 'นาง', child: Text('นาง', style: TextStyle(fontSize: 13))),
                                  DropdownMenuItem(value: 'นางสาว', child: Text('นางสาว', style: TextStyle(fontSize: 13))),
                                  DropdownMenuItem(value: 'ด.ญ.', child: Text('ด.ญ.', style: TextStyle(fontSize: 13))),
                                  DropdownMenuItem(value: 'คุณ', child: Text('คุณ', style: TextStyle(fontSize: 13))),
                                ]
                              : const [
                                  DropdownMenuItem(value: '0', child: Text('คำนำหน้า', style: TextStyle(fontSize: 13))),
                                ],
                            onChanged: (v) => setState(() => _driverTitle = v!),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          flex: 5,
                          child: GestureDetector(
                            onTap: _showBuddhistDatePicker,
                            child: AbsorbPointer(
                              child: TextFormField(
                                controller: _driverBirthdateCtl,
                                style: const TextStyle(fontSize: 13),
                                decoration: InputDecoration(
                                  labelText: 'วันเกิด',
                                  labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                                  border: _fieldBorder, enabledBorder: _fieldBorder,
                                  focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                                  contentPadding: _fieldPadding, isDense: true,
                                  suffixIcon: const Icon(Icons.calendar_today, size: 14, color: Colors.grey),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 12),
                      // แถว 2: ชื่อ + นามสกุล
                      Row(children: [
                        Expanded(child: _txt(_driverNameCtl, 'ชื่อ', Icons.person_outline)),
                        const SizedBox(width: 8),
                        Expanded(child: _txt(_driverLastnameCtl, 'นามสกุล', Icons.person_outline)),
                      ]),
                      const SizedBox(height: 12),
                      // แถว 3: อายุ + โทรศัพท์ + ความสัมพันธ์
                      Row(children: [
                        SizedBox(width: 60, child: _numField(_driverAgeCtl, 'อายุ', Icons.cake)),
                        const SizedBox(width: 8),
                        SizedBox(width: 120, child: _txt(_driverPhoneCtl, 'โทรศัพท์', Icons.phone, keyboardType: TextInputType.phone)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            key: ValueKey('driver_relation_${_driverRelationCtl.text}'),
                            initialValue: _driverRelationCtl.text.isNotEmpty && _driverRelationCtl.text != '-- ระบุ --' ? _driverRelationCtl.text : null,
                            decoration: InputDecoration(
                              labelText: 'ความสัมพันธ์',
                              labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                              border: _fieldBorder, enabledBorder: _fieldBorder,
                              focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                              contentPadding: _fieldPadding, isDense: true,
                            ),
                            isExpanded: true,
                            style: const TextStyle(fontSize: 13, color: Colors.black87),
                            hint: const Text('-- ระบุ --', style: TextStyle(fontSize: 13, color: Colors.grey)),
                            items: const [
                              'สามี', 'ภรรยา', 'บุตร', 'บิดา', 'มารดา',
                              'นายจ้าง', 'ลูกจ้าง', 'ผู้เช่า', 'พี่ชาย', 'พี่สาว',
                              'น้องชาย', 'น้องสาว', 'เจ้าของรถ', 'หลาน', 'อา', 'น้า', 'ลุง', 'ป้า',
                              'ญาติ', 'เพื่อน', 'แฟน', 'พนักงาน', 'พี่เขย', 'น้องเขย',
                              'พี่สะใภ้', 'น้องสะใภ้', 'พนักงานผู้เช่า', 'ลุงเขย', 'น้าเขย',
                              'น้าสะใภ้', 'อาเขย', 'อาสะใภ้', 'หุ้นส่วน', 'บุตรหุ้นส่วน',
                              'เจ้าของบริษัท', 'เพื่อนบุตรเจ้าของรถ', 'บุตรเขย', 'หลานเขย', 'บุตรสะใภ้',
                            ].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                            onChanged: (v) {
                              setState(() { _driverRelationCtl.text = v ?? ''; });
                            },
                          ),
                        ),
                      ]),
                      const SizedBox(height: 12),
                      // แถว 4: ที่อยู่
                      _txt(_driverAddressCtl, 'ที่อยู่ปัจจุบัน', Icons.home),
                      const SizedBox(height: 12),
                      // แถว 5: จังหวัด
                      DropdownButtonFormField<String>(
                        key: ValueKey('driver_province_${_driverProvinceCtl.text}'),
                        initialValue: _driverProvinceCtl.text.isNotEmpty && _provinceNames.contains(_driverProvinceCtl.text) ? _driverProvinceCtl.text : null,
                        decoration: InputDecoration(
                          labelText: 'จังหวัด',
                          labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                          border: _fieldBorder, enabledBorder: _fieldBorder,
                          focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                          contentPadding: _fieldPadding, isDense: true,
                        ),
                        isExpanded: true,
                        style: const TextStyle(fontSize: 13, color: Colors.black87),
                        hint: const Text('-- เลือกจังหวัด --', style: TextStyle(fontSize: 13, color: Colors.grey)),
                        items: _provinceNames.map((p) => DropdownMenuItem(value: p, child: Text(p, style: const TextStyle(fontSize: 13)))).toList(),
                        onChanged: (v) {
                          setState(() { _driverProvinceCtl.text = v ?? ''; _driverDistrictCtl.text = ''; });
                        },
                      ),
                      const SizedBox(height: 12),
                      // แถว 6: เขต/อำเภอ
                      Builder(builder: (_) {
                        final districts = (_driverProvinceCtl.text.isNotEmpty && _provincesData.containsKey(_driverProvinceCtl.text))
                            ? _provincesData[_driverProvinceCtl.text]!
                            : <String>[];
                        return DropdownButtonFormField<String>(
                          key: ValueKey('driver_district_${_driverProvinceCtl.text}_${_driverDistrictCtl.text}'),
                          initialValue: _driverDistrictCtl.text.isNotEmpty && districts.contains(_driverDistrictCtl.text) ? _driverDistrictCtl.text : null,
                          decoration: InputDecoration(
                            labelText: 'เขต/อำเภอ',
                            labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                            border: _fieldBorder, enabledBorder: _fieldBorder,
                            focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                            contentPadding: _fieldPadding, isDense: true,
                          ),
                          isExpanded: true,
                          style: const TextStyle(fontSize: 13, color: Colors.black87),
                          hint: const Text('-- เลือกเขต/อำเภอ --', style: TextStyle(fontSize: 13, color: Colors.grey)),
                          items: districts.map((d) => DropdownMenuItem(value: d, child: Text(d, style: const TextStyle(fontSize: 13)))).toList(),
                          onChanged: (v) {
                            setState(() { _driverDistrictCtl.text = v ?? ''; });
                          },
                        );
                      }),
                      const SizedBox(height: 12),
                      // แถว 7: บัตรประชาชน + ใบขับขี่เลขที่
                      Row(children: [
                        Expanded(child: _txt(_driverIdCardCtl, 'บัตรประชาชนเลขที่', Icons.credit_card, keyboardType: TextInputType.number)),
                        const SizedBox(width: 8),
                        Expanded(child: _txt(_driverLicenseNoCtl, 'ใบอนุญาตขับขี่เลขที่', Icons.card_membership)),
                      ]),
                      const SizedBox(height: 12),
                      // แถว 8: ประเภทใบขับขี่ + ออกให้ที่
                      Row(children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            key: ValueKey('license_type_${_driverLicenseTypeCtl.text}'),
                            initialValue: _driverLicenseTypeCtl.text.isNotEmpty ? _driverLicenseTypeCtl.text : null,
                            decoration: InputDecoration(
                              labelText: 'ประเภท',
                              labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                              border: _fieldBorder, enabledBorder: _fieldBorder,
                              focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                              contentPadding: _fieldPadding, isDense: true,
                            ),
                            isExpanded: true,
                            style: const TextStyle(fontSize: 13, color: Colors.black87),
                            hint: const Text('-- ระบุ --', style: TextStyle(fontSize: 13, color: Colors.grey)),
                            items: const [
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
                            ].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                            onChanged: (v) {
                              setState(() { _driverLicenseTypeCtl.text = v ?? ''; });
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: _txt(_driverLicensePlaceCtl, 'ออกให้ที่', Icons.location_on)),
                      ]),
                      const SizedBox(height: 12),
                      // แถว 9: ออกให้วันที่ + หมดอายุ
                      Row(children: [
                        Expanded(child: _txt(_driverLicenseStartCtl, 'ออกให้วันที่', Icons.event_available)),
                        const SizedBox(width: 8),
                        Expanded(child: _txt(_driverLicenseEndCtl, 'หมดอายุวันที่', Icons.event_busy)),
                      ]),
                      const SizedBox(height: 24),

                      // ========== 5. ความเสียหาย ==========
                      _sectionHeader('ความเสียหายรถประกันภัย', Icons.report_problem),
                      const SizedBox(height: 12),
                      // รายการความเสียหาย (พับได้)
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFF0174BE).withValues(alpha: 0.3)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Theme(
                          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                          child: ExpansionTile(
                            key: ValueKey('damage_expanded_$_damageExpanded'),
                            initiallyExpanded: _damageExpanded || _damageItems.isNotEmpty,
                            onExpansionChanged: (v) => _damageExpanded = v,
                            tilePadding: const EdgeInsets.symmetric(horizontal: 12),
                            childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                            leading: const Icon(Icons.build_circle, color: Color(0xFF0174BE), size: 20),
                            title: Text(
                              'รายการชิ้นส่วนเสียหาย (${_damageItems.length})',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0174BE)),
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                GestureDetector(
                                  onTap: _addDamageItem,
                                  child: Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF0174BE).withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Icon(Icons.add, size: 20, color: Color(0xFF0174BE)),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.expand_more, color: Colors.grey),
                              ],
                            ),
                            children: [
                              if (_damageItems.isEmpty)
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  child: Text('กด + เพื่อเพิ่มรายการชิ้นส่วนที่เสียหาย', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                                ),
                              for (int i = 0; i < _damageItems.length; i++) ...[
                                if (i > 0) Divider(color: Colors.grey.shade200, height: 16),
                                // Header: ลำดับ + ปุ่มลบ
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('ชิ้นส่วนที่ ${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0174BE))),
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
                                // ชื่อชิ้นส่วน
                                TextFormField(
                                  key: ValueKey('damage_part_$i'),
                                  initialValue: _damageItems[i]['part'],
                                  style: const TextStyle(fontSize: 13),
                                  decoration: InputDecoration(
                                    labelText: 'ชิ้นส่วน',
                                    labelStyle: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                    hintText: 'เช่น กันชนหน้า, ประตูหน้า',
                                    hintStyle: TextStyle(fontSize: 11, color: Colors.grey.shade400),
                                    border: _fieldBorder, enabledBorder: _fieldBorder,
                                    focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8), isDense: true,
                                    filled: true, fillColor: Colors.white,
                                  ),
                                  onChanged: (v) => _updateDamageItem(i, 'part', v),
                                ),
                                const SizedBox(height: 8),
                                // ตำแหน่ง + ระดับ
                                Row(children: [
                                  const Text('ตำแหน่ง ', style: TextStyle(fontSize: 11, color: Colors.grey)),
                                  ...['L', 'R', 'A'].map((pos) {
                                    final labels = {'L': 'ซ้าย', 'R': 'ขวา', 'A': 'ทั้งหมด'};
                                    final selected = _damageItems[i]['pos'] == pos;
                                    return Padding(
                                      padding: const EdgeInsets.only(right: 3),
                                      child: GestureDetector(
                                        onTap: () => _updateDamageItem(i, 'pos', selected ? '' : pos),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: selected ? const Color(0xFF0174BE) : Colors.grey.shade200,
                                            borderRadius: BorderRadius.circular(16),
                                          ),
                                          child: Text(labels[pos]!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: selected ? Colors.white : Colors.grey.shade700)),
                                        ),
                                      ),
                                    );
                                  }),
                                ]),
                                const SizedBox(height: 6),
                                Row(children: [
                                  const Text('ระดับ ', style: TextStyle(fontSize: 11, color: Colors.grey)),
                                  ...['L', 'M', 'H', 'X'].map((lv) {
                                    final labels = {'L': 'ต่ำ', 'M': 'กลาง', 'H': 'สูง', 'X': 'สูงมาก'};
                                    final colors = {'L': Colors.lightGreen, 'M': Colors.orange, 'H': Colors.red, 'X': Colors.purple};
                                    final selected = _damageItems[i]['level'] == lv;
                                    return Padding(
                                      padding: const EdgeInsets.only(right: 3),
                                      child: GestureDetector(
                                        onTap: () => _updateDamageItem(i, 'level', selected ? '' : lv),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: selected ? colors[lv] : Colors.grey.shade200,
                                            borderRadius: BorderRadius.circular(16),
                                          ),
                                          child: Text(labels[lv]!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: selected ? Colors.white : colors[lv])),
                                        ),
                                      ),
                                    );
                                  }),
                                ]),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      // รายละเอียดความเสียหาย (auto-fill จากรายการด้านบน)
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 120),
                        child: Scrollbar(
                          thumbVisibility: true,
                          child: TextFormField(
                            controller: _damageDescCtl,
                            style: const TextStyle(fontSize: 13),
                            decoration: InputDecoration(
                              labelText: 'รายละเอียดความเสียหาย',
                              labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                              border: const OutlineInputBorder(), alignLabelWithHint: true,
                              filled: false,
                            ),
                            maxLines: null,
                            readOnly: _damageItems.isNotEmpty,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _numField(_estimatedCostCtl, 'ค่าเสียหายประมาณ (บาท)', Icons.attach_money, decimal: true),
                      const SizedBox(height: 24),

                      // ========== 6. รายละเอียดอุบัติเหตุ ==========
                      _sectionHeader('รายละเอียดอุบัติเหตุ', Icons.car_crash),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_accDateCtl, 'วันที่เกิดเหตุ (วว/ดด/ปปปป)', Icons.calendar_today)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_accTimeCtl, 'เวลา (นน:นน)', Icons.access_time)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_accPlaceCtl, 'สถานที่เกิดเหตุ', Icons.location_on),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_accProvinceCtl, 'จังหวัด', Icons.location_city)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_accDistrictCtl, 'เขต/อำเภอ', Icons.map)),
                      ]),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        key: ValueKey('acc_cause_${_accCauseCtl.text}'),
                        initialValue: _accCauseCtl.text.isNotEmpty && _accCauseOptions.contains(_accCauseCtl.text) ? _accCauseCtl.text : null,
                        decoration: InputDecoration(
                          labelText: 'ลักษณะการเกิดเหตุ',
                          labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                          border: _fieldBorder, enabledBorder: _fieldBorder,
                          focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                          contentPadding: _fieldPadding, isDense: true,
                        ),
                        isExpanded: true,
                        style: const TextStyle(fontSize: 13, color: Colors.black87),
                        hint: const Text('-- ระบุ --', style: TextStyle(fontSize: 13, color: Colors.grey)),
                        items: _accCauseOptions.map((e) => DropdownMenuItem(value: e, child: Text(e, style: const TextStyle(fontSize: 13)))).toList(),
                        onChanged: (v) {
                          setState(() { _accCauseCtl.text = v ?? ''; });
                        },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        key: ValueKey('acc_damage_${_accDamageTypeCtl.text}'),
                        initialValue: _accDamageTypeCtl.text.isNotEmpty && _accDamageOptions.contains(_accDamageTypeCtl.text) ? _accDamageTypeCtl.text : null,
                        decoration: InputDecoration(
                          labelText: 'ลักษณะความเสียหาย',
                          labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                          border: _fieldBorder, enabledBorder: _fieldBorder,
                          focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
                          contentPadding: _fieldPadding, isDense: true,
                        ),
                        isExpanded: true,
                        style: const TextStyle(fontSize: 13, color: Colors.black87),
                        hint: const Text('-- ระบุ --', style: TextStyle(fontSize: 13, color: Colors.grey)),
                        items: _accDamageOptions.map((e) => DropdownMenuItem(value: e, child: Text(e, style: const TextStyle(fontSize: 13)))).toList(),
                        onChanged: (v) {
                          setState(() { _accDamageTypeCtl.text = v ?? ''; });
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _accDetailCtl,
                        decoration: const InputDecoration(labelText: 'รายละเอียดการเกิดเหตุ', border: OutlineInputBorder(), alignLabelWithHint: true),
                        maxLines: 5,
                      ),
                      const SizedBox(height: 12),
                      Text('ฝ่ายประมาท', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
                      const SizedBox(height: 8),
                      Wrap(spacing: 6, runSpacing: 6, children: [
                        ChoiceChip(label: const Text('รถประกันฝ่ายผิด'), selected: _accFault == 'ฝ่ายผิด', onSelected: (_) => setState(() => _accFault = 'ฝ่ายผิด'), selectedColor: Colors.red.shade100),
                        ChoiceChip(label: const Text('ฝ่ายถูกและผิด'), selected: _accFault == 'ฝ่ายถูกและผิด', onSelected: (_) => setState(() => _accFault = 'ฝ่ายถูกและผิด'), selectedColor: Colors.purple.shade100),
                        ChoiceChip(label: const Text('คู่กรณีผิด'), selected: _accFault == 'คู่กรณีผิด', onSelected: (_) => setState(() => _accFault = 'คู่กรณีผิด'), selectedColor: Colors.blue.shade100),
                        ChoiceChip(label: const Text('ประมาทร่วม'), selected: _accFault == 'ประมาทร่วม', onSelected: (_) => setState(() => _accFault = 'ประมาทร่วม'), selectedColor: Colors.orange.shade100),
                        ChoiceChip(label: const Text('รอสรุปผลคดี'), selected: _accFault == 'รอสรุปผลคดี', onSelected: (_) => setState(() => _accFault = 'รอสรุปผลคดี'), selectedColor: Colors.grey.shade200),
                        ChoiceChip(label: const Text('ยกเลิกการเคลม'), selected: _accFault == 'ยกเลิกการเคลม', onSelected: (_) => setState(() => _accFault = 'ยกเลิกการเคลม'), selectedColor: Colors.grey.shade300),
                        ChoiceChip(label: const Text('ไปถึงแล้วไม่พบ'), selected: _accFault == 'ไปถึงแล้วไม่พบ', onSelected: (_) => setState(() => _accFault = 'ไปถึงแล้วไม่พบ'), selectedColor: Colors.grey.shade300),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_accReporterCtl, 'ผู้แจ้ง', Icons.person_outline),
                      const SizedBox(height: 12),
                      _txt(_accSurveyorCtl, 'ผู้สำรวจภัย', Icons.engineering),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_accSurveyorBranchCtl, 'สาขา', Icons.store)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_accSurveyorPhoneCtl, 'โทรศัพท์สำรวจ', Icons.phone, keyboardType: TextInputType.phone)),
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_accCustomerReportDateCtl, 'วันที่ลูกค้าแจ้ง บ.ประกัน', Icons.event_note)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_accInsNotifyDateCtl, 'วันที่ บ.ประกันแจ้งสำรวจ', Icons.event_available)),
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_accSurveyArriveDateCtl, 'วันที่ถึงที่เกิดเหตุ', Icons.login)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_accSurveyCompleteDateCtl, 'วันที่สำรวจเสร็จ', Icons.check_circle_outline)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_accClaimOpponentCtl, 'การเรียกร้องค่าเสียหายจากคู่กรณี', Icons.gavel),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _numField(_accClaimAmountCtl, 'รับเงินจำนวน (บาท)', Icons.payments, decimal: true)),
                        const SizedBox(width: 12),
                        Expanded(child: _numField(_accClaimTotalAmountCtl, 'จากจำนวนเรียกร้องทั้งหมด (บาท)', Icons.account_balance_wallet, decimal: true)),
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_accPoliceNameCtl, 'ชื่อพนักงานสอบสวน', Icons.local_police)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_accPoliceStationCtl, 'สถานีตำรวจ', Icons.apartment)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_accPoliceCommentCtl, 'ความเห็นพนักงานสอบสวน', Icons.comment),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_accPoliceDateCtl, 'วันที่ (ตำรวจ)', Icons.event)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_accPoliceBookNoCtl, 'ประจำวันข้อที่', Icons.menu_book)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_accAlcoholTestCtl, 'ผลการตรวจแอลกอฮอล์', Icons.science),
                      const SizedBox(height: 12),
                      Text('การติดตามงาน', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
                      const SizedBox(height: 8),
                      Wrap(spacing: 6, children: [
                        ChoiceChip(label: const Text('ไม่มีนัดหมาย'), selected: _accFollowup == 'ไม่มีการนัดหมาย', onSelected: (_) => setState(() => _accFollowup = 'ไม่มีการนัดหมาย')),
                        ChoiceChip(label: const Text('รอการนัดหมาย'), selected: _accFollowup == 'รอการนัดหมาย', onSelected: (_) => setState(() => _accFollowup = 'รอการนัดหมาย'), selectedColor: Colors.yellow.shade100),
                        ChoiceChip(label: const Text('มีการนัดหมาย'), selected: _accFollowup == 'มีการนัดหมาย', onSelected: (_) => setState(() => _accFollowup = 'มีการนัดหมาย'), selectedColor: Colors.green.shade100),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_accFollowupCountCtl, 'ครั้งที่นัดหมาย', Icons.repeat),
                      const SizedBox(height: 12),
                      _txt(_accFollowupDetailCtl, 'รายละเอียดการนัดหมาย', Icons.event),
                      const SizedBox(height: 12),
                      _txt(_accFollowupDateCtl, 'วันที่นัดหมาย', Icons.calendar_month),
                      const SizedBox(height: 24),

                      // ========== 7. หมายเหตุ ==========

                      _sectionHeader('หมายเหตุ', Icons.note),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _notesCtl,
                        decoration: const InputDecoration(labelText: 'หมายเหตุเพิ่มเติม', border: OutlineInputBorder(), alignLabelWithHint: true),
                        maxLines: 3,
                      ),
                      const SizedBox(height: 24),

                      // ========== 7. รูปถ่าย ==========
                      _sectionHeader('รูปถ่าย', Icons.camera_alt),
                      const SizedBox(height: 8),
                      _buildPhotoGrid(),
                      const SizedBox(height: 24),

                      // Submit
                      Container(
                        height: 52,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFF0174BE), Color(0xFF4988C4)]),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [BoxShadow(color: Colors.blue.withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 4))],
                        ),
                        child: ElevatedButton.icon(
                          onPressed: caseProvider.isSubmitting ? null : _submitSurvey,
                          icon: const Icon(Icons.send_rounded, size: 22),
                          label: const Text('ส่งข้อมูลสำรวจ', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.transparent, shadowColor: Colors.transparent, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                        ),
                      ),
                      const SizedBox(height: 32),
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
                                const Icon(Icons.credit_card, color: Color(0xFF0174BE), size: 20),
                                const SizedBox(width: 8),
                                Text('หน้าการ์ด (${_caseImages.length})', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0174BE))),
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

  // === Helpers ===

  Widget _sectionHeader(String title, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF0174BE), Color(0xFF4988C4)]),
        borderRadius: BorderRadius.circular(8),
        boxShadow: [BoxShadow(color: Colors.blue.withValues(alpha: 0.2), blurRadius: 4, offset: const Offset(0, 2))],
      ),
      child: Row(children: [
        Icon(icon, color: Colors.white, size: 20),
        const SizedBox(width: 10),
        Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
      ]),
    );
  }

  Widget _claimChip(String label, String value) {
    final selected = _claimType == value;
    return GestureDetector(
      onTap: () => setState(() => _claimType = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? Colors.blue.shade100 : Colors.grey.shade200,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? Colors.blue : Colors.grey.shade300),
        ),
        child: Text(label, style: TextStyle(fontSize: 13, color: selected ? Colors.blue.shade800 : Colors.grey.shade700)),
      ),
    );
  }

  Widget _damageChip(String label, Color selectedColor) {
    final selected = _damageLevel == label;
    return GestureDetector(
      onTap: () => setState(() => _damageLevel = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? selectedColor : Colors.grey.shade200,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? selectedColor.withValues(alpha: 0.8) : Colors.grey.shade300),
        ),
        child: Text(label, style: TextStyle(fontSize: 13, color: selected ? Colors.black87 : Colors.grey.shade700)),
      ),
    );
  }

  static const _fieldBorder = OutlineInputBorder(borderSide: BorderSide(color: Color(0xFFBDBDBD)));

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
  static const _fieldPadding = EdgeInsets.symmetric(horizontal: 12, vertical: 12);

  Widget _txt(TextEditingController ctl, String label, IconData icon, {bool required = false, TextInputType? keyboardType}) {
    return TextFormField(
      controller: ctl,
      style: const TextStyle(fontSize: 13),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
        border: _fieldBorder,
        enabledBorder: _fieldBorder,
        focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
        contentPadding: _fieldPadding,
        isDense: true,
      ),
      keyboardType: keyboardType,
      textInputAction: TextInputAction.next,
      validator: required ? (v) => (v == null || v.trim().isEmpty) ? 'กรุณากรอก${label.replaceAll(' *', '')}' : null : null,
    );
  }

  Widget _numField(TextEditingController ctl, String label, IconData icon, {bool decimal = false, bool required = false}) {
    return TextFormField(
      controller: ctl,
      style: const TextStyle(fontSize: 13),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(fontSize: 13, color: Colors.grey.shade600),
        border: _fieldBorder,
        enabledBorder: _fieldBorder,
        focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF0174BE), width: 1.5)),
        contentPadding: _fieldPadding,
        isDense: true,
      ),
      keyboardType: TextInputType.numberWithOptions(decimal: decimal),
      inputFormatters: decimal ? [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))] : [FilteringTextInputFormatter.digitsOnly],
      textInputAction: TextInputAction.next,
      validator: required ? (v) => (v == null || v.trim().isEmpty) ? 'กรุณากรอก${label.replaceAll(' *', '')}' : null : null,
    );
  }

  Widget _buildPhotoGrid() {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 8, mainAxisSpacing: 8),
      itemCount: _photoPaths.length + 1,
      itemBuilder: (context, index) {
        if (index == _photoPaths.length) {
          return InkWell(
            onTap: _takePhoto,
            child: Container(
              decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300, width: 2), borderRadius: BorderRadius.circular(8)),
              child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.camera_alt, size: 32, color: Colors.grey), SizedBox(height: 4), Text('ถ่ายรูป', style: TextStyle(color: Colors.grey, fontSize: 12))]),
            ),
          );
        }
        return Stack(children: [
          ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(File(_photoPaths[index]), fit: BoxFit.cover, width: double.infinity, height: double.infinity)),
          Positioned(top: 4, right: 4, child: GestureDetector(onTap: () => _removePhoto(index), child: Container(padding: const EdgeInsets.all(2), decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle), child: const Icon(Icons.close, size: 16, color: Colors.white)))),
        ]);
      },
    );
  }
}
