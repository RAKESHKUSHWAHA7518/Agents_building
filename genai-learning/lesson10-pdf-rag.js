// lesson10-pdf-rag.js — PDF RAG (Phase 2 Mini Project)
//
// This is the complete PDF chat system:
//   1. Load a real PDF file
//   2. Split it into chunks
//   3. Embed and store in vector DB
//   4. Accept questions from terminal
//   5. Retrieve relevant chunks + generate answers
//
// HOW TO USE:
//   1. Put any PDF file in the ./sample-docs/ folder
//   2. Update PDF_PATH below to point to your file
//   3. Run: node lesson10-pdf-rag.js
//   4. Ask questions about your PDF!

import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import readline from "readline";
import fs from "fs";
import path from "path";

dotenv.config();

// ─────────────────────────────────────────────
// Simple In-Memory Vector Store
// ─────────────────────────────────────────────
class SimpleVectorStore {
  constructor(embeddingsModel) {
    this.documents = [];
    this.embeddingsModel = embeddingsModel;
  }

  async addDocuments(docs) {
    const texts = docs.map(d => d.pageContent);
    const vectors = await this.embeddingsModel.embedDocuments(texts);
    vectors.forEach((vector, i) => {
      this.documents.push({ text: docs[i].pageContent, metadata: docs[i].metadata || {}, vector });
    });
  }

  cosineSimilarity(a, b) {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  }

  async similaritySearch(query, k = 4) {
    const queryVector = await this.embeddingsModel.embedQuery(query);
    const scored = this.documents.map(doc => ({
      pageContent: doc.text,
      metadata: doc.metadata,
      score: this.cosineSimilarity(queryVector, doc.vector),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(r => new Document({ pageContent: r.pageContent, metadata: r.metadata }));
  }

  asRetriever(k = 4) {
    return { invoke: (query) => this.similaritySearch(query, k) };
  }
}

// ─────────────────────────────────────────────
// CONFIG — change PDF_PATH to your PDF file
// ─────────────────────────────────────────────
const PDF_PATH = "./sample-docs/sample.pdf";

// ─────────────────────────────────────────────
// Initialize model and embeddings
// ─────────────────────────────────────────────
const model = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0,
});

const embeddingsModel = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-2",
  apiKey: process.env.GEMINI_API_KEY,
});

// ─────────────────────────────────────────────
// STEP 1: Load and process PDF
// ─────────────────────────────────────────────
async function loadPDF(pdfPath) {
  console.log(`📄 Loading PDF: ${pdfPath}`);

  if (!fs.existsSync(pdfPath)) {
    throw new Error(
      `PDF not found at ${pdfPath}\n` +
      `Please add a PDF file to ./sample-docs/ and update PDF_PATH in this file.`
    );
  }

  // PDFLoader extracts text from PDF pages
  const loader = new PDFLoader(pdfPath);
  const docs = await loader.load();

  console.log(`   Loaded ${docs.length} page(s)`);
  console.log(`   Total characters: ${docs.reduce((sum, d) => sum + d.pageContent.length, 0)}`);

  return docs;
}

// ─────────────────────────────────────────────
// STEP 2: Split into chunks
// ─────────────────────────────────────────────
async function splitDocuments(docs) {
  console.log("✂️  Splitting into chunks...");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitDocuments(docs);
  console.log(`   Created ${chunks.length} chunks`);

  return chunks;
}

// ─────────────────────────────────────────────
// STEP 3: Embed and store in vector DB
// ─────────────────────────────────────────────
async function createVectorStore(chunks) {
  console.log("🔢 Embedding chunks and storing in vector DB...");
  console.log(`   This may take a moment for large PDFs...`);

  const vectorStore = new SimpleVectorStore(embeddingsModel);
  await vectorStore.addDocuments(chunks);
  console.log("✅ Vector store ready!\n");

  return vectorStore;
}

// ─────────────────────────────────────────────
// STEP 4: Build RAG chain with conversation memory
// ─────────────────────────────────────────────
function buildRAGChain(vectorStore) {
  const retriever = vectorStore.asRetriever(4);

  // RAG prompt with conversation history support
  const ragPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a helpful assistant that answers questions about a document.
Use ONLY the following context to answer the question.
If the answer is not in the context, say "I couldn't find that in the document."
Be concise and accurate. Cite relevant details from the document.

Context from document:
{context}`,
    ],
    new MessagesPlaceholder("history"),  // conversation history
    ["human", "{question}"],
  ]);

  const formatDocs = (docs) => {
    return docs
      .map((doc, i) => `[Chunk ${i + 1}]:\n${doc.pageContent}`)
      .join("\n\n");
  };

  const ragChain = RunnableSequence.from([
    {
      context: (input) => retriever.invoke(input.question).then(formatDocs),
      question: (input) => input.question,
      history: (input) => input.history,
    },
    ragPrompt,
    model,
    new StringOutputParser(),
  ]);

  return ragChain;
}

// ─────────────────────────────────────────────
// STEP 5: Interactive chat loop
// ─────────────────────────────────────────────
async function startChat(ragChain, pdfName) {
  const conversationHistory = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("─".repeat(60));
  console.log(`📚 PDF loaded: ${pdfName}`);
  console.log("   Ask questions about your document.");
  console.log("   Commands: 'clear' (reset history), 'exit' (quit)");
  console.log("─".repeat(60) + "\n");

  function askQuestion() {
    rl.question("You: ", async (input) => {
      const userInput = input.trim();

      if (userInput.toLowerCase() === "exit") {
        console.log("Goodbye! 👋");
        rl.close();
        return;
      }

      if (userInput.toLowerCase() === "clear") {
        conversationHistory.length = 0;
        console.log("✅ Conversation history cleared.\n");
        askQuestion();
        return;
      }

      if (!userInput) {
        askQuestion();
        return;
      }

      try {
        process.stdout.write("Assistant: ");

        // Stream the response word by word
        const stream = await ragChain.stream({
          question: userInput,
          history: conversationHistory,
        });

        let fullResponse = "";
        for await (const chunk of stream) {
          process.stdout.write(chunk);
          fullResponse += chunk;
        }
        console.log("\n");

        // Save to history
        conversationHistory.push(new HumanMessage(userInput));
        conversationHistory.push(new AIMessage(fullResponse));

        // Keep history manageable (last 10 exchanges)
        if (conversationHistory.length > 20) {
          conversationHistory.splice(0, 2);
        }

      } catch (error) {
        console.error("\nError:", error.message);
      }

      askQuestion();
    });
  }

  askQuestion();
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log("=== PDF Chat App — Phase 2 Mini Project ===\n");

  try {
    // Full pipeline
    const docs = await loadPDF(PDF_PATH);
    const chunks = await splitDocuments(docs);
    const vectorStore = await createVectorStore(chunks);
    const ragChain = buildRAGChain(vectorStore);

    // Start interactive chat
    await startChat(ragChain, path.basename(PDF_PATH));

  } catch (error) {
    if (error.message.includes("PDF not found")) {
      console.error("❌ " + error.message);
      console.log("\nTo test this app:");
      console.log("1. Download any PDF (e.g., a resume, textbook, or report)");
      console.log("2. Save it as: genai-learning/sample-docs/sample.pdf");
      console.log("3. Run this file again: node lesson10-pdf-rag.js");
    } else {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

main();
