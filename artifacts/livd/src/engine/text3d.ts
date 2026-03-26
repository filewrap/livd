import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { metalMaterial, glowMaterial } from "./objects";

let _font: any = null;
let _loading = false;
const _queue: Array<() => void> = [];

const FONT_URL =
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_regular.typeface.json";

export async function loadFont(): Promise<void> {
  if (_font) return;
  if (_loading) return new Promise((res) => _queue.push(res));
  _loading = true;

  return new Promise((resolve) => {
    const loader = new FontLoader();
    loader.load(
      FONT_URL,
      (font) => {
        _font = font;
        _loading = false;
        _queue.forEach((fn) => fn());
        _queue.length = 0;
        resolve();
      },
      undefined,
      () => {
        // Font failed — we'll fall back to box geometry
        _loading = false;
        resolve();
      },
    );
    // Timeout fallback
    setTimeout(() => { if (!_font) { _loading = false; resolve(); } }, 5000);
  });
}

export function hasFont() { return _font !== null; }

// ─── Text mesh builders ────────────────────────────────────────────────────

export function make3DText(
  text: string,
  size: number,
  depth: number,
  material: THREE.Material,
  center = true,
): THREE.Mesh {
  if (!_font) return makeFallback(text, size, depth, material);

  try {
    const geo = new TextGeometry(text, {
      font: _font,
      size,
      depth,
      curveSegments: 10,
      bevelEnabled: true,
      bevelThickness: depth * 0.08,
      bevelSize: depth * 0.04,
      bevelOffset: 0,
      bevelSegments: 4,
    });

    if (center) {
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const cx = -(bb.max.x - bb.min.x) / 2;
      const cy = -(bb.max.y - bb.min.y) / 2;
      geo.translate(cx, cy, 0);
    }

    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
  } catch {
    return makeFallback(text, size, depth, material);
  }
}

function makeFallback(
  text: string,
  size: number,
  depth: number,
  material: THREE.Material,
): THREE.Mesh {
  const w = text.length * size * 0.65;
  const geo = new THREE.BoxGeometry(w, size * 1.1, depth * 1.5);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Pre-built text configurations matching the spec
export function buildText3D(): THREE.Mesh {
  return make3DText("3D", 1.5, 0.4, metalMaterial(0xffffff, 0.18, 0.90));
}

export function buildTextWebsite(): THREE.Mesh {
  return make3DText(
    "website",
    1.2,
    0.3,
    new THREE.MeshPhysicalMaterial({ color: 0xcccccc, roughness: 0.65, metalness: 0.35 }),
  );
}

export function buildTextWelcomeChars(): THREE.Mesh[] {
  const chars = "welcome".split("");
  const mat = () => glowMaterial(0x8B0000, 0x3d0000, 0.45);

  if (!_font) {
    const m = make3DText("welcome", 1.8, 0.5, mat());
    return [m];
  }

  return chars.map((ch) => make3DText(ch, 1.8, 0.5, mat(), false));
}

export function buildTextEnd(): THREE.Mesh {
  return make3DText(
    "end",
    0.8,
    0.2,
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.5 }),
  );
}
