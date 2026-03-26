export type Phase =
  | "loading"
  | "hero"
  | "scroll"
  | "destruction"
  | "revival"
  | "transition"
  | "conflict"
  | "rebuilding"
  | "survival"
  | "end";

export interface ExperienceState {
  phase: Phase;
  scrollProgress: number;
  scrollLocked: boolean;
  mouseX: number;
  mouseY: number;
  cursorX: number;
  cursorY: number;
  cursorPulsing: boolean;
  cursorTremor: boolean;
  cursorGravity: boolean;
  gravityTarget: { x: number; y: number };
  sessionSeed: string;
  absorptionOrder: number[];
  deadDotCount: number;
  absorptionCount: number;
  endTriggered: boolean;
  navVisible: boolean;
  heroTextVisible: boolean;
  seedVisible: boolean;
}

export const state: ExperienceState = {
  phase: "loading",
  scrollProgress: 0,
  scrollLocked: true,
  mouseX: typeof window !== "undefined" ? window.innerWidth / 2 : 640,
  mouseY: typeof window !== "undefined" ? window.innerHeight / 2 : 360,
  cursorX: typeof window !== "undefined" ? window.innerWidth / 2 : 640,
  cursorY: typeof window !== "undefined" ? window.innerHeight / 2 : 360,
  cursorPulsing: false,
  cursorTremor: false,
  cursorGravity: false,
  gravityTarget: { x: 0, y: 0 },
  sessionSeed: generateSeed(),
  absorptionOrder: [],
  deadDotCount: 0,
  absorptionCount: 0,
  endTriggered: false,
  navVisible: false,
  heroTextVisible: false,
  seedVisible: false,
};

function generateSeed(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const t = Date.now().toString();
  let seed = "";
  for (let i = 0; i < 6; i++) {
    seed += chars[(parseInt(t[i % t.length], 10) + i * 7) % chars.length];
  }
  return seed;
}

// ─── Event Bus ────────────────────────────────────────────────────────────
type Handler = (...args: any[]) => void;
const _handlers = new Map<string, Handler[]>();

export const bus = {
  on(event: string, handler: Handler) {
    if (!_handlers.has(event)) _handlers.set(event, []);
    _handlers.get(event)!.push(handler);
    return () => bus.off(event, handler);
  },
  off(event: string, handler: Handler) {
    const arr = _handlers.get(event);
    if (arr) _handlers.set(event, arr.filter((h) => h !== handler));
  },
  emit(event: string, ...args: any[]) {
    _handlers.get(event)?.forEach((h) => h(...args));
  },
};

// Typed events
export const Events = {
  PHASE_CHANGE:       "phase:change",
  ISLAND_SHOW:        "island:show",
  ISLAND_HIDE:        "island:hide",
  ISLAND_BORDER:      "island:border",
  NAV_SHOW:           "nav:show",
  HERO_TEXT_SHOW:     "herotext:show",
  HERO_TEXT_HIDE:     "herotext:hide",
  SEED_SHOW:          "seed:show",
  CURSOR_RED:         "cursor:red",
  CURSOR_RESTORE:     "cursor:restore",
  SECTION_SHOW:       "section:show",
  SECTION_HIDE:       "section:hide",
  END_WHITE:          "end:white",
} as const;
