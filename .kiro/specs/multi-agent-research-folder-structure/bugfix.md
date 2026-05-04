# Bugfix Requirements Document

## Introduction

The `multi-agent-research` project was built without following the folder structure convention established by the `job-assistant` project. The frontend's entire application logic (~300 lines) is crammed into a single `App.jsx` file instead of being split into components, hooks, services, and utils directories. The backend is missing a `src/middleware/` directory (no error handler or request middleware). This structural deviation makes the codebase harder to maintain, extend, and reason about compared to the established convention.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the frontend source is inspected THEN the system has all state management, SSE streaming logic, event handling, markdown rendering, and UI rendering collapsed into a single `App.jsx` file (~300 lines) with no `components/`, `hooks/`, `services/`, or `utils/` subdirectories

1.2 WHEN the frontend renders the agent activity feed THEN the system renders it inline inside `App.jsx` with no dedicated `ActivityFeed` component

1.3 WHEN the frontend renders the research report panel THEN the system renders it inline inside `App.jsx` with no dedicated `ReportPanel` component

1.4 WHEN the frontend renders the phase progress bar THEN the system renders it inline inside `App.jsx` with no dedicated `PhaseBar` component

1.5 WHEN the frontend renders the search input and suggestions THEN the system renders it inline inside `App.jsx` with no dedicated `SearchBox` component

1.6 WHEN the frontend renders the header with agent pills THEN the system renders it inline inside `App.jsx` with no dedicated `Header` component

1.7 WHEN the frontend makes an API call to `/api/research` THEN the system calls `fetch` directly inside `App.jsx` with no dedicated `services/api.js` abstraction

1.8 WHEN the frontend manages research state and SSE streaming THEN the system handles it directly in `App.jsx` with no dedicated custom hook (e.g., `useResearch.js`)

1.9 WHEN the frontend renders markdown THEN the system uses a `renderMarkdown` function defined inline in `App.jsx` with no dedicated `utils/markdownRenderer.js` file

1.10 WHEN the backend handles an unhandled error or exception THEN the system has no `src/middleware/errorHandler.js` and errors are only caught locally inside the route handler

1.11 WHEN the backend receives a request THEN the system has no `src/middleware/` directory, meaning no reusable request middleware layer exists

### Expected Behavior (Correct)

2.1 WHEN the frontend source is inspected THEN the system SHALL have `components/`, `hooks/`, `services/`, and `utils/` subdirectories under `frontend/src/`, with `App.jsx` acting as a thin orchestration root (matching the `job-assistant` pattern)

2.2 WHEN the frontend renders the agent activity feed THEN the system SHALL use a dedicated `components/ActivityFeed.jsx` component

2.3 WHEN the frontend renders the research report panel THEN the system SHALL use a dedicated `components/ReportPanel.jsx` component

2.4 WHEN the frontend renders the phase progress bar THEN the system SHALL use a dedicated `components/PhaseBar.jsx` component

2.5 WHEN the frontend renders the search input and suggestions THEN the system SHALL use a dedicated `components/SearchBox.jsx` component

2.6 WHEN the frontend renders the header with agent pills THEN the system SHALL use a dedicated `components/Header.jsx` component

2.7 WHEN the frontend makes an API call to `/api/research` THEN the system SHALL call it through a dedicated `services/api.js` module that abstracts all fetch calls

2.8 WHEN the frontend manages research state and SSE streaming THEN the system SHALL delegate that logic to a dedicated `hooks/useResearch.js` custom hook

2.9 WHEN the frontend renders markdown THEN the system SHALL use a `renderMarkdown` function extracted to `utils/markdownRenderer.js`

2.10 WHEN the backend handles an unhandled error or exception THEN the system SHALL use a `src/middleware/errorHandler.js` middleware (with `errorHandler` and `notFound` exports matching the `job-assistant` pattern) registered in `server.js`

2.11 WHEN the backend receives a request THEN the system SHALL have a `src/middleware/` directory available for reusable middleware

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user submits a research topic THEN the system SHALL CONTINUE TO send a POST request to `/api/research` and receive an SSE stream in response

3.2 WHEN the SSE stream emits `phase`, `agent_start`, `agent_done`, `tool_call`, `tool_result`, `report`, and `complete` events THEN the system SHALL CONTINUE TO update the UI correctly for each event type

3.3 WHEN the research completes THEN the system SHALL CONTINUE TO display the full markdown report, stats (agents, subtopics, duration, word count), and plan subtopics

3.4 WHEN the user clicks "Copy" or "Download" on the report THEN the system SHALL CONTINUE TO copy the report to clipboard or download it as a `.md` file

3.5 WHEN the user clicks a suggestion chip THEN the system SHALL CONTINUE TO start research for that suggestion topic

3.6 WHEN the user clicks "+ New" THEN the system SHALL CONTINUE TO reset all state and return to the empty/idle state

3.7 WHEN the backend orchestrator runs the 5-agent pipeline THEN the system SHALL CONTINUE TO execute Planner → parallel Search → Analyst → Writer → Critic in the correct sequence

3.8 WHEN the backend route receives an empty or missing topic THEN the system SHALL CONTINUE TO return a 400 error with `{ error: "topic is required" }`

3.9 WHEN the backend config is loaded THEN the system SHALL CONTINUE TO read `port` and `corsOrigin` from `src/config/index.js`

3.10 WHEN the frontend is built and served THEN the system SHALL CONTINUE TO render correctly with the existing `App.css` styles unchanged
