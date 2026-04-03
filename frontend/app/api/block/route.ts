// frontend/app/api/block/route.ts
// GET endpoint that fetches the current block number from Kaolin RPC.
// Used by the frontend to calculate TTL countdown timers.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch("https://kaolin.hoodi.arkiv.network/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 }),
    });

    const data = await res.json();
    const blockNumber = parseInt(data.result, 16);

    return Response.json({ blockNumber });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch block number" },
      { status: 500 }
    );
  }
}
