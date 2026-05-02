// src/agents/searchAgent.js
// ROLE: Searches the web for a specific subtopic
// OUTPUT: Raw search results + article content

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config } from "../config/index.js";
import { webSearchTool, readArticleTool } from "../tools/webTools.js";
import { runAgentLoop } from "../utils/agentRunner.js";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: config.geminiApiKey,
  temperature: 0,
}).bindTools([webSearchTool, readArticleTool]);

const SYSTEM_PROMPT = `Search Agent — you find information on the web.
1. Use web_search to find relevant articles
2. Use read_article to get full content from the most relevant URL
3. Return a summary of what you found with key facts and data`;

export async function runSearchAgent(subtopic, onStep) {
  if (onStep) onStep({ type: "agent_start", agent: "Search", message: `Searching: "${subtopic.title}"` });

  const { result, steps } = await runAgentLoop({
    model,
    tools: { web_search: webSearchTool, read_article: readArticleTool },
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Research this subtopic: "${subtopic.title}"\nSearch query: "${subtopic.searchQuery}"\nFocus on: ${subtopic.aspect}`,
    onStep: (step) => onStep && onStep({ ...step, agent: "Search", subtopic: subtopic.title }),
    maxSteps: 6,
  });

  if (onStep) onStep({ type: "agent_done", agent: "Search", message: `Found info on "${subtopic.title}" (${steps} steps)` });

  return { subtopic: subtopic.title, aspect: subtopic.aspect, findings: result };
}
