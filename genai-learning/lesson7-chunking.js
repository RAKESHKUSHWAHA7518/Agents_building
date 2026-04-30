// lesson7-chunking.js — Text Splitting / Chunking
//
// CONCEPT: LLMs have a limited context window (can't read a whole book at once).
// We split documents into smaller "chunks" so we can:
//   1. Embed each chunk separately
//   2. Store them in a vector database
//   3. Retrieve only the RELEVANT chunks when answering a question
//
// Key settings:
//   chunkSize    — max characters per chunk
//   chunkOverlap — how many characters overlap between chunks
//                  (overlap prevents losing context at chunk boundaries)

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// ─────────────────────────────────────────────
// Sample long document (simulating a PDF page)
// ─────────────────────────────────────────────
const sampleDocument = `
JavaScript is a high-level, interpreted programming language that is one of the core technologies of the World Wide Web. It was originally designed to make web pages interactive and is now used for server-side development as well.

Variables in JavaScript can be declared using var, let, or const. The var keyword has function scope, while let and const have block scope. The const keyword is used for values that should not be reassigned.

Functions are first-class citizens in JavaScript, meaning they can be assigned to variables, passed as arguments, and returned from other functions. Arrow functions provide a shorter syntax and do not have their own 'this' binding.

Promises and async/await are used for handling asynchronous operations in JavaScript. A Promise represents a value that may be available now, in the future, or never. The async/await syntax makes asynchronous code look and behave more like synchronous code.

Arrays in JavaScript are dynamic and can hold values of different types. Common array methods include map(), filter(), reduce(), forEach(), find(), and includes(). These methods make it easy to transform and query data.

Objects in JavaScript are collections of key-value pairs. They can be created using object literals, constructor functions, or classes. The spread operator (...) can be used to copy or merge objects.

The Document Object Model (DOM) is a programming interface for HTML documents. JavaScript can manipulate the DOM to dynamically change the content, structure, and style of a web page. Common DOM methods include getElementById, querySelector, and addEventListener.

Node.js is a JavaScript runtime built on Chrome's V8 engine that allows JavaScript to run on the server side. It uses an event-driven, non-blocking I/O model that makes it lightweight and efficient for building scalable network applications.

npm (Node Package Manager) is the default package manager for Node.js. It allows developers to install, share, and manage dependencies in their projects. The package.json file contains metadata about the project and its dependencies.
`;

async function demonstrateChunking() {
  console.log("=== Text Splitting / Chunking Demo ===\n");
  console.log(`Original document: ${sampleDocument.length} characters\n`);

  // ── Experiment 1: Default chunking ──
  console.log("─".repeat(60));
  console.log("Experiment 1: chunkSize=500, chunkOverlap=50");
  console.log("─".repeat(60));

  const splitter1 = new RecursiveCharacterTextSplitter({
    chunkSize: 500,       // each chunk max 500 chars
    chunkOverlap: 50,     // 50 chars overlap between chunks
  });

  const chunks1 = await splitter1.createDocuments([sampleDocument]);
  console.log(`Number of chunks: ${chunks1.length}\n`);

  chunks1.forEach((chunk, i) => {
    console.log(`Chunk ${i + 1} (${chunk.pageContent.length} chars):`);
    console.log(chunk.pageContent.trim().substring(0, 100) + "...");
    console.log();
  });

  // ── Experiment 2: Larger chunks ──
  console.log("─".repeat(60));
  console.log("Experiment 2: chunkSize=1000, chunkOverlap=100");
  console.log("─".repeat(60));

  const splitter2 = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });

  const chunks2 = await splitter2.createDocuments([sampleDocument]);
  console.log(`Number of chunks: ${chunks2.length}`);
  console.log("(Fewer, larger chunks — less precise retrieval but more context per chunk)\n");

  // ── Experiment 3: Small chunks ──
  console.log("─".repeat(60));
  console.log("Experiment 3: chunkSize=200, chunkOverlap=20");
  console.log("─".repeat(60));

  const splitter3 = new RecursiveCharacterTextSplitter({
    chunkSize: 200,
    chunkOverlap: 20,
  });

  const chunks3 = await splitter3.createDocuments([sampleDocument]);
  console.log(`Number of chunks: ${chunks3.length}`);
  console.log("(More, smaller chunks — more precise retrieval but less context per chunk)\n");

  // ── Key insight ──
  console.log("─".repeat(60));
  console.log("KEY INSIGHT: Chunk overlap prevents losing context at boundaries");
  console.log("─".repeat(60));

  const overlapSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 200,
    chunkOverlap: 50,
  });
  const overlapChunks = await overlapSplitter.createDocuments([sampleDocument]);

  console.log("\nEnd of chunk 1:");
  console.log(`"...${overlapChunks[0].pageContent.trim().slice(-60)}"`);
  console.log("\nStart of chunk 2:");
  console.log(`"${overlapChunks[1].pageContent.trim().slice(0, 60)}..."`);
  console.log("\n↑ Notice the overlap — same text appears in both chunks.");
  console.log("  This ensures a sentence split across chunks is still findable.\n");

  console.log("✅ For our PDF Chat App we'll use chunkSize=1000, chunkOverlap=200");
}

demonstrateChunking().catch(console.error);
