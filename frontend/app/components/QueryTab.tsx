// frontend/app/components/QueryTab.tsx
// Natural language query interface for Arkiv.
// Shows: input, explanation, generated QueryBuilder code, results.

"use client";

import { useState } from "react";

type EntityResult = {
  entityId: string;
  payload: Record<string, unknown>;
  expiresAtBlock: string | null;
  attributes: { key: string; value: string }[];
};

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

const EXAMPLE_QUERIES = [
  "Show all final reports",
  "Find entities for repo fabianferno/clink",
  "Show the most recent readme summaries",
];

export default function QueryTab() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [queryCode, setQueryCode] = useState("");
  const [results, setResults] = useState<EntityResult[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());

  async function handleSubmit() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    setExplanation("");
    setQueryCode("");
    setResults([]);
    setCount(0);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naturalLanguage: input }),
      });
      const data = await res.json();
      setExplanation(data.explanation || "");
      setQueryCode(data.queryCode || "");
      setResults(data.results || []);
      setCount(data.count || 0);
      if (data.error) setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }

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
        setResults((prev) => prev.filter((e) => e.entityId !== key));
        setCount((prev) => prev - 1);
      }
    } catch { /* */ }
    setDeletingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Input area */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-5 mb-4">
        <label className="text-sm font-medium text-[#f0f0f0] block mb-1">
          Query your Arkiv memory in plain English
        </label>
        <p className="text-[11px] text-[#888888] mb-3">
          Example: &quot;Show me all final reports&quot; or &quot;Find all entities of type readme-summary for repo fabianferno/clink&quot;
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Ask anything about your stored data..."
            disabled={loading}
            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f0] placeholder-[#888888] focus:outline-none focus:border-[#534AB7] disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-[#534AB7] text-white text-sm font-medium rounded-lg hover:bg-[#6355c7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Querying..." : "Query \u2192"}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="text-[11px] px-3 py-1 rounded-full bg-[#1a1a1a] text-[#888888] hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#E24B4A]/10 border border-[#E24B4A]/30 text-[#E24B4A] text-sm rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {/* Query translation */}
      {queryCode && (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 mb-4">
          <h3 className="text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">
            Generated QueryBuilder Code
          </h3>
          <pre className="bg-[#0a0a0a] rounded-lg p-4 font-mono text-[12px] text-[#1D9E75] overflow-x-auto leading-relaxed">
            {queryCode}
          </pre>
          {explanation && (
            <p className="text-[11px] text-[#888888] mt-3">{explanation}</p>
          )}
        </div>
      )}

      {/* Results */}
      {(queryCode || results.length > 0) && (
        <div>
          <div className="text-xs text-[#888888] mb-3">
            Found <span className="text-[#f0f0f0] font-medium">{count}</span> entities
          </div>
          {results.length === 0 ? (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-6 text-center">
              <p className="text-[#888888] text-sm">No entities matched your query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {results.map((entity) => {
                const entityType = entity.attributes.find((a) => a.key === "type")?.value || "unknown";
                const repo = entity.attributes.find((a) => a.key === "repo")?.value;
                const typeColor = TYPE_COLORS[entityType] || "#888888";
                const isDeleting = deletingKeys.has(entity.entityId);

                return (
                  <div key={entity.entityId} className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 relative">
                    <button
                      onClick={() => handleDelete(entity.entityId)}
                      disabled={isDeleting}
                      className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-[#888888] hover:text-[#E24B4A] transition-colors text-xs disabled:opacity-50"
                    >
                      {isDeleting ? "..." : "\u00d7"}
                    </button>
                    <div className="flex items-center gap-2 mb-2 pr-5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${typeColor}20`, color: typeColor }}>
                        {entityType}
                      </span>
                      <span className="font-mono text-[11px] text-[#888888]">{truncateId(entity.entityId)}</span>
                      <a
                        href={`https://explorer.kaolin.hoodi.arkiv.network/search-results?q=${entity.entityId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#888888] hover:text-[#f0f0f0] transition-colors"
                      >
                        view &rarr;
                      </a>
                    </div>
                    <pre className="text-[10px] text-[#888888] font-mono whitespace-pre-wrap break-all max-h-16 overflow-hidden mb-1">
                      {JSON.stringify(entity.payload).slice(0, 120)}
                      {JSON.stringify(entity.payload).length > 120 ? "..." : ""}
                    </pre>
                    {repo && <div className="text-[10px] text-[#888888]">{repo}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
