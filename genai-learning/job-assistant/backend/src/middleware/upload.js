// src/middleware/upload.js — Multer file upload middleware
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { config } from "../config/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../../", config.uploadDir);

// Ensure upload directory exists
fs.mkdirSync(uploadDir, { recursive: true });

export const upload = multer({
  dest: uploadDir,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
  limits: { fileSize: config.uploadMaxSize },
});
