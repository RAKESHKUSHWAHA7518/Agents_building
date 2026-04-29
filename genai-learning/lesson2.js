// lesson2.js — Prompt Engineering
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

async function compare() {
  // 1. Zero-shot — just ask directly
  const zeroShot = await model.generateContent(
    "Translate 'Hello, how are you?' to Hindi."
  );
  console.log("Zero-shot:", zeroShot.response.text());

  // 2. Few-shot — give examples first
  const fewShot = await model.generateContent(`
    Translate English to Hindi. Here are some examples:
    English: Good morning → Hindi: Shubh Prabhat
    English: Thank you → Hindi: Dhanyavaad
    English: Hello, how are you? → Hindi:
  `);
  console.log("Few-shot:", fewShot.response.text());

  // 3. System role — give the AI a persona
  const withRole = await model.generateContent(`
    You are an expert Hindi translator who always provides 
    both the Hindi script and the romanized version.
    
    Translate: "Hello, how are you?"
  `);
  console.log("With role:", withRole.response.text());
}

compare();
