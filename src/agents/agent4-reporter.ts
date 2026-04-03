// src/agents/agent4-reporter.ts
// Agent 4: reads all three prior agent outputs from Arkiv, asks Claude
// to synthesize a final report, writes it to Arkiv with TTL_PERSISTENT (30 days).
// Attributes written: { type: "final-report", sessionId, repo }
// Returns the Arkiv entity ID of the written result.

import Anthropic from "@anthropic-ai/sdk";
import { publicClient, walletClient } from "../arkiv/client";
import { readMemory, writeMemory, TTL_PERSISTENT } from "../arkiv/memory";
import { getAgentConfig } from "../config/agents";

const anthropic = new Anthropic();
const config = getAgentConfig("agent4");

/**
 * Extracts JSON from a string that may be wrapped in markdown code fences.
 */
function extractJson(text: string): object {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch { /* fall through */ }
    }
    return { raw: text };
  }
}

/**
 * Runs Agent 4: reads all prior agent results from Arkiv,
 * synthesizes a final report, and writes it with persistent TTL.
 * Returns the entity key.
 */
export async function runAgent4(
  owner: string,
  repo: string,
  sessionId: string
): Promise<string> {
  console.log(`[agent4] starting — generating final report for ${owner}/${repo}`);

  // Read all three agent outputs from Arkiv
  console.log(`[agent4] reading readme-summary from Arkiv...`);
  const readmeEntities = await readMemory(publicClient, {
    type: "readme-summary",
    sessionId,
  });
  const readmeSummary = readmeEntities.length > 0 ? readmeEntities[0].toJson() : null;

  console.log(`[agent4] reading code-analysis from Arkiv...`);
  const codeEntities = await readMemory(publicClient, {
    type: "code-analysis",
    sessionId,
  });
  const codeAnalysis = codeEntities.length > 0 ? codeEntities[0].toJson() : null;

  console.log(`[agent4] reading arkiv-evaluation from Arkiv...`);
  const evalEntities = await readMemory(publicClient, {
    type: "arkiv-evaluation",
    sessionId,
  });
  const arkivEvaluation = evalEntities.length > 0 ? evalEntities[0].toJson() : null;

  if (!readmeSummary || !codeAnalysis || !arkivEvaluation) {
    const missing = [
      !readmeSummary && "readme-summary",
      !codeAnalysis && "code-analysis",
      !arkivEvaluation && "arkiv-evaluation",
    ].filter(Boolean);
    throw new Error(`[agent4] Missing agent outputs: ${missing.join(", ")}`);
  }

  // Send all three to Claude for final synthesis
  const userPrompt = `Synthesize these three agent reports into a final developer report. Return JSON only.

README ANALYSIS (Agent 1):
${JSON.stringify(readmeSummary, null, 2)}

CODE ANALYSIS (Agent 2):
${JSON.stringify(codeAnalysis, null, 2)}

ARKIV EVALUATION (Agent 3):
${JSON.stringify(arkivEvaluation, null, 2)}`;

  console.log(`[agent4] sending to Claude for synthesis...`);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    temperature: 0,
    system: config.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  console.log(`[agent4] Claude response received (${responseText.length} chars)`);

  const report = extractJson(responseText);

  // Write to Arkiv with PERSISTENT TTL (30 days)
  console.log(`[agent4] writing final report to Arkiv (TTL: 30 days)...`);
  const entityKey = await writeMemory(
    walletClient,
    report,
    { type: "final-report", sessionId, repo: `${owner}/${repo}` },
    TTL_PERSISTENT
  );
  console.log(`[agent4] entity written: ${entityKey}`);

  return entityKey;
}
