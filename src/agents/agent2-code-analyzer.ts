// src/agents/agent2-code-analyzer.ts
// Agent 2: fetches the file tree and key source files, sends them to Claude
// for code analysis, writes the structured result to Arkiv with TTL_WORKING.
// Attributes written: { type: "code-analysis", sessionId, repo }
// Returns the Arkiv entity ID of the written result.
//
// DX NOTE: The GitHub REST API returns file content as base64-encoded
// strings. Each file fetch is a separate HTTP request. With 8 files
// this means 8 sequential fetch() calls. The SDK has no batch file
// fetch capability. A bulk content endpoint would significantly improve
// agent build time.

import Anthropic from "@anthropic-ai/sdk";
import { walletClient } from "../arkiv/client";
import { writeMemory, TTL_WORKING } from "../arkiv/memory";
import { fetchFileTree, fetchFileContent } from "../github/fetcher";
import { getAgentConfig } from "../config/agents";
import type { AgentEvent } from "../index";

const anthropic = new Anthropic();
const config = getAgentConfig("agent2");

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

const MAX_FILES = 8;
const MAX_FILE_SIZE = 8000;

// Paths that signal Arkiv SDK usage or data-layer code
const ARKIV_SIGNAL_KEYWORDS = [
  "arkiv", "client", "db", "database", "storage",
  "entity", "entities", "memory", "chain", "web3", "contract",
];

// Directories and patterns to skip
const SKIP_PATTERNS = [
  "node_modules/", "dist/", ".next/", "build/", "coverage/",
  "__tests__/", ".test.", ".spec.", ".d.ts",
];

type FileEntry = { path: string; type: string };

/**
 * Priority-based file selection:
 *   P1: package.json (always)
 *   P2: Files whose path contains Arkiv-signal keywords (up to 6)
 *   P3: Source files from src/ then root (fill remaining to MAX_FILES)
 */
function pickKeyFiles(
  tree: FileEntry[],
  log: (msg: string) => void
): string[] {
  const selected: string[] = [];
  const blobs = tree.filter((f) => f.type === "blob");

  const isSkipped = (p: string) => SKIP_PATTERNS.some((s) => p.includes(s));
  const isCode = (p: string) => /\.(ts|tsx|js|jsx|py|sol|rs|go)$/.test(p);

  // Priority 1 — always read package.json
  if (blobs.some((f) => f.path === "package.json")) {
    selected.push("package.json");
    log("priority 1: package.json");
  }

  // Priority 2 — Arkiv-signal files (up to 6)
  const signalFiles = blobs.filter((f) => {
    if (selected.includes(f.path)) return false;
    if (isSkipped(f.path)) return false;
    const lower = f.path.toLowerCase();
    return ARKIV_SIGNAL_KEYWORDS.some((kw) => lower.includes(kw)) && isCode(lower);
  });
  for (const f of signalFiles) {
    if (selected.length >= MAX_FILES || selected.length - 1 >= 6) break; // -1 for package.json
    selected.push(f.path);
    log(`priority 2 (arkiv-signal): ${f.path}`);
  }

  // Priority 3 — remaining source files, src/ first then root
  const remaining = blobs
    .filter((f) => !selected.includes(f.path) && !isSkipped(f.path) && isCode(f.path))
    .sort((a, b) => {
      const aInSrc = a.path.startsWith("src/") ? 0 : 1;
      const bInSrc = b.path.startsWith("src/") ? 0 : 1;
      if (aInSrc !== bInSrc) return aInSrc - bInSrc;
      return a.path.length - b.path.length;
    });

  for (const f of remaining) {
    if (selected.length >= MAX_FILES) break;
    selected.push(f.path);
    log(`priority 3 (source): ${f.path}`);
  }

  log(`total files selected: ${selected.length}`);
  return selected;
}

type Emit = (event: AgentEvent) => void;
const noop: Emit = () => {};

export async function runAgent2(
  owner: string,
  repo: string,
  sessionId: string,
  onEvent: Emit = noop
): Promise<{ entityKey: string; txHash: string }> {
  const log = (message: string, opts?: { highlight?: boolean; success?: boolean }) =>
    onEvent({ type: "agent-log", agentId: "agent2", message, ...opts });

  log("Fetching file tree from GitHub API...");
  const tree = await fetchFileTree(owner, repo);
  log(`File tree fetched \u00b7 ${tree.length} files found`);

  const keyPaths = pickKeyFiles(tree, (msg) => log(msg));

  const fileContents: { path: string; content: string }[] = [];
  for (const path of keyPaths) {
    log(`Reading: ${path}`);
    try {
      const content = await fetchFileContent(owner, repo, path);
      fileContents.push({ path, content: content.slice(0, MAX_FILE_SIZE) });
    } catch { /* skip */ }
  }

  const treeList = tree.map((f) => f.path).join("\n");
  const filesBlock = fileContents.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");
  const userPrompt = `Analyze this repository and return JSON only.\n\nFILE TREE (${tree.length} files):\n${treeList}\n\nKEY SOURCE FILES:\n${filesBlock}`;

  log(`Sending ${fileContents.length} files to Claude for analysis...`);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    temperature: 0,
    system: config.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  log("Claude responded \u00b7 parsing analysis...");

  const analysis = extractJson(responseText) as Record<string, unknown>;
  const arkivUsage = analysis.arkivUsage as Record<string, unknown> | undefined;
  log(`Language: ${analysis.language || "?"} \u00b7 Framework: ${analysis.framework || "?"}`);
  log(`Arkiv SDK found: ${arkivUsage?.found ? "yes" : "no"}`);
  if (arkivUsage?.found && Array.isArray(arkivUsage.files)) {
    log(`Arkiv usage detected in: ${arkivUsage.files.join(", ")}`);
  }

  log("Writing entity to Arkiv \u00b7 TTL 5 minutes...");
  const { entityKey, txHash } = await writeMemory(
    walletClient,
    analysis,
    { type: "code-analysis", sessionId, repo: `${owner}/${repo}` },
    TTL_WORKING
  );
  log(`Entity written \u00b7 ${entityKey.slice(0, 10)}...`, { highlight: true, success: true });

  return { entityKey, txHash };
}
