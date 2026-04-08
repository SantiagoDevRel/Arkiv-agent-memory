// frontend/app/api/run/route.ts
// POST endpoint that runs the full agent pipeline and streams progress via SSE.
// The client sends { repoUrl } and receives a stream of JSON events.
// Each event is sent as: data: <json>\n\n
// Event shapes:
//   { type: "agent-start", agentId, message }
//   { type: "agent-done", agentId, entityId, payload, message }
//   { type: "pipeline-done", report, entityId, sessionId }
//   { type: "error", message }

import { runPipeline } from "../../../src-backend/index";
import type { AgentEvent } from "../../../src-backend/index";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { repoUrl } = await req.json();

  if (!repoUrl || typeof repoUrl !== "string") {
    return new Response(JSON.stringify({ error: "repoUrl is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream may have been closed by the client
        }
      };

      try {
        await runPipeline(repoUrl, send);
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown pipeline error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
