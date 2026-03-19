import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/case_provider.dart';
import '../models/case_model.dart';

class CaseDetailScreen extends StatelessWidget {
  final int caseId;

  const CaseDetailScreen({super.key, required this.caseId});

  Color _statusColor(String status) {
    switch (status) {
      case 'assigned':
        return Colors.orange;
      case 'in_progress':
        return Colors.blue;
      case 'completed':
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
      case 'in_progress':
        return 'กำลังดำเนินการ';
      case 'completed':
        return 'เสร็จสิ้น';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('รายละเอียดงาน'),
      ),
      body: Consumer<CaseProvider>(
        builder: (context, caseProvider, _) {
          final CaseModel? caseModel = caseProvider.getCaseById(caseId);

          if (caseModel == null) {
            return const Center(
              child: Text(
                'ไม่พบข้อมูลงาน',
                style: TextStyle(fontSize: 16, color: Colors.grey),
              ),
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
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 8),
                    decoration: BoxDecoration(
                      color: _statusColor(caseModel.status)
                          .withValues(alpha: 0.15),
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
                        const Text(
                          'ข้อมูลลูกค้า',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const Divider(),
                        _buildInfoRow(
                            Icons.person, 'ชื่อลูกค้า', caseModel.customerName),
                        const SizedBox(height: 12),
                        _buildInfoRow(Icons.location_on, 'สถานที่เกิดเหตุ',
                            caseModel.incidentLocation),
                        if (caseModel.incidentLat != null &&
                            caseModel.incidentLng != null) ...[
                          const SizedBox(height: 12),
                          _buildInfoRow(
                            Icons.gps_fixed,
                            'พิกัด',
                            '${caseModel.incidentLat!.toStringAsFixed(6)}, ${caseModel.incidentLng!.toStringAsFixed(6)}',
                          ),
                        ],
                        const SizedBox(height: 12),
                        _buildInfoRow(Icons.access_time, 'วันที่สร้าง',
                            _formatDate(caseModel.createdAt)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Survey button
                if (caseModel.status == 'assigned')
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: () =>
                          context.go('/cases/${caseModel.id}/survey'),
                      icon: const Icon(Icons.assignment),
                      label: const Text(
                        'เริ่มสำรวจ',
                        style: TextStyle(fontSize: 16),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
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
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(fontSize: 16),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
