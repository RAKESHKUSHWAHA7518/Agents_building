// src/services/sessionService.js — Session lifecycle management.
// - Cryptographically secure session IDs (crypto.randomUUID)
// - TTL-based expiry with periodic cleanup (prevents memory leaks)
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const CLEANUP_INTERVAL_MS = 60_000;

class SessionService {
  constructor() {
    this.sessions = new Map();
    this.onEndCallbacks = [];
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref(); // don't keep the process alive just for this timer
  }

  /** Registers a callback fired whenever a session ends (deleted or expired). */
  onSessionEnd(fn) {
    this.onEndCallbacks.push(fn);
  }

  notifySessionEnd(sessionId, session) {
    for (const fn of this.onEndCallbacks) {
      Promise.resolve(fn(sessionId, session)).catch((err) =>
        logger.error({ err, sessionId }, "Session-end hook failed")
      );
    }
  }

  generateId() {
    return crypto.randomUUID();
  }

  create(sessionId, data) {
    this.sessions.set(sessionId, {
      ...data,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    });
    logger.info({ sessionId, fileName: data.fileName }, "Session created");
    return sessionId;
  }

  get(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.lastAccessedAt = Date.now(); // sliding expiry
    return session;
  }

  delete(sessionId) {
    const session = this.sessions.get(sessionId);
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.info({ sessionId }, "Session deleted");
      this.notifySessionEnd(sessionId, session);
    }
    return deleted;
  }

  cleanupExpired() {
    const ttlMs = env.SESSION_TTL_MINUTES * 60_000;
    const now = Date.now();
    let removed = 0;
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccessedAt > ttlMs) {
        this.sessions.delete(sessionId);
        removed++;
        this.notifySessionEnd(sessionId, session);
      }
    }
    if (removed > 0) {
      logger.info({ removed, remaining: this.sessions.size }, "Expired sessions cleaned up");
    }
  }

  shutdown() {
    clearInterval(this.cleanupTimer);
    this.sessions.clear();
  }

  get size() {
    return this.sessions.size;
  }
}

export const sessionService = new SessionService();
