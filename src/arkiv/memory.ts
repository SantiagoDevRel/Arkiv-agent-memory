// src/arkiv/memory.ts
// Wraps the SDK's entity creation and querying into simple helpers.
// writeMemory: writes a JSON payload to Arkiv with attributes and a TTL
//   (time-to-live — how long in seconds before the chain auto-deletes the entity).
// readMemory: queries Arkiv by attribute filters and returns matching entities.
// TTL constants used by all agents are defined here.

import { jsonToPayload } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import type { WalletArkivClient, PublicArkivClient, Entity } from "@arkiv-network/sdk";

// TTL constants (in seconds)
export const TTL_WORKING = 5 * 60;              // 300s — for agents 1, 2, 3
export const TTL_PERSISTENT = 30 * 24 * 60 * 60; // 2592000s — for agent 4

/**
 * Writes a JSON payload as an entity to Arkiv with the given attributes and TTL.
 * Returns both the entity key and the transaction hash.
 */
export async function writeMemory(
  client: WalletArkivClient,
  payload: object,
  attributes: Record<string, string>,
  ttl: number
): Promise<{ entityKey: string; txHash: string }> {
  const attrArray = Object.entries(attributes).map(([key, value]) => ({ key, value }));

  console.log(`[arkiv] writing entity with attributes:`, attributes);

  const { entityKey, txHash } = await client.createEntity({
    payload: jsonToPayload(payload),
    attributes: attrArray,
    contentType: "application/json",
    expiresIn: ttl,
  });

  console.log(`[arkiv] entity written: ${entityKey} (tx: ${txHash})`);
  return { entityKey, txHash };
}

/**
 * Queries Arkiv by attribute filters and returns matching entities.
 * Each filter key-value pair becomes an equality predicate.
 */
export async function readMemory(
  client: PublicArkivClient,
  filters: Record<string, string>
): Promise<Entity[]> {
  const predicates = Object.entries(filters).map(([key, value]) => eq(key, value));

  console.log(`[arkiv] querying with filters:`, filters);

  const result = await client
    .buildQuery()
    .where(predicates)
    .withAttributes(true)
    .withPayload(true)
    .withMetadata(true)
    .fetch();

  console.log(`[arkiv] found ${result.entities.length} entities`);
  return result.entities;
}
