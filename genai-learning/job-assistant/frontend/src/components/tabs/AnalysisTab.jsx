// src/components/tabs/AnalysisTab.jsx
import { getScoreClass } from "../../utils/helpers.js";
import { downloadAnalysisPDF } from "../../utils/downloadPdf.js";

export default function AnalysisTab({ analysis }) {
  if (!analysis) return null;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📊 Match Analysis</div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => downloadAnalysisPDF(analysis)}
        >
          ⬇️ Download PDF
        </button>
      </div>
      {/* Score */}
      <div className="score-section">
        <div className={`score-circle ${getScoreClass(analysis.matchScore || 0)}`}>
          <span className="score-num">{analysis.matchScore || 0}</span>
          <span className="score-label">/ 100</span>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
            Match Score
          </div>
          <p className="score-summary">{analysis.summary}</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Strengths */}
        <div>
          <div className="section-title">✅ Strengths</div>
          {analysis.strengths?.map((s, i) => (
            <div key={i} className="list-item">
              <div className="list-dot" style={{ background: "#4ade80" }} />
              {s}
            </div>
          ))}
        </div>

        {/* Gaps */}
        <div>
          <div className="section-title">⚠️ Gaps</div>
          {analysis.gaps?.map((g, i) => (
            <div key={i} className="list-item">
              <div className="list-dot" style={{ background: "#f87171" }} />
              {g}
            </div>
          ))}
        </div>
      </div>

      {/* Missing keywords */}
      <div style={{ marginTop: 20 }}>
        <div className="section-title">🔑 Missing Keywords</div>
        <div className="tag-list">
          {analysis.missingKeywords?.map((k, i) => (
            <span key={i} className="tag tag-yellow">{k}</span>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      {analysis.recommendation && (
        <div style={{ marginTop: 20, padding: "14px 16px", background: "#1e1b4b", borderRadius: 10, border: "1px solid #3730a3" }}>
          <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600, marginBottom: 6 }}>
            💡 RECOMMENDATION
          </div>
          <p style={{ fontSize: 13, color: "#c7d2fe" }}>{analysis.recommendation}</p>
        </div>
      )}
    </div>
  );
}
