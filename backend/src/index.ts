import http from 'http';
import app from './app';
import { env } from './config/env';
import { initFirebase } from './config/firebase';
import { setupSocket } from './socket';
import { startUploadSweeper } from './utils/uploadSweeper';

const server = http.createServer(app);

// Initialize Firebase (optional — skips if no credentials)
initFirebase();

// Initialize Socket.io
setupSocket(server);

// กวาดไฟล์ OCR temp ที่ค้าง (orphan) ใน uploads root เป็นระยะ
startUploadSweeper();

server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
});

export { server };
