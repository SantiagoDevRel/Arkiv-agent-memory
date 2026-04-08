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

### DX-05: `.js` extensions in imports break Next.js webpack

**Reproduction:** Backend TypeScript files use Node16 module resolution
requiring `.js` extensions. When imported inside a Next.js API route,
webpack cannot resolve `.ts` files referenced by `.js` extensions.

**Fix:** Strip all `.js` extensions from imports used inside Next.js.

**Suggestion:** Document this when the SDK is used in monorepo projects
mixing Node.js backend with Next.js frontend.

---

### DX-06: `dotenv` path mismatch when importing backend from Next.js

**Reproduction:** Backend uses `import "dotenv/config"` which loads
`.env` relative to CWD. When Next.js runs from a subdirectory, the
parent `.env` is not found and all env vars silently become `undefined`.

**Fix:** Use `frontend/.env.local` and remove dotenv imports from
backend files when deployed through Next.js.

**Suggestion:** Document this pattern for monorepo deployments.

---

### DX-07: Arkiv SDK triggers console logging during Next.js build

**Reproduction:** Import `src/arkiv/client.ts` from a Next.js API route
and run `next build`. SDK initialization runs at build time and logs
to the build output.

**Suggestion:** Lazy initialization or a way to suppress SDK startup
logs during build.

---

### DX-08: No native access control on entities

All data stored on Arkiv is publicly readable by anyone who queries
the chain. No mechanism exists to restrict read access to specific
wallet addresses.

**Workaround:** Encrypt the JSON payload before calling `jsonToPayload()`.

**Recommendation for current Arkiv use:**
- Good fit: public verifiable data, open knowledge bases, audit logs,
  collaborative data where trustlessness matters more than privacy
- Not recommended without encryption: user personal data, credentials,
  private business data

**Suggestion:** A permissioned entity type where only the creator or
a whitelist of addresses can retrieve the payload would unlock enterprise
use cases currently blocked by this limitation.

---

### DX-09: Inconsistent terminology between JavaScript and Python SDKs

**JavaScript SDK** (npmjs.com/package/@arkiv-network/sdk):
Describes Arkiv as "open, trustless, permissionless."

**Python SDK** (github.com/Arkiv-Network/arkiv-sdk-python/blob/main/AGENTS.md):
Describes Arkiv as "a permissioned storage system."

These are official repositories from the same organization and directly
contradict each other.

**Suggestion:** Align terminology across all SDKs and documentation.

---

### DX-10: Agent 2 blind file selection

**Issue found during build:** The initial implementation read
`package.json` plus up to 4 arbitrary `.ts` files. If Arkiv SDK usage
was in file 8 of 20, Agent 2 would miss it and incorrectly score
the project as having no Arkiv integration.

**Fix applied:** Priority-based file selection:
1. Always read `package.json` first
2. Read any file whose path contains "arkiv", "client", "db",
   "storage", "entity", or "memory"
3. Fill remaining slots with other source files (max 8 total)

**SDK observation:** GitHub REST API has no batch file content endpoint.
Each file requires a separate `fetch()` call. With 8 files this means
8 sequential HTTP requests.

**Suggestion:** A bulk content endpoint would significantly improve
build time for agents needing broad code coverage.

---

### DX-11: Session grouping pattern is undocumented

The `sessionId` pattern used throughout this project — attaching a
randomly generated string as an attribute to group related entities —
is not documented anywhere in the official SDK as a recommended pattern.

**Suggestion:** Document common multi-agent patterns like session
grouping as official SDK examples.

---

### DX-12: TTL controls queryability, not blockchain immutability — undocumented

**Discovery:** When an entity's TTL expires, the official docs describe
it as "automatic data pruning." This language implies the data is fully
deleted. It is not.

**What actually happens:**
- The entity is removed from Arkiv's queryable index (`buildQuery()`
  will no longer return it)
- The original transaction data remains permanently on the blockchain
- Anyone with the `txHash` can retrieve the full payload forever via
  the block explorer or `eth_getTransactionByHash` RPC call

**Verified by:** Running the pipeline, waiting for the 5-minute TTL
to expire, then visiting the original `txHash` on the Kaolin explorer
and finding the complete JSON payload still readable.

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

### DX-13: No documentation on the difference between `deleteEntity()` and TTL expiry

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
