// src/services/aiService.js — All AI logic in one service
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { config } from "../config/index.js";

// Initialize model once (singleton)
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash-lite",
  apiKey: config.geminiApiKey,
  temperature: 0.3,
});

const parser = new StringOutputParser();

// ── Helper: build a chain ──
function buildChain(systemPrompt, humanPrompt) {
  return RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", humanPrompt],
    ]),
    model,
    parser,
  ]);
}

// ── Helper: parse JSON from LLM response ──
function parseJSON(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { raw: text };
  } catch {
    return { raw: text };
  }
}

// ─────────────────────────────────────────────
// 1. Match Analysis
// ─────────────────────────────────────────────
const matchChain = buildChain(
  `You are an expert ATS (Applicant Tracking System) and career coach.
Analyze the match between a resume and job description.
Be specific, honest, and actionable. Return ONLY valid JSON.`,
  `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

Return this exact JSON:
{{
  "matchScore": <number 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "missingKeywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"],
  "recommendation": "<one clear recommendation>"
}}`
);

// ─────────────────────────────────────────────
// 2. Resume Rewriter
// ─────────────────────────────────────────────
const rewriteChain = buildChain(
  `You are an expert resume writer specializing in tailoring resumes for specific job descriptions.
Use strong action verbs, quantify achievements, and incorporate relevant keywords.
Return ONLY the rewritten resume in clean markdown format.`,
  `ORIGINAL RESUME:
{resume}

TARGET JOB DESCRIPTION:
{jobDescription}

MATCH ANALYSIS GAPS:
{gaps}

MISSING KEYWORDS TO ADD:
{missingKeywords}

Rewrite the resume to better match this job. Improve:
1. Summary/objective to align with the role
2. Bullet points to use keywords from the job description
3. Skills section to highlight relevant technologies
4. Quantify achievements where possible`
);

// ─────────────────────────────────────────────
// 3. Cover Letter Generator
// ─────────────────────────────────────────────
const coverLetterChain = buildChain(
  `You are an expert cover letter writer.
Write compelling, personalized cover letters that get interviews.
Be professional but show personality. Keep it to 3-4 paragraphs.`,
  `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

CANDIDATE NAME: {candidateName}

Write a professional cover letter:
- Opening: Hook with enthusiasm and the specific role
- Body 1: Highlight 2-3 most relevant experiences/skills
- Body 2: Show knowledge of the company/role and why you're excited
- Closing: Call to action

Return ONLY the cover letter text.`
);

// ─────────────────────────────────────────────
// 4. Interview Prep
// ─────────────────────────────────────────────
const interviewChain = buildChain(
  `You are an expert interview coach.
Generate likely interview questions and strong answer frameworks.
Return ONLY valid JSON.`,
  `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

Generate 5 likely interview questions with answer frameworks.
Return this exact JSON:
{{
  "questions": [
    {{
      "question": "<interview question>",
      "type": "<behavioral|technical|situational>",
      "why": "<why they ask this>",
      "framework": "<STAR|CAR|other>",
      "keyPoints": ["<point 1>", "<point 2>", "<point 3>"]
    }}
  ]
}}`
);

// ─────────────────────────────────────────────
// 5. Skills Gap Analysis
// ─────────────────────────────────────────────
const skillsGapChain = buildChain(
  `You are a technical skills assessor.
Analyze the skills gap between a candidate's resume and a job description.
Return ONLY valid JSON.`,
  `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

Analyze skills gap and return this exact JSON:
{{
  "hasSkills": ["<skill the candidate has>"],
  "missingSkills": ["<skill they need to learn>"],
  "niceToHave": ["<optional skills>"],
  "learningPlan": [
    {{
      "skill": "<skill name>",
      "priority": "<high|medium|low>",
      "timeToLearn": "<estimated time>",
      "resources": ["<resource 1>", "<resource 2>"]
    }}
  ]
}}`
);

// ─────────────────────────────────────────────
// Exported service functions
// ─────────────────────────────────────────────
export const aiService = {
  async analyzeMatch(resume, jobDescription) {
    const result = await matchChain.invoke({ resume, jobDescription });
    return parseJSON(result);
  },

  async rewriteResume(resume, jobDescription, analysis) {
    return rewriteChain.invoke({
      resume,
      jobDescription,
      gaps: analysis.gaps?.join(", ") || "none identified",
      missingKeywords: analysis.missingKeywords?.join(", ") || "none identified",
    });
  },

  async streamRewrite(resume, jobDescription, analysis, onChunk) {
    const stream = await rewriteChain.stream({
      resume,
      jobDescription,
      gaps: analysis.gaps?.join(", ") || "none identified",
      missingKeywords: analysis.missingKeywords?.join(", ") || "none identified",
    });
    let full = "";
    for await (const chunk of stream) {
      full += chunk;
      onChunk(chunk);
    }
    return full;
  },

  async generateCoverLetter(resume, jobDescription, candidateName) {
    return coverLetterChain.invoke({ resume, jobDescription, candidateName });
  },

  async generateInterviewPrep(resume, jobDescription) {
    const result = await interviewChain.invoke({ resume, jobDescription });
    return parseJSON(result);
  },

  async analyzeSkillsGap(resume, jobDescription) {
    const result = await skillsGapChain.invoke({ resume, jobDescription });
    return parseJSON(result);
  },
};
