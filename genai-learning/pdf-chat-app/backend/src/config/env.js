// src/config/env.js — Centralized, validated environment configuration.
// The app fails fast at startup if required config is missing or invalid.
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Auth
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  GUEST_FREE_UPLOADS: z.coerce.number().int().positive().default(1),

  // MongoDB (Atlas cloud, or local Atlas deployment via docker compose)
  MONGODB_URI: z.string().default("mongodb://localhost:27017"),
  MONGODB_DB: z.string().default("pdf_chat"),
  VECTOR_SEARCH_INDEX: z.string().default("vector_index"),

  // Gemini / models
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_CHAT_MODEL: z.string().default("gemini-flash-latest"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-2"),

  // Uploads
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(10),

  // Sessions
  SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  MAX_HISTORY_MESSAGES: z.coerce.number().int().positive().default(20),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
