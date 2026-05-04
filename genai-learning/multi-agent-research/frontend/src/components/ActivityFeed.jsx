// src/components/ActivityFeed.jsx — Real-time agent activity event list
import { AGENTS } from "../utils/constants.js";

/**
 * @param {{ events: Array, isRunning: boolean, isDone: boolean, eventsEndRef: React.RefObject }} props
 */
export default function ActivityFeed({ events, isRunning, isDone, eventsEndRef }) {
  return (
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
  );
}
