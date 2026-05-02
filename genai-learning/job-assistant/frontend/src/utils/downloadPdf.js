// src/utils/downloadPdf.js — PDF generation utility using jsPDF
import { jsPDF } from "jspdf";

// ── Color palette ──
const COLORS = {
  primary: [99, 102, 241],    // indigo
  dark: [15, 15, 24],
  heading: [241, 245, 249],
  body: [148, 163, 184],
  accent: [129, 140, 248],
  border: [30, 30, 46],
  green: [74, 222, 128],
  red: [248, 113, 113],
  yellow: [251, 191, 36],
};

// ── Base PDF setup ──
function createPDF() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica");
  return doc;
}

// ── Draw header band ──
function drawHeader(doc, title, subtitle) {
  // Background band
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 210, 28, "F");

  // Title
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 12);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 210, 255);
  doc.text(subtitle, 14, 20);

  // Generated date
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  doc.setFontSize(8);
  doc.setTextColor(200, 210, 255);
  doc.text(`Generated: ${date}`, 196, 20, { align: "right" });

  return 36; // return Y position after header
}

// ── Draw section heading ──
function drawSection(doc, title, y) {
  doc.setFillColor(...COLORS.primary);
  doc.rect(14, y, 3, 6, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.heading);
  doc.text(title, 20, y + 5);
  return y + 12;
}

// ── Draw wrapped text ──
function drawText(doc, text, x, y, maxWidth = 182, fontSize = 9, color = COLORS.body) {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * (fontSize * 0.45);
}

// ── Draw tag/chip ──
function drawTag(doc, text, x, y, color = COLORS.primary) {
  const w = doc.getTextWidth(text) + 6;
  doc.setFillColor(color[0], color[1], color[2], 0.15);
  doc.setDrawColor(...color);
  doc.roundedRect(x, y - 4, w, 6, 1, 1, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...color);
  doc.text(text, x + 3, y);
  return x + w + 3;
}

// ── Page break check ──
function checkPageBreak(doc, y, needed = 20) {
  if (y + needed > 280) {
    doc.addPage();
    return 20;
  }
  return y;
}

// ─────────────────────────────────────────────
// 1. Download Analysis Report PDF
// ─────────────────────────────────────────────
export function downloadAnalysisPDF(analysis, fileName = "match-analysis") {
  const doc = createPDF();
  let y = drawHeader(doc, "Resume Match Analysis", "AI-powered job compatibility report");

  // Score box
  const score = analysis.matchScore || 0;
  const scoreColor = score >= 70 ? COLORS.green : score >= 40 ? COLORS.yellow : COLORS.red;
  doc.setFillColor(20, 20, 35);
  doc.roundedRect(14, y, 182, 22, 3, 3, "F");
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...scoreColor);
  doc.text(`${score}`, 30, y + 15);
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.body);
  doc.text("/ 100  Match Score", 46, y + 15);
  y = drawText(doc, analysis.summary || "", 100, y + 8, 90, 8.5, COLORS.body);
  y = Math.max(y, 36 + 28) + 6;

  // Strengths
  y = checkPageBreak(doc, y);
  y = drawSection(doc, "✓ Strengths", y);
  (analysis.strengths || []).forEach((s) => {
    y = checkPageBreak(doc, y);
    doc.setFillColor(...COLORS.green);
    doc.circle(17, y - 1, 1.2, "F");
    y = drawText(doc, s, 22, y - 2, 174, 9, COLORS.body) + 2;
  });
  y += 4;

  // Gaps
  y = checkPageBreak(doc, y);
  y = drawSection(doc, "⚠ Gaps to Address", y);
  (analysis.gaps || []).forEach((g) => {
    y = checkPageBreak(doc, y);
    doc.setFillColor(...COLORS.red);
    doc.circle(17, y - 1, 1.2, "F");
    y = drawText(doc, g, 22, y - 2, 174, 9, COLORS.body) + 2;
  });
  y += 4;

  // Missing keywords
  y = checkPageBreak(doc, y);
  y = drawSection(doc, "🔑 Missing Keywords", y);
  let tagX = 14;
  (analysis.missingKeywords || []).forEach((k) => {
    if (tagX + doc.getTextWidth(k) + 12 > 196) { tagX = 14; y += 8; }
    y = checkPageBreak(doc, y);
    tagX = drawTag(doc, k, tagX, y, COLORS.yellow);
  });
  y += 12;

  // Recommendation
  if (analysis.recommendation) {
    y = checkPageBreak(doc, y, 30);
    y = drawSection(doc, "💡 Recommendation", y);
    doc.setFillColor(30, 27, 75);
    const recLines = doc.splitTextToSize(analysis.recommendation, 174);
    doc.roundedRect(14, y - 2, 182, recLines.length * 5 + 8, 2, 2, "F");
    y = drawText(doc, analysis.recommendation, 18, y + 4, 174, 9, [199, 210, 254]);
    y += 6;
  }

  doc.save(`${fileName}.pdf`);
}

// ─────────────────────────────────────────────
// 2. Download Rewritten Resume PDF
// ─────────────────────────────────────────────
export function downloadResumePDF(resumeText, candidateName = "Candidate") {
  const doc = createPDF();
  let y = drawHeader(doc, `${candidateName} — Tailored Resume`, "AI-optimized for target job description");

  // Clean markdown and render as plain text
  const clean = resumeText
    .replace(/^#{1,3} (.+)$/gm, (_, t) => `\n${t.toUpperCase()}\n`)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^[-*] /gm, "• ")
    .replace(/---/g, "")
    .trim();

  const sections = clean.split(/\n{2,}/);

  sections.forEach((section) => {
    if (!section.trim()) return;
    y = checkPageBreak(doc, y, 15);

    const lines = section.split("\n");
    lines.forEach((line) => {
      if (!line.trim()) return;
      y = checkPageBreak(doc, y);

      // Section heading (all caps short line)
      if (line === line.toUpperCase() && line.length < 40 && line.length > 2) {
        y += 2;
        doc.setFillColor(...COLORS.primary);
        doc.rect(14, y, 182, 0.5, "F");
        y += 3;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.accent);
        doc.text(line, 14, y);
        y += 6;
      } else {
        y = drawText(doc, line, 14, y, 182, 9, COLORS.body) + 2;
      }
    });
    y += 3;
  });

  doc.save(`${candidateName.replace(/\s+/g, "_")}_Resume.pdf`);
}

// ─────────────────────────────────────────────
// 3. Download Cover Letter PDF
// ─────────────────────────────────────────────
export function downloadCoverLetterPDF(coverLetter, candidateName = "Candidate") {
  const doc = createPDF();
  let y = drawHeader(doc, "Cover Letter", `Prepared by ${candidateName}`);

  // Decorative line
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  y += 8;

  const paragraphs = coverLetter.split(/\n{2,}/);
  paragraphs.forEach((para) => {
    if (!para.trim()) return;
    y = checkPageBreak(doc, y, 20);
    y = drawText(doc, para.trim(), 14, y, 182, 10, [203, 213, 225]) + 6;
  });

  // Signature area
  y = checkPageBreak(doc, y, 30);
  y += 10;
  doc.setDrawColor(...COLORS.border);
  doc.line(14, y, 80, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.accent);
  doc.text(candidateName, 14, y);

  doc.save(`${candidateName.replace(/\s+/g, "_")}_Cover_Letter.pdf`);
}

// ─────────────────────────────────────────────
// 4. Download Interview Prep PDF
// ─────────────────────────────────────────────
export function downloadInterviewPDF(interviewPrep, candidateName = "Candidate") {
  const doc = createPDF();
  let y = drawHeader(doc, "Interview Preparation Guide", `Personalized for ${candidateName}`);

  const questions = interviewPrep?.questions || [];

  questions.forEach((q, i) => {
    y = checkPageBreak(doc, y, 50);

    // Question number box
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(14, y, 8, 8, 1, 1, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`Q${i + 1}`, 16, y + 5.5);

    // Question text
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.heading);
    const qLines = doc.splitTextToSize(q.question, 168);
    doc.text(qLines, 26, y + 5.5);
    y += qLines.length * 5 + 8;

    // Tags
    let tagX = 14;
    if (q.type) tagX = drawTag(doc, q.type, tagX, y, COLORS.accent);
    if (q.framework) tagX = drawTag(doc, q.framework, tagX, y, COLORS.yellow);
    y += 8;

    // Why they ask
    if (q.why) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...COLORS.body);
      y = drawText(doc, `💡 ${q.why}`, 14, y, 182, 8, COLORS.body) + 4;
    }

    // Key points
    if (q.keyPoints?.length) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.accent);
      doc.text("Key Points to Cover:", 14, y);
      y += 5;
      q.keyPoints.forEach((p) => {
        y = checkPageBreak(doc, y);
        doc.setFillColor(...COLORS.primary);
        doc.circle(17, y - 1, 1, "F");
        y = drawText(doc, p, 21, y - 2, 175, 8.5, COLORS.body) + 2;
      });
    }

    // Divider
    y += 4;
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(14, y, 196, y);
    y += 6;
  });

  doc.save(`${candidateName.replace(/\s+/g, "_")}_Interview_Prep.pdf`);
}

// ─────────────────────────────────────────────
// 5. Download Complete Bundle (all in one PDF)
// ─────────────────────────────────────────────
export function downloadCompleteBundlePDF({ analysis, rewrittenResume, coverLetter, interviewPrep, candidateName = "Candidate" }) {
  const doc = createPDF();

  // Cover page
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Job Application", 105, 100, { align: "center" });
  doc.text("Complete Bundle", 105, 115, { align: "center" });
  doc.setFontSize(14);
  doc.setTextColor(200, 210, 255);
  doc.text(candidateName, 105, 135, { align: "center" });
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), 105, 148, { align: "center" });

  // Table of contents
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const toc = ["1. Match Analysis Report", "2. Tailored Resume", "3. Cover Letter", "4. Interview Prep Guide"];
  toc.forEach((item, i) => {
    doc.text(item, 105, 175 + i * 12, { align: "center" });
  });

  // Section 1: Analysis
  if (analysis) {
    doc.addPage();
    let y = drawHeader(doc, "1. Match Analysis Report", "AI-powered job compatibility");
    const score = analysis.matchScore || 0;
    const scoreColor = score >= 70 ? COLORS.green : score >= 40 ? COLORS.yellow : COLORS.red;
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...scoreColor);
    doc.text(`${score}/100`, 14, y + 10);
    y = drawText(doc, analysis.summary || "", 50, y + 5, 146, 9, COLORS.body);
    y = Math.max(y, 36 + 20) + 6;

    y = drawSection(doc, "Strengths", y);
    (analysis.strengths || []).forEach((s) => { y = checkPageBreak(doc, y); y = drawText(doc, `• ${s}`, 14, y, 182, 9, COLORS.body) + 2; });
    y += 4;
    y = drawSection(doc, "Gaps", y);
    (analysis.gaps || []).forEach((g) => { y = checkPageBreak(doc, y); y = drawText(doc, `• ${g}`, 14, y, 182, 9, COLORS.body) + 2; });
    y += 4;
    if (analysis.recommendation) {
      y = drawSection(doc, "Recommendation", y);
      y = drawText(doc, analysis.recommendation, 14, y, 182, 9, [199, 210, 254]);
    }
  }

  // Section 2: Resume
  if (rewrittenResume) {
    doc.addPage();
    let y = drawHeader(doc, "2. Tailored Resume", `Optimized for ${candidateName}`);
    const clean = rewrittenResume.replace(/^#{1,3} (.+)$/gm, (_, t) => `\n${t.toUpperCase()}\n`).replace(/\*\*(.+?)\*\*/g, "$1").replace(/^[-*] /gm, "• ").trim();
    clean.split(/\n{2,}/).forEach((section) => {
      if (!section.trim()) return;
      section.split("\n").forEach((line) => {
        if (!line.trim()) return;
        y = checkPageBreak(doc, y);
        if (line === line.toUpperCase() && line.length < 40 && line.length > 2) {
          y += 2; doc.setFillColor(...COLORS.primary); doc.rect(14, y, 182, 0.5, "F"); y += 3;
          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...COLORS.accent); doc.text(line, 14, y); y += 6;
        } else {
          y = drawText(doc, line, 14, y, 182, 9, COLORS.body) + 2;
        }
      });
      y += 3;
    });
  }

  // Section 3: Cover Letter
  if (coverLetter) {
    doc.addPage();
    let y = drawHeader(doc, "3. Cover Letter", `Prepared by ${candidateName}`);
    coverLetter.split(/\n{2,}/).forEach((para) => {
      if (!para.trim()) return;
      y = checkPageBreak(doc, y, 20);
      y = drawText(doc, para.trim(), 14, y, 182, 10, [203, 213, 225]) + 6;
    });
  }

  // Section 4: Interview Prep
  if (interviewPrep?.questions?.length) {
    doc.addPage();
    let y = drawHeader(doc, "4. Interview Preparation", `Guide for ${candidateName}`);
    interviewPrep.questions.forEach((q, i) => {
      y = checkPageBreak(doc, y, 40);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...COLORS.heading);
      y = drawText(doc, `Q${i + 1}: ${q.question}`, 14, y, 182, 10, COLORS.heading) + 3;
      if (q.why) y = drawText(doc, `💡 ${q.why}`, 14, y, 182, 8, COLORS.body) + 3;
      (q.keyPoints || []).forEach((p) => { y = checkPageBreak(doc, y); y = drawText(doc, `  • ${p}`, 14, y, 182, 8.5, COLORS.body) + 2; });
      y += 6;
    });
  }

  doc.save(`${candidateName.replace(/\s+/g, "_")}_Complete_Bundle.pdf`);
}
