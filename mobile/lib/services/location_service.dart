import 'package:geolocator/geolocator.dart';

// สาเหตุที่หาพิกัดไม่ได้ — แยก "สิทธิ์/ปิด GPS" ออกจาก "หาพิกัดไม่ทัน/สัญญาณอ่อน"
enum LocFail { permission, noFix }

class LocResult {
  final Position? position;
  final LocFail? fail;
  const LocResult.ok(this.position) : fail = null;
  const LocResult.failed(this.fail) : position = null;
}

class LocationService {
  Future<bool> checkAndRequestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    return true;
  }

  Future<Position?> getCurrentPosition() async {
    final hasPermission = await checkAndRequestPermission();
    if (!hasPermission) return null;

    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 15),
      ),
    );
  }

  // สำหรับลงเวลา: ลอง high-accuracy ก่อน ถ้าช้า/ไม่ได้ (สัญญาณอ่อนที่หน้างาน) → ใช้ last-known แทน
  // แยกสาเหตุชัด เพื่อให้แจ้งผู้ใช้ถูก (เปิด GPS/อนุญาต vs หาพิกัดไม่ได้ชั่วคราว)
  Future<LocResult> getPositionForCheckIn() async {
    final hasPermission = await checkAndRequestPermission();
    if (!hasPermission) return const LocResult.failed(LocFail.permission);
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      return LocResult.ok(pos);
    } catch (_) {
      // high-accuracy ไม่ทัน/ไม่ได้ → fallback ตำแหน่งล่าสุดที่เครื่องรู้ (พอยืนยันว่าอยู่จุดไหน)
      try {
        final last = await Geolocator.getLastKnownPosition();
        if (last != null) return LocResult.ok(last);
      } catch (_) {}
      return const LocResult.failed(LocFail.noFix);
    }
  }
}
