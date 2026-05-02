// src/tools/webTools.js — Shared tools used by multiple agents
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";

// ── Web Search Tool ──
export const webSearchTool = tool(
  async ({ query, maxResults = 5 }) => {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        timeout: 10000,
      });
      const $ = cheerio.load(res.data);
      const results = [];
      $(".result").each((i, el) => {
        if (i >= maxResults) return false;
        const title = $(el).find(".result__title").text().trim();
        const snippet = $(el).find(".result__snippet").text().trim();
        const url = $(el).find(".result__url").text().trim();
        if (title && snippet) results.push({ title, snippet, url });
      });
      if (!results.length) return `No results for "${query}"`;
      return results.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`).join("\n\n");
    } catch (e) {
      return `Search failed: ${e.message}`;
    }
  },
  {
    name: "web_search",
    description: "Search the web for information on a topic",
    schema: z.object({
      query: z.string().describe("Search query"),
      maxResults: z.number().optional().describe("Max results (default 5)"),
    }),
  }
);

// ── Article Reader Tool ──
export const readArticleTool = tool(
  async ({ url }) => {
    try {
      const res = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        timeout: 8000,
      });
      const $ = cheerio.load(res.data);
      $("script, style, nav, footer, header, aside, .ad").remove();
      const title = $("h1").first().text().trim() || $("title").text().trim();
      const paragraphs = [];
      $("p").each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 80) paragraphs.push(text);
      });
      if (!paragraphs.length) return `Could not extract content from ${url}`;
      return `Title: ${title}\n\n${paragraphs.slice(0, 8).join("\n\n")}`;
    } catch (e) {
      return `Could not read ${url}: ${e.message}`;
    }
  },
  {
    name: "read_article",
    description: "Read and extract content from a URL",
    schema: z.object({ url: z.string().describe("Article URL to read") }),
  }
);
