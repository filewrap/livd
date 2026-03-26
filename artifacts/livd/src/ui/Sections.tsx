import { useEffect, useRef } from "react";
import { bus, Events } from "../store/state";

type SectionId = "field" | "object" | "resistance" | "formation" | "remains";

export function Sections() {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const show = bus.on(Events.SECTION_SHOW, (id: SectionId | "all") => {
      if (id === "all") {
        Object.values(refs.current).forEach((el) => el?.classList.add("visible"));
      } else {
        refs.current[id]?.classList.add("visible");
      }
    });

    const hide = bus.on(Events.SECTION_HIDE, (id: SectionId | "all") => {
      if (id === "all") {
        Object.values(refs.current).forEach((el) => el?.classList.remove("visible"));
      } else {
        refs.current[id]?.classList.remove("visible");
      }
    });

    return () => { show(); hide(); };
  }, []);

  const refCb = (id: string) => (el: HTMLDivElement | null) => {
    refs.current[id] = el;
  };

  return (
    <div id="sections-layer">

      {/* ── Section 01: The Field ─────────────────────────────────────────── */}
      <div id="section-field" className="section-block" ref={refCb("field")}>
        <div className="section-inner">
          <p className="section-tag">00 / the field</p>
          <h2 className="section-heading">
            Before the form,<br />there is the field.
          </h2>
          <p className="section-body">
            You are standing on a surface made of potential. Thirty thousand
            points, each a seed of something that hasn't happened yet.
            <br /><br />
            Scroll. Watch what happens when attention moves through matter.
            The field does not resist. It responds.
          </p>
        </div>
      </div>

      {/* ── Section 02: The Object ───────────────────────────────────────── */}
      <div id="section-object" className="section-block" ref={refCb("object")}>
        <div className="section-inner">
          <p className="section-tag">01 / accumulation</p>
          <h2 className="section-heading">
            Accumulation<br />is not random.
          </h2>
          <p className="section-body">
            Things form by proximity. By persistence. The shape that emerges
            was never designed — it results from what approached and what
            resisted.
            <br /><br />
            Your session has never been repeated. It will not be repeated.
            The geometry forming now exists nowhere else.
          </p>
        </div>
      </div>

      {/* ── Section 03: Resistance ───────────────────────────────────────── */}
      <div id="section-resistance" className="section-block" ref={refCb("resistance")}>
        <div className="section-inner">
          <p className="section-tag">02 / resistance</p>
          <h2 className="section-heading">
            Some things<br />resist existence.
          </h2>
          <p className="section-body">
            They drift inward. They contact. They break apart. So does the
            thing they touched.
            <br /><br />
            Damage is not failure. It is geometry. Every scar changes the
            structure permanently. Nothing is undone. Only transformed.
          </p>
        </div>
      </div>

      {/* ── Section 04: Formation (revival) ─────────────────────────────── */}
      <div id="section-formation" className="section-block" ref={refCb("formation")}
        style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0,
                 minHeight: "unset", display: "flex", alignItems: "flex-end",
                 padding: "0 10vw 100px" }}>
        <div className="section-inner">
          <p className="section-tag">03 / formation</p>
          <h2 className="section-heading">
            Something forms.<br />Not by design.
          </h2>
          <p className="section-body">
            By accumulation. The main dot hunts. Others resist or yield.
            What absorbs becomes part of the shape. What escapes becomes
            nothing.
          </p>
        </div>
      </div>

      {/* ── Section 05: What Remains ─────────────────────────────────────── */}
      <div id="section-remains" className="section-block" ref={refCb("remains")}
        style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0,
                 minHeight: "unset", display: "flex", alignItems: "flex-end",
                 padding: "0 10vw 100px" }}>
        <div className="section-inner">
          <p className="section-tag">04 / what remains</p>
          <h2 className="section-heading">
            Something survives.
          </h2>
          <p className="section-body">
            Asymmetric. Irregular. Not beautiful by design — it just is
            what it is.
            <br /><br />
            The orbiting forms do not threaten. They witness. Some things
            exist only to see that other things persist.
          </p>
        </div>
      </div>

    </div>
  );
}
