// lesson14-research-agent.js — Multi-Tool Research Agent
//
// This is the Phase 3 mini project — a research agent that:
//   1. Takes a research topic from the user
//   2. Breaks it into sub-questions (planning)
//   3. Searches for information using tools
//   4. Synthesizes a comprehensive report
//
// This demonstrates:
//   - Multi-step reasoning
//   - Tool use (web search simulation, calculator, text analysis)
//   - Planning and execution
//   - Report generation
//
// This is exactly the kind of agent companies are building right now!

import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, END, START } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import readline from "readline";

dotenv.config();

// ─────────────────────────────────────────────
// Simulated knowledge base (in real app: web search API)
// ─────────────────────────────────────────────
const knowledgeBase = {
  "artificial intelligence": `
    AI is transforming industries globally. Key facts:
    - Global AI market size: $196.63 billion in 2023, projected $1.8 trillion by 2030
    - India's AI market: $6 billion in 2023, growing at 25-35% CAGR
    - Top AI companies: Google, Microsoft, OpenAI, Anthropic, Meta
    - Key applications: healthcare, finance, education, manufacturing, retail
    - India has 420,000+ AI professionals, 3rd largest globally
    - Average AI engineer salary in India: ₹12-25 LPA (entry to mid-level)
  `,
  "machine learning": `
    Machine Learning is a subset of AI. Key facts:
    - ML enables computers to learn from data without explicit programming
    - Types: Supervised, Unsupervised, Reinforcement Learning
    - Popular frameworks: TensorFlow, PyTorch, scikit-learn
    - Most in-demand ML skills: Python, deep learning, NLP, computer vision
    - ML engineer salary India: ₹8-20 LPA
    - Top hiring companies: Amazon, Flipkart, Paytm, Zomato, TCS, Infosys
  `,
  "generative ai": `
    Generative AI creates new content (text, images, code, audio). Key facts:
    - ChatGPT reached 100M users in 2 months (fastest ever)
    - GenAI market: $44.89 billion in 2023, growing to $667 billion by 2030
    - Key models: GPT-4, Gemini, Claude, Llama, Mistral
    - Use cases: content creation, coding assistance, customer service, education
    - GenAI engineer salary India: ₹10-30 LPA
    - Skills needed: LLMs, RAG, LangChain, prompt engineering, vector databases
  `,
  "langchain": `
    LangChain is a framework for building LLM applications. Key facts:
    - Open source, 90,000+ GitHub stars
    - Supports Python and JavaScript
    - Key features: chains, agents, RAG, memory, tools
    - LangGraph: extension for stateful, multi-actor applications
    - Used by: Notion, Replit, Elastic, and thousands of startups
    - LangChain developer salary India: ₹12-25 LPA
  `,
  "vector database": `
    Vector databases store and search embeddings. Key facts:
    - Popular options: Pinecone, Weaviate, ChromaDB, Qdrant, pgvector
    - Used in: RAG systems, semantic search, recommendation engines
    - Pinecone: most popular managed vector DB, free tier available
    - ChromaDB: best for local development, open source
    - Vector DB market growing at 23% CAGR
    - Essential skill for GenAI engineers
  `,
  "nodejs": `
    Node.js is a JavaScript runtime for server-side development. Key facts:
    - Built on Chrome's V8 engine
    - Non-blocking I/O, event-driven architecture
    - npm: 2.1 million packages available
    - Used by: Netflix, LinkedIn, Uber, PayPal, NASA
    - Node.js developer salary India: ₹6-18 LPA
    - Great for building GenAI backends and APIs
  `,
};

// ─────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────

// Tool 1: Search knowledge base
const searchTool = tool(
  async ({ query }) => {
    const queryLower = query.toLowerCase();
    for (const [key, value] of Object.entries(knowledgeBase)) {
      if (queryLower.includes(key) || key.includes(queryLower.split(" ")[0])) {
        return value.trim();
      }
    }
    return `No specific data found for "${query}". Available topics: ${Object.keys(knowledgeBase).join(", ")}`;
  },
  {
    name: "search_knowledge",
    description: "Search for information about AI, ML, GenAI, LangChain, vector databases, Node.js",
    schema: z.object({
      query: z.string().describe("The topic to search for"),
    }),
  }
);

// Tool 2: Calculate statistics
const statsTool = tool(
  async ({ numbers, operation }) => {
    if (!numbers || numbers.length === 0) return "No numbers provided";
    switch (operation) {
      case "average": return `Average: ${(numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2)}`;
      case "sum":     return `Sum: ${numbers.reduce((a, b) => a + b, 0)}`;
      case "max":     return `Max: ${Math.max(...numbers)}`;
      case "min":     return `Min: ${Math.min(...numbers)}`;
      default:        return `Unknown operation: ${operation}`;
    }
  },
  {
    name: "calculate_stats",
    description: "Calculate statistics (average, sum, max, min) on a list of numbers",
    schema: z.object({
      numbers: z.array(z.number()).describe("Array of numbers"),
      operation: z.enum(["average", "sum", "max", "min"]),
    }),
  }
);

// Tool 3: Format report section
const formatTool = tool(
  async ({ title, content, style }) => {
    const divider = "─".repeat(50);
    switch (style) {
      case "header":
        return `\n${"═".repeat(50)}\n  ${title.toUpperCase()}\n${"═".repeat(50)}\n${content}`;
      case "section":
        return `\n${divider}\n📌 ${title}\n${divider}\n${content}`;
      case "bullet":
        return `\n**${title}**\n${content.split(". ").map(s => s.trim()).filter(Boolean).map(s => `  • ${s}`).join("\n")}`;
      default:
        return `\n${title}\n${content}`;
    }
  },
  {
    name: "format_section",
    description: "Format a section of the research report with proper styling",
    schema: z.object({
      title: z.string().describe("Section title"),
      content: z.string().describe("Section content"),
      style: z.enum(["header", "section", "bullet"]).describe("Formatting style"),
    }),
  }
);

const tools = [searchTool, statsTool, formatTool];
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.3,
});

const modelWithTools = model.bindTools(tools);

const RESEARCH_SYSTEM_PROMPT = `You are an expert research assistant that creates comprehensive reports.

When given a research topic:
1. Use search_knowledge to gather information on relevant subtopics
2. Use calculate_stats if there are numbers to analyze
3. Use format_section to structure your report professionally
4. Synthesize all gathered information into a well-structured final report

Always search for multiple related subtopics to give a comprehensive view.
Structure your final report with: Overview, Key Facts, Market Data, Career Opportunities, and Conclusion.`;

// ─────────────────────────────────────────────
// LangGraph agent
// ─────────────────────────────────────────────
async function agentNode(state) {
  const systemMessage = { role: "system", content: RESEARCH_SYSTEM_PROMPT };
  const response = await modelWithTools.invoke([systemMessage, ...state.messages]);
  return { messages: [response] };
}

const toolNode = new ToolNode(tools);

function shouldContinue(state) {
  const last = state.messages[state.messages.length - 1];
  return last.tool_calls?.length > 0 ? "tools" : END;
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile();

// ─────────────────────────────────────────────
// Run research
// ─────────────────────────────────────────────
async function runResearch(topic) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🔍 Researching: "${topic}"`);
  console.log("═".repeat(60));
  console.log("Agent is working...\n");

  const result = await graph.invoke({
    messages: [new HumanMessage(
      `Create a comprehensive research report about: ${topic}. 
       Search for all relevant information, analyze any data, and format a professional report.`
    )],
  });

  // Count tool calls made
  const toolCalls = result.messages.filter(m => m.tool_calls?.length > 0).length;
  console.log(`\n[Agent made ${toolCalls} tool call(s) across ${result.messages.length} messages]\n`);

  const finalMsg = result.messages[result.messages.length - 1];
  console.log(finalMsg.content);
}

// ─────────────────────────────────────────────
// Interactive mode
// ─────────────────────────────────────────────
async function main() {
  console.log("=== Research Agent — Phase 3 Mini Project ===\n");
  console.log("This agent researches topics and generates comprehensive reports.");
  console.log("Available topics: AI, Machine Learning, Generative AI, LangChain, Vector Database, Node.js\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question("Enter research topic (or press Enter for demo): ", async (input) => {
    const topic = input.trim() || "Generative AI career opportunities in India";
    rl.close();
    await runResearch(topic);
  });
}

main().catch(console.error);
