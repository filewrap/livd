import { useState } from "react";
import { triggerGalaxyMode } from "../engine/narrative";

export function SecretButton() {
  const [activated, setActivated] = useState(false);

  function handleClick() {
    if (activated) return;
    setActivated(true);
    triggerGalaxyMode();
  }

  return (
    <button
      id="secret-btn"
      title="fast forward"
      onClick={handleClick}
      style={{
        position: "fixed",
        bottom: "18px",
        left: "18px",
        width: "26px",
        height: "26px",
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        cursor: activated ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9000,
        backdropFilter: "blur(4px)",
        transition: "opacity 0.4s, border-color 0.4s, background 0.4s",
        opacity: activated ? 0 : 0.35,
      }}
      onMouseEnter={(e) => {
        if (!activated) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
      }}
      onMouseLeave={(e) => {
        if (!activated) (e.currentTarget as HTMLButtonElement).style.opacity = "0.35";
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="none"
        style={{ display: "block" }}
      >
        <polygon
          points="2,1 10,6 2,11"
          fill="rgba(255,255,255,0.6)"
          stroke="none"
        />
        <rect
          x="9"
          y="1"
          width="2"
          height="10"
          fill="rgba(255,255,255,0.6)"
        />
      </svg>
    </button>
  );
}
