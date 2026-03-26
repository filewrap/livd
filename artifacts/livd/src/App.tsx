import { useEffect, useRef } from "react";
import { startEngine } from "./engine/index";
import { bus, Events } from "./store/state";
import { Island } from "./ui/Island";
import { Cursor } from "./ui/Cursor";
import { Hint } from "./ui/Hint";
import { PhaseOverlay } from "./ui/PhaseOverlay";
import { WebsiteContent } from "./ui/WebsiteContent";
import { CursorHint } from "./ui/CursorHint";
import "./index.css";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    startEngine(canvas).catch((err) => {
      console.warn("[livd] engine unavailable:", err);
      const label = document.getElementById("loading-label");
      if (label) label.textContent = "requires webgl";
    });

    const offEnd = bus.on(Events.END_WHITE, () => {
      const el = document.getElementById("end-white");
      if (!el) return;
      el.style.opacity = "1";
      el.style.pointerEvents = "all";
      // Cursor fades last — stays black briefly as white arrives
      const cursor = document.getElementById("cursor");
      if (cursor) {
        cursor.style.backgroundColor = "#000";
        cursor.style.zIndex = "99999";
        setTimeout(() => { cursor.style.opacity = "0"; }, 2200);
      }
    });

    return () => offEnd();
  }, []);

  return (
    <>
      {/* ── Three.js substrate (always behind) ─────────── */}
      <canvas id="three-canvas" ref={canvasRef} />

      {/* ── Loading screen ──────────────────────────────── */}
      <div id="loading-screen">
        <canvas id="loading-canvas" />
        <span id="loading-label">initializing</span>
      </div>

      {/* ── Scroll progress bar (top edge) ─────────────── */}
      <div id="scroll-progress" />

      {/* ── The actual website (inside scroll layer) ────── */}
      <div id="scroll-layer">
        <WebsiteContent />
      </div>

      {/* ── Fixed UI layer ──────────────────────────────── */}
      <Island />
      <PhaseOverlay />
      <Hint />
      <CursorHint />

      {/* ── End white fill ──────────────────────────────── */}
      <div id="end-white" />

      {/* ── Custom cursor ───────────────────────────────── */}
      <Cursor />
    </>
  );
}
