// src/agents/agent5-tracker-pusher.ts
// Agent 5: ETHLisbon Tracker Pusher.
// Reads the final report from Agent 4, formats a tracker-row, writes a
// "tracker-row" entity to Arkiv (TTL persistent, 30d) AND optionally POSTs
// to a Supabase URL if TRACKER_API_URL env var is set.
//
// This is the dogfooding moment: we judge Arkiv apps using Arkiv as the
// source of truth for the public tracker dashboard.
//
// Attributes written: { type: "tracker-row", sessionId, repo, total }

import Anthropic from "@anthropic-ai/sdk";
import { publicClient, walletClient } from "../arkiv/client";
import { readMemory, writeMemory, TTL_PERSISTENT } from "../arkiv/memory";
import { getAgentConfig } from "../config/agents";
import type { AgentEvent } from "../index";

const anthropic = new Anthropic();
const config = getAgentConfig("agent5");

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

export async function runAgent5(
  owner: string,
  repo: string,
  sessionId: string,
  onEvent: Emit = noop
): Promise<{ entityKey: string; txHash: string; pushedToApi: boolean }> {
  const log = (message: string, opts?: { highlight?: boolean; success?: boolean }) =>
    onEvent({ type: "agent-log", agentId: "agent5", message, ...opts });

  log("Reading final report from Arkiv...");
  const finalEntities = await readMemory(publicClient, { type: "final-report", sessionId });
  if (finalEntities.length === 0) {
    throw new Error("[agent5] No final-report found");
  }
  const finalReport = finalEntities[0].toJson() as Record<string, unknown>;
  log(`Final report retrieved · session ${sessionId.slice(0, 8)}`);

  const userPrompt = `Format this final report into a single tracker-row JSON for the public dashboard. Set judgedAt to "${new Date().toISOString()}". Return JSON only.

FINAL REPORT (Agent 4):
${JSON.stringify(finalReport, null, 2)}

REPO: ${owner}/${repo}`;

  log("Formatting tracker row...");
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    temperature: 0,
    system: config.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const trackerRow = extractJson(responseText) as Record<string, unknown>;
  log(`Row formatted · team: ${trackerRow.team || "?"} · total: ${trackerRow.total ?? "?"}/100`);

  // Step 1 — write to Arkiv (immutable source of truth, 30d TTL)
  log("Writing tracker-row to Arkiv · TTL 30 days (persistent)...");
  const { entityKey, txHash } = await writeMemory(
    walletClient,
    trackerRow,
    { type: "tracker-row", sessionId, repo: `${owner}/${repo}`, total: String(trackerRow.total ?? 0) },
    TTL_PERSISTENT
  );
  log(`Tracker row written to Arkiv · ${entityKey.slice(0, 10)}...`, { highlight: true, success: true });

  // Step 2 — optionally POST to Supabase / external tracker API (if configured)
  const apiUrl = process.env.TRACKER_API_URL;
  let pushedToApi = false;
  if (apiUrl) {
    log(`Pushing to tracker API · ${apiUrl}...`);
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.TRACKER_API_KEY || ""}`,
        },
        body: JSON.stringify({
          ...trackerRow,
          arkivEntityKey: entityKey,
          arkivTxHash: txHash,
        }),
      });
      if (res.ok) {
        log(`Pushed to tracker API · status ${res.status}`, { success: true });
        pushedToApi = true;
      } else {
        log(`Tracker API responded ${res.status} · row is still live in Arkiv`, { highlight: true });
      }
    } catch (err) {
      log(`Tracker API push failed · row is still live in Arkiv (${(err as Error).message})`, { highlight: true });
    }
  } else {
    log("No TRACKER_API_URL set · skipping external push (Arkiv entity is the source of truth)");
  }

  return { entityKey, txHash, pushedToApi };
}
