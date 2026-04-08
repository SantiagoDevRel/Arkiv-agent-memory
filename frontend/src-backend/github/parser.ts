// src/github/parser.ts
// Extracts a repo owner and name from a full GitHub URL.
// Handles URLs with or without trailing slash, with or without https://,
// and with or without the github.com prefix.

/**
 * Parses a GitHub URL into owner and repo name.
 * Examples:
 *   "https://github.com/fabianferno/clink"  -> { owner: "fabianferno", repo: "clink" }
 *   "github.com/fabianferno/clink/"          -> { owner: "fabianferno", repo: "clink" }
 *   "fabianferno/clink"                      -> { owner: "fabianferno", repo: "clink" }
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  // Strip protocol and trailing slashes
  const cleaned = url
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\/+$/, "");

  const parts = cleaned.split("/");
  if (parts.length < 2) {
    throw new Error(`[github] Invalid GitHub URL: "${url}" — expected owner/repo`);
  }

  return { owner: parts[0], repo: parts[1] };
}
