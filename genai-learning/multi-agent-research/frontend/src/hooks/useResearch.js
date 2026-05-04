// src/hooks/useResearch.js — All research state and SSE streaming logic
import { useState, useRef, useEffect } from "react";
import { AGENTS } from "../utils/constants.js";
import { startResearch as fetchResearch } from "../services/api.js";

export function useResearch() {
  const [topic, setTopic] = useState("");
  const [events, setEvents] = useState([]);
  const [report, setReport] = useState("");
  const [plan, setPlan] = useState(null);
  const [stats, setStats] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [error, setError] = useState(null);
  const eventsEndRef = useRef(null);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const addEvent = (event) =>
    setEvents((prev) => [...prev, { ...event, id: Date.now() + Math.random() }]);

  const handleEvent = (data) => {
    switch (data.type) {
      case "system":
        addEvent({ kind: "system", message: data.message });
        break;
      case "phase":
        setCurrentPhase(data.phase);
        addEvent({ kind: "phase", phase: data.phase, message: data.message });
        break;
      case "phase_done":
        addEvent({ kind: "phase_done", message: data.message });
        break;
      case "agent_start":
        addEvent({ kind: "agent_start", agent: data.agent, message: data.message, subtopic: data.subtopic });
        break;
      case "agent_done":
        addEvent({ kind: "agent_done", agent: data.agent, message: data.message });
        break;
      case "tool_call":
        addEvent({ kind: "tool", agent: data.agent, tool: data.tool, subtopic: data.subtopic });
        break;
      case "tool_result":
        addEvent({ kind: "tool_result", preview: data.preview });
        break;
      case "report":
        setReport(data.report);
        setPlan(data.plan);
        setStats(data.stats);
        break;
      case "complete":
        setIsRunning(false);
        setIsDone(true);
        setCurrentPhase(6);
        addEvent({ kind: "complete", message: data.message, stats: data.stats });
        break;
      case "error":
        setError(data.message);
        setIsRunning(false);
        break;
    }
  };

  const startResearch = async (researchTopic) => {
    const t = researchTopic || topic;
    if (!t.trim() || isRunning) return;

    setTopic(t);
    setEvents([]);
    setReport("");
    setPlan(null);
    setStats(null);
    setIsDone(false);
    setCurrentPhase(1);
    setError(null);
    setIsRunning(true);

    try {
      const res = await fetchResearch(t);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Research failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            handleEvent(data);
          } catch {}
        }
      }
    } catch (err) {
      setError(err.message);
      setIsRunning(false);
    }
  };

  const reset = () => {
    setTopic("");
    setEvents([]);
    setReport("");
    setPlan(null);
    setStats(null);
    setIsDone(false);
    setCurrentPhase(0);
    setError(null);
  };

  const copyReport = () => navigator.clipboard.writeText(report).catch(() => {});

  const downloadReport = () => {
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.slice(0, 30).replace(/\s+/g, "-")}-research.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    topic,
    setTopic,
    events,
    report,
    plan,
    stats,
    isRunning,
    isDone,
    currentPhase,
    error,
    eventsEndRef,
    startResearch,
    reset,
    copyReport,
    downloadReport,
  };
}
