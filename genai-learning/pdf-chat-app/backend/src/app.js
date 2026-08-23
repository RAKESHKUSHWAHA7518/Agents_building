// src/app.js — Express application assembly (kept separate for testability).
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { healthRouter } from "./routes/health.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { sessionRouter } from "./routes/session.routes.js";
import { documentRouter } from "./routes/document.routes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { optionalAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — only allow the configured frontend origin
  app.use(cors({ origin: env.CORS_ORIGIN }));

  app.use(express.json({ limit: "1mb" }));

  // Structured request logging
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
    })
  );

  // Rate limiting on all API routes
  app.use("/api", apiLimiter);

  // Attach req.userId when a valid JWT is present (all /api routes)
  app.use("/api", optionalAuth);

  // Routes
  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api", documentRouter);
  app.use("/api", sessionRouter);

  // 404 + centralized error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
