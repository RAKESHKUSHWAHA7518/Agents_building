// lesson1.js — Your first Gemini API call
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Pick the model — gemini-1.5-flash is fast and free tier friendly
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

async function askGemini(prompt) {
  console.log("Sending prompt:", prompt);
  console.log("---");

  // Send the prompt and wait for response
  const result = await model.generateContent(prompt);
  const response = result.response.text();

  console.log("Gemini says:", response);
}

// Try it!
askGemini("Explain what an LLM is in 3 simple sentences.");
