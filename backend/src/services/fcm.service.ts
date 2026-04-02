import { admin } from '../config/firebase';

export const fcmService = {
  async sendNotification(fcmToken: string, title: string, body: string, data?: Record<string, string>) {
    try {
      console.log(`[FCM] Sending notification: "${title}" to token: ${fcmToken.substring(0, 20)}...`);
      const result = await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: data || {},
        android: { priority: 'high' as const },
        apns: { payload: { aps: { 'content-available': 1 } } },
      });
      console.log('[FCM] Message sent successfully, ID:', result);
      return result;
    } catch (err) {
      console.error('[FCM] notification error:', err);
      throw err;
    }
  },

  // ส่ง data-only message สำหรับ urgent notification (เสียงดังไม่หยุด)
  async sendUrgentSurvey(fcmToken: string, caseId: number, customerName: string, address: string) {
    try {
      console.log(`[FCM] Sending urgent survey notification for case ${caseId}`);
      const result = await admin.messaging().send({
        token: fcmToken,
        data: {
          type: 'new_survey',
          case_id: String(caseId),
          title: customerName,
          address: address,
          created_at: new Date().toISOString(),
        },
        android: { priority: 'high' as const },
        apns: {
          payload: { aps: { 'content-available': 1 } },
          headers: { 'apns-priority': '10' },
        },
      });
      console.log('[FCM] Urgent survey sent, ID:', result);
      return result;
    } catch (err) {
      console.error('[FCM] Urgent survey error:', err);
      throw err;
    }
  },

  async sendSilentPush(fcmToken: string, data: Record<string, string>) {
    try {
      await admin.messaging().send({
        token: fcmToken,
        data,
        android: { priority: 'high' as const },
        apns: { payload: { aps: { 'content-available': 1 } } },
      });
    } catch (err) {
      console.error('FCM silent push error:', err);
    }
  },
};
