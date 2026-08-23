// src/db/database.js — MongoDB connection, collections, and index management.
//
// Data model:
//   users        — { _id, email (unique), passwordHash, createdAt }
//   guest_usage  — { _id: guestId, uploadsUsed, createdAt, updatedAt }
//   documents    — { sessionId, text, metadata, embedding: [float], createdAt }
//                  + Atlas Vector Search index on `embedding` (sessionId as filter)
import { MongoClient } from "mongodb";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

let client;
let db;
let memoryServer;

export async function connectDatabase() {
  let uri = env.MONGODB_URI;

  // Zero-setup dev mode: spin up an in-process MongoDB with data persisted
  // to backend/data/mongodb (survives restarts). No Docker/Atlas needed.
  if (uri === "memory") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: env.MONGODB_DB,
        storageEngine: "wiredTiger",
        dbPath: new URL("../../data/mongodb", import.meta.url).pathname,
      },
    });
    uri = memoryServer.getUri();
    logger.info({ dbPath: "data/mongodb" }, "Started embedded MongoDB (dev mode)");
  }

  client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  db = client.db(env.MONGODB_DB);
  logger.info({ uri: uri.replace(/\/\/.*@/, "//***@"), db: env.MONGODB_DB }, "Connected to MongoDB");
}

export async function closeDatabase() {
  await client?.close();
  await memoryServer?.stop();
}

function getDb() {
  if (!db) throw new Error("Database not connected. Call connectDatabase() first.");
  return db;
}

export const collections = {
  users: () => getDb().collection("users"),
  guestUsage: () => getDb().collection("guest_usage"),
  documents: () => getDb().collection("documents"),
  // signed-in user's current document (one per user) — enables restore-after-close
  userDocuments: () => getDb().collection("user_documents"),
};

export function pingDatabase() {
  return getDb().command({ ping: 1 });
}

/** Regular indexes (unique email, fast session lookups). */
export async function ensureIndexes() {
  await collections.users().createIndex({ email: 1 }, { unique: true });
  await collections.documents().createIndex({ sessionId: 1 });
  await collections.userDocuments().createIndex({ sessionId: 1 });
  logger.info("MongoDB indexes ensured");
}

/**
 * Creates the Atlas Vector Search index if missing.
 * `sessionId` is a filter field so searches are scoped per uploaded document.
 * Dimensions are auto-detected from the embedding model at startup.
 */
export async function ensureVectorSearchIndex(numDimensions) {
  const documents = collections.documents();
  const definition = {
    fields: [
      { type: "vector", path: "embedding", numDimensions, similarity: "cosine" },
      { type: "filter", path: "sessionId" },
    ],
  };

  let existing = [];
  try {
    existing = await documents.listSearchIndexes(env.VECTOR_SEARCH_INDEX).toArray();
  } catch {
    // listSearchIndexes unsupported (e.g. very old server) — try creating below
  }

  if (existing.length > 0) {
    logger.info({ index: env.VECTOR_SEARCH_INDEX }, "Vector search index already exists");
    return;
  }

  try {
    const name = await documents.createSearchIndex({
      name: env.VECTOR_SEARCH_INDEX,
      type: "vectorSearch",
      definition,
    });
    logger.warn(
      { index: name, numDimensions },
      "Vector search index created — Atlas may take a few minutes to build it before searches work"
    );
  } catch (err) {
    logger.error(
      { err },
      "Could not create the vector search index automatically. " +
        `Create it manually in Atlas UI (name: "${env.VECTOR_SEARCH_INDEX}", collection: "documents") ` +
        `with definition: ${JSON.stringify(definition)}`
    );
  }
}
