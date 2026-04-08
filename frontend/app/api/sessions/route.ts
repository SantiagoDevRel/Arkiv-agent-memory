// frontend/app/api/sessions/route.ts
// GET endpoint that queries Arkiv for entities.
// Optional query param ?type=final-report filters by type.
// Without ?type, returns all entities owned by the wallet.

import { publicClient, walletClient } from "../../../src-backend/arkiv/client";
import { eq } from "@arkiv-network/sdk/query";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const typeFilter = url.searchParams.get("type");
    const repoFilter = url.searchParams.get("repo");

    let q = publicClient
      .buildQuery()
      .withAttributes(true)
      .withPayload(true)
      .withMetadata(true);

    if (typeFilter) {
      q = q.where(eq("type", typeFilter));
    }
    if (repoFilter) {
      q = q.where(eq("repo", repoFilter));
    }
    if (!typeFilter && !repoFilter) {
      // No filters: get all entities owned by our wallet
      q = q.ownedBy(walletClient.account.address);
    }

    const result = await q.limit(100).fetch();

    // Fetch current block to filter out expired entities
    let currentBlock: number | null = null;
    try {
      const blockRes = await fetch("https://kaolin.hoodi.arkiv.network/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 }),
      });
      const blockData = await blockRes.json();
      currentBlock = parseInt(blockData.result, 16);
    } catch { /* proceed without filtering if block fetch fails */ }

    const activeEntities = currentBlock
      ? result.entities.filter((entity) => {
          if (!entity.expiresAtBlock) return true;
          return Number(entity.expiresAtBlock) > currentBlock;
        })
      : result.entities;

    const sessions = activeEntities.map((entity) => {
      let payload: unknown = null;
      try {
        payload = entity.toJson();
      } catch {
        try {
          payload = { text: entity.toText() };
        } catch {
          payload = null;
        }
      }

      return {
        entityId: entity.key,
        payload: payload ?? {},
        expiresAtBlock: entity.expiresAtBlock?.toString() ?? null,
        attributes: entity.attributes,
      };
    });

    return Response.json({ sessions });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
