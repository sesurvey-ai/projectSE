import { db } from '../config/database';

export const locationService = {
  async saveLocation(userId: number, latitude: number, longitude: number, requestId?: string) {
    const result = await db.query(
      `INSERT INTO surveyor_locations (user_id, latitude, longitude, request_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, latitude, longitude, requestId || null]
    );
    return result.rows[0];
  },

  async getLatest() {
    const result = await db.query(
      `SELECT DISTINCT ON (sl.user_id)
         sl.*, u.first_name, u.last_name, u.username
       FROM surveyor_locations sl
       JOIN users u ON sl.user_id = u.id
       WHERE u.is_active = true AND u.role = 'surveyor'
       ORDER BY sl.user_id, sl.recorded_at DESC`
    );
    return result.rows;
  },
};
