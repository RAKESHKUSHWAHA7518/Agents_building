// src/components/ActionBar.jsx — AI action buttons + bundle download
import { downloadCompleteBundlePDF } from "../utils/downloadPdf.js";

export default function ActionBar({
  onRunPipeline, onRewrite, onCoverLetter, onInterviewPrep, onSkillsGap,
  loading, bundleData,
}) {
  const canDownloadBundle = bundleData?.analysis;
  const pipelineRunning = loading.pipeline;

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>

      {/* ── Multi-agent button — runs everything at once ── */}
      <button
        className="btn btn-primary"
        onClick={onRunPipeline}
        disabled={pipelineRunning}
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", fontWeight: 700 }}
      >
        {pipelineRunning
          ? <><span className="spinner" /> Running Agents...</>
          : "🤖 Run All Agents"}
      </button>

      <div style={{ width: 1, height: 28, background: "#334155", margin: "0 4px" }} />

      {/* ── Individual buttons ── */}
      <button className="btn btn-secondary" onClick={onRewrite} disabled={loading.rewrite || pipelineRunning}>
        {loading.rewrite ? <><span className="spinner" /> Rewriting...</> : "✍️ Rewrite Resume"}
      </button>
      <button className="btn btn-secondary" onClick={onCoverLetter} disabled={loading.cover || pipelineRunning}>
        {loading.cover ? <><span className="spinner" /> Generating...</> : "📝 Cover Letter"}
      </button>
      <button className="btn btn-secondary" onClick={onInterviewPrep} disabled={loading.interview || pipelineRunning}>
        {loading.interview ? <><span className="spinner" /> Preparing...</> : "🎯 Interview Prep"}
      </button>
      <button className="btn btn-secondary" onClick={onSkillsGap} disabled={loading.skills || pipelineRunning}>
        {loading.skills ? <><span className="spinner" /> Analyzing...</> : "📊 Skills Gap"}
      </button>

      {/* Bundle download — only shown when analysis exists */}
      {canDownloadBundle && (
        <button
          className="btn btn-secondary"
          style={{ marginLeft: "auto" }}
          onClick={() => downloadCompleteBundlePDF(bundleData)}
        >
          ⬇️ Download All as PDF
        </button>
      )}
    </div>
  );
}
