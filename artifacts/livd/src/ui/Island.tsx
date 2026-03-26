import { useEffect, useRef, useState } from "react";
import { bus, Events } from "../store/state";
import gsap from "gsap";

// The floating Island is ONLY used post-destruction (substrate, revival, conflict, dominant, end).
// During alive/dying phases, the center nav pill handles Island messages.
export function Island() {
  const islandRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const offShow = bus.on(Events.ISLAND_SHOW, (msg: string, widthPx?: number) => {
      const el = islandRef.current;
      const tx = textRef.current;
      if (!el || !tx) return;
      const w = widthPx ?? Math.max(90, msg.length * 9 + 30);
      gsap.to(tx, {
        opacity: 0, duration: 0.12, onComplete: () => {
          setText(msg);
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
      <span id="island-text" ref={textRef}>{text}</span>
    </div>
  );
}
