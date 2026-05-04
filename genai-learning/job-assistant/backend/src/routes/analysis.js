// src/routes/analysis.js — All AI analysis routes
import { Router } from "express";
import { aiService } from "../services/aiService.js";
import { multiAgentService } from "../services/multiAgentService.js";
import { sessionStore } from "../utils/sessionStore.js";

const router = Router();

// Helper: get session or return 404
function getSession(req, res) {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return null;
  }
  const session = sessionStore.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found. Please re-upload your resume." });
    return null;
  }
  return session;
}

// POST /api/analysis/match — Analyze resume vs job description
router.post("/match", async (req, res, next) => {
  const session = getSession(req, res);
  if (!session) return;

  const { jobDescription } = req.body;
  if (!jobDescription?.trim()) {
    return res.status(400).json({ error: "jobDescription is required" });
  }

  try {
    console.log("🔍 Analyzing match...");
    const analysis = await aiService.analyzeMatch(session.resumeText, jobDescription);

    // Save to session for use in other routes
    sessionStore.update(req.body.sessionId, { analysis, jobDescription });

    res.json({ analysis });
  } catch (err) {
    next(err);
  }
});

// POST /api/analysis/rewrite — Rewrite resume (streaming)
router.post("/rewrite", async (req, res, next) => {
  const session = getSession(req, res);
  if (!session) return;

  if (!session.analysis) {
    return res.status(400).json({ error: "Run match analysis first" });
  }

  // SSE headers for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    console.log("✍️  Rewriting resume...");
    const rewritten = await aiService.streamRewrite(
      session.resumeText,
      session.jobDescription,
      session.analysis,
      (chunk) => send({ chunk })
    );

    sessionStore.update(req.body.sessionId, { rewrittenResume: rewritten });
    send({ done: true });
  } catch (err) {
    send({ error: err.message });
  }

  res.end();
});

// POST /api/analysis/cover-letter — Generate cover letter
router.post("/cover-letter", async (req, res, next) => {
  const session = getSession(req, res);
  if (!session) return;

  if (!session.jobDescription) {
    return res.status(400).json({ error: "Run match analysis first" });
  }

  const { candidateName = "Candidate" } = req.body;

  try {
    console.log("📝 Generating cover letter...");
    const coverLetter = await aiService.generateCoverLetter(
      session.resumeText,
      session.jobDescription,
      candidateName
    );

    sessionStore.update(req.body.sessionId, { coverLetter });
    res.json({ coverLetter });
  } catch (err) {
    next(err);
  }
});

// POST /api/analysis/interview-prep — Generate interview questions
router.post("/interview-prep", async (req, res, next) => {
  const session = getSession(req, res);
  if (!session) return;

  if (!session.jobDescription) {
    return res.status(400).json({ error: "Run match analysis first" });
  }

  try {
    console.log("🎯 Generating interview prep...");
    const prep = await aiService.generateInterviewPrep(
      session.resumeText,
      session.jobDescription
    );
    res.json({ prep });
  } catch (err) {
    next(err);
  }
});

// POST /api/analysis/skills-gap — Analyze skills gap
router.post("/skills-gap", async (req, res, next) => {
  const session = getSession(req, res);
  if (!session) return;

  if (!session.jobDescription) {
    return res.status(400).json({ error: "Run match analysis first" });
  }

  try {
    console.log("📊 Analyzing skills gap...");
    const skillsGap = await aiService.analyzeSkillsGap(
      session.resumeText,
      session.jobDescription
    );
    res.json({ skillsGap });
  } catch (err) {
    next(err);
  }
});

// POST /api/analysis/full-pipeline — Multi-agent: run all 4 agents at once
// Streams progress via SSE, then returns the full bundle
router.post("/full-pipeline", async (req, res, next) => {
  const session = getSession(req, res);
  if (!session) return;

  const { jobDescription, candidateName = "Candidate" } = req.body;
  if (!jobDescription?.trim()) {
    return res.status(400).json({ error: "jobDescription is required" });
  }

  // SSE headers — stream progress steps to the frontend
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  console.log("\n🤖 Multi-Agent Pipeline starting...");
  send({ type: "start", message: "Multi-agent pipeline starting..." });

  try {
    const result = await multiAgentService.runFullPipeline(
      session.resumeText,
      jobDescription,
      candidateName,
      // onProgress callback — streams each agent step to the UI
      ({ step, message }) => {
        send({ type: "progress", step, message });
        console.log(`  ${message}`);
      }
    );

    // Save everything to session
    sessionStore.update(req.body.sessionId, {
      analysis: result.analysis,
      strategy: result.strategy,
      jobDescription,
      rewrittenResume: result.rewrittenResume,
      coverLetter: result.coverLetter,
    });

    send({ type: "result", data: result });
    send({ type: "done", message: "All agents complete!" });
    console.log("✅ Multi-agent pipeline complete");
  } catch (err) {
    console.error("Pipeline error:", err.message);
    send({ type: "error", message: err.message });
  }

  res.end();
});

export default router;
