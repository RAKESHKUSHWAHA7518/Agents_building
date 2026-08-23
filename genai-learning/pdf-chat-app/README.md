# PDF Chat App — AI-Powered Document Q&A

A full-stack GenAI app that lets you upload any PDF and chat with it using Google Gemini + RAG.

## Tech Stack
- **Frontend**: React + Vite, react-markdown, ESLint
- **Backend**: Node.js + Express (layered: routes → middleware → services)
- **AI**: Google Gemini (chat + embeddings)
- **Database**: MongoDB — users, guest quotas, AND vector search, all in one DB
- **RAG**: LangChain.js + **MongoDB Atlas Vector Search** (`$vectorSearch`, session-scoped)
- **Auth**: JWT + scrypt password hashing
- **Security**: helmet, rate limiting, zod validation, CORS allowlist

## Features
- 📄 Upload a PDF → chunked, embedded, and indexed for semantic search
- 💬 Streaming chat (SSE) with conversation history
- 🎁 **Freemium model**: guests get 1 free upload, then a signup wall; registered users get unlimited uploads
- 📚 **Document library**: signed-in users' PDFs persist in MongoDB — accidental browser close, refresh, or server restart never loses them. Upload new PDFs anytime and switch between all previous ones; delete what you don't need
- 🔐 Real accounts — signup / login with JWT sessions (7-day tokens)
- 🧹 Sessions auto-expire (TTL) — no memory leaks
- 🛡️ Centralized error format: `{ "error": { "code", "message", "details?" } }`
- 📊 Structured JSON logs (pino) with request logging
- 🐳 Docker + docker-compose for one-command production run

## Project Structure
```
pdf-chat-app/
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── config/env.js         # validated env config (zod)
│   │   ├── lib/                  # logger, vector store
│   │   ├── middleware/           # auth, validation, rate limits, error handling
│   │   ├── routes/               # health, auth, session (upload/chat)
│   │   ├── services/             # authService, guestService, ragService, sessionService
│   │   ├── db/database.js        # MongoDB connection, indexes, vector-search index
│   │   ├── app.js                # Express app assembly (testable)
│   │   └── server.js             # bootstrap + graceful shutdown
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api.js                # API client (auth headers, error normalization)
    │   ├── components/AuthModal.jsx
    │   └── App.jsx
    └── nginx.conf                # production proxy (SSE-ready)
```

## Quick Start (local dev)

### 0. MongoDB (pick one)
**Option A — Atlas cloud (recommended, free, no Docker needed):**
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → create a free **M0** cluster
2. Create a database user + allow your IP (or `0.0.0.0/0` for dev only)
3. Copy the connection string (`mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/`)

**Option B — local container (needs Docker running):**
`docker compose up mongodb` — uses `mongodb/mongodb-atlas-local` (Vector Search included)

### 1. Backend
```bash
cd backend
cp .env.example .env   # then fill in:
                       #   GEMINI_API_KEY  → https://aistudio.google.com/apikey
                       #   JWT_SECRET      → node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
                       #   MONGODB_URI     → your Atlas string (Option A) or the default localhost (Option B)
npm install
npm run dev            # http://localhost:3001
```

On startup the backend auto-detects the embedding dimensions and **creates the
Atlas Vector Search index** (`vector_index`) if it doesn't exist. First-time index
builds on Atlas take a few minutes before chat retrieval works.

### 2. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxies /api → :3001)
```

## Freemium Flow (free trial → signup wall)
1. Visitor uploads a PDF **without an account** → tracked by `x-guest-id` (UUID in localStorage)
2. Guest quota is checked **before** expensive PDF/embedding work (`GUEST_FREE_UPLOADS`, default: 1)
3. On the next upload the backend returns `403 { code: "AUTH_REQUIRED" }` → frontend opens the signup modal
4. After signup/login (JWT), the pending upload **auto-retries** — seamless upgrade
5. `GET /api/auth/me` returns `{ type: "guest", quota }` or `{ type: "user", user }`

## API Reference
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Liveness + uptime + active sessions |
| POST | `/api/auth/signup` | — | Create account → `{ token, user }` |
| POST | `/api/auth/login` | — | Login → `{ token, user }` |
| GET | `/api/auth/me` | optional | Profile, or guest trial quota |
| POST | `/api/upload` | optional (quota for guests) | multipart `pdf` → indexes the document |
| POST | `/api/chat` | optional | `{ sessionId, question }` → SSE stream |
| DELETE | `/api/session/:id` | optional | Clear a session |
| GET | `/api/documents` | required | List your saved PDFs |
| POST | `/api/documents/:sessionId/open` | required | Restore a saved PDF (no re-upload) |
| DELETE | `/api/documents/:sessionId` | required | Delete a saved PDF + its vectors |

Guests identify with the `x-guest-id` header; users with `Authorization: Bearer <token>`.

## Configuration (`backend/.env`)
| Variable | Default | Notes |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required** |
| `JWT_SECRET` | — | **Required**, ≥32 chars |
| `MONGODB_URI` | `mongodb://localhost:27017/?directConnection=true` | Atlas `mongodb+srv://…` or local |
| `MONGODB_DB` | `pdf_chat` | Database name |
| `VECTOR_SEARCH_INDEX` | `vector_index` | Atlas Vector Search index name |
| `PORT` | `3001` | |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin |
| `GUEST_FREE_UPLOADS` | `1` | Free uploads before signup wall |
| `SESSION_TTL_MINUTES` | `30` | Idle session expiry |
| `MAX_FILE_SIZE_MB` | `10` | Upload limit |
| `RATE_LIMIT_MAX` | `60` | Requests/min per IP |
| `UPLOAD_RATE_LIMIT_MAX` | `10` | Uploads per 15 min per IP |
| `LOG_LEVEL` | `info` | pino level |

## Docker (production-style)
```bash
# Requires backend/.env
docker compose up --build
# → http://localhost:8080
```

## Roadmap (next steps to full production)
- **Tests**: vitest + supertest for routes, React Testing Library for UI
- **Refresh tokens** + token rotation; password reset via email
- **CSRF/cookie-based auth** (httpOnly cookies) instead of localStorage JWTs
- **CI/CD**: GitHub Actions — lint, typecheck, test, build, Docker publish
- **Observability**: request tracing (OpenTelemetry), LLM cost/latency metrics

## How RAG Works
1. Upload a PDF → backend splits it into chunks (1000 chars, 200 overlap)
2. Each chunk is embedded using Gemini embeddings
3. Chunks + vectors stored in MongoDB (`documents` collection, tagged with sessionId)
4. You ask a question → question is embedded → MongoDB `$vectorSearch` retrieves
   the top-4 similar chunks **for that session only** (pre-filtered)
5. Gemini generates an answer grounded in the retrieved chunks
6. Answer streams back token-by-token over SSE
7. Guest sessions: vectors auto-deleted on expiry. Signed-in users: vectors persist,
   so any past document can be re-opened instantly without re-uploading.
   *(If the Atlas index is still building, search automatically falls back to
   exact cosine similarity — chat keeps working.)*
