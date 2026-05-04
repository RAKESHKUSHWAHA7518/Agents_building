// src/services/api.js — All API calls in one place

const BASE = "/api";

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  // Upload resume PDF
  async uploadResume(file) {
    const formData = new FormData();
    formData.append("resume", file);
    const res = await fetch(`${BASE}/resume/upload`, { method: "POST", body: formData });
    return handleResponse(res);
  },

  // Analyze resume vs job description
  async analyzeMatch(sessionId, jobDescription) {
    const res = await fetch(`${BASE}/analysis/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, jobDescription }),
    });
    return handleResponse(res);
  },

  // Rewrite resume — returns SSE stream
  async rewriteResume(sessionId) {
    return fetch(`${BASE}/analysis/rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  },

  // Generate cover letter
  async generateCoverLetter(sessionId, candidateName) {
    const res = await fetch(`${BASE}/analysis/cover-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, candidateName }),
    });
    return handleResponse(res);
  },

  // Generate interview prep
  async generateInterviewPrep(sessionId) {
    const res = await fetch(`${BASE}/analysis/interview-prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    return handleResponse(res);
  },

  // Analyze skills gap
  async analyzeSkillsGap(sessionId) {
    const res = await fetch(`${BASE}/analysis/skills-gap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    return handleResponse(res);
  },

  // Full multi-agent pipeline — returns SSE stream with progress + final result
  async runFullPipeline(sessionId, jobDescription, candidateName) {
    return fetch(`${BASE}/analysis/full-pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, jobDescription, candidateName }),
    });
  },

  // Delete session
  async deleteSession(sessionId) {
    await fetch(`${BASE}/session/${sessionId}`, { method: "DELETE" });
  },
};
