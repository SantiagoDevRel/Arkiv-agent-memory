// frontend/app/page.tsx
// Single page dashboard for the Arkiv Agent Memory pipeline.
// Left column: repo input, agent activity panels, live entity cards.
// Right column: final report, past sessions.

"use client";

import { useState, useRef, useEffect, useCallback } from "react";

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

type LogEntry = { time: string; message: string };

type AgentState = {
  status: "idle" | "running" | "done" | "waiting";
  logs: LogEntry[];
  entityId?: string;
  txHash?: string;
  payload?: Record<string, unknown>;
};

type PastSession = {
  entityId: string;
  payload: Record<string, unknown>;
  expiresAtBlock: string | null;
  attributes: { key: string; value: string }[];
};

// --- Constants ---

const AGENTS = [
  { id: "agent1", name: "README Reader", order: 1 },
  { id: "agent2", name: "Code Analyzer", order: 2 },
  { id: "agent3", name: "Arkiv Expert", order: 3 },
  { id: "agent4", name: "Reporter", order: 4 },
] as const;

const BLOCK_TIME_SECONDS = 2;

// --- Helpers ---

function now(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function logEntry(message: string): LogEntry {
  return { time: now(), message };
}

function truncateId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 10)}...${id.slice(-4)}`;
}

function statusColor(status: AgentState["status"]): string {
  switch (status) {
    case "running": return "bg-[#EF9F27]";
    case "done": return "bg-[#1D9E75]";
    case "waiting": return "bg-[#378ADD]";
    default: return "bg-[#888888]";
  }
}

function statusLabel(status: AgentState["status"]): string {
  switch (status) {
    case "running": return "Running";
    case "done": return "Done";
    case "waiting": return "Waiting";
    default: return "Idle";
  }
}

// --- TTL Bar Component ---

function TtlBar({ expiresAtBlock }: { expiresAtBlock?: string | number | bigint | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAtBlock) return;
    const expiresAt = Number(expiresAtBlock);

    let mounted = true;
    async function fetchBlock() {
      try {
        const res = await fetch("/api/block");
        const { blockNumber } = await res.json();
        const blocksLeft = expiresAt - blockNumber;
        const secs = Math.max(0, blocksLeft * BLOCK_TIME_SECONDS);
        if (mounted) {
          setSecondsLeft(secs);
          setTotalSeconds((prev) => prev ?? secs);
        }
      } catch { /* ignore */ }
    }

    fetchBlock();
    const interval = setInterval(fetchBlock, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, [expiresAtBlock]);

  if (secondsLeft === null || totalSeconds === null || totalSeconds === 0) return null;

  const pct = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));
  const color = pct > 50 ? "#1D9E75" : pct > 20 ? "#EF9F27" : "#E24B4A";
  const label = secondsLeft > 3600
    ? `${Math.floor(secondsLeft / 3600)}h ${Math.floor((secondsLeft % 3600) / 60)}m`
    : secondsLeft > 60
    ? `${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s`
    : `${secondsLeft}s`;

  const expiresAt = new Date(Date.now() + secondsLeft * 1000);
  const expiryDate = expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const expiryTime = expiresAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="mt-2">
      <div className="flex justify-between text-[11px] text-[#888888] mb-1">
        <span>TTL</span>
        <span>{label} remaining</span>
      </div>
      <div className="h-1 w-full bg-[#2a2a2a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {secondsLeft > 86400 && (
        <div className="text-[10px] text-[#888888] mt-1">
          Expires {expiryDate} at {expiryTime}
        </div>
      )}
    </div>
  );
}

// --- Delete Button Component ---

function DeleteButton({ entityKey, onDeleted }: { entityKey: string; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Remove this report from Arkiv permanently?")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/entity", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: entityKey }),
      });
      const data = await res.json();
      if (data.success) {
        onDeleted();
      } else {
        setError(data.error || "Delete failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="w-4 h-4 flex items-center justify-center text-[#888888] hover:text-[#E24B4A] transition-colors text-xs leading-none disabled:opacity-50"
        title="Delete from Arkiv"
      >
        {deleting ? "..." : "\u00d7"}
      </button>
      {error && <div className="text-[10px] text-[#E24B4A] mt-1">{error}</div>}
    </>
  );
}

// --- Agent Panel Component ---

function AgentPanel({ agent, state, onEntityDeleted }: { agent: typeof AGENTS[number]; state: AgentState; onEntityDeleted?: (agentId: string) => void }) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logContainerRef.current?.scrollTo({
      top: logContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [state.logs.length]);

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${statusColor(state.status)} ${
              state.status === "running" ? "animate-pulse-dot" : ""
            }`}
          />
          <span className="text-sm font-medium text-[#f0f0f0]">{agent.name}</span>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border ${
            state.status === "done"
              ? "border-[#1D9E75] text-[#1D9E75]"
              : state.status === "running"
              ? "border-[#EF9F27] text-[#EF9F27]"
              : state.status === "waiting"
              ? "border-[#378ADD] text-[#378ADD]"
              : "border-[#888888] text-[#888888]"
          }`}
        >
          {statusLabel(state.status)}
        </span>
      </div>

      {state.logs.length > 0 && (
        <div
          ref={logContainerRef}
          className="bg-[#0a0a0a] rounded p-2 max-h-[160px] overflow-y-auto scroll-smooth font-mono text-[11px] leading-[1.6] text-[#888888]"
        >
          {state.logs.map((log, i) => (
            <div key={i}>
              <span className="text-[#555555] mr-2">{log.time}</span>
              {log.message}
            </div>
          ))}
        </div>
      )}

      {state.entityId && (
        <div className="mt-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded p-3 relative">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1D9E75]/20 text-[#1D9E75]">
              entity
            </span>
            <span className="font-mono text-[11px] text-[#888888]">
              {truncateId(state.entityId)}
            </span>
            <a
              href={state.txHash
                ? `https://explorer.kaolin.hoodi.arkiv.network/tx/${state.txHash}`
                : `https://explorer.kaolin.hoodi.arkiv.network/search-results?q=${state.entityId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#888888] hover:text-[#f0f0f0] transition-colors"
            >
              view &rarr;
            </a>
            <span className="ml-auto">
              <DeleteButton entityKey={state.entityId} onDeleted={() => onEntityDeleted?.(agent.id)} />
            </span>
          </div>
          {state.payload && (
            <pre className="text-[10px] text-[#888888] mt-1 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
              {JSON.stringify(state.payload, null, 2).slice(0, 500)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// --- Report Component ---

function FinalReport({ report, entityId, txHash }: { report: Record<string, unknown>; entityId: string; txHash?: string }) {
  const r = report as {
    projectName?: string;
    oneLineSummary?: string;
    techStack?: string[];
    arkivFitScore?: number;
    featuresUsed?: string[];
    featuresMissed?: string[];
    recommendations?: string[];
  };

  return (
    <div className="bg-[#111111] border border-[#534AB7]/50 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#534AB7]/20 text-[#534AB7] border border-[#534AB7]/50">
          Final Report
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/50">
          30-day TTL
        </span>
        <span className="font-mono text-[11px] text-[#888888] ml-auto">
          {truncateId(entityId)}
        </span>
        <a
          href={txHash
            ? `https://explorer.kaolin.hoodi.arkiv.network/tx/${txHash}`
            : `https://explorer.kaolin.hoodi.arkiv.network/search-results?q=${entityId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[#888888] hover:text-[#f0f0f0] transition-colors"
        >
          view &rarr;
        </a>
      </div>

      <h2 className="text-xl font-semibold text-[#f0f0f0] mb-1">
        {r.projectName || "Unknown Project"}
      </h2>
      <p className="text-sm text-[#888888] mb-4">{r.oneLineSummary || ""}</p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[#1D9E75]">{r.arkivFitScore ?? "?"}</div>
          <div className="text-[10px] text-[#888888] mt-1">Fit Score</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[#378ADD]">{r.featuresUsed?.length ?? 0}</div>
          <div className="text-[10px] text-[#888888] mt-1">Features Used</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[#EF9F27]">{r.featuresMissed?.length ?? 0}</div>
          <div className="text-[10px] text-[#888888] mt-1">Features Missed</div>
        </div>
      </div>

      {r.techStack && r.techStack.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">Tech Stack</h3>
          <div className="flex flex-wrap gap-1.5">
            {r.techStack.map((t, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[#f0f0f0]">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {r.featuresUsed && r.featuresUsed.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">Features Used</h3>
          <ul className="space-y-1">
            {r.featuresUsed.map((f, i) => (
              <li key={i} className="text-sm text-[#1D9E75] flex items-center gap-2">
                <span className="text-[10px]">&#10003;</span> {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.featuresMissed && r.featuresMissed.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">Features Missed</h3>
          <ul className="space-y-1">
            {r.featuresMissed.map((f, i) => (
              <li key={i} className="text-sm text-[#EF9F27] flex items-center gap-2">
                <span className="text-[10px]">&#9679;</span> {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.recommendations && r.recommendations.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">Recommendations</h3>
          <ul className="space-y-1.5">
            {r.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-[#f0f0f0] flex items-start gap-2">
                <span className="text-[#534AB7] mt-0.5 text-[10px]">&#8594;</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// --- Past Sessions Component ---

function PastSessions({ sessions, onDelete }: { sessions: PastSession[]; onDelete: (entityId: string) => void }) {
  if (sessions.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-xs font-medium text-[#888888] mb-3 uppercase tracking-wider">
        Past Sessions (30-day persistent)
      </h3>
      <div className="space-y-3">
        {sessions.map((session) => {
          const p = session.payload as Record<string, unknown>;
          const repo = session.attributes.find((a) => a.key === "repo")?.value || "unknown";
          return (
            <div
              key={session.entityId}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 relative"
            >
              <div className="absolute top-2 right-2">
                <DeleteButton entityKey={session.entityId} onDeleted={() => onDelete(session.entityId)} />
              </div>
              <div className="flex items-center justify-between mb-1 pr-6">
                <span className="text-sm font-medium text-[#f0f0f0]">
                  {(p.projectName as string) || repo}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#534AB7]/20 text-[#534AB7]">
                  {(p.arkivFitScore as number) ?? "?"}/10
                </span>
              </div>
              <p className="text-[11px] text-[#888888] mb-1">{(p.oneLineSummary as string) || ""}</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[#888888]">
                  {truncateId(session.entityId)}
                </span>
                <span className="text-[10px] text-[#888888]">{repo}</span>
              </div>
              <TtlBar expiresAtBlock={session.expiresAtBlock} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Score Comparison Bar ---

function ScoreComparison({
  current,
  past,
}: {
  current: Record<string, unknown>;
  past: PastSession[];
}) {
  const scores = past
    .map((s) => ({
      name: (s.payload.projectName as string) || "?",
      score: (s.payload.arkivFitScore as number) ?? 0,
      isCurrent: false,
    }))
    .concat([
      {
        name: (current.projectName as string) || "Current",
        score: (current.arkivFitScore as number) ?? 0,
        isCurrent: true,
      },
    ])
    .sort((a, b) => b.score - a.score);

  if (scores.length < 2) return null;

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 mt-4">
      <h3 className="text-xs font-medium text-[#888888] mb-3 uppercase tracking-wider">
        Cross-Project Comparison
      </h3>
      <div className="space-y-2">
        {scores.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[11px] text-[#888888] w-24 truncate">{s.name}</span>
            <div className="flex-1 h-3 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(s.score / 10) * 100}%`,
                  backgroundColor: s.isCurrent ? "#534AB7" : "#378ADD",
                }}
              />
            </div>
            <span className={`text-xs font-mono ${s.isCurrent ? "text-[#534AB7]" : "text-[#888888]"}`}>
              {s.score}/10
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main Page ---

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("https://github.com/fabianferno/clink");
  const [running, setRunning] = useState(false);
  const [agents, setAgents] = useState<Record<string, AgentState>>({
    agent1: { status: "idle", logs: [] },
    agent2: { status: "idle", logs: [] },
    agent3: { status: "idle", logs: [] },
    agent4: { status: "idle", logs: [] },
  });
  const [finalReport, setFinalReport] = useState<{ report: Record<string, unknown>; entityId: string; txHash?: string } | null>(null);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch past sessions on mount
  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => {
        if (data.sessions) setPastSessions(data.sessions);
      })
      .catch(() => {});
  }, []);

  const handleRun = useCallback(async () => {
    if (running) return;
    setRunning(true);
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
                logs: [...prev[event.agentId!].logs, logEntry(event.message || "Starting...")],
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
                logs: [...prev[event.agentId!].logs, logEntry(event.message || "Done")],
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
            // Refresh past sessions
            fetch("/api/sessions")
              .then((r) => r.json())
              .then((data) => {
                if (data.sessions) setPastSessions(data.sessions);
              })
              .catch(() => {});
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
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-[#f0f0f0]">Arkiv Agent Memory</h1>
        <p className="text-sm text-[#888888] mt-1">
          Multi-agent pipeline analyzing GitHub repos with on-chain memory on Kaolin testnet
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div>
          {/* Input */}
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 mb-4">
            <label className="text-xs font-medium text-[#888888] uppercase tracking-wider block mb-2">
              GitHub Repository URL
            </label>
            <div className="flex gap-2">
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

          {error && (
            <div className="bg-[#E24B4A]/10 border border-[#E24B4A]/30 text-[#E24B4A] text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          {/* Agent Panels */}
          {AGENTS.map((agent) => (
            <AgentPanel
              key={agent.id}
              agent={agent}
              state={agents[agent.id]}
              onEntityDeleted={(agentId) => {
                setAgents((prev) => ({
                  ...prev,
                  [agentId]: { ...prev[agentId], entityId: undefined, txHash: undefined, payload: undefined },
                }));
              }}
            />
          ))}
        </div>

        {/* Right Column */}
        <div>
          {finalReport ? (
            <>
              <FinalReport report={finalReport.report} entityId={finalReport.entityId} txHash={finalReport.txHash} />
              <ScoreComparison current={finalReport.report} past={pastSessions} />
            </>
          ) : (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-8 text-center">
              <p className="text-[#888888] text-sm">
                {running
                  ? "Pipeline running \u2014 report will appear here..."
                  : "Enter a GitHub repo URL and click Analyze to start"}
              </p>
            </div>
          )}

          <PastSessions
            sessions={pastSessions}
            onDelete={(entityId) => {
              setPastSessions((prev) => prev.filter((s) => s.entityId !== entityId));
            }}
          />
        </div>
      </div>
    </main>
  );
}
