// src/agents/agent3-arkiv-expert.ts
// Agent 3: reads Agent 1 and Agent 2 results from Arkiv, asks Claude
// to evaluate the project's Arkiv SDK usage, writes the evaluation
// to Arkiv with TTL_WORKING.
// Attributes written: { type: "arkiv-evaluation", sessionId, repo }
// Returns the Arkiv entity ID of the written result.

import Anthropic from "@anthropic-ai/sdk";
import { publicClient, walletClient } from "../arkiv/client";
import { readMemory, writeMemory, TTL_WORKING } from "../arkiv/memory";
import { getAgentConfig } from "../config/agents";
import { getArkivSDKDocs } from "../arkiv/sdk-docs";
import type { AgentEvent } from "../index";

const anthropic = new Anthropic();
const config = getAgentConfig("agent3");

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

export async function runAgent3(
  owner: string,
  repo: string,
  sessionId: string,
  onEvent: Emit = noop
): Promise<{ entityKey: string; txHash: string }> {
  const log = (message: string, opts?: { highlight?: boolean; success?: boolean }) =>
    onEvent({ type: "agent-log", agentId: "agent3", message, ...opts });

  log("Querying Arkiv for README analysis...");
  const readmeEntities = await readMemory(publicClient, { type: "readme-summary", sessionId });
  if (readmeEntities.length === 0) throw new Error("[agent3] No readme-summary found");
  const readmeSummary = readmeEntities[0].toJson();
  log(`README analysis retrieved \u00b7 session ${sessionId.slice(0, 8)}`);

  log("Querying Arkiv for code analysis...");
  const codeEntities = await readMemory(publicClient, { type: "code-analysis", sessionId });
  if (codeEntities.length === 0) throw new Error("[agent3] No code-analysis found");
  const codeAnalysis = codeEntities[0].toJson() as Record<string, unknown>;
  const fileCount = (codeAnalysis.fileCount as number) || "?";
  log(`Code analysis retrieved \u00b7 ${fileCount} files analyzed`);

  log("Loading Arkiv SDK expert knowledge...");
  const docs = getArkivSDKDocs();
  log(`Expert knowledge loaded \u00b7 ${docs.length} characters`);

  const userPrompt = `Evaluate this project's Arkiv SDK usage based on these two agent reports and the expert knowledge provided. Return JSON only.

=== ARKIV SDK EXPERT KNOWLEDGE ===
${docs}

=== README ANALYSIS (from Agent 1) ===
${JSON.stringify(readmeSummary, null, 2)}

=== CODE ANALYSIS (from Agent 2) ===
${JSON.stringify(codeAnalysis, null, 2)}`;

  log("Evaluating SDK usage against complete feature list...");
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    temperature: 0,
    system: config.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  log("Claude responded \u00b7 parsing evaluation...");

  const evaluation = extractJson(responseText) as Record<string, unknown>;
  log(`Fit score: ${evaluation.fitScore ?? "?"}/10`);
  log(`Features used: ${Array.isArray(evaluation.featuresUsed) ? evaluation.featuresUsed.length : 0}`);
  log(`Features missed: ${Array.isArray(evaluation.featuresMissed) ? evaluation.featuresMissed.length : 0}`);
  log(`Confidence: ${evaluation.confidence || "N/A"}`);

  log("Writing Arkiv signal \u00b7 TTL 5 minutes...");
  const { entityKey, txHash } = await writeMemory(
    walletClient,
    evaluation,
    { type: "arkiv-evaluation", sessionId, repo: `${owner}/${repo}` },
    TTL_WORKING
  );
  log(`Signal written \u00b7 ${entityKey.slice(0, 10)}...`, { highlight: true, success: true });

  return { entityKey, txHash };
}
