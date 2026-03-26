import * as THREE from "three";

// ─── Renderer ─────────────────────────────────────────────────────────────
export let renderer: THREE.WebGLRenderer;
export let scene: THREE.Scene;
export let camera: THREE.PerspectiveCamera;
export let lights: {
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
  fill: THREE.PointLight;
  accent: THREE.PointLight;
};

export function initScene(canvas: HTMLCanvasElement) {
  // Renderer — throws if WebGL unavailable
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  if (!renderer.getContext()) throw new Error("WebGL context not available");
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.045);

  // Camera
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 80);
  camera.position.set(0, 1.2, 8);
  camera.lookAt(0, 0, 0);

  // Lighting rig
  const ambient = new THREE.AmbientLight(0xffffff, 0.04);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(-4, 6, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 30;
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  scene.add(sun);

  // Warm fill from below-right
  const fill = new THREE.PointLight(0x334466, 0.6, 20);
  fill.position.set(4, -2, 4);
  scene.add(fill);

  // Cool accent rim from behind
  const accent = new THREE.PointLight(0x000820, 0.8, 15);
  accent.position.set(0, 3, -5);
  scene.add(accent);

  lights = { ambient, sun, fill, accent };

  // Resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
