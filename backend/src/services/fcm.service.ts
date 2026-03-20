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
