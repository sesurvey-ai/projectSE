class User {
  final int id;
  final String username;
  final String firstName;
  final String lastName;
  final String role;
  final String code; // รหัสพนักงาน เช่น SE480 (ว่างได้ถ้า user ไม่มีรหัส)

  User({
    required this.id,
    required this.username,
    required this.firstName,
    required this.lastName,
    required this.role,
    this.code = '',
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'],
        username: json['username'],
        firstName: json['first_name'] ?? '',
        lastName: json['last_name'] ?? '',
        role: json['role'] ?? '',
        code: json['code'] ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'first_name': firstName,
        'last_name': lastName,
        'role': role,
        'code': code,
      };
}
