// server.js — Express backend for PDF Chat App
import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { SimpleVectorStore } from "./vectorStore.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Multer — handles file uploads, saves to /uploads
const upload = multer({
  dest: path.join(__dirname, "uploads"),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Ensure uploads folder exists
fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });

// ─────────────────────────────────────────────
// AI Models
// ─────────────────────────────────────────────
const model = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0,
});

const embeddingsModel = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-2",
  apiKey: process.env.GEMINI_API_KEY,
});

// ─────────────────────────────────────────────
// In-memory session store
// Each session has its own vector store + conversation history
// ─────────────────────────────────────────────
const sessions = new Map();

// ─────────────────────────────────────────────
// RAG Chain builder
// ─────────────────────────────────────────────
function buildRAGChain(vectorStore) {
  const retriever = vectorStore.asRetriever(4);

  const ragPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a helpful assistant that answers questions about an uploaded document.
Use ONLY the following context from the document to answer the question.
If the answer is not in the context, say "I couldn't find that information in the document."
Be concise, accurate, and friendly.

Context from document:
{context}`,
    ],
    new MessagesPlaceholder("history"),
    ["human", "{question}"],
  ]);

  const formatDocs = (docs) =>
    docs.map((doc, i) => `[Section ${i + 1}]:\n${doc.pageContent}`).join("\n\n");

  return RunnableSequence.from([
    {
      context: (input) => retriever.invoke(input.question).then(formatDocs),
      question: (input) => input.question,
      history: (input) => input.history,
    },
    ragPrompt,
    model,
    new StringOutputParser(),
  ]);
}

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "PDF Chat API is running" });
});

// POST /api/upload — Upload and process a PDF
app.post("/api/upload", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF file uploaded" });
  }

  const sessionId = Date.now().toString();
  const filePath = req.file.path;
  const fileName = req.file.originalname;

  try {
    console.log(`\n📄 Processing: ${fileName}`);

    // Load PDF
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    console.log(`   Loaded ${docs.length} page(s)`);

    // Split into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await splitter.splitDocuments(docs);
    console.log(`   Split into ${chunks.length} chunks`);

    // Build vector store
    const vectorStore = new SimpleVectorStore(embeddingsModel);
    await vectorStore.addDocuments(chunks);
    console.log(`   Vector store ready`);

    // Build RAG chain
    const ragChain = buildRAGChain(vectorStore);

    // Save session
    sessions.set(sessionId, {
      ragChain,
      history: [],
      fileName,
      pageCount: docs.length,
      chunkCount: chunks.length,
    });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    console.log(`✅ Session created: ${sessionId}`);

    res.json({
      sessionId,
      fileName,
      pageCount: docs.length,
      chunkCount: chunks.length,
      message: `PDF processed successfully! ${chunks.length} chunks indexed.`,
    });
  } catch (error) {
    console.error("Upload error:", error.message);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/chat — Ask a question about the PDF
app.post("/api/chat", async (req, res) => {
  const { sessionId, question } = req.body;

  if (!sessionId || !question) {
    return res.status(400).json({ error: "sessionId and question are required" });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found. Please upload a PDF first." });
  }

  try {
    console.log(`\n❓ [${session.fileName}] ${question}`);

    // Set SSE headers for streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    // Stream the answer word by word
    const stream = await session.ragChain.stream({
      question,
      history: session.history,
    });

    for await (const chunk of stream) {
      fullResponse += chunk;
      // Send each chunk as SSE event
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    // Save to conversation history
    session.history.push(new HumanMessage(question));
    session.history.push(new AIMessage(fullResponse));

    // Keep history to last 10 exchanges (20 messages)
    if (session.history.length > 20) {
      session.history.splice(0, 2);
    }

    // Signal end of stream
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    console.log(`💬 Answer streamed (${fullResponse.length} chars)`);
  } catch (error) {
    console.error("Chat error:", error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// DELETE /api/session/:id — Clear a session
app.delete("/api/session/:id", (req, res) => {
  sessions.delete(req.params.id);
  res.json({ message: "Session cleared" });
});

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 PDF Chat API running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
