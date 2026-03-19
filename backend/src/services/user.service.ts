import { db } from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';

export const userService = {
  async getProfile(userId: number) {
    const result = await db.query(
      'SELECT id, username, first_name, last_name, role, supervisor_id, is_active, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    return result.rows[0];
  },

  async updateFcmToken(userId: number, fcmToken: string) {
    await db.query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [fcmToken, userId]
    );
  },
};
