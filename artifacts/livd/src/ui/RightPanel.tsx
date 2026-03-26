import { useState, useEffect } from "react";
import { Github } from "lucide-react";

function TelegramSVG() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2L2 10.5l7 2.5" />
      <path d="M9 13l3 7 3-5 5-3" />
      <path d="M9 13l5-3" />
    </svg>
  );
}

function fmtOffset(date: Date): string {
  const mins = -date.getTimezoneOffset();
  const sign = mins >= 0 ? "+" : "-";
  const h = Math.floor(Math.abs(mins) / 60).toString();
  const m = (Math.abs(mins) % 60).toString().padStart(2, "0");
  return m === "00" ? `GMT${sign}${h}` : `GMT${sign}${h}:${m}`;
}

export function RightPanel() {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const s = now.getSeconds().toString().padStart(2, "0");
  const dateStr = now.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "2-digit" });
  const gmt = fmtOffset(now);

  return (
    <div
      id="right-panel"
      onClick={() => setOpen((o) => !o)}
      style={{
        position: "fixed",
        top: "11px",
        right: "12px",
        zIndex: 25,
        width: open ? "210px" : "38px",
        height: open ? "192px" : "38px",
        borderRadius: open ? "14px" : "999px",
        background: "rgba(8,8,12,0.82)",
        backdropFilter: "blur(22px) saturate(1.5)",
        WebkitBackdropFilter: "blur(22px) saturate(1.5)",
        border: "1px solid rgba(255,255,255,0.09)",
        overflow: "hidden",
        cursor: "none",
        pointerEvents: "all",
        // Simultaneous width+height → diagonal 45° expansion from top-right origin
        transition: [
          "width 0.46s cubic-bezier(0.22,1,0.36,1)",
          "height 0.46s cubic-bezier(0.22,1,0.36,1)",
          "border-radius 0.46s ease",
        ].join(", "),
      }}
    >
      {/* ── Closed dot ──────────────────────────────────── */}
      <span style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontSize: "20px",
        color: "rgba(255,255,255,0.18)",
        lineHeight: 1,
        opacity: open ? 0 : 1,
        transition: "opacity 0.18s ease",
        pointerEvents: "none",
        userSelect: "none",
      }}>·</span>

      {/* ── Open content ────────────────────────────────── */}
      <div style={{
        position: "absolute",
        inset: 0,
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "13px",
        opacity: open ? 1 : 0,
        transition: "opacity 0.22s ease 0.18s",
        pointerEvents: open ? "all" : "none",
      }}>

        {/* Label */}
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.18)",
          textTransform: "uppercase",
        }}>·livd / info</div>

        {/* Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
          <a
            href="https://github.com/ufssh"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex", alignItems: "center", gap: "9px",
              fontFamily: "var(--font-mono)", fontSize: "11px",
              color: "rgba(255,255,255,0.5)", textDecoration: "none",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.88)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
          >
            <Github size={13} strokeWidth={1.5} />
            ufssh
          </a>
          <a
            href="https://t.me/AgainOwner"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex", alignItems: "center", gap: "9px",
              fontFamily: "var(--font-mono)", fontSize: "11px",
              color: "rgba(255,255,255,0.5)", textDecoration: "none",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.88)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
          >
            <TelegramSVG />
            AgainOwner
          </a>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "0 -2px" }} />

        {/* Clock */}
        <div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "22px",
            letterSpacing: "-0.03em",
            color: "rgba(255,255,255,0.72)",
            lineHeight: 1,
          }}>
            {h}<span style={{ opacity: 0.4 }}>:</span>{m}<span style={{ opacity: 0.4 }}>:</span>{s}
          </div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.2)",
            marginTop: "6px",
          }}>
            {gmt} · {dateStr}
          </div>
        </div>

      </div>
    </div>
  );
}
