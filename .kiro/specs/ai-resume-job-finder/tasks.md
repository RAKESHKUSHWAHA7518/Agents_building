# Implementation Plan: AI Resume Analysis + Job Finder

## Overview

Extend the existing Job Assistant application with an AI-powered job discovery workflow. The implementation adds two new AI functions to `aiService.js`, a new `jobFinderService.js` orchestration layer, a new Express route at `/api/jobs/search`, and three new React components (`TimeFilterBar`, `JobCard`, `JobsTab`) wired into the existing `App.jsx` tab system.

## Tasks

- [ ] 1. Extend backend configuration and AI service with job search functions
  - [ ] 1.1 Add `rapidApiKey` to `src/config/index.js`
    - Add `rapidApiKey: process.env.RAPIDAPI_KEY` to the exported `config` object in `genai-learning/job-assistant/backend/src/config/index.js`
    - Add a validation warning (non-fatal `console.warn`) if `RAPIDAPI_KEY` is missing, consistent with the existing pattern
    - _Requirements: 2.1, 4.1_

  - [ ] 1.2 Add `generateJobSearchQuery()` to `aiService.js`
    - In `genai-learning/job-assistant/backend/src/services/aiService.js`, build a new LangChain chain using the existing `buildChain` helper
    - The chain must prompt Gemini to return `{ jobTitle, skills, location }` as valid JSON from resume text
    - Throw an error (or return an error object) when `resumeText.length < 50`
    - Export the function as `aiService.generateJobSearchQuery(resumeText)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.3 Write property test for `generateJobSearchQuery` — Property 1 & 2
    - **Property 1: Search Query Schema Invariant** — for any resume text ≥ 50 chars, result has non-empty `jobTitle` string, `skills` array of ≤ 5 strings, and `location` as string or undefined
    - **Property 2: Short Resume Rejection** — for any string < 50 chars, the function throws or returns an error object
    - Use `fc.string()` with length filters; mock the Gemini model to return a fixed valid JSON string
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - File: `genai-learning/job-assistant/backend/src/services/__tests__/aiService.jobSearch.test.js`

  - [ ] 1.4 Add `scoreJobListings()` to `aiService.js`
    - Add a new LangChain chain that takes an array of listings (title + snippet) and resume text, and returns each listing annotated with `relevanceScore` (0–100), `isHighMatch` (boolean), and `scoredOnTitleOnly` (boolean)
    - Use a single batched Gemini call for all listings (not one call per listing)
    - Export as `aiService.scoreJobListings(listings, resumeText)`
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

  - [ ]* 1.5 Write property tests for scoring helper functions — Properties 6, 7, 8, 9
    - Extract and test the pure helper functions: `applyHighMatchFlag(score)`, `sortByRelevance(listings)`, `applyTitleOnlyFlag(listing)`
    - **Property 6: Relevance Score Range** — every `relevanceScore` is an integer in [0, 100]
    - **Property 7: Descending Sort Invariant** — after sort, each score ≥ next score
    - **Property 8: High Match Flag Consistency** — `isHighMatch === (relevanceScore >= 70)`
    - **Property 9: Title-Only Scoring Flag** — empty/whitespace snippet → `scoredOnTitleOnly: true`; non-empty → `false`
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5**
    - File: `genai-learning/job-assistant/backend/src/services/__tests__/scoringHelpers.test.js`

- [ ] 2. Create `jobFinderService.js` with the full search pipeline
  - [ ] 2.1 Implement JSearch API client and result mapper in `jobFinderService.js`
    - Create `genai-learning/job-assistant/backend/src/services/jobFinderService.js`
    - Implement `mapJSearchResult(raw)` — maps JSearch fields to the `JobListing` interface (see design Data Models section)
    - Implement `filterInvalidListings(listings)` — removes entries where `applyUrl` is null, undefined, or empty string
    - Implement `callJSearchApi(query, timeFilter)` — calls `https://jsearch.p.rapidapi.com/search` using `node-fetch` or the existing HTTP client; uses `TIME_FILTER_MAP` from the design; handles 401, 429, 5xx, and timeout (15s) per the design's error table
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.2 Write property tests for `mapJSearchResult` and `filterInvalidListings` — Properties 4 & 5
    - **Property 4: Job Listing Mapping Completeness** — for any valid JSearch result object, all required `JobListing` fields are present and non-null
    - **Property 5: Invalid Apply URL Exclusion** — after filtering, no listing has a null/undefined/empty `applyUrl`
    - Use `fc.record()` with appropriate arbitraries for JSearch result shape
    - **Validates: Requirements 2.3, 2.5**
    - File: `genai-learning/job-assistant/backend/src/services/__tests__/jobFinderService.mapping.test.js`

  - [ ] 2.3 Implement the main `jobFinderService.search()` orchestration function
    - Read `resumeText` from `sessionStore.get(sessionId)` — return structured error if session missing or has no `resumeText`
    - Call `aiService.generateJobSearchQuery(resumeText)` with fallback chain: AI failure → regex extraction of last job title → filename-based query
    - Call `callJSearchApi(query, timeFilter)`, filter invalid listings, cap at 20
    - Call `aiService.scoreJobListings(listings, resumeText)` with fallback: AI scoring failure → return listings with `relevanceScore: 0`
    - Sort descending by `relevanceScore`, return `{ jobs, query, totalCount }`
    - Log all JSearch API errors per the design's logging format
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 9.1, 9.2, 9.4_

  - [ ]* 2.4 Write property test for result count cap — Property 3
    - **Property 3: Result Count Cap** — for any JSearch response with N listings (N ≥ 0), `jobFinderService.search()` returns at most 20 `JobListing` objects
    - Mock `callJSearchApi` to return arrays of varying length (up to 50)
    - Use `fc.array(jobListingArb, { maxLength: 50 })`
    - **Validates: Requirements 2.2**
    - File: `genai-learning/job-assistant/backend/src/services/__tests__/jobFinderService.cap.test.js`

  - [ ]* 2.5 Write property test for AI fallback on query generation failure — Property 17
    - **Property 17: AI Fallback on Query Generation Failure** — when AI throws during query generation, `search()` still returns a `SearchQuery` object and does not propagate the error
    - Mock `aiService.generateJobSearchQuery` to throw; verify fallback produces a valid query
    - Use `fc.string({ minLength: 50 })` for resume text
    - **Validates: Requirements 9.2**
    - File: `genai-learning/job-assistant/backend/src/services/__tests__/jobFinderService.fallback.test.js`

- [ ] 3. Create the `/api/jobs` Express route and register it in `server.js`
  - [ ] 3.1 Create `src/routes/jobs.js`
    - Create `genai-learning/job-assistant/backend/src/routes/jobs.js` following the same pattern as `analysis.js`
    - Implement `POST /search`: validate `sessionId` (required string) and `timeFilter` (must be `"24h"`, `"2d"`, or `"7d"`); return 400 for invalid inputs, 404 for missing session, 200 with `JobSearchResponse` on success
    - Delegate all business logic to `jobFinderService.search(sessionId, timeFilter)`
    - Never expose raw API errors or keys in the response body — sanitize all error messages
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 3.2 Register `/api/jobs` route in `server.js`
    - In `genai-learning/job-assistant/backend/server.js`, import `jobsRoutes` from `./src/routes/jobs.js`
    - Add `app.use("/api/jobs", jobsRoutes)` alongside the existing route registrations
    - _Requirements: 4.1_

  - [ ] 3.3 Checkpoint — Ensure all backend tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create frontend components: `TimeFilterBar` and `JobCard`
  - [ ] 4.1 Create `TimeFilterBar.jsx`
    - Create `genai-learning/job-assistant/frontend/src/components/TimeFilterBar.jsx`
    - Props: `activeFilter` (string), `onChange` (function), `disabled` (boolean)
    - Render three buttons: "Last 24 Hours" (`"24h"`), "Last 2 Days" (`"2d"`), "Last 7 Days" (`"7d"`)
    - Apply an `active` CSS class to the button matching `activeFilter`
    - Disable all buttons when `disabled` is `true`
    - _Requirements: 6.1, 6.3, 6.4_

  - [ ]* 4.2 Write property tests for `TimeFilterBar` — Properties 14 & 15
    - **Property 14: Filter Selection Triggers Correct API Call** — for any valid `timeFilter` value, selecting it calls `onChange` with that exact value
    - **Property 15: Active Filter Visual State** — the button matching `activeFilter` has the active CSS class; the other two do not
    - Use `fc.constantFrom("24h", "2d", "7d")` and React Testing Library
    - **Validates: Requirements 6.2, 6.3**
    - File: `genai-learning/job-assistant/frontend/src/components/__tests__/TimeFilterBar.test.jsx`

  - [ ] 4.3 Create `JobCard.jsx`
    - Create `genai-learning/job-assistant/frontend/src/components/JobCard.jsx`
    - Props: a single `job` object matching the `JobListing` interface
    - Display: job title, company name, location, human-readable posted date (e.g., "2 days ago" using relative time), relevance score badge, snippet text, and an Apply button
    - When `job.isHighMatch === true`, add a "Top Match" badge and a highlighted border CSS class
    - The Apply button must be an `<a>` tag with `href={job.applyUrl}`, `target="_blank"`, and `rel="noopener noreferrer"`
    - Disable the Apply button (pointer-events: none or `aria-disabled`) while `loading` prop is `true`
    - _Requirements: 5.1, 5.3, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 4.4 Write property tests for `JobCard` — Properties 12, 13, 16
    - **Property 12: Job Card Renders All Required Fields** — for any `JobListing` object, the rendered card includes title, company, location, posted date, relevance score, snippet, and Apply button
    - **Property 13: High Match Visual Distinction** — `isHighMatch: true` → "Top Match" badge present; `isHighMatch: false` → badge absent
    - **Property 16: Apply Link Security Attributes** — Apply link always has `rel="noopener noreferrer"` and `target="_blank"`
    - Use `fc.record(jobListingArb)` and React Testing Library
    - **Validates: Requirements 5.1, 5.3, 7.3**
    - File: `genai-learning/job-assistant/frontend/src/components/__tests__/JobCard.test.jsx`

- [ ] 5. Create `JobsTab.jsx` and wire it into `App.jsx`
  - [ ] 5.1 Create `JobsTab.jsx`
    - Create `genai-learning/job-assistant/frontend/src/components/tabs/JobsTab.jsx`
    - Props: `session` (object with `sessionId`), `onReset` (function)
    - Local state: `jobs` (array), `query` (object), `loading` (boolean), `error` (string|null), `timeFilter` (string, default `"7d"`)
    - On mount and on `timeFilter` change, call `POST /api/jobs/search` with `{ sessionId: session.sessionId, timeFilter }`
    - Render `TimeFilterBar` (pass `activeFilter`, `onChange`, `disabled={loading}`)
    - Render a loading spinner while `loading === true`
    - Render a list of `JobCard` components when `jobs.length > 0`
    - Render a "No jobs found" empty state when `jobs.length === 0` and not loading
    - Render an error message + "Try Again" button when `error` is set; distinguish session-expired errors (show "Please re-upload your resume" with no retry)
    - Clear jobs and reset state when `session` becomes null (reset flow)
    - _Requirements: 5.2, 5.4, 5.5, 5.6, 6.1, 6.2, 6.4, 6.5, 8.1, 8.2, 8.3_

  - [ ] 5.2 Add Jobs tab to `App.jsx`
    - In `genai-learning/job-assistant/frontend/src/App.jsx`, add `{ id: "jobs", label: "🔍 Find Jobs" }` to the `TABS` array
    - Import `JobsTab` from `./components/tabs/JobsTab.jsx`
    - In the `visibleTabs` filter, include the `"jobs"` tab whenever `session` exists (no analysis required)
    - In the tab content section, add a conditional render: `{activeTab === "jobs" && <JobsTab session={session} onReset={handleReset} />}`
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 6. Install fast-check and write integration + component tests
  - [ ] 6.1 Install `fast-check` in backend and frontend
    - In `genai-learning/job-assistant/backend/`, run `npm install --save-dev fast-check@3.22.0`
    - In `genai-learning/job-assistant/frontend/`, run `npm install --save-dev fast-check@3.22.0`
    - Verify the package appears in both `package.json` devDependencies
    - _Requirements: (testing infrastructure)_

  - [ ] 6.2 Write integration tests for `POST /api/jobs/search`
    - Create `genai-learning/job-assistant/backend/src/routes/__tests__/jobs.integration.test.js`
    - Test: valid request with mocked `jobFinderService` → 200 with correct `{ jobs, query, totalCount }` shape
    - Test: missing `sessionId` → 400
    - Test: missing `timeFilter` → 400
    - Test: invalid `timeFilter` value → 400
    - Test: unknown `sessionId` → 404
    - Test: `jobFinderService` throws → 500 with sanitized error (no raw API details)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.3 Write property tests for invalid session and time filter — Properties 10 & 11
    - **Property 10: Invalid Session Returns 404** — for any string not in the session store, `POST /api/jobs/search` returns HTTP 404
    - **Property 11: Invalid Time Filter Returns 400** — for any string not in `["24h", "2d", "7d"]`, the endpoint returns HTTP 400
    - Use `fc.string()` and `fc.string().filter(s => !["24h","2d","7d"].includes(s))`
    - **Validates: Requirements 4.3, 4.4**
    - File: `genai-learning/job-assistant/backend/src/routes/__tests__/jobs.property.test.js`

  - [ ]* 6.4 Write component tests for `JobCard` and `TimeFilterBar`
    - Create `genai-learning/job-assistant/frontend/src/components/__tests__/JobCard.test.jsx` (if not already created in task 4.4)
    - Create `genai-learning/job-assistant/frontend/src/components/__tests__/TimeFilterBar.test.jsx` (if not already created in task 4.2)
    - Test `JobCard`: renders all fields; shows "Top Match" badge for high-match; Apply link has correct `rel` and `target`; Apply link is disabled when `loading` prop is true
    - Test `TimeFilterBar`: active button has active class; clicking a button calls `onChange` with correct value; all buttons disabled when `disabled` prop is true
    - _Requirements: 5.1, 5.3, 6.1, 6.3, 7.3_

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- The design document's Correctness Properties section defines 17 properties; property tests are distributed across tasks 1.3, 1.5, 2.2, 2.4, 2.5, 4.2, 4.4, 6.3
- The existing `buildChain` and `parseJSON` helpers in `aiService.js` should be reused for the two new AI functions
- `jobFinderService.js` should use `node-fetch` (already available in the project) or the native `fetch` if Node ≥ 18 is in use — check `package.json` before choosing
- All error messages returned to the frontend must be sanitized; raw JSearch API errors, keys, and URLs must only appear in server-side logs
- The Jobs tab is visible as soon as a session exists — it does not require a job description or prior analysis run

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "6.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.2", "2.3"] },
    { "id": 3, "tasks": ["1.5", "2.4", "2.5", "3.1"] },
    { "id": 4, "tasks": ["3.2", "4.1", "4.3"] },
    { "id": 5, "tasks": ["4.2", "4.4", "5.1"] },
    { "id": 6, "tasks": ["5.2", "6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4"] }
  ]
}
```
