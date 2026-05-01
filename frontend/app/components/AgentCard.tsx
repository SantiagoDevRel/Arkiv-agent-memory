// frontend/app/components/AgentCard.tsx
// Renders a single agent panel with robot avatar, status, logs, and entity card.

"use client";

import { useRef, useEffect } from "react";

type LogEntry = { time: string; message: string; highlight?: boolean; success?: boolean };

type AgentCardProps = {
  agentId: "agent1" | "agent2" | "agent3" | "agent4" | "agent5";
  name: string;
  status: "idle" | "waiting" | "running" | "done";
  logs: LogEntry[];
  entityId?: string;
  txHash?: string;
  payload?: object;
};

const AGENT_NUMBER: Record<string, number> = { agent1: 1, agent2: 2, agent3: 3, agent4: 4, agent5: 5 };
const AGENT_COLORS: Record<string, string> = { agent1: "#5ECBAA", agent2: "#EF9F27", agent3: "#1D9E75", agent4: "#8b7cf8", agent5: "#ec4899" };
const AGENT_ROLES: Record<string, string> = { agent1: "readme reader", agent2: "code analyzer", agent3: "arkiv expert", agent4: "reporter", agent5: "tracker pusher" };

const ENTITY_TYPE_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  agent1: { label: "readme-summary", bg: "#001a10", color: "#1D9E75", border: "#0a3a20" },
  agent2: { label: "code-analysis", bg: "#0a1525", color: "#378ADD", border: "#1a3a5a" },
  agent3: { label: "arkiv-signal", bg: "#1a1000", color: "#EF9F27", border: "#3a2800" },
  agent4: { label: "final-report", bg: "#0e0a1a", color: "#8b7cf8", border: "#2a1a4a" },
  agent5: { label: "tracker-row", bg: "#1f0a14", color: "#ec4899", border: "#3a0a28" },
};

const STATUS_BADGE: Record<string, { bg: string; color: string; text: string; border: string }> = {
  idle: { bg: "#111", color: "#444", text: "IDLE", border: "#1e1e1e" },
  waiting: { bg: "#0a1525", color: "#378ADD", text: "WAITING", border: "#1a3a5a" },
  running: { bg: "#1a1000", color: "#EF9F27", text: "RUNNING", border: "#3a2800" },
  done: { bg: "#001a10", color: "#1D9E75", text: "DONE", border: "#0a3a20" },
};

function truncateKey(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

export default function AgentCard({ agentId, name, status, logs, entityId, txHash }: AgentCardProps) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (logRef.current) { logRef.current.scrollTop = logRef.current.scrollHeight; } }, [logs]);

  const num = AGENT_NUMBER[agentId];
  const badge = STATUS_BADGE[status];
  const robotClass = `robot robot-${status}`;
  const entityType = ENTITY_TYPE_MAP[agentId];
  const agentColor = AGENT_COLORS[agentId];
  const glowClass = status === "running" ? "glow-amber" : status === "done" ? "glow-green" : "";

  const borderStyle: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderLeft: `3px solid ${agentColor}`,
    ...(status === "running" ? { animation: "cardGlowAmber 2s ease-in-out infinite" } : {}),
    ...(status === "done" ? { animation: "cardGlowGreen 3s ease-in-out infinite" } : {}),
  };

  return (
    <div className={glowClass} style={{ background: "var(--bg-panel)", borderRadius: "12px", overflow: "hidden", transition: "border-color 0.2s, box-shadow 0.2s", ...borderStyle }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className={robotClass}>
          <div className="robot-antenna" />
          <div className="robot-head">
            <div className="robot-eyes"><div className="robot-eye" /><div className="robot-eye" /></div>
            <div className="robot-mouth" />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
            Agent {num} &middot; {name}
          </div>
          <div style={{ fontSize: "10px", marginTop: "2px" }}>
            {status === "idle" && <span style={{ color: `${agentColor}66` }}>{AGENT_ROLES[agentId]}</span>}
            {status === "waiting" && <span style={{ color: "var(--accent-blue)" }}>waiting for previous agents</span>}
            {status === "running" && (
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-amber)" }}>
                <span className="thinking-dots"><span /><span /><span /></span>processing...
              </span>
            )}
            {status === "done" && <span style={{ color: "var(--accent-green)" }}>entity written to Arkiv</span>}
          </div>
        </div>
        <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{badge.text}</span>
      </div>

      <div style={{ padding: "14px 18px" }}>
        <div
          className="agent-log-container"
          ref={logRef}
          style={status === "idle" && logs.length === 0 ? { background: "repeating-linear-gradient(0deg, #080808, #080808 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 4px)" } : undefined}
        >
          {logs.length === 0 && (status === "idle" || status === "waiting") ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#777", letterSpacing: "0.1em", gap: "8px", fontSize: "11px" }}>
              <span style={{ animation: "chainPulse 2s ease-in-out infinite", color: agentColor, opacity: 0.5 }}>&bull;</span>
              awaiting session
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ display: "flex", gap: "8px" }}>
                <span style={{ color: "#666", flexShrink: 0, userSelect: "none" }}>{log.time}</span>
                <span style={{ color: log.success ? "var(--accent-green)" : log.highlight ? "var(--text-primary)" : "#999" }}>{log.message}</span>
              </div>
            ))
          )}
        </div>

        {entityId && (
          <div style={{ padding: "10px 14px", background: "var(--bg-deep)", border: "1px solid var(--border-subtle)", borderRadius: "8px", marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.1em", background: entityType.bg, color: entityType.color, border: `1px solid ${entityType.border}`, flexShrink: 0 }}>{entityType.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#777", flex: 1 }}>{truncateKey(entityId)}</span>
            <a href={txHash ? `https://explorer.kaolin.hoodi.arkiv.network/tx/${txHash}` : `https://explorer.kaolin.hoodi.arkiv.network/entity/${entityId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#777", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-green)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>view &rarr;</a>
          </div>
        )}
      </div>
    </div>
  );
}
