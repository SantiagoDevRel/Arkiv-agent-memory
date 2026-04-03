// src/agents/agent1-readme-reader.ts
// Agent 1: reads the GitHub README, sends it to Claude for analysis,
// writes the structured result to Arkiv with TTL_WORKING (5 minutes).
// Attributes written: { type: "readme-summary", sessionId, repo }
// Returns the Arkiv entity ID of the written result.

import Anthropic from "@anthropic-ai/sdk";
import { walletClient } from "../arkiv/client";
import { writeMemory, TTL_WORKING } from "../arkiv/memory";
import { fetchReadme } from "../github/fetcher";
import { getAgentConfig } from "../config/agents";

const anthropic = new Anthropic();
const config = getAgentConfig("agent1");

/**
 * Extracts JSON from a string that may be wrapped in markdown code fences.
 */
function extractJson(text: string): object {
  // Try raw parse first
  try {
    return JSON.parse(text);
  } catch {
    // Strip markdown code fences and retry
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
 * Runs Agent 1: fetches the README, asks Claude to analyze it,
 * and writes the result to Arkiv. Returns the entity key.
 */
export async function runAgent1(
  owner: string,
  repo: string,
  sessionId: string
): Promise<string> {
  console.log(`[agent1] starting — analyzing README for ${owner}/${repo}`);

  // Fetch the README from GitHub
  console.log(`[agent1] fetching README...`);
  const readme = await fetchReadme(owner, repo);
  console.log(`[agent1] README fetched: ${readme.length} chars`);

  // Send to Claude for analysis
  console.log(`[agent1] sending to Claude for analysis...`);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    temperature: 0,
    system: config.systemPrompt,
    messages: [
      {
        role: "user",
        content: `Analyze this README and return JSON only:\n\n${readme}`,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  console.log(`[agent1] Claude response received (${responseText.length} chars)`);

  const analysis = extractJson(responseText);

  // Write to Arkiv
  console.log(`[agent1] writing to Arkiv...`);
  const entityKey = await writeMemory(
    walletClient,
    analysis,
    { type: "readme-summary", sessionId, repo: `${owner}/${repo}` },
    TTL_WORKING
  );
  console.log(`[agent1] entity written: ${entityKey}`);

  return entityKey;
}
