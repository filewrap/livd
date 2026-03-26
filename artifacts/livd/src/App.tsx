import { useEffect, useRef } from "react";
import "./livd.css";

export default function App() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    async function boot() {
      // Wait for THREE and GSAP to load from CDN
      await Promise.all([
        (window as any).THREE_LOAD_PROMISE,
        (window as any).GSAP_LOAD_PROMISE,
      ]);

      if (typeof (window as any).THREE === "undefined") {
        // Fallback: load synchronously if promises didn't work
        await new Promise<void>((res) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
          s.onload = () => res();
          s.onerror = () => res();
          document.head.appendChild(s);
        });
      }

      if (typeof (window as any).gsap === "undefined") {
        await new Promise<void>((res) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js";
          s.onload = () => res();
          s.onerror = () => res();
          document.head.appendChild(s);
        });
      }

      const { initExperience } = await import("./experience");
      initExperience();
    }

    boot();
  }, []);

  return (
    <div id="livd-root">
      {/* Loading Screen */}
      <div id="loading-screen">
        <canvas id="loading-canvas"></canvas>
      </div>

      {/* Main Three.js Canvas */}
      <canvas id="main-canvas"></canvas>

      {/* Dynamic Island */}
      <div id="dynamic-island">
        <span id="island-text"></span>
      </div>

      {/* Custom Cursor */}
      <div id="cursor-dot"></div>

      {/* Hint Button */}
      <button id="hint-btn" aria-label="hint">·</button>

      {/* Hint Panel */}
      <div id="hint-panel">
        <div id="hint-content">
          <p className="hint-title">.livd</p>
          <p className="hint-body">
            before destruction,<br/>
            something always exists.<br/>
            scroll slowly.<br/>
            some things resist.<br/>
            some things die.<br/>
            the object you see<br/>
            has never existed before.<br/>
            it will not exist again.
          </p>
          <p className="hint-dot">·</p>
        </div>
      </div>
    </div>
  );
}
