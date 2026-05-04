// src/components/ReportPanel.jsx — Research report display with stats, subtopics, copy/download
import { renderMarkdown } from "../utils/markdownRenderer.js";
import { AGENTS, PHASES } from "../utils/constants.js";

/**
 * @param {{
 *   report: string,
 *   stats: object|null,
 *   plan: object|null,
 *   isRunning: boolean,
 *   isDone: boolean,
 *   onCopy: Function,
 *   onDownload: Function,
 *   onReset: Function
 * }} props
 */
export default function ReportPanel({ report, stats, plan, isRunning, isDone, onCopy, onDownload, onReset }) {
  return (
    <div className="report-panel">
      {report ? (
        <>
          <div className="panel-header">
            <h3>📄 Research Report</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="action-btn" onClick={onCopy}>📋 Copy</button>
              <button className="action-btn" onClick={onDownload}>⬇️ Download</button>
              <button className="action-btn primary" onClick={onReset}>+ New</button>
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
                <span style={{ color: AGENTS[p.agent].color }}>
                  {AGENTS[p.agent].icon} {p.label}
                </span>
                {i < PHASES.length - 1 && <span className="flow-arrow">→</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
