# Multi-Agent Research Folder Structure Bugfix Design

## Overview

The `multi-agent-research` frontend has all ~300 lines of application logic collapsed into a single `App.jsx` file. The fix is a structural refactor: extract components, a custom hook, a service module, and a utility into the folder layout established by the `job-assistant` project, then reduce `App.jsx` to a thin orchestration root that composes those pieces.

The bug condition is purely structural — the code is functionally correct but violates the project's folder convention. The fix must not change any runtime behavior: the same SSE stream is consumed, the same events update the same UI, and the same user interactions produce the same outcomes.

## Glossary

- **Bug_Condition (C)**: The condition that identifies the structural defect — any source file that belongs in a dedicated module but is instead inlined in `App.jsx`
- **Property (P)**: The desired post-fix state — each logical unit lives in its own file under the correct subdirectory, and `App.jsx` contains only orchestration imports and top-level composition
- **Preservation**: All runtime behavior (SSE streaming, state transitions, UI rendering, user interactions) that must remain byte-for-byte equivalent after the refactor
- **`App.jsx`**: `genai-learning/multi-agent-research/frontend/src/App.jsx` — the monolithic file being split
- **`job-assistant` convention**: The folder structure in `genai-learning/job-assistant/frontend/src/` used as the reference pattern (`components/`, `hooks/`, `services/`, `utils/`)
- **SSE stream**: The Server-Sent Events stream returned by `POST /api/research`, consumed by the research hook
- **`renderMarkdown`**: The inline function in `App.jsx` that converts markdown text to HTML strings
- **`AGENTS` / `PHASES` / `SUGGESTIONS`**: Top-level constants in `App.jsx` shared across multiple components

## Bug Details

### Bug Condition

The bug manifests whenever a logical unit of code (a component, hook, service function, or utility) that belongs in its own file under a dedicated subdirectory is instead defined inline inside `App.jsx`. The structural check fails for every such unit that has not yet been extracted.

**Formal Specification:**
```
FUNCTION isBugCondition(sourceUnit)
  INPUT: sourceUnit — a logical unit of code (component, hook, service, utility, constant group)
  OUTPUT: boolean

  RETURN sourceUnit.definedIn == "App.jsx"
         AND sourceUnit.belongsIn != "App.jsx"
         AND NOT fileExists(sourceUnit.targetPath)
END FUNCTION
```

Where `sourceUnit.targetPath` is the canonical path under `src/` that the unit should occupy after the fix.

### Examples

| Source Unit | Currently In | Should Be In | Bug? |
|---|---|---|---|
| `<header>` JSX block | `App.jsx` | `components/Header.jsx` | ✅ Yes |
| Search input + suggestion chips JSX | `App.jsx` | `components/SearchBox.jsx` | ✅ Yes |
| Phase progress bar JSX | `App.jsx` | `components/PhaseBar.jsx` | ✅ Yes |
| Agent activity feed JSX | `App.jsx` | `components/ActivityFeed.jsx` | ✅ Yes |
| Report panel JSX | `App.jsx` | `components/ReportPanel.jsx` | ✅ Yes |
| All `useState`/`useRef`/`useEffect` + SSE logic | `App.jsx` | `hooks/useResearch.js` | ✅ Yes |
| `fetch("/api/research", ...)` call | `App.jsx` | `services/api.js` | ✅ Yes |
| `renderMarkdown` function | `App.jsx` | `utils/markdownRenderer.js` | ✅ Yes |
| `AGENTS`, `PHASES`, `SUGGESTIONS` constants | `App.jsx` | `utils/constants.js` | ✅ Yes |
| Top-level `<div className="app">` composition | `App.jsx` | `App.jsx` (stays) | ❌ No |

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Submitting a research topic sends `POST /api/research` with `{ topic }` and opens an SSE stream
- All SSE event types (`system`, `phase`, `phase_done`, `agent_start`, `agent_done`, `tool_call`, `tool_result`, `report`, `complete`, `error`) update state identically
- The phase progress bar advances through phases 1–5 and shows the correct agent icon and color per phase
- The agent activity feed appends events in real time and auto-scrolls to the latest entry
- The research report renders via `renderMarkdown` and displays stats (agents, subtopics, duration, word count) and plan subtopics
- "Copy" copies the raw markdown to clipboard; "Download" saves it as a `.md` file
- Suggestion chips trigger `startResearch` with the chip's text
- "+ New" resets all state to the idle/empty state
- The empty state agent grid renders all 5 agent cards with correct icons, colors, and descriptions
- `App.css` is imported unchanged; no CSS classes are renamed or removed

**Scope:**
All inputs that do NOT involve the structural location of code are completely unaffected. This includes every user interaction, every SSE event, every state transition, and every rendered pixel. The refactor is purely a file-organization change.

**Note:** The actual expected post-fix structural state is defined in the Correctness Properties section (Property 1).

## Hypothesized Root Cause

The structural defect has a single, clear cause:

1. **No initial scaffolding**: The `multi-agent-research` frontend was bootstrapped with a plain Vite template and the developer wrote all logic directly into `App.jsx` without first creating the `components/`, `hooks/`, `services/`, and `utils/` subdirectories that the `job-assistant` project established as the team convention.

2. **No enforced convention**: There is no linting rule, generator, or template that enforces the folder structure, so the deviation went undetected until a structural review.

3. **Incremental growth**: The file grew organically as features were added (SSE streaming, phase bar, activity feed, report panel), making each addition feel like a small change rather than a structural violation.

4. **No cross-project reference check**: The `job-assistant` pattern was not consulted during development of `multi-agent-research`, so the convention was not replicated.

## Correctness Properties

Property 1: Bug Condition — All Logical Units Extracted to Canonical Paths

_For any_ logical unit (component, hook, service, utility, or constant group) where `isBugCondition` returns true, the fixed codebase SHALL have that unit defined in its canonical target file, exported correctly, and imported by the file(s) that use it, with `App.jsx` containing no inline definitions of those units.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

Property 2: Preservation — Runtime Behavior Unchanged

_For any_ user interaction or SSE event where `isBugCondition` does NOT hold (i.e., the interaction is a runtime behavior, not a structural location), the fixed codebase SHALL produce exactly the same rendered output, state transitions, and side effects as the original monolithic `App.jsx`, preserving all existing functionality end-to-end.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.10**

## Fix Implementation

### Target File Structure

After the fix, `frontend/src/` SHALL contain:

```
src/
├── App.jsx                        ← thin orchestration root (imports only)
├── App.css                        ← unchanged
├── main.jsx                       ← unchanged
├── components/
│   ├── Header.jsx                 ← logo + agent pills
│   ├── SearchBox.jsx              ← input, button, suggestion chips
│   ├── PhaseBar.jsx               ← phase progress bar
│   ├── ActivityFeed.jsx           ← agent activity event list
│   └── ReportPanel.jsx            ← report display, stats, subtopics, copy/download
├── hooks/
│   └── useResearch.js             ← all useState/useRef/useEffect + SSE logic
├── services/
│   └── api.js                     ← fetch call to /api/research
└── utils/
    ├── constants.js               ← AGENTS, PHASES, SUGGESTIONS
    └── markdownRenderer.js        ← renderMarkdown function
```

### Changes Required

**File: `utils/constants.js`** (new)
- Extract `AGENTS`, `PHASES`, and `SUGGESTIONS` constants verbatim from `App.jsx`
- Export each as a named export

**File: `utils/markdownRenderer.js`** (new)
- Extract the `renderMarkdown` function verbatim from `App.jsx`
- Export as a named export

**File: `services/api.js`** (new)
- Extract the `fetch("/api/research", ...)` call from `startResearch` into an exported `startResearch(topic)` function that returns the raw `Response` object (so the SSE reader in the hook can consume `res.body`)
- Pattern matches `job-assistant/frontend/src/services/api.js`

**File: `hooks/useResearch.js`** (new)
- Extract all `useState`, `useRef`, `useEffect`, `addEvent`, `startResearch`, `handleEvent`, `reset`, `copyReport`, and `downloadReport` logic from `App.jsx`
- Accept no arguments (all state is internal)
- Return an object with: `{ topic, setTopic, events, report, plan, stats, isRunning, isDone, currentPhase, error, eventsEndRef, startResearch, reset, copyReport, downloadReport }`
- Import `AGENTS` from `utils/constants.js` (needed for `handleEvent` phase mapping)
- Import `startResearch` (the fetch call) from `services/api.js`

**File: `components/Header.jsx`** (new)
- Extract the `<header className="header">` block from `App.jsx`
- Props: none (static content)
- Import `AGENTS` from `utils/constants.js` for the agent pills

**File: `components/SearchBox.jsx`** (new)
- Extract the `<div className="search-section">` block
- Props: `{ topic, setTopic, isRunning, isDone, onSearch, suggestions }`
- `onSearch(topicOverride?)` maps to `startResearch` from the hook

**File: `components/PhaseBar.jsx`** (new)
- Extract the `<div className="phases-bar">` block
- Props: `{ currentPhase, isRunning, isDone }`
- Import `AGENTS` and `PHASES` from `utils/constants.js`

**File: `components/ActivityFeed.jsx`** (new)
- Extract the left panel `<div className="activity-panel">` block including all event-kind renderers
- Props: `{ events, isRunning, isDone, eventsEndRef }`
- Import `AGENTS` from `utils/constants.js`

**File: `components/ReportPanel.jsx`** (new)
- Extract the right panel `<div className="report-panel">` block including stats, subtopics bar, report content, and empty state
- Props: `{ report, stats, plan, isRunning, isDone, onCopy, onDownload, onReset }`
- Import `renderMarkdown` from `utils/markdownRenderer.js`
- Import `AGENTS` and `PHASES` from `utils/constants.js` (for the empty-state agent flow)

**File: `App.jsx`** (modified)
- Remove all extracted logic
- Import and compose: `Header`, `SearchBox`, `PhaseBar`, `ActivityFeed`, `ReportPanel`
- Import and call `useResearch()` hook
- Retain only the top-level `<div className="app">` structure and conditional rendering logic
- Result: ~30–40 lines

### Constants Placement Decision

`AGENTS`, `PHASES`, and `SUGGESTIONS` are used across multiple components (`Header`, `PhaseBar`, `ActivityFeed`, `ReportPanel`, `SearchBox`) and the hook. Placing them in `utils/constants.js` avoids circular imports and matches the `job-assistant` pattern of shared utilities living in `utils/`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, verify the structural fix (all files exist at canonical paths with correct exports), then verify preservation (the application renders and behaves identically to the original).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the structural defect BEFORE implementing the fix. Confirm that the target files do not yet exist and that `App.jsx` contains the inline definitions.

**Test Plan**: Check the filesystem for the absence of target files and grep `App.jsx` for the presence of inline definitions. Run these checks on the UNFIXED code to confirm the bug condition holds.

**Test Cases**:
1. **Missing `components/` directory**: Assert that `frontend/src/components/` does not exist (will pass on unfixed code, confirming the bug)
2. **Missing `hooks/` directory**: Assert that `frontend/src/hooks/` does not exist (will pass on unfixed code)
3. **Missing `services/api.js`**: Assert that `frontend/src/services/api.js` does not exist (will pass on unfixed code)
4. **Missing `utils/markdownRenderer.js`**: Assert that `frontend/src/utils/markdownRenderer.js` does not exist (will pass on unfixed code)
5. **Inline `renderMarkdown` in `App.jsx`**: Assert that `App.jsx` contains the `renderMarkdown` function definition (will pass on unfixed code)
6. **Inline `AGENTS` constant in `App.jsx`**: Assert that `App.jsx` contains `const AGENTS = {` (will pass on unfixed code)

**Expected Counterexamples**:
- All target subdirectories are absent from `frontend/src/`
- `App.jsx` contains all inline definitions that should be extracted

### Fix Checking

**Goal**: Verify that for all source units where the bug condition holds, the fixed codebase has each unit at its canonical path with correct exports.

**Pseudocode:**
```
FOR ALL sourceUnit WHERE isBugCondition(sourceUnit) DO
  result := inspect(sourceUnit.targetPath)
  ASSERT fileExists(result.path)
  ASSERT result.hasCorrectExport(sourceUnit.exportName)
  ASSERT App.jsx does NOT contain inline definition of sourceUnit
END FOR
```

### Preservation Checking

**Goal**: Verify that for all runtime behaviors where the bug condition does NOT hold, the fixed application produces the same rendered output and side effects as the original.

**Pseudocode:**
```
FOR ALL behavior WHERE NOT isBugCondition(behavior) DO
  ASSERT render(App_fixed) produces same output as render(App_original)
  ASSERT userInteraction(behavior) produces same state transitions
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of SSE event sequences automatically
- It catches edge cases in event ordering that manual tests might miss
- It provides strong guarantees that the hook's state machine is equivalent before and after extraction

**Test Plan**: Observe behavior on UNFIXED code first (render the original `App.jsx` in a test harness, simulate SSE events, capture state), then write property-based tests that replay those same event sequences against the fixed hook and assert identical state.

**Test Cases**:
1. **SSE Event Sequence Preservation**: Generate random sequences of valid SSE event types and assert that `useResearch` produces the same `events` array and state flags as the original inline handlers
2. **Reset Preservation**: After any research run, assert that calling `reset()` returns all state to the initial idle values
3. **Suggestion Chip Preservation**: Assert that clicking any suggestion chip calls `startResearch` with the chip's exact text
4. **Copy/Download Preservation**: Assert that `copyReport` calls `navigator.clipboard.writeText` with the raw markdown, and `downloadReport` creates a `.md` blob with the correct filename

### Unit Tests

- Test that each component renders without errors given valid props
- Test that `renderMarkdown` produces correct HTML for headings, bold, lists, and paragraphs
- Test that `useResearch` initializes with the correct default state values
- Test edge cases: empty topic string rejected, `isRunning` blocks duplicate submissions, `currentPhase` advances correctly on `phase` events

### Property-Based Tests

- Generate random arrays of SSE event objects and verify that `useResearch`'s `handleEvent` produces a monotonically growing `events` array with no dropped events
- Generate random `report` strings and verify that `renderMarkdown` output contains no raw `**` or `##` markers (all markdown is converted)
- Generate random `topic` strings and verify that `downloadReport` always produces a filename derived from the first 30 characters of the topic

### Integration Tests

- Render the refactored `App.jsx` in a browser test harness, mock `fetch` to return a canned SSE stream, and assert the full UI flow: idle → searching → phase bar advancing → activity feed populating → report appearing → reset
- Test that the `Header` component renders all 5 agent pills with correct colors and icons
- Test that the `PhaseBar` shows the correct active phase icon and pulse animation during a research run
- Test that `ReportPanel` renders the stats row and subtopics bar when `stats` and `plan` are provided
