// src/middleware/auth.js — Authentication middleware.
import { env } from "../config/env.js";
import { verifyToken } from "../services/authService.js";
import { ApiError } from "./errorHandler.js";

/**
 * Attaches req.userId when a valid Bearer token is present.
 * Invalid/expired tokens are treated as anonymous (never throws).
 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    req.userId = verifyToken(header.slice(7));
  }
  next();
}

/** Rejects anonymous requests with 401. Use on protected routes. */
export function requireAuth(req, res, next) {
  if (!req.userId) {
    return next(new ApiError(401, "AUTH_REQUIRED", "Authentication required"));
  }
  next();
}

/** Client-generated UUID identifying anonymous trial users. */
export function getGuestId(req) {
  const guestId = req.headers["x-guest-id"];
  return typeof guestId === "string" && guestId.length >= 8 && guestId.length <= 64
    ? guestId
    : null;
}
