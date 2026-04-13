# Arkiv Agent Memory

A multi-agent pipeline that analyzes GitHub repositories and stores
findings on the Arkiv blockchain. Four AI agents run in sequence,
communicating exclusively through Arkiv as a shared memory layer.

**Tagline:** "Arkiv: the memory layer for AI agents."

---

## What This Does

You give a GitHub repo URL. Four agents run in sequence:

1. **README Reader** — fetches and analyzes the README via GitHub REST API
2. **Code Analyzer** — reads the file tree and key source files
3. **Arkiv Expert** — queries Arkiv for agent 1+2 findings, scores SDK usage 0-10
4. **Reporter** — synthesizes everything into a persistent 30-day report

No agent receives another agent's output as a function parameter.
**Arkiv is the only communication channel between agents.**
Remove Arkiv and the system breaks entirely. That is the correct dependency level.

---

## Architecture

```
GitHub repo URL
      ↓
Agent 1 (README Reader)  →  writes to Arkiv  →  TTL: 5 min
Agent 2 (Code Analyzer)  →  writes to Arkiv  →  TTL: 5 min
      ↓ (Agent 3 reads both from Arkiv)
Agent 3 (Arkiv Expert)   →  writes to Arkiv  →  TTL: 5 min
      ↓ (Agent 4 reads all three from Arkiv)
Agent 4 (Reporter)       →  writes to Arkiv  →  TTL: 30 days
```

**Memory tiers:**
- Agents 1, 2, 3: 5-minute TTL (working memory — expires live during demo)
- Agent 4: 30-day TTL (persistent cross-session intelligence)

After analyzing multiple repos across multiple sessions, Agent 4 can
answer cross-project questions like "which projects used expiresIn?"
or "which SDK features are developers consistently ignoring?" —
all from Arkiv, without re-running any analysis.

---

## Tech Stack

- **Runtime:** Node.js 22, TypeScript
- **Execution:** `tsx` (runs TypeScript directly, no compile step)
- **Arkiv SDK:** `@arkiv-network/sdk`
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Testnet:** Kaolin
  - Chain ID: `60138453025`
  - RPC: `https://kaolin.hoodi.arkiv.network/rpc`
  - Explorer: `https://explorer.kaolin.hoodi.arkiv.network`
  - Faucet: `https://kaolin.hoodi.arkiv.network/faucet`
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Repo fetching:** GitHub REST API via raw `fetch()` — no octokit
- **IDE:** Cursor on Windows

---

## Folder Structure

```
arkiv-agent-memory/
├── src/
│   ├── agents/
│   │   ├── agent1-readme-reader.ts
│   │   ├── agent2-code-analyzer.ts
│   │   ├── agent3-arkiv-expert.ts
│   │   └── agent4-reporter.ts
│   ├── arkiv/
│   │   ├── client.ts        # walletClient + publicClient setup
│   │   └── memory.ts        # writeMemory / readMemory helpers, TTL constants
│   ├── config/
│   │   └── agents.ts        # agent definitions and system prompts
│   ├── github/
│   │   └── fetcher.ts       # GitHub REST API: README + file tree + files
│   └── index.ts             # orchestrator
├── frontend/                # Next.js app
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Setup

```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and ARKIV_PRIVATE_KEY

# Run pipeline
GITHUB_REPO_URL=https://github.com/fabianferno/clink npm start

# Run frontend
cd frontend
npm install
npm run dev
```

**Required environment variables:**

```
ANTHROPIC_API_KEY=
ARKIV_PRIVATE_KEY=   # funded Kaolin wallet private key
```

Get testnet funds: https://kaolin.hoodi.arkiv.network/faucet

---

## Entity Structure

Each agent writes one entity to Arkiv per pipeline run:

```typescript
// Agent 1 — readme-summary (5 min TTL)
attributes: [
  { key: 'type', value: 'readme-summary' },
  { key: 'sessionId', value: 'uuid-for-this-run' },
  { key: 'repo', value: 'owner/repo-name' }
]

// Agent 4 — final-report (30 day TTL)
attributes: [
  { key: 'type', value: 'final-report' },
  { key: 'sessionId', value: 'uuid-for-this-run' },
  { key: 'repo', value: 'owner/repo-name' },
  { key: 'date', value: '2026-04-08' }
]
```

**Session grouping:** A `sessionId` (randomly generated string) is
attached as an attribute to all 4 entities in one run. Agent 3 and 4
query by `sessionId` to retrieve prior agents' outputs from the same run.

---

## Entity Lifecycle States

Arkiv entities have three possible states visible in the explorer:

- **Active** — entity exists in the queryable index, TTL has not passed
- **Expired** — TTL block was reached, chain auto-removed from index
- **Deleted** — owner explicitly called `deleteEntity()` before TTL expired

In both Expired and Deleted cases, the original transaction data
remains permanently on the blockchain and is accessible via `txHash`.

---

## Demo Repos (Arkiv Hackathon Submissions)

| Project | Event | GitHub |
|---|---|---|
| MentorGraph | Sub0 Argentina, Nov 2025 | github.com/understories/mentor-graph |
| on-message | Tierra de Buidlers, Nov 2025 | github.com/nv-cho/on-message |
| Create Arkiv App | Builders Challenge, Feb-Mar 2026 | github.com/DruxAMB/Create-Arkiv-App |
| Ocean | Builders Challenge, Feb-Mar 2026 | github.com/the-pines/ocean |
| Clink | Builders Challenge, Feb-Mar 2026 | github.com/fabianferno/clink |
| Hostr | Builders Challenge, Feb-Mar 2026 | github.com/akashbiswas0/Hostr |

---

## DX Issues Found During Build

Real friction points encountered while building with the Arkiv SDK.
Documented with reproduction steps and concrete suggestions.

---

### DX-01: Query predicates not exported from main SDK entry point

**Reproduction:** `import { eq } from "@arkiv-network/sdk"` fails.

**Fix required:** `import { eq } from "@arkiv-network/sdk/query"`

The main `index.d.ts` re-exports `jsonToPayload` and `stringToPayload`
but not query predicates. This subpath is undiscoverable without reading
internal package structure.

**Suggestion:** Re-export all query predicates from the main entry point.

---

### DX-02: `privateKeyToAccount` not re-exported by the SDK

**Reproduction:** `import { privateKeyToAccount } from "@arkiv-network/sdk"` fails.

**Fix required:** `import { privateKeyToAccount } from "@arkiv-network/sdk/accounts"`

Since the SDK positions itself as a viem replacement, this utility
should be re-exported from the main entry or documented prominently.

**Suggestion:** Re-export from main entry or add an "Import Map" section to docs.

---

### DX-03: `expiresAtBlock` returned as block number, not timestamp

**Reproduction:** Write an entity with `expiresIn: ExpirationTime.fromMinutes(5)`.
Read it back. The entity returns `expiresAtBlock: 2440849`.

To display a human-readable countdown like "3m 54s remaining",
a developer must: (1) fetch the current block number, (2) know
the average block time for the chain, (3) calculate the difference.
None of this is documented.

**Suggestion:** Return `expiresAt` as a Unix timestamp alongside
`expiresAtBlock`. Or document the block timing calculation pattern.

---

### DX-04: Parallel `createEntity` calls from shared wallet cause nonce collision

**Reproduction:** Call `writeMemory()` twice using `Promise.all()`
from the same `walletClient` instance.

**Error:** `EntityMutationError: replacement transaction underpriced`

**Root cause:** Both transactions get the same nonce. The chain rejects
the second as a duplicate.

**Impact:** Agents sharing a wallet cannot write to Arkiv in parallel.
Agents 1 and 2 were designed to run in parallel but had to be serialized
specifically because of this.

**Suggestion:** Internal transaction queue inside the SDK, or clear
documentation that parallel writes from one wallet are unsupported.

---

### DX-05: No native access control on entities

All data stored on Arkiv is publicly readable by anyone who queries
the chain. No mechanism exists to restrict read access to specific
wallet addresses.

**Workaround:** Encrypt the JSON payload before calling `jsonToPayload()`.

**Suggestion:** A permissioned entity type where only the creator or
a whitelist of addresses can retrieve the payload would unlock enterprise
use cases currently blocked by this limitation.

---

### DX-06: Inconsistent terminology between JavaScript and Python SDKs

**JavaScript SDK** (npmjs.com/package/@arkiv-network/sdk):
Describes Arkiv as "open, trustless, permissionless."

**Python SDK** (github.com/Arkiv-Network/arkiv-sdk-python/blob/main/AGENTS.md):
Describes Arkiv as "a permissioned storage system."

These are official repositories from the same organization and directly
contradict each other.

**Suggestion:** Align terminology across all SDKs and documentation.

---

### DX-07: TTL controls queryability vs permanent deletion — undocumented

**Discovery:** When an entity's TTL expires, the official docs describe
it as "automatic data pruning." This language implies the data is fully
deleted. It is not.

**What actually happens:**
- The entity is removed from Arkiv's queryable index (`buildQuery()`
  will no longer return it)
- The original transaction data remains permanently on the blockchain
- Anyone with the `txHash` can retrieve the full payload forever via
  the block explorer or `eth_getTransactionByHash` RPC call

**Practical impact:** A developer building an audit system using Arkiv
might only store the `entityKey`. After TTL expires, they lose SDK
access to the data — even though the data is technically still on the
blockchain forever in the transaction history. Always store `txHash`
alongside `entityKey`.

**Not documented anywhere in official docs** (checked: arkiv.network/docs,
/docs/sdk, /docs/api as of April 2026).

**Suggestion:** Add a clear note to the `expiresIn` documentation:
> "TTL controls how long an entity remains queryable via the SDK and API.
> The underlying transaction data is permanently recorded on the blockchain
> and remains accessible via the transaction hash."

---

### DX-08: No documentation on the difference between `deleteEntity()` and TTL expiry

**Discovery:** The Arkiv block explorer shows three distinct entity states:
Active, Expired, and Deleted. These are meaningfully different:

- **Active:** entity exists in the queryable index, TTL has not passed
- **Expired:** TTL block reached, chain auto-removed from index
- **Deleted:** owner explicitly called `deleteEntity()` before TTL expired

**What is not documented:** The SDK describes `deleteEntity()` and
`expiresIn` as separate features but never explains when to use one
vs the other, or that they produce different on-chain records in the
explorer.

**Why this matters:** A developer building an audit trail needs to
know whether an entity was scheduled to expire or was manually deleted.
These have different implications for data governance.

**Suggestion:** Add a section explaining the three entity lifecycle
states and when to use `deleteEntity()` vs TTL expiry.

---

## Architecture Insights

### Why Arkiv as the only communication channel matters

If agents passed data via function parameters, Arkiv would be decorative.
A JavaScript object would work identically. The test: remove Arkiv and
see if the system breaks entirely. If yes, the architecture is correct.
If the system still works without it, the dependency is decorative.

### Session ID pattern

A `sessionId` (randomly generated string) is generated once at the
start of each pipeline run and attached as an attribute to all 4 entities
from that run. Agent 3 and 4 query by `sessionId` to retrieve prior
agents' outputs from the same run.

The `sessionId` is public and visible on the chain. It is a grouping
label, not a security mechanism.

### Cross-session queries

To query across multiple pipeline runs (e.g., "show all repos that
scored above 7"), query by `type=final-report`. The `sessionId` is
not relevant for cross-session queries — only for grouping entities
within one run.

### One wallet for all agents

All agents sign transactions with the same wallet. This means parallel
writes from different agents must be serialized to avoid nonce collisions
(see DX-04). A future architecture could give each agent its own wallet
for true autonomy, at the cost of more complex key management.

----------------------------------------------------------------------------------------------------------------------------------------------------
# EXTRA 

## How Each Agent Was Prompted

No fine-tuning or model training was done. Each agent runs on
`claude-sonnet-4-20250514` with a carefully crafted system prompt.
The "expertise" of each agent comes from what context is injected
into Claude's prompt at runtime, not from any model modification.

All Claude API calls use `temperature: 0` to make outputs deterministic.
The same repo analyzed multiple times produces the same score every time.

---

### Agent 1 — README Reader

**What it does:** Fetches `README.md` from the GitHub REST API using
raw `fetch()`. The response arrives base64-encoded and is decoded to
plain text before being sent to Claude.

**System prompt:** Instructs Claude to extract structured JSON from
the raw README text: project name, one-sentence goal, tech stack
mentioned in the description, and whether Arkiv SDK is referenced
anywhere in the text.

**Important distinction:** This is a text-level check only. Agent 1
looks for Arkiv mentioned in the README prose — not in the code.
Agent 2 does the real code inspection.

**Output schema:**
```json
{
  "name": "string",
  "goal": "string",
  "techStack": ["string"],
  "usesArkiv": true,
  "summary": "string"
}
```

---

### Agent 2 — Code Analyzer

**What it does:** Fetches the full file tree from the GitHub REST API,
then reads up to 8 files using a priority system:

1. Always reads `package.json` first (confirms installed dependencies)
2. Reads any file whose path contains "arkiv", "client", "db",
   "storage", "entity", or "memory" (most likely to contain SDK usage)
3. Fills remaining slots with other `.ts` / `.js` source files

**System prompt:** Instructs Claude to analyze file contents and
specifically look for `@arkiv-network/sdk` in `package.json` and
source files. Returns structured JSON with language, framework,
file count, and exact Arkiv usage evidence including which files
contain imports and which SDK functions are called.

**Output schema:**
```json
{
  "language": "string",
  "framework": "string",
  "fileCount": 32,
  "arkivUsage": {
    "found": true,
    "files": ["src/lib/arkiv.ts"],
    "observations": "string"
  },
  "qualityNotes": "string"
}
```

---

### Agent 3 — Arkiv Expert

This is the most carefully constructed agent. Three layers of context
are injected into Claude's prompt at runtime:

**Layer 1 — Live SDK type definitions (read at runtime)**

The agent reads `node_modules/@arkiv-network/sdk/dist/index.d.ts`
directly from the installed package on every run. Claude receives the
actual TypeScript type definitions, not a summary. If Arkiv ships a
new SDK version and you run `npm update`, Agent 3 automatically picks
up the new types without any code changes.

**Layer 2 — Curated feature inventory (hardcoded in system prompt)**

A complete feature inventory compiled by manually researching the
official SDK source, npm page, GitHub organization, and all 8 hackathon
submissions. This gives Claude a ground-truth list of every SDK feature
with descriptions of what each does — something the raw types alone
cannot provide.

Features covered: `createPublicClient`, `createWalletClient`,
`createEntity`, `updateEntity`, `deleteEntity`, `extendEntity`,
`changeOwnership`, `mutateEntities` (batch), `getEntity`, `buildQuery`,
`getEntityCount`, `getBlockTiming`, QueryBuilder methods (`.where()`,
`.ownedBy()`, `.createdBy()`, `.orderBy()`, `.limit()`, `.fetch()`,
`.count()`), all query predicates (`eq`, `neq`, `gt`, `gte`, `lt`,
`lte`, `and`, `or`, `not`), `ExpirationTime` helpers, `subscribeEntityEvents`,
`jsonToPayload`, `stringToPayload`, and all supported content types.

**Layer 3 — Strict scoring rubric (hardcoded in system prompt)**

Without a strict rubric, Claude scores based on potential fit rather
than actual evidence. A repo with zero Arkiv usage was scoring 9/10
before this rubric was added. After the fix: zero usage = 0, always.

```
0   → SDK not found anywhere in the repo
1   → in package.json but no imports in source code
2-3 → client setup only (createPublicClient or createWalletClient)
4-5 → createEntity OR buildQuery used, not both
6-7 → createEntity + buildQuery + expiresIn + attributes together
8-9 → QueryBuilder with predicates + event subscriptions or batch
10  → comprehensive usage across all SDK features
```

**Output schema:**
```json
{
  "fitScore": 7,
  "featuresUsed": ["createEntity", "buildQuery().where(eq()).fetch()"],
  "featuresMissed": ["subscribeEntityEvents", "mutateEntities"],
  "suggestions": ["string"],
  "verdict": "string",
  "confidence": "high",
  "patternComparison": "string"
}
```

---

### Agent 4 — Reporter

**What it does:** Queries Arkiv for all three prior entities from the
current session, verifies all three are present, then sends all payloads
to Claude for synthesis.

**System prompt:** Instructs Claude to produce a final structured report
combining findings from all three agents: project overview, tech stack,
Arkiv fit score, recommendations, and a one-line summary.

**What makes it powerful:** Agent 4 does not just report on the current
run. Because final reports persist for 30 days, future runs can query
previous reports and produce cross-project insights — "which projects
used `expiresIn`?", "what SDK features are developers consistently
ignoring?" — without re-running any analysis.

**Output schema:**
```json
{
  "projectName": "string",
  "goal": "string",
  "techStack": ["string"],
  "arkivFitScore": 7,
  "featuresUsed": ["string"],
  "featuresMissed": ["string"],
  "recommendations": ["string"],
  "oneLineSummary": "string"
}
```

---

### Design principle across all agents

The scoring rubric is the DevRel expertise baked into the system prompt.
The live SDK type reading is the technical accuracy layer. Both are
needed: the rubric gives Claude better scoring context than raw types
alone, while the live types ensure Claude has the exact current API
surface regardless of SDK version.
