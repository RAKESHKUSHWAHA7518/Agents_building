import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 3004,
  geminiApiKey: process.env.GEMINI_API_KEY,
  nvidiaApiKey: process.env.NVIDIA_API_KEY,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5176",
};

if (!config.nvidiaApiKey) {
  console.error("❌ NVIDIA_API_KEY required");
  process.exit(1);
}
