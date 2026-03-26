import { useState } from "react";
import { Dot } from "lucide-react";

export function Hint() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        id="hint-trigger"
        aria-label="Philosophy"
        onClick={() => setOpen((o) => !o)}
      >
        ·
      </button>
      <div id="hint-panel" className={open ? "open" : ""}>
        <div className="hint-name">·livd</div>
        <div className="hint-body">
          not a product.{"\n"}not a service.{"\n"}a moment.{"\n\n"}
          everything that exists will not.{"\n"}
          but it exists now.{"\n"}
          that is enough.{"\n\n"}
          your session seed: #{" "}
          <span style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-mono)" }} id="seed-inline" />
          {"\n\n"}
          the geometry you watched form{"\n"}
          has never existed before.{"\n"}
          it will not exist again.
        </div>
        <div className="hint-end">·</div>
      </div>
    </>
  );
}
