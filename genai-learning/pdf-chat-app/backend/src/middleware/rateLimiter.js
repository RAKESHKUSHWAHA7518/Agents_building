// src/middleware/rateLimiter.js — Protects the API from abuse and runaway costs.
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const rateLimitMessage = {
  error: { code: "RATE_LIMITED", message: "Too many requests, please try again later." },
};

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
});

// Stricter limiter for expensive operations (upload triggers embeddings calls)
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: env.UPLOAD_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
});
