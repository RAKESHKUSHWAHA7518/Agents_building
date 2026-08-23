// src/lib/vectorStore.js — MongoDB Atlas Vector Search store.
// One shared `documents` collection; each query is scoped to a sessionId
// via the vector-search pre-filter (defined in the search index).
// Falls back to in-process cosine similarity if $vectorSearch is unavailable
// (e.g. embedded dev MongoDB, or Atlas still building the index).
import { Document } from "@langchain/core/documents";

import { env } from "../config/env.js";
import { collections } from "../db/database.js";
import { logger } from "./logger.js";

const NUM_CANDIDATES_MULTIPLIER = 20;

export class MongoVectorStore {
  /**
   * @param {GoogleGenerativeAIEmbeddings} embeddingsModel
   * @param {string} sessionId — document chunks are stored/searchable per session
   */
  constructor(embeddingsModel, sessionId) {
    this.embeddingsModel = embeddingsModel;
    this.sessionId = sessionId;
  }

  async addDocuments(docs) {
    const texts = docs.map((d) => d.pageContent);
    const vectors = await this.embeddingsModel.embedDocuments(texts);

    const records = vectors.map((vector, i) => ({
      sessionId: this.sessionId,
      text: docs[i].pageContent,
      metadata: docs[i].metadata || {},
      embedding: vector,
      createdAt: new Date(),
    }));

    await collections.documents().insertMany(records);
    return records.length;
  }

  async similaritySearch(query, k = 4) {
    const queryVector = await this.embeddingsModel.embedQuery(query);
    try {
      return await this.atlasVectorSearch(queryVector, k);
    } catch (err) {
      logger.warn(
        { err: err.message, sessionId: this.sessionId },
        "$vectorSearch unavailable — falling back to in-process cosine similarity"
      );
      return this.cosineFallback(queryVector, k);
    }
  }

  async atlasVectorSearch(queryVector, k) {
    const results = await collections
      .documents()
      .aggregate([
        {
          $vectorSearch: {
            index: env.VECTOR_SEARCH_INDEX,
            path: "embedding",
            queryVector,
            numCandidates: k * NUM_CANDIDATES_MULTIPLIER,
            limit: k,
            // only search within this session's document
            filter: { sessionId: { $eq: this.sessionId } },
          },
        },
        {
          $project: {
            _id: 0,
            text: 1,
            metadata: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ])
      .toArray();

    return results.map((r) => new Document({ pageContent: r.text, metadata: r.metadata }));
  }

  // Local cosine search over this session's chunks (works on any MongoDB).
  async cosineFallback(queryVector, k) {
    const docs = await collections
      .documents()
      .find({ sessionId: this.sessionId })
      .project({ text: 1, metadata: 1, embedding: 1 })
      .toArray();

    const scored = docs.map((doc) => ({
      doc,
      score: cosineSimilarity(queryVector, doc.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored
      .slice(0, k)
      .map((r) => new Document({ pageContent: r.doc.text, metadata: r.doc.metadata }));
  }

  asRetriever(k = 4) {
    return { invoke: (query) => this.similaritySearch(query, k) };
  }
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Deletes all embedded chunks belonging to a session (on delete/expiry). */
export async function deleteSessionVectors(sessionId) {
  const result = await collections.documents().deleteMany({ sessionId });
  return result.deletedCount;
}
