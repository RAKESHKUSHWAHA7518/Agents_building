// src/utils/constants.js — Shared constants used across components and hooks

// Agent config — each agent has a color and icon
export const AGENTS = {
  Planner:  { icon: "🗺️", color: "#6366f1", label: "Planner Agent" },
  Search:   { icon: "🔍", color: "#0ea5e9", label: "Search Agent" },
  Analyst:  { icon: "📊", color: "#8b5cf6", label: "Analyst Agent" },
  Writer:   { icon: "✍️", color: "#10b981", label: "Writer Agent" },
  Critic:   { icon: "🔬", color: "#f59e0b", label: "Critic Agent" },
};

export const PHASES = [
  { n: 1, label: "Planning",  agent: "Planner" },
  { n: 2, label: "Searching", agent: "Search" },
  { n: 3, label: "Analysis",  agent: "Analyst" },
  { n: 4, label: "Writing",   agent: "Writer" },
  { n: 5, label: "Review",    agent: "Critic" },
];

export const SUGGESTIONS = [
  "Generative AI market in India 2024",
  "LangChain vs LlamaIndex comparison",
  "Multi-agent AI systems explained",
  "React vs Vue vs Angular 2024",
  "Node.js microservices best practices",
  "Vector databases for AI applications",
];
