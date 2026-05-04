// src/App.jsx — Root component (thin orchestration only)
import "./App.css";

import Header from "./components/Header.jsx";
import SearchBox from "./components/SearchBox.jsx";
import PhaseBar from "./components/PhaseBar.jsx";
import ActivityFeed from "./components/ActivityFeed.jsx";
import ReportPanel from "./components/ReportPanel.jsx";

import { useResearch } from "./hooks/useResearch.js";
import { AGENTS } from "./utils/constants.js";

const AGENT_DESCRIPTIONS = {
  Planner: "Breaks topic into focused subtopics",
  Search:  "Searches web in parallel for each subtopic",
  Analyst: "Synthesizes all findings into insights",
  Writer:  "Writes the comprehensive report",
  Critic:  "Reviews and improves report quality",
};

export default function App() {
  const {
    topic, setTopic,
    events, report, plan, stats,
    isRunning, isDone, currentPhase, error,
    eventsEndRef,
    startResearch, reset, copyReport, downloadReport,
  } = useResearch();

  return (
    <div className="app">
      <Header />

      <main className="main">
        <SearchBox
          topic={topic}
          setTopic={setTopic}
          isRunning={isRunning}
          isDone={isDone}
          onSearch={startResearch}
        />

        {error && <div className="error-box">⚠️ {error}</div>}

        {(isRunning || isDone) && (
          <PhaseBar currentPhase={currentPhase} isRunning={isRunning} isDone={isDone} />
        )}

        {(isRunning || isDone) && (
          <div className="content-grid">
            <ActivityFeed
              events={events}
              isRunning={isRunning}
              isDone={isDone}
              eventsEndRef={eventsEndRef}
            />
            <ReportPanel
              report={report}
              stats={stats}
              plan={plan}
              isRunning={isRunning}
              isDone={isDone}
              onCopy={copyReport}
              onDownload={downloadReport}
              onReset={reset}
            />
          </div>
        )}

        {!isRunning && !isDone && (
          <div className="empty-state">
            <div className="agents-grid">
              {Object.entries(AGENTS).map(([name, a]) => (
                <div key={name} className="agent-card" style={{ borderColor: a.color }}>
                  <div className="agent-card-icon" style={{ background: a.color }}>{a.icon}</div>
                  <div className="agent-card-name" style={{ color: a.color }}>{name} Agent</div>
                  <div className="agent-card-desc">{AGENT_DESCRIPTIONS[name]}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
