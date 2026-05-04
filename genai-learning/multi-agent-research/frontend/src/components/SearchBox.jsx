// src/components/SearchBox.jsx — Search input, button, and suggestion chips
import { SUGGESTIONS } from "../utils/constants.js";

/**
 * @param {{ topic: string, setTopic: Function, isRunning: boolean, isDone: boolean, onSearch: Function }} props
 */
export default function SearchBox({ topic, setTopic, isRunning, isDone, onSearch }) {
  return (
    <div className="search-section">
      <h2>What should the agents research?</h2>
      <p>5 AI agents will plan, search, analyze, write, and review a comprehensive report</p>

      <div className="search-box">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Enter any research topic..."
          disabled={isRunning}
        />
        <button
          className="search-btn"
          onClick={() => onSearch()}
          disabled={isRunning || !topic.trim()}
        >
          {isRunning ? <><span className="spinner" /> Researching...</> : "🚀 Start Research"}
        </button>
      </div>

      {!isRunning && !isDone && (
        <div className="suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="suggestion-chip" onClick={() => onSearch(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
