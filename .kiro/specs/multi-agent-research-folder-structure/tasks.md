# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Monolithic App.jsx Structural Defect
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the structural defect exists
  - **Scoped PBT Approach**: For each target file that should exist post-fix, assert it does NOT exist on unfixed code (confirming the bug condition holds for that unit)
  - Check that `frontend/src/components/` directory does NOT exist (isBugCondition: components are inlined in App.jsx)
  - Check that `frontend/src/hooks/useResearch.js` does NOT exist (isBugCondition: hook logic is inlined in App.jsx)
  - Check that `frontend/src/services/api.js` does NOT exist (isBugCondition: fetch call is inlined in App.jsx)
  - Check that `frontend/src/utils/markdownRenderer.js` does NOT exist (isBugCondition: renderMarkdown is inlined in App.jsx)
  - Check that `frontend/src/utils/constants.js` does NOT exist (isBugCondition: AGENTS/PHASES/SUGGESTIONS are inlined in App.jsx)
  - Grep `App.jsx` to confirm it contains `const AGENTS =`, `function renderMarkdown`, and `fetch("/api/research"` inline
  - Run checks on UNFIXED code
  - **EXPECTED OUTCOME**: All checks PASS (confirms the structural bug exists — target files are absent, definitions are inline)
  - Document counterexamples found (e.g., "components/ dir absent, AGENTS defined inline at line 7")
  - Mark task complete when checks are written, run, and the structural defect is confirmed
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Runtime Behavior Unchanged After Refactor
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `startResearch(topic)` sets `isRunning=true`, clears events/report/plan/stats, sets `currentPhase=1`
  - Observe: SSE `phase` event sets `currentPhase` to `data.phase` and appends a phase event to `events`
  - Observe: SSE `complete` event sets `isRunning=false`, `isDone=true`, `currentPhase=6`
  - Observe: `reset()` returns all state to initial values (topic="", events=[], report="", plan=null, stats=null, isDone=false, currentPhase=0, error=null)
  - Observe: `renderMarkdown("## Hello")` returns `<h2>Hello</h2>` (no raw `##` markers in output)
  - Write property-based test: for all valid SSE event sequences, `handleEvent` produces a monotonically growing `events` array with no dropped events
  - Write property-based test: for all non-empty `report` strings, `renderMarkdown` output contains no raw `**` or `##` markers
  - Write property-based test: for all `topic` strings, `downloadReport` filename is derived from `topic.slice(0, 30).replace(/\s+/g, "-")`
  - Verify tests pass on UNFIXED code (baseline behavior confirmed)
  - **EXPECTED OUTCOME**: Tests PASS on unfixed code (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Refactor: Extract all logical units from App.jsx into canonical files

  - [x] 3.1 Create `utils/constants.js` — extract AGENTS, PHASES, SUGGESTIONS
    - Create `genai-learning/multi-agent-research/frontend/src/utils/constants.js`
    - Extract `AGENTS`, `PHASES`, and `SUGGESTIONS` constants verbatim from `App.jsx`
    - Export each as a named export: `export const AGENTS = ...`, `export const PHASES = ...`, `export const SUGGESTIONS = ...`
    - _Bug_Condition: isBugCondition({definedIn: "App.jsx", targetPath: "utils/constants.js"}) === true_
    - _Expected_Behavior: fileExists("utils/constants.js") AND hasNamedExports(["AGENTS","PHASES","SUGGESTIONS"])_
    - _Preservation: AGENTS/PHASES/SUGGESTIONS values are identical to originals — no values changed_
    - _Requirements: 2.1, 2.9_

  - [x] 3.2 Create `utils/markdownRenderer.js` — extract renderMarkdown
    - Create `genai-learning/multi-agent-research/frontend/src/utils/markdownRenderer.js`
    - Extract the `renderMarkdown` function verbatim from `App.jsx`
    - Export as a named export: `export function renderMarkdown(text) { ... }`
    - _Bug_Condition: isBugCondition({definedIn: "App.jsx", targetPath: "utils/markdownRenderer.js"}) === true_
    - _Expected_Behavior: fileExists("utils/markdownRenderer.js") AND hasNamedExport("renderMarkdown")_
    - _Preservation: renderMarkdown output is byte-for-byte identical to the original inline function_
    - _Requirements: 2.9_

  - [x] 3.3 Create `services/api.js` — extract fetch call to /api/research
    - Create `genai-learning/multi-agent-research/frontend/src/services/api.js`
    - Extract the `fetch("/api/research", ...)` call into an exported `startResearch(topic)` function
    - Function returns the raw `Response` object so the SSE reader in the hook can consume `res.body`
    - Pattern matches `job-assistant/frontend/src/services/api.js` structure
    - _Bug_Condition: isBugCondition({definedIn: "App.jsx", targetPath: "services/api.js"}) === true_
    - _Expected_Behavior: fileExists("services/api.js") AND hasNamedExport("startResearch")_
    - _Preservation: fetch call uses same URL "/api/research", same method "POST", same headers and body shape_
    - _Requirements: 2.7, 3.1_

  - [x] 3.4 Create `hooks/useResearch.js` — extract all state + SSE streaming logic
    - Create `genai-learning/multi-agent-research/frontend/src/hooks/useResearch.js`
    - Extract all `useState`, `useRef`, `useEffect`, `addEvent`, `startResearch`, `handleEvent`, `reset`, `copyReport`, `downloadReport` logic
    - Accept no arguments (all state is internal)
    - Return: `{ topic, setTopic, events, report, plan, stats, isRunning, isDone, currentPhase, error, eventsEndRef, startResearch, reset, copyReport, downloadReport }`
    - Import `AGENTS` from `../utils/constants.js` (needed for `handleEvent` phase mapping)
    - Import `startResearch` (the fetch call) from `../services/api.js`
    - _Bug_Condition: isBugCondition({definedIn: "App.jsx", targetPath: "hooks/useResearch.js"}) === true_
    - _Expected_Behavior: fileExists("hooks/useResearch.js") AND hasDefaultOrNamedExport("useResearch")_
    - _Preservation: All state transitions, SSE event handling, and side effects are identical to the original inline logic_
    - _Requirements: 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.5 Create `components/Header.jsx` — extract header with agent pills
    - Create `genai-learning/multi-agent-research/frontend/src/components/Header.jsx`
    - Extract the `<header className="header">` block from `App.jsx`
    - Props: none (static content)
    - Import `AGENTS` from `../utils/constants.js` for the agent pills
    - _Bug_Condition: isBugCondition({definedIn: "App.jsx", targetPath: "components/Header.jsx"}) === true_
    - _Expected_Behavior: fileExists("components/Header.jsx") AND renders agent pills using AGENTS from constants_
    - _Preservation: Rendered HTML is identical — same logo, title, subtitle, and agent pills with same colors/icons_
    - _Requirements: 2.6, 3.10_

  - [x] 3.6 Create `components/SearchBox.jsx` — extract search input + suggestions
    - Create `genai-learning/multi-agent-research/frontend/src/components/SearchBox.jsx`
    - Extract the `<div className="search-section">` block
    - Props: `{ topic, setTopic, isRunning, isDone, onSearch, suggestions }`
    - `onSearch(topicOverride?)` maps to `startResearch` from the hook
    - Import `SUGGESTIONS` from `../utils/constants.js`
    - _Bug_Condition: isBugCondition({definedIn: "App.jsx", targetPath: "components/SearchBox.jsx"}) === true_
    - _Expected_Behavior: fileExists("components/SearchBox.jsx") AND accepts correct props_
    - _Preservation: Input, button, and suggestion chips behave identically — same disabled states, same Enter key handler_
    - _Requirements: 2.5, 3.5, 3.10_

  - [x] 3.7 Create `components/PhaseBar.jsx` — extract phase progress bar
    - Create `genai-learning/multi-agent-research/frontend/src/components/PhaseBar.jsx`
    - Extract the `<div className="phases-bar">` block
    - Props: `{ currentPhase, isRunning, isDone }`
    - Import `AGENTS` and `PHASES` from `../utils/constants.js`
    - _Bug_Condition: isBugCondition({definedIn: "App.jsx", targetPath: "components/PhaseBar.jsx"}) === true_
    - _Expected_Behavior: fileExists("components/PhaseBar.jsx") AND accepts correct props_
    - _Preservation: Phase status logic (done/active/pending), colors, icons, and pulse animation are identical_
    - _Requirements: 2.4, 3.2, 3.10_

  - [x] 3.8 Create `components/ActivityFeed.jsx` — extract agent activity feed
    - Create `genai-learning/multi-agent-research/frontend/src/components/ActivityFeed.jsx`
    - Extract the left panel `<div className="activity-panel">` block including all event-kind renderers
    - Props: `{ events, isRunning, isDone, eventsEndRef }`
    - Import `AGENTS` from `../utils/constants.js`
    - _Bug_Condition: isBugCondition({definedIn: "App.jsx", targetPath: "components/ActivityFeed.jsx"}) === true_
    - _Expected_Behavior: fileExists("components/ActivityFeed.jsx") AND renders all event kinds correctly_
    - _Preservation: All event renderers (system, phase, agent_start, agent_done, tool, complete) produce identical HTML; auto-scroll ref is preserved_
    - _Requirements: 2.2, 3.2, 3.10_

  - [x] 3.9 Create `components/ReportPanel.jsx` — extract report panel
    - Create `genai-learning/multi-agent-research/frontend/src/components/ReportPanel.jsx`
    - Extract the right panel `<div className="report-panel">` block including stats, subtopics bar, report content, and empty state
    - Props: `{ report, stats, plan, isRunning, isDone, onCopy, onDownload, onReset }`
    - Import `renderMarkdown` from `../utils/markdownRenderer.js`
    - Import `AGENTS` and `PHASES` from `../utils/constants.js` (for the empty-state agent flow)
    - _Bug_Condition: isBugCondition({definedIn: "App.jsx", targetPath: "components/ReportPanel.jsx"}) === true_
    - _Expected_Behavior: fileExists("components/ReportPanel.jsx") AND renders stats, subtopics, report content, and empty state_
    - _Preservation: Stats row, subtopics bar, report HTML (via renderMarkdown), Copy/Download/New buttons, and empty-state agent flow are identical_
    - _Requirements: 2.3, 3.3, 3.4, 3.10_

  - [x] 3.10 Update `App.jsx` — replace all extracted code with imports and thin composition
    - Rewrite `genai-learning/multi-agent-research/frontend/src/App.jsx` to ~30–40 lines
    - Import and call `useResearch()` hook
    - Import and compose: `Header`, `SearchBox`, `PhaseBar`, `ActivityFeed`, `ReportPanel`
    - Retain only the top-level `<div className="app">` structure and conditional rendering logic
    - Remove all inline definitions of constants, functions, state, and JSX blocks that were extracted
    - Keep `import "./App.css"` unchanged
    - _Bug_Condition: isBugCondition(any remaining inline unit) === false (no inline units remain)_
    - _Expected_Behavior: App.jsx contains only imports, useResearch() call, and top-level JSX composition_
    - _Preservation: Conditional rendering logic (isRunning || isDone gates) is identical; error box placement unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.10_

  - [x] 3.11 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - All Logical Units at Canonical Paths
    - **IMPORTANT**: Re-run the SAME checks from task 1 - do NOT write new checks
    - The checks from task 1 assert target files do NOT exist; after the fix they SHOULD exist — re-run to confirm
    - Verify `frontend/src/components/` directory exists
    - Verify `frontend/src/hooks/useResearch.js` exists
    - Verify `frontend/src/services/api.js` exists
    - Verify `frontend/src/utils/markdownRenderer.js` exists
    - Verify `frontend/src/utils/constants.js` exists
    - Verify `App.jsx` no longer contains `const AGENTS =`, `function renderMarkdown`, or `fetch("/api/research"` inline
    - **EXPECTED OUTCOME**: All checks PASS (confirms structural bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 3.12 Verify preservation tests still pass
    - **Property 2: Preservation** - Runtime Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2 against the refactored code
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions introduced by the refactor)
    - Confirm all behavioral properties still hold after extraction

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
