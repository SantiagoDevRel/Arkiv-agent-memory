// frontend/app/api/sessions/route.ts
// GET endpoint that queries Arkiv for entities.
// Optional query param ?type=final-report filters by type.
// Without ?type, returns all entities owned by the wallet.

import { publicClient, walletClient } from "../../../../src/arkiv/client";
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

    const sessions = result.entities.map((entity) => {
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
