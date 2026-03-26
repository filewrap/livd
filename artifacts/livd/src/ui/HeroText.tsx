import { useEffect, useRef } from "react";
import { bus, Events } from "../store/state";

export function HeroText() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = bus.on(Events.HERO_TEXT_SHOW, () => ref.current?.classList.add("visible"));
    const h = bus.on(Events.HERO_TEXT_HIDE, () => ref.current?.classList.remove("visible"));
    return () => { s(); h(); };
  }, []);

  return (
    <div id="hero-text" ref={ref}>
      <div id="hero-tagline">
        not a product. not a service. a moment.
      </div>
      <div id="hero-sub">
        ·livd — everything that exists will not.
      </div>
    </div>
  );
}
