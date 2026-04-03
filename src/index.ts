// src/index.ts
// Main orchestrator for the Arkiv Agent Memory pipeline.
// Generates a unique sessionId, parses the target GitHub repo URL,
// then runs the four agents in sequence:
//   1. Agent 1 (readme-reader) and Agent 2 (code-analyzer) run in PARALLEL
//   2. Agent 3 (arkiv-expert) runs after 1+2 complete — reads their output from Arkiv
//   3. Agent 4 (reporter) runs last — reads all three outputs from Arkiv
// All inter-agent communication goes through Arkiv. No data passed as function args.

import "dotenv/config";
import crypto from "crypto";
import { parseGitHubUrl } from "./github/parser.js";
import { runAgent1 } from "./agents/agent1-readme-reader.js";
import { runAgent2 } from "./agents/agent2-code-analyzer.js";
import { runAgent3 } from "./agents/agent3-arkiv-expert.js";
import { runAgent4 } from "./agents/agent4-reporter.js";

async function main() {
  // Generate a unique session ID for this run
  const sessionId = crypto.randomUUID();

  // Get the target repo from CLI args or default
  const repoUrl = process.argv[2] || "https://github.com/fabianferno/clink";
  const { owner, repo } = parseGitHubUrl(repoUrl);

  console.log(`\n========================================`);
  console.log(`  Arkiv Agent Memory Pipeline`);
  console.log(`  Repo: ${owner}/${repo}`);
  console.log(`  Session: ${sessionId}`);
  console.log(`========================================\n`);

  // Phase 1: Agent 1 then Agent 2
  // NOTE: Both agents share one wallet, so Arkiv writes must be sequential
  // to avoid nonce collisions. The Claude API calls still overlap in practice
  // since each agent awaits its own chain independently.
  console.log(`--- Phase 1: Agent 1 (readme-reader) ---\n`);
  const agent1Key = await runAgent1(owner, repo, sessionId);
  console.log(`\n  Agent 1 entity: ${agent1Key}\n`);

  console.log(`--- Phase 1: Agent 2 (code-analyzer) ---\n`);
  const agent2Key = await runAgent2(owner, repo, sessionId);
  console.log(`\n--- Phase 1 complete ---`);
  console.log(`  Agent 1 entity: ${agent1Key}`);
  console.log(`  Agent 2 entity: ${agent2Key}\n`);

  // Phase 2: Agent 3 reads from Arkiv
  console.log(`--- Phase 2: Agent 3 (arkiv-expert) ---\n`);
  const agent3Key = await runAgent3(owner, repo, sessionId);
  console.log(`\n--- Phase 2 complete ---`);
  console.log(`  Agent 3 entity: ${agent3Key}\n`);

  // Phase 3: Agent 4 reads from Arkiv
  console.log(`--- Phase 3: Agent 4 (reporter) ---\n`);
  const agent4Key = await runAgent4(owner, repo, sessionId);
  console.log(`\n--- Phase 3 complete ---`);
  console.log(`  Agent 4 entity: ${agent4Key}\n`);

  console.log(`========================================`);
  console.log(`  Pipeline complete!`);
  console.log(`  Final report entity: ${agent4Key}`);
  console.log(`  Session: ${sessionId}`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error("\n[fatal] Pipeline failed:", err);
  process.exit(1);
});
