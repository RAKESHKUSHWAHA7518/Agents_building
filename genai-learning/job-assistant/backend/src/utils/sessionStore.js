// src/utils/sessionStore.js — In-memory session management
// In production, replace with Redis or a database

const sessions = new Map();

export const sessionStore = {
  set(id, data) {
    sessions.set(id, { ...data, createdAt: Date.now() });
  },

  get(id) {
    return sessions.get(id) || null;
  },

  update(id, data) {
    const existing = sessions.get(id);
    if (!existing) return false;
    sessions.set(id, { ...existing, ...data });
    return true;
  },

  delete(id) {
    return sessions.delete(id);
  },

  // Clean up sessions older than 1 hour
  cleanup() {
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      if (now - session.createdAt > oneHour) {
        sessions.delete(id);
      }
    }
  },
};

// Auto cleanup every 30 minutes
setInterval(() => sessionStore.cleanup(), 30 * 60 * 1000);
