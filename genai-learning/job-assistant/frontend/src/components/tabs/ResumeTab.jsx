// src/components/tabs/ResumeTab.jsx
import { renderMarkdown, copyToClipboard } from "../../utils/helpers.js";
import { downloadResumePDF } from "../../utils/downloadPdf.js";

export default function ResumeTab({ rewrittenResume, loading, candidateName }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">✍️ AI-Rewritten Resume</div>
        <div style={{ display: "flex", gap: 8 }}>
          {rewrittenResume && (
            <>
              <button className="copy-btn" onClick={() => copyToClipboard(rewrittenResume)}>
                📋 Copy
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => downloadResumePDF(rewrittenResume, candidateName)}
              >
                ⬇️ Download PDF
              </button>
            </>
          )}
        </div>
      </div>

      {loading && !rewrittenResume && (
        <div>
          <div className="progress-bar"><div className="progress-fill" /></div>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Rewriting your resume...</p>
        </div>
      )}

      {rewrittenResume && (
        <div
          className="md-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(rewrittenResume) }}
        />
      )}
    </div>
  );
}
