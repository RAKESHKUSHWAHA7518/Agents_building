// src/routes/resume.js — Resume upload route
import { Router } from "express";
import fs from "fs";
import { upload } from "../middleware/upload.js";
import { extractPdfText } from "../utils/pdfParser.js";
import { sessionStore } from "../utils/sessionStore.js";

const router = Router();

// POST /api/resume/upload
router.post("/upload", upload.single("resume"), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF file uploaded" });
  }

  const filePath = req.file.path;

  try {
    const { text, pageCount } = await extractPdfText(filePath);

    const sessionId = `session_${Date.now()}`;
    sessionStore.set(sessionId, {
      resumeText: text,
      fileName: req.file.originalname,
      pageCount,
    });

    fs.unlinkSync(filePath);

    console.log(`✅ Resume uploaded: ${req.file.originalname} (${pageCount} pages)`);

    res.json({
      sessionId,
      fileName: req.file.originalname,
      pageCount,
      charCount: text.length,
    });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    next(err);
  }
});

export default router;
