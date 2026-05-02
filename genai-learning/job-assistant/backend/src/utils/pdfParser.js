// src/utils/pdfParser.js — PDF text extraction utility
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

/**
 * Extract text content from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {{ text: string, pageCount: number }}
 */
export async function extractPdfText(filePath) {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();
  const text = docs.map((d) => d.pageContent).join("\n\n");
  return { text, pageCount: docs.length };
}
