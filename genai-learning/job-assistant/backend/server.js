// server.js — Main entry point
import express from "express";
import cors from "cors";
import { config } from "./src/config/index.js";
import resumeRoutes from "./src/routes/resume.js";
import analysisRoutes from "./src/routes/analysis.js";
import sessionRoutes from "./src/routes/session.js";
import { errorHandler, notFound } from "./src/middleware/errorHandler.js";

const app = express();

// ── Middleware ──
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// ── Request logger ──
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ── Health check ──
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", port: config.port, timestamp: new Date().toISOString() });
});

// ── Routes ──
app.use("/api/resume", resumeRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/session", sessionRoutes);

// ── Error handling ──
app.use(notFound);
app.use(errorHandler);

// ── Start ──
app.listen(config.port, () => {
  console.log(`\n🚀 Job Assistant API: http://localhost:${config.port}`);
  console.log(`   Health: http://localhost:${config.port}/api/health`);
  console.log(`\n📁 Structure:`);
  console.log(`   src/config/     — App configuration`);
  console.log(`   src/routes/     — API route handlers`);
  console.log(`   src/services/   — AI business logic`);
  console.log(`   src/middleware/ — Upload, error handling`);
  console.log(`   src/utils/      — PDF parser, session store\n`);
});
