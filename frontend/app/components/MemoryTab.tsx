// frontend/app/components/MemoryTab.tsx
// Displays all Arkiv entities. Filterable by type. Deleteable via DELETE /api/entity.

"use client";

import { useState, useEffect, useCallback } from "react";

type EntityItem = {
  entityId: string;
  payload: Record<string, unknown>;
  expiresAtBlock: string | null;
  attributes: { key: string; value: string }[];
};

const BLOCK_TIME = 2;

const TYPE_COLORS: Record<string, string> = {
  "final-report": "#534AB7",
  "readme-summary": "#378ADD",
  "code-analysis": "#EF9F27",
  "arkiv-evaluation": "#1D9E75",
  "connection-test": "#888888",
};

function truncateId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 10)}...${id.slice(-4)}`;
}

function TtlBarSmall({ expiresAtBlock }: { expiresAtBlock: string | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAtBlock) return;
    const expiresAt = Number(expiresAtBlock);
    let mounted = true;
    async function fetchBlock() {
      try {
        const res = await fetch("/api/block");
        const { blockNumber } = await res.json();
        if (mounted) setSecondsLeft(Math.max(0, (expiresAt - blockNumber) * BLOCK_TIME));
      } catch { /* */ }
    }
    fetchBlock();
    const i = setInterval(fetchBlock, 10000);
    return () => { mounted = false; clearInterval(i); };
  }, [expiresAtBlock]);

  if (secondsLeft === null) return null;

  const expiresAt = new Date(Date.now() + secondsLeft * 1000);
  const label = secondsLeft > 86400
    ? `Expires ${expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${expiresAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`
    : secondsLeft > 3600
    ? `${Math.floor(secondsLeft / 3600)}h ${Math.floor((secondsLeft % 3600) / 60)}m remaining`
    : secondsLeft > 60
    ? `${Math.floor(secondsLeft / 60)}m remaining`
    : `${secondsLeft}s remaining`;

  const isPersistent = secondsLeft > 86400;
  const color = isPersistent ? "#534AB7" : secondsLeft > 150 ? "#1D9E75" : secondsLeft > 60 ? "#EF9F27" : "#E24B4A";

  return (
    <div className="mt-2">
      <div className="h-1 w-full bg-[#2a2a2a] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: "100%", backgroundColor: color, opacity: 0.5 }} />
      </div>
      <div className="text-[10px] mt-1" style={{ color }}>{label}</div>
    </div>
  );
}

export default function MemoryTab() {
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (data.sessions) setEntities(data.sessions);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEntities(); }, [fetchEntities]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const i = setInterval(fetchEntities, 30000);
    return () => clearInterval(i);
  }, [fetchEntities]);

  async function handleDelete(key: string) {
    if (!window.confirm("Remove this entity from Arkiv permanently?")) return;
    setDeletingKeys((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/entity", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (data.success) {
        setEntities((prev) => prev.filter((e) => e.entityId !== key));
      }
    } catch { /* */ }
    setDeletingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
  }

  const types = Array.from(new Set(entities.map((e) => e.attributes.find((a) => a.key === "type")?.value).filter(Boolean))) as string[];
  const filtered = filter === "all" ? entities : entities.filter((e) => e.attributes.find((a) => a.key === "type")?.value === filter);

  return (
    <div>
      {/* Filter bar + refresh */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`text-[11px] px-3 py-1 rounded-full transition-colors ${filter === "all" ? "bg-[#1D9E75] text-white" : "bg-[#1a1a1a] text-[#888888] hover:text-[#f0f0f0]"}`}
        >
          All ({entities.length})
        </button>
        {types.map((t) => {
          const count = entities.filter((e) => e.attributes.find((a) => a.key === "type")?.value === t).length;
          const color = TYPE_COLORS[t] || "#888888";
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-[11px] px-3 py-1 rounded-full transition-colors ${filter === t ? "text-white" : "bg-[#1a1a1a] text-[#888888] hover:text-[#f0f0f0]"}`}
              style={filter === t ? { backgroundColor: color } : undefined}
            >
              {t} ({count})
            </button>
          );
        })}
        <button
          onClick={fetchEntities}
          disabled={loading}
          className="ml-auto text-[11px] px-3 py-1 rounded-full bg-[#1a1a1a] text-[#888888] hover:text-[#f0f0f0] disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Entity grid */}
      {filtered.length === 0 ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-8 text-center">
          <p className="text-[#888888] text-sm">No entities found on Arkiv. Run the pipeline to create some.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((entity) => {
            const entityType = entity.attributes.find((a) => a.key === "type")?.value || "unknown";
            const repo = entity.attributes.find((a) => a.key === "repo")?.value;
            const typeColor = TYPE_COLORS[entityType] || "#888888";
            const isDeleting = deletingKeys.has(entity.entityId);

            return (
              <div key={entity.entityId} className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 relative">
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(entity.entityId)}
                  disabled={isDeleting}
                  className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-[#888888] hover:text-[#E24B4A] transition-colors text-xs disabled:opacity-50"
                  title="Delete from Arkiv"
                >
                  {isDeleting ? "..." : "\u00d7"}
                </button>

                {/* Type badge + entity key + explorer */}
                <div className="flex items-center gap-2 mb-2 pr-5">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
                  >
                    {entityType}
                  </span>
                  <span className="font-mono text-[11px] text-[#888888]">
                    {truncateId(entity.entityId)}
                  </span>
                  <a
                    href={`https://explorer.kaolin.hoodi.arkiv.network/search-results?q=${entity.entityId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#888888] hover:text-[#f0f0f0] transition-colors"
                  >
                    view &rarr;
                  </a>
                </div>

                {/* Payload preview */}
                {entity.payload && (
                  <pre className="text-[10px] text-[#888888] font-mono whitespace-pre-wrap break-all max-h-16 overflow-hidden mb-1">
                    {JSON.stringify(entity.payload).slice(0, 120)}
                    {JSON.stringify(entity.payload).length > 120 ? "..." : ""}
                  </pre>
                )}

                {/* Repo */}
                {repo && <div className="text-[10px] text-[#888888] mb-1">{repo}</div>}

                {/* TTL */}
                <TtlBarSmall expiresAtBlock={entity.expiresAtBlock} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
