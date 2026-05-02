// src/components/JobDescriptionInput.jsx
export default function JobDescriptionInput({ value, onChange, onAnalyze, disabled, loading }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">🎯 Job Description</div>
          <div className="card-subtitle">Paste the job posting</div>
        </div>
      </div>

      <textarea
        className="textarea"
        rows={8}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Paste the full job description here...

Example:
We are looking for a Senior React Developer with 3+ years experience in React, Node.js, TypeScript...
Requirements:
- Strong knowledge of React hooks and state management
- Experience with REST APIs...`}
        disabled={disabled}
      />

      <button
        className="btn btn-primary btn-full"
        style={{ marginTop: 12 }}
        onClick={onAnalyze}
        disabled={disabled || !value.trim() || loading}
      >
        {loading
          ? <><span className="spinner" /> Analyzing...</>
          : "🔍 Analyze Match"
        }
      </button>
    </div>
  );
}
