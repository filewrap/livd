import { initScene, renderer, scene, camera } from "./scene";
import { initSpacetime, updateSpacetime } from "./spacetime";
import { initNarrative, updateNarrative, handleScroll, checkSurvivalEnd } from "./narrative";
import { state } from "../store/state";

let _started = false;
let _lastTime = 0;

function isWebGLAvailable(): boolean {
  try {
    const test = document.createElement("canvas");
    const gl = test.getContext("webgl2") ?? test.getContext("webgl");
    return !!gl;
  } catch {
    return false;
  }
}

export async function startEngine(mainCanvas: HTMLCanvasElement) {
  if (_started) return;
  if (!isWebGLAvailable()) throw new Error("WebGL not available");
  _started = true;

  initScene(mainCanvas);
  initSpacetime();
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
      checkSurvivalEnd(scrollEl.scrollTop, maxScroll);
    }, { passive: true });
  }

  loop(0);
}

function loop(ts: number) {
  requestAnimationFrame(loop);
  const delta = Math.min((ts - _lastTime) / 1000, 0.05);
  _lastTime = ts;
  const time = ts / 1000;

  updateSpacetime(time);
  updateNarrative(time, delta);

  renderer.render(scene, camera);
}
