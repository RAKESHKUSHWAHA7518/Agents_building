// src/components/tabs/InterviewTab.jsx
import { downloadInterviewPDF } from "../../utils/downloadPdf.js";

export default function InterviewTab({ interviewPrep, loading, candidateName }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">🎯 Interview Questions & Answers</div>
        {interviewPrep?.questions?.length > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => downloadInterviewPDF(interviewPrep, candidateName)}
          >
            ⬇️ Download PDF
          </button>
        )}
      </div>

      {loading && (
        <div>
          <div className="progress-bar"><div className="progress-fill" /></div>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Preparing interview questions...</p>
        </div>
      )}

      {interviewPrep?.questions?.map((q, i) => (
        <div key={i} className="interview-card">
          <div className="interview-q">Q{i + 1}: {q.question}</div>
          <div className="interview-meta">
            <span className="tag tag-blue">{q.type}</span>
            <span className="tag tag-yellow">{q.framework}</span>
          </div>
          <div className="interview-why">💡 {q.why}</div>
          <ul className="interview-points">
            {q.keyPoints?.map((p, j) => <li key={j}>{p}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
