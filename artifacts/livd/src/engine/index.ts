import { initScene, renderer, scene, camera } from "./scene";
import { initSpacetime, updateSpacetime } from "./spacetime";
import { initNarrative, startLoadingAnimation, updateNarrative, handleScroll } from "./narrative";
import { state } from "../store/state";

let _started = false;
let _lastTime = 0;

function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch { return false; }
}

export async function startEngine(mainCanvas: HTMLCanvasElement) {
  if (_started) return;
  if (!isWebGLAvailable()) throw new Error("WebGL not available");
  _started = true;

  initScene(mainCanvas);
  initSpacetime();

  // Kick off loading animation immediately (while font loads)
  startLoadingAnimation();

  // Font loads in parallel
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
