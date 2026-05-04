// src/components/Header.jsx — App header with logo and agent pills
import { AGENTS } from "../utils/constants.js";

export default function Header() {
  return (
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
  );
}
