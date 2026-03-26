import * as THREE from "three";
import { scene } from "./scene";

// ─── Sample surface of a mesh as Points ───────────────────────────────────
export function sampleMeshToPoints(mesh: THREE.Mesh, count: number, color = 0xffffff): THREE.Points {
  mesh.updateMatrixWorld(true);
  const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
  const buf = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * posAttr.count);
    const v = new THREE.Vector3().fromBufferAttribute(posAttr, idx).applyMatrix4(mesh.matrixWorld);
    buf[i * 3]     = v.x;
    buf[i * 3 + 1] = v.y;
    buf[i * 3 + 2] = v.z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(buf, 3));

  const mat = new THREE.PointsMaterial({ color, size: 0.045, transparent: true, opacity: 1, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}

// ─── Animate particles outward and fade ───────────────────────────────────
export interface ParticleAnim {
  cancel: () => void;
}

export function animateParticlesWipe(
  pts: THREE.Points,
  duration: number,
  onDone?: () => void,
): ParticleAnim {
  const pa = pts.geometry.attributes.position as THREE.BufferAttribute;
  const arr = pa.array as Float32Array;
  const count = pa.count;
  const vels = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const x = arr[i * 3];
    // Left side starts first (rightward wipe based on x position)
    vels[i * 3]     = 1.2 + Math.random() * 2.8;
    vels[i * 3 + 1] = (Math.random() - 0.5) * 0.7;
    vels[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }

  const start = Date.now();
  let raf: number;
  let cancelled = false;

  function tick() {
    if (cancelled) return;
    const el = (Date.now() - start) / 1000;
    const t = el / duration;
    const drag = Math.max(0.6, 1 - el * 0.6);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Stagger by x position
      const delay = (arr[i3] + 4) / 10;
      if (el > delay * 0.35) {
        arr[i3]     += vels[i3]     * 0.016 * drag;
        arr[i3 + 1] += vels[i3 + 1] * 0.016 * drag;
        arr[i3 + 2] += vels[i3 + 2] * 0.016 * drag;
      }
    }
    pa.needsUpdate = true;
    (pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - t * 1.05);

    if (t < 1.05) {
      raf = requestAnimationFrame(tick);
    } else {
      onDone?.();
    }
  }
  raf = requestAnimationFrame(tick);
  return { cancel: () => { cancelled = true; cancelAnimationFrame(raf); } };
}

export function animateParticlesExplode(
  pts: THREE.Points,
  duration: number,
  onDone?: () => void,
): ParticleAnim {
  const pa = pts.geometry.attributes.position as THREE.BufferAttribute;
  const arr = pa.array as Float32Array;
  const count = pa.count;
  const vels = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    vels[i3]     = (Math.random() - 0.5) * 8;
    vels[i3 + 1] = (Math.random() - 0.5) * 8;
    vels[i3 + 2] = (Math.random() - 0.5) * 6;
  }

  const start = Date.now();
  let raf: number;
  let cancelled = false;

  function tick() {
    if (cancelled) return;
    const el = (Date.now() - start) / 1000;
    const t = el / duration;
    const drag = Math.pow(0.96, el * 45);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3]     += vels[i3]     * 0.016 * drag;
      arr[i3 + 1] += vels[i3 + 1] * 0.016 * drag;
      arr[i3 + 2] += vels[i3 + 2] * 0.016 * drag;
    }
    pa.needsUpdate = true;
    (pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - t);

    if (t < 1) raf = requestAnimationFrame(tick);
    else onDone?.();
  }
  raf = requestAnimationFrame(tick);
  return { cancel: () => { cancelled = true; cancelAnimationFrame(raf); } };
}

// ─── Converge toward center ────────────────────────────────────────────────
export function animateParticlesConverge(
  pts: THREE.Points,
  duration: number,
  target: THREE.Vector3,
  onDone?: () => void,
): ParticleAnim {
  const pa = pts.geometry.attributes.position as THREE.BufferAttribute;
  const arr = pa.array as Float32Array;
  const count = pa.count;

  const start = Date.now();
  let raf: number;
  let cancelled = false;

  function tick() {
    if (cancelled) return;
    const el = (Date.now() - start) / 1000;
    const t = Math.min(el / duration, 1);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3]     += (target.x - arr[i3])     * 0.05;
      arr[i3 + 1] += (target.y - arr[i3 + 1]) * 0.05;
      arr[i3 + 2] += (target.z - arr[i3 + 2]) * 0.05;
    }
    pa.needsUpdate = true;

    if (t < 1) raf = requestAnimationFrame(tick);
    else onDone?.();
  }
  raf = requestAnimationFrame(tick);
  return { cancel: () => { cancelled = true; cancelAnimationFrame(raf); } };
}

// ─── Quick flash line between two points ─────────────────────────────────
export function flashLine(p1: THREE.Vector3, p2: THREE.Vector3) {
  const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);

  const start = Date.now();
  function tick() {
    const t = (Date.now() - start) / 300;
    mat.opacity = Math.max(0, 0.9 - t * 0.9);
    if (t < 1) requestAnimationFrame(tick);
    else scene.remove(line);
  }
  requestAnimationFrame(tick);
}

// ─── Ripple ring ──────────────────────────────────────────────────────────
export function ripple(pos: THREE.Vector3) {
  const geo = new THREE.RingGeometry(0.02, 0.055, 18);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);

  const start = Date.now();
  function tick() {
    const t = (Date.now() - start) / 1000;
    const sc = 1 + t * 7;
    mesh.scale.set(sc, sc, sc);
    mat.opacity = Math.max(0, 0.5 - t * 0.5);
    if (t < 1) requestAnimationFrame(tick);
    else scene.remove(mesh);
  }
  requestAnimationFrame(tick);
}
