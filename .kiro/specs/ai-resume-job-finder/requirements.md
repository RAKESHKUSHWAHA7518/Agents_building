# Requirements Document

## Introduction

This feature extends the existing Job Assistant application (Node.js/Express + React/Vite + LangChain/Gemini) with an AI-powered job discovery workflow. After a user uploads their resume and it is analyzed by the AI, the system automatically searches for matching job listings from external job boards (LinkedIn, Indeed, etc.), presents them ranked by relevance, and allows the user to filter by recency and apply directly via external links. The feature builds on the existing resume upload, PDF parsing, and AI analysis pipeline already in place.

## Glossary

- **Job_Finder**: The new backend service responsible for querying external job board APIs and returning structured job listings.
- **Job_Board_API**: An external third-party API (e.g., JSearch via RapidAPI, LinkedIn Jobs API, Indeed Publisher API) used to retrieve live job postings.
- **Job_Listing**: A structured object representing a single job posting, containing title, company, location, description snippet, apply URL, and posted date.
- **Resume_Profile**: The structured AI-extracted summary of a candidate's skills, experience, job titles, and keywords derived from the uploaded resume.
- **Relevance_Score**: A numeric value (0–100) computed by the AI representing how well a Job_Listing matches the candidate's Resume_Profile.
- **Time_Filter**: A user-selected filter restricting job results to those posted within a specified recency window (24 hours, 2 days, or 7 days).
- **Apply_URL**: The direct external URL to the original job application page on the job board.
- **Session**: The existing server-side session object that stores the parsed resume text and analysis results for a given user interaction.
- **Job_Results_Panel**: The new frontend UI section that displays the ranked list of Job_Listings after a job search is triggered.
- **AI_Service**: The existing LangChain/Gemini-based service (`aiService.js` / `multiAgentService.js`) used for resume analysis and now also for generating job search queries.

---

## Requirements

### Requirement 1: Resume-Driven Job Search Query Generation

**User Story:** As a job seeker, I want the AI to automatically generate relevant job search queries from my resume, so that I don't have to manually figure out what to search for.

#### Acceptance Criteria

1. WHEN a resume has been successfully parsed and a job search is triggered, THE AI_Service SHALL extract a structured search query containing a primary job title, a list of up to 5 relevant skills, and an optional location from the Resume_Profile.
2. THE AI_Service SHALL return the search query as a JSON object with fields: `jobTitle` (string), `skills` (array of strings, max 5), and `location` (string, optional).
3. IF the resume text is fewer than 50 characters, THEN THE AI_Service SHALL return an error indicating the resume content is insufficient to generate a search query.
4. THE AI_Service SHALL generate the search query within 10 seconds of being invoked.

---

### Requirement 2: Job Board API Integration

**User Story:** As a job seeker, I want the system to fetch real job listings from job boards based on my resume, so that I can see actual opportunities I can apply to.

#### Acceptance Criteria

1. WHEN a search query is available, THE Job_Finder SHALL query at least one external Job_Board_API and return a list of Job_Listings.
2. THE Job_Finder SHALL return a maximum of 20 Job_Listings per search request.
3. WHEN the Job_Board_API returns a successful response, THE Job_Finder SHALL map each result to a Job_Listing object containing: `id` (string), `title` (string), `company` (string), `location` (string), `snippet` (string, max 300 characters), `applyUrl` (string), `postedAt` (ISO 8601 date string), and `source` (string, e.g., "LinkedIn", "Indeed").
4. IF the Job_Board_API returns an error or times out after 15 seconds, THEN THE Job_Finder SHALL return an error response with a descriptive message and an empty results array.
5. IF the Job_Board_API returns a Job_Listing without a valid `applyUrl`, THEN THE Job_Finder SHALL exclude that listing from the results.
6. THE Job_Finder SHALL pass the Time_Filter value as a parameter to the Job_Board_API query when the API supports date filtering.

---

### Requirement 3: AI-Powered Relevance Scoring

**User Story:** As a job seeker, I want each job listing to show how well it matches my resume, so that I can prioritize the most relevant opportunities.

#### Acceptance Criteria

1. WHEN Job_Listings are retrieved from the Job_Board_API, THE AI_Service SHALL compute a Relevance_Score (0–100) for each listing by comparing the listing's title and snippet against the Resume_Profile.
2. THE AI_Service SHALL rank the returned Job_Listings in descending order of Relevance_Score before sending them to the frontend.
3. THE AI_Service SHALL complete relevance scoring for up to 20 listings within 20 seconds.
4. WHEN a Relevance_Score is 70 or above, THE Job_Finder SHALL mark the listing with a `isHighMatch` flag set to `true`.
5. IF the Job_Listing snippet is empty, THEN THE AI_Service SHALL compute the Relevance_Score based on the job title alone and set a `scoredOnTitleOnly` flag to `true`.

---

### Requirement 4: Job Search API Endpoint

**User Story:** As a developer integrating the frontend, I want a single backend API endpoint that accepts a session ID and time filter and returns scored job listings, so that the frontend can display results with a single call.

#### Acceptance Criteria

1. THE Job_Finder SHALL expose a `POST /api/jobs/search` endpoint that accepts a JSON body with `sessionId` (string, required) and `timeFilter` (string, one of `"24h"`, `"2d"`, `"7d"`, required).
2. WHEN a valid request is received, THE Job_Finder SHALL return a JSON response with: `jobs` (array of scored Job_Listing objects), `query` (the generated search query object), and `totalCount` (integer).
3. IF the `sessionId` does not correspond to an active Session with a parsed resume, THEN THE Job_Finder SHALL return HTTP 404 with a descriptive error message.
4. IF the `timeFilter` value is not one of the accepted values, THEN THE Job_Finder SHALL return HTTP 400 with a descriptive error message.
5. THE Job_Finder SHALL respond to valid requests within 30 seconds.

---

### Requirement 5: Job Results Display

**User Story:** As a job seeker, I want to see a list of matched job listings after my resume is analyzed, so that I can quickly review and act on relevant opportunities.

#### Acceptance Criteria

1. WHEN job search results are returned from the backend, THE Job_Results_Panel SHALL render each Job_Listing as a card displaying: job title, company name, location, posted date (human-readable, e.g., "2 days ago"), relevance score badge, and a snippet of the job description.
2. THE Job_Results_Panel SHALL display a loading indicator while the job search request is in progress.
3. WHEN a Job_Listing has `isHighMatch` set to `true`, THE Job_Results_Panel SHALL visually distinguish that card (e.g., a highlighted border or "Top Match" badge).
4. IF the job search returns zero results, THEN THE Job_Results_Panel SHALL display a message stating no jobs were found and suggest broadening the search.
5. IF the job search request fails, THEN THE Job_Results_Panel SHALL display an error message and a retry button.
6. THE Job_Results_Panel SHALL display results sorted by Relevance_Score in descending order, matching the order returned by the backend.

---

### Requirement 6: Time Filter Controls

**User Story:** As a job seeker, I want to filter job listings by how recently they were posted, so that I can focus on fresh opportunities.

#### Acceptance Criteria

1. THE Job_Results_Panel SHALL display a time filter control with three options: "Last 24 Hours", "Last 2 Days", and "Last 7 Days".
2. WHEN a user selects a different Time_Filter option, THE Job_Results_Panel SHALL trigger a new job search request to the backend with the updated `timeFilter` value.
3. THE Job_Results_Panel SHALL display the currently active Time_Filter option as visually selected.
4. WHILE a new job search request is in progress after a filter change, THE Job_Results_Panel SHALL display a loading indicator and disable the filter controls to prevent duplicate requests.
5. THE Job_Results_Panel SHALL default to the "Last 7 Days" filter on initial load.

---

### Requirement 7: Apply Button and External Redirect

**User Story:** As a job seeker, I want an "Apply" button on each job listing that takes me directly to the application page, so that I can apply without having to search for the link myself.

#### Acceptance Criteria

1. THE Job_Results_Panel SHALL render an "Apply" button on each Job_Listing card.
2. WHEN a user clicks the "Apply" button, THE Job_Results_Panel SHALL open the Job_Listing's `applyUrl` in a new browser tab.
3. THE Job_Results_Panel SHALL set the `rel="noopener noreferrer"` attribute on all external apply links for security.
4. WHILE a job search is loading, THE Job_Results_Panel SHALL disable all "Apply" buttons until results are fully rendered.

---

### Requirement 8: Integration with Existing Resume Upload Flow

**User Story:** As a job seeker, I want job search to be a natural next step after my resume is uploaded and analyzed, so that the workflow feels seamless.

#### Acceptance Criteria

1. WHEN a resume has been successfully uploaded and parsed, THE Job_Results_Panel SHALL become visible in the UI as a new tab or section alongside the existing Analysis, Resume, Cover Letter, Interview, and Skills Gap tabs.
2. THE Job_Results_Panel SHALL use the existing `sessionId` from the current Session to fetch job results, without requiring the user to re-upload their resume.
3. WHEN the user resets the session (clears the resume), THE Job_Results_Panel SHALL clear all displayed job results and return to its initial empty state.
4. THE Job_Finder SHALL read the resume text from the existing Session store using the provided `sessionId`, without requiring the resume to be re-parsed.

---

### Requirement 9: Error Handling and Resilience

**User Story:** As a job seeker, I want the application to handle errors gracefully, so that a failed job search doesn't break my entire session.

#### Acceptance Criteria

1. IF the Job_Board_API is unavailable, THEN THE Job_Finder SHALL return a structured error response without affecting the existing resume analysis features.
2. IF the AI_Service fails to generate a search query, THEN THE Job_Finder SHALL fall back to using the most recent job title extracted from the resume text as the search query.
3. WHEN an error occurs during job search, THE Job_Results_Panel SHALL display a user-friendly error message that does not expose internal API error details.
4. THE Job_Finder SHALL log all Job_Board_API errors with the request parameters and response status for debugging purposes.
