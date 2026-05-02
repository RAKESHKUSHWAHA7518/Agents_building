// src/components/tabs/SkillsGapTab.jsx
export default function SkillsGapTab({ skillsGap, loading }) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 16 }}>📈 Skills Gap Analysis</div>

      {loading && (
        <div>
          <div className="progress-bar"><div className="progress-fill" /></div>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Analyzing skills gap...</p>
        </div>
      )}

      {skillsGap && (
        <>
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="skills-section">
              <h4>✅ Skills You Have</h4>
              <div className="tag-list">
                {skillsGap.hasSkills?.map((s, i) => (
                  <span key={i} className="tag tag-green">{s}</span>
                ))}
              </div>
            </div>
            <div className="skills-section">
              <h4>❌ Skills to Learn</h4>
              <div className="tag-list">
                {skillsGap.missingSkills?.map((s, i) => (
                  <span key={i} className="tag tag-red">{s}</span>
                ))}
              </div>
            </div>
          </div>

          {skillsGap.niceToHave?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">⭐ Nice to Have</div>
              <div className="tag-list">
                {skillsGap.niceToHave.map((s, i) => (
                  <span key={i} className="tag tag-blue">{s}</span>
                ))}
              </div>
            </div>
          )}

          {skillsGap.learningPlan?.length > 0 && (
            <>
              <div className="section-title">📚 Learning Plan</div>
              {skillsGap.learningPlan.map((item, i) => (
                <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #1e1e2e" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{item.skill}</span>
                    <span className={`tag ${
                      item.priority === "high" ? "tag-red"
                      : item.priority === "medium" ? "tag-yellow"
                      : "tag-blue"
                    }`}>
                      {item.priority}
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>⏱ {item.timeToLearn}</span>
                  </div>
                  <div className="tag-list">
                    {item.resources?.map((r, j) => (
                      <span key={j} className="tag tag-blue">{r}</span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
