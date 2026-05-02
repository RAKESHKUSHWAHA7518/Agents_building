// src/hooks/useSession.js — Session state management hook
import { useState, useCallback } from "react";
import { api } from "../services/api.js";

export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const uploadResume = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") {
      setError("Please upload a valid PDF file.");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.uploadResume(file);
      setSession(data);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSession = useCallback(async () => {
    if (session?.sessionId) {
      await api.deleteSession(session.sessionId).catch(() => {});
    }
    setSession(null);
    setError(null);
  }, [session]);

  return { session, loading, error, uploadResume, clearSession };
}
