import { useEffect, useRef } from "react";
import { state, bus, Events } from "../store/state";

export function Cursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const isRed = useRef(false);
  const curX = useRef(window.innerWidth / 2);
  const curY = useRef(window.innerHeight / 2);

  useEffect(() => {
    let raf: number;
    let pulseAnim: ReturnType<typeof setInterval> | null = null;
    let tremorFrame = 0;

    function tick() {
      raf = requestAnimationFrame(tick);
      const el = cursorRef.current;
      if (!el) return;

      let tx = state.mouseX, ty = state.mouseY;

      // Gravity during revival
      if (state.cursorGravity) {
        tx += (state.gravityTarget.x - state.mouseX) * 0.18;
        ty += (state.gravityTarget.y - state.mouseY) * 0.18;
      }

      // Tremor during scroll zone crack
      if (state.cursorTremor) {
        tremorFrame++;
        if (tremorFrame % 3 === 0) {
          tx += (Math.random() - 0.5) * 5;
          ty += (Math.random() - 0.5) * 5;
        }
      }

      // Smooth lerp
      curX.current += (tx - curX.current) * 0.15;
      curY.current += (ty - curY.current) * 0.15;

      state.cursorX = curX.current;
      state.cursorY = curY.current;

      el.style.left = curX.current + "px";
      el.style.top = curY.current + "px";
    }
    raf = requestAnimationFrame(tick);

    const offRed = bus.on(Events.CURSOR_RED, () => {
      isRed.current = true;
      const el = cursorRef.current;
      if (el) el.style.backgroundColor = "#8B0000";
    });
    const offRestore = bus.on(Events.CURSOR_RESTORE, () => {
      isRed.current = false;
      const el = cursorRef.current;
      if (el) el.style.backgroundColor = "#ffffff";
    });

    return () => {
      cancelAnimationFrame(raf);
      offRed(); offRestore();
    };
  }, []);

  return <div id="cursor" ref={cursorRef} />;
}
