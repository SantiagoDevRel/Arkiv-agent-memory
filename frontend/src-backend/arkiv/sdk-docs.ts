// src/arkiv/sdk-docs.ts
// Provides Agent 3 with two knowledge sources:
// 1. The actual SDK type definitions read from node_modules at runtime
// 2. A hardcoded expert knowledge document compiled from official Arkiv docs,
//    real hackathon projects, and SDK source analysis
// Both are combined and injected into Agent 3's prompt at runtime.

import fs from "fs";
import path from "path";

export function getArkivSDKDocs(): string {
  let typeDefs = "";

  try {
    const sdkPath = path.resolve(
      process.cwd(),
      "node_modules/@arkiv-network/sdk/dist/index.d.ts"
    );
    typeDefs = fs.readFileSync(sdkPath, "utf-8");
  } catch {
    typeDefs = "[SDK type definitions not found in node_modules]";
  }

  const expertKnowledge = `
=== ARKIV SDK — COMPLETE EXPERT KNOWLEDGE DOCUMENT ===

WHAT ARKIV IS:
Arkiv is Ethereum's data layer — a decentralized, serverless platform
for storing, querying, and managing data on-chain. It is a Layer 2
deployed on Ethereum, acting as a gateway to Layer 3 DataBase Chains.
The SDK is strongly based on Viem and can be treated as a Viem
replacement extended with Arkiv-specific features.
Current SDK version: 0.6.3

=== COMPLETE SDK FEATURE LIST ===

CLIENTS:
- createPublicClient({ chain, transport }) — read-only client for queries and subscriptions
- createWalletClient({ chain, transport, account }) — read/write client for mutations

MUTATIONS (wallet client only):
- walletClient.createEntity({ payload, contentType, attributes, expiresIn })
  Returns: { entityKey, txHash }
- walletClient.updateEntity({ key, payload, attributes, expiresIn })
- walletClient.deleteEntity({ key })
- walletClient.changeOwnership({ key, newOwner })
- walletClient.mutateEntities([...mutations]) — batch multiple mutations atomically

QUERIES (public client):
- publicClient.getEntity(key) — fetch single entity by 32-byte hex key
- publicClient.getChainId() — returns numeric chain ID
- publicClient.getEntityCount() — total entity count on chain
- publicClient.getBlockTiming() — block timing info (useful for TTL calculations)
- publicClient.buildQuery() — returns a QueryBuilder instance

QUERYBUILDER (fluent, chainable):
- .where(predicate) — filter by attribute predicate (multiple = AND)
- .ownedBy(address) — filter by on-chain ownership (not attribute match)
- .createdBy(address) — filter by creator address
- .orderBy(attr, type) — sort by attribute ("number" or "string")
- .limit(n) — max results per page
- .cursor(value) — pagination cursor
- .withAttributes(bool) — include attributes in result
- .withPayload(bool) — include payload bytes in result
- .withMetadata(bool) — include metadata in result
- .validAtBlock(n) — query state at a specific historical block
- .fetch() — execute and return QueryResult
- .count() — return count only

QUERY RESULT:
- result.entities — array of matched entities
- result.hasNextPage() — true if more results exist
- result.next() — fetch next page, updates result.entities in place

QUERY PREDICATES (import from @arkiv-network/sdk/query):
- eq(attr, value) — equality
- neq(attr, value) — not equal
- gt(attr, value) — greater than (numeric)
- gte(attr, value) — greater than or equal
- lt(attr, value) — less than
- lte(attr, value) — less than or equal
- and(...predicates) — logical AND
- or(...predicates) — logical OR
- not(predicate) — logical NOT
- asc(attr, type) / desc(attr, type) — sorting helpers

EVENT SUBSCRIPTIONS (public client):
- publicClient.subscribeEntityEvents({
    onEntityCreated, onEntityUpdated, onEntityDeleted,
    onEntityExpired, onEntityExpiresInExtended
  })
  Uses WebSocket transport (wss://kaolin.hoodi.arkiv.network/ws or mendoza equivalent)
  Enables real-time streaming of on-chain entity events

EXPIRATION (import ExpirationTime from @arkiv-network/sdk/utils):
- ExpirationTime.fromSeconds(n)
- ExpirationTime.fromMinutes(n)
- ExpirationTime.fromHours(n)
- ExpirationTime.fromDays(n)
- ExpirationTime.fromWeeks(n)
- ExpirationTime.fromMonths(n)
- ExpirationTime.fromYears(n)
- ExpirationTime.fromBlocks(n)
- ExpirationTime.fromDate(date)
Entity returns expiresAtBlock (block number), not a Unix timestamp.

PAYLOAD UTILITIES:
- jsonToPayload(obj) — converts JS object to binary payload
- stringToPayload(str) — converts string to binary payload
Import from @arkiv-network/sdk or @arkiv-network/sdk/utils

ACCOUNTS:
- privateKeyToAccount(hexKey) — creates viem Account from private key
  Import from @arkiv-network/sdk/accounts (NOT re-exported from main entry)

CHAINS:
- kaolin — primary testnet, Chain ID 60138453025
  RPC: https://kaolin.hoodi.arkiv.network/rpc
  WS: wss://kaolin.hoodi.arkiv.network/ws
- mendoza — earlier testnet (used in older projects)
  RPC: https://mendoza.hoodi.arkiv.network/rpc
  WS: wss://mendoza.hoodi.arkiv.network/ws
Import from @arkiv-network/sdk/chains

ENTITY OBJECT PROPERTIES:
- .key — 32-byte hex entity key
- .payload — raw binary payload
- .attributes — array of { key, value } pairs
- .expiresAtBlock — block number when entity auto-deletes
- .owner — current owner wallet address
- .creator — original creator wallet address
- .toJson() — parse payload as JSON
- .toText() — parse payload as string

CONTENT TYPES:
24 MIME types supported including:
application/json, text/plain, text/html, image/png, image/jpeg,
image/gif, image/webp, image/svg+xml, video/mp4, audio/mp3,
application/pdf, and more.

DEBUG LOGGING:
Set DEBUG=arkiv:* environment variable for verbose SDK logs.
Sub-namespaces: arkiv:rpc, arkiv:query

IMPORT MAP:
@arkiv-network/sdk           → createPublicClient, createWalletClient,
                               http, jsonToPayload, stringToPayload
@arkiv-network/sdk/chains    → kaolin, mendoza
@arkiv-network/sdk/query     → eq, neq, gt, gte, lt, lte, and, or, not, asc, desc
@arkiv-network/sdk/utils     → ExpirationTime, jsonToPayload, stringToPayload
@arkiv-network/sdk/accounts  → privateKeyToAccount

NOTE — KNOWN DX ISSUE:
eq and other predicates are NOT exported from the main SDK entry point.
Developers must know to import from @arkiv-network/sdk/query.
privateKeyToAccount is NOT re-exported — must import from @arkiv-network/sdk/accounts.
These are undiscoverable from the main index.d.ts alone.

=== REAL EXAMPLES FROM HACKATHON WINNERS ===

PROJECT: nv-cho/on-message (private messaging, uses TTL as core privacy model)
Pattern: ephemeral conversations — entire privacy model built on entity expiration.
Invite = short-TTL entity. Accepting invite creates shared room entity.
All messages auto-delete when room TTL expires. No manual deletion needed.
Uses: createEntity, deleteEntity, buildQuery, heavy TTL usage, server-side wallet.
Key insight: TTL is not a cleanup mechanism here — it IS the product feature.

PROJECT: the-pines/ocean (2nd prize — Notion-style workspace, most advanced SDK usage)
Patterns used:
- Relayer pattern: server wallet submits on behalf of user (gasless UX).
  User signs EIP-712 typed data. Relay verifies signature before submitting.
  This means user never pays gas but their intent is cryptographically proven.
- Append-only event sourcing: membership and page history are append-only.
  Current state derived at read time from event stream. No entity ever mutated.
- Lifecycle as queryable attribute: draft/active stored as Arkiv attribute,
  enabling query-time lifecycle filtering.
- Differentiated TTL by entity type:
  workspace = 5 years, membership = 3 years, removed membership = 180 days,
  page revision = 2 years
- Combined QueryBuilder predicates: and(), or(), eq(), gte(), orderBy() together
- Three write modes: relayer (default), direct (user wallet), auto (direct + fallback)
Uses: createPublicClient, createWalletClient, createEntity, buildQuery,
      and/or/eq/gte predicates, orderBy, withAttributes, withPayload,
      ExpirationTime, EIP-712 signing, subscribeEntityEvents (WIP)

PROJECT: understories/mentor-graph (social graph, knowledge graph stored in Arkiv)
Pattern: social graph edges are first-class Arkiv entities (not relational joins).
Two-way confirmation: both participants write separate entities to confirm session.
Real-world side effect triggered by Arkiv state: Jitsi link generated on confirmation.
TTL-aware UX: asks/offers expire, UI hints when TTL is about to expire.
Uses: createEntity, deleteEntity, buildQuery, subscribeEntityEvents (WIP), TTL

PROJECT: DruxAMB/Create-Arkiv-App (CLI scaffolding tool — 5 SDK feature templates)
Templates demonstrating each SDK capability:
- crud: createEntity + getEntity
- ttl: ExpirationTime, entity extension
- queries: buildQuery with complex predicates, real-time vote tallying
- subscriptions: subscribeEntityEvents, real-time event streaming
- attributes: multi-attribute queries, attribute-driven filtering

=== SCORING RUBRIC (USE THIS EXACTLY) ===

Score ONLY based on confirmed evidence in the analyzed code.
Do NOT score based on potential, README claims, or what the project could do.

0   — @arkiv-network/sdk not found anywhere (package.json, imports, source files)
1   — SDK in package.json only, no imports or usage found in source code
2-3 — Only client initialization (createPublicClient or createWalletClient setup)
      No actual entity operations performed
4-5 — Client setup + at least one of: createEntity OR basic buildQuery
      Basic usage, single operation type, no TTL or attribute strategy
6-7 — Multiple operations: createEntity + buildQuery + expiresIn + attributes
      Shows understanding of Arkiv as a data layer, not just a write endpoint
8-9 — Advanced usage: QueryBuilder with multiple predicates (and/or/eq/gte),
      event subscriptions OR batch mutations OR relayer pattern OR
      differentiated TTL strategy OR append-only event sourcing
10  — Comprehensive usage across mutations, queries, events, content types,
      advanced patterns (relayer, event sourcing, lifecycle attributes)

CONFIDENCE FIELD:
high   — Agent 2 read multiple source files including Arkiv-specific code
medium — Agent 2 read package.json and some source files but limited Arkiv code found
low    — Agent 2 could not read source files or only read package.json

=== END OF EXPERT KNOWLEDGE DOCUMENT ===
`;

  return expertKnowledge + "\n\n=== SDK TYPE DEFINITIONS (from node_modules) ===\n" + typeDefs;
}
