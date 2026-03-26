import { useEffect, useRef, useState } from "react";
import { bus, Events } from "../store/state";

export function PhaseOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  const [tag, setTag] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    const off = bus.on(Events.PHASE_OVERLAY, (t: string, tx: string, visible: boolean) => {
      setTag(t);
      setText(tx);
      const el = ref.current;
      if (el) el.classList.toggle("visible", visible);
    });
    return () => off();
  }, []);

  return (
    <div id="phase-overlay" ref={ref}>
      <div className="phase-tag">{tag}</div>
      <div className="phase-text" style={{ whiteSpace: "pre-line" }}>{text}</div>
    </div>
  );
}
