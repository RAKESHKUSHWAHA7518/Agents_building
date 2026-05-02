// src/components/ActionBar.jsx — AI action buttons + bundle download
import { downloadCompleteBundlePDF } from "../utils/downloadPdf.js";

export default function ActionBar({
  onRewrite, onCoverLetter, onInterviewPrep, onSkillsGap,
  loading, bundleData,
}) {
  const canDownloadBundle = bundleData?.analysis;

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
      <button className="btn btn-secondary" onClick={onRewrite} disabled={loading.rewrite}>
        {loading.rewrite ? <><span className="spinner" /> Rewriting...</> : "✍️ Rewrite Resume"}
      </button>
      <button className="btn btn-secondary" onClick={onCoverLetter} disabled={loading.cover}>
        {loading.cover ? <><span className="spinner" /> Generating...</> : "📝 Cover Letter"}
      </button>
      <button className="btn btn-secondary" onClick={onInterviewPrep} disabled={loading.interview}>
        {loading.interview ? <><span className="spinner" /> Preparing...</> : "🎯 Interview Prep"}
      </button>
      <button className="btn btn-secondary" onClick={onSkillsGap} disabled={loading.skills}>
        {loading.skills ? <><span className="spinner" /> Analyzing...</> : "📊 Skills Gap"}
      </button>

      {/* Bundle download — only shown when analysis exists */}
      {canDownloadBundle && (
        <button
          className="btn btn-primary"
          style={{ marginLeft: "auto" }}
          onClick={() => downloadCompleteBundlePDF(bundleData)}
        >
          ⬇️ Download All as PDF
        </button>
      )}
    </div>
  );
}
