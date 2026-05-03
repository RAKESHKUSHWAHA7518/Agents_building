// src/services/multiAgentService.js — Multi-Agent Job Assistant Pipeline
//
// Architecture:
//   1. Analyzer Agent  — deep analysis of resume vs job description
//   2. Strategist Agent — creates a tailored action plan from the analysis
//   3. Parallel Agents  — Resume, Cover Letter, Interview, Skills Gap
//                         all run simultaneously using the strategy as context
//   4. Quality Agent   — reviews all outputs for consistency and coherence
//
// Why this is better than single chains:
//   - Each agent has focused context (not one giant prompt)
//   - Strategist ensures all outputs are aligned to the same goal
//   - Parallel execution is faster
//   - Quality agent catches inconsistencies across outputs

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { config } from "../config/index.js";

// ─────────────────────────────────────────────
// Model setup — two tiers
// Fast model for parallel workers, smart model for orchestration
// ─────────────────────────────────────────────
const smartModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: config.geminiApiKey,
  temperature: 0.3,
});

const fastModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash-lite",
  apiKey: config.geminiApiKey,
  temperature: 0.3,
});

const parser = new StringOutputParser();

// ─────────────────────────────────────────────
// Helper: parse JSON safely from LLM response
// ─────────────────────────────────────────────
function parseJSON(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { raw: text };
  } catch {
    return { raw: text };
  }
}

// ─────────────────────────────────────────────
// AGENT 1: Analyzer Agent (smart model)
// Deep analysis — goes beyond basic ATS scoring
// ─────────────────────────────────────────────
const analyzerChain = RunnableSequence.from([
  ChatPromptTemplate.fromMessages([
    ["system", `You are an expert ATS system and senior career coach with 15+ years of experience.
Perform a deep, honest analysis of the resume against the job description.
Look beyond keywords — assess experience depth, career trajectory, and cultural fit signals.
Return ONLY valid JSON.`],
    ["human", `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

Perform deep analysis and return this exact JSON:
{{
  "matchScore": <number 0-100>,
  "summary": "<3-4 sentence honest assessment including strengths and concerns>",
  "strengths": ["<specific strength with evidence from resume>", "<strength 2>", "<strength 3>"],
  "gaps": ["<specific gap with explanation of why it matters>", "<gap 2>", "<gap 3>"],
  "missingKeywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"],
  "hiddenStrengths": ["<transferable skill or experience not obvious at first glance>"],
  "redFlags": ["<potential concern a hiring manager might have>"],
  "recommendation": "<one clear, actionable recommendation>",
  "tone": "<formal|startup|technical|creative — inferred from job description>",
  "seniorityLevel": "<junior|mid|senior|lead — inferred from job description>",
  "industryContext": "<brief context about this role/industry that should inform all outputs>"
}}`],
  ]),
  smartModel,
  parser,
]);

// ─────────────────────────────────────────────
// AGENT 2: Strategist Agent (smart model)
// Creates a unified strategy that all other agents will follow
// This is the key to coherent multi-agent output
// ─────────────────────────────────────────────
const strategistChain = RunnableSequence.from([
  ChatPromptTemplate.fromMessages([
    ["system", `You are a senior career strategist who coordinates a team of specialists.
Based on the analysis, create a unified strategy that all specialists must follow.
This strategy ensures all outputs (resume, cover letter, interview prep, skills gap) 
tell the same coherent story and are optimized for this specific role.
Return ONLY valid JSON.`],
    ["human", `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

ANALYSIS:
{analysis}

Create a unified strategy and return this exact JSON:
{{
  "coreNarrative": "<the 1-2 sentence story the candidate should tell across all materials>",
  "topThreeSellingPoints": ["<most compelling point>", "<second point>", "<third point>"],
  "keywordsToEmphasize": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"],
  "toneGuidance": "<how to write — formal/casual, technical depth, energy level>",
  "experiencesToHighlight": ["<specific experience from resume to feature prominently>"],
  "experiencesToDownplay": ["<experience that may distract from the target role>"],
  "addressRedFlags": {{
    "<red flag>": "<how to address or reframe it>"
  }},
  "resumeStrategy": "<specific instruction for resume rewriter>",
  "coverLetterStrategy": "<specific instruction for cover letter writer>",
  "interviewStrategy": "<specific instruction for interview prep agent>",
  "skillsGapStrategy": "<specific instruction for skills gap agent>"
}}`],
  ]),
  smartModel,
  parser,
]);

// ─────────────────────────────────────────────
// AGENT 3a: Resume Rewriter (fast model, uses strategy)
// ─────────────────────────────────────────────
const resumeRewriterChain = RunnableSequence.from([
  ChatPromptTemplate.fromMessages([
    ["system", `You are an expert resume writer. You have been given a strategy to follow.
Rewrite the resume to tell the exact story the strategy defines.
Use strong action verbs, quantify achievements, and weave in the required keywords naturally.
Return ONLY the rewritten resume in clean markdown format.`],
    ["human", `ORIGINAL RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

STRATEGY TO FOLLOW:
Core Narrative: {coreNarrative}
Top Selling Points: {topThreeSellingPoints}
Keywords to Emphasize: {keywordsToEmphasize}
Experiences to Highlight: {experiencesToHighlight}
Experiences to Downplay: {experiencesToDownplay}
Specific Instructions: {resumeStrategy}
Tone: {toneGuidance}

Rewrite the resume following this strategy exactly. Improve:
1. Summary/objective to open with the core narrative
2. Bullet points to highlight the top selling points
3. Skills section to feature the required keywords
4. Quantify achievements where possible
5. Downplay or reframe experiences as instructed`],
  ]),
  fastModel,
  parser,
]);

// ─────────────────────────────────────────────
// AGENT 3b: Cover Letter Writer (fast model, uses strategy)
// ─────────────────────────────────────────────
const coverLetterChain = RunnableSequence.from([
  ChatPromptTemplate.fromMessages([
    ["system", `You are an expert cover letter writer. You have been given a strategy to follow.
Write a cover letter that tells the exact story the strategy defines.
Be professional but show personality. Keep it to 3-4 paragraphs.
Return ONLY the cover letter text.`],
    ["human", `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

CANDIDATE NAME: {candidateName}

STRATEGY TO FOLLOW:
Core Narrative: {coreNarrative}
Top Selling Points: {topThreeSellingPoints}
Tone: {toneGuidance}
Specific Instructions: {coverLetterStrategy}

Write a cover letter that:
- Opens with the core narrative as a hook
- Body 1: Leads with the top selling point, backed by specific evidence
- Body 2: Addresses the role's needs using the strategy's keywords
- Closing: Confident call to action matching the tone guidance`],
  ]),
  fastModel,
  parser,
]);

// ─────────────────────────────────────────────
// AGENT 3c: Interview Prep Agent (fast model, uses strategy)
// ─────────────────────────────────────────────
const interviewPrepChain = RunnableSequence.from([
  ChatPromptTemplate.fromMessages([
    ["system", `You are an expert interview coach. You have been given a strategy to follow.
Generate interview questions and answers that reinforce the candidate's core narrative.
Answers should use the STAR framework and highlight the top selling points.
Return ONLY valid JSON.`],
    ["human", `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

STRATEGY TO FOLLOW:
Core Narrative: {coreNarrative}
Top Selling Points: {topThreeSellingPoints}
Red Flags to Address: {addressRedFlags}
Specific Instructions: {interviewStrategy}

Generate 6 likely interview questions with strategic answers.
Return this exact JSON:
{{
  "questions": [
    {{
      "question": "<interview question>",
      "type": "<behavioral|technical|situational|motivational>",
      "why": "<why they ask this — what they're really evaluating>",
      "strategicAngle": "<how this answer reinforces the core narrative>",
      "framework": "<STAR|CAR|other>",
      "keyPoints": ["<point 1>", "<point 2>", "<point 3>"],
      "sampleAnswer": "<2-3 sentence sample answer using the framework>"
    }}
  ]
}}`],
  ]),
  fastModel,
  parser,
]);

// ─────────────────────────────────────────────
// AGENT 3d: Skills Gap Agent (fast model, uses strategy)
// ─────────────────────────────────────────────
const skillsGapChain = RunnableSequence.from([
  ChatPromptTemplate.fromMessages([
    ["system", `You are a technical skills assessor and learning path designer.
You have been given a strategy to follow.
Prioritize the learning plan based on what will have the most impact for THIS specific role.
Return ONLY valid JSON.`],
    ["human", `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

STRATEGY TO FOLLOW:
Keywords to Emphasize: {keywordsToEmphasize}
Seniority Level: {seniorityLevel}
Specific Instructions: {skillsGapStrategy}

Analyze skills gap and return this exact JSON:
{{
  "hasSkills": ["<skill the candidate clearly has>"],
  "missingSkills": ["<skill they need to learn>"],
  "niceToHave": ["<optional skills that would help>"],
  "quickWins": ["<skill they can learn in 1-2 weeks that would immediately help>"],
  "learningPlan": [
    {{
      "skill": "<skill name>",
      "priority": "<critical|high|medium|low>",
      "whyItMatters": "<why this skill is important for this specific role>",
      "timeToLearn": "<estimated time>",
      "resources": ["<specific resource 1>", "<specific resource 2>"]
    }}
  ]
}}`],
  ]),
  fastModel,
  parser,
]);

// ─────────────────────────────────────────────
// AGENT 4: Quality Agent (smart model)
// Reviews all outputs for consistency and coherence
// ─────────────────────────────────────────────
const qualityChain = RunnableSequence.from([
  ChatPromptTemplate.fromMessages([
    ["system", `You are a quality assurance specialist reviewing career materials.
Check that all materials tell a consistent story and are optimized for the target role.
Return ONLY valid JSON with your quality assessment and any corrections needed.`],
    ["human", `CORE NARRATIVE: {coreNarrative}
JOB DESCRIPTION SUMMARY: {jobDescriptionSummary}

MATERIALS TO REVIEW:
Resume (first 500 chars): {resumePreview}
Cover Letter (first 300 chars): {coverLetterPreview}

Check for:
1. Consistent tone across materials
2. Core narrative is present in both
3. No contradictions between materials
4. Keywords appear naturally (not stuffed)

Return this exact JSON:
{{
  "overallScore": <number 0-100>,
  "isConsistent": <true|false>,
  "consistencyNotes": "<brief note on consistency>",
  "resumeQuality": "<good|needs_improvement>",
  "coverLetterQuality": "<good|needs_improvement>",
  "suggestions": ["<improvement suggestion 1>", "<improvement suggestion 2>"]
}}`],
  ]),
  smartModel,
  parser,
]);

// ─────────────────────────────────────────────
// ORCHESTRATOR — runs the full multi-agent pipeline
// ─────────────────────────────────────────────
export const multiAgentService = {

  // Full pipeline: analyze → strategize → parallel workers → quality check
  async runFullPipeline(resume, jobDescription, candidateName = "Candidate", onProgress) {
    const progress = (step, message) => {
      console.log(`  [${step}] ${message}`);
      onProgress?.({ step, message });
    };

    // ── Step 1: Analyzer Agent ──
    progress("1/4", "🔍 Analyzer Agent: Deep analysis...");
    const analysisRaw = await analyzerChain.invoke({ resume, jobDescription });
    const analysis = parseJSON(analysisRaw);

    // ── Step 2: Strategist Agent ──
    progress("2/4", "🧠 Strategist Agent: Building unified strategy...");
    const strategyRaw = await strategistChain.invoke({
      resume,
      jobDescription,
      analysis: JSON.stringify(analysis),
    });
    const strategy = parseJSON(strategyRaw);

    // Flatten strategy fields for use in parallel agents
    const strategyContext = {
      coreNarrative: strategy.coreNarrative || "",
      topThreeSellingPoints: JSON.stringify(strategy.topThreeSellingPoints || []),
      keywordsToEmphasize: JSON.stringify(strategy.keywordsToEmphasize || []),
      toneGuidance: strategy.toneGuidance || "",
      experiencesToHighlight: JSON.stringify(strategy.experiencesToHighlight || []),
      experiencesToDownplay: JSON.stringify(strategy.experiencesToDownplay || []),
      addressRedFlags: JSON.stringify(strategy.addressRedFlags || {}),
      resumeStrategy: strategy.resumeStrategy || "",
      coverLetterStrategy: strategy.coverLetterStrategy || "",
      interviewStrategy: strategy.interviewStrategy || "",
      skillsGapStrategy: strategy.skillsGapStrategy || "",
      seniorityLevel: analysis.seniorityLevel || "mid",
    };

    // ── Step 3: Parallel Agents ──
    progress("3/4", "⚡ Running Resume, Cover Letter, Interview & Skills agents in parallel...");

    const [rewrittenResume, coverLetter, interviewPrepRaw, skillsGapRaw] = await Promise.all([
      resumeRewriterChain.invoke({ resume, jobDescription, candidateName, ...strategyContext }),
      coverLetterChain.invoke({ resume, jobDescription, candidateName, ...strategyContext }),
      interviewPrepChain.invoke({ resume, jobDescription, candidateName, ...strategyContext }),
      skillsGapChain.invoke({ resume, jobDescription, candidateName, ...strategyContext }),
    ]);

    const interviewPrep = parseJSON(interviewPrepRaw);
    const skillsGap = parseJSON(skillsGapRaw);

    // ── Step 4: Quality Agent ──
    progress("4/4", "✅ Quality Agent: Reviewing consistency...");
    const qualityRaw = await qualityChain.invoke({
      coreNarrative: strategy.coreNarrative || "",
      jobDescriptionSummary: jobDescription.substring(0, 300),
      resumePreview: rewrittenResume.substring(0, 500),
      coverLetterPreview: coverLetter.substring(0, 300),
    });
    const quality = parseJSON(qualityRaw);

    return {
      analysis,
      strategy,
      rewrittenResume,
      coverLetter,
      interviewPrep,
      skillsGap,
      quality,
    };
  },

  // ── Individual agents (for on-demand use from existing routes) ──

  async analyzeMatch(resume, jobDescription) {
    const raw = await analyzerChain.invoke({ resume, jobDescription });
    return parseJSON(raw);
  },

  async rewriteResume(resume, jobDescription, analysis) {
    // Build a minimal strategy from analysis for standalone use
    const strategy = {
      coreNarrative: analysis.summary || "",
      topThreeSellingPoints: JSON.stringify(analysis.strengths || []),
      keywordsToEmphasize: JSON.stringify(analysis.missingKeywords || []),
      toneGuidance: "professional and results-focused",
      experiencesToHighlight: JSON.stringify([]),
      experiencesToDownplay: JSON.stringify([]),
      addressRedFlags: JSON.stringify({}),
      resumeStrategy: `Address these gaps: ${(analysis.gaps || []).join(", ")}`,
      seniorityLevel: "mid",
    };
    return resumeRewriterChain.invoke({ resume, jobDescription, candidateName: "", ...strategy });
  },

  async streamRewrite(resume, jobDescription, analysis, onChunk) {
    const strategy = {
      coreNarrative: analysis.summary || "",
      topThreeSellingPoints: JSON.stringify(analysis.strengths || []),
      keywordsToEmphasize: JSON.stringify(analysis.missingKeywords || []),
      toneGuidance: "professional and results-focused",
      experiencesToHighlight: JSON.stringify([]),
      experiencesToDownplay: JSON.stringify([]),
      addressRedFlags: JSON.stringify({}),
      resumeStrategy: `Address these gaps: ${(analysis.gaps || []).join(", ")}`,
      seniorityLevel: "mid",
    };
    const stream = await resumeRewriterChain.stream({
      resume, jobDescription, candidateName: "", ...strategy,
    });
    let full = "";
    for await (const chunk of stream) {
      full += chunk;
      onChunk(chunk);
    }
    return full;
  },

  async generateCoverLetter(resume, jobDescription, candidateName, analysis = {}) {
    const strategy = {
      coreNarrative: analysis.summary || "",
      topThreeSellingPoints: JSON.stringify(analysis.strengths || []),
      keywordsToEmphasize: JSON.stringify(analysis.missingKeywords || []),
      toneGuidance: "professional and engaging",
      coverLetterStrategy: "Lead with the strongest selling point",
    };
    return coverLetterChain.invoke({ resume, jobDescription, candidateName, ...strategy });
  },

  async generateInterviewPrep(resume, jobDescription, analysis = {}) {
    const strategy = {
      coreNarrative: analysis.summary || "",
      topThreeSellingPoints: JSON.stringify(analysis.strengths || []),
      addressRedFlags: JSON.stringify({}),
      interviewStrategy: "Use STAR framework, highlight top strengths",
    };
    const raw = await interviewPrepChain.invoke({ resume, jobDescription, ...strategy });
    return parseJSON(raw);
  },

  async analyzeSkillsGap(resume, jobDescription, analysis = {}) {
    const strategy = {
      keywordsToEmphasize: JSON.stringify(analysis.missingKeywords || []),
      seniorityLevel: "mid",
      skillsGapStrategy: "Prioritize skills that appear in the job description",
    };
    const raw = await skillsGapChain.invoke({ resume, jobDescription, ...strategy });
    return parseJSON(raw);
  },
};
