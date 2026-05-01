// lesson12-langgraph.js — LangGraph: Stateful Agent Workflows
//
// CONCEPT: LangGraph lets you build agents as a GRAPH of nodes.
// Each node is a function. Edges define what runs next.
// State flows through the graph and gets updated at each node.
//
// Why LangGraph over a simple loop?
//   - More control over agent behavior
//   - Easy to add conditional logic (if X then go to Y, else go to Z)
//   - Built-in state management
//   - Can pause, resume, and inspect agent state
//   - Industry standard for production agents
//
// Graph structure we'll build:
//
//   START → [agent] → should_continue? → YES → [tools] → [agent] → ...
//                                      → NO  → END

import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation, END, START } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

dotenv.config();

const model = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0,
});

// ─────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────
const calculatorTool = tool(
  async ({ expression }) => {
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      return `Result: ${expression} = ${result}`;
    } catch {
      return `Error evaluating: ${expression}`;
    }
  },
  {
    name: "calculator",
    description: "Evaluates mathematical expressions",
    schema: z.object({
      expression: z.string().describe("Math expression to evaluate"),
    }),
  }
);

const weatherTool = tool(
  async ({ city }) => {
    const data = {
      mumbai:    { temp: 32, condition: "Humid", rain: "70%" },
      delhi:     { temp: 38, condition: "Sunny", rain: "10%" },
      bangalore: { temp: 24, condition: "Pleasant", rain: "30%" },
    };
    const w = data[city.toLowerCase()];
    if (!w) return `No data for ${city}`;
    return `${city}: ${w.temp}°C, ${w.condition}, Rain: ${w.rain}`;
  },
  {
    name: "get_weather",
    description: "Gets weather for Mumbai, Delhi, or Bangalore",
    schema: z.object({
      city: z.string().describe("City name"),
    }),
  }
);

const tools = [calculatorTool, weatherTool];
const modelWithTools = model.bindTools(tools);

// ─────────────────────────────────────────────
// Graph Nodes
// Each node receives state and returns updated state
// ─────────────────────────────────────────────

// Node 1: Agent — LLM decides what to do
async function agentNode(state) {
  console.log(`  [agent node] Thinking... (${state.messages.length} messages in context)`);
  const response = await modelWithTools.invoke(state.messages);
  return { messages: [response] }; // LangGraph appends this to state.messages
}

// Node 2: Tools — Execute tool calls
const toolNode = new ToolNode(tools);

// ─────────────────────────────────────────────
// Conditional Edge
// Decides: go to tools OR end the graph
// ─────────────────────────────────────────────
function shouldContinue(state) {
  const lastMessage = state.messages[state.messages.length - 1];

  // If the last message has tool calls → run tools
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log(`  [router] Tool calls detected → going to tools node`);
    return "tools";
  }

  // Otherwise → we're done
  console.log(`  [router] No tool calls → ending`);
  return END;
}

// ─────────────────────────────────────────────
// Build the Graph
// ─────────────────────────────────────────────
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")                    // START → agent
  .addConditionalEdges("agent", shouldContinue) // agent → tools OR END
  .addEdge("tools", "agent")                  // tools → agent (loop back)
  .compile();

// ─────────────────────────────────────────────
// Run the graph
// ─────────────────────────────────────────────
async function runGraph(question) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`User: ${question}`);
  console.log("═".repeat(60));

  const result = await graph.invoke({
    messages: [new HumanMessage(question)],
  });

  // Get the final answer (last message)
  const finalMessage = result.messages[result.messages.length - 1];
  console.log(`\nFinal Answer: ${finalMessage.content}`);

  // Show the full message trace
  console.log(`\nMessage trace (${result.messages.length} total):`);
  result.messages.forEach((msg, i) => {
    const type = msg.constructor.name;
    const preview = typeof msg.content === "string"
      ? msg.content.substring(0, 60)
      : JSON.stringify(msg.tool_calls?.[0]?.name || "tool_call");
    console.log(`  ${i + 1}. [${type}] ${preview}...`);
  });
}

async function main() {
  console.log("=== LangGraph Agent Demo ===\n");
  console.log("Graph: START → agent → (tools → agent)* → END\n");

  await runGraph("What is 1234 multiplied by 5678?");
  await runGraph("Compare weather in Mumbai and Delhi. Which is hotter?");
  await runGraph("What is 20% of the temperature in Bangalore?");
}

main().catch(console.error);
