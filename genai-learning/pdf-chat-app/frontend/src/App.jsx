import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import AuthModal from "./components/AuthModal.jsx";
import {
  authHeaders,
  clearAuth,
  deleteDocument,
  errorCode,
  errorMessage,
  getStoredAuth,
  listDocuments,
  openDocument,
  storeAuth,
} from "./api.js";
import "./App.css";

// Use relative URL so Vite proxy handles it (avoids CORS issues)
const API_URL = "/api";

// ── Suggested questions shown after PDF loads ──
const SUGGESTIONS = [
  "Summarize this document",
  "What are the main topics?",
  "What are the key points?",
  "Give me a brief overview",
];

// ── Format timestamp ──
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const [session, setSession] = useState(null);       // { sessionId, fileName, pageCount, chunkCount }
  const [messages, setMessages] = useState([]);        // chat messages
  const [input, setInput] = useState("");              // textarea value
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [auth, setAuth] = useState(getStoredAuth);     // { token, email } | null
  const [guestQuota, setGuestQuota] = useState(null);  // { used, limit, remaining } for guests
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [documents, setDocuments] = useState([]);      // saved PDFs (signed-in users)

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);
  const pendingFileRef = useRef(null);                 // file that hit the signup wall
  const sessionRef = useRef(null);                     // tracks session for async callbacks
  const docsLoadedRef = useRef(null);                  // prevents double-loading in StrictMode

  // Mirror session into a ref (env var so async callbacks always see the latest)
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Cancel any in-flight stream when the component unmounts
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // ── Auth logout (defined early — library helpers reference it) ──
  const handleLogout = useCallback(() => {
    clearAuth();
    setAuth(null);
    setGuestQuota(null);
    setDocuments([]);
    docsLoadedRef.current = null;
  }, []);

  // ── Document library (signed-in users): restore after close / refresh ──
  const openDocumentById = useCallback(async (sessionId) => {
    if (!auth || sessionRef.current?.sessionId === sessionId) return;
    try {
      const data = await openDocument(auth, sessionId);
      setSession(data);
      setMessages([
        {
          id: Date.now(),
          role: "assistant",
          content: `Welcome back! I still have **${data.fileName}** (${data.pageCount} pages) ready. Ask me anything about it!`,
          time: new Date(),
        },
      ]);
      setInput("");
    } catch (err) {
      if (err.status === 401) { handleLogout(); return; }
      setError(err.message);
      // Drop broken docs from the list (e.g. expired)
      if (err.status === 404 || err.status === 410) {
        setDocuments((prev) => prev.filter((d) => d.sessionId !== sessionId));
      }
    }
  }, [auth, handleLogout]);

  const openDocumentByIdRef = useRef(openDocumentById);
  useEffect(() => {
    openDocumentByIdRef.current = openDocumentById;
  }, [openDocumentById]);

  const loadDocuments = useCallback(async (currentAuth, { autoOpen } = { autoOpen: true }) => {
    try {
      const docs = await listDocuments(currentAuth);
      setDocuments(docs);
      // Auto-restore the most recent PDF if nothing is active (accidental close)
      if (
        autoOpen &&
        !sessionRef.current &&
        !pendingFileRef.current &&
        docs.length > 0
      ) {
        openDocumentByIdRef.current(docs[0].sessionId);
      }
    } catch (err) {
      if (err.status === 401) handleLogout();
      else setError(err.message);
    }
  }, [handleLogout]);

  // Load the document library on login / page reload
  useEffect(() => {
    if (!auth) return; // logout cleanup happens inside handleLogout
    if (docsLoadedRef.current === auth.token) return;
    docsLoadedRef.current = auth.token;
    loadDocuments(auth);
  }, [auth, loadDocuments]);

  const handleDeleteDocument = async (sessionId) => {
    try {
      await deleteDocument(auth, sessionId);
      setDocuments((prev) => prev.filter((d) => d.sessionId !== sessionId));
      if (sessionRef.current?.sessionId === sessionId) {
        setSession(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Handle PDF upload ──
  const handleUpload = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") {
      setError("Please upload a valid PDF file.");
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: authHeaders(auth),
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        // Free trial exhausted → show the signup wall, then auto-retry after auth
        if (errorCode(data) === "AUTH_REQUIRED") {
          pendingFileRef.current = file;
          setShowAuthModal(true);
        }
        throw new Error(errorMessage(data, "Upload failed"));
      }

      if (data.guestQuota) setGuestQuota(data.guestQuota);
      setSession(data);
      // Signed-in: the new PDF joins the persistent library
      if (auth) loadDocuments(auth, { autoOpen: false });
      setMessages([
        {
          id: Date.now(),
          role: "assistant",
          content: `I've read **${data.fileName}** (${data.pageCount} pages, ${data.chunkCount} sections indexed).\n\nAsk me anything about this document!`,
          time: new Date(),
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }, [auth, loadDocuments]);

  // ── File input change ──
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  // ── Drag and drop ──
  const onDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = () => setIsDragOver(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  // ── Send message ──
  const sendMessage = useCallback(async (text) => {
    const question = text.trim();
    if (!question || !session || isStreaming) return;

    const userMsg = { id: Date.now(), role: "user", content: question, time: new Date() };
    const assistantMsgId = Date.now() + 1;

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantMsgId, role: "assistant", content: "", time: new Date(), streaming: true },
    ]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(auth) },
        body: JSON.stringify({ sessionId: session.sessionId, question }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        // Session expired (backend restarted) — ask user to re-upload
        if (res.status === 404) {
          setSession(null);
          setMessages([]);
          throw new Error("Session expired. Please upload your PDF again.");
        }
        throw new Error(errorMessage(errData, "Chat request failed"));
      }

      // Read SSE stream
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
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.done) break;
            if (data.chunk) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + data.chunk }
                    : m
                )
              );
            }
          } catch (e) {
            if (e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return; // user cancelled — leave messages as-is
      setError(err.message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    } finally {
      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m
        )
      );
      setIsStreaming(false);
    }
  }, [session, isStreaming, auth]);

  // ── Handle Enter key ──
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Auto-resize textarea ──
  const onInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  };

  // ── Reset session ──
  const resetSession = async () => {
    abortControllerRef.current?.abort();
    if (session) {
      await fetch(`${API_URL}/session/${session.sessionId}`, {
        method: "DELETE",
        headers: authHeaders(auth),
      }).catch(() => {});
    }
    setSession(null);
    setMessages([]);
    setInput("");
  };

  // ── Auth handlers ──
  const handleAuthSuccess = (data) => {
    storeAuth(data);
    setAuth({ token: data.token, email: data.user.email });
    setShowAuthModal(false);
    setGuestQuota(null);
    // Retry the upload that triggered the signup wall
    if (pendingFileRef.current) {
      const file = pendingFileRef.current;
      pendingFileRef.current = null;
      handleUpload(file);
    }
  };

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">📄</div>
          <div>
            <h1>PDF Chat</h1>
            <span>Powered by Gemini AI</span>
          </div>
        </div>

        {/* Account / free-trial status */}
        <div className="auth-section">
          {auth ? (
            <div className="auth-user">
              <div className="auth-user-info">
                <div className="auth-avatar">{auth.email[0].toUpperCase()}</div>
                <div>
                  <p className="auth-email">{auth.email}</p>
                  <span className="auth-plan">✨ Unlimited uploads</span>
                </div>
              </div>
              <button className="auth-logout-btn" onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : (
            <div className="auth-guest">
              <div className="auth-trial-badge">
                🎁 Free trial
                {guestQuota && ` · ${guestQuota.remaining}/${guestQuota.limit} upload${guestQuota.limit > 1 ? "s" : ""} left`}
              </div>
              <button className="auth-signup-btn" onClick={() => setShowAuthModal(true)}>
                Sign up for unlimited
              </button>
            </div>
          )}
        </div>

        {/* Upload section */}
        <div className="upload-section">
          <h2>Document</h2>

          {isUploading ? (
            <div className="upload-progress">
              <div className="progress-header">
                <div className="spinner" />
                <p>Processing PDF...</p>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" />
              </div>
            </div>
          ) : session ? (
            <div className="pdf-info">
              <div className="pdf-info-header">
                <div className="pdf-icon">📕</div>
                <div>
                  <h3>{session.fileName}</h3>
                  <p>Ready to chat</p>
                </div>
              </div>
              <div className="pdf-stats">
                <div className="stat">
                  <div className="stat-value">{session.pageCount}</div>
                  <div className="stat-label">Pages</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{session.chunkCount}</div>
                  <div className="stat-label">Chunks</div>
                </div>
              </div>
              <button className="change-pdf-btn" onClick={resetSession}>
                ↩ Upload different PDF
              </button>
            </div>
          ) : (
            <div
              className={`upload-area ${isDragOver ? "drag-over" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <div className="upload-icon">📂</div>
              <p>Drop PDF here or click to browse</p>
              <span>Max 10MB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={onFileChange}
              />
            </div>
          )}
        </div>

        {/* Saved documents (signed-in users) — survive browser close */}
        {auth && documents.length > 0 && (
          <div className="documents-section">
            <h2>My Documents</h2>
            <div className="documents-list">
              {documents.map((doc) => (
                <div
                  key={doc.sessionId}
                  className={`document-item ${session?.sessionId === doc.sessionId ? "active" : ""}`}
                >
                  <button
                    className="document-open"
                    onClick={() => openDocumentById(doc.sessionId)}
                    title={doc.fileName}
                  >
                    <span className="document-icon">📕</span>
                    <span className="document-info">
                      <span className="document-name">{doc.fileName}</span>
                      <span className="document-meta">
                        {doc.pageCount} pages · {doc.chunkCount} chunks
                      </span>
                    </span>
                  </button>
                  <button
                    className="document-delete"
                    onClick={() => handleDeleteDocument(doc.sessionId)}
                    title="Delete document"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          <p>
            Built with <span>LangChain.js</span> + <span>Gemini</span><br />
            RAG • Embeddings • Vector Search
          </p>
        </div>
      </aside>

      {/* ── Main Chat ── */}
      <main className="chat-area">
        {/* Header */}
        <div className="chat-header">
          <div>
            <h2>{session ? session.fileName : "PDF Chat Assistant"}</h2>
            <p>{session ? "Ask anything about your document" : "Upload a PDF to get started"}</p>
          </div>
          <div className={`status-badge ${session ? "ready" : "waiting"}`}>
            <div className={`status-dot ${isStreaming ? "pulse" : ""}`} />
            {isStreaming ? "Thinking..." : session ? "Ready" : "No document"}
          </div>
        </div>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon">🤖</div>
              <h2>Chat with your PDF</h2>
              <p>Upload any PDF and ask questions about it. The AI reads and understands your document using RAG technology.</p>
              <div className="welcome-steps">
                <div className="step">
                  <div className="step-num">1</div>
                  <p>Upload a PDF file</p>
                </div>
                <div className="step">
                  <div className="step-num">2</div>
                  <p>AI indexes the content</p>
                </div>
                <div className="step">
                  <div className="step-num">3</div>
                  <p>Ask any question</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === "user" ? "👤" : "🤖"}
                  </div>
                  <div className="message-content">
                    {msg.streaming && msg.content === "" ? (
                      <div className="typing-indicator">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                      </div>
                    ) : (
                      <div className="message-bubble">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                    <div className="message-time">{formatTime(msg.time)}</div>
                  </div>
                </div>
              ))}

              {/* Suggested questions after first assistant message */}
              {messages.length === 1 && !isStreaming && (
                <div className="suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className="suggestion-chip"
                      onClick={() => sendMessage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              placeholder={session ? "Ask a question about your PDF..." : "Upload a PDF first..."}
              disabled={!session || isStreaming}
              rows={1}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage(input)}
              disabled={!session || isStreaming || !input.trim()}
            >
              ➤
            </button>
          </div>
          <p className="input-hint">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </main>

      {/* Error toast */}
      {error && <div className="error-toast">⚠️ {error}</div>}

      {/* Signup wall */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}
