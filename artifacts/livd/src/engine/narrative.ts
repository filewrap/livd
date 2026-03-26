import * as THREE from "three";
import gsap from "gsap";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { scene, camera, lights } from "./scene";
import { gravitySources, setSpacetimeOpacity, setSpacetimeOpacityImmediate } from "./spacetime";
import { createEnemy, EnemyObject, createOrbiter, Orbiter, deepMaterial, createGalaxy, Galaxy } from "./objects";
import { loadFont, buildTextEnd } from "./text3d";
import { sampleMeshToPoints, animateParticlesExplode, flashLine, ripple } from "./particles";
import { runDestructionSequence } from "./destroy";
import { state, bus, Events, type Phase } from "../store/state";

// ─── Seeded random ──────────────────────────────────────────────────────────
function rng() { return Math.random(); }

// ─── Touch coordination ──────────────────────────────────────────────────────
let _lastTouchMs = 0;
export function notifyTouch() { _lastTouchMs = Date.now(); }

// ─── Global scene objects ────────────────────────────────────────────────────
let ambientObj: THREE.Mesh | null = null;        // (unused — kept for compat)
let galaxy: Galaxy | null = null;                // alive-phase cosmic background
let mainDotMesh: THREE.Mesh | null = null;       // revival main dot
let mainObjMesh: THREE.Mesh | null = null;       // built procedural object
let torusKnot: THREE.Mesh | null = null;         // dominant object
const enemies: EnemyObject[] = [];
const orbiters: Orbiter[] = [];
// Pre-seed geomVerts with slightly offset non-coplanar points so ConvexGeometry always has 3D spread
const geomVerts: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0.1, 0, 0.35),
  new THREE.Vector3(-0.1, 0.1, -0.35),
  new THREE.Vector3(0, 0.2, 0.1),
];

// Revival state
type Dot = {
  mesh: THREE.Mesh;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  isMain: boolean; resistant: boolean; absorbed: boolean; dead: boolean;
  size: number; id: number;
};
const dots: Dot[] = [];
let mainDot: Dot | null = null;
let revivalActive = false;
let revivalRaf = 0;
let dotIdCounter = 0;
let mainObjGravityIdx = -1;
let absorptionCount = 0;

// Conflict state
let conflictActive = false;
let conflictRaf = 0;
let enemiesSpawned = false;

// Solar system (alive phase)
interface Planet {
  mesh: THREE.Mesh;
  ring?: THREE.Mesh;
  radius: number;
  speed: number;
  angle: number;
  tilt: number;
}
const planets: Planet[] = [];
let _warningStartTime = 0;

// Loading canvas
let _loadCtx: CanvasRenderingContext2D | null = null;
let _loadT = 0;
let _loadPhase = "forming";
let _assetsReady = false;
const PC = 30;

// ─── Loading Canvas ──────────────────────────────────────────────────────────
function drawLoading() {
  if (!_loadCtx) return;
  const ctx = _loadCtx;
  const cx = 40, cy = 40, r = 22;
  ctx.clearRect(0, 0, 80, 80);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 80, 80);

  if (_loadPhase === "forming") {
    const p = Math.min(_loadT / 1.1, 1), e = 1 - Math.pow(1 - p, 3);
    for (let i = 0; i < PC; i++) {
      const a = (i / PC) * Math.PI * 2;
      const d = r * 3 + (r - r * 3) * e;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.8 * e + 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${e * 0.85})`; ctx.fill();
    }
    if (_loadT >= 1.1) { _loadPhase = "hold"; _loadT = 0; }

  } else if (_loadPhase === "hold") {
    for (let i = 0; i < PC; i++) {
      const a = (i / PC) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
    }
    if (_loadT >= 0.4) { _loadPhase = _assetsReady ? "final" : "break"; _loadT = 0; }

  } else if (_loadPhase === "break") {
    const p = Math.min(_loadT / 0.7, 1), e = p * p;
    for (let i = 0; i < PC; i++) {
      const a = (i / PC) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (r + e * r * 4), cy + Math.sin(a) * (r + e * r * 4), 2.1 * (1 - e * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - e)})`; ctx.fill();
    }
    if (_loadT >= 0.7) { _loadPhase = _assetsReady ? "final" : "forming"; _loadT = 0; }

  } else if (_loadPhase === "final") {
    const fp = Math.min(_loadT / 1.1, 1), fe = 1 - Math.pow(1 - fp, 3);
    if (fp < 1) {
      for (let i = 0; i < PC; i++) {
        const a = (i / PC) * Math.PI * 2;
        const d = r * 2.5 + (r - r * 2.5) * fe;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${fe * 0.85})`; ctx.fill();
      }
    } else {
      const et = _loadT - 1.1, ep = Math.min(et / 0.5, 1), eased = ep * ep;
      const bigR = r * (1 + eased * 30);
      ctx.beginPath(); ctx.arc(cx, cy, bigR, 0, Math.PI * 2);
      ctx.fillStyle = "#000"; ctx.fill();
      for (let i = 0; i < PC; i++) {
        const a = (i / PC) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.85 - eased * 1.2)})`; ctx.fill();
      }
      if (et >= 0.8) {
        transitionToAlive();
        return;
      }
    }
  }

  _loadT += 0.016;
  requestAnimationFrame(drawLoading);
}

function transitionToAlive() {
  const ls = document.getElementById("loading-screen");
  if (!ls) return;
  gsap.to(ls, {
    opacity: 0, duration: 0.7, ease: "power2.in",
    onComplete: () => {
      ls.style.display = "none";
      beginAlive();
    },
  });
}

// ─── ALIVE: Normal website reading experience ────────────────────────────────
const LIFE_MESSAGES = [
  ["you are here.", 180],
  ["still reading.", 170],
  ["time passes.", 160],
  ["this is real.", 175],
  ["you will reach the end.", 230],
];
let lifeMsgIndex = 0;
let lifeMsgTimer: ReturnType<typeof setInterval> | null = null;
let _destructionFired = false;

function beginAlive() {
  state.phase = "alive";
  state.scrollLocked = false;

  // Enable scroll
  const sl = document.getElementById("scroll-layer");
  if (sl) sl.classList.add("active");

  // Spawn ambient background 3D object (very dark, subtle)
  spawnAmbientObject();

  // Initial island message
  setTimeout(() => {
    showIsland("observing.", 160);
    setTimeout(hideIsland, 2200);
  }, 1200);

  // Periodic life messages as user reads
  lifeMsgTimer = setInterval(() => {
    if (state.phase !== "alive") { clearInterval(lifeMsgTimer!); return; }
    const [msg, w] = LIFE_MESSAGES[lifeMsgIndex % LIFE_MESSAGES.length] as [string, number];
    showIsland(msg, w);
    setTimeout(hideIsland, 2200);
    lifeMsgIndex++;
  }, 11000);
}

function spawnAmbientObject() {
  // Galaxy particle system — the universe before entropy
  galaxy = createGalaxy();
  scene.add(galaxy.points);
  scene.add(galaxy.starCore);
  scene.add(galaxy.coreLight);

  // Fade in gracefully
  const gMat = galaxy.points.material as THREE.PointsMaterial;
  const cMat = galaxy.starCore.material as THREE.MeshPhysicalMaterial;
  gMat.opacity = 0;
  cMat.opacity = 0;
  gsap.to(gMat, { opacity: 0.62, duration: 3, ease: "power2.out" });
  gsap.to(cMat, { opacity: 0.75, duration: 3, delay: 0.5, ease: "power2.out" });
  gsap.to(galaxy.coreLight, { intensity: 0.45, duration: 3, ease: "power2.out" });

  // ── Solar system around the galaxy core ──────────────────────────────────
  const planetDefs = [
    { r: 1.1, speed: 0.009,  size: 0.052, tilt: 0.25,  color: 0x7799cc, ringOpacity: 0.07 },
    { r: 1.9, speed: 0.0055, size: 0.068, tilt: 0.42,  color: 0xbb9966, ringOpacity: 0.05 },
    { r: 2.7, speed: 0.0032, size: 0.038, tilt: 0.12,  color: 0x4466aa, ringOpacity: 0.04 },
    { r: 3.5, speed: 0.0018, size: 0.085, tilt: 0.62,  color: 0x997755, ringOpacity: 0.035 },
  ];

  for (const pd of planetDefs) {
    const geo = new THREE.SphereGeometry(pd.size, 12, 12);
    const mat = new THREE.MeshPhysicalMaterial({
      color: pd.color, roughness: 0.55, metalness: 0.25,
      transparent: true, opacity: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // Orbital ring (thin torus, tilted)
    const ringGeo = new THREE.TorusGeometry(pd.r, 0.0035, 6, 90);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = pd.tilt + Math.PI / 2;
    ring.rotation.y = rng() * 0.5;
    scene.add(ring);

    gsap.to(mat, { opacity: 0.5, duration: 4, delay: 1.5 + rng() * 1, ease: "power2.out" });
    gsap.to(ringMat, { opacity: pd.ringOpacity, duration: 4, delay: 2, ease: "power2.out" });

    planets.push({
      mesh, ring,
      radius: pd.r, speed: pd.speed,
      angle: rng() * Math.PI * 2, tilt: pd.tilt,
    });
  }
}

// ─── Scroll Handler ──────────────────────────────────────────────────────────
export function handleScroll(scrollTop: number, maxScroll: number) {
  state.scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0;

  // Update scroll-progress bar
  const bar = document.getElementById("scroll-progress");
  if (bar) bar.style.width = `${state.scrollProgress * 100}%`;

  if (state.phase === "alive") {
    // Camera drift based on scroll
    camera.position.y = 1.2 - state.scrollProgress * 0.4;

    // Galaxy tilts slightly as user scrolls
    if (galaxy) {
      galaxy.points.rotation.z = state.scrollProgress * 0.08;
      // Planets orbit speed affected by scroll depth
      planets.forEach((p) => {
        p.mesh.scale.setScalar(1 + state.scrollProgress * 0.15);
      });
    }

    if (state.scrollProgress > 0.75 && lifeMsgIndex === LIFE_MESSAGES.length) {
      state.phase = "warning";
      clearInterval(lifeMsgTimer!);
      startWarning();
    } else if (state.scrollProgress > 0.80) {
      state.phase = "warning";
      clearInterval(lifeMsgTimer!);
      startWarning();
    }
  }

  // Minimum 2.5s of warning before triggering auto-scroll to top
  if (state.phase === "warning" && state.scrollProgress >= 0.97 && !_destructionFired) {
    const elapsed = (Date.now() - _warningStartTime) / 1000;
    if (elapsed >= 2.5) {
      _destructionFired = true;
      triggerMemoryReplay();
    }
  }
}

// ─── WARNING ─────────────────────────────────────────────────────────────────
function startWarning() {
  if (_warningStartTime > 0) return; // prevent double-fire
  _warningStartTime = Date.now();
  state.cursorTremor = true;

  // Red vignette on body + center pill warning pulse
  document.body.classList.add("phase-warning-active");
  const centerPill = document.getElementById("nav-center-pill");
  if (centerPill) centerPill.classList.add("warning-pulse");

  // Island sequence: anomaly → memory corrupt → system failure
  showIsland("anomaly detected.", 225);
  setTimeout(() => {
    hideIsland();
    setTimeout(() => {
      showIsland("memory corrupt.", 215);
      bus.emit(Events.ISLAND_BORDER, "rgba(139,0,0,0.8)");
      setTimeout(() => {
        hideIsland();
        setTimeout(() => {
          showIsland("system failure.", 205);
          setTimeout(hideIsland, 2600);
        }, 1400);
      }, 3000);
    }, 3000);
  }, 2800);

  // Scroll-progress bar turns red
  const bar = document.getElementById("scroll-progress");
  if (bar) bar.style.background = "rgba(139,0,0,0.5)";

  // Galaxy distorts / reddens as anomaly builds — planets wobble
  if (galaxy) {
    gsap.to(galaxy.coreLight, { intensity: 1.8, duration: 2.5, ease: "power1.out" });
    gsap.to(galaxy.starCore.material as THREE.MeshPhysicalMaterial, {
      emissiveIntensity: 3.5, duration: 2, ease: "power1.out",
    });
    const gMat = galaxy.points.material as THREE.PointsMaterial;
    gsap.to(gMat, { opacity: 0.95, duration: 2, ease: "power1.out" });
  }
  // Planets get erratic scale during warning
  planets.forEach((p, i) => {
    gsap.to(p.mesh.scale, { x: 1.4, y: 1.4, z: 1.4, duration: 1.8, delay: i * 0.3, yoyo: true, repeat: 2 });
  });
}

// ─── MEMORY REPLAY ───────────────────────────────────────────────────────────
function triggerMemoryReplay() {
  state.phase = "replay";
  state.scrollLocked = true;
  state.cursorTremor = false;

  // Remove warning visuals
  document.body.classList.remove("phase-warning-active");
  const centerPill = document.getElementById("nav-center-pill");
  if (centerPill) centerPill.classList.remove("warning-pulse");

  const sl = document.getElementById("scroll-layer");
  if (sl) sl.classList.remove("active");

  bus.emit(Events.ISLAND_BORDER, "#1a1a1a");
  showIsland("returning to origin.", 245);

  // Camera shakes once
  const ox = camera.position.x;
  gsap.to(camera.position, { x: ox + 0.15, duration: 0.05, yoyo: true, repeat: 5,
    onComplete: () => { camera.position.x = ox; } });

  // Scroll back to top fast
  if (sl) {
    gsap.to(sl, {
      scrollTop: 0,
      duration: 2.2,
      ease: "power2.inOut",
      onComplete: () => {
        setTimeout(beginDestruction, 800);
      },
    });
  } else {
    setTimeout(beginDestruction, 3000);
  }
}

// ─── DESTRUCTION ─────────────────────────────────────────────────────────────
function beginDestruction() {
  state.phase = "dying";
  hideIsland();
  setTimeout(() => {
    showIsland("it begins.", 165);
    bus.emit(Events.ISLAND_BORDER, "rgba(139,0,0,0.4)");
    setTimeout(hideIsland, 2000);
  }, 600);

  // Fabric becomes more visible as website dies
  setSpacetimeOpacity(0.4);

  // Galaxy starts collapsing as the entity dies
  if (galaxy) {
    const gMat = galaxy.points.material as THREE.PointsMaterial;
    gsap.to(gMat, { size: 0.012, duration: 6, ease: "power1.in" });
    gsap.to(galaxy.points.rotation, { y: galaxy.points.rotation.y + Math.PI * 0.5, duration: 8, ease: "none" });
  }

  // (legacy ambientObj compat - now null)
  if (ambientObj) {
    gsap.to((ambientObj.material as THREE.MeshPhysicalMaterial), {
      wireframe: true, opacity: 0.4, duration: 1, ease: "power1.out",
    });
  }

  // Run HTML destruction sequence
  runDestructionSequence((sectionName) => {
    // 3D dot burst for this section
    spawnSectionDots(sectionName);

    // Island narrates each death
    const msgs: Record<string, string> = {
      nav: "identity gone.",
      hero: "memory corrupted.",
      observable: "universe, forgotten.",
      time: "time, released.",
      quote: "words, silenced.",
      entropy: "the process, ended.",
      pattern: "pattern, dissolved.",
      footer: "the last breath.",
    };
    const msg = msgs[sectionName];
    if (msg) {
      showIsland(msg, msg.length * 9 + 30);
      setTimeout(hideIsland, 1200);
    }
  }).then(() => {
    // All HTML dead — transition to substrate
    afterDestruction();
  });
}

// ─── Per-section 3D dot burst ────────────────────────────────────────────────
const SECTION_POS: Record<string, [number, number, number]> = {
  nav:         [0,     2.4,  0.8],
  hero:        [-1.2,  1.3,  0.2],
  observable:  [2.0,   0.5,  0],
  time:        [-1.8, -0.3,  0],
  quote:       [0.3,  -0.7,  0],
  entropy:     [1.8,  -1.1,  0],
  pattern:     [-1.2, -1.7,  0],
  footer:      [0,    -2.4,  0],
};

function spawnSectionDots(sectionName: string) {
  const pos = SECTION_POS[sectionName];
  if (!pos) return;

  const count = 55;
  const buf = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    buf[i * 3]     = pos[0] + (rng() - 0.5) * 0.5;
    buf[i * 3 + 1] = pos[1] + (rng() - 0.5) * 0.5;
    buf[i * 3 + 2] = pos[2] + (rng() - 0.5) * 0.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(buf, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.042, transparent: true, opacity: 0.75, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  // Shimmer for 0.4s then blast outward smoothly
  setTimeout(() => {
    animateParticlesExplode(pts, 1.4, () => scene.remove(pts));
  }, 400);
}

function afterDestruction() {
  state.phase = "substrate";

  // Dissolve planets outward before galaxy goes
  planets.forEach((p, i) => {
    gsap.to(p.mesh.material as THREE.MeshPhysicalMaterial, { opacity: 0, duration: 1.2, delay: i * 0.18, ease: "power2.in",
      onComplete: () => { scene.remove(p.mesh); if (p.ring) scene.remove(p.ring); }
    });
    if (p.ring) {
      gsap.to(p.ring.material as THREE.MeshBasicMaterial, { opacity: 0, duration: 1.0, delay: i * 0.18 });
    }
  });
  planets.length = 0;

  // Dissolve galaxy into particles
  if (galaxy) {
    const gMat = galaxy.points.material as THREE.PointsMaterial;
    const cMat = galaxy.starCore.material as THREE.MeshPhysicalMaterial;
    gsap.to(gMat, { opacity: 0, duration: 1.5, ease: "power2.in", onComplete: () => {
      if (galaxy) { scene.remove(galaxy.points); scene.remove(galaxy.starCore); scene.remove(galaxy.coreLight); galaxy = null; }
    }});
    gsap.to(cMat, { opacity: 0, emissiveIntensity: 0, duration: 1, ease: "power2.in" });
    gsap.to(galaxy.coreLight, { intensity: 0, duration: 1, ease: "power2.in" });
  }

  // Fabric lights up — this is the substrate
  setSpacetimeOpacity(0.85);
  gsap.to(lights.ambient, { intensity: 0.12, duration: 2 });
  gsap.to(lights.fill, { intensity: 0.2, duration: 2 });
  gsap.to(camera.position, { y: 1.2, z: 9, duration: 2, ease: "power2.out" });

  // Island: silence, then origin
  setTimeout(() => {
    showIsland("nothing.", 145);
    bus.emit(Events.ISLAND_BORDER, "#0d0d0d");
    setTimeout(() => {
      hideIsland();
      setTimeout(beginRevival, 2200);
    }, 2400);
  }, 1500);
}

// ─── REVIVAL ─────────────────────────────────────────────────────────────────
function beginRevival() {
  state.phase = "revival";
  state.cursorGravity = true;
  state.gravityTarget = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  showIsland("formation.", 165);
  setTimeout(hideIsland, 2000);

  // First dot appears at center
  const firstDotGeo = new THREE.SphereGeometry(0.06, 10, 10);
  const firstDotMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0,
  });
  mainDotMesh = new THREE.Mesh(firstDotGeo, firstDotMat);
  mainDotMesh.position.set(0, 0, 0);
  scene.add(mainDotMesh);
  gsap.to(firstDotMat, { opacity: 1, duration: 0.5 });
  gsap.to(mainDotMesh.scale, {
    x: 1.3, y: 1.3, z: 1.3,
    duration: 1, yoyo: true, repeat: -1, ease: "sine.inOut",
  });

  // Setup main dot
  const md: Dot = {
    mesh: mainDotMesh, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    isMain: true, resistant: false, absorbed: false, dead: false,
    size: 0.07, id: dotIdCounter++,
  };
  dots.push(md);
  mainDot = md;

  gravitySources.push({ x: 0, y: 0, z: 0, strength: 1.5 });
  mainObjGravityIdx = gravitySources.length - 1;

  // Spawn satellite dots progressively
  let count = 0, interval = 1000;
  const spawnMore = () => {
    if (count >= 28 || state.phase !== "revival") return;
    spawnRevivalDot();
    count++;
    if (count >= 6) revivalActive = true;
    interval = Math.max(380, interval - 40);
    setTimeout(spawnMore, interval + rng() * 150);
  };
  setTimeout(spawnMore, 1400);

  runRevivalLoop();
}

function spawnRevivalDot() {
  // Spawn on a sphere surface for genuine 3D distribution
  const theta = rng() * Math.PI * 2;
  const phi = Math.acos(2 * rng() - 1);
  const radius = 0.7 + rng() * 1.8;
  const x = Math.cos(theta) * Math.sin(phi) * radius;
  const y = Math.sin(theta) * Math.sin(phi) * radius;
  const z = Math.cos(phi) * radius;
  const size = 0.03 + rng() * 0.04;
  const br = 0.7 + rng() * 0.3;
  const resistant = rng() < 0.22;
  const geo = new THREE.SphereGeometry(size, 7, 7);
  const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(br, br, br), roughness: 0.35, metalness: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  dots.push({ mesh, x, y, z, vx: 0, vy: 0, vz: 0, isMain: false, resistant, absorbed: false, dead: false, size, id: dotIdCounter++ });
}

function runRevivalLoop() {
  revivalRaf = requestAnimationFrame(runRevivalLoop);
  if (!revivalActive || !mainDot) return;
  const md = mainDot;

  // 3D distance helper
  const dist3 = (a: Dot, b: Dot) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2) || 0.001;

  // Find nearest target in 3D
  let nearest: Dot | null = null, nearestDist = Infinity;
  dots.forEach((d) => {
    if (d.isMain || d.absorbed || d.dead) return;
    const dist = dist3(md, d);
    if (d.resistant && dist < 2) {
      const ax = (d.x - md.x) / dist;
      const ay = (d.y - md.y) / dist;
      const az = (d.z - md.z) / dist;
      d.vx += ax * 0.014; d.vy += ay * 0.014; d.vz += az * 0.014;
    }
    if (dist < nearestDist) { nearestDist = dist; nearest = d; }
  });

  if (nearest) {
    const nd = nearest as Dot;
    const dist = dist3(md, nd);
    const dx = (nd.x - md.x) / dist;
    const dy = (nd.y - md.y) / dist;
    const dz = (nd.z - md.z) / dist;
    // Curved path (slight tangential swirl)
    md.vx += dx * 0.01 + (-dy * 0.003);
    md.vy += dy * 0.01 + (dz * 0.003);
    md.vz += dz * 0.01 + (dx * 0.003);
  }

  md.vx *= 0.89; md.vy *= 0.89; md.vz *= 0.89;
  md.x += md.vx; md.y += md.vy; md.z += md.vz;
  md.mesh.position.set(md.x, md.y, md.z);

  if (mainObjGravityIdx >= 0) {
    gravitySources[mainObjGravityIdx].x = md.x;
    gravitySources[mainObjGravityIdx].z = md.z;
  }
  state.gravityTarget = { x: window.innerWidth / 2 + md.x * 90, y: window.innerHeight / 2 - md.y * 90 };

  // Move satellite dots
  dots.forEach((d) => {
    if (d.isMain || d.absorbed || d.dead) return;
    d.vx *= 0.91; d.vy *= 0.91; d.vz *= 0.91;
    d.x += d.vx; d.y += d.vy; d.z += d.vz;
    d.mesh.position.set(d.x, d.y, d.z);

    // Resistant escape
    if (d.resistant && Math.sqrt(d.x**2 + d.y**2 + d.z**2) > 3.2) {
      d.dead = true;
      const mat = d.mesh.material as THREE.MeshPhysicalMaterial;
      mat.transparent = true;
      gsap.to(mat, { opacity: 0, duration: 0.8, onComplete: () => { scene.remove(d.mesh); } });
      ripple(new THREE.Vector3(d.x, d.y, d.z));
      return;
    }

    const dist = dist3(md, d);
    if (dist < md.size + d.size + 0.04) absorbDot(d);
  });
}

function absorbDot(d: Dot) {
  if (!mainDot) return;
  d.absorbed = true;
  absorptionCount++;

  flashLine(new THREE.Vector3(mainDot.x, mainDot.y, mainDot.z), new THREE.Vector3(d.x, d.y, d.z));
  scene.remove(d.mesh);

  mainDot.size += 0.006;
  const ns = mainDot.size / 0.07;
  gsap.to(mainDot.mesh.scale, { x: ns, y: ns, z: ns, duration: 0.2 });

  growRevivalGeom(d.x, d.y, d.z);

  if (absorptionCount === 10) {
    showIsland("it learns.", 145);
    setTimeout(hideIsland, 1800);
  }
  if (absorptionCount >= 22 && state.phase === "revival") {
    state.phase = "transitioning" as any;
    cancelAnimationFrame(revivalRaf);
    state.cursorGravity = false;
    setTimeout(beginConflict, 2000);
  }
}

function growRevivalGeom(x: number, y: number, z: number) {
  // Add vertex with noise in all 3 axes — ensures truly 3D convex hull
  const vx = x + (rng() - 0.5) * 0.35;
  const vy = y + (rng() - 0.5) * 0.35;
  const vz = z + (rng() - 0.5) * 0.6;
  geomVerts.push(new THREE.Vector3(vx, vy, vz));
  if (mainObjMesh) scene.remove(mainObjMesh);
  if (geomVerts.length < 5) return;

  try {
    const convexGeo = new ConvexGeometry(geomVerts);
    mainObjMesh = new THREE.Mesh(convexGeo, new THREE.MeshPhysicalMaterial({
      color: 0xe0e0e0,
      roughness: 0.28,
      metalness: 0.78,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2,
      wireframe: absorptionCount % 5 !== 0,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x060614),
      emissiveIntensity: 0.2,
    }));
    scene.add(mainObjMesh);
  } catch (_) {
    // Fallback: not enough non-coplanar points yet, skip this frame
  }
}

// ─── CONFLICT ────────────────────────────────────────────────────────────────
function beginConflict() {
  state.phase = "conflict";
  showIsland("resistance.", 170);
  bus.emit(Events.ISLAND_BORDER, "rgba(139,0,0,0.7)");
  bus.emit(Events.CURSOR_RED);
  setTimeout(() => {
    hideIsland();
    bus.emit(Events.ISLAND_BORDER, "#1a1a1a");
    bus.emit(Events.CURSOR_RESTORE);
  }, 2400);

  // Show phase overlay
  showPhaseOverlay("02 / conflict", "not everything wants you to exist.\nsome things resist.\nsome things attack.");

  const total = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < total; i++) {
    setTimeout(() => {
      const e = createEnemy(i);
      scene.add(e.mesh);
      enemies.push(e);
      // 45% become hostile after 1.8s
      setTimeout(() => {
        if (rng() < 0.45) {
          e.isEnemy = true;
          const mat = e.mesh.material as THREE.MeshPhysicalMaterial;
          gsap.to(mat.color, { r: 0.55, g: 0, b: 0, duration: 0.7 });
          e.vx *= 2.5; e.vy *= 2.5;
        }
      }, 1800 + rng() * 800);
    }, i * 420);
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
      e.vx += (dx / d) * 0.0035; e.vy += (dy / d) * 0.0035;
    }
    e.vx *= 0.96; e.vy *= 0.96;
    e.mesh.position.x += e.vx;
    e.mesh.position.y += e.vy;
    e.mesh.rotation.x += 0.014;
    e.mesh.rotation.y += 0.018;

    if (e.isEnemy && mainObjMesh) {
      const dist = e.mesh.position.distanceTo(mp);
      if (dist < 0.9) {
        // Distort main obj
        const pa = mainObjMesh.geometry.attributes.position as THREE.BufferAttribute;
        const idx = Math.floor(rng() * pa.count) * 3;
        (pa.array as Float32Array)[idx]     += (rng() - 0.5) * 0.1;
        (pa.array as Float32Array)[idx + 1] += (rng() - 0.5) * 0.1;
        pa.needsUpdate = true;
        mainObjMesh.geometry.computeVertexNormals();

        const mat = mainObjMesh.material as THREE.MeshPhysicalMaterial;
        mat.emissiveIntensity = 0.6;
        setTimeout(() => { if (mainObjMesh) (mainObjMesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.2; }, 160);

        // Shatter enemy
        fragmentEnemy(e);
      }
    }
  });

  const hostile = enemies.filter((e) => e.alive && e.isEnemy);
  const hadHostile = enemies.some((e) => e.isEnemy);
  if (conflictActive && hadHostile && hostile.length === 0) {
    conflictActive = false;
    cancelAnimationFrame(conflictRaf);
    // Only transition to dominant from conflict phase — not from dominant waves
    if (state.phase === "conflict") {
      setTimeout(beginDominant, 1500);
    }
  }
}

function fragmentEnemy(e: EnemyObject) {
  e.alive = false;
  const pts = sampleMeshToPoints(e.mesh, 55, 0xffffff);
  pts.position.copy(e.mesh.position);
  scene.add(pts);
  scene.remove(e.mesh);
  animateParticlesExplode(pts, 0.7, () => scene.remove(pts));

  const msg = ["it fell.", "another one.", "still standing.", "unstoppable."][Math.floor(rng() * 4)];
  showIsland(msg, msg.length * 10 + 30);
  setTimeout(hideIsland, 1400);
}

// ─── DOMINANT ────────────────────────────────────────────────────────────────
function beginDominant() {
  state.phase = "dominant";
  hidePhaseOverlay();

  // Island
  showIsland("dominant.", 160);
  bus.emit(Events.ISLAND_BORDER, "#1a1a1a");
  setTimeout(hideIsland, 2500);

  showPhaseOverlay("03 / order", "to live you must fight.\nthe pattern that survives\nrules what remains.");

  // Remove revival dots and main dot
  dots.forEach((d) => { if (!d.dead && !d.absorbed) scene.remove(d.mesh); });
  if (mainDotMesh) scene.remove(mainDotMesh);
  if (mainObjMesh) scene.remove(mainObjMesh);

  // Build the TorusKnot — the endless knot, symbol of power and unity
  const knot = new THREE.TorusKnotGeometry(0.9, 0.3, 180, 20, 3, 5);
  const knotMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8d8d8,
    roughness: 0.12,
    metalness: 0.92,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    reflectivity: 0.9,
    emissive: new THREE.Color(0x0a0a18),
    emissiveIntensity: 0.25,
  });
  torusKnot = new THREE.Mesh(knot, knotMat);
  torusKnot.position.set(0, 0, 0);
  torusKnot.scale.set(0.001, 0.001, 0.001);
  scene.add(torusKnot);

  // Scale up dramatically
  gsap.to(torusKnot.scale, {
    x: 1, y: 1, z: 1,
    duration: 1.8,
    ease: "expo.out",
  });

  // Add a point light pulsing from center
  const knotLight = new THREE.PointLight(0xffffff, 0, 6);
  scene.add(knotLight);
  gsap.to(knotLight, { intensity: 2.5, duration: 1.8, yoyo: true, repeat: -1, ease: "sine.inOut" });
  gravitySources.push({ x: 0, y: 0, z: 0, strength: 2.0 });

  // Spawn neutral orbiters
  const n = 6 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const orb = createOrbiter(i, n);
    scene.add(orb.mesh);
    orbiters.push(orb);
  }

  // Conflict continues — more waves
  let waveCount = 0;
  const moreWaves = () => {
    if (state.phase !== "dominant" || waveCount >= 2) {
      // Move to end after last wave
      setTimeout(triggerEnd, 5000);
      return;
    }
    waveCount++;
    showIsland(`wave ${waveCount + 1}.`, 130);
    setTimeout(hideIsland, 1500);

    const waveSize = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < waveSize; i++) {
      setTimeout(() => {
        const e = createEnemy(i);
        e.isEnemy = true;
        const mat = e.mesh.material as THREE.MeshPhysicalMaterial;
        mat.color.setRGB(0.55, 0, 0);
        scene.add(e.mesh);
        enemies.push(e);
      }, i * 350);
    }

    conflictActive = true;
    runConflictLoop();

    // Check wave done
    const checkWave = setInterval(() => {
      const still = enemies.filter((e) => e.alive && e.isEnemy);
      if (still.length === 0 && enemies.some((e) => e.isEnemy)) {
        clearInterval(checkWave);
        conflictActive = false;
        cancelAnimationFrame(conflictRaf);

        if (torusKnot) {
          gsap.to(torusKnot.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 0.5, yoyo: true, repeat: 1 });
        }
        setTimeout(moreWaves, 3500);
      }
    }, 400);
  };

  setTimeout(moreWaves, 4500);
}

// ─── END ──────────────────────────────────────────────────────────────────────
function triggerEnd() {
  if (state.endTriggered) return;
  state.endTriggered = true;
  state.phase = "end";

  hidePhaseOverlay();
  showIsland("·", 60);
  setTimeout(() => {
    gsap.to(document.getElementById("island")!, {
      width: "8px", height: "8px", duration: 0.4, ease: "power2.in",
    });
    gsap.to(document.getElementById("island")!, { opacity: 0, delay: 0.5, duration: 0.25 });
  }, 2000);

  // A traveling dot from edge to center
  const startPositions: [number, number, number][] = [[0, 4, 0],[0,-4,0],[-6,0,0],[6,0,0]];
  const sp = startPositions[Math.floor(rng() * 4)];
  const travelGeo = new THREE.SphereGeometry(0.05, 12, 12);
  const travelMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.9 });
  const travelDot = new THREE.Mesh(travelGeo, travelMat);
  travelDot.position.set(...sp);
  scene.add(travelDot);

  const travelLight = new THREE.PointLight(0xffffff, 0.8, 5);
  scene.add(travelLight);

  // Knot shrinks and waits
  if (torusKnot) {
    gsap.to(torusKnot.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 2, ease: "power2.out" });
  }

  gsap.to(travelDot.position, {
    x: 0, y: 0, z: 0,
    duration: 3.5,
    ease: "power1.inOut",
    onUpdate: () => { travelLight.position.copy(travelDot.position); },
    onComplete: () => {
      scene.remove(travelLight);
      // "end" text appears
      const endText = buildTextEnd();
      endText.scale.set(0.001, 0.001, 0.001);
      scene.add(endText);
      gsap.to(endText.scale, { x: 1, y: 1, z: 1, duration: 1.2, ease: "expo.out" });
      scene.remove(travelDot);

      // White sphere expands
      setTimeout(() => {
        doWhiteFill();
      }, 3000);
    },
  });
}

function doWhiteFill() {
  const sphereGeo = new THREE.SphereGeometry(0.1, 20, 20);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.set(0, 0, 0);
  scene.add(sphere);

  let endFired = false;
  const start = Date.now();
  function tick() {
    const el = (Date.now() - start) / 1000;
    const sc = 1 + el * el * 14;
    sphere.scale.set(sc, sc, sc);
    const r = sc * 0.1;
    if (!endFired && r > 8) {
      endFired = true;
      bus.emit(Events.END_WHITE);
    }
    if (el < 3.5) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── Per-frame update ────────────────────────────────────────────────────────
export function updateNarrative(time: number, _delta: number) {
  // Galaxy slow rotation + star core pulse
  if (galaxy) {
    galaxy.points.rotation.y += 0.00028;
    const corePulse = 1 + Math.sin(time * 1.1) * 0.18;
    galaxy.starCore.scale.set(corePulse, corePulse, corePulse);
    // Corelight managed only in starWarning, not overwritten during alive
    if (state.phase === "alive") {
      galaxy.coreLight.intensity = 0.35 + Math.sin(time * 1.1) * 0.12;
    }

    // ── Solar planets orbit around the core ────────────────────────────────
    planets.forEach((p) => {
      p.angle += p.speed * (state.phase === "warning" ? 2.5 : 1);
      const x = Math.cos(p.angle) * p.radius;
      const y = Math.sin(p.angle) * Math.sin(p.tilt) * p.radius * 0.35;
      const z = Math.sin(p.angle) * Math.cos(p.tilt) * p.radius * 0.18;
      p.mesh.position.set(x, y, z);
      p.mesh.rotation.y += 0.008;
    });
  }

  // Torus knot rotation during dominant/end
  if (torusKnot) {
    torusKnot.rotation.x += 0.005;
    torusKnot.rotation.y += 0.008;
    torusKnot.rotation.z += 0.003;
  }

  // Orbiters
  orbiters.forEach((o) => {
    o.angle += o.speed;
    o.mesh.position.x = Math.cos(o.angle + o.tiltZ) * o.radius;
    o.mesh.position.y = Math.sin(o.angle) * o.radius * Math.cos(o.tiltX);
    o.mesh.position.z = Math.sin(o.angle + o.tiltZ) * o.radius * 0.3;
    o.mesh.rotation.x += 0.01;
    o.mesh.rotation.y += 0.014;
  });

  // Gentle camera arc — pauses for 2s after any touch input
  if (["substrate", "revival", "dominant", "end"].includes(state.phase)) {
    if (Date.now() - _lastTouchMs > 2000) {
      camera.position.x += (Math.sin(time * 0.025) * 0.4 - camera.position.x) * 0.005;
      camera.position.y += (1.2 + Math.cos(time * 0.018) * 0.2 - camera.position.y) * 0.005;
    }
    // Always re-orient toward origin — prevents scene from going off-center after touch
    camera.lookAt(0, 0, 0);
  }

  // Dynamic lighting
  if (state.phase === "conflict" || state.phase === "dominant") {
    lights.fill.color.setHex(0x1a0000);
    lights.fill.intensity = 1.5 + Math.sin(time * 2.5) * 0.5;
    if (state.phase === "dominant") lights.sun.intensity = 1.5;
  } else if (state.phase === "revival") {
    lights.fill.intensity = 0.8 + Math.sin(time * 1.6) * 0.3;
  }
}

// ─── INIT ────────────────────────────────────────────────────────────────────
export async function initNarrative() {
  const loadCanvas = document.getElementById("loading-canvas") as HTMLCanvasElement | null;
  if (loadCanvas) {
    _loadCtx = loadCanvas.getContext("2d");
    loadCanvas.width = 80;
    loadCanvas.height = 80;
  }

  // Font loads in background
  try { await loadFont(); } catch (_) {}
  _assetsReady = true;
}

export function startLoadingAnimation() {
  requestAnimationFrame(drawLoading);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const _navPhases: Phase[] = ["alive", "warning", "replay", "dying"];

function showIsland(msg: string, widthPx?: number) {
  if ((_navPhases as string[]).includes(state.phase)) {
    bus.emit(Events.NAV_MSG_SHOW, msg);
  } else {
    bus.emit(Events.ISLAND_SHOW, msg, widthPx);
  }
}
function hideIsland() {
  if ((_navPhases as string[]).includes(state.phase)) {
    bus.emit(Events.NAV_MSG_HIDE);
  } else {
    bus.emit(Events.ISLAND_HIDE);
  }
}

function showPhaseOverlay(tag: string, text: string) {
  bus.emit(Events.PHASE_OVERLAY, tag, text, true);
}
function hidePhaseOverlay() {
  bus.emit(Events.PHASE_OVERLAY, "", "", false);
}
