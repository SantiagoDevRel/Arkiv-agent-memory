// frontend/app/components/AgentCard.tsx
// Renders a single agent panel with robot avatar, status, logs, and entity card.

"use client";

import { useRef, useEffect } from "react";

type LogEntry = { time: string; message: string; highlight?: boolean; success?: boolean };

type AgentCardProps = {
  agentId: "agent1" | "agent2" | "agent3" | "agent4";
  name: string;
  status: "idle" | "waiting" | "running" | "done";
  logs: LogEntry[];
  entityId?: string;
  txHash?: string;
  payload?: object;
};

const AGENT_NUMBER: Record<string, number> = { agent1: 1, agent2: 2, agent3: 3, agent4: 4 };

const ENTITY_TYPE_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  agent1: { label: "readme-summary", bg: "#001a10", color: "#1D9E75", border: "#0a3a20" },
  agent2: { label: "code-analysis", bg: "#0a1525", color: "#378ADD", border: "#1a3a5a" },
  agent3: { label: "arkiv-signal", bg: "#1a1000", color: "#EF9F27", border: "#3a2800" },
  agent4: { label: "final-report", bg: "#0e0a1a", color: "#8b7cf8", border: "#2a1a4a" },
};

const STATUS_BADGE: Record<string, { bg: string; color: string; text: string; border: string }> = {
  idle: { bg: "#111", color: "#444", text: "IDLE", border: "#1e1e1e" },
  waiting: { bg: "#0a1525", color: "#378ADD", text: "WAITING", border: "#1a3a5a" },
  running: { bg: "#1a1000", color: "#EF9F27", text: "RUNNING", border: "#3a2800" },
  done: { bg: "#001a10", color: "#1D9E75", text: "DONE", border: "#0a3a20" },
};

const BORDER_STYLE: Record<string, React.CSSProperties> = {
  idle: { border: "1px solid #2a2a2a" },
  waiting: { border: "1px solid #1a3a5a" },
  running: { border: "1px solid #3a2a00", animation: "cardGlowAmber 2s ease-in-out infinite" },
  done: { border: "1px solid #0a3a20", animation: "cardGlowGreen 3s ease-in-out infinite" },
};

function truncateKey(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

export default function AgentCard({ agentId, name, status, logs, entityId, txHash }: AgentCardProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const num = AGENT_NUMBER[agentId];
  const badge = STATUS_BADGE[status];
  const robotClass = `robot robot-${status}`;
  const entityType = ENTITY_TYPE_MAP[agentId];
  const borderStyle = BORDER_STYLE[status];

  const glowClass = status === "running" ? "glow-amber" : status === "done" ? "glow-green" : "";

  return (
    <div className={glowClass} style={{ background: "var(--bg-panel)", borderRadius: "12px", overflow: "hidden", transition: "border-color 0.2s, box-shadow 0.2s", ...borderStyle }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
        {/* Robot */}
        <div className={robotClass}>
          <div className="robot-antenna" />
          <div className="robot-head">
            <div className="robot-eyes">
              <div className="robot-eye" />
              <div className="robot-eye" />
            </div>
            <div className="robot-mouth" />
          </div>
        </div>

        {/* Agent info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
            Agent {num} &middot; {name}
          </div>
          <div style={{ fontSize: "11px", marginTop: "2px" }}>
            {status === "idle" && <span style={{ color: "#444" }}>&mdash;</span>}
            {status === "waiting" && <span style={{ color: "#378ADD" }}>waiting for previous agents</span>}
            {status === "running" && (
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#EF9F27" }}>
                <span className="thinking-dots"><span /><span /><span /></span>
                processing...
              </span>
            )}
            {status === "done" && <span style={{ color: "#1D9E75" }}>entity written to Arkiv</span>}
          </div>
        </div>

        {/* Status badge */}
        <span style={{
          background: badge.bg,
          color: badge.color,
          border: `1px solid ${badge.border}`,
          fontSize: "9px",
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: "20px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontFamily: "var(--font-mono)",
          flexShrink: 0,
        }}>
          {badge.text}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 20px" }}>
        <div className="agent-log-container" ref={logRef}>
          {logs.length === 0 && (status === "idle" || status === "waiting") ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#333", fontSize: "11px" }}>
              &mdash; standing by &mdash;
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ display: "flex", gap: "8px" }}>
                <span style={{ color: "#444", flexShrink: 0, userSelect: "none" }}>{log.time}</span>
                <span style={{ color: log.success ? "#1D9E75" : log.highlight ? "#f0f0f0" : "#666" }}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Entity strip */}
        {entityId && (
          <div style={{
            padding: "10px 14px",
            background: "var(--bg-deep)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "6px",
            marginTop: "10px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              background: entityType.bg,
              color: entityType.color,
              border: `1px solid ${entityType.border}`,
              flexShrink: 0,
            }}>
              {entityType.label}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#666", flex: 1 }}>
              {truncateKey(entityId)}
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
        )}
      </div>
    </div>
  );
}
