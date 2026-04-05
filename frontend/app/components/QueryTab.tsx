// frontend/app/components/QueryTab.tsx
// Hardcoded smart query buttons that fetch from /api/sessions with filters.

"use client";

import { useState, useRef } from "react";
import CopyButton from "./CopyButton";

type EntityResult = {
  entityId: string;
  payload: Record<string, unknown>;
  expiresAtBlock: string | null;
  attributes: { key: string; value: string }[];
};

const TYPE_COLORS: Record<string, string> = {
  "final-report": "var(--accent-purple)",
  "readme-summary": "var(--accent-green)",
  "code-analysis": "var(--accent-blue)",
  "arkiv-evaluation": "var(--accent-amber)",
};

function truncId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

const QUERIES = [
  { label: "All final reports", code: ".where(eq('type', 'final-report'))", params: "?type=final-report" },
  { label: "Clink \u2014 event platform", code: ".where(eq('repo', 'fabianferno/clink'))", params: "?repo=fabianferno/clink" },
  { label: "Ocean \u2014 collaborative workspace", code: ".where(eq('repo', 'the-pines/ocean'))", params: "?repo=the-pines/ocean" },
  { label: "Create Arkiv App \u2014 CLI tool", code: ".where(eq('repo', 'DruxAMB/Create-Arkiv-App'))", params: "?repo=DruxAMB/Create-Arkiv-App" },
  { label: "Mentor Graph \u2014 trust layer", code: ".where(eq('repo', 'understories/mentor-graph'))", params: "?repo=understories/mentor-graph" },
  { label: "All README summaries", code: ".where(eq('type', 'readme-summary'))", params: "?type=readme-summary" },
  { label: "DeFi Radar \u2014 yield dashboard", code: ".where(eq('repo', 'SantiagoDevRel/defi-radar'))", params: "?repo=SantiagoDevRel/defi-radar" },
  { label: "All code analyses", code: ".where(eq('type', 'code-analysis'))", params: "?type=code-analysis" },
];

export default function QueryTab() {
  const [active, setActive] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EntityResult[]>([]);
  const [fullQuery, setFullQuery] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  async function runQuery(idx: number) {
    const q = QUERIES[idx];
    setActive(idx);
    setLoading(true);
    setResults([]);
    setFullQuery(`publicClient.buildQuery()\n  ${q.code}\n  .withAttributes(true)\n  .withPayload(true)\n  .limit(20)\n  .fetch()`);

    try {
      const [data] = await Promise.all([
        fetch(`/api/sessions${q.params}`).then((r) => r.json()),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
      setResults(data.sessions || []);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch { /* */ }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px 0" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginBottom: "4px" }}>
        Query Arkiv memory
      </h2>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px" }}>
        Select a preset query to execute against the Kaolin chain.
      </p>

      <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: "12px", fontWeight: 600 }}>
        QUICK QUERIES
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
        {QUERIES.map((q, i) => (
          <button
            key={i}
            onClick={() => runQuery(i)}
            style={{
              background: active === i ? "#0d1a14" : "var(--bg-panel)",
              border: `1px solid ${active === i ? "var(--accent-green)" : "var(--border)"}`,
              borderRadius: "10px",
              padding: "14px 16px",
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color 0.2s, background 0.2s",
              width: "100%",
            }}
            onMouseEnter={(e) => { if (active !== i) { e.currentTarget.style.borderColor = "var(--accent-green)"; e.currentTarget.style.background = "#0d1a14"; } }}
            onMouseLeave={(e) => { if (active !== i) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-panel)"; } }}
          >
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>{q.label}</div>
            <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--accent-green)", opacity: 0.8, lineHeight: 1.6 }}>{q.code}</div>
          </button>
        ))}
      </div>

      {/* Results section */}
      {active !== null && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.15em", fontWeight: 600 }}>RESULTS</span>
            <span style={{ fontSize: "10px", color: "var(--accent-green)" }}>{loading ? "..." : `${results.length} entities found`}</span>
          </div>

          <div style={{ position: "relative", marginBottom: "16px" }}>
            <CopyButton text={fullQuery} />
            <pre style={{ background: "var(--bg-deep)", border: "1px solid var(--border-subtle)", borderLeft: "2px solid var(--accent-green)", borderRadius: "0 8px 8px 0", padding: "12px 16px", fontSize: "13px", fontFamily: "var(--font-mono)", color: "var(--accent-green)", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{fullQuery}</pre>
          </div>

          <div ref={resultsRef} />
          {loading ? (
            <div style={{ padding: "28px 0", display: "flex", alignItems: "center", gap: "12px", fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--accent-green)", letterSpacing: "0.05em" }}>
              <span style={{ animation: "chainPulse 0.7s ease-in-out infinite", fontSize: "14px" }}>&cir;</span>
              Querying Kaolin chain...
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "13px" }}>No entities found for this query.</div>
          ) : (
            results.map((entity) => {
              const entityType = entity.attributes.find((a) => a.key === "type")?.value || "unknown";
              const repo = entity.attributes.find((a) => a.key === "repo")?.value;
              const typeColor = TYPE_COLORS[entityType] || "var(--text-muted)";
              const p = entity.payload;
              const projectName = (p.projectName as string) || (p.name as string) || "";
              const summary = ((p.oneLineSummary || p.goal || "") as string).slice(0, 120);

              return (
                <div key={entity.entityId} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", padding: "3px 10px", borderRadius: "20px", letterSpacing: "0.08em", background: `${typeColor}18`, color: typeColor }}>{entityType}</span>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", flex: 1 }}>{truncId(entity.entityId)}</span>
                    <a href={`https://explorer.kaolin.hoodi.arkiv.network/search-results?q=${entity.entityId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "var(--text-muted)", textDecoration: "none" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-green)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>view &rarr;</a>
                  </div>
                  {projectName && <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: "10px 0 4px" }}>{projectName}</div>}
                  {summary && <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{summary}{summary.length >= 120 ? "..." : ""}</div>}
                  {repo && <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "6px" }}>{repo}</div>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
