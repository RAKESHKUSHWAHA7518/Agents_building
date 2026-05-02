// src/utils/helpers.js — Shared utility functions

// Simple markdown to HTML converter
export function renderMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul]|<hr|<p)(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}

// Get score color class
export function getScoreClass(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// Copy text to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Read SSE stream and call onChunk for each chunk
export async function readSSEStream(response, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) throw new Error(data.error);
        if (data.chunk) {
          fullText += data.chunk;
          onChunk(fullText);
        }
      } catch (e) {
        if (e.message !== "Unexpected end of JSON input") throw e;
      }
    }
  }

  return fullText;
}
