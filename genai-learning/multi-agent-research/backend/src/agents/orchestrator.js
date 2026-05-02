// src/agents/orchestrator.js
// ROLE: Coordinates all agents in the correct sequence
// This is the "brain" of the multi-agent system
//
// Flow:
//   1. Planner Agent  → breaks topic into subtopics
//   2. Search Agents  → run IN PARALLEL for each subtopic (faster!)
//   3. Analyst Agent  → synthesizes all findings
//   4. Writer Agent   → writes the report
//   5. Critic Agent   → reviews and improves
//   → Final Report

import { runPlannerAgent } from "./plannerAgent.js";
import { runSearchAgent } from "./searchAgent.js";
import { runAnalystAgent } from "./analystAgent.js";
import { runWriterAgent } from "./writerAgent.js";
import { runCriticAgent } from "./criticAgent.js";

export async function runMultiAgentResearch(topic, onStep) {
  const startTime = Date.now();

  onStep({ type: "system", message: `🚀 Multi-Agent Research System activated for: "${topic}"` });
  onStep({ type: "system", message: "5 specialized agents will collaborate to research this topic" });

  // ── PHASE 1: Planning ──
  onStep({ type: "phase", phase: 1, message: "Phase 1: Planning research strategy" });
  const plan = await runPlannerAgent(topic, onStep);

  // ── PHASE 2: Parallel Search ──
  onStep({ type: "phase", phase: 2, message: `Phase 2: ${plan.subtopics.length} Search Agents running in parallel` });

  // Run all search agents simultaneously — this is the key advantage of multi-agent!
  const searchResults = await Promise.all(
    plan.subtopics.map((subtopic) => runSearchAgent(subtopic, onStep))
  );

  onStep({ type: "phase_done", phase: 2, message: `All ${searchResults.length} search agents completed` });

  // ── PHASE 3: Analysis ──
  onStep({ type: "phase", phase: 3, message: "Phase 3: Analyst Agent synthesizing findings" });
  const analysis = await runAnalystAgent(topic, searchResults, onStep);

  // ── PHASE 4: Writing ──
  onStep({ type: "phase", phase: 4, message: "Phase 4: Writer Agent composing report" });
  const draft = await runWriterAgent(topic, analysis, searchResults, onStep);

  // ── PHASE 5: Review ──
  onStep({ type: "phase", phase: 5, message: "Phase 5: Critic Agent reviewing and improving" });
  const finalReport = await runCriticAgent(topic, draft, onStep);

  const duration = Math.round((Date.now() - startTime) / 1000);

  onStep({
    type: "complete",
    message: `✅ Research complete in ${duration}s`,
    stats: {
      agents: 5,
      subtopics: plan.subtopics.length,
      searchAgents: plan.subtopics.length,
      duration,
    },
  });

  return {
    topic,
    plan,
    report: finalReport,
    stats: { agents: 5, subtopics: plan.subtopics.length, duration },
  };
}
