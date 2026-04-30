// lesson9-rag-pipeline.js — Full RAG Pipeline
//
// RAG = Retrieval Augmented Generation
//
// The complete flow:
//   1. INGEST:   Load document → Split into chunks → Embed → Store in vector DB
//   2. RETRIEVE: User asks question → Embed question → Find similar chunks
//   3. GENERATE: Send question + relevant chunks to Gemini → Get answer
//
// This is the core of the PDF Chat App we're building!

import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";

dotenv.config();

// ─────────────────────────────────────────────
// Initialize model and embeddings
// ─────────────────────────────────────────────
const model = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0,  // 0 = factual, no creativity — good for Q&A
});

const embeddingsModel = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-2",
  apiKey: process.env.GEMINI_API_KEY,
});

// ─────────────────────────────────────────────
// Simple In-Memory Vector Store
// ─────────────────────────────────────────────
class SimpleVectorStore {
  constructor() {
    this.documents = [];
  }

  async addDocuments(docs) {
    const texts = docs.map(d => d.pageContent);
    const vectors = await embeddingsModel.embedDocuments(texts);
    vectors.forEach((vector, i) => {
      this.documents.push({ text: docs[i].pageContent, vector });
    });
  }

  cosineSimilarity(a, b) {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  }

  async similaritySearch(query, k = 4) {
    const queryVector = await embeddingsModel.embedQuery(query);
    const scored = this.documents.map(doc => ({
      pageContent: doc.text,
      score: this.cosineSimilarity(queryVector, doc.vector),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(r => new Document({ pageContent: r.pageContent }));
  }

  asRetriever(k = 4) {
    return { invoke: (query) => this.similaritySearch(query, k) };
  }
}

// ─────────────────────────────────────────────
// Sample document (in real app this comes from a PDF)
// ─────────────────────────────────────────────
const knowledgeBase = `
Company: TechCorp India
Founded: 2015
Headquarters: Bangalore, India
Employees: 2,500+

Products:
1. CloudSync Pro — Enterprise cloud storage solution
   - Price: ₹999/month per user
   - Features: 1TB storage, real-time sync, version history, team collaboration
   - Supported platforms: Windows, Mac, iOS, Android

2. DataVault — Secure data backup service
   - Price: ₹499/month per user
   - Features: Automated backups, 256-bit encryption, 30-day retention
   - Supported platforms: Windows, Mac, Linux

3. TeamFlow — Project management tool
   - Price: ₹299/month per user (Free tier: up to 3 users)
   - Features: Kanban boards, time tracking, Gantt charts, integrations with Slack and GitHub
   - Supported platforms: Web, iOS, Android

Support Policy:
- Business hours support: Monday to Friday, 9 AM to 6 PM IST
- Premium support (24/7): Available for Enterprise plans
- Response time: 4 hours for critical issues, 24 hours for general queries
- Support channels: Email (support@techcorp.in), Phone (+91-80-1234-5678), Live chat

Refund Policy:
- 30-day money-back guarantee for all products
- Refunds processed within 5-7 business days
- Annual subscriptions can be cancelled for pro-rated refund

Data Privacy:
- All data stored in India (Mumbai data center)
- GDPR and IT Act 2000 compliant
- Data never shared with third parties
- Users can export or delete their data at any time
`;

// ─────────────────────────────────────────────
// STEP 1: INGEST — Build the vector store
// ─────────────────────────────────────────────
async function buildKnowledgeBase(text) {
  console.log("📚 Building knowledge base...");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const chunks = await splitter.createDocuments([text]);
  console.log(`   Split into ${chunks.length} chunks`);

  const vectorStore = new SimpleVectorStore();
  await vectorStore.addDocuments(chunks);
  console.log("   Embedded and stored in vector DB");
  console.log("✅ Knowledge base ready!\n");

  return vectorStore;
}

// ─────────────────────────────────────────────
// STEP 2 + 3: Build the RAG chain
// ─────────────────────────────────────────────
function buildRAGChain(vectorStore) {
  const retriever = vectorStore.asRetriever(3);

  // RAG prompt — instructs Gemini to use ONLY the provided context
  const ragPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a helpful customer support assistant for TechCorp India.
Answer the user's question using ONLY the information provided in the context below.
If the answer is not in the context, say "I don't have that information. Please contact support@techcorp.in"
Be concise and friendly.

Context:
{context}`,
    ],
    ["human", "{question}"],
  ]);

  const formatDocs = (docs) =>
    docs.map((doc) => doc.pageContent).join("\n\n---\n\n");

  // RAG chain: question → retrieve → prompt → model → parse
  const ragChain = RunnableSequence.from([
    {
      context: (question) => retriever.invoke(question).then(formatDocs),
      question: new RunnablePassthrough(),
    },
    ragPrompt,
    model,
    new StringOutputParser(),
  ]);

  return ragChain;
}

// ─────────────────────────────────────────────
// Main: Run the full RAG pipeline
// ─────────────────────────────────────────────
async function main() {
  console.log("=== Full RAG Pipeline Demo ===\n");

  const vectorStore = await buildKnowledgeBase(knowledgeBase);
  const ragChain = buildRAGChain(vectorStore);

  const questions = [
    "How much does CloudSync Pro cost?",
    "What are the support hours?",
    "Can I get a refund if I'm not happy?",
    "Is my data stored in India?",
    "Do you offer a free plan for TeamFlow?",
    "What is the CEO's name?",  // Not in the document — tests graceful fallback
  ];

  console.log("─".repeat(60));
  console.log("Asking questions to the RAG system:");
  console.log("─".repeat(60));

  for (const question of questions) {
    console.log(`\n❓ Question: ${question}`);
    const answer = await ragChain.invoke(question);
    console.log(`💬 Answer: ${answer}`);
  }

  console.log("\n─".repeat(60));
  console.log("✅ RAG Pipeline complete!");
  console.log("   The last question got a fallback — info wasn't in the knowledge base.");
}

main().catch(console.error);
