import * as THREE from "three";
import gsap from "gsap";
import { scene, camera, lights } from "./scene";
import { gravitySources, setSpacetimeOpacity } from "./spacetime";
import { createEnemy, EnemyObject, createOrbiter, Orbiter, deepMaterial, metalMaterial } from "./objects";
import { loadFont, buildTextEnd } from "./text3d";
import { sampleMeshToPoints, animateParticlesExplode, flashLine, ripple } from "./particles";
import { runDestructionSequence } from "./destroy";
import { state, bus, Events } from "../store/state";

// ─── Seeded random ──────────────────────────────────────────────────────────
function rng() { return Math.random(); }

// ─── Global scene objects ────────────────────────────────────────────────────
let ambientObj: THREE.Mesh | null = null;        // background ambient shape
let mainDotMesh: THREE.Mesh | null = null;       // revival main dot
let mainObjMesh: THREE.Mesh | null = null;       // built procedural object
let torusKnot: THREE.Mesh | null = null;         // dominant object
const enemies: EnemyObject[] = [];
const orbiters: Orbiter[] = [];
const geomVerts: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];

// Revival state
type Dot = {
  mesh: THREE.Mesh; x: number; y: number; vx: number; vy: number;
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
  // A large, very dark icosahedron in the background — barely visible, slowly breathing
  const geo = new THREE.IcosahedronGeometry(2.2, 2);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x050505,
    roughness: 0.95,
    metalness: 0.1,
    transparent: true,
    opacity: 0.7,
    wireframe: false,
  });
  ambientObj = new THREE.Mesh(geo, mat);
  ambientObj.position.set(1.5, 0, -5);
  ambientObj.rotation.set(0.3, 0.1, 0);
  scene.add(ambientObj);
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

    // Ambient object reacts to scroll
    if (ambientObj) {
      (ambientObj.material as THREE.MeshPhysicalMaterial).opacity =
        0.7 + state.scrollProgress * 0.25;
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

  if (state.phase === "warning" && state.scrollProgress >= 0.97 && !_destructionFired) {
    _destructionFired = true;
    triggerMemoryReplay();
  }
}

// ─── WARNING ─────────────────────────────────────────────────────────────────
function startWarning() {
  state.cursorTremor = true;

  // Island: anomaly detected
  showIsland("anomaly detected.", 225);
  setTimeout(() => {
    hideIsland();
    setTimeout(() => {
      showIsland("memory corrupt.", 215);
      bus.emit(Events.ISLAND_BORDER, "rgba(139,0,0,0.8)");
      setTimeout(hideIsland, 2800);
    }, 3000);
  }, 2800);

  // Scroll-progress bar turns red
  const bar = document.getElementById("scroll-progress");
  if (bar) bar.style.background = "rgba(139,0,0,0.5)";

  // Ambient object starts glitching
  if (ambientObj) {
    gsap.to((ambientObj.material as THREE.MeshPhysicalMaterial).color, {
      r: 0.1, g: 0, b: 0, duration: 2, ease: "power1.out",
    });
    gsap.to(ambientObj.rotation, { x: 1.2, y: 0.6, duration: 3, ease: "power1.inOut" });
  }
}

// ─── MEMORY REPLAY ───────────────────────────────────────────────────────────
function triggerMemoryReplay() {
  state.phase = "replay";
  state.scrollLocked = true;
  state.cursorTremor = false;

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

  // Background object starts breaking
  if (ambientObj) {
    gsap.to((ambientObj.material as THREE.MeshPhysicalMaterial), {
      wireframe: true, opacity: 0.4, duration: 1, ease: "power1.out",
    });
  }

  // Run HTML destruction sequence
  runDestructionSequence((sectionName) => {
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

function afterDestruction() {
  state.phase = "substrate";

  // Remove ambient object
  if (ambientObj) {
    const pts = sampleMeshToPoints(ambientObj, 120, 0x333333);
    scene.add(pts);
    scene.remove(ambientObj);
    animateParticlesExplode(pts, 1.2, () => scene.remove(pts));
    ambientObj = null;
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
    mesh: mainDotMesh, x: 0, y: 0, vx: 0, vy: 0,
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
  const angle = rng() * Math.PI * 2;
  const radius = 0.7 + rng() * 1.8;
  const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
  const size = 0.03 + rng() * 0.04;
  const br = 0.7 + rng() * 0.3;
  const resistant = rng() < 0.22;
  const geo = new THREE.SphereGeometry(size, 7, 7);
  const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(br, br, br), roughness: 0.35, metalness: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  dots.push({ mesh, x, y, vx: 0, vy: 0, isMain: false, resistant, absorbed: false, dead: false, size, id: dotIdCounter++ });
}

function runRevivalLoop() {
  revivalRaf = requestAnimationFrame(runRevivalLoop);
  if (!revivalActive || !mainDot) return;
  const md = mainDot;

  // Find nearest target
  let nearest: Dot | null = null, nearestDist = Infinity;
  dots.forEach((d) => {
    if (d.isMain || d.absorbed || d.dead) return;
    const dist = Math.hypot(md.x - d.x, md.y - d.y);
    if (d.resistant && dist < 2) {
      const ax = (d.x - md.x) / dist, ay = (d.y - md.y) / dist;
      d.vx += ax * 0.014; d.vy += ay * 0.014;
    }
    if (dist < nearestDist) { nearestDist = dist; nearest = d; }
  });

  if (nearest) {
    const nd = nearest as Dot;
    const dist = Math.hypot(md.x - nd.x, md.y - nd.y) || 0.001;
    const dx = (nd.x - md.x) / dist, dy = (nd.y - md.y) / dist;
    // Curved path
    md.vx += dx * 0.01 + (-dy * 0.004);
    md.vy += dy * 0.01 + (dx * 0.004);
  }

  md.vx *= 0.89; md.vy *= 0.89;
  md.x += md.vx; md.y += md.vy;
  md.mesh.position.set(md.x, md.y, 0);

  if (mainObjGravityIdx >= 0) {
    gravitySources[mainObjGravityIdx].x = md.x;
    gravitySources[mainObjGravityIdx].z = md.y;
  }
  state.gravityTarget = { x: window.innerWidth / 2 + md.x * 90, y: window.innerHeight / 2 - md.y * 90 };

  // Move satellite dots
  dots.forEach((d) => {
    if (d.isMain || d.absorbed || d.dead) return;
    d.vx *= 0.91; d.vy *= 0.91;
    d.x += d.vx; d.y += d.vy;
    d.mesh.position.set(d.x, d.y, 0);

    // Resistant escape
    if (d.resistant && Math.hypot(d.x, d.y) > 3.2) {
      d.dead = true;
      const mat = d.mesh.material as THREE.MeshPhysicalMaterial;
      mat.transparent = true;
      gsap.to(mat, { opacity: 0, duration: 0.8, onComplete: () => { scene.remove(d.mesh); } });
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
  absorptionCount++;

  flashLine(new THREE.Vector3(mainDot.x, mainDot.y, 0), new THREE.Vector3(d.x, d.y, 0));
  scene.remove(d.mesh);

  mainDot.size += 0.006;
  const ns = mainDot.size / 0.07;
  gsap.to(mainDot.mesh.scale, { x: ns, y: ns, z: ns, duration: 0.2 });

  growRevivalGeom(d.x, d.y);

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

function growRevivalGeom(x: number, y: number) {
  const vx = x + (rng() - 0.5) * 0.3, vy = y + (rng() - 0.5) * 0.3, vz = (rng() - 0.5) * 0.5;
  geomVerts.push(new THREE.Vector3(vx, vy, vz));
  if (mainObjMesh) scene.remove(mainObjMesh);
  if (geomVerts.length < 4) return;

  const positions: number[] = [];
  for (let i = 1; i < geomVerts.length - 1; i++) {
    const p0 = geomVerts[0], p1 = geomVerts[i], p2 = geomVerts[i + 1] ?? geomVerts[1];
    positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  mainObjMesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    color: 0xe0e0e0,
    roughness: 0.28,
    metalness: 0.78,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    wireframe: absorptionCount % 4 !== 0,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0x060614),
    emissiveIntensity: 0.2,
  }));
  mainObjMesh.castShadow = true;
  scene.add(mainObjMesh);
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
    setTimeout(beginDominant, 1500);
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
  const sphereGeo = new THREE.SphereGeometry(0.1, 24, 24);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.set(0, 0, 0);
  scene.add(sphere);

  const start = Date.now();
  function tick() {
    const el = (Date.now() - start) / 1000;
    const sc = 1 + el * el * 14;
    sphere.scale.set(sc, sc, sc);
    const r = sc * 0.1;
    if (r > 8) bus.emit(Events.END_WHITE);
    if (el < 3.5) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── Per-frame update ────────────────────────────────────────────────────────
export function updateNarrative(time: number, _delta: number) {
  // Ambient object slow rotation
  if (ambientObj) {
    ambientObj.rotation.y += 0.002;
    ambientObj.rotation.x += 0.0008;
    // Breathe
    const pulse = 1 + Math.sin(time * 0.4) * 0.02;
    ambientObj.scale.set(pulse, pulse, pulse);
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

  // Gentle camera arc during substrate/revival/dominant
  if (["substrate", "revival", "dominant", "end"].includes(state.phase)) {
    camera.position.x = Math.sin(time * 0.025) * 0.4;
    camera.position.y = 1.2 + Math.cos(time * 0.018) * 0.2;
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
function showIsland(msg: string, widthPx?: number) {
  bus.emit(Events.ISLAND_SHOW, msg, widthPx);
}
function hideIsland() {
  bus.emit(Events.ISLAND_HIDE);
}

function showPhaseOverlay(tag: string, text: string) {
  bus.emit(Events.PHASE_OVERLAY, tag, text, true);
}
function hidePhaseOverlay() {
  bus.emit(Events.PHASE_OVERLAY, "", "", false);
}
