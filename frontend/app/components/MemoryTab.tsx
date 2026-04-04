// frontend/app/components/MemoryTab.tsx
// Full-width single-column view of all Arkiv entities. Filterable, deleteable.

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
  "final-report": "var(--accent-purple)",
  "readme-summary": "var(--accent)",
  "code-analysis": "var(--accent-blue)",
  "arkiv-evaluation": "var(--accent-amber)",
  "connection-test": "var(--text-muted)",
};

function truncId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function TtlRow({ expiresAtBlock, type }: { expiresAtBlock: string | null; type: string }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAtBlock) return;
    const expiresAt = Number(expiresAtBlock);
    let mounted = true;
    async function fetch_() {
      try {
        const res = await fetch("/api/block");
        const { blockNumber } = await res.json();
        if (mounted) setSecondsLeft(Math.max(0, (expiresAt - blockNumber) * BLOCK_TIME));
      } catch { /* */ }
    }
    fetch_();
    const i = setInterval(fetch_, 10000);
    return () => { mounted = false; clearInterval(i); };
  }, [expiresAtBlock]);

  if (secondsLeft === null) return null;

  const isPersistent = type === "final-report";
  const pct = isPersistent ? 100 : Math.min(100, (secondsLeft / 300) * 100);
  const color = isPersistent ? "var(--accent-purple)" : pct > 60 ? "var(--accent)" : pct > 20 ? "var(--accent-amber)" : "var(--accent-red)";

  const expiresAt = new Date(Date.now() + secondsLeft * 1000);
  const expiryLabel = secondsLeft > 86400
    ? `Expires ${expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${expiresAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`
    : secondsLeft > 3600
    ? `${Math.floor(secondsLeft / 3600)}h ${Math.floor((secondsLeft % 3600) / 60)}m remaining`
    : secondsLeft > 60
    ? `${Math.floor(secondsLeft / 60)}m remaining`
    : `${secondsLeft}s remaining`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
      <span style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>TTL</span>
      <div style={{ flex: 1, height: "4px", background: "#1a1a1a", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: "2px", width: `${pct}%`, background: color, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: "11px", fontWeight: 500, color, whiteSpace: "nowrap" }}>{expiryLabel}</span>
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
  useEffect(() => { const i = setInterval(fetchEntities, 30000); return () => clearInterval(i); }, [fetchEntities]);

  async function handleDelete(key: string) {
    if (!window.confirm("Remove this entity from Arkiv permanently?")) return;
    setDeletingKeys((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/entity", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      const data = await res.json();
      if (data.success) setEntities((prev) => prev.filter((e) => e.entityId !== key));
    } catch { /* */ }
    setDeletingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
  }

  const types = Array.from(new Set(entities.map((e) => e.attributes.find((a) => a.key === "type")?.value).filter(Boolean))) as string[];
  const filtered = filter === "all" ? entities : entities.filter((e) => e.attributes.find((a) => a.key === "type")?.value === filter);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px 0" }}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setFilter("all")} style={{ padding: "8px 16px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: "6px", fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", transition: "all 0.2s", background: filter === "all" ? "var(--accent)" : "var(--bg-card)", color: filter === "all" ? "#000" : "var(--text-muted)", border: `1px solid ${filter === "all" ? "var(--accent)" : "var(--border)"}` }}>
          All ({entities.length})
        </button>
        {types.map((t) => {
          const count = entities.filter((e) => e.attributes.find((a) => a.key === "type")?.value === t).length;
          const active = filter === t;
          return (
            <button key={t} onClick={() => setFilter(t)} style={{ padding: "8px 16px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: "6px", fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", transition: "all 0.2s", background: active ? "var(--accent)" : "var(--bg-card)", color: active ? "#000" : "var(--text-muted)", border: `1px solid ${active ? "var(--accent)" : "var(--border)"}` }}>
              {t} ({count})
            </button>
          );
        })}
        <button onClick={fetchEntities} disabled={loading} style={{ marginLeft: "auto", padding: "8px 16px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          {loading ? "..." : "\u21bb Refresh"}
        </button>
      </div>

      {/* Entity cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: "32px", color: "var(--text-muted)", marginBottom: "8px" }}>&cir;</div>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>No entities found on Arkiv</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Run the pipeline to create some</div>
        </div>
      ) : (
        filtered.map((entity) => {
          const entityType = entity.attributes.find((a) => a.key === "type")?.value || "unknown";
          const repo = entity.attributes.find((a) => a.key === "repo")?.value;
          const typeColor = TYPE_COLORS[entityType] || "var(--text-muted)";
          const p = entity.payload;
          const projectName = (p.projectName as string) || (p.name as string) || "";
          const summary = ((p.oneLineSummary || p.goal || p.summary || "") as string).slice(0, 120);

          return (
            <div key={entity.entityId} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px", marginBottom: "12px", transition: "border-color 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
              {/* Top row */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", padding: "3px 10px", borderRadius: "20px", letterSpacing: "0.08em", background: `${typeColor}18`, color: typeColor }}>{entityType}</span>
                <span style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", color: "var(--text-muted)", flex: 1 }}>{truncId(entity.entityId)}</span>
                <a href={`https://explorer.kaolin.hoodi.arkiv.network/search-results?q=${entity.entityId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "var(--text-muted)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>view &rarr;</a>
                <button onClick={() => handleDelete(entity.entityId)} disabled={deletingKeys.has(entity.entityId)} style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--text-muted)", fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-red)"; e.currentTarget.style.background = "rgba(226,75,74,0.1)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "none"; }}>{deletingKeys.has(entity.entityId) ? "..." : "\u00d7"}</button>
              </div>

              {projectName && <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: "10px 0 4px" }}>{projectName}</div>}
              {summary && <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "10px" }}>{summary}{summary.length >= 120 ? "..." : ""}</div>}
              {repo && <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "12px" }}>{repo}</div>}

              <TtlRow expiresAtBlock={entity.expiresAtBlock} type={entityType} />
            </div>
          );
        })
      )}
    </div>
  );
}
