// src/components/tabs/AnalysisTab.jsx
import { getScoreClass } from "../../utils/helpers.js";
import { downloadAnalysisPDF } from "../../utils/downloadPdf.js";

export default function AnalysisTab({ analysis, strategy, quality, pipelineSteps }) {
  if (!analysis) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Pipeline progress log (shown while running or after) ── */}
      {pipelineSteps?.length > 0 && (
        <div className="card" style={{ padding: "14px 16px" }}>
          <div className="section-title" style={{ marginBottom: 10 }}>🤖 Agent Pipeline Log</div>
          {pipelineSteps.map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: "#94a3b8", padding: "3px 0", fontFamily: "monospace" }}>
              <span style={{ color: "#6366f1", marginRight: 8 }}>[{s.step}]</span>
              {s.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Main analysis card ── */}
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

        {/* Hidden strengths — only from multi-agent analyzer */}
        {analysis.hiddenStrengths?.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div className="section-title">💎 Hidden Strengths</div>
            {analysis.hiddenStrengths.map((s, i) => (
              <div key={i} className="list-item">
                <div className="list-dot" style={{ background: "#a78bfa" }} />
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Red flags — only from multi-agent analyzer */}
        {analysis.redFlags?.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div className="section-title">🚩 Potential Concerns</div>
            {analysis.redFlags.map((r, i) => (
              <div key={i} className="list-item">
                <div className="list-dot" style={{ background: "#fb923c" }} />
                {r}
              </div>
            ))}
          </div>
        )}

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

      {/* ── Strategy card — only shown after multi-agent run ── */}
      {strategy && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>🧠 Agent Strategy</div>

          {/* Core narrative */}
          <div style={{ padding: "12px 14px", background: "#0f172a", borderRadius: 8, border: "1px solid #6366f1", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
              CORE NARRATIVE
            </div>
            <p style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>{strategy.coreNarrative}</p>
          </div>

          <div className="grid-2">
            {/* Top selling points */}
            <div>
              <div className="section-title">🏆 Top Selling Points</div>
              {strategy.topThreeSellingPoints?.map((p, i) => (
                <div key={i} className="list-item">
                  <div className="list-dot" style={{ background: "#6366f1" }} />
                  {p}
                </div>
              ))}
            </div>

            {/* Keywords to emphasize */}
            <div>
              <div className="section-title">🎯 Keywords to Emphasize</div>
              <div className="tag-list">
                {strategy.keywordsToEmphasize?.map((k, i) => (
                  <span key={i} className="tag" style={{ background: "#1e1b4b", color: "#a5b4fc", border: "1px solid #4338ca" }}>{k}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Tone guidance */}
          {strategy.toneGuidance && (
            <div style={{ marginTop: 14, fontSize: 13, color: "#94a3b8" }}>
              <span style={{ color: "#64748b", fontWeight: 600 }}>Tone: </span>
              {strategy.toneGuidance}
            </div>
          )}
        </div>
      )}

      {/* ── Quality report — only shown after multi-agent run ── */}
      {quality && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>✅ Quality Report</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
              background: quality.overallScore >= 80 ? "#14532d" : quality.overallScore >= 60 ? "#713f12" : "#450a0a",
              border: `2px solid ${quality.overallScore >= 80 ? "#4ade80" : quality.overallScore >= 60 ? "#facc15" : "#f87171"}`,
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>{quality.overallScore}</span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>/ 100</span>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>
                Consistency: <span style={{ color: quality.isConsistent ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                  {quality.isConsistent ? "✓ Consistent" : "⚠ Inconsistent"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>{quality.consistencyNotes}</div>
            </div>
          </div>
          {quality.suggestions?.length > 0 && (
            <div>
              <div className="section-title">💡 Suggestions</div>
              {quality.suggestions.map((s, i) => (
                <div key={i} className="list-item">
                  <div className="list-dot" style={{ background: "#facc15" }} />
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
