// frontend/app/page.tsx
// Three-tab dashboard: Run | Memory | Query
// Run tab: 2x2 agent grid + "SEE FINAL RESULT" button + modal

"use client";

import { useState, useRef, useCallback } from "react";
import HowItWorksTab from "./components/HowItWorksTab";
import MemoryTab from "./components/MemoryTab";
import QueryTab from "./components/QueryTab";
import AgentCard from "./components/AgentCard";

// --- Types ---

type AgentEvent = {
  type: "agent-start" | "agent-log" | "agent-done" | "pipeline-done" | "error";
  agentId?: string;
  message?: string;
  entityId?: string;
  txHash?: string;
  payload?: Record<string, unknown>;
  report?: Record<string, unknown>;
  sessionId?: string;
};

type LogEntry = { time: string; message: string; highlight?: boolean; success?: boolean };

type AgentState = {
  status: "idle" | "running" | "done" | "waiting";
  logs: LogEntry[];
  entityId?: string;
  txHash?: string;
  payload?: Record<string, unknown>;
};

// --- Constants ---

const AGENTS = [
  { id: "agent1", name: "README Reader", order: 1 },
  { id: "agent2", name: "Code Analyzer", order: 2 },
  { id: "agent3", name: "Arkiv Expert", order: 3 },
  { id: "agent4", name: "Reporter", order: 4 },
] as const;

const PROVENANCE = [
  { agentId: "agent1", label: "readme-summary", bg: "#001a10", color: "#1D9E75" },
  { agentId: "agent2", label: "code-analysis", bg: "#0a1a2a", color: "#378ADD" },
  { agentId: "agent3", label: "arkiv-signal", bg: "#1a1000", color: "#EF9F27" },
  { agentId: "agent4", label: "final-report", bg: "#0e0a1a", color: "#8b7cf8" },
];

// --- Helpers ---

function now(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function logEntry(message: string, opts?: { highlight?: boolean; success?: boolean }): LogEntry {
  return { time: now(), message, ...opts };
}

function truncKey(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function explorerUrl(txHash?: string, entityId?: string): string {
  if (txHash) return `https://explorer.kaolin.hoodi.arkiv.network/tx/${txHash}`;
  if (entityId) return `https://explorer.kaolin.hoodi.arkiv.network/entity/${entityId}`;
  return "#";
}

// --- Section title helper ---
function SectionTitle({ children }: { children: string }) {
  return (
    <h3 style={{ fontSize: "10px", color: "#444", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px", fontWeight: 700 }}>
      {children}
    </h3>
  );
}

// --- Report Modal ---

function ReportModal({
  agents,
  onClose,
}: {
  agents: Record<string, AgentState>;
  onClose: () => void;
}) {
  const a4 = agents.agent4.payload as Record<string, unknown> | undefined;
  const a3 = agents.agent3.payload as Record<string, unknown> | undefined;
  if (!a4) return null;

  const projectName = (a4.projectName as string) || "Unknown Project";
  const summary = (a4.oneLineSummary as string) || (a4.goal as string) || "";
  const techStack = (a4.techStack as string[]) || [];
  // Score schema: new = scores.total (0-100, ETHLisbon rubric).
  // Legacy fallback: arkivFitScore (0-10), scaled ×10 for color thresholds.
  const scoresObj = (a4.scores as Record<string, number> | undefined) || {};
  const score = scoresObj.total ?? ((a4.arkivFitScore as number ?? 0) * 10);
  const scoreColor = score <= 40 ? "#E24B4A" : score <= 70 ? "#EF9F27" : "#1D9E75";
  const scoreBreakdown = scoresObj.codeQuality != null ? {
    codeQuality: scoresObj.codeQuality,
    novelty: scoresObj.novelty,
    demoPolish: scoresObj.demoPolish,
    builderBehavior: scoresObj.builderBehavior,
  } : null;
  const status = (a4.status as string) || "";
  const featuresUsed = (a4.featuresUsed as string[]) || [];
  const featuresMissed = (a4.featuresMissed as string[]) || [];
  const recommendations = (a4.recommendations as string[]) || [];
  const verdict = (a3?.verdict as string) || (a4.verdict as string) || "";
  const patternComparison = (a3?.patternComparison as string) || "";
  const repo = (a4.repo as string) || "";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#111",
          border: "1px solid #2a2a2a",
          borderRadius: "16px",
          width: "min(860px, 92vw)",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "28px 32px",
          position: "relative",
          scrollbarWidth: "thin",
          scrollbarColor: "#2a2a2a #111",
          animation: "modalFadeIn 0.25s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "16px", right: "20px", background: "none", border: "none", color: "#444", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f0f0")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
        >
          &times;
        </button>

        {/* SECTION A — Project header */}
        <div style={{ paddingBottom: "16px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#f0f0f0", fontFamily: "'Courier New', monospace" }}>
            {projectName}
          </h2>
          <p style={{ fontSize: "13px", color: "#888", marginTop: "6px" }}>{summary}</p>
          {repo && (
            <span style={{ display: "inline-block", background: "#1a1a1a", color: "#666", fontSize: "10px", padding: "2px 8px", borderRadius: "10px", marginTop: "8px" }}>
              {repo}
            </span>
          )}
        </div>

        {/* SECTION B — Metrics */}
        <div style={{ borderTop: "1px solid #1a1a1a", padding: "16px 0" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontWeight: 700, color: scoreColor }}>{score}<span style={{ fontSize: "13px", color: "#666", marginLeft: "2px" }}>/100</span></div>
              <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "4px" }}>ETHLisbon Score{status ? ` · ${status}` : ""}</div>
            </div>
            <div style={{ flex: 1, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "#1D9E75" }}>{featuresUsed.length}</div>
              <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "4px" }}>Features Used</div>
            </div>
            <div style={{ flex: 1, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "#EF9F27" }}>{featuresMissed.length}</div>
              <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "4px" }}>Features Missed</div>
            </div>
          </div>
        </div>

        {/* SECTION B2 — Score breakdown (ETHLisbon rubric 35/25/20/20) */}
        {scoreBreakdown && (
          <div style={{ borderTop: "1px solid #1a1a1a", padding: "16px 0" }}>
            <SectionTitle>Score Breakdown</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
              {[
                { label: "Code · 35%", value: scoreBreakdown.codeQuality },
                { label: "Novelty · 25%", value: scoreBreakdown.novelty },
                { label: "Demo · 20%", value: scoreBreakdown.demoPolish },
                { label: "Builder · 20%", value: scoreBreakdown.builderBehavior },
              ].map((c) => (
                <div key={c.label} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#f0f0f0" }}>{c.value ?? "?"}</div>
                  <div style={{ fontSize: "9.5px", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "2px" }}>{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION C — Tech stack */}
        {techStack.length > 0 && (
          <div style={{ borderTop: "1px solid #1a1a1a", padding: "16px 0" }}>
            <SectionTitle>Tech Stack</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {techStack.map((t, i) => (
                <span key={i} style={{ background: "#1a1a1a", color: "#888", fontSize: "11px", padding: "3px 10px", borderRadius: "20px", border: "1px solid #2a2a2a" }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SECTION D — Features used */}
        {featuresUsed.length > 0 && (
          <div style={{ borderTop: "1px solid #1a1a1a", padding: "16px 0" }}>
            <SectionTitle>Features Used</SectionTitle>
            {featuresUsed.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", fontSize: "13px", fontFamily: "monospace", marginBottom: "3px" }}>
                <span style={{ color: "#1D9E75" }}>&check;</span>
                <span style={{ color: "#1D9E75" }}>{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* SECTION E — Features missed */}
        {featuresMissed.length > 0 && (
          <div style={{ borderTop: "1px solid #1a1a1a", padding: "16px 0" }}>
            <SectionTitle>Features Missed</SectionTitle>
            {featuresMissed.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", fontSize: "13px", fontFamily: "monospace", marginBottom: "3px" }}>
                <span style={{ color: "#EF9F27" }}>&cir;</span>
                <span style={{ color: "#EF9F27" }}>{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* SECTION F — Recommendations */}
        {recommendations.length > 0 && (
          <div style={{ borderTop: "1px solid #1a1a1a", padding: "16px 0" }}>
            <SectionTitle>Recommendations</SectionTitle>
            {recommendations.map((rec, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", fontSize: "13px", lineHeight: 1.8, marginBottom: "2px" }}>
                <span style={{ color: "#1D9E75", flexShrink: 0 }}>+</span>
                <span style={{ color: "#f0f0f0" }}>{rec}</span>
              </div>
            ))}
          </div>
        )}

        {/* SECTION G — Verdict + pattern comparison */}
        {verdict && (
          <div style={{ borderTop: "1px solid #1a1a1a", padding: "16px 0" }}>
            <SectionTitle>Verdict</SectionTitle>
            <p style={{ fontSize: "13px", color: "#888", fontStyle: "italic", lineHeight: 1.6 }}>{verdict}</p>
          </div>
        )}
        {patternComparison && (
          <div style={{ borderTop: "1px solid #1a1a1a", padding: "16px 0" }}>
            <SectionTitle>Compared to Known Projects</SectionTitle>
            <p style={{ fontSize: "13px", color: "#888", lineHeight: 1.6 }}>{patternComparison}</p>
          </div>
        )}

        {/* SECTION H — Entity provenance */}
        <div style={{ borderTop: "1px solid #1a1a1a", padding: "16px 0 0" }}>
          <SectionTitle>Stored on Arkiv</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {PROVENANCE.map((p) => {
              const a = agents[p.agentId];
              if (!a?.entityId) return null;
              return (
                <div key={p.agentId} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", background: p.bg, color: p.color, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>
                    {p.label}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#666", flex: 1 }}>
                    {truncKey(a.entityId)}
                  </span>
                  <a
                    href={explorerUrl(a.txHash, a.entityId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "10px", color: "#444", textDecoration: "none" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#1D9E75")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
                  >
                    view &rarr;
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

const TABS = [
  { id: "how", label: "How It Works" },
  { id: "run", label: "Run" },
  { id: "memory", label: "Memory" },
  { id: "query", label: "Query" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("how");
  const [repoUrl, setRepoUrl] = useState("https://github.com/fabianferno/clink");
  const [running, setRunning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [agents, setAgents] = useState<Record<string, AgentState>>({
    agent1: { status: "idle", logs: [] },
    agent2: { status: "idle", logs: [] },
    agent3: { status: "idle", logs: [] },
    agent4: { status: "idle", logs: [] },
  });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const agent4Done = agents.agent4.status === "done";

  const handleRun = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setShowModal(false);
    setError(null);
    setAgents({
      agent1: { status: "waiting", logs: [] },
      agent2: { status: "waiting", logs: [] },
      agent3: { status: "waiting", logs: [] },
      agent4: { status: "waiting", logs: [] },
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setError(`API error: ${res.status}`);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataLine = line.replace(/^data: /, "").trim();
          if (!dataLine) continue;

          let event: AgentEvent;
          try {
            event = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (event.type === "agent-start" && event.agentId) {
            setAgents((prev) => ({
              ...prev,
              [event.agentId!]: {
                ...prev[event.agentId!],
                status: "running",
                logs: [...prev[event.agentId!].logs, logEntry(event.message || "Starting...", { highlight: true })],
              },
            }));
          } else if (event.type === "agent-log" && event.agentId) {
            setAgents((prev) => ({
              ...prev,
              [event.agentId!]: {
                ...prev[event.agentId!],
                logs: [...prev[event.agentId!].logs, logEntry(event.message || "")],
              },
            }));
          } else if (event.type === "agent-done" && event.agentId) {
            setAgents((prev) => ({
              ...prev,
              [event.agentId!]: {
                status: "done",
                logs: [...prev[event.agentId!].logs, logEntry("Entity written to Arkiv", { success: true })],
                entityId: event.entityId,
                txHash: event.txHash,
                payload: event.payload as Record<string, unknown>,
              },
            }));
          } else if (event.type === "error") {
            setError(event.message || "Unknown error");
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setRunning(false);
    }
  }, [repoUrl, running]);

  return (
    <main style={{ minHeight: "100vh", maxWidth: "1200px", margin: "0 auto", padding: "0 40px" }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-page)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.05em", lineHeight: 1, userSelect: "none", whiteSpace: "nowrap" }}>[ A ]</div>
          <div style={{ width: "1px", height: "20px", background: "var(--border)" }} />
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-primary)", lineHeight: 1.2 }}>Arkiv Agent Memory</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#777", letterSpacing: "0.1em", marginTop: "2px" }}>Multi-agent pipeline &middot; Kaolin testnet</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "9px", fontFamily: "var(--font-mono)", color: "#666", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          <span className="chain-dot" />
          <span>Live &middot; Chain 60138453025</span>
        </div>
      </header>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, padding: "0 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-page)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "14px 20px",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: activeTab === tab.id ? "var(--accent-green)" : "var(--text-muted)",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent-green)" : "2px solid transparent",
              transition: "all 0.2s",
              marginBottom: "-1px",
            }}
            onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Run tab — always mounted, visibility toggled */}
      <div style={{ display: activeTab === "run" ? "block" : "none", padding: "24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          {/* Input bar */}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px", marginBottom: "20px" }}>
            <label style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.15em", display: "block", marginBottom: "8px", fontWeight: 600 }}>
              GitHub Repository URL
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                disabled={running}
                style={{ flex: 1, background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)", outline: "none", transition: "border-color 0.2s", opacity: running ? 0.5 : 1 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-green)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <button
                onClick={handleRun}
                disabled={running || !repoUrl}
                style={{ background: running ? "#666" : "var(--accent-green)", color: "#000", border: "none", borderRadius: "8px", padding: "10px 20px", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: running ? "not-allowed" : "pointer", transition: "background 0.2s, transform 0.1s" }}
                onMouseEnter={(e) => { if (!running) e.currentTarget.style.background = "#17a878"; }}
                onMouseLeave={(e) => { if (!running) e.currentTarget.style.background = "var(--accent-green)"; }}
              >
                {running ? "Running..." : "Analyze"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "10px", color: "#777", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", padding: "10px 0", borderTop: "1px solid var(--border-subtle)", marginTop: "4px" }}>
            <span>4 agents run in sequence</span>
            <span style={{ color: "#555" }}>&middot;</span>
            <span>~60&ndash;90s total</span>
            <span style={{ color: "#555" }}>&middot;</span>
            <span>each agent writes to Arkiv before the next starts</span>
            <span style={{ color: "#555" }}>&middot;</span>
            <span style={{ color: "var(--accent-green)" }}>working memory: 5 min TTL &middot; final report: 30 days</span>
          </div>

          {error && (
            <div className="bg-[#E24B4A]/10 border border-[#E24B4A]/30 text-[#E24B4A] text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          {/* 2x2 Agent grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {AGENTS.map((agent) => (
              <AgentCard
                key={agent.id}
                agentId={agent.id as "agent1" | "agent2" | "agent3" | "agent4"}
                name={agent.name}
                status={agents[agent.id].status}
                logs={agents[agent.id].logs}
                entityId={agents[agent.id].entityId}
                txHash={agents[agent.id].txHash}
                payload={agents[agent.id].payload}
              />
            ))}
          </div>

          {/* SEE FINAL RESULT button */}
          {agent4Done && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                width: "100%",
                height: "48px",
                marginTop: "16px",
                background: "linear-gradient(135deg, #0a3a20, #1D9E75)",
                color: "#000",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "opacity 0.2s, transform 0.1s",
                animation: "buttonReveal 0.3s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              SEE FINAL RESULT &rarr;
            </button>
          )}
        </div>
      </div>

      {/* How It Works tab */}
      {activeTab === "how" && <HowItWorksTab />}

      {/* Memory tab */}
      {activeTab === "memory" && <div style={{ padding: "0 24px" }}><MemoryTab /></div>}

      {/* Query tab */}
      {activeTab === "query" && <div style={{ padding: "0 24px" }}><QueryTab /></div>}

      {/* Modal */}
      {showModal && <ReportModal agents={agents} onClose={() => setShowModal(false)} />}
    </main>
  );
}
