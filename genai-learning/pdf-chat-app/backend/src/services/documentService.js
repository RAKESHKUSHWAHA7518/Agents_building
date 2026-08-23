// src/services/documentService.js — Persistent document library per signed-in user.
// Every upload by a logged-in user is recorded here, so PDFs survive page
// refreshes, browser closes, and server restarts (vectors live in MongoDB).
import crypto from "node:crypto";
import { collections } from "../db/database.js";

export async function saveUserDocument(userId, doc) {
  const record = {
    _id: crypto.randomUUID(),
    userId,
    sessionId: doc.sessionId,
    fileName: doc.fileName,
    pageCount: doc.pageCount,
    chunkCount: doc.chunkCount,
    createdAt: new Date(),
  };
  await collections.userDocuments().insertOne(record);
  return record;
}

export async function listUserDocuments(userId) {
  return collections
    .userDocuments()
    .find({ userId })
    .project({ userId: 0 })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getUserDocument(userId, sessionId) {
  return collections.userDocuments().findOne({ userId, sessionId });
}

export async function deleteUserDocument(userId, sessionId) {
  const result = await collections.userDocuments().deleteOne({ userId, sessionId });
  return result.deletedCount > 0;
}

/** True if vectors still exist for this document's session. */
export async function documentHasVectors(sessionId) {
  const doc = await collections
    .documents()
    .findOne({ sessionId }, { projection: { _id: 1 } });
  return !!doc;
}
