import { useEffect, useRef } from "react";
import { state, bus, Events } from "../store/state";

export function SeedDisplay() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = bus.on(Events.SEED_SHOW, () => {
      const el = ref.current;
      if (!el) return;
      el.classList.add("visible");
      // Also update the hint panel inline seed
      const inline = document.getElementById("seed-inline");
      if (inline) inline.textContent = state.sessionSeed;
    });
    return () => off();
  }, []);

  return (
    <div id="seed-display" ref={ref}>
      seed: #{state.sessionSeed}
    </div>
  );
}
