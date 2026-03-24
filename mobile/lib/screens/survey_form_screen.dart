import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/case_provider.dart';

class SurveyFormScreen extends StatefulWidget {
  final int caseId;
  const SurveyFormScreen({super.key, required this.caseId});

  @override
  State<SurveyFormScreen> createState() => _SurveyFormScreenState();
}

class _SurveyFormScreenState extends State<SurveyFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final List<String> _photoPaths = [];

  @override
  void initState() {
    super.initState();
    _loadDraft();
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

  // === ความเสียหาย ===
  final _damageDescCtl = TextEditingController();
  final _estimatedCostCtl = TextEditingController();

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
      _driverRelationCtl, _damageDescCtl, _estimatedCostCtl,
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

  Future<void> _takePhoto() async {
    try {
      final XFile? photo = await _picker.pickImage(source: ImageSource.camera, imageQuality: 80, maxWidth: 1920);
      if (photo != null) setState(() => _photoPaths.add(photo.path));
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
    if (!_formKey.currentState!.validate()) return;
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
        builder: (context, cp, _) => FloatingActionButton(
          onPressed: cp.isSubmitting ? null : _saveDraft,
          backgroundColor: const Color(0xFF0174BE),
          child: cp.isSubmitting
            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : const Icon(Icons.save, color: Colors.white),
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
                        Expanded(child: _claimChip('งานนัดหมาย', 'A')),
                        const SizedBox(width: 4),
                        Expanded(child: _claimChip('งานติดตาม', 'C')),
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
                      Row(children: [
                        Expanded(child: _txt(_prbNumberCtl, 'เลข พรบ.', Icons.description)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_policyNoCtl, 'เลขกรมธรรม์', Icons.pin)),
                      ]),
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
                      _txt(_licensePlateCtl, 'หมายเลขทะเบียน *', Icons.confirmation_number, required: true),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_carProvinceCtl, 'จังหวัด', Icons.location_city)),
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
                        Expanded(child: _txt(_carBrandCtl, 'ยี่ห้อ *', Icons.branding_watermark, required: true)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_carModelCtl, 'รุ่น', Icons.model_training)),
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_carColorCtl, 'สีรถ *', Icons.color_lens, required: true)),
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
                        Expanded(child: _numField(_mileageCtl, 'หมายเลข กม. *', Icons.speed)),
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
                      Row(children: [
                        // เพศ
                        Expanded(
                          flex: 1,
                          child: Wrap(spacing: 4, children: [
                            ChoiceChip(label: const Text('ชาย'), selected: _driverGender == 'M', onSelected: (_) => setState(() { _driverGender = 'M'; _driverTitle = 'นาย'; })),
                            ChoiceChip(label: const Text('หญิง'), selected: _driverGender == 'F', onSelected: (_) => setState(() { _driverGender = 'F'; _driverTitle = 'นางสาว'; })),
                          ]),
                        ),
                        const SizedBox(width: 8),
                        // คำนำหน้า (กรองตามเพศ)
                        Expanded(
                          flex: 1,
                          child: DropdownButtonFormField<String>(
                            key: ValueKey(_driverGender),
                            initialValue: _driverTitle,
                            decoration: const InputDecoration(labelText: 'คำนำหน้า', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12)),
                            items: _driverGender == 'M'
                              ? const [
                                  DropdownMenuItem(value: 'นาย', child: Text('นาย')),
                                  DropdownMenuItem(value: 'ด.ช.', child: Text('ด.ช.')),
                                  DropdownMenuItem(value: 'คุณ', child: Text('คุณ')),
                                ]
                              : _driverGender == 'F'
                              ? const [
                                  DropdownMenuItem(value: 'นาง', child: Text('นาง')),
                                  DropdownMenuItem(value: 'นางสาว', child: Text('นางสาว')),
                                  DropdownMenuItem(value: 'ด.ญ.', child: Text('ด.ญ.')),
                                  DropdownMenuItem(value: 'คุณ', child: Text('คุณ')),
                                ]
                              : const [
                                  DropdownMenuItem(value: '0', child: Text('- คำนำหน้า -')),
                                ],
                            onChanged: (v) => setState(() => _driverTitle = v!),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_driverNameCtl, 'ชื่อ *', Icons.person_outline, required: true)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_driverLastnameCtl, 'นามสกุล', Icons.person_outline)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_driverRelationCtl, 'ความสัมพันธ์กับเจ้าของรถ', Icons.people),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _numField(_driverAgeCtl, 'อายุ *', Icons.cake)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_driverBirthdateCtl, 'วันเกิด (วว/ดด/ปปปป)', Icons.calendar_month)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_driverAddressCtl, 'ที่อยู่ปัจจุบัน', Icons.home),
                      const SizedBox(height: 12),
                      _txt(_driverPhoneCtl, 'โทรศัพท์ *', Icons.phone, required: true, keyboardType: TextInputType.phone),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_driverIdCardCtl, 'บัตรประชาชน *', Icons.credit_card, required: true, keyboardType: TextInputType.number)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_driverLicenseNoCtl, 'ใบอนุญาตขับขี่เลขที่ *', Icons.card_membership, required: true)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_driverLicenseTypeCtl, 'ประเภทใบขับขี่', Icons.badge),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_driverLicensePlaceCtl, 'ออกให้ที่', Icons.location_on)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_driverLicenseStartCtl, 'ออกให้วันที่', Icons.event_available)),
                      ]),
                      const SizedBox(height: 12),
                      _txt(_driverLicenseEndCtl, 'หมดอายุวันที่', Icons.event_busy),
                      const SizedBox(height: 24),

                      // ========== 5. ความเสียหาย ==========
                      _sectionHeader('ความเสียหายรถประกันภัย', Icons.report_problem),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _damageDescCtl,
                        decoration: const InputDecoration(labelText: 'รายละเอียดความเสียหาย', border: OutlineInputBorder(), alignLabelWithHint: true),
                        maxLines: 4,
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
                      _txt(_accPlaceCtl, 'สถานที่เกิดเหตุ *', Icons.location_on, required: true),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_accProvinceCtl, 'จังหวัด', Icons.location_city)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_accDistrictCtl, 'เขต/อำเภอ', Icons.map)),
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _txt(_accCauseCtl, 'ลักษณะการเกิดเหตุ', Icons.warning)),
                        const SizedBox(width: 12),
                        Expanded(child: _txt(_accDamageTypeCtl, 'ลักษณะความเสียหาย', Icons.broken_image)),
                      ]),
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
  static const _fieldPadding = EdgeInsets.symmetric(horizontal: 12, vertical: 12);

  Widget _txt(TextEditingController ctl, String label, IconData icon, {bool required = false, TextInputType? keyboardType}) {
    return TextFormField(
      controller: ctl,
      style: const TextStyle(fontSize: 14),
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

  Widget _numField(TextEditingController ctl, String label, IconData icon, {bool decimal = false}) {
    return TextFormField(
      controller: ctl,
      style: const TextStyle(fontSize: 14),
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
