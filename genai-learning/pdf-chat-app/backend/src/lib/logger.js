// src/lib/logger.js — Structured JSON logging (pino).
// Pretty output in development, machine-readable JSON in production.
import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
  // Never log secrets even if they leak into a log object
  redact: ["req.headers.authorization", "req.headers.cookie", "*.apiKey"],
});
