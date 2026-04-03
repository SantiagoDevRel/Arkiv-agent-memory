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

const anthropic = new Anthropic();
const config = getAgentConfig("agent2");

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

// File extensions worth reading for code analysis
const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".sol", ".rs", ".go"];
const MAX_FILES_TO_READ = 5;
const MAX_FILE_SIZE = 8000; // chars — keep within context limits

/**
 * Picks the most relevant source files from a file tree for analysis.
 * Prioritizes package.json, config files, and source code files.
 */
function pickKeyFiles(tree: { path: string; type: string }[]): string[] {
  const candidates: string[] = [];

  // Always include package.json if present
  if (tree.some((f) => f.path === "package.json")) {
    candidates.push("package.json");
  }

  // Pick source code files, preferring shorter paths (top-level src)
  const codeFiles = tree
    .filter(
      (f) =>
        f.type === "blob" &&
        CODE_EXTENSIONS.some((ext) => f.path.endsWith(ext)) &&
        !f.path.includes("node_modules") &&
        !f.path.includes(".test.") &&
        !f.path.includes(".spec.")
    )
    .sort((a, b) => a.path.length - b.path.length);

  for (const file of codeFiles) {
    if (candidates.length >= MAX_FILES_TO_READ) break;
    candidates.push(file.path);
  }

  return candidates;
}

/**
 * Runs Agent 2: fetches file tree and key files, asks Claude to analyze them,
 * and writes the result to Arkiv. Returns the entity key.
 */
export async function runAgent2(
  owner: string,
  repo: string,
  sessionId: string
): Promise<{ entityKey: string; txHash: string }> {
  console.log(`[agent2] starting — analyzing code for ${owner}/${repo}`);

  // Fetch the file tree
  console.log(`[agent2] fetching file tree...`);
  const tree = await fetchFileTree(owner, repo);
  console.log(`[agent2] file tree: ${tree.length} entries`);

  // Pick and fetch key source files
  const keyPaths = pickKeyFiles(tree);
  console.log(`[agent2] reading ${keyPaths.length} key files: ${keyPaths.join(", ")}`);

  const fileContents: { path: string; content: string }[] = [];
  for (const path of keyPaths) {
    try {
      const content = await fetchFileContent(owner, repo, path);
      fileContents.push({ path, content: content.slice(0, MAX_FILE_SIZE) });
    } catch (err) {
      console.error(`[agent2] failed to fetch ${path}:`, err);
    }
  }

  // Build prompt with tree + file contents
  const treeList = tree.map((f) => f.path).join("\n");
  const filesBlock = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");

  const userPrompt = `Analyze this repository and return JSON only.

FILE TREE (${tree.length} files):
${treeList}

KEY SOURCE FILES:
${filesBlock}`;

  // Send to Claude for analysis
  console.log(`[agent2] sending to Claude for analysis...`);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    temperature: 0,
    system: config.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  console.log(`[agent2] Claude response received (${responseText.length} chars)`);

  // Parse Claude's JSON response (may be wrapped in markdown code fences)
  const analysis = extractJson(responseText);

  // Write to Arkiv
  console.log(`[agent2] writing to Arkiv...`);
  const { entityKey, txHash } = await writeMemory(
    walletClient,
    analysis,
    { type: "code-analysis", sessionId, repo: `${owner}/${repo}` },
    TTL_WORKING
  );
  console.log(`[agent2] entity written: ${entityKey}`);

  return { entityKey, txHash };
}
