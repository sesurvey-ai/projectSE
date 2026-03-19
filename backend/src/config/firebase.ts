import admin from 'firebase-admin';
import { env } from './env';

let firebaseInitialized = false;

export function initFirebase(): void {
  if (firebaseInitialized) return;

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    firebaseInitialized = true;
    console.log('Firebase Admin initialized');
  } else {
    console.warn('Firebase credentials not configured — push notifications disabled');
  }
}

export { admin };
