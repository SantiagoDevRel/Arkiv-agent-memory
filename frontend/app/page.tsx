// frontend/app/page.tsx
// Three-tab dashboard: Run | Memory | Query
// Run tab has two layout modes: idle (centered single column) and active (two columns).

"use client";

import { useState, useRef, useCallback } from "react";
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

// --- Helpers ---

function now(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function logEntry(message: string, opts?: { highlight?: boolean; success?: boolean }): LogEntry {
  return { time: now(), message, ...opts };
}

// --- Final Report Component (redesigned) ---

function FinalReport({ report, entityId, txHash }: { report: Record<string, unknown>; entityId: string; txHash?: string }) {
  const r = report as {
    projectName?: string;
    oneLineSummary?: string;
    goal?: string;
    techStack?: string[];
    arkivFitScore?: number;
    featuresUsed?: string[];
    featuresMissed?: string[];
    recommendations?: string[];
    verdict?: string;
    patternComparison?: string;
  };

  const score = r.arkivFitScore ?? 0;
  const scoreColor = score <= 3 ? "#E24B4A" : score <= 6 ? "#EF9F27" : "#1D9E75";

  return (
    <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "20px" }}>
      {/* Header */}
      <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#f0f0f0", marginBottom: "4px" }}>
        {r.projectName || "Unknown Project"}
      </h2>
      <p style={{ fontSize: "13px", color: "#888", marginBottom: "12px" }}>
        {r.oneLineSummary || r.goal || ""}
      </p>

      <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "12px", marginBottom: "12px" }}>
        {/* Metrics row */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <div style={{ flex: 1, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: scoreColor }}>{score}</div>
            <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>Fit Score</div>
          </div>
          <div style={{ flex: 1, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#1D9E75" }}>{r.featuresUsed?.length ?? 0}</div>
            <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>Features Used</div>
          </div>
          <div style={{ flex: 1, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#EF9F27" }}>{r.featuresMissed?.length ?? 0}</div>
            <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>Features Missed</div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {r.recommendations && r.recommendations.length > 0 && (
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "12px", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
            Recommendations
          </h3>
          {r.recommendations.map((rec, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", fontSize: "13px", lineHeight: 1.7, marginBottom: "4px" }}>
              <span style={{ color: "#1D9E75", flexShrink: 0 }}>+</span>
              <span style={{ color: "#f0f0f0" }}>{rec}</span>
            </div>
          ))}
        </div>
      )}

      {/* Verdict */}
      {r.verdict && (
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "12px", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
            Verdict
          </h3>
          <p style={{ fontSize: "13px", color: "#888", fontStyle: "italic", lineHeight: 1.6 }}>{r.verdict}</p>
        </div>
      )}

      {/* Pattern comparison */}
      {r.patternComparison && (
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "12px", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
            Compared to known projects
          </h3>
          <p style={{ fontSize: "13px", color: "#888", lineHeight: 1.6 }}>{r.patternComparison}</p>
        </div>
      )}

      {/* Entity info footer */}
      <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", background: "#0e0a1a", color: "#8b7cf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          final-report
        </span>
        <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#666", flex: 1 }}>
          {entityId.length > 14 ? `${entityId.slice(0, 8)}...${entityId.slice(-4)}` : entityId}
        </span>
        <a
          href={txHash
            ? `https://explorer.kaolin.hoodi.arkiv.network/tx/${txHash}`
            : `https://explorer.kaolin.hoodi.arkiv.network/search-results?q=${entityId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "10px", color: "#444", textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#1D9E75")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
        >
          view &rarr;
        </a>
      </div>
    </div>
  );
}

// --- Main Page ---

const TABS = [
  { id: "run", label: "Run" },
  { id: "memory", label: "Memory" },
  { id: "query", label: "Query" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("run");
  const [repoUrl, setRepoUrl] = useState("https://github.com/fabianferno/clink");
  const [running, setRunning] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"idle" | "active">("idle");
  const [agents, setAgents] = useState<Record<string, AgentState>>({
    agent1: { status: "idle", logs: [] },
    agent2: { status: "idle", logs: [] },
    agent3: { status: "idle", logs: [] },
    agent4: { status: "idle", logs: [] },
  });
  const [finalReport, setFinalReport] = useState<{ report: Record<string, unknown>; entityId: string; txHash?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleRun = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setLayoutMode("active");
    setError(null);
    setFinalReport(null);
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
          } else if (event.type === "pipeline-done") {
            setFinalReport({
              report: (event.report || {}) as Record<string, unknown>,
              entityId: event.entityId || "",
              txHash: event.txHash,
            });
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

  // --- Shared input block ---
  const inputBlock = (
    <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "16px", marginBottom: "12px" }}>
      <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "8px" }}>
        GitHub Repository URL
      </label>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          disabled={running}
          className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f0] placeholder-[#888888] focus:outline-none focus:border-[#534AB7] disabled:opacity-50"
        />
        <button
          onClick={handleRun}
          disabled={running || !repoUrl}
          className="px-4 py-2 bg-[#534AB7] text-white text-sm font-medium rounded-lg hover:bg-[#6355c7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? "Running..." : "Analyze"}
        </button>
      </div>
    </div>
  );

  // --- Agent cards block ---
  const agentCards = (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
  );

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#f0f0f0]">Arkiv Agent Memory</h1>
        <p className="text-sm text-[#888888] mt-1">
          Multi-agent pipeline analyzing GitHub repos with on-chain memory on Kaolin testnet
        </p>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-[#2a2a2a] mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-[13px] font-medium transition-colors ${
              activeTab === tab.id
                ? "text-[#f0f0f0] border-b-2 border-[#1D9E75]"
                : "text-[#888888] hover:text-[#f0f0f0]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Run tab — always mounted, visibility toggled */}
      <div style={{ display: activeTab === "run" ? "block" : "none" }}>

        {/* MODE A — Idle: single centered column */}
        {layoutMode === "idle" && (
          <div style={{ maxWidth: "680px", margin: "0 auto" }}>
            {inputBlock}
            {error && (
              <div className="bg-[#E24B4A]/10 border border-[#E24B4A]/30 text-[#E24B4A] text-sm rounded-lg p-3 mb-3">
                {error}
              </div>
            )}
            {agentCards}
          </div>
        )}

        {/* MODE B — Active: two columns */}
        {layoutMode === "active" && (
          <div style={{ display: "grid", gridTemplateColumns: "55% 45%", gap: "20px" }}>
            {/* Left column — grows naturally, no internal scroll */}
            <div>
              {inputBlock}
              {error && (
                <div className="bg-[#E24B4A]/10 border border-[#E24B4A]/30 text-[#E24B4A] text-sm rounded-lg p-3 mb-3">
                  {error}
                </div>
              )}
              {agentCards}
            </div>

            {/* Right column — sticky report */}
            <div style={{ position: "sticky", top: "20px", alignSelf: "start", maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
              {finalReport ? (
                <FinalReport report={finalReport.report} entityId={finalReport.entityId} txHash={finalReport.txHash} />
              ) : (
                <div style={{
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: "12px",
                  padding: "40px 20px",
                  textAlign: "center",
                }}>
                  {running ? (
                    <div>
                      <div className="thinking-dots" style={{ justifyContent: "center", marginBottom: "12px" }}>
                        <span /><span /><span />
                      </div>
                      <p style={{ color: "#888", fontSize: "13px" }}>Pipeline running &mdash; report will appear here...</p>
                    </div>
                  ) : (
                    <p style={{ color: "#555", fontSize: "13px" }}>Report will appear here after analysis</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Memory tab */}
      {activeTab === "memory" && <MemoryTab />}

      {/* Query tab */}
      {activeTab === "query" && <QueryTab />}
    </main>
  );
}
