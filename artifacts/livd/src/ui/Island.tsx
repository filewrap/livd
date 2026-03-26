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
  const textValueRef = useRef("");

  useEffect(() => {
    const offShow = bus.on(Events.ISLAND_SHOW, (msg: string, widthPx?: number) => {
      const el = islandRef.current;
      const tx = textRef.current;
      if (!el || !tx) return;

      // First time showing — reveal the floating island
      if (!revealedRef.current) {
        revealedRef.current = true;
        el.style.display = "flex";
        el.style.opacity = "0";
        gsap.to(el, { opacity: 1, duration: 0.5, ease: "power2.out" });
      }

      const w = widthPx ?? Math.max(90, msg.length * 9 + 30);
      gsap.to(tx, {
        opacity: 0, duration: 0.12, onComplete: () => {
          textValueRef.current = msg;
          tx.textContent = msg;
          gsap.to(el, {
            width: `${w}px`, duration: 0.5, ease: "expo.out",
            onComplete: () => { gsap.to(tx, { opacity: 1, duration: 0.22 }); },
          });
        },
      });
    });

    const offHide = bus.on(Events.ISLAND_HIDE, () => {
      const el = islandRef.current;
      const tx = textRef.current;
      if (!el || !tx) return;
      gsap.to(tx, {
        opacity: 0, duration: 0.2, onComplete: () => {
          gsap.to(el, { width: "8px", duration: 0.45, ease: "expo.in" });
        },
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
