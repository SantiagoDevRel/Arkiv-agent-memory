// frontend/app/api/entity/route.ts
// DELETE endpoint that removes an entity from the Arkiv chain permanently.
// Accepts: { key: string } in the request body.
// Calls walletClient.deleteEntity({ entityKey }) from the backend Arkiv client.
// Returns: { success: true, key } or { success: false, error: string }

import { walletClient } from "../../../src-backend/arkiv/client";
import type { Hex } from "viem";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  try {
    const { key } = await req.json();

    if (!key || typeof key !== "string") {
      return Response.json({ success: false, error: "key is required" }, { status: 400 });
    }

    console.log(`[api] deleting entity ${key}`);

    const result = await walletClient.deleteEntity({ entityKey: key as Hex });

    console.log(`[api] entity deleted successfully (tx: ${result.txHash})`);
    return Response.json({ success: true, key, txHash: result.txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[api] delete failed: ${message}`);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
