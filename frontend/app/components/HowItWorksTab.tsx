// frontend/app/components/HowItWorksTab.tsx
// Scroll-based explainer: pipeline overview, entity visualization, query animation.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CopyButton from "./CopyButton";

// ─── Modal Data ───

const MODAL_DATA: Record<string, { tagColor: string; tag: string; title: string; steps: { num: string; color: string; text: string }[]; codeBlock: string }> = {
  agent1: {
    tagColor: "#EF9F27",
    tag: "Agent 1 \u00b7 README Reader",
    title: "Reads the README. Asks Claude what it means.",
    steps: [
      { num: "01", color: "#EF9F27", text: "Fetches README.md from the GitHub REST API using raw fetch(). Response arrives base64-encoded and is decoded to plain text." },
      { num: "02", color: "#EF9F27", text: "Sends the README text to Claude. Extracts: project name, goal, tech stack, and whether Arkiv SDK is mentioned." },
      { num: "03", color: "#EF9F27", text: "Writes one entity to Arkiv. TTL: 300 seconds (5 minutes). Working memory \u2014 exists only long enough for Agent 3 to read it." },
    ],
    codeBlock: "{ type: 'readme-summary', sessionId, repo }",
  },
  agent2: {
    tagColor: "#EF9F27",
    tag: "Agent 2 \u00b7 Code Analyzer",
    title: "Reads the actual code. Finds Arkiv SDK usage.",
    steps: [
      { num: "01", color: "#EF9F27", text: "Fetches the full file tree from GitHub REST API. Gets list of all files in the repo." },
      { num: "02", color: "#EF9F27", text: "Picks up to 8 files using a priority system: package.json first, then any file with 'arkiv' in the path, then other source files." },
      { num: "03", color: "#EF9F27", text: "Sends all file contents to Claude. Checks: is @arkiv-network/sdk installed? Which files import it? Which functions are called?" },
      { num: "04", color: "#EF9F27", text: "Writes one entity to Arkiv. TTL: 300 seconds." },
    ],
    codeBlock: `{ language, framework, fileCount,
  arkivUsage: { found: true, files: [...] } }`,
  },
  agent3: {
    tagColor: "#378ADD",
    tag: "Agent 3 \u00b7 Arkiv Expert",
    title: "Queries Arkiv. Scores actual SDK usage from 0 to 10.",
    steps: [
      { num: "01", color: "#378ADD", text: "Receives only the session label. Queries Arkiv twice with buildQuery() to retrieve what Agents 1 and 2 wrote." },
      { num: "02", color: "#378ADD", text: "Loads full Arkiv SDK type definitions from node_modules at runtime. This is the expert knowledge Claude uses to evaluate." },
      { num: "03", color: "#378ADD", text: "Scores actual SDK usage 0\u201310. Based only on confirmed code evidence \u2014 not claims or potential." },
      { num: "04", color: "#378ADD", text: "Writes one entity to Arkiv. TTL: 300 seconds." },
    ],
    codeBlock: `0   \u2192 SDK not found
1   \u2192 in package.json, no imports
2-3 \u2192 client setup only
4-5 \u2192 createEntity OR buildQuery
6-7 \u2192 both + expiresIn + attributes
8-9 \u2192 predicates + event subscriptions
10  \u2192 comprehensive usage`,
  },
  agent4: {
    tagColor: "#8b7cf8",
    tag: "Agent 4 \u00b7 Reporter",
    title: "Reads everything from Arkiv. Writes the report that survives.",
    steps: [
      { num: "01", color: "#8b7cf8", text: "Queries Arkiv for all 3 entities from this run. Verifies all are present before continuing." },
      { num: "02", color: "#8b7cf8", text: "Sends all three payloads to Claude. Synthesizes final report: overview, fit score, recommendations, verdict." },
      { num: "03", color: "#8b7cf8", text: "Writes final report with TTL 2,592,000 seconds (30 days). The report that survives the session." },
      { num: "04", color: "#8b7cf8", text: "Agent 5 then publishes a tracker-row copy to the public dashboard." },
    ],
    codeBlock: "{ type: 'final-report', sessionId, repo, date }",
  },
  agent5: {
    tagColor: "#ec4899",
    tag: "Agent 5 \u00b7 Tracker Pusher",
    title: "Reads the final report. Publishes the row judges actually see.",
    steps: [
      { num: "01", color: "#ec4899", text: "Queries Arkiv for Agent 4's final-report entity in this session. Source of truth." },
      { num: "02", color: "#ec4899", text: "Sends the report to Claude. Asks for a single tracker-row JSON: project name, score, status, repo, judgedAt timestamp." },
      { num: "03", color: "#ec4899", text: "Writes one entity to Arkiv with TTL 30 days. Public dashboard reads it. Future hackathons inherit the dataset." },
      { num: "04", color: "#ec4899", text: "Optionally POSTs to TRACKER_API_URL if set. Arkiv is the source of truth either way \u2014 the API call is just a cache nudge." },
    ],
    codeBlock: "{ type: 'tracker-row', sessionId, repo, total }",
  },
};

// ─── Entity cards data ───

const ENTITY_CARDS = [
  { type: "readme-summary", pillBg: "#001a10", pillColor: "#1D9E75", pillBorder: "#0a3a20", key: "0x4a2f...c91b", ttlText: "4m 32s", ttlColor: "#1D9E75", barPct: 91 },
  { type: "code-analysis", pillBg: "#0a1a2a", pillColor: "#378ADD", pillBorder: "#1a3a5a", key: "0x8d1e...a04c", ttlText: "1m 58s", ttlColor: "#EF9F27", barPct: 38 },
  { type: "arkiv-signal", pillBg: "#1a1000", pillColor: "#EF9F27", pillBorder: "#3a2a00", key: "0x36f2...01b0", ttlText: "1m 12s", ttlColor: "#EF9F27", barPct: 22 },
  { type: "final-report", pillBg: "#0e0a1a", pillColor: "#8b7cf8", pillBorder: "#2a1a4a", key: "0x899818...cce8", ttlText: "30 days", ttlColor: "#8b7cf8", barPct: 100 },
  { type: "tracker-row", pillBg: "#1f0a14", pillColor: "#ec4899", pillBorder: "#3a0a28", key: "0xb1bdeb6c...4f12", ttlText: "30 days", ttlColor: "#ec4899", barPct: 100 },
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
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "4px", padding: "2px 6px", fontSize: "9px", color: "#888", cursor: "help" }} className="group">
      {label}
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "14px", height: "14px", borderRadius: "50%", background: "#1a1a1a", border: "1px solid var(--border)", color: "#666", fontSize: "9px", fontWeight: 700, marginLeft: "4px" }}>i</span>
      <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px", fontSize: "10px", color: "#aaa", lineHeight: 1.6, width: "180px", zIndex: 50, fontFamily: "var(--font-mono)" }}>
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

  // ─── Pipeline rows ───
  const pipelineRows: { id: string; label: string; accent: string; bg: string; border: string; arkiv: string; extra?: string }[] = [
    { id: "agent1", label: "AGENT 1 \u00b7 README READER", accent: "#5ECBAA", bg: "#0a1a16", border: "#1a3a2a", arkiv: "WRITES" },
    { id: "agent2", label: "AGENT 2 \u00b7 CODE ANALYZER", accent: "#EF9F27", bg: "#1a1000", border: "#3a2800", arkiv: "WRITES" },
    { id: "agent3", label: "AGENT 3 \u00b7 ARKIV EXPERT", accent: "#1D9E75", bg: "#001a10", border: "#0a3a20", arkiv: "READS + WRITES" },
    { id: "agent4", label: "AGENT 4 \u00b7 REPORTER", accent: "#8b7cf8", bg: "#0e0a1a", border: "#2a1a4a", arkiv: "READS + WRITES", extra: "(30 days)" },
    { id: "agent5", label: "AGENT 5 \u00b7 TRACKER PUSHER", accent: "#ec4899", bg: "#1f0a14", border: "#3a0a28", arkiv: "READS + WRITES", extra: "(30d \u00b7 public)" },
  ];

  const Connector = () => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", paddingLeft: "32px", margin: "4px 0" }}>
      <div style={{ width: "2px", height: "20px", background: "var(--accent-green)", opacity: 0.4 }} />
      <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "7px solid var(--accent-green)", opacity: 0.4, marginLeft: "-4px" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 48px" }}>
      {/* ── SECTION 1: Pipeline overview ── */}
      <div style={{ marginBottom: "40px" }}>
        <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>01 &middot; Overview</div>
        <h2 style={{ fontSize: "20px", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px" }}>Five agents. One memory layer.</h2>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8, maxWidth: "760px", marginBottom: "16px" }}>
          You give a GitHub repo URL. Five agents run in sequence. No agent receives another agent&apos;s output as a function call. The only way they communicate is through Arkiv &mdash; a blockchain memory layer. Remove Arkiv and the system breaks. Agent 5 (the ETHLisbon addition) publishes the final tracker row to the public dashboard.
        </p>

        {/* Vertical pipeline */}
        <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
          {/* GitHub repo row */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px 16px", textAlign: "center", marginBottom: "0" }}>
            <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>GITHUB REPO URL</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>github.com/fabianferno/clink</div>
          </div>

          {pipelineRows.map((row) => (
            <div key={row.id}>
              <Connector />
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* Agent node */}
                <div
                  onClick={() => setModalId(row.id)}
                  style={{ flex: 1, background: row.bg, border: `1px solid ${row.border}`, borderLeft: `3px solid ${row.accent}`, borderRadius: "10px", padding: "14px 18px", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.15)")}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
                >
                  <div style={{ fontSize: "12px", fontWeight: 700, color: row.accent, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>{row.label}</div>
                  <div style={{ fontSize: "10px", color: row.accent, marginTop: "4px" }}>click to explore &rarr;</div>
                </div>
                {/* Arrow */}
                <span style={{ fontSize: "18px", color: "var(--accent-green)", opacity: 0.5, flexShrink: 0 }}>&rarr;</span>
                {/* Arkiv node */}
                <div style={{ width: "160px", flexShrink: 0, background: "#001a10", border: "1px solid #0a3a20", borderRadius: "10px", padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "var(--accent-green)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>ARKIV</div>
                  <div style={{ fontSize: "9px", color: "var(--accent-green)", opacity: 0.6, marginTop: "2px" }}>{row.arkiv}</div>
                  {row.extra && <div style={{ fontSize: "9px", color: "var(--accent-purple)", marginTop: "2px" }}>{row.extra}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "10px", fontSize: "11px", color: "#777", fontFamily: "var(--font-mono)" }}>
          Sequential execution &middot; Kaolin testnet &middot; Chain ID 60138453025 &middot; Wallet 0xa618...1C6
        </div>
      </div>

      {/* ── SECTION 2: What is an entity ── */}
      <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "0 0 80px 0" }} />
      <div ref={sec2.ref} style={{ ...sec2.style, marginBottom: "40px" }}>
        <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>02 &middot; The memory layer</div>
        <h2 style={{ fontSize: "20px", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px" }}>What is an entity?</h2>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: "16px" }}>
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
                <span style={{ fontSize: "10px", color: "#888", flex: 1, fontFamily: "var(--font-mono)" }}>{card.key}</span>
                <span style={{ fontSize: "9px", fontWeight: 700, color: card.ttlColor }}>{card.ttlText}</span>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                {Object.keys(TOOLTIPS).map((k) => <Chip key={k} label={k} />)}
              </div>
              <div style={{ height: "3px", borderRadius: "2px", marginTop: "8px", background: "#1a1a1a" }}>
                <div style={{ height: "100%", borderRadius: "2px", width: `${card.barPct}%`, background: card.ttlColor }} />
              </div>
              {idx === 3 && (
                <div style={{ fontSize: "9px", color: "#888", marginTop: "6px" }}>
                  Final report — survives 30 days. Working memory from Agents 1, 2, and 3 has already expired.
                </div>
              )}
              {idx === 4 && (
                <div style={{ fontSize: "9px", color: "#888", marginTop: "6px" }}>
                  Tracker row — Agent 5 publishes this for the public ETHLisbon dashboard. Same 30d TTL.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "0 0 80px 0" }} />
      {/* ── SECTION 3: Query animation ── */}
      <div ref={sec3.ref} style={{ ...sec3.style, paddingBottom: "48px" }}>
        <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>03 &middot; Under the hood</div>
        <h2 style={{ fontSize: "20px", color: "var(--text-primary)", fontWeight: 700, marginBottom: "8px" }}>How Agent 3 reads from Arkiv.</h2>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: "16px" }}>
          Agent 3 has no access to Agent 1 or Agent 2&apos;s variables. It receives only a session label. It builds a query and executes it against the Kaolin chain. Here is exactly what happens.
        </p>

        <div style={{ position: "relative", background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px", fontFamily: "var(--font-mono)", fontSize: "12px", lineHeight: 1.8, overflow: "hidden" }}>
          <CopyButton text={`const result = await publicClient\n  .buildQuery()\n  .where(eq('sessionId', 'a3f9b2...'))\n  .where(eq('type', 'readme-summary'))\n  .withAttributes(true)\n  .withPayload(true)\n  .fetch();`} />
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
          <button onClick={() => runBuildAnim(false)} style={{ background: "#0a1a2a", border: "1px solid #1a3a5a", color: "#378ADD", padding: "7px 16px", borderRadius: "6px", fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
            Build query &rarr;
          </button>
          <button onClick={() => runBuildAnim(true)} style={{ background: "#001a10", border: "1px solid #0a3a20", color: "#1D9E75", padding: "7px 16px", borderRadius: "6px", fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
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

        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
          eq() means exactly equal to. gte() means greater than or equal to &mdash; useful for filtering by score, date, or any number. These are filter functions from the Arkiv SDK passed into .where() in the query builder.
        </div>
      </div>

      {/* ── MODAL ── */}
      {modal && (
        <div onClick={() => setModalId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "14px", width: "min(640px, 92vw)", maxHeight: "80vh", overflowY: "auto", padding: "28px 32px", position: "relative", animation: "modalReveal 0.25s ease" }}>
            <button onClick={() => setModalId(null)} style={{ position: "absolute", top: "14px", right: "16px", background: "none", border: "none", color: "#444", fontSize: "18px", cursor: "pointer", fontFamily: "var(--font-mono)" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f0f0")} onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}>&times;</button>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: modal.tagColor }}>{modal.tag}</span>
            <h3 style={{ fontSize: "20px", color: "var(--text-primary)", fontWeight: 700, marginTop: "6px", marginBottom: "14px" }}>{modal.title}</h3>
            {modal.steps.map((step) => (
              <div key={step.num} style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px 16px", marginBottom: "8px", display: "flex", gap: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: step.color, flexShrink: 0, marginTop: "1px" }}>{step.num}</span>
                <span style={{ fontSize: "14px", color: "#888", lineHeight: 1.8, whiteSpace: "pre-line" }}>{step.text}</span>
              </div>
            ))}
            <div style={{ position: "relative", margin: "10px 0" }}>
              <CopyButton text={modal.codeBlock} />
              <pre style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "6px", padding: "10px", fontSize: "11px", fontFamily: "var(--font-mono)", lineHeight: 1.8, color: "#aaa", whiteSpace: "pre" }}>{modal.codeBlock}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
