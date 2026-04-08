// frontend/app/api/query/route.ts
// POST endpoint. Accepts { naturalLanguage: string }.
// 1. Sends the query to Claude API to extract structured query params.
// 2. Builds and executes an Arkiv QueryBuilder from those params.
// 3. Returns the results + the generated QueryBuilder code as a string.

import Anthropic from "@anthropic-ai/sdk";
import { publicClient } from "../../../src-backend/arkiv/client";
import { eq, neq, gt, gte, lt, lte } from "@arkiv-network/sdk/query";
import type { Hex } from "viem";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are an Arkiv SDK query translator. Convert natural language queries into structured Arkiv QueryBuilder parameters.

The Arkiv QueryBuilder supports these operations:
- Filter by attribute: { key: string, op: "eq"|"neq"|"gt"|"gte"|"lt"|"lte", value: string }
- Filter by owner address: ownedBy hex address
- Sort by attribute: { key: string, direction: "asc"|"desc", valueType: "string"|"number" }
- Limit results: number

Common attribute keys used in this system:
- "type": entity type (values: "readme-summary", "code-analysis", "arkiv-evaluation", "final-report", "connection-test")
- "repo": repository in "owner/name" format (e.g. "fabianferno/clink")
- "sessionId": UUID grouping entities from one pipeline run

Return JSON only. Schema:
{
  "filters": [{ "key": "string", "op": "string", "value": "string" }],
  "ownedBy": "string | null",
  "orderBy": { "key": "string", "direction": "string", "valueType": "string" } | null,
  "limit": 20,
  "explanation": "string"
}

If the query is ambiguous or impossible, set filters to [] and explain why.`;

type QueryParams = {
  filters: { key: string; op: string; value: string }[];
  ownedBy: string | null;
  orderBy: { key: string; direction: string; valueType: string } | null;
  limit: number;
  explanation: string;
};

const OP_MAP: Record<string, typeof eq> = { eq, neq, gt, gte, lt, lte };

function buildQueryCode(params: QueryParams): string {
  let code = "const result = await publicClient\n  .buildQuery()";
  for (const f of params.filters) {
    code += `\n  .where(${f.op}('${f.key}', '${f.value}'))`;
  }
  if (params.ownedBy) {
    code += `\n  .ownedBy('${params.ownedBy}')`;
  }
  if (params.orderBy) {
    code += `\n  .orderBy('${params.orderBy.key}', '${params.orderBy.valueType}', '${params.orderBy.direction}')`;
  }
  code += "\n  .withAttributes(true)";
  code += "\n  .withPayload(true)";
  code += `\n  .limit(${params.limit || 20})`;
  code += "\n  .fetch();";
  return code;
}

export async function POST(req: Request) {
  try {
    const { naturalLanguage } = await req.json();
    if (!naturalLanguage || typeof naturalLanguage !== "string") {
      return Response.json({ error: "naturalLanguage is required" }, { status: 400 });
    }

    // Step 1: Claude translates natural language to query params
    console.log(`[query] translating: "${naturalLanguage}"`);
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: naturalLanguage }],
    });

    const rawText = msg.content[0].type === "text" ? msg.content[0].text : "";
    let params: QueryParams;
    try {
      const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      params = JSON.parse(match ? match[1].trim() : rawText);
    } catch {
      return Response.json({
        explanation: "Could not parse Claude's response",
        queryCode: "",
        results: [],
        count: 0,
        error: `Parse error. Raw: ${rawText.slice(0, 200)}`,
      });
    }

    // Step 2: Build and execute QueryBuilder
    console.log(`[query] executing with ${params.filters.length} filters, limit ${params.limit}`);
    let q = publicClient.buildQuery().withAttributes(true).withPayload(true);

    for (const f of params.filters) {
      const predFn = OP_MAP[f.op];
      if (predFn) {
        q = q.where(predFn(f.key, f.value));
      }
    }

    if (params.ownedBy) {
      q = q.ownedBy(params.ownedBy as Hex);
    }

    if (params.orderBy) {
      q = q.orderBy(
        params.orderBy.key,
        params.orderBy.valueType as "string" | "number",
        params.orderBy.direction as "asc" | "desc"
      );
    }

    q = q.limit(params.limit || 20);

    const result = await q.fetch();
    console.log(`[query] found ${result.entities.length} entities`);

    const entities = result.entities.map((e) => {
      let payload: unknown = {};
      try { payload = e.toJson(); } catch { try { payload = { text: e.toText() }; } catch { /* */ } }
      return {
        entityId: e.key,
        payload,
        expiresAtBlock: e.expiresAtBlock?.toString() ?? null,
        attributes: e.attributes,
      };
    });

    // Step 3: Generate code string
    const queryCode = buildQueryCode(params);

    return Response.json({
      explanation: params.explanation,
      queryCode,
      results: entities,
      count: entities.length,
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed";
    console.error(`[query] error:`, message);
    return Response.json({
      explanation: "",
      queryCode: "",
      results: [],
      count: 0,
      error: message,
    });
  }
}
