import { useEffect, useRef } from "react";
import { startEngine } from "./engine/index";
import { bus, Events } from "./store/state";
import { Island } from "./ui/Island";
import { Cursor } from "./ui/Cursor";
import { Nav } from "./ui/Nav";
import { Hint } from "./ui/Hint";
import { Sections } from "./ui/Sections";
import { HeroText } from "./ui/HeroText";
import { SeedDisplay } from "./ui/SeedDisplay";
import { LoadingScreen } from "./ui/LoadingScreen";
import "./index.css";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const endWhiteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    startEngine(canvas).catch((err) => {
      console.warn("[livd] engine failed:", err);
      // Show a graceful fallback message in the loading label
      const label = document.getElementById("loading-label");
      if (label) label.textContent = "requires webgl — please use a modern browser";
    });

    const off = bus.on(Events.END_WHITE, () => {
      const el = endWhiteRef.current;
      if (!el) return;
      el.style.opacity = "1";
      el.style.pointerEvents = "all";
      // The cursor holds black for 1 extra second — the last dark thing
      const cursor = document.getElementById("cursor");
      if (cursor) {
        cursor.style.backgroundColor = "#000";
        cursor.style.zIndex = "99999";
        setTimeout(() => { cursor.style.opacity = "0"; }, 1200);
      }
    });

    return () => off();
  }, []);

  return (
    <>
      {/* ── Three.js render canvas ──────────────────────── */}
      <canvas id="three-canvas" ref={canvasRef} />

      {/* ── Loading screen (sits on top until ready) ────── */}
      <LoadingScreen />

      {/* ── Scroll layer — 600vh tall, drives the narrative */}
      <div id="scroll-layer">
        <div id="scroll-content" />
      </div>

      {/* ── All React UI (above canvas, pointer-events:none by default) */}
      <div id="ui-layer">
        <Island />
        <Nav />
        <HeroText />
        <Sections />
        <SeedDisplay />
        <Hint />
      </div>

      {/* ── End state white fill ─────────────────────────── */}
      <div id="end-white" ref={endWhiteRef} />

      {/* ── Custom cursor ────────────────────────────────── */}
      <Cursor />
    </>
  );
}
