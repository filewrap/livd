import { useEffect, useRef } from "react";
import { bus, Events } from "../store/state";
import { Dot, ArrowDown } from "lucide-react";

export function Nav() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const off = bus.on(Events.NAV_SHOW, () => {
      const el = navRef.current;
      if (!el) return;
      el.classList.add("visible");
    });
    return () => off();
  }, []);

  function scrollSection(id: string) {
    const el = document.getElementById("scroll-layer");
    const target = document.getElementById(`section-${id}`);
    if (!el || !target) return;
    const offsetTop = target.offsetTop;
    el.scrollTo({ top: offsetTop, behavior: "smooth" });
  }

  return (
    <nav id="nav" ref={navRef}>
      <a id="nav-logo" href="#">
        <span>·</span>livd
      </a>
      <ul id="nav-links">
        <li><a href="#" onClick={(e) => { e.preventDefault(); scrollSection("field"); }}>the field</a></li>
        <li><a href="#" onClick={(e) => { e.preventDefault(); scrollSection("object"); }}>the object</a></li>
        <li><a href="#" onClick={(e) => { e.preventDefault(); scrollSection("resistance"); }}>resistance</a></li>
      </ul>
      <div id="nav-scroll-hint">
        <ArrowDown size={11} strokeWidth={1.5} />
        scroll to witness
      </div>
    </nav>
  );
}
