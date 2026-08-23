// src/routes/session.routes.js — Upload, chat, and session management endpoints.
import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { sessionService } from "../services/sessionService.js";
import { processPdf } from "../services/ragService.js";
import { deleteSessionVectors } from "../lib/vectorStore.js";
import { saveUserDocument } from "../services/documentService.js";
import { hasGuestQuota, recordGuestUpload, getGuestQuota } from "../services/guestService.js";
import { validate } from "../middleware/validate.js";
import { uploadLimiter } from "../middleware/rateLimiter.js";
import { getGuestId } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new ApiError(400, "INVALID_FILE_TYPE", "Only PDF files are allowed"));
  },
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

const chatSchema = z.object({
  sessionId: z.string().uuid(),
  question: z.string().trim().min(1, "question must not be empty").max(2000),
});

export const sessionRouter = Router();

// POST /api/upload — Upload and process a PDF
sessionRouter.post("/upload", uploadLimiter, upload.single("pdf"), async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, "NO_FILE", "No PDF file uploaded"));
  }

  const filePath = req.file.path;
  const fileName = req.file.originalname;
  const log = logger.child({ fileName, userId: req.userId ?? "guest" });

  // Freemium gate: authenticated users upload freely; guests get a limited trial
  const guestId = req.userId ? null : getGuestId(req);
  if (!req.userId && !(await hasGuestQuota(guestId))) {
    fs.unlink(filePath, () => {});
    return next(
      new ApiError(
        403,
        "AUTH_REQUIRED",
        `Your ${env.GUEST_FREE_UPLOADS} free upload${env.GUEST_FREE_UPLOADS > 1 ? "s have" : " has"} been used. Create a free account to keep going.`
      )
    );
  }

  // Reserve the session id up front so vectors can be stored under it
  const sessionId = sessionService.generateId();

  try {
    log.info("Processing PDF");
    const { pageCount, chunkCount, ragChain } = await processPdf(sessionId, filePath);
    log.info({ pageCount, chunkCount }, "PDF indexed");

    // Only count the upload after it processed successfully
    if (guestId) await recordGuestUpload(guestId);

    // Signed-in users: persist the document so it survives browser closes
    // and server restarts (previous uploads are kept — full library).
    if (req.userId) {
      await saveUserDocument(req.userId, { sessionId, fileName, pageCount, chunkCount });
    }

    sessionService.create(sessionId, {
      ragChain,
      history: [],
      fileName,
      pageCount,
      chunkCount,
      userId: req.userId ?? null,
    });

    res.status(201).json({
      sessionId,
      fileName,
      pageCount,
      chunkCount,
      message: `PDF processed successfully! ${chunkCount} chunks indexed.`,
      ...(guestId ? { guestQuota: await getGuestQuota(guestId) } : {}),
    });
  } catch (err) {
    // Roll back any partially indexed vectors for this failed upload
    await deleteSessionVectors(sessionId).catch(() => {});
    next(err);
  } finally {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== "ENOENT") log.warn({ err }, "Failed to delete uploaded file");
    });
  }
});

// POST /api/chat — Ask a question about the PDF (SSE stream)
sessionRouter.post("/chat", validate(chatSchema), async (req, res) => {
  const { sessionId, question } = req.body;

  const session = sessionService.get(sessionId);
  if (!session) {
    return res.status(404).json({
      error: { code: "SESSION_NOT_FOUND", message: "Session not found or expired. Please upload a PDF again." },
    });
  }

  const log = logger.child({ sessionId, fileName: session.fileName });
  log.info({ question }, "Chat request");

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullResponse = "";

  try {
    const stream = await session.ragChain.stream({
      question,
      history: session.history,
    });

    for await (const chunk of stream) {
      // Stop processing if the client disconnected
      if (res.writableEnded) break;
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    if (!res.writableEnded) {
      // Save to conversation history
      session.history.push(new HumanMessage(question));
      session.history.push(new AIMessage(fullResponse));

      // Keep history bounded to the last N messages
      if (session.history.length > env.MAX_HISTORY_MESSAGES) {
        session.history.splice(0, session.history.length - env.MAX_HISTORY_MESSAGES);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      log.info({ answerLength: fullResponse.length }, "Answer streamed");
    }
  } catch (err) {
    log.error({ err }, "Chat stream failed");
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: "Failed to generate an answer" })}\n\n`);
      res.end();
    }
  }
});

// DELETE /api/session/:id — Clear a session
sessionRouter.delete("/session/:id", (req, res) => {
  if (!sessionService.delete(req.params.id)) {
    return res.status(404).json({
      error: { code: "SESSION_NOT_FOUND", message: "Session not found" },
    });
  }
  res.json({ message: "Session cleared" });
});
