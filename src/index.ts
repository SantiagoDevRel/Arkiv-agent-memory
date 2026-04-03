// src/index.ts
// Main orchestrator for the Arkiv Agent Memory pipeline.
// Exports runPipeline() for programmatic use (API routes) and runs as CLI when executed directly.
// Generates a unique sessionId, parses the target GitHub repo URL,
// then runs the four agents in sequence:
//   1. Agent 1 (readme-reader) then Agent 2 (code-analyzer) — sequential to avoid nonce collision
//   2. Agent 3 (arkiv-expert) — reads Agent 1+2 output from Arkiv
//   3. Agent 4 (reporter) — reads all three outputs from Arkiv
// All inter-agent communication goes through Arkiv. No data passed as function args.

import "dotenv/config";
import crypto from "crypto";
import { parseGitHubUrl } from "./github/parser";
import { runAgent1 } from "./agents/agent1-readme-reader";
import { runAgent2 } from "./agents/agent2-code-analyzer";
import { runAgent3 } from "./agents/agent3-arkiv-expert";
import { runAgent4 } from "./agents/agent4-reporter";
import { publicClient } from "./arkiv/client";
import { readMemory } from "./arkiv/memory";

export type AgentEvent = {
  type: "agent-start" | "agent-log" | "agent-done" | "pipeline-done" | "error";
  agentId?: string;
  message?: string;
  entityId?: string;
  txHash?: string;
  payload?: object;
  report?: object;
  sessionId?: string;
};

type OnEvent = (event: AgentEvent) => void;

/**
 * Runs the full 4-agent pipeline and emits events for each stage.
 * The onEvent callback is optional — when omitted, events go to console.log.
 */
export async function runPipeline(repoUrl: string, onEvent?: OnEvent) {
  const emit = onEvent || ((e: AgentEvent) => console.log(`[pipeline] ${e.type}:`, e.message || ""));
  const sessionId = crypto.randomUUID();
  const { owner, repo } = parseGitHubUrl(repoUrl);

  emit({ type: "agent-log", message: `Session: ${sessionId} | Repo: ${owner}/${repo}`, sessionId });

  // Agent 1
  emit({ type: "agent-start", agentId: "agent1", message: "Starting README analysis..." });
  const agent1 = await runAgent1(owner, repo, sessionId);
  const agent1Entities = await readMemory(publicClient, { type: "readme-summary", sessionId });
  const agent1Payload = agent1Entities.length > 0 ? agent1Entities[0].toJson() : {};
  emit({ type: "agent-done", agentId: "agent1", entityId: agent1.entityKey, txHash: agent1.txHash, payload: agent1Payload, message: "README analysis complete" });

  // Agent 2
  emit({ type: "agent-start", agentId: "agent2", message: "Starting code analysis..." });
  const agent2 = await runAgent2(owner, repo, sessionId);
  const agent2Entities = await readMemory(publicClient, { type: "code-analysis", sessionId });
  const agent2Payload = agent2Entities.length > 0 ? agent2Entities[0].toJson() : {};
  emit({ type: "agent-done", agentId: "agent2", entityId: agent2.entityKey, txHash: agent2.txHash, payload: agent2Payload, message: "Code analysis complete" });

  // Agent 3
  emit({ type: "agent-start", agentId: "agent3", message: "Starting Arkiv evaluation..." });
  const agent3 = await runAgent3(owner, repo, sessionId);
  const agent3Entities = await readMemory(publicClient, { type: "arkiv-evaluation", sessionId });
  const agent3Payload = agent3Entities.length > 0 ? agent3Entities[0].toJson() : {};
  emit({ type: "agent-done", agentId: "agent3", entityId: agent3.entityKey, txHash: agent3.txHash, payload: agent3Payload, message: "Arkiv evaluation complete" });

  // Agent 4
  emit({ type: "agent-start", agentId: "agent4", message: "Generating final report..." });
  const agent4 = await runAgent4(owner, repo, sessionId);
  const agent4Entities = await readMemory(publicClient, { type: "final-report", sessionId });
  const agent4Payload = agent4Entities.length > 0 ? agent4Entities[0].toJson() : {};
  emit({ type: "agent-done", agentId: "agent4", entityId: agent4.entityKey, txHash: agent4.txHash, payload: agent4Payload, message: "Final report generated" });

  emit({ type: "pipeline-done", report: agent4Payload, entityId: agent4.entityKey, txHash: agent4.txHash, sessionId, message: "Pipeline complete!" });

  return { sessionId, reportEntityId: agent4.entityKey, report: agent4Payload };
}

// CLI entry point — only runs when executed directly (not imported)
const isCliRun = process.argv[1]?.includes("index");
if (isCliRun) {
  const repoUrl = process.argv[2] || "https://github.com/fabianferno/clink";

  console.log(`\n========================================`);
  console.log(`  Arkiv Agent Memory Pipeline`);
  console.log(`========================================\n`);

  runPipeline(repoUrl)
    .then((result) => {
      console.log(`\n========================================`);
      console.log(`  Pipeline complete!`);
      console.log(`  Final report entity: ${result.reportEntityId}`);
      console.log(`  Session: ${result.sessionId}`);
      console.log(`========================================\n`);
    })
    .catch((err) => {
      console.error("\n[fatal] Pipeline failed:", err);
      process.exit(1);
    });
}
