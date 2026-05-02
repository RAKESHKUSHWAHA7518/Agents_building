// src/agents/writerAgent.js
// ROLE: Writes the final comprehensive research report
// OUTPUT: Well-structured markdown report

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config } from "../config/index.js";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: config.geminiApiKey,
  temperature: 0.4,
});

const SYSTEM_PROMPT = `You are a Research Writer Agent.
Your job is to write a comprehensive, well-structured research report.

Report format:
# [Topic] — Research Report

## Executive Summary
(3-4 sentences covering the most important findings)

## Key Findings
(5-7 bullet points of the most important discoveries)

## Detailed Analysis

### [Subtopic 1]
(detailed coverage)

### [Subtopic 2]
(detailed coverage)

... (one section per subtopic)

## Trends & Insights
(patterns and trends identified across the research)

## Conclusion
(actionable takeaways and final thoughts)

---
*Multi-Agent Research System | ${new Date().toLocaleDateString("en-IN")}*

Write in a professional, informative tone. Use specific facts and data where available.`;

export async function runWriterAgent(topic, analysis, searchResults, onStep) {
  if (onStep) onStep({ type: "agent_start", agent: "Writer", message: "Writing final report..." });

  const subtopicSummaries = searchResults
    .map((r) => `${r.subtopic}: ${r.findings.substring(0, 500)}`)
    .join("\n\n");

  const response = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Write a comprehensive research report about: "${topic}"

ANALYST'S INSIGHTS:
${analysis}

RESEARCH FINDINGS BY SUBTOPIC:
${subtopicSummaries}

Write the complete report now.`,
    },
  ]);

  if (onStep) onStep({ type: "agent_done", agent: "Writer", message: "Report written" });

  return response.content;
}
