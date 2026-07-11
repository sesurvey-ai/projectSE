import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { db } from '../config/database';
import { setupLocationHandler } from './locationHandler';

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function setupSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate socket connections with JWT + เช็คสถานะบัญชีสดกับ DB (เพิกถอนสิทธิ์ได้ทันที)
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        id: number;
        username: string;
        role: string;
      };
      const result = await db.query(
        'SELECT id, username, role, is_active FROM users WHERE id = $1 LIMIT 1',
        [decoded.id]
      );
      const user = result.rows[0];
      if (!user || !user.is_active) {
        return next(new Error('Account is deactivated'));
      }
      socket.data.user = { id: user.id, username: user.username, role: user.role };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`Socket connected: ${user.username} (${user.role})`);

    // Join role-based room
    socket.join(`role:${user.role}`);
    socket.join(`user:${user.id}`);

    setupLocationHandler(io, socket);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${user.username}`);
    });
  });

  ioInstance = io;
  return io;
}
