// src/agents/criticAgent.js
// ROLE: Reviews the report for quality, completeness, and accuracy
// OUTPUT: Improved final report OR feedback for revision

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config } from "../config/index.js";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: config.geminiApiKey,
  temperature: 0.1,
});

const SYSTEM_PROMPT = `You are a Research Critic Agent.
Your job is to review a research report and improve it.

Check for:
1. Missing important information
2. Unsupported claims (no data/evidence)
3. Unclear or confusing sections
4. Logical gaps or contradictions
5. Missing conclusion or actionable insights

If the report is good (score 8+/10), return it with minor improvements.
If it needs work (score below 8), rewrite the weak sections.

Always return the COMPLETE improved report in markdown format.`;

export async function runCriticAgent(topic, report, onStep) {
  if (onStep) onStep({ type: "agent_start", agent: "Critic", message: "Reviewing and improving report quality..." });

  const response = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Review and improve this research report about "${topic}":\n\n${report}\n\nReturn the complete improved report.`,
    },
  ]);

  if (onStep) onStep({ type: "agent_done", agent: "Critic", message: "Report reviewed and finalized ✓" });

  return response.content;
}
