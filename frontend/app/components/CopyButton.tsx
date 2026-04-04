// CopyButton.tsx — Copies text to clipboard with "copied!" feedback.

"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: "absolute", top: "10px", right: "10px",
        background: copied ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${copied ? "var(--accent-green)" : "var(--border)"}`,
        borderRadius: "5px", padding: "3px 10px",
        fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 600,
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: copied ? "var(--accent-green)" : "var(--text-muted)",
        cursor: "pointer", transition: "all 0.2s",
      }}
    >
      {copied ? "copied!" : "copy"}
    </button>
  );
}
