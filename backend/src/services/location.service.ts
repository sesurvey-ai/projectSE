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

  async getLatestNearest(incidentLat: number, incidentLng: number, limit: number = 5) {
    const result = await db.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (sl.user_id)
           sl.*, u.first_name, u.last_name, u.username,
           (6371 * acos(
             LEAST(1.0, cos(radians($1)) * cos(radians(sl.latitude))
             * cos(radians(sl.longitude) - radians($2))
             + sin(radians($1)) * sin(radians(sl.latitude)))
           )) AS distance
         FROM surveyor_locations sl
         JOIN users u ON sl.user_id = u.id
         WHERE u.is_active = true AND u.role = 'surveyor'
         ORDER BY sl.user_id, sl.recorded_at DESC
       ) sub ORDER BY distance ASC LIMIT $3`,
      [incidentLat, incidentLng, limit]
    );
    return result.rows;
  },
};
