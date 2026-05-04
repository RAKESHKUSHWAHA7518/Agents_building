// src/components/PhaseBar.jsx — Phase progress bar showing research pipeline stages
import { AGENTS, PHASES } from "../utils/constants.js";

/**
 * @param {{ currentPhase: number, isRunning: boolean, isDone: boolean }} props
 */
export default function PhaseBar({ currentPhase, isRunning, isDone }) {
  return (
    <div className="phases-bar">
      {PHASES.map((p) => {
        const status = currentPhase > p.n ? "done" : currentPhase === p.n ? "active" : "pending";
        const agent = AGENTS[p.agent];
        return (
          <div key={p.n} className={`phase-item ${status}`}>
            <div
              className="phase-icon"
              style={{ background: status === "pending" ? "#1e1e2e" : agent.color }}
            >
              {status === "done" ? "✓" : agent.icon}
            </div>
            <div className="phase-label">{p.label}</div>
            {status === "active" && (
              <div className="phase-pulse" style={{ background: agent.color }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
