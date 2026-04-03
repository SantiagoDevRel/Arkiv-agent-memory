// src/github/fetcher.ts
// Fetches data from any public GitHub repo using the GitHub REST API.
// No third-party GitHub library — uses raw fetch() only.
// GitHub API base: https://api.github.com
// No auth token needed for public repos.

const API_BASE = "https://api.github.com";

const headers: Record<string, string> = {
  Accept: "application/vnd.github+json",
};

/**
 * Fetches and base64-decodes the README content for a repo.
 * Uses the GET /repos/{owner}/{repo}/readme endpoint.
 */
export async function fetchReadme(owner: string, repo: string): Promise<string> {
  const url = `${API_BASE}/repos/${owner}/${repo}/readme`;
  console.log(`[github] fetching README for ${owner}/${repo}`);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[github] README fetch failed: ${res.status} ${res.statusText}`, body);
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const decoded = Buffer.from(data.content, "base64").toString("utf-8");
  console.log(`[github] README fetched: ${decoded.length} chars`);
  return decoded;
}

/**
 * Fetches the full recursive file tree for a repo.
 * Uses the GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1 endpoint.
 * Returns an array of { path, type, size } objects.
 */
export async function fetchFileTree(
  owner: string,
  repo: string,
  branch = "main"
): Promise<{ path: string; type: string; size?: number }[]> {
  const url = `${API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  console.log(`[github] fetching file tree for ${owner}/${repo} (branch: ${branch})`);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    // If main fails, try master
    if (branch === "main") {
      console.log(`[github] branch "main" not found, trying "master"...`);
      return fetchFileTree(owner, repo, "master");
    }
    const body = await res.text();
    console.error(`[github] file tree fetch failed: ${res.status} ${res.statusText}`, body);
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const tree = data.tree as { path: string; type: string; size?: number }[];
  console.log(`[github] file tree fetched: ${tree.length} entries`);
  return tree;
}

/**
 * Fetches the raw content of a single file from a repo.
 * Uses the GET /repos/{owner}/{repo}/contents/{path} endpoint.
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${path}`;
  console.log(`[github] fetching file ${owner}/${repo}/${path}`);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[github] file fetch failed: ${res.status} ${res.statusText}`, body);
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const decoded = Buffer.from(data.content, "base64").toString("utf-8");
  console.log(`[github] file fetched: ${decoded.length} chars`);
  return decoded;
}
