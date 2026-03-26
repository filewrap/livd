import { useState } from "react";
import { state } from "../store/state";

export function Hint() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        id="hint-trigger"
        aria-label="About"
        onClick={() => setOpen((o) => !o)}
      >
        ·
      </button>
      <div id="hint-panel" className={open ? "open" : ""}>
        <div className="hint-title">·livd</div>
        <div className="hint-body">
          {`you are observing an entity.\n\nnot a demonstration.\nnot a metaphor.\n\nthe website itself\nis the thing that lives\nand dies.\n\nscroll. read. reach the end.\nsomething will happen.\n\n`}
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", letterSpacing: "0.14em" }}>
            session #{state.sessionSeed}
          </span>
        </div>
        <div className="hint-dot">·</div>
      </div>
    </>
  );
}
