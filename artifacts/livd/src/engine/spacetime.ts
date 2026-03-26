import * as THREE from "three";
import { scene } from "./scene";

// ─── The Spacetime Surface ─────────────────────────────────────────────────
// A field of dots forming the ground of the experience.
// Massive objects DEPRESS it downward — like Einstein's rubber-sheet spacetime.

const GRID_W = 76;
const GRID_H = 76;
const STEP = 0.32;
const BASE_Y = -1.85;
const TOTAL = GRID_W * GRID_H;

let positions: Float32Array;
let basePositions: Float32Array;
let pointsMesh: THREE.Points;
let geo: THREE.BufferGeometry;

// Gravity sources: objects sitting ON the fabric, depressing it
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
      basePositions[idx] = positions[idx] = x;      idx++;
      basePositions[idx] = positions[idx] = BASE_Y; idx++;
      basePositions[idx] = positions[idx] = z;      idx++;
    }
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // Color attribute — slightly varied brightness; points near center glow subtly bluer
  const colors = new Float32Array(TOTAL * 3);
  for (let i = 0; i < TOTAL; i++) {
    const v = 0.07 + Math.random() * 0.05;
    colors[i * 3]     = v * 0.85;
    colors[i * 3 + 1] = v * 0.92;
    colors[i * 3 + 2] = v + 0.05;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.036,
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    sizeAttenuation: true,
    depthWrite: false,
  });

  pointsMesh = new THREE.Points(geo, mat);
  scene.add(pointsMesh);
}

export function updateSpacetime(time: number) {
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  const colAttr = geo.attributes.color as THREE.BufferAttribute;
  const colArr = colAttr.array as Float32Array;

  for (let i = 0; i < TOTAL; i++) {
    const i3 = i * 3;
    const bx = basePositions[i3];
    const bz = basePositions[i3 + 2];

    // Gentle ambient ripple
    const wave =
      Math.sin(bx * 0.45 + time * 0.55) * 0.035 +
      Math.sin(bz * 0.38 + time * 0.48) * 0.035 +
      Math.sin((bx + bz) * 0.28 + time * 0.38) * 0.018;

    // Each gravity source DEPRESSES the fabric downward (positive → deeper hole)
    let depression = 0;
    let glow = 0;
    for (const src of gravitySources) {
      const dx = bx - src.x;
      const dz = bz - src.z;
      const dist2 = dx * dx + dz * dz;
      const dist = Math.sqrt(dist2) + 0.001;
      const r = src.strength * 2.2;
      // Gaussian well — deepest at center, smooth falloff
      const well = Math.exp(-dist2 / (r * r)) * src.strength * 0.85;
      depression += well;
      // Fabric glows near the source
      glow += Math.exp(-dist2 / (r * r * 0.5)) * 0.18;
    }

    // Apply depression: fabric dips DOWN under mass (correct Einstein visualization)
    arr[i3 + 1] = BASE_Y + wave - depression;

    // Color brightens near gravity sources
    const base = 0.07 + Math.random() * 0.005;
    colArr[i3]     = (base * 0.85) + glow * 0.5;
    colArr[i3 + 1] = (base * 0.92) + glow * 0.7;
    colArr[i3 + 2] = (base + 0.05) + glow;
  }

  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;

  // Smooth opacity lerp toward target
  const mat = pointsMesh.material as THREE.PointsMaterial;
  mat.opacity += (_opacityTarget - mat.opacity) * 0.035;
}

// Opacity target — smoothly lerped every frame in updateSpacetime
let _opacityTarget = 0;

export function setSpacetimeOpacity(target: number) {
  _opacityTarget = target;
}

export function setSpacetimeOpacityImmediate(opacity: number) {
  _opacityTarget = opacity;
  (pointsMesh.material as THREE.PointsMaterial).opacity = opacity;
}
