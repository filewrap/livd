import { useEffect, useRef } from "react";
import { bus, Events } from "../store/state";
import gsap from "gsap";

// The floating Island is ONLY used post-destruction (substrate, revival, conflict, dominant, end).
// During alive/dying phases the center nav pill handles Island messages.
// #island starts with display:none; we reveal it on the first ISLAND_SHOW event.
export function Island() {
  const islandRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const revealedRef = useRef(false);
  const activeTlRef = useRef<gsap.core.Timeline | null>(null);

  // Helper: fully reset the island element to resting state
  function resetIsland(el: HTMLElement) {
    gsap.set(el, { top: "20px", opacity: 1, height: "36px", width: "8px", borderRadius: "999px" });
    revealedRef.current = false;
  }

  useEffect(() => {
    const offShow = bus.on(Events.ISLAND_SHOW, (msg: string, widthPx?: number) => {
      const el = islandRef.current;
      const tx = textRef.current;
      if (!el || !tx) return;

      // Kill any ongoing hide animation and snap back to visible state
      if (activeTlRef.current) {
        activeTlRef.current.kill();
        activeTlRef.current = null;
        el.style.display = "flex";
        gsap.set(el, { top: "20px", opacity: 1, height: "36px", borderRadius: "999px" });
        revealedRef.current = true;
      }

      // First time: reveal the floating island from hidden state
      if (!revealedRef.current) {
        revealedRef.current = true;
        el.style.display = "flex";
        gsap.set(el, { top: "20px", opacity: 0, height: "36px", width: "8px", borderRadius: "999px" });
        gsap.to(el, { opacity: 1, duration: 0.35, ease: "power2.out" });
      }

      const w = widthPx ?? Math.max(90, msg.length * 9 + 30);

      // Animate: hide current text, resize pill, show new text
      gsap.to(tx, {
        opacity: 0, duration: 0.12, onComplete: () => {
          tx.textContent = msg;
          gsap.to(el, {
            width: `${w}px`,
            height: "36px",
            borderRadius: "999px",
            duration: 0.5,
            ease: "expo.out",
            onComplete: () => { gsap.to(tx, { opacity: 1, duration: 0.22 }); },
          });
        },
      });
    });

    const offHide = bus.on(Events.ISLAND_HIDE, () => {
      const el = islandRef.current;
      const tx = textRef.current;
      if (!el || !tx) return;

      // Kill any in-progress animation
      if (activeTlRef.current) { activeTlRef.current.kill(); activeTlRef.current = null; }

      // ── Custom island escape sequence ──────────────────────────────────────
      // 1. Text fades out
      // 2. Pill collapses from both sides → center point (dot)
      // 3. Dot extends horizontally → thin line "─────"
      // 4. Line floats upward and dissolves into the top boundary
      const tl = gsap.timeline({
        onComplete: () => {
          el.style.display = "none";
          resetIsland(el);
        },
      });
      activeTlRef.current = tl;

      tl
        // Step 1 — text disappears
        .to(tx, { opacity: 0, duration: 0.14, ease: "power2.in" })
        // Step 2 — both edges squeeze inward to a center point
        .to(el, {
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          duration: 0.28,
          ease: "expo.in",
        })
        // Brief pause at dot state
        .to({}, { duration: 0.06 })
        // Step 3 — dot stretches into a hairline across ~100px
        .to(el, {
          width: "100px",
          height: "1.5px",
          borderRadius: "1px",
          duration: 0.22,
          ease: "expo.out",
        })
        // Step 4 — line drifts to top boundary and dissolves
        .to(el, {
          top: "-4px",
          opacity: 0,
          duration: 0.36,
          ease: "power3.in",
        });
    });

    const offBorder = bus.on(Events.ISLAND_BORDER, (color: string) => {
      const el = islandRef.current;
      if (el) el.style.borderColor = color;
    });

    return () => { offShow(); offHide(); offBorder(); };
  }, []);

  return (
    <div id="island" ref={islandRef}>
      <span id="island-text" ref={textRef} />
    </div>
  );
}
