// src/components/ResumeUpload.jsx
import { useRef, useState } from "react";

export default function ResumeUpload({ session, loading, onUpload, onReset, candidateName, onNameChange }) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = (file) => {
    if (file) onUpload(file);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">📄 Your Resume</div>
          <div className="card-subtitle">Upload your resume PDF</div>
        </div>
        {session && (
          <button className="btn btn-secondary btn-sm" onClick={onReset}>
            Change
          </button>
        )}
      </div>

      {!session ? (
        <div
          className={`upload-area ${isDragOver ? "drag-over" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        >
          {loading ? (
            <>
              <div className="spinner" style={{ margin: "0 auto 12px" }} />
              <p>Processing PDF...</p>
            </>
          ) : (
            <>
              <div className="upload-icon">📂</div>
              <h3>Drop PDF here or click to browse</h3>
              <p>Max 5MB • PDF only</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }}
          />
        </div>
      ) : (
        <div className="file-info">
          <div className="file-icon">📕</div>
          <div>
            <div className="file-name">{session.fileName}</div>
            <div className="file-meta">
              {session.pageCount} pages • {session.charCount?.toLocaleString()} characters
            </div>
          </div>
        </div>
      )}

      {session && (
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>
            Your name (for cover letter)
          </label>
          <input
            type="text"
            value={candidateName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Rakesh Kushwaha"
            style={{
              width: "100%", background: "#0f0f18", border: "1px solid #2d2d3a",
              borderRadius: 8, padding: "8px 12px", color: "#e2e8f0",
              fontSize: 13, outline: "none", fontFamily: "inherit",
            }}
          />
        </div>
      )}
    </div>
  );
}
