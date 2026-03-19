import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { setupLocationHandler } from './locationHandler';

export function setupSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate socket connections with JWT
  io.use((socket, next) => {
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
      socket.data.user = decoded;
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

  return io;
}
