import { useState, useRef, useEffect } from "react";
import "./App.css";

// Agent config — each agent has a color and icon
const AGENTS = {
  Planner:  { icon: "🗺️", color: "#6366f1", label: "Planner Agent" },
  Search:   { icon: "🔍", color: "#0ea5e9", label: "Search Agent" },
  Analyst:  { icon: "📊", color: "#8b5cf6", label: "Analyst Agent" },
  Writer:   { icon: "✍️", color: "#10b981", label: "Writer Agent" },
  Critic:   { icon: "🔬", color: "#f59e0b", label: "Critic Agent" },
};

const PHASES = [
  { n: 1, label: "Planning",  agent: "Planner" },
  { n: 2, label: "Searching", agent: "Search" },
  { n: 3, label: "Analysis",  agent: "Analyst" },
  { n: 4, label: "Writing",   agent: "Writer" },
  { n: 5, label: "Review",    agent: "Critic" },
];

const SUGGESTIONS = [
  "Generative AI market in India 2024",
  "LangChain vs LlamaIndex comparison",
  "Multi-agent AI systems explained",
  "React vs Vue vs Angular 2024",
  "Node.js microservices best practices",
  "Vector databases for AI applications",
];

function renderMarkdown(text) {
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

export default function App() {
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

  const addEvent = (event) => setEvents((prev) => [...prev, { ...event, id: Date.now() + Math.random() }]);

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
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t }),
      });

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

  const reset = () => {
    setTopic(""); setEvents([]); setReport(""); setPlan(null);
    setStats(null); setIsDone(false); setCurrentPhase(0); setError(null);
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

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">🤖</div>
          <div>
            <h1>Multi-Agent Research System</h1>
            <p>5 specialized AI agents collaborate to research any topic</p>
          </div>
        </div>
        <div className="agent-pills">
          {Object.entries(AGENTS).map(([name, a]) => (
            <div key={name} className="agent-pill" style={{ borderColor: a.color }}>
              <span>{a.icon}</span>
              <span style={{ color: a.color }}>{name}</span>
            </div>
          ))}
        </div>
      </header>

      <main className="main">
        {/* Search */}
        <div className="search-section">
          <h2>What should the agents research?</h2>
          <p>5 AI agents will plan, search, analyze, write, and review a comprehensive report</p>

          <div className="search-box">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startResearch()}
              placeholder="Enter any research topic..."
              disabled={isRunning}
            />
            <button
              className="search-btn"
              onClick={() => startResearch()}
              disabled={isRunning || !topic.trim()}
            >
              {isRunning ? <><span className="spinner" /> Researching...</> : "🚀 Start Research"}
            </button>
          </div>

          {!isRunning && !isDone && (
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion-chip" onClick={() => startResearch(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>

        {error && <div className="error-box">⚠️ {error}</div>}

        {/* Phase Progress */}
        {(isRunning || isDone) && (
          <div className="phases-bar">
            {PHASES.map((p) => {
              const status = currentPhase > p.n ? "done" : currentPhase === p.n ? "active" : "pending";
              const agent = AGENTS[p.agent];
              return (
                <div key={p.n} className={`phase-item ${status}`}>
                  <div className="phase-icon" style={{ background: status === "pending" ? "#1e1e2e" : agent.color }}>
                    {status === "done" ? "✓" : agent.icon}
                  </div>
                  <div className="phase-label">{p.label}</div>
                  {status === "active" && <div className="phase-pulse" style={{ background: agent.color }} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Main content grid */}
        {(isRunning || isDone) && (
          <div className="content-grid">
            {/* Left: Agent Activity Feed */}
            <div className="activity-panel">
              <div className="panel-header">
                <h3>🔴 Agent Activity</h3>
                <span className={`status-badge ${isDone ? "done" : "live"}`}>
                  {isDone ? "✓ Complete" : "● Live"}
                </span>
              </div>

              <div className="events-list">
                {events.map((e) => (
                  <div key={e.id} className={`event event-${e.kind}`}>
                    {e.kind === "system" && (
                      <div className="event-system">{e.message}</div>
                    )}
                    {e.kind === "phase" && (
                      <div className="event-phase">
                        <span className="phase-num">Phase {e.phase}</span>
                        {e.message}
                      </div>
                    )}
                    {e.kind === "agent_start" && (
                      <div className="event-agent" style={{ borderLeftColor: AGENTS[e.agent]?.color }}>
                        <span className="agent-icon">{AGENTS[e.agent]?.icon}</span>
                        <div>
                          <span className="agent-name" style={{ color: AGENTS[e.agent]?.color }}>
                            {e.agent} Agent
                          </span>
                          {e.subtopic && <span className="subtopic-tag">{e.subtopic}</span>}
                          <div className="event-msg">{e.message}</div>
                        </div>
                      </div>
                    )}
                    {e.kind === "agent_done" && (
                      <div className="event-done">
                        <span style={{ color: AGENTS[e.agent]?.color }}>✓ {e.agent}</span>
                        <span>{e.message}</span>
                      </div>
                    )}
                    {e.kind === "tool" && (
                      <div className="event-tool">
                        <span className="tool-icon">🔧</span>
                        <span className="tool-name">{e.tool}</span>
                        {e.subtopic && <span className="subtopic-tag">{e.subtopic}</span>}
                      </div>
                    )}
                    {e.kind === "complete" && (
                      <div className="event-complete">
                        <div>{e.message}</div>
                        {e.stats && (
                          <div className="complete-stats">
                            <span>⏱ {e.stats.duration}s</span>
                            <span>🤖 {e.stats.agents} agents</span>
                            <span>📋 {e.stats.subtopics} subtopics</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {isRunning && (
                  <div className="event-loading">
                    <span className="spinner" /> Agent working...
                  </div>
                )}
                <div ref={eventsEndRef} />
              </div>
            </div>

            {/* Right: Report */}
            <div className="report-panel">
              {report ? (
                <>
                  <div className="panel-header">
                    <h3>📄 Research Report</h3>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="action-btn" onClick={copyReport}>📋 Copy</button>
                      <button className="action-btn" onClick={downloadReport}>⬇️ Download</button>
                      <button className="action-btn primary" onClick={reset}>+ New</button>
                    </div>
                  </div>

                  {/* Stats */}
                  {stats && (
                    <div className="report-stats">
                      <div className="stat-item"><span>🤖</span><strong>{stats.agents}</strong> Agents</div>
                      <div className="stat-item"><span>📋</span><strong>{stats.subtopics}</strong> Subtopics</div>
                      <div className="stat-item"><span>⏱</span><strong>{stats.duration}s</strong> Duration</div>
                      <div className="stat-item"><span>📝</span><strong>{report.split(" ").length}</strong> Words</div>
                    </div>
                  )}

                  {/* Plan subtopics */}
                  {plan?.subtopics && (
                    <div className="subtopics-bar">
                      {plan.subtopics.map((s, i) => (
                        <span key={i} className="subtopic-chip">{s.title}</span>
                      ))}
                    </div>
                  )}

                  <div
                    className="report-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
                  />
                </>
              ) : (
                <div className="report-empty">
                  <div className="empty-icon">📄</div>
                  <p>Report will appear here when agents complete their work</p>
                  <div className="agent-flow">
                    {PHASES.map((p, i) => (
                      <span key={p.n}>
                        <span style={{ color: AGENTS[p.agent].color }}>{AGENTS[p.agent].icon} {p.label}</span>
                        {i < PHASES.length - 1 && <span className="flow-arrow">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isRunning && !isDone && (
          <div className="empty-state">
            <div className="agents-grid">
              {Object.entries(AGENTS).map(([name, a]) => (
                <div key={name} className="agent-card" style={{ borderColor: a.color }}>
                  <div className="agent-card-icon" style={{ background: a.color }}>{a.icon}</div>
                  <div className="agent-card-name" style={{ color: a.color }}>{name} Agent</div>
                  <div className="agent-card-desc">
                    {name === "Planner" && "Breaks topic into focused subtopics"}
                    {name === "Search" && "Searches web in parallel for each subtopic"}
                    {name === "Analyst" && "Synthesizes all findings into insights"}
                    {name === "Writer" && "Writes the comprehensive report"}
                    {name === "Critic" && "Reviews and improves report quality"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
