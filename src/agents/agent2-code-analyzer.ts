// src/agents/agent2-code-analyzer.ts
// Agent 2: fetches the file tree and key source files, sends them to Claude
// for code analysis, writes the structured result to Arkiv with TTL_WORKING.
// Attributes written: { type: "code-analysis", sessionId, repo }
// Returns the Arkiv entity ID of the written result.

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

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".sol", ".rs", ".go"];
const MAX_FILES_TO_READ = 5;
const MAX_FILE_SIZE = 8000;

function pickKeyFiles(tree: { path: string; type: string }[]): string[] {
  const candidates: string[] = [];
  if (tree.some((f) => f.path === "package.json")) candidates.push("package.json");
  const codeFiles = tree
    .filter((f) => f.type === "blob" && CODE_EXTENSIONS.some((ext) => f.path.endsWith(ext)) && !f.path.includes("node_modules") && !f.path.includes(".test.") && !f.path.includes(".spec."))
    .sort((a, b) => a.path.length - b.path.length);
  for (const file of codeFiles) {
    if (candidates.length >= MAX_FILES_TO_READ) break;
    candidates.push(file.path);
  }
  return candidates;
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

  const keyPaths = pickKeyFiles(tree);
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
