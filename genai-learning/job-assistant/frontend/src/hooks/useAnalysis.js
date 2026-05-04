// src/hooks/useAnalysis.js — All AI analysis operations
import { useState, useCallback } from "react";
import { api } from "../services/api.js";
import { readSSEStream } from "../utils/helpers.js";

export function useAnalysis(sessionId) {
  const [analysis, setAnalysis] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [rewrittenResume, setRewrittenResume] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [interviewPrep, setInterviewPrep] = useState(null);
  const [skillsGap, setSkillsGap] = useState(null);
  const [quality, setQuality] = useState(null);
  const [pipelineSteps, setPipelineSteps] = useState([]);
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  const setLoad = (key, val) => setLoading((p) => ({ ...p, [key]: val }));

  const analyzeMatch = useCallback(async (jobDescription) => {
    setLoad("analyze", true);
    setError(null);
    try {
      const data = await api.analyzeMatch(sessionId, jobDescription);
      setAnalysis(data.analysis);
      return data.analysis;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoad("analyze", false);
    }
  }, [sessionId]);

  // Full multi-agent pipeline — streams progress, then sets all results at once
  const runFullPipeline = useCallback(async (jobDescription, candidateName) => {
    setLoad("pipeline", true);
    setError(null);
    setPipelineSteps([]);
    try {
      const res = await api.runFullPipeline(sessionId, jobDescription, candidateName);
      if (!res.ok) throw new Error("Pipeline failed to start");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "progress") {
              setPipelineSteps((prev) => [...prev, event]);
            } else if (event.type === "result") {
              const d = event.data;
              setAnalysis(d.analysis);
              setStrategy(d.strategy);
              setRewrittenResume(d.rewrittenResume || "");
              setCoverLetter(d.coverLetter || "");
              setInterviewPrep(d.interviewPrep || null);
              setSkillsGap(d.skillsGap || null);
              setQuality(d.quality || null);
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoad("pipeline", false);
    }
  }, [sessionId]);

  const rewriteResume = useCallback(async () => {
    setLoad("rewrite", true);
    setRewrittenResume("");
    setError(null);
    try {
      const res = await api.rewriteResume(sessionId);
      if (!res.ok) throw new Error("Rewrite failed");
      const full = await readSSEStream(res, (text) => setRewrittenResume(text));
      setRewrittenResume(full);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoad("rewrite", false);
    }
  }, [sessionId]);

  const generateCoverLetter = useCallback(async (candidateName) => {
    setLoad("cover", true);
    setError(null);
    try {
      const data = await api.generateCoverLetter(sessionId, candidateName);
      setCoverLetter(data.coverLetter);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoad("cover", false);
    }
  }, [sessionId]);

  const generateInterviewPrep = useCallback(async () => {
    setLoad("interview", true);
    setError(null);
    try {
      const data = await api.generateInterviewPrep(sessionId);
      setInterviewPrep(data.prep);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoad("interview", false);
    }
  }, [sessionId]);

  const analyzeSkillsGap = useCallback(async () => {
    setLoad("skills", true);
    setError(null);
    try {
      const data = await api.analyzeSkillsGap(sessionId);
      setSkillsGap(data.skillsGap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoad("skills", false);
    }
  }, [sessionId]);

  const reset = () => {
    setAnalysis(null);
    setStrategy(null);
    setRewrittenResume("");
    setCoverLetter("");
    setInterviewPrep(null);
    setSkillsGap(null);
    setQuality(null);
    setPipelineSteps([]);
    setError(null);
  };

  return {
    analysis, strategy, rewrittenResume, coverLetter, interviewPrep, skillsGap,
    quality, pipelineSteps,
    loading, error,
    analyzeMatch, runFullPipeline, rewriteResume, generateCoverLetter,
    generateInterviewPrep, analyzeSkillsGap, reset,
  };
}
