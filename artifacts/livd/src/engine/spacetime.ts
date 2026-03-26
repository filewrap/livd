import * as THREE from "three";
import { scene } from "./scene";

// ─── The Spacetime Surface ─────────────────────────────────────────────────
// A field of dots that forms the "ground" of the experience.
// Points warp upward near objects, like spacetime curvature.

const GRID_W = 72;
const GRID_H = 72;
const STEP = 0.34;
const BASE_Y = -1.85;
const TOTAL = GRID_W * GRID_H;

let positions: Float32Array;
let basePositions: Float32Array;
let pointsMesh: THREE.Points;
let geo: THREE.BufferGeometry;

// Gravity sources: list of { x, y, z, strength }
export const gravitySources: { x: number; y: number; z: number; strength: number }[] = [];

export function initSpacetime() {
  geo = new THREE.BufferGeometry();
  positions = new Float32Array(TOTAL * 3);
  basePositions = new Float32Array(TOTAL * 3);

  let idx = 0;
  for (let xi = 0; xi < GRID_W; xi++) {
    for (let zi = 0; zi < GRID_H; zi++) {
      const x = (xi - GRID_W / 2) * STEP;
      const z = (zi - GRID_H / 2) * STEP;
      basePositions[idx] = positions[idx] = x;     idx++;
      basePositions[idx] = positions[idx] = BASE_Y; idx++;
      basePositions[idx] = positions[idx] = z;     idx++;
    }
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // Color attribute — slightly varied brightness for depth
  const colors = new Float32Array(TOTAL * 3);
  for (let i = 0; i < TOTAL; i++) {
    const v = 0.08 + Math.random() * 0.06;
    colors[i * 3] = v;
    colors[i * 3 + 1] = v;
    colors[i * 3 + 2] = v + 0.04;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.038,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: true,
  });

  pointsMesh = new THREE.Points(geo, mat);
  scene.add(pointsMesh);
}

export function updateSpacetime(time: number) {
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;

  for (let i = 0; i < TOTAL; i++) {
    const i3 = i * 3;
    const bx = basePositions[i3];
    const bz = basePositions[i3 + 2];

    // Base ripple wave
    const wave =
      Math.sin(bx * 0.5 + time * 0.6) * 0.04 +
      Math.sin(bz * 0.4 + time * 0.5) * 0.04 +
      Math.sin((bx + bz) * 0.3 + time * 0.4) * 0.02;

    // Gravity pull from sources
    let gravityY = 0;
    for (const src of gravitySources) {
      const dx = bx - src.x;
      const dz = bz - src.z;
      const dist2 = dx * dx + dz * dz;
      const dist = Math.sqrt(dist2) + 0.001;
      const influence = Math.max(0, 1 - dist / (3.5 * src.strength));
      gravityY += influence * influence * src.strength * 0.6;
    }

    arr[i3 + 1] = BASE_Y + wave + gravityY;
  }

  posAttr.needsUpdate = true;
}

export function setSpacetimeOpacity(opacity: number) {
  (pointsMesh.material as THREE.PointsMaterial).opacity = opacity;
}
