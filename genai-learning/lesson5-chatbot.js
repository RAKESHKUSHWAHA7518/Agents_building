// lesson5-chatbot.js — Q&A Chatbot with LangChain + Memory
// This is the Phase 1 mini project — a proper chatbot using LangChain patterns
import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import readline from "readline";

dotenv.config();

// ─────────────────────────────────────────────
// Model setup
// ─────────────────────────────────────────────
const model = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.7,
});

// ─────────────────────────────────────────────
// Prompt with memory placeholder
// MessagesPlaceholder is where the conversation history gets injected
// ─────────────────────────────────────────────
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a knowledgeable and friendly Q&A assistant.
Answer questions clearly and concisely.
If you don't know something, say so honestly.
Remember the conversation history and refer back to it when relevant.`,
  ],
  new MessagesPlaceholder("history"), // conversation history goes here
  ["human", "{question}"],
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

// ─────────────────────────────────────────────
// Manual memory — we manage history ourselves
// This is how LangChain memory works under the hood
// ─────────────────────────────────────────────
const conversationHistory = [];

async function chat(userQuestion) {
  // Run the chain with current history
  const response = await chain.invoke({
    history: conversationHistory,
    question: userQuestion,
  });

  // Save this exchange to history for next turn
  conversationHistory.push(new HumanMessage(userQuestion));
  conversationHistory.push(new AIMessage(response));

  return response;
}

// ─────────────────────────────────────────────
// Terminal interface
// ─────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🤖 LangChain Q&A Chatbot");
console.log("   Ask me anything! Type 'history' to see conversation, 'exit' to quit.\n");

function askQuestion() {
  rl.question("You: ", async (input) => {
    const userInput = input.trim();

    if (userInput.toLowerCase() === "exit") {
      console.log("Goodbye! 👋");
      rl.close();
      return;
    }

    // Special command to inspect conversation history
    if (userInput.toLowerCase() === "history") {
      console.log("\n--- Conversation History ---");
      conversationHistory.forEach((msg, i) => {
        const role = msg instanceof HumanMessage ? "You" : "Bot";
        console.log(`${i + 1}. ${role}: ${msg.content.substring(0, 80)}...`);
      });
      console.log("---------------------------\n");
      askQuestion();
      return;
    }

    if (!userInput) {
      askQuestion();
      return;
    }

    try {
      const response = await chat(userInput);
      console.log(`\nAssistant: ${response}\n`);
    } catch (error) {
      console.error("Error:", error.message);
    }

    askQuestion();
  });
}

askQuestion();
