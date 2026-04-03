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
import type { AgentEvent } from "../index";

const anthropic = new Anthropic();
const config = getAgentConfig("agent1");

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

export async function runAgent1(
  owner: string,
  repo: string,
  sessionId: string,
  onEvent: Emit = noop
): Promise<{ entityKey: string; txHash: string }> {
  const log = (message: string, opts?: { highlight?: boolean; success?: boolean }) =>
    onEvent({ type: "agent-log", agentId: "agent1", message, ...opts });

  log("Fetching README from GitHub API...");
  const readme = await fetchReadme(owner, repo);
  log(`README fetched \u00b7 ${readme.length} characters`);

  log("Sending to Claude for analysis...");
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    temperature: 0,
    system: config.systemPrompt,
    messages: [{ role: "user", content: `Analyze this README and return JSON only:\n\n${readme}` }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  log("Claude responded \u00b7 parsing JSON...");

  const analysis = extractJson(responseText) as Record<string, unknown>;
  log(`Project: ${analysis.name || "unknown"}`);
  log(`Goal: ${typeof analysis.goal === "string" ? analysis.goal.slice(0, 80) : "N/A"}`);
  log(`Uses Arkiv SDK: ${analysis.usesArkiv ? "yes" : "no"}`);
  if (Array.isArray(analysis.techStack)) {
    log(`Tech stack: ${analysis.techStack.join(", ")}`);
  }

  log("Writing entity to Arkiv \u00b7 TTL 5 minutes...");
  const { entityKey, txHash } = await writeMemory(
    walletClient,
    analysis,
    { type: "readme-summary", sessionId, repo: `${owner}/${repo}` },
    TTL_WORKING
  );
  log(`Entity written \u00b7 ${entityKey.slice(0, 10)}...`, { highlight: true, success: true });

  return { entityKey, txHash };
}
