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

  @override
  void initState() {
    super.initState();
    _fetchDetail();
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

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      return '${date.day}/${date.month}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateStr;
    }
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

                // Customer info card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('ข้อมูลลูกค้า', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        const Divider(),
                        _buildInfoRow(Icons.person, 'ชื่อลูกค้า', caseModel.customerName),
                        const SizedBox(height: 12),
                        _buildInfoRow(Icons.location_on, 'สถานที่เกิดเหตุ', caseModel.incidentLocation),
                        if (caseModel.incidentLat != null && caseModel.incidentLng != null) ...[
                          const SizedBox(height: 12),
                          _buildInfoRow(Icons.gps_fixed, 'พิกัด',
                              '${caseModel.incidentLat!.toStringAsFixed(6)}, ${caseModel.incidentLng!.toStringAsFixed(6)}'),
                        ],
                        const SizedBox(height: 12),
                        _buildInfoRow(Icons.access_time, 'วันที่สร้าง', _formatDate(caseModel.createdAt)),
                      ],
                    ),
                  ),
                ),
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

          const Divider(height: 1),

          // Driver info
          _buildSection('ข้อมูลผู้ขับขี่', [
            _buildTableRow('เพศ', _val('driver_gender') == 'M' ? 'ชาย' : _val('driver_gender') == 'F' ? 'หญิง' : '-'),
            _buildTableRow('คำนำหน้า', _val('driver_title')),
            _buildTableRow('ชื่อ', _val('driver_first_name')),
            _buildTableRow('นามสกุล', _val('driver_last_name')),
            _buildTableRow('ความสัมพันธ์', _val('driver_relation')),
            _buildTableRow('อายุ', _val('driver_age')),
            _buildTableRow('วันเกิด', _val('driver_birthdate')),
            _buildTableRow('ที่อยู่', _val('driver_address')),
            _buildTableRow('โทรศัพท์', _val('driver_phone')),
            _buildTableRow('เลขบัตรประชาชน', _val('driver_id_card')),
            _buildTableRow('เลขใบขับขี่', _val('driver_license_no')),
            _buildTableRow('ประเภทใบขับขี่', _val('driver_license_type')),
          ]),

          const Divider(height: 1),

          // Damage info
          _buildSection('ความเสียหาย', [
            _buildTableRow('ระดับความเสียหาย', _val('damage_level')),
            _buildTableRow('รายละเอียด', _val('damage_description')),
            _buildTableRow('ประมาณค่าเสียหาย', _val('estimated_cost') != '-' ? '${_val('estimated_cost')} บาท' : '-'),
          ]),
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

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: Colors.blue),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontSize: 16)),
            ],
          ),
        ),
      ],
    );
  }
}
