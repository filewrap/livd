import { useEffect, useRef, useState } from "react";
import { bus, Events } from "../store/state";
import gsap from "gsap";

export function Island() {
  const islandRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const off1 = bus.on(Events.ISLAND_SHOW, (msg: string, widthPx?: number) => {
      const el = islandRef.current;
      const tx = textRef.current;
      if (!el || !tx) return;

      const w = widthPx ?? Math.max(90, msg.length * 9 + 28);
      gsap.to(tx, { opacity: 0, duration: 0.12, onComplete: () => {
        setText(msg);
        gsap.to(el, {
          width: `${w}px`,
          duration: 0.38,
          ease: "expo.out",
          onComplete: () => {
            gsap.to(tx, { opacity: 1, duration: 0.2 });
          },
        });
      }});
    });

    const off2 = bus.on(Events.ISLAND_HIDE, () => {
      const el = islandRef.current;
      const tx = textRef.current;
      if (!el || !tx) return;
      gsap.to(tx, { opacity: 0, duration: 0.2, onComplete: () => {
        gsap.to(el, { width: "8px", duration: 0.4, ease: "expo.in" });
      }});
    });

    const off3 = bus.on(Events.ISLAND_BORDER, (color: string) => {
      const el = islandRef.current;
      if (!el) return;
      el.style.borderColor = color;
    });

    return () => { off1(); off2(); off3(); };
  }, []);

  return (
    <div id="island" ref={islandRef}>
      <span id="island-text" ref={textRef}>{text}</span>
    </div>
  );
}
