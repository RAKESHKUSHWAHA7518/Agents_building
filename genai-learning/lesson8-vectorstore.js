// lesson8-vectorstore.js — Vector Store with In-Memory implementation
//
// CONCEPT: A vector store is a database that stores embeddings.
// Instead of searching by keywords, it searches by MEANING (semantic search).
//
// Flow:
//   Text chunks → Embed each chunk → Store vectors in memory
//   Query → Embed query → Find closest vectors → Return matching chunks

import dotenv from "dotenv";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

dotenv.config();

// ─────────────────────────────────────────────
// Embedding model — converts text to vectors
// ─────────────────────────────────────────────
const embeddingsModel = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
  apiKey: process.env.GEMINI_API_KEY,
});

// ─────────────────────────────────────────────
// Simple In-Memory Vector Store
// This is exactly what MemoryVectorStore does under the hood
// ─────────────────────────────────────────────
class SimpleVectorStore {
  constructor() {
    this.documents = []; // stores { text, vector, metadata }
  }

  // Embed each document and store it
  async addDocuments(docs) {
    const texts = docs.map((d) => d.pageContent);
    const vectors = await embeddingsModel.embedDocuments(texts);
    vectors.forEach((vector, i) => {
      this.documents.push({
        text: docs[i].pageContent,
        vector,
        metadata: docs[i].metadata || {},
      });
    });
  }

  // Cosine similarity: measures how close two vectors are
  // Returns 0 (completely different) to 1 (identical meaning)
  cosineSimilarity(a, b) {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  }

  // Embed the query, then find the top-k most similar stored documents
  async similaritySearch(query, k = 4) {
    const queryVector = await embeddingsModel.embedQuery(query);
    const scored = this.documents.map((doc) => ({
      text: doc.text,
      metadata: doc.metadata,
      score: this.cosineSimilarity(queryVector, doc.vector),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  // Returns a retriever interface compatible with LangChain chains
  asRetriever(k = 4) {
    return {
      invoke: async (query) => {
        const results = await this.similaritySearch(query, k);
        return results.map(
          (r) => new Document({ pageContent: r.text, metadata: r.metadata })
        );
      },
    };
  }
}

// ─────────────────────────────────────────────
// Sample document — imagine this came from a PDF
// ─────────────────────────────────────────────
const documentText = `
JavaScript Fundamentals Guide

Chapter 1: Variables and Data Types
JavaScript has three ways to declare variables: var, let, and const.
- var: function-scoped, can be redeclared, avoid in modern code
- let: block-scoped, can be reassigned, use for values that change
- const: block-scoped, cannot be reassigned, use by default

Data types in JavaScript:
- Primitive: string, number, boolean, null, undefined, symbol, bigint
- Reference: object, array, function

Chapter 2: Functions
Functions are reusable blocks of code. There are several ways to define them:

Regular function:
function greet(name) { return "Hello " + name; }

Arrow function (shorter syntax):
const greet = (name) => "Hello " + name;

Functions can accept parameters and return values.
Higher-order functions accept other functions as arguments.

Chapter 3: Arrays
Arrays store multiple values in a single variable.
Common methods:
- map(): transforms each element, returns new array
- filter(): keeps elements that pass a test, returns new array
- reduce(): combines all elements into single value
- forEach(): loops through elements, returns nothing
- find(): returns first element that passes a test
- includes(): checks if element exists, returns boolean

Chapter 4: Promises and Async/Await
JavaScript is single-threaded but handles async operations via the event loop.
A Promise represents a future value — pending, fulfilled, or rejected.

async/await syntax makes async code readable:
async function fetchData() {
  const data = await fetch('https://api.example.com/data');
  return data.json();
}

Always use try/catch with async/await to handle errors.

Chapter 5: Node.js
Node.js runs JavaScript on the server using Chrome's V8 engine.
Key features:
- Non-blocking I/O — handles many requests without waiting
- npm — package manager with millions of packages
- Built-in modules: fs (files), http (server), path (file paths)
- Express.js is the most popular web framework for Node.js
`;

// ─────────────────────────────────────────────
// Main demo
// ─────────────────────────────────────────────
async function buildVectorStore() {
  console.log("=== Vector Store Demo ===\n");

  // Step 1: Split document into chunks
  console.log("Step 1: Splitting document into chunks...");
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });
  const chunks = await splitter.createDocuments([documentText]);
  console.log(`   Created ${chunks.length} chunks\n`);

  // Step 2: Embed chunks and store in vector store
  console.log("Step 2: Embedding chunks and storing in vector store...");
  console.log("   (Calls Gemini embedding API for each chunk)");
  const vectorStore = new SimpleVectorStore();
  await vectorStore.addDocuments(chunks);
  console.log("✅ Vector store ready!\n");

  // Step 3: Semantic search queries
  console.log("─".repeat(60));
  console.log("Step 3: Semantic Search Queries");
  console.log("─".repeat(60));

  const queries = [
    "How do I declare a variable?",
    "What is the difference between map and filter?",
    "How do I handle asynchronous code?",
    "What is Node.js used for?",
  ];

  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);
    const results = await vectorStore.similaritySearch(query, 2);
    results.forEach((r, i) => {
      console.log(`  Result ${i + 1} [score: ${r.score.toFixed(4)}]:`);
      console.log(`  ${r.text.trim().substring(0, 150)}...`);
    });
  }

  // Step 4: Search with similarity scores
  console.log("\n" + "─".repeat(60));
  console.log("Step 4: Search with similarity scores");
  console.log("─".repeat(60));

  const queryWithScore = "arrow function syntax";
  console.log(`\nQuery: "${queryWithScore}"\n`);

  const resultsWithScores = await vectorStore.similaritySearch(queryWithScore, 3);
  resultsWithScores.forEach((r, i) => {
    console.log(`Result ${i + 1} — Score: ${r.score.toFixed(4)}`);
    console.log(`  ${r.text.trim().substring(0, 120)}...`);
    console.log();
  });

  console.log("✅ This is the retrieval part of RAG — finding relevant context!");
  console.log("   Next step: pass these chunks to Gemini to generate an answer.");
}

buildVectorStore().catch(console.error);
