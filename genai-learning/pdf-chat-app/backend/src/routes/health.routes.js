// src/routes/health.routes.js — Liveness endpoint for load balancers / dashboards.
import { Router } from "express";
import { sessionService } from "../services/sessionService.js";
import { pingDatabase } from "../db/database.js";

export const healthRouter = Router();

healthRouter.get("/health", async (req, res) => {
  let mongo = "down";
  try {
    await pingDatabase();
    mongo = "up";
  } catch {
    // keep "down"
  }
  res.status(mongo === "up" ? 200 : 503).json({
    status: mongo === "up" ? "ok" : "degraded",
    mongo,
    uptime: Math.round(process.uptime()),
    activeSessions: sessionService.size,
    timestamp: new Date().toISOString(),
  });
});
