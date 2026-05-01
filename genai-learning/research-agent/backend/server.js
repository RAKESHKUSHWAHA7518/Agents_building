// server.js — Research Agent API with SSE streaming
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { runResearchAgent } from "./agent.js";

dotenv.config();

const app = express();
const PORT = 3002;

app.use(cors({ origin: "http://localhost:5174" }));
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Research Agent API running on port 3002" });
});

// POST /api/research — Start a research task, stream steps via SSE
app.post("/api/research", async (req, res) => {
  const { topic } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "Research topic is required" });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  console.log(`\n🔍 Research: "${topic}"`);
  sendEvent({ type: "start", message: `Starting research on: "${topic}"` });

  try {
    // Run agent — onStep callback streams each step to frontend
    const { report, stepCount } = await runResearchAgent(
      process.env.GEMINI_API_KEY,
      topic,
      (stepEvent) => {
        sendEvent(stepEvent);
        console.log(`  [${stepEvent.stepNumber}] ${stepEvent.icon || ""} ${stepEvent.description || stepEvent.preview?.substring(0, 60) || ""}`);
      }
    );

    sendEvent({ type: "writing", message: "Writing final report..." });
    sendEvent({ type: "report", content: report, stepCount });
    sendEvent({ type: "done", message: "Research complete!" });

    console.log(`✅ Done (${stepCount} steps)`);
  } catch (error) {
    console.error("Error:", error.message);
    sendEvent({ type: "error", message: error.message });
  }

  res.end();
});

app.listen(PORT, () => {
  console.log(`\n🚀 Research Agent API: http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
