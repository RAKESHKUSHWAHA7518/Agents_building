// src/routes/document.routes.js — Persistent document library for signed-in users.
import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";
import { logger } from "../lib/logger.js";
import { sessionService } from "../services/sessionService.js";
import { rebuildRagChain } from "../services/ragService.js";
import {
  listUserDocuments,
  getUserDocument,
  deleteUserDocument,
  documentHasVectors,
} from "../services/documentService.js";
import { deleteSessionVectors } from "../lib/vectorStore.js";

export const documentRouter = Router();

/** Ensures an in-memory session exists for a persisted document (lazy rebuild). */
async function ensureSession(doc) {
  let session = sessionService.get(doc.sessionId);
  if (!session) {
    sessionService.create(doc.sessionId, {
      ragChain: rebuildRagChain(doc.sessionId),
      history: [],
      fileName: doc.fileName,
      pageCount: doc.pageCount,
      chunkCount: doc.chunkCount,
      userId: doc.userId,
    });
    logger.info({ sessionId: doc.sessionId, fileName: doc.fileName }, "Session restored from MongoDB");
  }
}

// GET /api/documents — List the user's saved PDFs
// NOTE: requireAuth is per-route (not router.use) so guest /api routes stay open
documentRouter.get("/documents", requireAuth, async (req, res, next) => {
  try {
    const docs = await listUserDocuments(req.userId);
    res.json({ documents: docs });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:sessionId/open — Resume chatting with a saved PDF
documentRouter.post("/documents/:sessionId/open", requireAuth, async (req, res, next) => {
  try {
    const doc = await getUserDocument(req.userId, req.params.sessionId);
    if (!doc) {
      throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found");
    }
    if (!(await documentHasVectors(doc.sessionId))) {
      await deleteUserDocument(req.userId, doc.sessionId);
      throw new ApiError(410, "DOCUMENT_EXPIRED", "This document is no longer available. Please upload it again.");
    }

    await ensureSession(doc);

    res.json({
      sessionId: doc.sessionId,
      fileName: doc.fileName,
      pageCount: doc.pageCount,
      chunkCount: doc.chunkCount,
      restored: true,
      message: `Restored "${doc.fileName}" — ready to chat.`,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:sessionId — Remove a saved PDF (metadata + vectors)
documentRouter.delete("/documents/:sessionId", requireAuth, async (req, res, next) => {
  try {
    const deleted = await deleteUserDocument(req.userId, req.params.sessionId);
    if (!deleted) {
      throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found");
    }
    // Remove in-memory session (if any) and its vectors.
    const session = sessionService.get(req.params.sessionId);
    if (session) session.userId = null; // mark so the end-hook deletes vectors
    sessionService.delete(req.params.sessionId);
    await deleteSessionVectors(req.params.sessionId);

    res.json({ message: "Document deleted" });
  } catch (err) {
    next(err);
  }
});
