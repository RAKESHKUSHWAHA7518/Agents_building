// lesson13-agent-memory.js — Agent with Persistent Memory
//
// CONCEPT: Agents need two types of memory:
//
//   SHORT-TERM (conversation memory):
//     - Remembers what was said in the current conversation
//     - Stored in the message list (context window)
//     - Lost when conversation ends
//
//   LONG-TERM (persistent memory):
//     - Remembers facts across conversations
//     - Stored in a database or file
//     - Survives restarts
//
// In this lesson we build an agent with BOTH types of memory.
// This is how real AI assistants like ChatGPT work.

import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, END, START } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import readline from "readline";
import fs from "fs";

dotenv.config();

// ─────────────────────────────────────────────
// Long-term memory — persisted to a JSON file
// ─────────────────────────────────────────────
const MEMORY_FILE = "./agent-memory.json";

function loadMemory() {
  if (fs.existsSync(MEMORY_FILE)) {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  }
  return { facts: [], preferences: {} };
}

function saveMemory(memory) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

let longTermMemory = loadMemory();

// ─────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────

// Tool: Save a fact to long-term memory
const rememberTool = tool(
  async ({ fact }) => {
    longTermMemory.facts.push({ fact, timestamp: new Date().toISOString() });
    saveMemory(longTermMemory);
    return `✅ Remembered: "${fact}"`;
  },
  {
    name: "remember_fact",
    description: "Save an important fact about the user to long-term memory for future conversations",
    schema: z.object({
      fact: z.string().describe("The fact to remember about the user"),
    }),
  }
);

// Tool: Recall facts from long-term memory
const recallTool = tool(
  async ({ query }) => {
    if (longTermMemory.facts.length === 0) {
      return "No facts stored in memory yet.";
    }
    const facts = longTermMemory.facts
      .map((f, i) => `${i + 1}. ${f.fact}`)
      .join("\n");
    return `Stored facts:\n${facts}`;
  },
  {
    name: "recall_facts",
    description: "Retrieve facts stored in long-term memory about the user",
    schema: z.object({
      query: z.string().describe("What you want to recall"),
    }),
  }
);

// Tool: Calculator
const calculatorTool = tool(
  async ({ expression }) => {
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      return `${expression} = ${result}`;
    } catch {
      return `Error: ${expression}`;
    }
  },
  {
    name: "calculator",
    description: "Evaluates math expressions",
    schema: z.object({
      expression: z.string(),
    }),
  }
);

const tools = [rememberTool, recallTool, calculatorTool];
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.3,
});

// System prompt that tells the agent about its memory capabilities
const SYSTEM_PROMPT = `You are a helpful personal assistant with memory capabilities.

You have access to:
1. remember_fact — save important information about the user for future conversations
2. recall_facts — retrieve previously saved information about the user
3. calculator — perform math calculations

When users share personal information (name, preferences, goals, etc.), use remember_fact to save it.
When users ask about things you should know about them, use recall_facts first.
Be proactive about remembering useful information.`;

const modelWithTools = model.bindTools(tools);

// ─────────────────────────────────────────────
// LangGraph agent
// ─────────────────────────────────────────────
async function agentNode(state) {
  // Inject system prompt + long-term memory context into every call
  const memoryContext = longTermMemory.facts.length > 0
    ? `\n\nLong-term memory (from previous conversations):\n${longTermMemory.facts.map(f => `- ${f.fact}`).join("\n")}`
    : "";

  const systemMessage = {
    role: "system",
    content: SYSTEM_PROMPT + memoryContext,
  };

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
// Conversation history (short-term memory)
// ─────────────────────────────────────────────
const conversationHistory = [];

async function chat(userInput) {
  conversationHistory.push(new HumanMessage(userInput));

  const result = await graph.invoke({ messages: conversationHistory });

  // Update history with all new messages from this turn
  const newMessages = result.messages.slice(conversationHistory.length);
  conversationHistory.push(...newMessages);

  // Return the final text response
  const lastMsg = result.messages[result.messages.length - 1];
  return lastMsg.content;
}

// ─────────────────────────────────────────────
// Interactive terminal chat
// ─────────────────────────────────────────────
async function main() {
  console.log("=== Agent with Memory ===\n");
  console.log("This agent remembers facts across conversations!");
  console.log(`Long-term memory: ${longTermMemory.facts.length} facts stored\n`);
  console.log("Commands: 'memory' (show stored facts), 'clear' (clear memory), 'exit'\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  function ask() {
    rl.question("You: ", async (input) => {
      const userInput = input.trim();

      if (userInput === "exit") { rl.close(); return; }

      if (userInput === "memory") {
        console.log("\n📧 Long-term memory:");
        if (longTermMemory.facts.length === 0) {
          console.log("  (empty)\n");
        } else {
          longTermMemory.facts.forEach((f, i) => console.log(`  ${i + 1}. ${f.fact}`));
          console.log();
        }
        ask();
        return;
      }

      if (userInput === "clear") {
        longTermMemory = { facts: [], preferences: {} };
        saveMemory(longTermMemory);
        console.log("✅ Memory cleared\n");
        ask();
        return;
      }

      if (!userInput) { ask(); return; }

      try {
        const response = await chat(userInput);
        console.log(`\nAssistant: ${response}\n`);
      } catch (err) {
        console.error("Error:", err.message);
      }

      ask();
    });
  }

  ask();
}

main().catch(console.error);
