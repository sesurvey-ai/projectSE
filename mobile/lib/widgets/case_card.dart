import 'package:flutter/material.dart';
import '../models/case_model.dart';

class CaseCard extends StatelessWidget {
  final CaseModel caseModel;
  final VoidCallback onTap;

  const CaseCard({
    super.key,
    required this.caseModel,
    required this.onTap,
  });

  // ⛔ ต้องครอบ **ทุกค่า** ของ case_status ที่ฐานข้อมูลมีจริง
  //    (pending · assigned · surveyed · reviewed + declined)
  //    เดิมแปลแค่ 4 ค่าที่ไม่ตรงกับของจริงเลย ('in_progress'/'completed' ไม่มีในระบบ)
  //    ค่าที่ตกหล่นจะหลุดไปโชว์เป็นภาษาอังกฤษดิบ ๆ บนหน้าจอช่าง (เจอจริง 18/08/69: 'surveyed')
  Color _statusColor(String status) {
    switch (status) {
      case 'assigned':
        return Colors.orange;
      case 'surveyed':
        return Colors.blue;
      case 'reviewed':
        return Colors.green;
      case 'declined':
        return Colors.red;
      case 'pending':
      default:
        return Colors.grey;
    }
  }

  String _statusText(String status) {
    switch (status) {
      case 'assigned':
        return 'มอบหมายแล้ว';
      case 'surveyed':
        return 'ส่งงานแล้ว';
      case 'reviewed':
        return 'หัวหน้าอนุมัติแล้ว';
      case 'declined':
        return 'ปฏิเสธงาน';
      case 'pending':
        return 'รอมอบหมาย';
      default:
        return status;
    }
  }

  String _formatDate(String dateStr) {
    try {
      // backend ส่ง ISO string เป็น UTC (ลงท้าย Z) — ต้อง .toLocal() ก่อน ไม่งั้นเวลาช้ากว่าไทย 7 ชม.
      final date = DateTime.parse(dateStr).toLocal();
      // ปีแสดงเป็น พ.ศ. ให้ตรงกับส่วนอื่นของแอป
      return '${date.day}/${date.month}/${date.year + 543} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      elevation: 2,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      caseModel.claimNo ?? 'ไม่มีเลขเคลม',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: (caseModel.isSentBack ? Colors.deepOrange : _statusColor(caseModel.status))
                          .withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      caseModel.isSentBack ? 'ตีกลับให้แก้' : _statusText(caseModel.status),
                      style: TextStyle(
                        color: caseModel.isSentBack ? Colors.deepOrange : _statusColor(caseModel.status),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              // งานที่หัวหน้าตีกลับ — ต้องบอก **เหตุผล** ไม่งั้นช่างส่งของเดิมกลับไปเหมือนเดิม
              if (caseModel.isSentBack) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.deepOrange.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.deepOrange.withValues(alpha: 0.35)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.assignment_return_outlined,
                          size: 16, color: Colors.deepOrange),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          (caseModel.sentBackReason ?? '').trim().isEmpty
                              ? 'หัวหน้าส่งงานกลับมาให้แก้'
                              : 'หัวหน้าให้แก้: ${caseModel.sentBackReason!.trim()}',
                          style: const TextStyle(
                              fontSize: 13, height: 1.35, color: Colors.deepOrange),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.location_on, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      caseModel.incidentLocation,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.grey,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.access_time, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(
                    _formatDate(caseModel.createdAt),
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
