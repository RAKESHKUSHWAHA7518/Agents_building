// src/routes/research.js
import { Router } from "express";
import { runMultiAgentResearch } from "../agents/orchestrator.js";

const router = Router();

// POST /api/research — Start multi-agent research with SSE streaming
router.post("/", async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: "topic is required" });

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  console.log(`\n🔬 Multi-Agent Research: "${topic}"`);

  try {
    const result = await runMultiAgentResearch(topic, (event) => {
      send(event);
      // Log to console
      if (event.type === "phase") console.log(`  📍 ${event.message}`);
      if (event.type === "agent_start") console.log(`    → [${event.agent}] ${event.message}`);
      if (event.type === "agent_done") console.log(`    ✓ [${event.agent}] ${event.message}`);
    });

    send({ type: "report", report: result.report, stats: result.stats, plan: result.plan });
    console.log(`✅ Done: ${result.stats.duration}s, ${result.stats.agents} agents`);
  } catch (err) {
    console.error("Error:", err.message);
    send({ type: "error", message: err.message });
  }

  res.end();
});

export default router;
