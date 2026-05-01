// agent.js — Research Agent using LangGraph (manual tool execution)
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import axios from "axios";
import * as cheerio from "cheerio";

// ─────────────────────────────────────────────
// Web Search Tool — DuckDuckGo HTML scraping
// ─────────────────────────────────────────────
const webSearchTool = tool(
  async ({ query, maxResults = 5 }) => {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      const results = [];

      $(".result").each((i, el) => {
        if (i >= maxResults) return false;
        const title = $(el).find(".result__title").text().trim();
        const snippet = $(el).find(".result__snippet").text().trim();
        const url = $(el).find(".result__url").text().trim();
        if (title && snippet) results.push({ title, snippet, url: url || "N/A" });
      });

      if (results.length === 0) {
        return `No results found for "${query}". Try a different search term.`;
      }

      return results
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
        .join("\n\n");
    } catch (error) {
      return `Search failed: ${error.message}. Using built-in knowledge instead.`;
    }
  },
  {
    name: "web_search",
    description: "Search the web for information on a topic. Returns titles, URLs, and snippets.",
    schema: z.object({
      query: z.string().describe("The search query"),
      maxResults: z.number().optional().describe("Max results (default 5)"),
    }),
  }
);

// ─────────────────────────────────────────────
// Article Reader Tool
// ─────────────────────────────────────────────
const readArticleTool = tool(
  async ({ url }) => {
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        timeout: 8000,
      });

      const $ = cheerio.load(response.data);
      $("script, style, nav, footer, header, aside, .ad").remove();

      const title = $("h1").first().text().trim() || $("title").text().trim();
      const paragraphs = [];
      $("p").each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 80) paragraphs.push(text);
      });

      if (paragraphs.length === 0) return `Could not extract content from ${url}`;

      return `Title: ${title}\n\nContent:\n${paragraphs.slice(0, 8).join("\n\n")}`;
    } catch (error) {
      return `Could not read article at ${url}: ${error.message}`;
    }
  },
  {
    name: "read_article",
    description: "Read and extract the main content from a web article URL",
    schema: z.object({
      url: z.string().describe("The full URL of the article to read"),
    }),
  }
);

// ─────────────────────────────────────────────
// Note Taking Tool
// ─────────────────────────────────────────────
const notesTool = tool(
  async ({ section, content }) => {
    return `✅ Section "${section}" noted (${content.length} chars)`;
  },
  {
    name: "save_research_note",
    description: "Save a research note for a specific section of the report",
    schema: z.object({
      section: z.string().describe("Report section name"),
      content: z.string().describe("Research content to save"),
    }),
  }
);

// Tool registry
const TOOLS = {
  web_search: webSearchTool,
  read_article: readArticleTool,
  save_research_note: notesTool,
};

const SYSTEM_PROMPT = `You are an expert research agent. Your job is to research topics thoroughly and write comprehensive reports.

Research Process:
1. PLAN: Break the topic into 3-4 key subtopics to research
2. SEARCH: Use web_search for each subtopic to find relevant articles
3. READ: Use read_article to get detailed content from the most relevant URLs
4. NOTE: Use save_research_note to organize your findings by section
5. WRITE: Synthesize everything into a well-structured markdown report

Report Structure:
# [Topic] — Research Report

## Executive Summary
(2-3 sentence overview)

## Key Findings
(bullet points of most important discoveries)

## Detailed Analysis
(in-depth coverage of main aspects)

## Current Trends & Developments
(what's happening right now)

## Conclusion & Recommendations
(actionable insights)

---
*Research conducted by AI Research Agent*

Be thorough, cite specific facts and data when found, and write in a professional tone.`;

// ─────────────────────────────────────────────
// Manual agent loop (avoids ToolNode compatibility issues)
// ─────────────────────────────────────────────
export async function runResearchAgent(apiKey, topic, onStep) {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash-lite",
    apiKey,
    temperature: 0.3,
  });

  const modelWithTools = model.bindTools(Object.values(TOOLS));

  const messages = [
    new HumanMessage(
      `Research this topic thoroughly and write a comprehensive report: ${topic}`
    ),
  ];

  let stepCount = 0;
  const MAX_STEPS = 15;

  while (stepCount < MAX_STEPS) {
    stepCount++;

    // Call the model
    const response = await modelWithTools.invoke([
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ]);

    messages.push(response);

    // No tool calls → final answer
    if (!response.tool_calls || response.tool_calls.length === 0) {
      return {
        report: response.content,
        stepCount,
      };
    }

    // Execute each tool call
    for (const toolCall of response.tool_calls) {
      const toolName = toolCall.name;
      const toolFn = TOOLS[toolName];

      // Emit step event
      let icon = "🔧";
      let description = `Calling ${toolName}`;

      if (toolName === "web_search") {
        icon = "🔍";
        description = `Searching: "${toolCall.args.query}"`;
      } else if (toolName === "read_article") {
        icon = "📖";
        description = `Reading: ${String(toolCall.args.url).substring(0, 60)}...`;
      } else if (toolName === "save_research_note") {
        icon = "📝";
        description = `Taking notes: ${toolCall.args.section}`;
      }

      onStep({
        type: "step",
        stepNumber: stepCount,
        icon,
        tool: toolName,
        description,
      });

      // Execute tool
      let result = "Tool not found";
      if (toolFn) {
        try {
          result = await toolFn.invoke(toolCall.args);
        } catch (err) {
          result = `Tool error: ${err.message}`;
        }
      }

      const preview = String(result).substring(0, 200);
      onStep({
        type: "tool_result",
        stepNumber: stepCount,
        preview: preview + (result.length > 200 ? "..." : ""),
      });

      // Add tool result to messages
      messages.push(
        new ToolMessage({
          content: String(result),
          tool_call_id: toolCall.id,
        })
      );
    }
  }

  // Fallback if max steps reached
  return {
    report: "Research exceeded maximum steps. Please try a more specific topic.",
    stepCount,
  };
}
