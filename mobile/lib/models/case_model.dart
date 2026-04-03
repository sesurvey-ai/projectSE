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
  });

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
      );
}
