// src/agents/plannerAgent.js
// ROLE: Breaks the research topic into focused subtopics
// OUTPUT: A structured research plan with 4-5 subtopics

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config } from "../config/index.js";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: config.geminiApiKey,
  temperature: 0.2,
});

const SYSTEM_PROMPT = `You are a Research Planner Agent.
Your job is to break a research topic into 4-5 focused subtopics that together give a comprehensive view.

For each subtopic provide:
- A specific search query to find information
- What aspect of the topic it covers

Return ONLY valid JSON in this format:
{
  "topic": "<main topic>",
  "subtopics": [
    {
      "title": "<subtopic title>",
      "searchQuery": "<specific search query>",
      "aspect": "<what this covers>"
    }
  ]
}`;

export async function runPlannerAgent(topic, onStep) {
  if (onStep) onStep({ type: "agent_start", agent: "Planner", message: `Planning research for: "${topic}"` });

  const response = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Create a research plan for: ${topic}` },
  ]);

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { topic, subtopics: [{ title: topic, searchQuery: topic, aspect: "overview" }] };

    if (onStep) onStep({ type: "agent_done", agent: "Planner", message: `Created ${plan.subtopics.length} research subtopics`, data: plan });

    return plan;
  } catch {
    const fallback = {
      topic,
      subtopics: [
        { title: `${topic} overview`, searchQuery: topic, aspect: "general overview" },
        { title: `${topic} latest trends`, searchQuery: `${topic} 2024 trends`, aspect: "current trends" },
        { title: `${topic} examples`, searchQuery: `${topic} examples use cases`, aspect: "practical examples" },
      ],
    };
    if (onStep) onStep({ type: "agent_done", agent: "Planner", message: `Created fallback plan`, data: fallback });
    return fallback;
  }
}
