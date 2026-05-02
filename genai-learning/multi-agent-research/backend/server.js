// server.js — Multi-Agent Research System
import express from "express";
import cors from "cors";
import { config } from "./src/config/index.js";
import researchRoutes from "./src/routes/research.js";

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.use((req, res, next) => { console.log(`${req.method} ${req.path}`); next(); });

app.get("/api/health", (req, res) => res.json({ status: "ok", system: "Multi-Agent Research", port: config.port }));
app.use("/api/research", researchRoutes);

app.listen(config.port, () => {
  console.log(`\n🤖 Multi-Agent Research System: http://localhost:${config.port}`);
  console.log(`\nAgents:`);
  console.log(`  1. Planner Agent   — breaks topic into subtopics`);
  console.log(`  2. Search Agents   — parallel web search (one per subtopic)`);
  console.log(`  3. Analyst Agent   — synthesizes all findings`);
  console.log(`  4. Writer Agent    — writes the report`);
  console.log(`  5. Critic Agent    — reviews and improves\n`);
});
