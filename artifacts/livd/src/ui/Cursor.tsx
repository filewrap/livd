import { useEffect, useRef } from "react";
import { state, bus, Events } from "../store/state";

export function Cursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cx = useRef(window.innerWidth / 2);
  const cy = useRef(window.innerHeight / 2);
  let tremorFrame = 0;

  useEffect(() => {
    let raf: number;

    function tick() {
      raf = requestAnimationFrame(tick);
      const el = cursorRef.current;
      if (!el) return;

      let tx = state.mouseX, ty = state.mouseY;

      if (state.cursorGravity) {
        tx += (state.gravityTarget.x - state.mouseX) * 0.2;
        ty += (state.gravityTarget.y - state.mouseY) * 0.2;
      }
      if (state.cursorTremor) {
        tremorFrame++;
        if (tremorFrame % 4 === 0) { tx += (Math.random() - 0.5) * 7; ty += (Math.random() - 0.5) * 7; }
      }

      cx.current += (tx - cx.current) * 0.14;
      cy.current += (ty - cy.current) * 0.14;
      state.cursorX = cx.current;
      state.cursorY = cy.current;

      el.style.left = cx.current + "px";
      el.style.top = cy.current + "px";
    }
    raf = requestAnimationFrame(tick);

    const offRed = bus.on(Events.CURSOR_RED, () => {
      const el = cursorRef.current;
      if (el) el.style.backgroundColor = "#8B0000";
    });
    const offRestore = bus.on(Events.CURSOR_RESTORE, () => {
      const el = cursorRef.current;
      if (el) el.style.backgroundColor = "#ffffff";
    });

    return () => { cancelAnimationFrame(raf); offRed(); offRestore(); };
  }, []);

  return <div id="cursor" ref={cursorRef} />;
}
