// src/agents/analystAgent.js
// ROLE: Analyzes and synthesizes findings from all search agents
// OUTPUT: Key insights, patterns, and data points

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config } from "../config/index.js";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: config.geminiApiKey,
  temperature: 0.2,
});

const SYSTEM_PROMPT = `You are a Research Analyst Agent.
Your job is to analyze raw research findings and extract:
1. Key insights and patterns across all subtopics
2. Important statistics and data points
3. Contradictions or gaps in the research
4. The most important takeaways

Be analytical, objective, and thorough.`;

export async function runAnalystAgent(topic, searchResults, onStep) {
  if (onStep) onStep({ type: "agent_start", agent: "Analyst", message: "Analyzing all research findings..." });

  const findingsText = searchResults
    .map((r, i) => `=== Subtopic ${i + 1}: ${r.subtopic} ===\n${r.findings}`)
    .join("\n\n");

  const response = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Analyze these research findings about "${topic}":\n\n${findingsText}\n\nProvide a structured analysis with key insights, data points, and patterns.`,
    },
  ]);

  if (onStep) onStep({ type: "agent_done", agent: "Analyst", message: "Analysis complete" });

  return response.content;
}
