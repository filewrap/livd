import { initScene, renderer, scene, camera } from "./scene";
import { initSpacetime, updateSpacetime } from "./spacetime";
import { initNarrative, startLoadingAnimation, updateNarrative, handleScroll, notifyTouch } from "./narrative";
import { state } from "../store/state";

let _started = false;
let _lastTime = 0;

function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch { return false; }
}

// Phases that have 3D-only content — touch can orbit camera
const _3DPhases = new Set(["substrate", "revival", "conflict", "dominant", "end", "transitioning"]);

export async function startEngine(mainCanvas: HTMLCanvasElement) {
  if (_started) return;
  if (!isWebGLAvailable()) throw new Error("WebGL not available");
  _started = true;

  initScene(mainCanvas);
  initSpacetime();

  startLoadingAnimation();
  await initNarrative();

  // Mouse tracking
  window.addEventListener("mousemove", (e) => {
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
  });

  // Scroll tracking
  const scrollEl = document.getElementById("scroll-layer");
  if (scrollEl) {
    scrollEl.addEventListener("scroll", () => {
      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
      handleScroll(scrollEl.scrollTop, maxScroll);
    }, { passive: true });
  }

  // ── Touch camera orbit during 3D phases ──────────────────────────────────
  let touchX = 0;
  let touchY = 0;
  let touching = false;

  window.addEventListener("touchstart", (e) => {
    touching = true;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!touching || !_3DPhases.has(state.phase)) return;
    const dx = e.touches[0].clientX - touchX;
    const dy = e.touches[0].clientY - touchY;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
    // Notify narrative to pause auto-arc for 2s
    notifyTouch();
    // Pan camera — orbit around scene origin
    camera.position.x += dx * 0.008;
    camera.position.y -= dy * 0.004;
    // Clamp
    camera.position.x = Math.max(-3, Math.min(3, camera.position.x));
    camera.position.y = Math.max(0, Math.min(3, camera.position.y));
    // camera.lookAt is called every frame in updateNarrative for 3D phases
  }, { passive: true });

  window.addEventListener("touchend", () => { touching = false; }, { passive: true });

  // Mouse wheel → camera z-distance during 3D phases
  window.addEventListener("wheel", (e) => {
    if (!_3DPhases.has(state.phase)) return;
    camera.position.z += e.deltaY * 0.005;
    camera.position.z = Math.max(4, Math.min(14, camera.position.z));
  }, { passive: true });

  loop(0);
}

function loop(ts: number) {
  requestAnimationFrame(loop);
  const delta = Math.min((ts - _lastTime) / 1000, 0.05);
  _lastTime = ts;
  updateSpacetime(ts / 1000);
  updateNarrative(ts / 1000, delta);
  renderer.render(scene, camera);
}
