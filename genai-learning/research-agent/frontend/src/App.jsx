import { useState, useRef, useEffect } from "react";
import "./App.css";

const SUGGESTED_TOPICS = [
  "Generative AI in India 2024",
  "LangChain vs LlamaIndex",
  "Vector databases comparison",
  "AI jobs market India",
  "React vs Vue 2024",
  "Node.js best practices",
];

// Simple markdown to HTML converter
function renderMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul]|<hr|<p)(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}

export default function App() {
  const [topic, setTopic] = useState("");
  const [steps, setSteps] = useState([]);
  const [report, setReport] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState(null);
  const [stepCount, setStepCount] = useState(0);
  const stepsEndRef = useRef(null);

  // Auto scroll steps
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps]);

  const startResearch = async (researchTopic) => {
    const t = researchTopic || topic;
    if (!t.trim() || isRunning) return;

    setSteps([]);
    setReport("");
    setError(null);
    setIsDone(false);
    setStepCount(0);
    setIsRunning(true);
    setTopic(t);

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

      // Read SSE stream
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
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setIsRunning(false);
    }
  };

  const handleEvent = (data) => {
    switch (data.type) {
      case "start":
        setSteps([{ icon: "🚀", label: data.message, detail: "", num: 0 }]);
        break;

      case "step":
        setSteps((prev) => [
          ...prev,
          {
            icon: data.icon,
            label: data.description,
            detail: data.tool,
            num: data.stepNumber,
          },
        ]);
        setStepCount(data.stepNumber);
        break;

      case "tool_result":
        setSteps((prev) => [
          ...prev,
          {
            icon: "✅",
            label: "Got result",
            detail: data.preview,
            num: data.stepNumber,
          },
        ]);
        break;

      case "writing":
        setSteps((prev) => [
          ...prev,
          { icon: "✍️", label: "Writing final report...", detail: "", num: 0 },
        ]);
        break;

      case "report":
        setReport(data.content);
        setStepCount(data.stepCount);
        break;

      case "done":
        setIsRunning(false);
        setIsDone(true);
        break;

      case "error":
        setError(data.message);
        setIsRunning(false);
        break;
    }
  };

  const copyReport = () => {
    navigator.clipboard.writeText(report);
  };

  const downloadReport = () => {
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-${topic.slice(0, 30).replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const newResearch = () => {
    setTopic("");
    setSteps([]);
    setReport("");
    setError(null);
    setIsDone(false);
    setStepCount(0);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-logo">🔬</div>
        <div>
          <h1>AI Research Agent</h1>
          <p>Powered by Gemini + LangGraph • Searches web, reads articles, writes reports</p>
        </div>
      </header>

      <main className="main">
        {/* Search */}
        <div className="search-section">
          <h2>Research anything</h2>
          <p>The AI agent will search the web, read articles, and write a comprehensive report</p>

          <div className="search-box">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startResearch()}
              placeholder="Enter a research topic..."
              disabled={isRunning}
            />
            <button
              className="search-btn"
              onClick={() => startResearch()}
              disabled={isRunning || !topic.trim()}
            >
              {isRunning ? "Researching..." : "🔍 Research"}
            </button>
          </div>

          {!isRunning && !isDone && (
            <div className="suggestions">
              {SUGGESTED_TOPICS.map((s) => (
                <button
                  key={s}
                  className="suggestion-chip"
                  onClick={() => startResearch(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="error-box">
            ⚠️ {error}
          </div>
        )}

        {/* Agent Activity */}
        {steps.length > 0 && (
          <div className="activity-panel">
            <div className="activity-header">
              <h3>Agent Activity</h3>
              <span className={`activity-badge ${isDone ? "done" : "running"}`}>
                {isDone ? "✓ Complete" : "● Running"}
              </span>
            </div>

            <div className="steps-list">
              {steps.map((step, i) => (
                <div key={i} className="step-item">
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <div className="step-label">{step.label}</div>
                    {step.detail && (
                      <div className="step-detail">{step.detail}</div>
                    )}
                  </div>
                  {step.num > 0 && (
                    <div className="step-num">#{step.num}</div>
                  )}
                </div>
              ))}
              {isRunning && (
                <div className="step-item">
                  <div className="spinner" />
                  <div className="step-content">
                    <div className="step-label">Agent is working...</div>
                  </div>
                </div>
              )}
              <div ref={stepsEndRef} />
            </div>

            {isRunning && (
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(stepCount * 8, 90)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Report */}
        {report ? (
          <div className="report-section">
            <div className="report-header">
              <h3>📄 Research Report</h3>
              <div className="report-actions">
                <button className="action-btn" onClick={copyReport}>
                  📋 Copy
                </button>
                <button className="action-btn" onClick={downloadReport}>
                  ⬇️ Download
                </button>
                <button className="action-btn primary" onClick={newResearch}>
                  + New Research
                </button>
              </div>
            </div>

            <div
              className="report-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
            />

            <div className="stats-bar">
              <div className="stat-item">
                🔍 <span>{stepCount}</span> agent steps
              </div>
              <div className="stat-item">
                📝 <span>{report.split(" ").length}</span> words
              </div>
              <div className="stat-item">
                📖 <span>{Math.ceil(report.split(" ").length / 200)}</span> min read
              </div>
            </div>
          </div>
        ) : !isRunning && steps.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔬</div>
            <h3>Ready to research</h3>
            <p>
              Enter any topic above and the AI agent will search the web,
              read multiple articles, and write a comprehensive report for you.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
