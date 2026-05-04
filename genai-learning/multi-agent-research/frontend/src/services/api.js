// src/services/api.js — All API calls in one place

/**
 * Start a research run for the given topic.
 * Returns the raw Response so the caller can consume res.body as an SSE stream.
 *
 * @param {string} topic
 * @returns {Promise<Response>}
 */
export async function startResearch(topic) {
  return fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
}
