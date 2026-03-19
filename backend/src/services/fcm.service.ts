import { admin } from '../config/firebase';

export const fcmService = {
  async sendNotification(fcmToken: string, title: string, body: string, data?: Record<string, string>) {
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: data || {},
        android: { priority: 'high' as const },
        apns: { payload: { aps: { 'content-available': 1 } } },
      });
    } catch (err) {
      console.error('FCM notification error:', err);
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
