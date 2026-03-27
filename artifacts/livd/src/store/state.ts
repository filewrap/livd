export type Phase =
  | "loading"
  | "alive"
  | "warning"
  | "replay"
  | "dying"
  | "substrate"
  | "revival"
  | "conflict"
  | "dominant"
  | "end";

export interface ExperienceState {
  phase: Phase;
  scrollProgress: number;
  scrollLocked: boolean;
  mouseX: number;
  mouseY: number;
  cursorX: number;
  cursorY: number;
  cursorTremor: boolean;
  cursorGravity: boolean;
  gravityTarget: { x: number; y: number };
  sessionSeed: string;
  endTriggered: boolean;
}

function generateSeed(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const t = Date.now().toString();
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[(parseInt(t[i % t.length], 10) + i * 7) % chars.length];
  return s;
}

export const state: ExperienceState = {
  phase: "loading",
  scrollProgress: 0,
  scrollLocked: true,
  mouseX: typeof window !== "undefined" ? window.innerWidth / 2 : 640,
  mouseY: typeof window !== "undefined" ? window.innerHeight / 2 : 360,
  cursorX: typeof window !== "undefined" ? window.innerWidth / 2 : 640,
  cursorY: typeof window !== "undefined" ? window.innerHeight / 2 : 360,
  cursorTremor: false,
  cursorGravity: false,
  gravityTarget: { x: 0, y: 0 },
  sessionSeed: generateSeed(),
  endTriggered: false,
};

// ─── Typed Event Bus ───────────────────────────────────────────────────────
type Handler = (...args: any[]) => void;
const _handlers = new Map<string, Handler[]>();

export const bus = {
  on(event: string, handler: Handler) {
    if (!_handlers.has(event)) _handlers.set(event, []);
    _handlers.get(event)!.push(handler);
    return () => {
      const arr = _handlers.get(event);
      if (arr) _handlers.set(event, arr.filter((h) => h !== handler));
    };
  },
  emit(event: string, ...args: any[]) {
    _handlers.get(event)?.forEach((h) => h(...args));
  },
};

export const Events = {
  PHASE_CHANGE:    "phase:change",
  ISLAND_SHOW:     "island:show",
  ISLAND_HIDE:     "island:hide",
  ISLAND_BORDER:   "island:border",
  ISLAND_CLICK:    "island:click",
  NAV_MSG_SHOW:    "nav:msg:show",
  NAV_MSG_HIDE:    "nav:msg:hide",
  CURSOR_RED:      "cursor:red",
  CURSOR_RESTORE:  "cursor:restore",
  PHASE_OVERLAY:   "phase:overlay",
  END_WHITE:       "end:white",
  GALAXY_REBUILD:  "galaxy:rebuild",
} as const;
