import { Server, Socket } from 'socket.io';
import { locationService } from '../services/location.service';
import { db } from '../config/database';
import { fcmService } from '../services/fcm.service';

export function setupLocationHandler(io: Server, socket: Socket) {
  const user = socket.data.user;

  // Call Center requests location from all surveyors
  if (user.role === 'callcenter') {
    socket.on('request_location', async (data: { request_id: string }) => {
      console.log(`Location request from ${user.username}, request_id: ${data.request_id}`);

      // ส่ง Socket.IO ไปหา surveyor ที่ online (เผื่อมีที่ยังใช้ Socket)
      io.to('role:surveyor').emit('request_location', {
        request_id: data.request_id,
        requested_by: user.id,
      });

      // ส่ง FCM ไปหา surveyor ทุกคนที่มี fcm_token (สำหรับมือถือที่ไม่ได้เชื่อม Socket)
      try {
        const result = await db.query(
          "SELECT id, fcm_token FROM users WHERE role = 'surveyor' AND is_active = true AND fcm_token IS NOT NULL"
        );
        // นับผลจริง — เดิม log ว่า "ส่งให้ N คน" โดยนับจากจำนวนแถวใน DB
        // ไม่ใช่จำนวนที่ส่งสำเร็จ คนไม่มี token ก็ถูกนับรวม = ตัวเลขโกหก
        let sent = 0, noToken = 0, failed = 0;
        for (const surveyor of result.rows) {
          if (!surveyor.fcm_token) { noToken++; continue; }
          try {
            await fcmService.sendSilentPush(surveyor.fcm_token, {
              type: 'request_location',
              request_id: data.request_id,
            });
            sent++;
          } catch (e) {
            failed++;
            console.error(`[FCM] request_location ไปไม่ถึง user ${surveyor.id}:`, e);
          }
        }
        console.log(`[FCM] request_location — ส่งสำเร็จ ${sent} · ไม่มี token ${noToken} · ล้มเหลว ${failed}`);
        if (sent === 0 && result.rows.length > 0) {
          console.error('[FCM] เรียกพิกัดไม่ถึงใครเลย — แผนที่จะว่างโดยไม่มีสาเหตุให้ผู้ใช้เห็น');
        }
      } catch (err) {
        console.error('[FCM] Error sending request_location:', err);
      }
    });
  }

  // Surveyor responds with their location (via Socket.IO — legacy)
  if (user.role === 'surveyor') {
    socket.on('location_response', async (data: { request_id: string; latitude: number; longitude: number }) => {
      try {
        await locationService.saveLocation(user.id, data.latitude, data.longitude, data.request_id);

        const userResult = await db.query('SELECT first_name, last_name, code FROM users WHERE id = $1', [user.id]);
        const userInfo = userResult.rows[0] || {};

        io.to('role:callcenter').emit('location_update', {
          user_id: String(user.id),
          username: user.username,
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          // รหัสพนักงาน — คนจ่ายงานใช้ระบุตัวคนได้แน่กว่าชื่อ (ชื่อซ้ำกันได้)
          code: userInfo.code ?? null,
          latitude: data.latitude,
          longitude: data.longitude,
          request_id: data.request_id,
        });
      } catch (err) {
        console.error('Error saving location:', err);
      }
    });
  }
}
