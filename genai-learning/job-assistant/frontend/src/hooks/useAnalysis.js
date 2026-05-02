// src/hooks/useAnalysis.js — All AI analysis operations
import { useState, useCallback } from "react";
import { api } from "../services/api.js";
import { readSSEStream } from "../utils/helpers.js";

export function useAnalysis(sessionId) {
  const [analysis, setAnalysis] = useState(null);
  const [rewrittenResume, setRewrittenResume] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [interviewPrep, setInterviewPrep] = useState(null);
  const [skillsGap, setSkillsGap] = useState(null);
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
    setRewrittenResume("");
    setCoverLetter("");
    setInterviewPrep(null);
    setSkillsGap(null);
    setError(null);
  };

  return {
    analysis, rewrittenResume, coverLetter, interviewPrep, skillsGap,
    loading, error,
    analyzeMatch, rewriteResume, generateCoverLetter,
    generateInterviewPrep, analyzeSkillsGap, reset,
  };
}
