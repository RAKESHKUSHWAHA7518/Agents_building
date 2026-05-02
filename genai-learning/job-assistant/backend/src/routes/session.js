// src/routes/session.js — Session management routes
import { Router } from "express";
import { sessionStore } from "../utils/sessionStore.js";

const router = Router();

// DELETE /api/session/:id — Clear a session
router.delete("/:id", (req, res) => {
  sessionStore.delete(req.params.id);
  res.json({ message: "Session cleared" });
});

// GET /api/session/:id — Get session info (without sensitive data)
router.get("/:id", (req, res) => {
  const session = sessionStore.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json({
    fileName: session.fileName,
    pageCount: session.pageCount,
    hasAnalysis: !!session.analysis,
    hasRewrite: !!session.rewrittenResume,
    hasCoverLetter: !!session.coverLetter,
  });
});

export default router;
