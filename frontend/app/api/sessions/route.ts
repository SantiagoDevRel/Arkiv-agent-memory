// frontend/app/api/sessions/route.ts
// GET endpoint that queries Arkiv for all final-report entities.
// Returns array of past session reports with their entity IDs and payloads.
// Powers the "Past sessions" section and cross-project comparison.

import { publicClient } from "../../../../src/arkiv/client";
import { readMemory } from "../../../../src/arkiv/memory";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entities = await readMemory(publicClient, { type: "final-report" });

    const sessions = entities.map((entity) => ({
      entityId: entity.key,
      payload: entity.toJson(),
      expiresAtBlock: entity.expiresAtBlock?.toString() ?? null,
      attributes: entity.attributes,
    }));

    return Response.json({ sessions });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
