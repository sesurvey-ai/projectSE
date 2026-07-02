import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('15d'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  TYPHOON_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GEMINI_VERTEX: z.string().optional(),        // '1' = ใช้ Gemini ผ่าน Vertex AI (Firebase SA) แทน API key
  GEMINI_LOCATION: z.string().optional(),      // region ของ Vertex (default us-central1)
  GEMINI_MODEL: z.string().optional(),         // ชื่อโมเดล (default gemini-3.1-flash-lite)
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  UPLOAD_DIR: z.string().default('./src/uploads'),
  MAX_FILE_SIZE: z.coerce.number().default(10485760),
});

export const env = envSchema.parse(process.env);
