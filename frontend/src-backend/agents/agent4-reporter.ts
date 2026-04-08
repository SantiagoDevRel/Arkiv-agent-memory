// src/agents/agent4-reporter.ts
// Agent 4: reads all three prior agent outputs from Arkiv, asks Claude
// to synthesize a final report, writes it to Arkiv with TTL_PERSISTENT (30 days).
// Attributes written: { type: "final-report", sessionId, repo }
// Returns the Arkiv entity ID of the written result.

import Anthropic from "@anthropic-ai/sdk";
import { publicClient, walletClient } from "../arkiv/client";
import { readMemory, writeMemory, TTL_PERSISTENT } from "../arkiv/memory";
import { getAgentConfig } from "../config/agents";
import type { AgentEvent } from "../index";

const anthropic = new Anthropic();
const config = getAgentConfig("agent4");

function extractJson(text: string): object {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch { /* */ }
    }
    return { raw: text };
  }
}

type Emit = (event: AgentEvent) => void;
const noop: Emit = () => {};

export async function runAgent4(
  owner: string,
  repo: string,
  sessionId: string,
  onEvent: Emit = noop
): Promise<{ entityKey: string; txHash: string }> {
  const log = (message: string, opts?: { highlight?: boolean; success?: boolean }) =>
    onEvent({ type: "agent-log", agentId: "agent4", message, ...opts });

  log("Querying Arkiv for all session data...");

  const readmeEntities = await readMemory(publicClient, { type: "readme-summary", sessionId });
  const readmeSummary = readmeEntities.length > 0 ? readmeEntities[0].toJson() : null;
  if (readmeEntities.length > 0) log(`Found: readme-summary \u00b7 ${readmeEntities[0].key.slice(0, 10)}`);

  const codeEntities = await readMemory(publicClient, { type: "code-analysis", sessionId });
  const codeAnalysis = codeEntities.length > 0 ? codeEntities[0].toJson() : null;
  if (codeEntities.length > 0) log(`Found: code-analysis \u00b7 ${codeEntities[0].key.slice(0, 10)}`);

  const evalEntities = await readMemory(publicClient, { type: "arkiv-evaluation", sessionId });
  const arkivEvaluation = evalEntities.length > 0 ? evalEntities[0].toJson() : null;
  if (evalEntities.length > 0) log(`Found: arkiv-signal \u00b7 ${evalEntities[0].key.slice(0, 10)}`);

  if (!readmeSummary || !codeAnalysis || !arkivEvaluation) {
    const missing = [
      !readmeSummary && "readme-summary",
      !codeAnalysis && "code-analysis",
      !arkivEvaluation && "arkiv-evaluation",
    ].filter(Boolean);
    throw new Error(`[agent4] Missing agent outputs: ${missing.join(", ")}`);
  }

  const userPrompt = `Synthesize these three agent reports into a final developer report. Return JSON only.

README ANALYSIS (Agent 1):
${JSON.stringify(readmeSummary, null, 2)}

CODE ANALYSIS (Agent 2):
${JSON.stringify(codeAnalysis, null, 2)}

ARKIV EVALUATION (Agent 3):
${JSON.stringify(arkivEvaluation, null, 2)}`;

  log("Synthesizing findings into final report...");
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    temperature: 0,
    system: config.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  log("Claude responded \u00b7 parsing report...");

  const report = extractJson(responseText) as Record<string, unknown>;
  log(`Project: ${report.projectName || "unknown"}`);
  log(`Final Arkiv fit score: ${report.arkivFitScore ?? "?"}/10`);
  log(`${Array.isArray(report.recommendations) ? report.recommendations.length : 0} recommendations generated`);

  const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  log("Writing final report \u00b7 TTL 30 days (persistent)...");
  const { entityKey, txHash } = await writeMemory(
    walletClient,
    report,
    { type: "final-report", sessionId, repo: `${owner}/${repo}` },
    TTL_PERSISTENT
  );
  log(`Report written to Arkiv \u00b7 persists until ${expiryDate}`, { highlight: true, success: true });

  return { entityKey, txHash };
}
