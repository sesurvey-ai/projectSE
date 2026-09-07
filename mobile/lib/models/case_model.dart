class CaseModel {
  final int id;
  final String customerName;
  final String incidentLocation;
  final double? incidentLat;
  final double? incidentLng;
  final int? assignedTo;
  final String status;
  final String createdAt;
  final String? claimNo;
  /// ตีกลับให้ผู้สำรวจ (migration 041) — หัวหน้าส่งงานกลับมาให้แก้พร้อมเหตุผล
  /// `sentBackAt` มีค่า + status ยังเป็น assigned = ยังไม่ได้ส่งกลับไปให้ตรวจใหม่
  final String? sentBackAt;
  final String? sentBackReason;
  final int sentBackCount;
  /// เสร็จงานหน้างาน (migration 054, 07/09/69) — status 'finished': รับงานถัดไปได้ ยังกรอก/ส่งรายงานได้
  final String? finishedAt;

  CaseModel({
    required this.id,
    required this.customerName,
    required this.incidentLocation,
    this.incidentLat,
    this.incidentLng,
    this.assignedTo,
    required this.status,
    required this.createdAt,
    this.claimNo,
    this.sentBackAt,
    this.sentBackReason,
    this.sentBackCount = 0,
    this.finishedAt,
  });

  /// งานที่หัวหน้าตีกลับมาให้แก้ และยังไม่ได้ส่งกลับไป
  bool get isSentBack => (sentBackAt ?? '').isNotEmpty && status == 'assigned';

  /// กด "เสร็จงาน" หน้างานแล้ว ยังไม่ส่งรายงาน
  bool get isFinished => status == 'finished';

  /// อัปเดตสถานะในรายการทันทีหลังกด "เสร็จงาน" โดยไม่ต้องรอโหลดรายการใหม่
  CaseModel copyWith({String? status, String? finishedAt}) => CaseModel(
        id: id,
        customerName: customerName,
        incidentLocation: incidentLocation,
        incidentLat: incidentLat,
        incidentLng: incidentLng,
        assignedTo: assignedTo,
        status: status ?? this.status,
        createdAt: createdAt,
        claimNo: claimNo,
        sentBackAt: sentBackAt,
        sentBackReason: sentBackReason,
        sentBackCount: sentBackCount,
        finishedAt: finishedAt ?? this.finishedAt,
      );

  factory CaseModel.fromJson(Map<String, dynamic> json) => CaseModel(
        id: json['id'],
        customerName: json['customer_name'] ?? '',
        incidentLocation: json['incident_location'] ?? '',
        incidentLat: json['incident_lat'] != null
            ? double.parse(json['incident_lat'].toString())
            : null,
        incidentLng: json['incident_lng'] != null
            ? double.parse(json['incident_lng'].toString())
            : null,
        assignedTo: json['assigned_to'],
        status: json['status'] ?? '',
        createdAt: json['created_at'] ?? '',
        claimNo: json['claim_no'],
        sentBackAt: json['sent_back_at']?.toString(),
        sentBackReason: json['sent_back_reason']?.toString(),
        sentBackCount:
            int.tryParse(json['sent_back_count']?.toString() ?? '') ?? 0,
        finishedAt: json['finished_at']?.toString(),
      );
}
