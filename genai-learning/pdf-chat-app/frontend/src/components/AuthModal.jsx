// src/components/AuthModal.jsx — Sign up / log in modal shown when the
// free trial is exhausted (or from the sidebar).
import { useState } from "react";
import { signup, login } from "../api.js";

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("signup"); // "signup" | "login"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const fn = mode === "signup" ? signup : login;
      onSuccess(await fn(email, password));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2 className="auth-title">
          {mode === "signup" ? "Create your free account" : "Welcome back"}
        </h2>
        <p className="auth-subtitle">
          {mode === "signup"
            ? "Your free trial has ended. Sign up to keep chatting with unlimited PDFs."
            : "Log in to keep chatting with your documents."}
        </p>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Sign up
          </button>
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => switchMode("login")}
          >
            Log in
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {error && <div className="auth-error">⚠️ {error}</div>}

          <button className="auth-submit-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : mode === "signup"
                ? "Create free account"
                : "Log in"}
          </button>
        </form>

        <p className="auth-note">🔒 Your files stay private — accounts just unlock unlimited use.</p>
      </div>
    </div>
  );
}
