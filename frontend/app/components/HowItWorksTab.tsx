// frontend/app/components/HowItWorksTab.tsx
// Scroll-based explainer: pipeline overview, entity visualization, query animation.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Modal Data ───

const MODAL_DATA: Record<string, { tagColor: string; tag: string; title: string; steps: { num: string; color: string; text: string }[]; codeBlock: string }> = {
  agent1: {
    tagColor: "#EF9F27",
    tag: "Agent 1 \u00b7 README Reader",
    title: "Reads the README. Asks Claude what it means.",
    steps: [
      { num: "01", color: "#EF9F27", text: "Calls https://api.github.com/repos/{owner}/{repo}/contents/README.md using raw fetch(). No library. Pure GitHub REST API. The response arrives base64-encoded. Agent 1 decodes it to plain text." },
      { num: "02", color: "#EF9F27", text: "Sends the decoded README text to Claude with a structured prompt. Claude extracts: project name, one-sentence goal, tech stack mentioned in the text, and whether the Arkiv SDK is mentioned in the README description. Note: this is a text-level check, not a code check. Agent 2 does the real code inspection." },
      { num: "03", color: "#EF9F27", text: "Writes one entity to Arkiv with TTL 300 seconds (5 minutes). This is working memory \u2014 it exists only long enough for Agent 3 to read it." },
    ],
    codeBlock: `attributes written to Arkiv:
{ key: 'type',      value: 'readme-summary' }
{ key: 'sessionId', value: 'a3f9b2...' }
{ key: 'repo',      value: 'fabianferno/clink' }`,
  },
  agent2: {
    tagColor: "#EF9F27",
    tag: "Agent 2 \u00b7 Code Analyzer",
    title: "Reads the actual code. Finds Arkiv SDK usage.",
    steps: [
      { num: "01", color: "#EF9F27", text: "Calls https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1 to get the full list of all files in the repo. Pure GitHub REST API." },
      { num: "02", color: "#EF9F27", text: "Picks files using a priority system:\nPriority 1 \u2014 always reads package.json first.\nPriority 2 \u2014 any file whose path contains 'arkiv', 'client', 'db', 'storage', 'entity', or 'memory'. These are most likely to contain SDK usage.\nPriority 3 \u2014 fills remaining slots with other .ts/.js source files.\nMaximum 8 files total. Skips node_modules, dist, test files." },
      { num: "03", color: "#EF9F27", text: "Sends all file contents to Claude. Claude checks: is @arkiv-network/sdk in package.json? Which files import it? Which SDK functions are actually called in the source code?" },
      { num: "04", color: "#EF9F27", text: "Writes one entity to Arkiv with TTL 300 seconds." },
    ],
    codeBlock: `payload written:
{ language, framework, fileCount,
  arkivUsage: {
    found: true,
    files: ['src/lib/arkiv.ts'],
    observations: 'createEntity used, no queryBuilder found'
  }
}`,
  },
  agent3: {
    tagColor: "#378ADD",
    tag: "Agent 3 \u00b7 Arkiv Expert",
    title: "Queries Arkiv. Scores actual SDK usage from 0 to 10.",
    steps: [
      { num: "01", color: "#378ADD", text: "Receives only the session label as input. Nothing else. Queries Arkiv twice using buildQuery() to find what Agents 1 and 2 wrote during this run. No direct access to their variables." },
      { num: "02", color: "#378ADD", text: "Loads the full Arkiv SDK type definitions from the installed package at runtime. This is the actual source of truth injected into Claude's context, not a summary." },
      { num: "03", color: "#378ADD", text: "Sends both entity payloads plus the full SDK types to Claude. Claude scores the project's actual SDK usage 0 to 10 based only on confirmed code evidence. A project with no SDK import scores 0." },
      { num: "04", color: "#378ADD", text: "Writes one entity to Arkiv with TTL 300 seconds." },
    ],
    codeBlock: `scoring scale:
0   \u2192 SDK not found anywhere in the repo
1   \u2192 in package.json but no imports in source code
2-3 \u2192 client setup only
4-5 \u2192 createEntity OR buildQuery, not both
6-7 \u2192 createEntity + buildQuery + expiresIn + attributes
8-9 \u2192 QueryBuilder predicates + event subscriptions or batch
10  \u2192 comprehensive usage across all SDK features`,
  },
  agent4: {
    tagColor: "#8b7cf8",
    tag: "Agent 4 \u00b7 Reporter",
    title: "Reads everything from Arkiv. Writes the report that survives.",
    steps: [
      { num: "01", color: "#8b7cf8", text: "Queries Arkiv for all 3 entities from this run using the session label. Verifies all three are present before continuing." },
      { num: "02", color: "#8b7cf8", text: "Sends all three payloads to Claude. Claude synthesizes a final structured report: project overview, tech stack, Arkiv fit score, recommendations, and a one-line verdict." },
      { num: "03", color: "#8b7cf8", text: "Writes the final report entity with TTL 2,592,000 seconds (30 days). All other entities from this run expire within 5 minutes. This one persists for a month." },
      { num: "04", color: "#8b7cf8", text: "Because this entity persists, future runs can compare across projects. Which repos scored above 7? What SDK features do most developers miss? All answerable by querying Arkiv without re-running any analysis." },
    ],
    codeBlock: `attributes written:
{ key: 'type',      value: 'final-report' }
{ key: 'sessionId', value: 'a3f9b2...' }
{ key: 'repo',      value: 'fabianferno/clink' }
{ key: 'date',      value: '2026-04-03' }`,
  },
};

// ─── Entity cards data ───

const ENTITY_CARDS = [
  { type: "readme-summary", pillBg: "#001a10", pillColor: "#1D9E75", pillBorder: "#0a3a20", key: "0x4a2f...c91b", ttlText: "4m 32s", ttlColor: "#1D9E75", barPct: 91 },
  { type: "code-analysis", pillBg: "#0a1a2a", pillColor: "#378ADD", pillBorder: "#1a3a5a", key: "0x8d1e...a04c", ttlText: "1m 58s", ttlColor: "#EF9F27", barPct: 38 },
  { type: "arkiv-signal", pillBg: "#1a1000", pillColor: "#EF9F27", pillBorder: "#3a2a00", key: "0x36f2...01b0", ttlText: "1m 12s", ttlColor: "#EF9F27", barPct: 22 },
  { type: "final-report", pillBg: "#0e0a1a", pillColor: "#8b7cf8", pillBorder: "#2a1a4a", key: "0x899818...cce8", ttlText: "30 days", ttlColor: "#8b7cf8", barPct: 100 },
];

const TOOLTIPS: Record<string, string> = {
  payload: "The actual data stored. A JSON object encoded to bytes. Contains the agent's findings from this run.",
  attributes: "Key-value tags used for querying. Like column indexes in a database. You filter by these with eq() or gte().",
  TTL: "Time-to-live. The chain auto-deletes this entity after N blocks. No manual cleanup needed by the developer.",
  owner: "The wallet that created this entity. 0xa618...1C6. Only the owner can update or delete it.",
};

// ─── Scroll reveal hook ───

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, style: { opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: "opacity 0.4s ease, transform 0.4s ease" } as React.CSSProperties };
}

// ─── Tooltip chip ───

function Chip({ label }: { label: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "4px", padding: "2px 6px", fontSize: "9px", color: "#555", cursor: "help" }} className="group">
      {label}
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "14px", height: "14px", borderRadius: "50%", background: "#1a1a1a", border: "1px solid var(--border)", color: "#666", fontSize: "9px", fontWeight: 700, marginLeft: "4px" }}>i</span>
      <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px", fontSize: "10px", color: "#888", lineHeight: 1.6, width: "180px", zIndex: 50, fontFamily: "var(--font-mono)" }}>
        {TOOLTIPS[label]}
      </span>
    </span>
  );
}

// ─── Main Component ───

export default function HowItWorksTab() {
  const [modalId, setModalId] = useState<string | null>(null);
  const [shownLines, setShownLines] = useState<number[]>([]);
  const [responseVisible, setResponseVisible] = useState(false);
  const animRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const sec2 = useReveal();
  const sec3 = useReveal();

  const clearTimers = useCallback(() => { animRef.current.forEach(clearTimeout); animRef.current = []; }, []);

  function runBuildAnim(showResponse = false) {
    clearTimers();
    setShownLines([]);
    setResponseVisible(false);
    for (let i = 0; i < 7; i++) {
      const t = setTimeout(() => setShownLines((p) => [...p, i]), (i + 1) * 280);
      animRef.current.push(t);
    }
    if (showResponse) {
      const t = setTimeout(() => setResponseVisible(true), 7 * 280 + 300);
      animRef.current.push(t);
    }
  }

  useEffect(() => () => clearTimers(), [clearTimers]);

  const modal = modalId ? MODAL_DATA[modalId] : null;

  // ─── Pipeline nodes ───
  const nodes: { id: string; label: string; bg: string; border: string; color: string; isArkiv?: boolean }[] = [
    { id: "", label: "GitHub\nRepo", bg: "#111", border: "#2a2a2a", color: "#888" },
    { id: "agent1", label: "Agent 1\nREADME", bg: "#1a1000", border: "#3a2a00", color: "#EF9F27" },
    { id: "arkiv1", label: "ARKIV\nwrites", bg: "#001a10", border: "#0a3a20", color: "#1D9E75", isArkiv: true },
    { id: "agent2", label: "Agent 2\nCode", bg: "#1a1000", border: "#3a2a00", color: "#EF9F27" },
    { id: "arkiv2", label: "ARKIV\nwrites", bg: "#001a10", border: "#0a3a20", color: "#1D9E75", isArkiv: true },
    { id: "agent3", label: "Agent 3\nExpert", bg: "#0a1a2a", border: "#1a3a5a", color: "#378ADD" },
    { id: "arkiv3", label: "ARKIV\nreads+writes", bg: "#001a10", border: "#0a3a20", color: "#1D9E75", isArkiv: true },
    { id: "agent4", label: "Agent 4\nReporter", bg: "#0e0a1a", border: "#2a1a4a", color: "#8b7cf8" },
  ];

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* ── SECTION 1: Pipeline overview ── */}
      <div style={{ marginBottom: "40px" }}>
        <div style={{ fontSize: "11px", color: "#444", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "6px" }}>Overview</div>
        <h2 style={{ fontSize: "16px", color: "#f0f0f0", fontWeight: 700, marginBottom: "8px" }}>Four agents. One memory layer.</h2>
        <p style={{ fontSize: "13px", color: "#666", lineHeight: 1.8, maxWidth: "560px", marginBottom: "16px" }}>
          You give a GitHub repo URL. Four agents run in sequence. No agent receives another agent&apos;s output as a function call. The only way they communicate is through Arkiv &mdash; a blockchain memory layer. Remove Arkiv and the system breaks.
        </p>

        {/* Pipeline strip */}
        <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", display: "flex", alignItems: "center", gap: "8px", overflowX: "auto" }}>
          {nodes.map((node, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {i > 0 && <span style={{ color: "#2a2a2a", fontSize: "14px", padding: "0 4px", flexShrink: 0 }}>&rarr;</span>}
              <div
                onClick={() => node.id.startsWith("agent") ? setModalId(node.id) : undefined}
                style={{
                  background: node.bg, border: `${node.isArkiv ? "2px" : "1px"} solid ${node.border}`, color: node.color,
                  borderRadius: "8px", padding: "10px 14px", fontSize: node.isArkiv ? "9px" : "10px", fontWeight: 700,
                  letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center",
                  minWidth: node.isArkiv ? "70px" : "90px", flexShrink: 0, whiteSpace: "pre-line",
                  cursor: node.id.startsWith("agent") ? "pointer" : "default",
                }}
              >
                {node.label}
                {node.id.startsWith("agent") && (
                  <div style={{ fontSize: "8px", color: "#444", fontWeight: 400, textTransform: "none", marginTop: "3px" }}>click to explore</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "8px", fontSize: "10px", color: "#444", fontFamily: "var(--font-mono)" }}>
          Sequential execution &middot; Kaolin testnet &middot; Chain ID 60138453025 &middot; Wallet 0xa618A2736431f24C26F1C8Dac9CA00ECc845a1C6
        </div>
      </div>

      {/* ── SECTION 2: What is an entity ── */}
      <div ref={sec2.ref} style={{ ...sec2.style, borderTop: "1px solid #1a1a1a", paddingTop: "40px", marginBottom: "40px" }}>
        <div style={{ fontSize: "11px", color: "#444", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "6px" }}>The memory layer</div>
        <h2 style={{ fontSize: "16px", color: "#f0f0f0", fontWeight: 700, marginBottom: "8px" }}>What is an entity?</h2>
        <p style={{ fontSize: "13px", color: "#666", lineHeight: 1.8, marginBottom: "16px" }}>
          An entity is a row in a database table &mdash; except no company controls the database. It lives on the Arkiv blockchain, it is queryable by attributes, and it automatically deletes itself after a set time. This is what the agents use as shared memory.
        </p>

        <div style={{ background: "var(--bg-deep)", border: "2px solid #0a3a20", borderRadius: "12px", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1D9E75", animation: "chainDotAnim 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "9px", color: "#1D9E75", fontWeight: 700, letterSpacing: "0.15em" }}>ARKIV KAOLIN &middot; LIVE ENTITIES</span>
          </div>

          {ENTITY_CARDS.map((card, idx) => (
            <div key={idx} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px 16px", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 8px", borderRadius: "10px", background: card.pillBg, color: card.pillColor, border: `1px solid ${card.pillBorder}` }}>{card.type}</span>
                <span style={{ fontSize: "10px", color: "#555", flex: 1, fontFamily: "var(--font-mono)" }}>{card.key}</span>
                <span style={{ fontSize: "9px", fontWeight: 700, color: card.ttlColor }}>{card.ttlText}</span>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                {Object.keys(TOOLTIPS).map((k) => <Chip key={k} label={k} />)}
              </div>
              <div style={{ height: "3px", borderRadius: "2px", marginTop: "8px", background: "#1a1a1a" }}>
                <div style={{ height: "100%", borderRadius: "2px", width: `${card.barPct}%`, background: card.ttlColor }} />
              </div>
              {idx === 3 && (
                <div style={{ fontSize: "9px", color: "#555", marginTop: "6px" }}>
                  This is the only entity that outlives the session. Working memory from Agents 1, 2, and 3 has already expired.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 3: Query animation ── */}
      <div ref={sec3.ref} style={{ ...sec3.style, borderTop: "1px solid #1a1a1a", paddingTop: "40px", paddingBottom: "48px" }}>
        <div style={{ fontSize: "11px", color: "#444", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "6px" }}>Under the hood</div>
        <h2 style={{ fontSize: "16px", color: "#f0f0f0", fontWeight: 700, marginBottom: "8px" }}>How Agent 3 reads from Arkiv.</h2>
        <p style={{ fontSize: "13px", color: "#666", lineHeight: 1.8, marginBottom: "16px" }}>
          Agent 3 has no access to Agent 1 or Agent 2&apos;s variables. It receives only a session label. It builds a query and executes it against the Kaolin chain. Here is exactly what happens.
        </p>

        <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", fontFamily: "var(--font-mono)", fontSize: "10px", lineHeight: 1.8, overflow: "hidden" }}>
          {[
            [{ text: "const ", c: "#378ADD" }, { text: "result ", c: "#555" }, { text: "= await ", c: "#378ADD" }, { text: "publicClient", c: "#555" }],
            [{ text: "  .buildQuery", c: "#1D9E75" }, { text: "()", c: "#555" }],
            [{ text: "  .where", c: "#1D9E75" }, { text: "(", c: "#555" }, { text: "eq", c: "#8b7cf8" }, { text: "(", c: "#555" }, { text: "'sessionId'", c: "#EF9F27" }, { text: ", ", c: "#555" }, { text: "'a3f9b2...'", c: "#EF9F27" }, { text: "))", c: "#555" }],
            [{ text: "  .where", c: "#1D9E75" }, { text: "(", c: "#555" }, { text: "eq", c: "#8b7cf8" }, { text: "(", c: "#555" }, { text: "'type'", c: "#EF9F27" }, { text: ", ", c: "#555" }, { text: "'readme-summary'", c: "#EF9F27" }, { text: "))", c: "#555" }],
            [{ text: "  .withAttributes", c: "#1D9E75" }, { text: "(", c: "#555" }, { text: "true", c: "#378ADD" }, { text: ")", c: "#555" }],
            [{ text: "  .withPayload", c: "#1D9E75" }, { text: "(", c: "#555" }, { text: "true", c: "#378ADD" }, { text: ")", c: "#555" }],
            [{ text: "  .fetch", c: "#1D9E75" }, { text: "();", c: "#555" }],
          ].map((tokens, i) => (
            <div key={i} style={{ opacity: shownLines.includes(i) ? 1 : 0, transform: shownLines.includes(i) ? "translateX(0)" : "translateX(-6px)", transition: "opacity 0.4s ease, transform 0.4s ease" }}>
              {tokens.map((t, j) => <span key={j} style={{ color: t.c }}>{t.text}</span>)}
            </div>
          ))}
        </div>

        <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
          <button onClick={() => runBuildAnim(false)} style={{ background: "#0a1a2a", border: "1px solid #1a3a5a", color: "#378ADD", padding: "7px 16px", borderRadius: "6px", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
            Build query &rarr;
          </button>
          <button onClick={() => runBuildAnim(true)} style={{ background: "#001a10", border: "1px solid #0a3a20", color: "#1D9E75", padding: "7px 16px", borderRadius: "6px", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
            Show Arkiv response &rarr;
          </button>
        </div>

        <div style={{ opacity: responseVisible ? 1 : 0, transition: "opacity 0.5s ease", background: "#001a10", border: "1px solid #0a3a20", borderRadius: "8px", padding: "12px", marginTop: "10px", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.8, color: "#1D9E75" }}>
          {`result.entities \u2192 [
  {
    key: "0x4a2f...c91b",
    payload: { name: "clink", usesArkiv: true },
    attributes: [{ key: "type", value: "readme-summary" }],
    expiresAtBlock: 2441849
  }
]`}
        </div>

        <div style={{ fontSize: "10px", color: "#444", marginTop: "8px", fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
          eq() means exactly equal to. gte() means greater than or equal to &mdash; useful for filtering by score, date, or any number. These are filter functions from the Arkiv SDK passed into .where() in the query builder.
        </div>
      </div>

      {/* ── MODAL ── */}
      {modal && (
        <div onClick={() => setModalId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "14px", width: "min(520px, 92vw)", maxHeight: "80vh", overflowY: "auto", padding: "24px", position: "relative", animation: "modalReveal 0.25s ease" }}>
            <button onClick={() => setModalId(null)} style={{ position: "absolute", top: "14px", right: "16px", background: "none", border: "none", color: "#444", fontSize: "18px", cursor: "pointer", fontFamily: "var(--font-mono)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f0f0")} onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}>&times;</button>
            <span style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: modal.tagColor }}>{modal.tag}</span>
            <h3 style={{ fontSize: "16px", color: "#f0f0f0", fontWeight: 700, marginTop: "6px", marginBottom: "14px" }}>{modal.title}</h3>
            {modal.steps.map((step) => (
              <div key={step.num} style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px 16px", marginBottom: "8px", display: "flex", gap: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: step.color, flexShrink: 0, marginTop: "1px" }}>{step.num}</span>
                <span style={{ fontSize: "13px", color: "#666", lineHeight: 1.8, whiteSpace: "pre-line" }}>{step.text}</span>
              </div>
            ))}
            <pre style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "6px", padding: "10px", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.8, color: "#888", margin: "10px 0", whiteSpace: "pre" }}>{modal.codeBlock}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
