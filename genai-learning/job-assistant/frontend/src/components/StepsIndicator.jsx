// src/components/StepsIndicator.jsx
const STEPS = [
  { n: 1, label: "Upload Resume" },
  { n: 2, label: "Add Job Description" },
  { n: 3, label: "Get AI Analysis" },
];

export default function StepsIndicator({ session, analysis }) {
  function getStatus(n) {
    if (n === 1) return session ? "done" : "active";
    if (n === 2) return analysis ? "done" : session ? "active" : "pending";
    if (n === 3) return analysis ? "active" : "pending";
    return "pending";
  }

  return (
    <div className="steps-indicator">
      {STEPS.map(({ n, label }) => (
        <div key={n} className={`step-item ${getStatus(n)}`}>
          <div className="step-num">
            {getStatus(n) === "done" ? "✓" : n}
          </div>
          <span className="step-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
