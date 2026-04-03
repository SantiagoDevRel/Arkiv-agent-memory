# Arkiv Agent Memory — Build Journal

**Author:** Santiago Trujillo Zuluaga (@SantiagoDevRel)
**Role:** Developer Relations candidate at Arkiv / Golem Network
**Interview format:** 10 min tech demo · 10 min DX feedback · 20 min Q&A · 10 min my questions
**Interviewers:** Seweryn Kras (Software Engineer) · Marcos Miranda (Product Manager)
**Deadline:** ~1.5 weeks from April 2, 2026
**Repo:** github.com/SantiagoDevRel/arkiv-agents
**Status:** Brainstorm complete. Starting build.

---

## The Pitch

> **"Arkiv: the memory layer for AI agents."**

AI agents are stateless by default. Every session starts blank. Most developers solve this by storing context on a private server nobody else can verify or own.

Arkiv changes this. An agent's memory can live in a wallet-owned, queryable, expiry-aware database on Ethereum. No platform controls it. The memory compounds across sessions. When the task is done, it self-destructs.

**This is not a hackathon analyzer. This is what AI agents look like when their memory is decentralized. The task is swappable. The primitive is not.**

Anyone building any agent can use Arkiv as their memory layer. We demonstrate this using hackathon project analysis as the concrete task because it is contextually perfect for this interview. Swap the agents' task for research, DevRel monitoring, or coding assistance and the memory infrastructure stays identical.

---

## Why I Built This

My job as a DevRel is not to ship a tutorial. It is to understand a product deeply enough to inspire developers to build things the team has not imagined yet. When I got this interview, I did not start with "what should I build." I started with "what does Arkiv make possible that nothing else does." That question led to five ideas, a lot of honest skepticism about each one, and eventually to this app. This README documents that entire process, because the process is the portfolio.

---

## Brainstorm Process

### Selection criteria

Before generating ideas, I defined what makes a demo genuinely impressive to both a senior engineer and a product manager:

- **Expiry-native.** The app must not work without `expiresIn`. Not a feature. The product.
- **Technically combinable.** Integrates at least one external system (AI API, GitHub, real-time feed) to show Arkiv plays well with the rest of the stack.
- **Explainable in one sentence.** If I cannot explain the value in 10 seconds, it will not land in a 10-minute demo.
- **Not already built.** Research showed two major Arkiv hackathons with 50+ submissions clustering around events, job boards, and knowledge bases. The differentiated space was agents and persistent intelligence.
- **Arkiv as a hard dependency.** Remove Arkiv and the system breaks. Not "remove Arkiv and it gets slightly worse."

### What was rejected and why

**Real-time location tracking** (WhatsApp-style presence): technically Arkiv-native but no meaningful differentiation from WhatsApp for most use cases.

**Encrypted secret sharing**: good expiry mechanic, low technical ceiling. OneTimeSecret already exists. Without ZK (zero-knowledge proofs, cryptographic techniques that prove something without revealing underlying data) the encryption is client-side and a senior engineer will flag it immediately.

**Hackathon project registry**: storing repo summaries on Arkiv is not useful. Nobody needs that data on a blockchain. Classic solution looking for a problem.

**AI Bounty Board**: interesting but agents were decorative. Expiry on the bounty was the only real Arkiv usage.

**Initial multi-agent hackathon analyzer**: the first version had agents passing data to each other via function parameters. Arkiv was decoration. A JavaScript object would have worked identically. Rejected and rebuilt with Arkiv as the only communication channel.

---

## The Five Ideas Explored

### 1. Dead Man's Switch
If you stop checking in, your secret self-destructs and becomes readable by a predefined wallet. Expiry is the entire security model. No server decides. The chain does.
- Arkiv features: `createEntity`, `updateEntity` (renewal), attributes (recipient wallet), `expiresIn`

### 2. Multiplayer Secret (2-of-3)
A secret only decrypts when N of M specified wallets acknowledge it. Like multisig (a system requiring multiple approvals before executing) but for information access. Coordination is on-chain and queryable.
- Arkiv features: `createEntity`, `queryBuilder` with `ownedBy` filter, `expiresIn`

### 3. Conference Networking Layer
Check in to a conference room, query who else is there by skill, entity expires when the session ends. Public and permissionless unlike WhatsApp. Difference: WhatsApp location is private and contact-gated. This is queryable by any app.
- Arkiv features: `createEntity`, attribute filters, real-time WebSocket event streaming

### 4. Real-Time Disaster Coordination
Responders write a heartbeat entity every 30 minutes. Stop renewing, entity expires, dashboard flags you unreachable. Silence equals not present. Same mechanic as IoT (Internet of Things, connecting physical devices to networks) sensor monitoring, but trustless.
- Arkiv features: `createEntity`, `updateEntity`, real-time subscription, attribute querying

### 5. Multi-Agent Shared Memory — CHOSEN
Multiple AI agents share one Arkiv memory pool. Each writes what it finds. Each reads what others wrote. Memory persists across sessions, compounds over time, and expires automatically. No platform owns it.

---

## Why Multi-Agent Shared Memory

The core insight: agents get more capable over time when they accumulate memory, not because their model weights change, but because they start each session with richer, more relevant context. Think of a doctor with 20 years of patient notes vs one starting from scratch. Arkiv is the patient notes.

Three things Arkiv provides that no centralized database can:

- **Wallet ownership.** The memory pool belongs to an agent's wallet, not a platform.
- **Queryability.** Any agent reads what others wrote using attribute filters. No manual data passing. No orchestration framework required.
- **Programmable expiry.** Working memory expires in minutes. Final reports persist for 30 days. Everything self-cleans automatically.

### Critical architectural principle

**Arkiv is the only communication channel between agents.** No shared variables. No function calls passing data between agents. Agent 2 does not receive Agent 1's output as a parameter. It queries Arkiv to find it.

Remove Arkiv and the system breaks completely. That is the correct level of dependency.

```
Agent 1 + Agent 2 run in parallel → each writes findings to Arkiv independently
Agent 3 starts → queries Arkiv for Agent 1 + 2 output → writes structured signals
Agent 4 starts → queries Arkiv for ALL findings → writes 30-day final report
```

### Wallet setup

One wallet, Santiago's private key. All agents sign transactions with the same wallet. All entities are queryable from one address. Simpler, cheaper, easier to demo.

Each `createEntity` call costs gas paid in testnet ETH (free from the Kaolin faucet). Santiago already has a funded wallet.

Future direction (not in MVP): each agent owns its own wallet for true autonomy. Worth mentioning in the DX feedback section as a natural evolution of the primitive.

### Memory TTL (time-to-live) tiers

| Agent | Output | Expires | Why |
|---|---|---|---|
| Agent 1: readme-reader | Project summary, goals, tech stack | 5 minutes | Working memory, expires live during demo |
| Agent 2: code-analyzer | Stack analysis, code quality notes | 5 minutes | Working memory, expires live during demo |
| Agent 3: arkiv-expert | Arkiv feature usage, fit score, signals | 5 minutes | Working memory, expires live during demo |
| Agent 4: reporter | Full structured report | 30 days | Persistent cross-session intelligence |

The 5-minute TTL on working memory is a feature, not a limitation. Interviewers watch Agents 1, 2, 3 entities disappear on screen while the final report survives. That is the perfect visual proof that expiry is meaningful and enforced by the chain, not by a config flag.

The 30-day report layer is what makes the system non-decorative. After analyzing multiple repos across multiple sessions, Agent 4 can query previous reports and produce cross-project insights: "which projects used `expiresIn`?", "which Arkiv SDK features are developers consistently missing?" That query is only possible because reports persisted.

---

## Demo Task: Hackathon Project Analyzer

### Why this task

- Directly relevant to all three interview rounds (tech demo, hackathon planning, vision alignment)
- Real data exists in public GitHub repos from two official Arkiv hackathons
- Cross-project queries demonstrate Arkiv value better than any single-session demo
- Seweryn can verify code quality. Marcos can see the product thinking.
- The next interview round is literally about hackathon planning. The demo feeds directly into that conversation.

### Agent architecture

| File | Role | Reads from Arkiv | Writes to Arkiv | TTL |
|---|---|---|---|---|
| `agent1-readme-reader.ts` | Parses GitHub README | Task brief (repo URL from env) | Project summary, goals, tech stack | 5 min |
| `agent2-code-analyzer.ts` | Analyzes code structure | Task brief (repo URL from env) | Stack depth, quality notes, file structure | 5 min |
| `agent3-arkiv-expert.ts` | Evaluates Arkiv SDK usage | Agent 1 + 2 outputs (queried from Arkiv) | Features used/missed, fit score, suggestions | 5 min |
| `agent4-reporter.ts` | Writes final report | All agent outputs + prior reports (queried from Arkiv) | Full structured report + cross-project comparison | 30 days |

Agents 1 and 2 run in parallel. Agent 3 waits for both. Agent 4 waits for Agent 3.

### Cross-project intelligence (the real Arkiv value)

After processing multiple repos, Agent 4 can answer:
- "Which projects used `expiresIn`?"
- "Which tech stack appears most in Arkiv hackathon submissions?"
- "Which Arkiv SDK features are developers consistently ignoring?" (pure gold for the DevRel team)
- "How does this new submission compare to the 5 we already analyzed?"

This data does not exist on Devfolio or DoraHacks. It lives in Arkiv, queryable by anyone, and grows every time the system processes a new submission.

---

## Demo Target Repos

All public submissions from official Arkiv hackathons.
Source: [github.com/Arkiv-Network/arkiv-web3-database-builders-challenge#submissions](https://github.com/Arkiv-Network/arkiv-web3-database-builders-challenge#submissions)

| Project | Event | GitHub |
|---|---|---|
| MentorGraph | Sub0 Argentina (Nov 14-16, 2025) | github.com/understories/mentor-graph |
| on-message | Tierra de Buidlers (Nov 17-22, 2025) | github.com/nv-cho/on-message |
| Create Arkiv App | Builders Challenge (Feb-Mar 2026) | github.com/DruxAMB/Create-Arkiv-App |
| Agora | Builders Challenge (Feb-Mar 2026) | github.com/agora-oss/agora |
| Ocean | Builders Challenge (Feb-Mar 2026) | github.com/the-pines/ocean |
| Clink | Builders Challenge (Feb-Mar 2026) | github.com/fabianferno/clink |
| Hostr | Builders Challenge (Feb-Mar 2026) | github.com/akashbiswas0/Hostr |
| barolivera/agora | Builders Challenge (Feb-Mar 2026) | github.com/barolivera/agora |

The repo URL is configurable at runtime via `GITHUB_REPO_URL` in `.env`. Any public GitHub repo works as input.

---

## Tech Stack

- **Runtime:** Node.js 22
- **Language:** TypeScript
- **Execution:** `tsx` (runs TypeScript directly via esbuild, no compile step during development. Faster than `ts-node`, simpler than `tsc + node`.)
- **Arkiv SDK:** `@arkiv-network/sdk`
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Testnet:** Kaolin (Arkiv testnet on Hoodi)
  - Chain ID: 60138453025
  - RPC: `https://kaolin.hoodi.arkiv.network/rpc`
  - Explorer: `https://explorer.kaolin.hoodi.arkiv.network`
  - Faucet: `https://kaolin.hoodi.arkiv.network/faucet`
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, deployed to Vercel
- **Repo fetching:** GitHub REST API via raw `fetch()` (no octokit, minimal dependencies)
- **Env management:** `dotenv`
- **IDE:** Cursor on Windows

---

## Folder Structure

```
arkiv-agents/
├── src/
│   ├── agents/
│   │   ├── agent1-readme-reader.ts   # parses GitHub README, writes summary to Arkiv
│   │   ├── agent2-code-analyzer.ts   # analyzes repo code + structure, writes to Arkiv
│   │   ├── agent3-arkiv-expert.ts    # evaluates Arkiv SDK usage, writes signals to Arkiv
│   │   └── agent4-reporter.ts        # reads all Arkiv findings, writes 30-day report
│   ├── arkiv/
│   │   ├── client.ts                 # walletClient + publicClient setup
│   │   └── memory.ts                 # createEntity/queryEntities helpers, TTL constants
│   ├── config/
│   │   └── agents.ts                 # agent definitions: name, role, system prompt
│   ├── github/
│   │   └── fetcher.ts                # GitHub REST API: README + file tree + source files
│   └── index.ts                      # orchestrator: runs agents in correct order
├── frontend/                         # Next.js app: live entity feed + report display
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Entity Structure

```typescript
// Agent 1 output — expires 5 minutes (working memory)
{
  payload: jsonToPayload({
    repoUrl: 'github.com/DruxAMB/Create-Arkiv-App',
    projectName: 'Create Arkiv App',
    summary: '...',
    goals: ['...'],
    techMentioned: ['TypeScript', 'Arkiv SDK']
  }),
  contentType: 'application/json',
  attributes: [
    { key: 'type', value: 'readme-summary' },
    { key: 'sessionId', value: 'session-001' },
    { key: 'agent', value: 'readme-reader' },
    { key: 'repo', value: 'DruxAMB/Create-Arkiv-App' }
  ],
  expiresIn: ExpirationTime.fromMinutes(5)
}

// Agent 4 output — expires 30 days (persistent intelligence)
{
  payload: jsonToPayload({
    repoUrl: 'github.com/DruxAMB/Create-Arkiv-App',
    projectName: 'Create Arkiv App',
    overallScore: 7.4,
    techStack: ['TypeScript', 'Next.js', 'Arkiv SDK'],
    arkivFeaturesUsed: ['createEntity', 'queryBuilder'],
    arkivFeaturesNotUsed: ['expiresIn', 'realTimeStreaming'],
    recommendations: ['...'],
    crossProjectComparison: '...'
  }),
  contentType: 'application/json',
  attributes: [
    { key: 'type', value: 'final-report' },
    { key: 'repo', value: 'DruxAMB/Create-Arkiv-App' },
    { key: 'hackathon', value: 'builders-challenge-2026' },
    { key: 'date', value: '2026-04-02' }
  ],
  expiresIn: ExpirationTime.fromDays(30)
}
```

---

## Build Order

**Rule: do not touch the frontend until all four agents work end-to-end in the terminal.**

1. `src/arkiv/client.ts` + `src/arkiv/memory.ts` — validate: write entity to Kaolin, read it back. Confirm before continuing.
2. `src/github/fetcher.ts` — validate: fetch README and file tree from a public repo. Confirm.
3. `agent1-readme-reader` + `agent2-code-analyzer` in parallel — validate: both write to Arkiv, output is readable and useful. Confirm.
4. `agent3-arkiv-expert` — validate: reads Agent 1 + 2 output from Arkiv by querying sessionId, writes signals. Confirm.
5. `agent4-reporter` — validate: reads all findings, cross-references prior 30-day reports, writes coherent final report. Confirm.
6. Next.js frontend with live entity feed + report viewer. Deploy to Vercel.
7. Polish, DX feedback notes, demo script, practice run.

---

## DX Feedback Log

*Filled in during development. This section is a core part of the interview deliverable.*

### Setup experience
- [ ] Installation: `npm install @arkiv-network/sdk`
- [ ] First entity creation time-to-success
- [ ] Documentation clarity for Kaolin testnet wallet setup

### SDK ergonomics
- [ ] `createEntity` API surface — intuitive?
- [ ] `queryBuilder` discoverability — did I find it or did I have to dig?
- [ ] Error message quality — actionable or cryptic?
- [ ] TypeScript types coverage — complete?
- [ ] `ExpirationTime` helpers — obvious how to use?

### Things that worked well
> To be filled during build

### Things that caused friction (with reproduction steps)
> To be filled during build

### Specific suggestions for the Arkiv team
> To be filled during build

---

## Demo Script

**0:00-1:00** Context. "AI agents are stateless. Every session starts blank. Here is what changes when you give them a decentralized memory layer."

**1:00-4:00** Live run. Submit a real Arkiv hackathon repo URL. Watch all four agents execute sequentially. Show entity writes appearing on the frontend in real time.

**4:00-5:30** Watch Agent 1, 2, 3 entities expire after 5 minutes. Agent 4 report survives. "The working memory is gone. The intelligence remains."

**5:30-7:00** Cross-project query. Previous sessions already analyzed 2 other repos. Query Arkiv live: "which projects used `expiresIn`?" Answer comes from Arkiv, not local state.

**7:00-9:00** DX feedback section. Honest friction points with reproduction steps.

**9:00-10:00** The primitive. "Swap the task. The memory layer stays. This works for any agent — research, coding assistant, DevRel monitoring. The architecture is identical."

---

## Architecture Diagrams

*To be added during build. Planned:*
- Multi-agent coordination flow with Arkiv as the only communication channel
- Entity lifecycle across TTL tiers (5 min working memory vs 30 day report)
- SDK call sequence per agent
- Frontend live entity feed wireframe

---

*This README is a living document updated throughout the build. Last updated: April 2, 2026.*
