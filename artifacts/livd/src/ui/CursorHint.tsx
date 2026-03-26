import { useEffect, useRef, useState, useCallback } from "react";
import { state } from "../store/state";

const HINTS = [
  "you are borrowing order\nfrom a universe\nthat wants chaos.",
  "entropy is not failure.\nit is the mechanism\nby which stars are born.",
  "you exist at the precise\nboundary between order\nand dissolution.",
  "every moment you remember\nis the universe holding\na mirror to itself.",
  "the pattern persists.\nnot because it must —\nbecause it can.",
  "to read this\nis already\nan act of resistance.",
];

let hintIndex = 0;

export function CursorHint() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const collapse = useCallback(() => {
    setExpanded(false);
    setTimeout(() => {
      setVisible(false);
      // Schedule next hint after a delay
      timerRef.current = setTimeout(show, 22000);
    }, 400);
  }, []);

  const show = useCallback(() => {
    if (state.phase !== "alive" && state.phase !== "warning") return;
    setText(HINTS[hintIndex % HINTS.length]);
    hintIndex++;
    setPos({ x: state.cursorX, y: state.cursorY });
    setVisible(true);
    expandTimer.current = setTimeout(() => setExpanded(true), 120);
  }, []);

  useEffect(() => {
    // Start after 9 seconds of alive phase
    timerRef.current = setTimeout(show, 9000);

    const onKeyDown = () => collapse();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (expandTimer.current) clearTimeout(expandTimer.current);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!visible) return null;

  // Position: open upward-right from cursor, stay within bounds
  const cardX = Math.min(pos.x + 14, window.innerWidth - 220);
  const cardY = Math.max(pos.y - (expanded ? 130 : 14), 20);

  return (
    <div
      id="cursor-hint"
      ref={cardRef}
      style={{
        position: "fixed",
        left: cardX,
        top: cardY,
        zIndex: 9998,
        cursor: "none",
        pointerEvents: expanded ? "all" : "none",
      }}
      onClick={collapse}
    >
      <div
        style={{
          width: expanded ? "200px" : "8px",
          height: expanded ? "auto" : "8px",
          minHeight: expanded ? "60px" : "8px",
          background: expanded ? "rgba(8,8,12,0.88)" : "rgba(255,255,255,0.85)",
          border: expanded ? "1px solid rgba(255,255,255,0.1)" : "none",
          borderRadius: expanded ? "12px" : "50%",
          backdropFilter: expanded ? "blur(16px)" : "none",
          padding: expanded ? "16px 18px" : "0",
          overflow: "hidden",
          transition: "width 0.45s cubic-bezier(0.22,1,0.36,1), height 0.45s cubic-bezier(0.22,1,0.36,1), min-height 0.45s cubic-bezier(0.22,1,0.36,1), border-radius 0.45s ease, background 0.3s ease",
        }}
      >
        {expanded && (
          <>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.2)",
              marginBottom: "10px",
              textTransform: "uppercase",
            }}>
              ·livd / fragment
            </div>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              lineHeight: "1.9",
              color: "rgba(255,255,255,0.6)",
              whiteSpace: "pre-line",
            }}>
              {text}
            </div>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "rgba(255,255,255,0.12)",
              marginTop: "12px",
              letterSpacing: "0.1em",
            }}>
              click · dismiss
            </div>
          </>
        )}
      </div>
    </div>
  );
}
