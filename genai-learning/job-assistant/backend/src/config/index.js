// src/config/index.js — Centralized configuration
import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 3003,
  geminiApiKey: process.env.GEMINI_API_KEY,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5175",
  uploadMaxSize: 5 * 1024 * 1024, // 5MB
  uploadDir: "uploads",
};

// Validate required config
if (!config.geminiApiKey) {
  console.error("❌ GEMINI_API_KEY is required in .env file");
  process.exit(1);
}
