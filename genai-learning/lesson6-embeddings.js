// lesson6-embeddings.js — Understanding Embeddings
//
// CONCEPT: Embeddings convert text into arrays of numbers (vectors).
// Similar meaning = similar numbers = close together in vector space.
// This is how AI does "semantic search" — finding meaning, not just keywords.
//
// Example:
//   "dog"  → [0.2, 0.8, 0.1, ...]
//   "puppy"→ [0.21, 0.79, 0.12, ...] ← very close to "dog"
//   "car"  → [0.9, 0.1, 0.7, ...]   ← far from "dog"

import dotenv from "dotenv";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

dotenv.config();

// Gemini's embedding model — converts text to 768-dimensional vectors
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-2",
  apiKey: process.env.GEMINI_API_KEY,
});

// ─────────────────────────────────────────────
// Helper: calculate cosine similarity between two vectors
// Returns a value between 0 (completely different) and 1 (identical)
// ─────────────────────────────────────────────
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function exploreEmbeddings() {
  console.log("=== Understanding Embeddings ===\n");

  // ── Step 1: Embed a single text ──
  console.log("Step 1: Embedding a single sentence...");
  const singleVector = await embeddings.embedQuery("What is JavaScript?");
  console.log(`Vector dimensions: ${singleVector.length}`);
  console.log(`First 5 values: [${singleVector.slice(0, 5).map(n => n.toFixed(4)).join(", ")}...]`);
  console.log();

  // ── Step 2: Compare similar vs different sentences ──
  console.log("Step 2: Comparing similarity between sentences...\n");

  const sentences = [
    "JavaScript is a programming language",   // base sentence
    "JS is used for web development",          // similar meaning
    "Node.js runs JavaScript on the server",   // related topic
    "Python is great for data science",        // different language
    "I love eating pizza on weekends",         // completely unrelated
  ];

  // Embed all sentences at once (more efficient)
  const vectors = await embeddings.embedDocuments(sentences);

  // Compare each sentence to the first one
  const baseSentence = sentences[0];
  const baseVector = vectors[0];

  console.log(`Base sentence: "${baseSentence}"\n`);
  console.log("Similarity scores (1.0 = identical, 0.0 = completely different):");
  console.log("─".repeat(60));

  for (let i = 1; i < sentences.length; i++) {
    const similarity = cosineSimilarity(baseVector, vectors[i]);
    const bar = "█".repeat(Math.round(similarity * 20));
    console.log(`${similarity.toFixed(4)} ${bar}`);
    console.log(`         "${sentences[i]}"`);
    console.log();
  }

  // ── Step 3: Semantic search demo ──
  console.log("\nStep 3: Semantic Search Demo");
  console.log("─".repeat(60));

  const documents = [
    "JavaScript arrays have methods like map, filter, and reduce",
    "React is a JavaScript library for building user interfaces",
    "MongoDB is a NoSQL database that stores data as JSON documents",
    "CSS flexbox is used for creating flexible layouts",
    "Node.js allows running JavaScript outside the browser",
  ];

  const query = "How do I run JavaScript on the backend?";
  console.log(`Query: "${query}"\n`);

  const docVectors = await embeddings.embedDocuments(documents);
  const queryVector = await embeddings.embedQuery(query);

  // Find most similar document
  const scores = docVectors.map((vec, i) => ({
    text: documents[i],
    score: cosineSimilarity(queryVector, vec),
  }));

  scores.sort((a, b) => b.score - a.score);

  console.log("Results ranked by relevance:");
  scores.forEach((item, i) => {
    console.log(`${i + 1}. [${item.score.toFixed(4)}] ${item.text}`);
  });

  console.log("\n✅ This is exactly how RAG finds relevant chunks from your PDF!");
}

exploreEmbeddings().catch(console.error);
