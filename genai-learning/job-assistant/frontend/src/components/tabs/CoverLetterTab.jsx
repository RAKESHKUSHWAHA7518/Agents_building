// src/components/tabs/CoverLetterTab.jsx
import { copyToClipboard } from "../../utils/helpers.js";
import { downloadCoverLetterPDF } from "../../utils/downloadPdf.js";

export default function CoverLetterTab({ coverLetter, loading, candidateName }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📝 Cover Letter</div>
        <div style={{ display: "flex", gap: 8 }}>
          {coverLetter && (
            <>
              <button className="copy-btn" onClick={() => copyToClipboard(coverLetter)}>
                📋 Copy
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => downloadCoverLetterPDF(coverLetter, candidateName)}
              >
                ⬇️ Download PDF
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div>
          <div className="progress-bar"><div className="progress-fill" /></div>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Generating cover letter...</p>
        </div>
      )}

      {coverLetter && (
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8, color: "#94a3b8" }}>
          {coverLetter}
        </div>
      )}
    </div>
  );
}
