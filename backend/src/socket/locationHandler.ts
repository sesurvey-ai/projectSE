import { Server, Socket } from 'socket.io';
import { locationService } from '../services/location.service';
import { db } from '../config/database';

export function setupLocationHandler(io: Server, socket: Socket) {
  const user = socket.data.user;

  // Call Center requests location from all surveyors
  if (user.role === 'callcenter') {
    socket.on('request_location', (data: { request_id: string }) => {
      console.log(`Location request from ${user.username}, request_id: ${data.request_id}`);
      io.to('role:surveyor').emit('request_location', {
        request_id: data.request_id,
        requested_by: user.id,
      });
    });
  }

  // Surveyor responds with their location
  if (user.role === 'surveyor') {
    socket.on('location_response', async (data: { request_id: string; latitude: number; longitude: number }) => {
      try {
        // Save to database
        await locationService.saveLocation(user.id, data.latitude, data.longitude, data.request_id);

        // Fetch user details for the broadcast
        const userResult = await db.query('SELECT first_name, last_name FROM users WHERE id = $1', [user.id]);
        const userInfo = userResult.rows[0] || {};

        // Forward to call center with user info
        io.to('role:callcenter').emit('location_update', {
          user_id: String(user.id),
          username: user.username,
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
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
