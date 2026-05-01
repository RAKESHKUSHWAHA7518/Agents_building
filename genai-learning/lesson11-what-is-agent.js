// lesson11-what-is-agent.js — What is an AI Agent?
//
// CONCEPT: An Agent is an LLM that can:
//   1. THINK  — reason about what to do next
//   2. ACT    — call tools (functions) to get information
//   3. OBSERVE — look at the tool result
//   4. REPEAT  — keep thinking/acting until the task is done
//
// The key difference from a simple LLM call:
//   Simple LLM: question → answer (one shot)
//   Agent:      question → think → act → observe → think → act → ... → answer
//
// Real world example:
//   You: "What is the weather in Mumbai and should I carry an umbrella?"
//   Simple LLM: Makes up an answer (hallucination risk)
//   Agent: 1. Calls weather API tool → gets real data
//          2. Analyzes the data
//          3. Gives accurate answer based on real weather

import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";

dotenv.config();

const model = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0,
});

// ─────────────────────────────────────────────
// TOOLS — functions the agent can call
// Each tool has: name, description, schema, implementation
// The LLM reads the description to decide WHEN to use each tool
// ─────────────────────────────────────────────

// Tool 1: Calculator
const calculatorTool = tool(
  async ({ expression }) => {
    try {
      // Safe math evaluation
      const result = Function(`"use strict"; return (${expression})`)();
      return `${expression} = ${result}`;
    } catch {
      return `Error: Could not evaluate "${expression}"`;
    }
  },
  {
    name: "calculator",
    description: "Evaluates a mathematical expression. Use this for any math calculations.",
    schema: z.object({
      expression: z.string().describe("The math expression to evaluate, e.g. '25 * 4 + 10'"),
    }),
  }
);

// Tool 2: String utilities
const stringTool = tool(
  async ({ operation, text }) => {
    switch (operation) {
      case "uppercase": return text.toUpperCase();
      case "lowercase": return text.toLowerCase();
      case "reverse":   return text.split("").reverse().join("");
      case "length":    return `"${text}" has ${text.length} characters`;
      case "wordcount": return `"${text}" has ${text.trim().split(/\s+/).length} words`;
      default:          return `Unknown operation: ${operation}`;
    }
  },
  {
    name: "string_utility",
    description: "Performs string operations: uppercase, lowercase, reverse, length, wordcount",
    schema: z.object({
      operation: z.enum(["uppercase", "lowercase", "reverse", "length", "wordcount"]),
      text: z.string().describe("The text to process"),
    }),
  }
);

// Tool 3: Fake weather (simulates an API call)
const weatherTool = tool(
  async ({ city }) => {
    // Simulated weather data (in real app this would call a weather API)
    const weatherData = {
      mumbai:     { temp: 32, condition: "Humid and cloudy", rain: "70% chance of rain" },
      delhi:      { temp: 38, condition: "Hot and sunny",    rain: "10% chance of rain" },
      bangalore:  { temp: 24, condition: "Pleasant",         rain: "30% chance of rain" },
      chennai:    { temp: 35, condition: "Hot and humid",    rain: "50% chance of rain" },
    };
    const data = weatherData[city.toLowerCase()];
    if (!data) return `Weather data not available for ${city}`;
    return `${city}: ${data.temp}°C, ${data.condition}, ${data.rain}`;
  },
  {
    name: "get_weather",
    description: "Gets current weather for an Indian city. Available: Mumbai, Delhi, Bangalore, Chennai",
    schema: z.object({
      city: z.string().describe("The city name to get weather for"),
    }),
  }
);

// ─────────────────────────────────────────────
// Bind tools to the model
// This tells Gemini what tools are available
// ─────────────────────────────────────────────
const tools = [calculatorTool, stringTool, weatherTool];
const toolsByName = { calculator: calculatorTool, string_utility: stringTool, get_weather: weatherTool };
const modelWithTools = model.bindTools(tools);

// ─────────────────────────────────────────────
// Simple Agent Loop
// This is the core of how agents work
// ─────────────────────────────────────────────
async function runAgent(userQuestion) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`User: ${userQuestion}`);
  console.log("═".repeat(60));

  const messages = [new HumanMessage(userQuestion)];
  let step = 0;

  while (true) {
    step++;
    console.log(`\n[Step ${step}] Thinking...`);

    // LLM decides: answer directly OR call a tool
    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    // If no tool calls → agent is done, return final answer
    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`[Step ${step}] Final answer ready\n`);
      console.log(`Assistant: ${response.content}`);
      break;
    }

    // Execute each tool the agent requested
    for (const toolCall of response.tool_calls) {
      console.log(`[Step ${step}] Calling tool: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);

      const toolFn = toolsByName[toolCall.name];
      const toolResult = await toolFn.invoke(toolCall.args);

      console.log(`[Step ${step}] Tool result: ${toolResult}`);

      // Add tool result back to messages so agent can see it
      messages.push(new ToolMessage({
        content: String(toolResult),
        tool_call_id: toolCall.id,
      }));
    }

    // Safety: stop after 10 steps to prevent infinite loops
    if (step >= 10) {
      console.log("Max steps reached");
      break;
    }
  }
}

// ─────────────────────────────────────────────
// Test the agent with different questions
// ─────────────────────────────────────────────
async function main() {
  console.log("=== Phase 3: AI Agent Demo ===\n");
  console.log("Watch how the agent THINKS → ACTS → OBSERVES → ANSWERS\n");

  // Test 1: Math — agent will use calculator tool
  await runAgent("What is 15% of 8500, and then add 250 to that result?");

  // Test 2: String — agent will use string_utility tool
  await runAgent("How many words are in the sentence: 'Artificial Intelligence is changing the world'?");

  // Test 3: Weather — agent will use weather tool
  await runAgent("What's the weather in Mumbai? Should I carry an umbrella?");

  // Test 4: Multi-tool — agent uses multiple tools in sequence
  await runAgent("What is the weather in Delhi and Bangalore? Which city is cooler?");

  // Test 5: No tool needed — agent answers directly
  await runAgent("What is the capital of India?");
}

main().catch(console.error);
