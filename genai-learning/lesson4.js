// lesson4.js — LangChain Basics with Gemini
// LangChain sits on top of any LLM and gives you reusable building blocks
import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

dotenv.config();

// ─────────────────────────────────────────────
// PART 1: LangChain Model — same as before but via LangChain
// ─────────────────────────────────────────────
const model = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.7,
});

// ─────────────────────────────────────────────
// PART 2: Prompt Templates
// Instead of hardcoding prompts, we create reusable templates with variables
// ─────────────────────────────────────────────
const promptTemplate = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant that explains {topic} concepts to beginners. Keep answers under 100 words.",
  ],
  ["human", "{question}"],
]);

// ─────────────────────────────────────────────
// PART 3: Output Parser
// Extracts just the text string from the model's response object
// ─────────────────────────────────────────────
const outputParser = new StringOutputParser();

// ─────────────────────────────────────────────
// PART 4: Chain — the core LangChain concept
// Chain = prompt → model → parser, connected with pipe()
// Data flows left to right through each step
// ─────────────────────────────────────────────
const chain = promptTemplate.pipe(model).pipe(outputParser);

// ─────────────────────────────────────────────
// PART 5: Run the chain
// ─────────────────────────────────────────────
async function runExamples() {
  console.log("=== LangChain Basics Demo ===\n");

  // Example 1: Simple chain invocation
  console.log("--- Example 1: Prompt Template + Chain ---");
  const answer1 = await chain.invoke({
    topic: "JavaScript",
    question: "What is a Promise?",
  });
  console.log("Answer:", answer1);
  console.log();

  // Example 2: Same chain, different inputs — reusability!
  console.log("--- Example 2: Same chain, different topic ---");
  const answer2 = await chain.invoke({
    topic: "AI",
    question: "What is an embedding?",
  });
  console.log("Answer:", answer2);
  console.log();

  // Example 3: Batch — run multiple inputs at once
  console.log("--- Example 3: Batch processing ---");
  const answers = await chain.batch([
    { topic: "JavaScript", question: "What is async/await?" },
    { topic: "JavaScript", question: "What is the difference between let and const?" },
  ]);
  answers.forEach((ans, i) => {
    console.log(`Batch ${i + 1}:`, ans);
    console.log();
  });

  // Example 4: Streaming — get response word by word (great for UI)
  console.log("--- Example 4: Streaming response ---");
  process.stdout.write("Streamed: ");
  const stream = await chain.stream({
    topic: "JavaScript",
    question: "What is a closure?",
  });
  for await (const chunk of stream) {
    process.stdout.write(chunk); // prints each word as it arrives
  }
  console.log("\n");
}

runExamples().catch(console.error);
