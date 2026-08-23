// src/middleware/errorHandler.js — Centralized error handling.
// All errors are normalized to: { error: { code, message, details? } }
import { MulterError } from "multer";
import { logger } from "../lib/logger.js";

/** Operational error with an HTTP status and a stable machine-readable code. */
export class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` },
  });
}

// Express requires the 4-arg signature to recognize this as an error handler.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Known operational errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Multer errors (file too large, too many files, ...)
  if (err instanceof MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Body-parser errors (e.g. malformed JSON) carry a safe-to-expose status
  if (err.expose && typeof err.statusCode === "number" && err.statusCode < 500) {
    return res.status(err.statusCode).json({
      error: { code: "BAD_REQUEST", message: err.message },
    });
  }

  // Unknown errors — log full details, but never leak internals to clients
  logger.error({ err, method: req.method, path: req.path }, "Unhandled error");
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
}
