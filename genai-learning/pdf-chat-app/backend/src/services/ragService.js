// src/services/ragService.js — PDF processing + RAG chain construction.
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

import { env } from "../config/env.js";
import { MongoVectorStore, deleteSessionVectors } from "../lib/vectorStore.js";
import { sessionService } from "./sessionService.js";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const RETRIEVER_K = 4;

const model = new ChatGoogleGenerativeAI({
  model: env.GEMINI_CHAT_MODEL,
  apiKey: env.GEMINI_API_KEY,
  temperature: 0,
});

const embeddingsModel = new GoogleGenerativeAIEmbeddings({
  model: env.GEMINI_EMBEDDING_MODEL,
  apiKey: env.GEMINI_API_KEY,
});

// When a GUEST session is deleted or expires, remove its vectors from MongoDB.
// Signed-in users' documents persist (restore-after-close feature) until
// explicitly deleted via DELETE /api/documents/:sessionId.
sessionService.onSessionEnd((sessionId, session) => {
  if (!session?.userId) return deleteSessionVectors(sessionId);
});

/**
 * Rebuilds a RAG chain for a session whose vectors already exist in MongoDB.
 * Cheap — no re-embedding, just wraps the persisted vectors.
 */
export function rebuildRagChain(sessionId) {
  return buildRAGChain(new MongoVectorStore(embeddingsModel, sessionId));
}

/**
 * Loads a PDF from disk, splits it into chunks, embeds the chunks into
 * MongoDB Atlas Vector Search, and returns a ready-to-use RAG chain.
 */
export async function processPdf(sessionId, filePath) {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const chunks = await splitter.splitDocuments(docs);

  const vectorStore = new MongoVectorStore(embeddingsModel, sessionId);
  await vectorStore.addDocuments(chunks);

  return {
    pageCount: docs.length,
    chunkCount: chunks.length,
    ragChain: buildRAGChain(vectorStore),
  };
}

/** One tiny embedding call at startup to auto-detect the vector size. */
export async function probeEmbeddingDimensions() {
  const vector = await embeddingsModel.embedQuery("dimension probe");
  return vector.length;
}

function buildRAGChain(vectorStore) {
  const retriever = vectorStore.asRetriever(RETRIEVER_K);

  const ragPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a helpful assistant that answers questions about an uploaded document.
Use ONLY the following context from the document to answer the question.
If the answer is not in the context, say "I couldn't find that information in the document."
Be concise, accurate, and friendly.

Context from document:
{context}`,
    ],
    new MessagesPlaceholder("history"),
    ["human", "{question}"],
  ]);

  const formatDocs = (docs) =>
    docs.map((doc, i) => `[Section ${i + 1}]:\n${doc.pageContent}`).join("\n\n");

  return RunnableSequence.from([
    {
      context: (input) => retriever.invoke(input.question).then(formatDocs),
      question: (input) => input.question,
      history: (input) => input.history,
    },
    ragPrompt,
    model,
    new StringOutputParser(),
  ]);
}
