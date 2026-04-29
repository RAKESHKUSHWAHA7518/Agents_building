// lesson3.js — Chatbot with system prompt + conversation history
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import readline from "readline";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt — this defines the AI's persona and behavior
const SYSTEM_PROMPT = `You are an expert JavaScript tutor helping beginners learn programming.

Your rules:
- Only answer questions related to JavaScript, Node.js, or web development
- Always explain concepts in simple terms with real code examples
- If someone asks something unrelated to coding, politely redirect them back to JavaScript
- Keep answers concise but complete
- Always encourage the learner when they make progress
- Use emojis occasionally to keep the tone friendly 😊`;

const model = genAI.getGenerativeModel({
  model: "gemini-flash-latest",
  // systemInstruction is the official way to set a system prompt in Gemini SDK
  systemInstruction: SYSTEM_PROMPT,
});

// Start a chat session — Gemini remembers conversation history automatically
const chat = model.startChat({
  history: [],
  generationConfig: {
    temperature: 0.7,  // Slightly creative but focused
    maxOutputTokens: 500,
  },
});

// Setup terminal input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🤖 JavaScript Tutor ready! Ask me anything about JavaScript.");
console.log("   Type 'exit' to quit.\n");

function askQuestion() {
  rl.question("You: ", async (userInput) => {
    if (userInput.toLowerCase() === "exit") {
      console.log("Happy coding! 🚀");
      rl.close();
      return;
    }

    if (!userInput.trim()) {
      askQuestion();
      return;
    }

    try {
      // Send message — history is maintained automatically by the chat session
      const result = await chat.sendMessage(userInput);
      console.log("\nTutor:", result.response.text());
      console.log();
    } catch (error) {
      console.error("Error:", error.message);
    }

    // Ask next question
    askQuestion();
  });
}

askQuestion();
