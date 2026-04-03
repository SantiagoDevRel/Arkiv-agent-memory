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

const anthropic = new Anthropic();
const config = getAgentConfig("agent3");

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
 * Runs Agent 3: reads Agent 1 + Agent 2 outputs from Arkiv,
 * evaluates the project's Arkiv usage, and writes the result.
 * Returns the entity key.
 */
export async function runAgent3(
  owner: string,
  repo: string,
  sessionId: string
): Promise<string> {
  console.log(`[agent3] starting — evaluating Arkiv usage for ${owner}/${repo}`);

  // Read Agent 1 output from Arkiv
  console.log(`[agent3] reading readme-summary from Arkiv...`);
  const readmeEntities = await readMemory(publicClient, {
    type: "readme-summary",
    sessionId,
  });

  if (readmeEntities.length === 0) {
    throw new Error("[agent3] No readme-summary found in Arkiv for this session");
  }
  const readmeSummary = readmeEntities[0].toJson();
  console.log(`[agent3] readme-summary loaded`);

  // Read Agent 2 output from Arkiv
  console.log(`[agent3] reading code-analysis from Arkiv...`);
  const codeEntities = await readMemory(publicClient, {
    type: "code-analysis",
    sessionId,
  });

  if (codeEntities.length === 0) {
    throw new Error("[agent3] No code-analysis found in Arkiv for this session");
  }
  const codeAnalysis = codeEntities[0].toJson();
  console.log(`[agent3] code-analysis loaded`);

  // Send both to Claude for Arkiv evaluation
  const userPrompt = `Evaluate this project's Arkiv SDK usage based on these two agent reports. Return JSON only.

README ANALYSIS (from Agent 1):
${JSON.stringify(readmeSummary, null, 2)}

CODE ANALYSIS (from Agent 2):
${JSON.stringify(codeAnalysis, null, 2)}`;

  console.log(`[agent3] sending to Claude for evaluation...`);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    temperature: 0,
    system: config.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  console.log(`[agent3] Claude response received (${responseText.length} chars)`);

  const evaluation = extractJson(responseText);

  // Write to Arkiv
  console.log(`[agent3] writing to Arkiv...`);
  const entityKey = await writeMemory(
    walletClient,
    evaluation,
    { type: "arkiv-evaluation", sessionId, repo: `${owner}/${repo}` },
    TTL_WORKING
  );
  console.log(`[agent3] entity written: ${entityKey}`);

  return entityKey;
}
