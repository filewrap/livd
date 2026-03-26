import * as THREE from "three";
import gsap from "gsap";
import { scene, camera, lights } from "./scene";
import { gravitySources, updateSpacetime, setSpacetimeOpacity } from "./spacetime";
import { createBgObjects, BgObject, createEnemy, EnemyObject, createOrbiter, Orbiter, deepMaterial, glowMaterial, metalMaterial } from "./objects";
import { loadFont, buildText3D, buildTextWebsite, buildTextWelcomeChars, buildTextEnd } from "./text3d";
import { sampleMeshToPoints, animateParticlesWipe, animateParticlesExplode, animateParticlesConverge, flashLine, ripple } from "./particles";
import { state, bus, Events } from "../store/state";

// ─── Mulberry32 seeded random ─────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(Date.now());

// ─── Phase globals ─────────────────────────────────────────────────────────
let bgObjects: BgObject[] = [];
let heroGroup: THREE.Group;

// Dot revival
type Dot = {
  mesh: THREE.Mesh;
  x: number; y: number;
  vx: number; vy: number;
  isMain: boolean;
  resistant: boolean;
  absorbed: boolean;
  dead: boolean;
  size: number;
  id: number;
};
const dots: Dot[] = [];
let mainDot: Dot | null = null;
let dotIdCounter = 0;
let revivalActive = false;
let revivalRaf = 0;
const geomVerts: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
let mainObj: THREE.Mesh | null = null;
let mainObjGravityIdx = -1;

// Conflict
const enemies: EnemyObject[] = [];
let conflictActive = false;
let firstContact = false;
let conflictRaf = 0;

// Orbiting objects
const orbiters: Orbiter[] = [];

// ─── Loading Canvas ────────────────────────────────────────────────────────
let _loadCanvas: HTMLCanvasElement | null = null;
let _loadCtx: CanvasRenderingContext2D | null = null;
let _loadPhase = "forming";
let _loadT = 0;
let _loadRaf = 0;
let _assetsReady = false;
const PC = 30;

function drawLoading() {
  if (!_loadCtx) return;
  const cx = 40, cy = 40, r = 22;
  _loadCtx.clearRect(0, 0, 80, 80);
  _loadCtx.fillStyle = "#000";
  _loadCtx.fillRect(0, 0, 80, 80);

  if (_loadPhase === "forming") {
    const p = Math.min(_loadT / 1.2, 1);
    const e = 1 - Math.pow(1 - p, 3);
    for (let i = 0; i < PC; i++) {
      const a = (i / PC) * Math.PI * 2;
      const d = r * 3 + (r - r * 3) * e;
      _loadCtx.beginPath();
      _loadCtx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.8 * e + 0.5, 0, Math.PI * 2);
      _loadCtx.fillStyle = `rgba(255,255,255,${e * 0.9})`;
      _loadCtx.fill();
    }
    if (_loadT >= 1.2) { _loadPhase = "holding"; _loadT = 0; }

  } else if (_loadPhase === "holding") {
    for (let i = 0; i < PC; i++) {
      const a = (i / PC) * Math.PI * 2;
      _loadCtx.beginPath();
      _loadCtx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.2, 0, Math.PI * 2);
      _loadCtx.fillStyle = "rgba(255,255,255,0.9)";
      _loadCtx.fill();
    }
    if (_loadT >= 0.3) { _loadPhase = _assetsReady ? "final" : "breaking"; _loadT = 0; }

  } else if (_loadPhase === "breaking") {
    const p = Math.min(_loadT / 0.8, 1), e = p * p;
    for (let i = 0; i < PC; i++) {
      const a = (i / PC) * Math.PI * 2;
      const d = r + e * r * 3.5;
      _loadCtx.beginPath();
      _loadCtx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.2 * (1 - e * 0.5), 0, Math.PI * 2);
      _loadCtx.fillStyle = `rgba(255,255,255,${0.9 * (1 - e)})`;
      _loadCtx.fill();
    }
    if (_loadT >= 0.8) { _loadPhase = _assetsReady ? "final" : "forming"; _loadT = 0; }

  } else if (_loadPhase === "final") {
    const fp = Math.min(_loadT / 1.2, 1), fe = 1 - Math.pow(1 - fp, 3);
    if (fp < 1) {
      for (let i = 0; i < PC; i++) {
        const a = (i / PC) * Math.PI * 2;
        const d = r * 2 + (r - r * 2) * fe;
        _loadCtx.beginPath();
        _loadCtx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.2, 0, Math.PI * 2);
        _loadCtx.fillStyle = `rgba(255,255,255,${fe * 0.9})`;
        _loadCtx.fill();
      }
    } else {
      const et = _loadT - 1.2, ep = Math.min(et / 0.55, 1), eased = ep * ep;
      const expandR = r * (1 + eased * 28);
      _loadCtx.beginPath();
      _loadCtx.arc(cx, cy, expandR, 0, Math.PI * 2);
      _loadCtx.fillStyle = "#000"; _loadCtx.fill();
      for (let i = 0; i < PC; i++) {
        const a = (i / PC) * Math.PI * 2;
        _loadCtx.beginPath();
        _loadCtx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.2, 0, Math.PI * 2);
        _loadCtx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.9 - eased * 1.2)})`;
        _loadCtx.fill();
      }
      if (et >= 0.85) {
        cancelAnimationFrame(_loadRaf);
        beginTransitionFromLoading();
        return;
      }
    }
  }

  _loadT += 0.016;
  _loadRaf = requestAnimationFrame(drawLoading);
}

function beginTransitionFromLoading() {
  const el = document.getElementById("loading-screen");
  if (!el) return;
  gsap.to(el, {
    opacity: 0, duration: 0.8, ease: "power2.in",
    onComplete: () => {
      el.style.display = "none";
      startHero();
    },
  });
}

// ─── HERO SEQUENCE ─────────────────────────────────────────────────────────
function startHero() {
  state.phase = "hero";
  state.navVisible = true;
  bus.emit(Events.NAV_SHOW);

  // Show nav + hero text after short delay
  setTimeout(() => {
    state.heroTextVisible = true;
    bus.emit(Events.HERO_TEXT_SHOW);
  }, 800);

  // Reveal bg shapes
  bgObjects.forEach((obj, i) => {
    scene.add(obj.mesh);
    gsap.from(obj.mesh.position, { y: obj.basePos.y - 3, duration: 1.8, delay: i * 0.2, ease: "expo.out" });
  });

  // "3D" text — fades in at an angle, rotates to camera
  const t3d = buildText3D();
  t3d.position.set(0, 0.4, 0);
  t3d.rotation.y = 0.28;
  t3d.scale.set(0, 0, 0);
  heroGroup.add(t3d);

  gsap.to(t3d.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: "expo.out" });
  gsap.to(t3d.rotation, { y: 0, duration: 0.7, ease: "power2.out" });
  gsap.to(lights.fill, { intensity: 1.2, duration: 1.2, delay: 0.3 });

  // Add to gravity sources
  gravitySources.push({ x: 0, y: 0, z: 0, strength: 0.8 });

  // "website" text — enters from below
  const tWeb = buildTextWebsite();
  tWeb.position.set(0, -2.2, 0);
  (tWeb.material as THREE.Material & { opacity: number; transparent: boolean }).opacity = 0;
  (tWeb.material as THREE.Material & { transparent: boolean }).transparent = true;
  heroGroup.add(tWeb);

  gsap.to(tWeb.position, { y: -0.9, duration: 0.6, delay: 0.35, ease: "power2.out" });
  gsap.to(tWeb.material as any, { opacity: 1, duration: 0.5, delay: 0.35 });

  // After 1.5s, wipe "3D" and melt "website"
  setTimeout(() => {
    heroGroup.remove(t3d);
    scene.add(t3d);
    const pts = sampleMeshToPoints(t3d, 2200, 0xffffff);
    scene.add(pts);
    scene.remove(t3d);

    animateParticlesWipe(pts, 1.3, () => {
      scene.remove(pts);
      meltWebsite(tWeb);
    });
  }, 1500);
}

function meltWebsite(mesh: THREE.Mesh) {
  const pa = mesh.geometry.attributes.position as THREE.BufferAttribute;
  const arr = pa.array as Float32Array;
  const count = pa.count;
  const speeds = new Float32Array(count).map(() => 0.35 + rng() * 1.8);
  const delays = new Float32Array(count).map(() => rng() * 0.9);
  const mat = mesh.material as THREE.MeshPhysicalMaterial;

  const start = Date.now();
  function tick() {
    const el = (Date.now() - start) / 1000;
    for (let i = 0; i < count; i++) {
      if (el > delays[i]) arr[i * 3 + 1] -= speeds[i] * 0.016;
    }
    pa.needsUpdate = true;
    mat.color.lerpColors(new THREE.Color(0xcccccc), new THREE.Color(0x888888), Math.min(el / 2, 1));
    mat.opacity = Math.max(0, 1 - el / 2.3);
    if (el < 2.8) requestAnimationFrame(tick);
    else { heroGroup.remove(mesh); spawnWelcome(); }
  }
  requestAnimationFrame(tick);
}

function spawnWelcome() {
  const chars = buildTextWelcomeChars();

  if (chars.length === 1) {
    // Fallback — single mesh
    const m = chars[0];
    m.position.set(0, 0, 5);
    scene.add(m);
    gsap.to(m.position, { z: 0, duration: 0.3, ease: "power4.out" });
    setTimeout(() => explodeChar(m, () => afterWelcome()), 1000);
  } else {
    // Per-character positions
    const width = chars.length * 1.35;
    chars.forEach((ch, i) => {
      const xBase = (i - chars.length / 2) * 1.35 + 0.675;
      ch.position.set(xBase, 0, 5 + i * 0.02);
      scene.add(ch);
    });
    gsap.to({ z: 5 }, {
      z: 0, duration: 0.28, ease: "power4.out",
      onUpdate: function () {
        const z = (this as any).targets()[0].z;
        chars.forEach((ch, i) => { ch.position.z = z + i * 0.02; });
      },
      onComplete: () => {
        setTimeout(() => {
          let done = 0;
          chars.forEach((ch) => {
            explodeChar(ch, () => {
              done++;
              if (done === chars.length) afterWelcome();
            });
          });
        }, 1000);
      },
    });
  }
}

function explodeChar(mesh: THREE.Mesh, onDone: () => void) {
  const vx = (rng() - 0.5) * 11, vy = (rng() - 0.5) * 8, vz = (rng() - 0.5) * 6;
  const rx = (rng() - 0.5) * 0.4, ry = (rng() - 0.5) * 0.4, rz = (rng() - 0.5) * 0.35;
  const mat = mesh.material as THREE.MeshPhysicalMaterial;
  mat.transparent = true;
  const fadeDelay = 1.5 + rng() * 1.2;
  const start = Date.now();

  function tick() {
    const el = (Date.now() - start) / 1000;
    const drag = Math.pow(0.955, el * 60);
    mesh.position.x += vx * 0.016 * drag;
    mesh.position.y += vy * 0.016 * drag;
    mesh.position.z += vz * 0.016 * drag;
    mesh.rotation.x += rx;
    mesh.rotation.y += ry;
    mesh.rotation.z += rz;
    if (el > fadeDelay) mat.opacity = Math.max(0, mat.opacity - 0.01);
    if (mat.opacity <= 0) { scene.remove(mesh); onDone(); return; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function afterWelcome() {
  // 1.5s silence, then unlock scroll
  setTimeout(() => {
    bus.emit(Events.HERO_TEXT_HIDE);
    transitionToScroll();
  }, 1500);
}

// ─── SCROLL ZONE ───────────────────────────────────────────────────────────
let destructionFired = false;
let _lastScrollTime = 0;

function transitionToScroll() {
  state.phase = "scroll";
  state.scrollLocked = false;
  bus.emit(Events.ISLAND_SHOW, "you can move now", 210);
  setTimeout(() => bus.emit(Events.ISLAND_HIDE), 2800);
  bus.emit(Events.SECTION_SHOW, "field");
}

export function handleScroll(scrollTop: number, maxScroll: number) {
  if (state.scrollLocked || state.phase !== "scroll") {
    return;
  }
  state.scrollProgress = maxScroll > 0 ? Math.min(scrollTop / maxScroll, 1) : 0;

  const now = Date.now();
  if (now - _lastScrollTime < 35 && _lastScrollTime > 0) {
    bus.emit(Events.ISLAND_SHOW, "slow down.", 180);
  }
  _lastScrollTime = now;

  // Camera forward
  camera.position.z = 8 - state.scrollProgress * 2.5;

  // Update bg shapes brightness/crack
  bgObjects.forEach((obj, i) => {
    const br = 0.055 + state.scrollProgress * 0.3;
    (obj.mesh.material as THREE.MeshPhysicalMaterial).color.setScalar(br);

    if (state.scrollProgress > 0.35) {
      const cT = Math.min((state.scrollProgress - 0.35) / 0.35, 1);
      const mat = obj.mesh.material as THREE.MeshPhysicalMaterial;
      mat.emissive.set(0xffffff);
      mat.emissiveIntensity = cT * 0.07;
      mat.wireframe = cT > 0.7;
    }

    if (state.scrollProgress > 0.65 && i === 0) {
      state.cursorTremor = (state.scrollProgress - 0.65) / 0.25 > 0.2;
    }
  });

  // Section reveals
  if (state.scrollProgress > 0.2) bus.emit(Events.SECTION_SHOW, "object");
  if (state.scrollProgress > 0.55) bus.emit(Events.SECTION_SHOW, "resistance");

  if (state.scrollProgress >= 0.9 && !destructionFired) {
    triggerDestruction();
  }
}

// ─── DESTRUCTION ───────────────────────────────────────────────────────────
function triggerDestruction() {
  if (destructionFired) return;
  destructionFired = true;
  state.phase = "destruction";
  state.scrollLocked = true;
  state.cursorTremor = false;
  bus.emit(Events.SECTION_HIDE, "all");

  bus.emit(Events.ISLAND_SHOW, "an error occurred.", 250);

  setTimeout(() => {
    bus.emit(Events.ISLAND_SHOW, "going home →", 210);

    setTimeout(() => {
      // Auto scroll back
      const scrollEl = document.getElementById("scroll-layer");
      if (scrollEl) gsap.to(scrollEl, { scrollTop: 0, duration: 1.8, ease: "power2.out" });

      gsap.to(camera.position, { z: 10, duration: 1.8, ease: "power2.in" });

      bgObjects.forEach((obj) => {
        const mat = obj.mesh.material as THREE.MeshPhysicalMaterial;
        mat.wireframe = true;
        gsap.to(mat, { emissiveIntensity: 0.2, duration: 0.4 });
      });

      setTimeout(collapseAllToCenter, 1100);
    }, 1300);
  }, 800);
}

function collapseAllToCenter() {
  // Camera single-frame shake
  const ox = camera.position.x, oy = camera.position.y;
  camera.position.x += (rng() - 0.5) * 0.15;
  camera.position.y += (rng() - 0.5) * 0.15;
  setTimeout(() => { camera.position.x = ox; camera.position.y = oy; }, 90);

  const allPts: THREE.Points[] = [];
  bgObjects.forEach((obj) => {
    scene.remove(obj.mesh);
    const pts = sampleMeshToPoints(obj.mesh, 280, 0xffffff);
    pts.position.copy(obj.mesh.position);
    scene.add(pts);
    allPts.push(pts);
  });

  // Converge all to center
  let doneCount = 0;
  allPts.forEach((pts) => {
    animateParticlesConverge(pts, 0.9, new THREE.Vector3(0, 0, 0), () => {
      doneCount++;
      if (doneCount === allPts.length) {
        explodeAllParticles(allPts);
      }
    });
  });
}

function explodeAllParticles(allPts: THREE.Points[]) {
  let doneCount = 0;
  allPts.forEach((pts) => {
    animateParticlesExplode(pts, 1.1, () => {
      scene.remove(pts);
      doneCount++;
      if (doneCount === allPts.length) trailOneDotToCenter();
    });
  });
}

function trailOneDotToCenter() {
  const geo = new THREE.SphereGeometry(0.05, 12, 12);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0 });
  const dot = new THREE.Mesh(geo, mat);

  const startPos = new THREE.Vector3(
    (rng() - 0.5) * 12,
    (rng() - 0.5) * 8,
    (rng() - 0.5) * 5,
  );
  dot.position.copy(startPos);
  scene.add(dot);

  // Add subtle point light following dot
  const dotLight = new THREE.PointLight(0xffffff, 0.5, 5);
  scene.add(dotLight);

  gsap.to(mat, { opacity: 1, duration: 0.4 });
  gsap.to(dot.position, {
    x: 0, y: 0, z: 0,
    duration: 2.4,
    ease: "power2.out",
    onUpdate: () => { dotLight.position.copy(dot.position); },
    onComplete: () => {
      scene.remove(dotLight);
      startRevival(dot);
    },
  });
}

// ─── REVIVAL ───────────────────────────────────────────────────────────────
function startRevival(firstDot: THREE.Mesh) {
  state.phase = "revival";
  state.scrollLocked = true;
  gsap.to(camera.position, { x: 0, y: 1.2, z: 8, duration: 1.5, ease: "power2.out" });
  bus.emit(Events.ISLAND_SHOW, "wait.", 160);

  // Setup gravity for cursor
  state.cursorGravity = true;
  state.gravityTarget = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // Show "formation" section text
  bus.emit(Events.SECTION_SHOW, "formation");

  // Create main dot entry
  const mdObj: Dot = {
    mesh: firstDot,
    x: 0, y: 0, vx: 0, vy: 0,
    isMain: true, resistant: false, absorbed: false, dead: false,
    size: 0.07, id: dotIdCounter++,
  };
  dots.push(mdObj);
  mainDot = mdObj;

  // Gravity source at dot
  gravitySources.push({ x: 0, y: 0, z: 0, strength: 1.2 });
  mainObjGravityIdx = gravitySources.length - 1;

  // Pulse main dot
  gsap.to(firstDot.scale, {
    x: 1.4, y: 1.4, z: 1.4,
    duration: 1.0, yoyo: true, repeat: -1, ease: "sine.inOut",
  });

  // Spawn dots progressively
  let count = 1, interval = 1200;
  const spawnLoop = () => {
    if (count >= 32 || state.phase !== "revival") return;
    spawnDot();
    count++;
    if (count === 8) revivalActive = true;
    interval = Math.max(370, interval - 48);
    setTimeout(spawnLoop, interval + rng() * 200);
  };
  setTimeout(spawnLoop, 1200);

  runRevivalLoop();
}

function spawnDot() {
  const angle = rng() * Math.PI * 2;
  const radius = 0.6 + rng() * 2.0;
  const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
  const size = 0.03 + rng() * 0.045;
  const br = 0.75 + rng() * 0.25;
  const resistant = rng() < 0.25;

  const geo = new THREE.SphereGeometry(size, 8, 8);
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(br, br, br),
    roughness: 0.3, metalness: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 0);
  mesh.castShadow = true;
  scene.add(mesh);

  dots.push({ mesh, x, y, vx: 0, vy: 0, isMain: false, resistant, absorbed: false, dead: false, size, id: dotIdCounter++ });
}

function runRevivalLoop() {
  revivalRaf = requestAnimationFrame(runRevivalLoop);
  if (!revivalActive || !mainDot) return;

  const md = mainDot;

  // Find nearest valid target
  let nearest: Dot | null = null, nearestDist = Infinity;
  dots.forEach((d) => {
    if (d.isMain || d.absorbed || d.dead) return;
    const dist = Math.hypot(md.x - d.x, md.y - d.y);

    if (d.resistant && dist < 1.8) {
      // Flee
      const ax = (d.x - md.x) / dist, ay = (d.y - md.y) / dist;
      d.vx += ax * 0.012; d.vy += ay * 0.012;
    }

    if (dist < nearestDist) { nearestDist = dist; nearest = d; }
  });

  if (nearest) {
    const nd = nearest as Dot;
    const dist = Math.hypot(md.x - nd.x, md.y - nd.y) || 0.001;
    const dx = (nd.x - md.x) / dist, dy = (nd.y - md.y) / dist;
    // Curved path: add perpendicular nudge
    const perp = { x: -dy * 0.004, y: dx * 0.004 };
    md.vx += dx * 0.009 + perp.x;
    md.vy += dy * 0.009 + perp.y;
  }

  md.vx *= 0.90; md.vy *= 0.90;
  md.x += md.vx; md.y += md.vy;
  md.mesh.position.set(md.x, md.y, 0);

  // Update gravity target for cursor
  if (mainObjGravityIdx >= 0) {
    gravitySources[mainObjGravityIdx].x = md.x;
    gravitySources[mainObjGravityIdx].y = 0;
    gravitySources[mainObjGravityIdx].z = md.y;
  }
  state.gravityTarget = {
    x: window.innerWidth / 2 + md.x * 90,
    y: window.innerHeight / 2 - md.y * 90,
  };

  // Move all dots
  dots.forEach((d) => {
    if (d.isMain || d.absorbed || d.dead) return;
    d.vx *= 0.91; d.vy *= 0.91;
    d.x += d.vx; d.y += d.vy;
    d.mesh.position.set(d.x, d.y, 0);

    // Resistant escape
    if (d.resistant && Math.hypot(d.x, d.y) > 3.0) {
      d.dead = true;
      state.deadDotCount++;
      const mat = d.mesh.material as THREE.MeshPhysicalMaterial;
      mat.transparent = true;
      gsap.to(mat, { opacity: 0, duration: 1, onComplete: () => { scene.remove(d.mesh); } });
      ripple(new THREE.Vector3(d.x, d.y, 0));
      return;
    }

    const dist = Math.hypot(md.x - d.x, md.y - d.y);
    if (dist < md.size + d.size + 0.04) absorbDot(d);
  });
}

function absorbDot(d: Dot) {
  if (!mainDot) return;
  d.absorbed = true;
  state.absorptionCount++;
  state.absorptionOrder.push(d.id);

  flashLine(
    new THREE.Vector3(mainDot.x, mainDot.y, 0),
    new THREE.Vector3(d.x, d.y, 0),
  );
  scene.remove(d.mesh);

  // Grow main dot
  mainDot.size += 0.006;
  const ns = mainDot.size / 0.07;
  gsap.to(mainDot.mesh.scale, { x: ns, y: ns, z: ns, duration: 0.25 });

  // Grow procedural geometry
  growGeometry(d.x, d.y);

  // Transition to conflict
  if (state.absorptionCount >= 20 && state.phase === "revival") {
    state.phase = "transition";
    cancelAnimationFrame(revivalRaf);
    setTimeout(startConflict, 2000);
  }
}

function growGeometry(x: number, y: number) {
  const vx = x + (rng() - 0.5) * 0.4;
  const vy = y + (rng() - 0.5) * 0.4;
  const vz = (rng() - 0.5) * 0.6;
  geomVerts.push(new THREE.Vector3(vx, vy, vz));

  if (mainObj) scene.remove(mainObj);
  if (geomVerts.length < 4) return;

  // Build mesh from vertices
  const positions: number[] = [];
  for (let i = 1; i < geomVerts.length - 1; i++) {
    const p0 = geomVerts[0], p1 = geomVerts[i], p2 = geomVerts[i + 1] || geomVerts[1];
    positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xe8e8e8,
    roughness: 0.3,
    metalness: 0.75,
    reflectivity: 0.7,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    wireframe: state.absorptionCount % 4 !== 0,
    emissive: new THREE.Color(0x0a0a14),
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });

  mainObj = new THREE.Mesh(geo, mat);
  mainObj.castShadow = true;
  scene.add(mainObj);
}

// ─── CONFLICT ──────────────────────────────────────────────────────────────
function startConflict() {
  state.phase = "conflict";
  state.cursorGravity = false;
  bus.emit(Events.SECTION_SHOW, "resistance");
  bus.emit(Events.ISLAND_SHOW, "resistance", 160);
  bus.emit(Events.ISLAND_BORDER, "#8B0000");
  bus.emit(Events.CURSOR_RED);

  setTimeout(() => {
    bus.emit(Events.ISLAND_BORDER, "#1a1a1a");
    bus.emit(Events.ISLAND_HIDE);
    bus.emit(Events.CURSOR_RESTORE);
  }, 2200);

  const total = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < total; i++) {
    setTimeout(() => {
      const enemy = createEnemy(i);
      scene.add(enemy.mesh);
      enemies.push(enemy);
      // 40-50% become enemies after 2s
      setTimeout(() => {
        if (rng() < 0.45) {
          enemy.isEnemy = true;
          const mat = enemy.mesh.material as THREE.MeshPhysicalMaterial;
          gsap.to(mat.color, { r: 0x6b / 255, g: 0, b: 0, duration: 0.8 });
          enemy.vx *= 3; enemy.vy *= 3;
        }
      }, 2000);
    }, i * 380);
  }

  conflictActive = true;
  runConflictLoop();
}

function runConflictLoop() {
  conflictRaf = requestAnimationFrame(runConflictLoop);
  if (!conflictActive) return;

  const mp = mainDot
    ? new THREE.Vector3(mainDot.x, mainDot.y, 0)
    : new THREE.Vector3(0, 0, 0);

  enemies.forEach((e) => {
    if (!e.alive) return;
    if (e.isEnemy) {
      const dx = mp.x - e.mesh.position.x, dy = mp.y - e.mesh.position.y;
      const d = Math.hypot(dx, dy) || 1;
      e.vx += (dx / d) * 0.003; e.vy += (dy / d) * 0.003;
    }
    e.vx *= 0.96; e.vy *= 0.96;
    e.mesh.position.x += e.vx;
    e.mesh.position.y += e.vy;
    e.mesh.rotation.x += 0.013;
    e.mesh.rotation.y += 0.017;

    if (e.isEnemy && mainObj) {
      const dist = e.mesh.position.distanceTo(mp);
      if (dist < 0.9) {
        if (!firstContact) {
          firstContact = true;
          bus.emit(Events.CURSOR_RED);
          setTimeout(() => bus.emit(Events.CURSOR_RESTORE), 200);
        }
        distortMainObj();
        fragmentEnemy(e);
        loseGeomPiece();
      }
    }
  });

  // Check win condition
  const alive = enemies.filter((e) => e.alive && e.isEnemy);
  const had = enemies.some((e) => e.isEnemy);
  if (conflictActive && had && alive.length === 0) {
    conflictActive = false;
    cancelAnimationFrame(conflictRaf);
    onAllEnemiesDefeated();
  }
}

function distortMainObj() {
  if (!mainObj || !mainObj.geometry.attributes.position) return;
  const mat = mainObj.material as THREE.MeshPhysicalMaterial;
  const pa = mainObj.geometry.attributes.position as THREE.BufferAttribute;
  const idx = Math.floor(rng() * pa.count) * 3;
  pa.array[idx]     += (rng() - 0.5) * 0.09;
  pa.array[idx + 1] += (rng() - 0.5) * 0.09;
  (pa.array as Float32Array)[idx + 2] += (rng() - 0.5) * 0.06;
  pa.needsUpdate = true;
  mainObj.geometry.computeVertexNormals();
  const origEI = mat.emissiveIntensity;
  mat.emissiveIntensity = 0.7;
  setTimeout(() => { if (mainObj) mat.emissiveIntensity = origEI; }, 140);
}

function fragmentEnemy(e: EnemyObject) {
  e.alive = false;
  const pts = sampleMeshToPoints(e.mesh, 60, 0xffffff);
  pts.position.copy(e.mesh.position);
  scene.add(pts);
  scene.remove(e.mesh);
  animateParticlesExplode(pts, 0.8, () => scene.remove(pts));
}

function loseGeomPiece() {
  if (geomVerts.length <= 5) return;
  const ri = 1 + Math.floor(rng() * (geomVerts.length - 2));
  const removed = geomVerts.splice(ri, 1)[0];

  const fragGeo = new THREE.SphereGeometry(0.06, 7, 7);
  const fragMat = new THREE.MeshPhysicalMaterial({ color: 0xe8e8e8, roughness: 0.3, metalness: 0.7, transparent: true, opacity: 0.7 });
  const frag = new THREE.Mesh(fragGeo, fragMat);
  frag.position.copy(removed);
  scene.add(frag);
  const vx = (rng() - 0.5) * 0.03, vy = (rng() - 0.5) * 0.03;
  function driftFrag() {
    frag.position.x += vx; frag.position.y += vy;
    fragMat.opacity -= 0.0025;
    if (fragMat.opacity > 0) requestAnimationFrame(driftFrag);
    else scene.remove(frag);
  }
  requestAnimationFrame(driftFrag);
  growGeometry(0, 0); // Rebuild without that vertex
}

// ─── REBUILDING ────────────────────────────────────────────────────────────
function onAllEnemiesDefeated() {
  state.phase = "rebuilding";
  bus.emit(Events.ISLAND_SHOW, "rebuilt", 160);
  bus.emit(Events.ISLAND_BORDER, "#00bb44");
  setTimeout(() => {
    bus.emit(Events.ISLAND_BORDER, "#1a1a1a");
    bus.emit(Events.ISLAND_HIDE);
  }, 2200);
  bus.emit(Events.SECTION_SHOW, "remains");

  // Spawn orbiters
  setTimeout(() => {
    const n = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const orb = createOrbiter(i, n);
      scene.add(orb.mesh);
      orbiters.push(orb);
    }

    // Unlock scroll and enter survival
    setTimeout(() => {
      state.phase = "survival";
      state.scrollLocked = false;
      bus.emit(Events.ISLAND_SHOW, "you can move now", 215);
      bus.emit(Events.SEED_SHOW);
      setTimeout(() => bus.emit(Events.ISLAND_HIDE), 2800);
      startSurvival();
    }, 3500);
  }, 2000);
}

// ─── SURVIVAL ──────────────────────────────────────────────────────────────
let survivalEndTimer: ReturnType<typeof setTimeout> | null = null;

function startSurvival() {
  survivalEndTimer = setTimeout(() => {
    if (!state.endTriggered) triggerEnd();
  }, 55000);
}

export function checkSurvivalEnd(scrollTop: number, maxScroll: number) {
  if (state.phase !== "survival" || state.endTriggered) return;
  if (maxScroll > 0 && scrollTop / maxScroll > 0.93) triggerEnd();
}

// ─── END ───────────────────────────────────────────────────────────────────
function triggerEnd() {
  if (state.endTriggered) return;
  state.endTriggered = true;
  state.phase = "end";
  state.scrollLocked = true;
  if (survivalEndTimer) clearTimeout(survivalEndTimer);

  // Island shrinks to dot then vanishes
  gsap.to(document.getElementById("island")!, { width: "8px", height: "8px", duration: 0.5, ease: "power2.in" });
  gsap.to(document.getElementById("island")!, { opacity: 0, delay: 0.5, duration: 0.3 });
  bus.emit(Events.SECTION_HIDE, "all");

  // Traveling dot from edge
  const edgePositions: [number,number,number][] = [[0, 4, 0],[0,-4,0],[-6,0,0],[6,0,0]];
  const sp = edgePositions[Math.floor(rng() * 4)];
  const endDotGeo = new THREE.SphereGeometry(0.06, 12, 12);
  const endDotMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.9 });
  const endDot = new THREE.Mesh(endDotGeo, endDotMat);
  endDot.position.set(...sp);
  scene.add(endDot);

  const travelLight = new THREE.PointLight(0xffffff, 0.6, 4);
  scene.add(travelLight);

  gsap.to(endDot.position, {
    x: 0, y: 0, z: 0,
    duration: 3.5,
    ease: "power1.inOut",
    onUpdate: () => {
      travelLight.position.copy(endDot.position);
      // Objects flicker as dot passes
      orbiters.forEach((o) => {
        if (endDot.position.distanceTo(o.mesh.position) < 0.7) {
          const mat = o.mesh.material as THREE.MeshPhysicalMaterial;
          mat.emissive.set(0xffffff);
          mat.emissiveIntensity = 0.4;
          setTimeout(() => { mat.emissiveIntensity = 0; }, 200);
        }
      });
    },
    onComplete: () => {
      scene.remove(travelLight);
      showEndText(endDot);
    },
  });
}

function showEndText(centerDot: THREE.Mesh) {
  const et = buildTextEnd();
  et.scale.set(0.001, 0.001, 0.001);
  et.position.set(0, -0.1, 0);
  scene.add(et);
  gsap.to(et.scale, { x: 1, y: 1, z: 1, duration: 1, ease: "expo.out" });
  setTimeout(() => doWhiteFill(centerDot, et), 2800);
}

function doWhiteFill(center: THREE.Mesh, endText: THREE.Mesh) {
  const sphereGeo = new THREE.SphereGeometry(0.12, 20, 20);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.set(0, 0, 0);
  scene.add(sphere);
  scene.remove(center);

  const start = Date.now();
  function tick() {
    const el = (Date.now() - start) / 1000;
    const e2 = el * el;
    const sc = 1 + e2 * 22;
    sphere.scale.set(sc, sc, sc);
    const r = sc * 0.12;

    orbiters.forEach((o) => {
      if (o.mesh.position.distanceTo(sphere.position) < r) {
        (o.mesh.material as THREE.MeshPhysicalMaterial).color.set(0xffffff);
      }
    });
    if (mainObj && r > 0.6) (mainObj.material as THREE.MeshPhysicalMaterial).color.set(0xffffff);
    if (endText && r > 1) (endText.material as THREE.MeshPhysicalMaterial).color.set(0xffffff);

    if (r > 8) {
      bus.emit(Events.END_WHITE);
    }
    if (el < 3.5) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── PER-FRAME UPDATES (called from main loop) ─────────────────────────────
export function updateNarrative(time: number, delta: number) {
  // Rotate bg objects
  bgObjects.forEach((obj) => {
    obj.mesh.rotation.x += obj.rotVel.x;
    obj.mesh.rotation.y += obj.rotVel.y;
    obj.mesh.rotation.z += obj.rotVel.z;
  });

  // Rotate main object
  if (mainObj) {
    mainObj.rotation.y += 0.004;
    mainObj.rotation.x = Math.sin(time * 0.18) * 0.06;
  }

  // Orbit objects
  orbiters.forEach((o) => {
    o.angle += o.speed;
    o.mesh.position.x = Math.cos(o.angle + o.tiltZ) * o.radius;
    o.mesh.position.y = Math.sin(o.angle) * o.radius * Math.cos(o.tiltX);
    o.mesh.position.z = Math.sin(o.angle + o.tiltZ) * o.radius * 0.3;
    o.mesh.rotation.x += 0.009;
    o.mesh.rotation.y += 0.013;
  });

  // Slow camera arc during survival
  if (state.phase === "survival" || state.phase === "rebuilding") {
    camera.position.x = Math.sin(time * 0.03) * 0.35;
    camera.position.y = 1.2 + Math.cos(time * 0.022) * 0.18;
  }

  // Dynamic lighting based on phase
  if (state.phase === "conflict") {
    lights.fill.color.setHex(0x330000);
    lights.fill.intensity = 1.8;
  } else if (state.phase === "revival") {
    const pulse = Math.sin(time * 1.5) * 0.2 + 0.8;
    lights.fill.intensity = pulse;
  } else if (state.phase === "survival") {
    lights.fill.color.setHex(0x334466);
    lights.fill.intensity = 0.6;
  }
}

// ─── INIT ──────────────────────────────────────────────────────────────────
export async function initNarrative() {
  // Get loading canvas from DOM
  const loadCanvas = document.getElementById("loading-canvas") as HTMLCanvasElement | null;
  if (loadCanvas) {
    _loadCanvas = loadCanvas;
    _loadCtx = loadCanvas.getContext("2d");
    loadCanvas.width = 80;
    loadCanvas.height = 80;
  }

  heroGroup = new THREE.Group();
  scene.add(heroGroup);

  // Build bg objects (but don't add to scene yet — hero sequence does that)
  bgObjects = createBgObjects();

  // Start loading animation
  _loadRaf = requestAnimationFrame(drawLoading);

  // Load font in parallel
  try {
    await loadFont();
  } catch (_) { /* fallback ok */ }

  _assetsReady = true;
}
