// analyzer.js — Core AI analysis logic
// Combines RAG (resume reading) + LangChain (analysis chains)

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

export function createAnalyzer(apiKey) {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash-lite",
    apiKey,
    temperature: 0.3,
  });

  const parser = new StringOutputParser();

  // ── Chain 1: Match Analysis ──
  const matchChain = RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      ["system", `You are an expert ATS (Applicant Tracking System) and career coach.
Analyze the match between a resume and job description.
Be specific, honest, and actionable.`],
      ["human", `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

Provide a detailed match analysis in this exact JSON format:
{{
  "matchScore": <number 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "missingKeywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"],
  "recommendation": "<one clear recommendation>"
}}`],
    ]),
    model,
    parser,
  ]);

  // ── Chain 2: Resume Rewriter ──
  const rewriteChain = RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      ["system", `You are an expert resume writer who specializes in tailoring resumes for specific job descriptions.
Rewrite resume bullet points to better match the job requirements.
Use strong action verbs, quantify achievements where possible, and incorporate relevant keywords.`],
      ["human", `ORIGINAL RESUME:
{resume}

TARGET JOB DESCRIPTION:
{jobDescription}

MATCH ANALYSIS:
{analysis}

Rewrite the resume to better match this job. Return ONLY the rewritten resume content in clean markdown format.
Keep the same structure but improve:
1. Bullet points to use keywords from the job description
2. Skills section to highlight relevant technologies
3. Summary/objective to align with the role
4. Quantify achievements where possible`],
    ]),
    model,
    parser,
  ]);

  // ── Chain 3: Cover Letter Generator ──
  const coverLetterChain = RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      ["system", `You are an expert cover letter writer.
Write compelling, personalized cover letters that get interviews.
Be professional but show personality. Keep it to 3-4 paragraphs.`],
      ["human", `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

CANDIDATE NAME: {candidateName}

Write a professional cover letter for this application. 
- Opening: Hook with enthusiasm and the specific role
- Body 1: Highlight 2-3 most relevant experiences/skills
- Body 2: Show knowledge of the company/role and why you're excited
- Closing: Call to action

Return ONLY the cover letter text, no extra commentary.`],
    ]),
    model,
    parser,
  ]);

  // ── Chain 4: Interview Prep ──
  const interviewPrepChain = RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      ["system", `You are an expert interview coach.
Generate likely interview questions and strong answers based on the resume and job description.`],
      ["human", `RESUME:
{resume}

JOB DESCRIPTION:
{jobDescription}

Generate 5 likely interview questions for this role with strong answer frameworks.
Format as JSON:
{{
  "questions": [
    {{
      "question": "<interview question>",
      "why": "<why they ask this>",
      "answerFramework": "<STAR or other framework to use>",
      "keyPoints": ["<point 1>", "<point 2>", "<point 3>"]
    }}
  ]
}}`],
    ]),
    model,
    parser,
  ]);

  return {
    async analyzeMatch(resume, jobDescription) {
      const result = await matchChain.invoke({ resume, jobDescription });
      try {
        // Extract JSON from response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result };
      } catch {
        return { raw: result };
      }
    },

    async rewriteResume(resume, jobDescription, analysis) {
      return rewriteChain.invoke({
        resume,
        jobDescription,
        analysis: JSON.stringify(analysis),
      });
    },

    async generateCoverLetter(resume, jobDescription, candidateName) {
      return coverLetterChain.invoke({ resume, jobDescription, candidateName });
    },

    async generateInterviewPrep(resume, jobDescription) {
      const result = await interviewPrepChain.invoke({ resume, jobDescription });
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result };
      } catch {
        return { raw: result };
      }
    },

    // Stream rewrite for real-time UI
    async streamRewrite(resume, jobDescription, analysis, onChunk) {
      const stream = await rewriteChain.stream({
        resume,
        jobDescription,
        analysis: JSON.stringify(analysis),
      });
      let full = "";
      for await (const chunk of stream) {
        full += chunk;
        onChunk(chunk);
      }
      return full;
    },
  };
}
