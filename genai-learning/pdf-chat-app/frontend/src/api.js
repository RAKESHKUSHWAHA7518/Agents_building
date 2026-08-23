// src/api.js — API client helpers: base URL, auth/guest identity, error normalization.
const API_URL = "/api";

// ── Guest identity (stable UUID kept in localStorage) ──
export function getGuestId() {
  let id = localStorage.getItem("guestId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("guestId", id);
  }
  return id;
}

// ── Auth token persistence ──
export function getStoredAuth() {
  const token = localStorage.getItem("token");
  const email = localStorage.getItem("userEmail");
  return token && email ? { token, email } : null;
}

export function storeAuth(data) {
  localStorage.setItem("token", data.token);
  localStorage.setItem("userEmail", data.user.email);
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("userEmail");
}

/** Headers identifying the caller: JWT when signed in, guest ID otherwise. */
export function authHeaders(auth) {
  return auth
    ? { Authorization: `Bearer ${auth.token}` }
    : { "x-guest-id": getGuestId() };
}

/** Normalize the backend error format: { error: { code, message } }. */
export function errorMessage(data, fallback = "Request failed") {
  if (typeof data?.error === "string") return data.error; // legacy format
  return data?.error?.message || fallback;
}

export function errorCode(data) {
  return typeof data?.error === "string" ? null : data?.error?.code ?? null;
}

// ── Auth endpoints ──
async function callAuth(path, body) {
  const res = await fetch(`${API_URL}/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorMessage(data));
  return data;
}

export const signup = (email, password) => callAuth("/signup", { email, password });
export const login = (email, password) => callAuth("/login", { email, password });

// ── Document library (signed-in users) ──
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function callApi(path, auth, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(auth) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res.status, errorMessage(data));
  return data;
}

export const listDocuments = (auth) =>
  callApi("/documents", auth).then((d) => d.documents);

export const openDocument = (auth, sessionId) =>
  callApi(`/documents/${sessionId}/open`, auth, { method: "POST" });

export const deleteDocument = (auth, sessionId) =>
  callApi(`/documents/${sessionId}`, auth, { method: "DELETE" });
