import { db } from '../config/database';
import { getIO } from '../socket';

// ลบพิกัดล่าสุดของ surveyor ออกจากตาราง + แจ้ง Call Center ให้เอาหมุดออกจากแผนที่ทันที
// ใช้ตอน "ออกจากระบบ" และ "ลงเวลาออกงาน" — กันไม่ให้หมุดของคนที่ไม่ได้ออนไลน์แล้วค้างบนแผนที่
export async function clearSurveyorLocation(userId: number): Promise<void> {
  await db.query('DELETE FROM surveyor_locations WHERE user_id = $1', [userId]);
  getIO()?.to('role:callcenter').emit('location_remove', { user_id: String(userId) });
}
