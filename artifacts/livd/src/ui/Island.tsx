import { useEffect, useRef, useState } from "react";
import { bus, Events } from "../store/state";
import gsap from "gsap";

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
        opacity: 0, duration: 0.1, onComplete: () => {
          setText(msg);
          gsap.to(el, {
            width: `${w}px`, duration: 0.36, ease: "expo.out",
            onComplete: () => { gsap.to(tx, { opacity: 1, duration: 0.18 }); },
          });
        },
      });
    });

    const offHide = bus.on(Events.ISLAND_HIDE, () => {
      const el = islandRef.current;
      const tx = textRef.current;
      if (!el || !tx) return;
      gsap.to(tx, {
        opacity: 0, duration: 0.18, onComplete: () => {
          gsap.to(el, { width: "8px", duration: 0.38, ease: "expo.in" });
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
