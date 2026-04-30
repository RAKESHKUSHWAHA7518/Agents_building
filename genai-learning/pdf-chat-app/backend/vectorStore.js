// vectorStore.js — Simple in-memory vector store
import { Document } from "@langchain/core/documents";

export class SimpleVectorStore {
  constructor(embeddingsModel) {
    this.documents = [];
    this.embeddingsModel = embeddingsModel;
  }

  async addDocuments(docs) {
    const texts = docs.map((d) => d.pageContent);
    const vectors = await this.embeddingsModel.embedDocuments(texts);
    vectors.forEach((vector, i) => {
      this.documents.push({
        text: docs[i].pageContent,
        metadata: docs[i].metadata || {},
        vector,
      });
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
    const scored = this.documents.map((doc) => ({
      pageContent: doc.text,
      metadata: doc.metadata,
      score: this.cosineSimilarity(queryVector, doc.vector),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((r) => new Document({ pageContent: r.pageContent, metadata: r.metadata }));
  }

  asRetriever(k = 4) {
    return { invoke: (query) => this.similaritySearch(query, k) };
  }
}
