// src/App.jsx — Root component (orchestration only)
import { useState } from "react";
import "./App.css";

import Header from "./components/Header.jsx";
import StepsIndicator from "./components/StepsIndicator.jsx";
import ResumeUpload from "./components/ResumeUpload.jsx";
import JobDescriptionInput from "./components/JobDescriptionInput.jsx";
import ActionBar from "./components/ActionBar.jsx";
import AnalysisTab from "./components/tabs/AnalysisTab.jsx";
import ResumeTab from "./components/tabs/ResumeTab.jsx";
import CoverLetterTab from "./components/tabs/CoverLetterTab.jsx";
import InterviewTab from "./components/tabs/InterviewTab.jsx";
import SkillsGapTab from "./components/tabs/SkillsGapTab.jsx";

import { useSession } from "./hooks/useSession.js";
import { useAnalysis } from "./hooks/useAnalysis.js";

const TABS = [
  { id: "analysis", label: "📊 Analysis" },
  { id: "resume", label: "✍️ Resume" },
  { id: "cover", label: "📝 Cover Letter" },
  { id: "interview", label: "🎯 Interview" },
  { id: "skills", label: "📈 Skills Gap" },
];

export default function App() {
  const [jobDescription, setJobDescription] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [activeTab, setActiveTab] = useState("analysis");

  // Custom hooks
  const {
    session, loading: uploadLoading, error: uploadError,
    uploadResume, clearSession,
  } = useSession();

  const {
    analysis, strategy, rewrittenResume, coverLetter, interviewPrep, skillsGap,
    quality, pipelineSteps,
    loading, error: analysisError,
    analyzeMatch, runFullPipeline, rewriteResume, generateCoverLetter,
    generateInterviewPrep, analyzeSkillsGap, reset: resetAnalysis,
  } = useAnalysis(session?.sessionId);

  const error = uploadError || analysisError;

  // Reset everything
  const handleReset = async () => {
    await clearSession();
    resetAnalysis();
    setJobDescription("");
    setCandidateName("");
    setActiveTab("analysis");
  };

  // Single analysis only
  const handleAnalyze = async () => {
    const result = await analyzeMatch(jobDescription);
    if (result) setActiveTab("analysis");
  };

  // ── Multi-agent: run all 4 agents at once ──
  const handleRunPipeline = async () => {
    if (!jobDescription.trim()) return;
    setActiveTab("analysis");
    await runFullPipeline(jobDescription, candidateName);
  };

  // Individual handlers
  const handleRewrite = async () => {
    setActiveTab("resume");
    await rewriteResume();
  };

  const handleCoverLetter = async () => {
    setActiveTab("cover");
    await generateCoverLetter(candidateName);
  };

  const handleInterviewPrep = async () => {
    setActiveTab("interview");
    await generateInterviewPrep();
  };

  const handleSkillsGap = async () => {
    setActiveTab("skills");
    await analyzeSkillsGap();
  };

  // Only show tabs that have content or are loading
  const visibleTabs = TABS.filter(t => {
    if (t.id === "analysis") return true;
    if (t.id === "resume") return rewrittenResume || loading.rewrite || loading.pipeline;
    if (t.id === "cover") return coverLetter || loading.cover || loading.pipeline;
    if (t.id === "interview") return interviewPrep || loading.interview || loading.pipeline;
    if (t.id === "skills") return skillsGap || loading.skills || loading.pipeline;
    return false;
  });

  return (
    <div className="app">
      <Header />

      <main className="main">
        <StepsIndicator session={session} analysis={analysis} />

        {error && <div className="error-box">⚠️ {error}</div>}

        {/* Input row */}
        <div className="grid-2" style={{ marginBottom: 24 }}>
          <ResumeUpload
            session={session}
            loading={uploadLoading}
            onUpload={uploadResume}
            onReset={handleReset}
            candidateName={candidateName}
            onNameChange={setCandidateName}
          />
          <JobDescriptionInput
            value={jobDescription}
            onChange={setJobDescription}
            onAnalyze={handleAnalyze}
            disabled={!session}
            loading={loading.analyze}
          />
        </div>

        {/* Results — show ActionBar as soon as we have a session + JD, or after analysis */}
        {(analysis || loading.pipeline) && (
          <>
            <ActionBar
              onRunPipeline={handleRunPipeline}
              onRewrite={handleRewrite}
              onCoverLetter={handleCoverLetter}
              onInterviewPrep={handleInterviewPrep}
              onSkillsGap={handleSkillsGap}
              loading={loading}
              bundleData={{ analysis, rewrittenResume, coverLetter, interviewPrep, candidateName }}
            />

            {/* Tabs */}
            <div className="tabs">
              {visibleTabs.map(t => (
                <button
                  key={t.id}
                  className={`tab ${activeTab === t.id ? "active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "analysis" && (
              <AnalysisTab
                analysis={analysis}
                strategy={strategy}
                quality={quality}
                pipelineSteps={pipelineSteps}
              />
            )}
            {activeTab === "resume" && (
              <ResumeTab
                rewrittenResume={rewrittenResume}
                loading={loading.rewrite || loading.pipeline}
                candidateName={candidateName}
              />
            )}
            {activeTab === "cover" && (
              <CoverLetterTab
                coverLetter={coverLetter}
                loading={loading.cover || loading.pipeline}
                candidateName={candidateName}
              />
            )}
            {activeTab === "interview" && (
              <InterviewTab
                interviewPrep={interviewPrep}
                loading={loading.interview || loading.pipeline}
                candidateName={candidateName}
              />
            )}
            {activeTab === "skills" && (
              <SkillsGapTab
                skillsGap={skillsGap}
                loading={loading.skills || loading.pipeline}
              />
            )}
          </>
        )}

        {/* Empty states */}
        {!analysis && !loading.pipeline && session && (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h3>Ready to analyze</h3>
            <p>Paste a job description, then click <strong>Analyze Match</strong> for a quick analysis or <strong>🤖 Run All Agents</strong> to generate everything at once.</p>
          </div>
        )}

        {!session && (
          <div className="empty-state">
            <div className="empty-icon">💼</div>
            <h3>Upload your resume to get started</h3>
            <p>The AI will analyze your resume against any job description and help you tailor it perfectly</p>
          </div>
        )}
      </main>
    </div>
  );
}
