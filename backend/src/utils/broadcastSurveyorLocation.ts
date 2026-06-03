import { db } from '../config/database';
import { getIO } from '../socket';
import { locationService } from '../services/location.service';

// บันทึกพิกัด surveyor ลงตาราง surveyor_locations + แจ้ง Call Center ให้ขึ้น/ขยับหมุดบนแผนที่ทันที
// ใช้ตอน "ลงเวลาเข้างาน" (พิกัดตอน check-in) — แผนที่จึงเห็นพนักงานทันทีโดยไม่ต้องรอ FCM
export async function broadcastSurveyorLocation(
  userId: number,
  latitude: number,
  longitude: number,
  requestId?: string,
): Promise<void> {
  await locationService.saveLocation(userId, latitude, longitude, requestId);
  const { rows } = await db.query(
    'SELECT username, first_name, last_name FROM users WHERE id = $1',
    [userId],
  );
  const u = rows[0] || {};
  getIO()?.to('role:callcenter').emit('location_update', {
    user_id: String(userId),
    username: u.username,
    first_name: u.first_name,
    last_name: u.last_name,
    latitude,
    longitude,
    request_id: requestId || null,
  });
}
