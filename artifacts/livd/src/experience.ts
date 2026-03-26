declare const THREE: any;
declare const gsap: any;

// Seeded random number generator
function mulberry32(seed: number) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function initExperience() {
  const T = THREE;
  const seedRandom = mulberry32(Date.now());

  // ─── Load Three.js addons for r128 ────────────────────────────────────────
  let helvetiker: any = null;
  let TextGeometry: any = null;
  let FontLoader: any = null;

  // Load FontLoader and TextGeometry from jsDelivr (reliable CDN for r128 examples)
  try {
    await new Promise<void>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FontLoader.js";
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });

    await new Promise<void>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/geometries/TextGeometry.js";
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });

    FontLoader = (T as any).FontLoader;
    TextGeometry = (T as any).TextGeometry;
  } catch (e) {
    // Text will use fallback geometry
  }

  // Try loading helvetiker font
  const fontLoadPromise = new Promise<void>((resolve) => {
    if (!FontLoader) { resolve(); return; }
    try {
      const loader = new FontLoader();
      loader.load(
        "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_regular.typeface.json",
        (font: any) => { helvetiker = font; resolve(); },
        undefined,
        () => resolve()
      );
    } catch (e) { resolve(); }
    // Timeout fallback
    setTimeout(() => resolve(), 4000);
  });

  // ─── State ────────────────────────────────────────────────────────────────
  const state = {
    phase: "loading" as
      | "loading" | "hero" | "scroll" | "destruction"
      | "revival" | "conflict" | "rebuilding" | "survival" | "end",
    scrollLocked: true,
    scrollProgress: 0,
    mouseX: window.innerWidth / 2,
    mouseY: window.innerHeight / 2,
    cursorX: window.innerWidth / 2,
    cursorY: window.innerHeight / 2,
    isIdle: false,
    cursorPulsing: false,
    cursorTremor: false,
    cursorGravity: false,
    gravityTarget: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    hintVisible: false,
    sessionSeed: "",
    absorptionOrder: [] as number[],
    deadDotCount: 0,
    scrollAttempts: 0,
    lastScrollTime: 0,
    endTriggered: false,
  };

  // Generate session seed
  const t = Date.now().toString();
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 6; i++) {
    state.sessionSeed += chars[parseInt(t[i % t.length]) % chars.length];
  }

  // ─── DOM References ────────────────────────────────────────────────────────
  const loadingScreen = document.getElementById("loading-screen")!;
  const loadingCanvas = document.getElementById("loading-canvas") as HTMLCanvasElement;
  const mainCanvas = document.getElementById("main-canvas") as HTMLCanvasElement;
  const islandEl = document.getElementById("dynamic-island")!;
  const islandText = document.getElementById("island-text")!;
  const cursorDot = document.getElementById("cursor-dot")!;
  const hintBtn = document.getElementById("hint-btn")!;
  const hintPanel = document.getElementById("hint-panel")!;

  // ─── Scroll Container ──────────────────────────────────────────────────────
  const scrollContainer = document.createElement("div");
  scrollContainer.style.cssText = `position:fixed;inset:0;z-index:2;overflow-y:scroll;pointer-events:none;`;
  const scrollContent = document.createElement("div");
  scrollContent.style.height = "500vh";
  scrollContainer.appendChild(scrollContent);
  document.getElementById("livd-root")!.appendChild(scrollContainer);

  // ─── Loading Canvas (2D animation) ────────────────────────────────────────
  const lCtx = loadingCanvas.getContext("2d")!;
  loadingCanvas.width = 80;
  loadingCanvas.height = 80;
  const PARTICLE_COUNT = 28;
  const LC = { cx: 40, cy: 40, r: 22 };
  let lPhase = "forming";
  let lT = 0;
  let lRaf: number;
  let assetsReady = false;

  function drawLoading() {
    lCtx.clearRect(0, 0, 80, 80);
    lCtx.fillStyle = "#000";
    lCtx.fillRect(0, 0, 80, 80);

    if (lPhase === "forming") {
      const p = Math.min(lT / 1.2, 1);
      const e = 1 - Math.pow(1 - p, 3);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const a = (i / PARTICLE_COUNT) * Math.PI * 2;
        const d = LC.r * 3 + (LC.r - LC.r * 3) * e;
        lCtx.beginPath();
        lCtx.arc(LC.cx + Math.cos(a) * d, LC.cy + Math.sin(a) * d, 1.5 * e + 0.5, 0, Math.PI * 2);
        lCtx.fillStyle = `rgba(255,255,255,${e * 0.9})`;
        lCtx.fill();
      }
      if (lT >= 1.2) { lPhase = "holding"; lT = 0; }

    } else if (lPhase === "holding") {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const a = (i / PARTICLE_COUNT) * Math.PI * 2;
        lCtx.beginPath();
        lCtx.arc(LC.cx + Math.cos(a) * LC.r, LC.cy + Math.sin(a) * LC.r, 2, 0, Math.PI * 2);
        lCtx.fillStyle = "rgba(255,255,255,0.9)";
        lCtx.fill();
      }
      if (lT >= 0.3) {
        lPhase = assetsReady ? "final" : "breaking";
        lT = 0;
      }

    } else if (lPhase === "breaking") {
      const p = Math.min(lT / 0.8, 1);
      const e = p * p;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const a = (i / PARTICLE_COUNT) * Math.PI * 2;
        const d = LC.r + e * LC.r * 3;
        lCtx.beginPath();
        lCtx.arc(LC.cx + Math.cos(a) * d, LC.cy + Math.sin(a) * d, 2 * (1 - e * 0.5), 0, Math.PI * 2);
        lCtx.fillStyle = `rgba(255,255,255,${0.9 * (1 - e)})`;
        lCtx.fill();
      }
      if (lT >= 0.8) {
        lPhase = assetsReady ? "final" : "forming";
        lT = 0;
      }

    } else if (lPhase === "final") {
      const fp = Math.min(lT / 1.2, 1);
      const fe = 1 - Math.pow(1 - fp, 3);
      if (fp < 1) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const a = (i / PARTICLE_COUNT) * Math.PI * 2;
          const d = LC.r * 2 + (LC.r - LC.r * 2) * fe;
          lCtx.beginPath();
          lCtx.arc(LC.cx + Math.cos(a) * d, LC.cy + Math.sin(a) * d, 2, 0, Math.PI * 2);
          lCtx.fillStyle = `rgba(255,255,255,${fe * 0.9})`;
          lCtx.fill();
        }
      } else {
        const et = lT - 1.2;
        const ep = Math.min(et / 0.6, 1);
        const expandR = LC.r * (1 + ep * ep * 25);
        lCtx.beginPath();
        lCtx.arc(LC.cx, LC.cy, expandR, 0, Math.PI * 2);
        lCtx.fillStyle = "#000";
        lCtx.fill();
        // Ring particles hold briefly
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const a = (i / PARTICLE_COUNT) * Math.PI * 2;
          lCtx.beginPath();
          lCtx.arc(LC.cx + Math.cos(a) * LC.r, LC.cy + Math.sin(a) * LC.r, 2, 0, Math.PI * 2);
          lCtx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.9 - ep)})`;
          lCtx.fill();
        }
        if (et >= 0.9) {
          cancelAnimationFrame(lRaf);
          transitionFromLoading();
          return;
        }
      }
    }

    lT += 0.016;
    lRaf = requestAnimationFrame(drawLoading);
  }
  lRaf = requestAnimationFrame(drawLoading);

  // Wait for font before signaling assets ready
  await fontLoadPromise;
  assetsReady = true;

  // ─── Three.js Main Scene ───────────────────────────────────────────────────
  let renderer: any;
  try {
    renderer = new T.WebGLRenderer({ canvas: mainCanvas, antialias: true, alpha: false });
  } catch (e) {
    // WebGL not available — show loading canvas indefinitely
    console.warn("WebGL not available:", e);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0.2, 0.15, 6);
  camera.lookAt(0, 0, 0);

  const ambientLight = new T.AmbientLight(0xffffff, 0.15);
  scene.add(ambientLight);
  const dirLight = new T.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(-3, 4, 2);
  scene.add(dirLight);

  // ─── Text Helpers ──────────────────────────────────────────────────────────
  function makeText(text: string, size: number, depth: number, color: number, emissive = 0): any {
    if (helvetiker && TextGeometry) {
      try {
        const geom = new TextGeometry(text, {
          font: helvetiker, size, height: depth, curveSegments: 6, bevelEnabled: false,
        });
        geom.computeBoundingBox();
        const bb = geom.boundingBox!;
        geom.translate(-(bb.max.x - bb.min.x) / 2, -(bb.max.y - bb.min.y) / 2, 0);
        const mat = new T.MeshStandardMaterial({
          color, roughness: 0.6, metalness: 0.3,
          emissive, emissiveIntensity: emissive ? 0.3 : 0,
        });
        return new T.Mesh(geom, mat);
      } catch (e) { /* fallback */ }
    }
    // Fallback: elongated box
    const w = text.length * size * 0.65;
    const geom = new T.BoxGeometry(w, size * 1.1, depth);
    const mat = new T.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 0.3 : 0 });
    const mesh = new T.Mesh(geom, mat);
    return mesh;
  }

  // ─── Particles ─────────────────────────────────────────────────────────────
  function particlesFromMesh(mesh: any, count: number) {
    mesh.updateMatrixWorld(true);
    const posAttr = mesh.geometry.attributes.position;
    const arr: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(seedRandom() * posAttr.count);
      const v = new T.Vector3().fromBufferAttribute(posAttr, idx).applyMatrix4(mesh.matrixWorld);
      arr.push(v.x, v.y, v.z);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(arr, 3));
    return new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 1 }));
  }

  // ─── Background Shapes ─────────────────────────────────────────────────────
  const bgShapes: { mesh: any; rx: number; ry: number; rz: number }[] = [];

  function buildBgShapes() {
    const geoms = [
      new T.IcosahedronGeometry(0.55, 0),
      new T.OctahedronGeometry(0.65, 0),
      new T.TetrahedronGeometry(0.75, 0),
      new T.DodecahedronGeometry(0.5, 0),
    ];
    const positions: [number,number,number][] = [[-3.5,1.5,-3],[3.2,-1.2,-4],[-2.8,-2,-3.5],[3.5,2,-5]];
    geoms.forEach((g, i) => {
      const mat = new T.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.85, metalness: 0.1 });
      const mesh = new T.Mesh(g, mat);
      mesh.position.set(...positions[i]);
      mesh.rotation.set(seedRandom() * Math.PI, seedRandom() * Math.PI, 0);
      scene.add(mesh);
      bgShapes.push({ mesh, rx: (seedRandom()-0.5)*0.003, ry: (seedRandom()-0.5)*0.003, rz: (seedRandom()-0.5)*0.002 });
    });
  }
  buildBgShapes();

  // ─── Loading Transition ────────────────────────────────────────────────────
  function transitionFromLoading() {
    gsap.to(loadingScreen, {
      opacity: 0, duration: 0.8, ease: "power2.in",
      onComplete: () => {
        loadingScreen.style.display = "none";
        startHero();
      },
    });
  }

  // ─── SECTION 00 HERO ──────────────────────────────────────────────────────
  const heroGroup = new T.Group();
  scene.add(heroGroup);

  function startHero() {
    state.phase = "hero";

    // "3D" text
    const text3d = makeText("3D", 1.5, 0.4, 0xffffff);
    text3d.position.set(0, 0.6, 0);
    text3d.rotation.y = 0.25;
    text3d.material.transparent = true;
    text3d.material.opacity = 0;
    heroGroup.add(text3d);
    gsap.to(text3d.material, { opacity: 1, duration: 0.6, ease: "power2.out" });
    gsap.to(text3d.rotation, { y: 0, duration: 0.6, ease: "power2.out" });

    // "website" text
    const textWeb = makeText("website", 1.2, 0.3, 0xcccccc);
    textWeb.position.set(0, -1.0, 0);
    textWeb.material.transparent = true;
    textWeb.material.opacity = 0;
    heroGroup.add(textWeb);
    gsap.to(textWeb.material, { opacity: 1, duration: 0.5, delay: 0.3, ease: "power2.out" });
    gsap.to(textWeb.position, { y: -0.7, duration: 0.5, delay: 0.3, ease: "power2.out" });

    // Start sequence
    setTimeout(() => wipe3D(text3d, textWeb), 1500);
  }

  function wipe3D(text3d: any, textWeb: any) {
    const pts = particlesFromMesh(text3d, 1800);
    scene.add(pts);
    heroGroup.remove(text3d);

    const pa = pts.geometry.attributes.position;
    const vels: number[] = [];
    for (let i = 0; i < pa.count; i++) {
      vels.push(
        1.5 + seedRandom() * 2.5,
        (seedRandom() - 0.5) * 0.8,
        (seedRandom() - 0.5) * 0.4
      );
    }

    const st = Date.now();
    function tick() {
      const el = (Date.now() - st) / 1000;
      const t = el / 1.2;
      const drag = Math.max(0.7, 1 - el * 0.5);
      for (let i = 0; i < pa.count; i++) {
        const delay = (pa.array[i*3] + 3) / 8;
        if (el > delay) {
          pa.array[i*3] += vels[i*3] * 0.016;
          pa.array[i*3+1] += vels[i*3+1] * 0.016;
          pa.array[i*3+2] += vels[i*3+2] * 0.016;
        }
      }
      pa.needsUpdate = true;
      pts.material.opacity = Math.max(0, 1 - t * 1.1);
      if (t < 1.1) requestAnimationFrame(tick);
      else { scene.remove(pts); meltWeb(textWeb); }
    }
    requestAnimationFrame(tick);
  }

  function meltWeb(textWeb: any) {
    const pa = textWeb.geometry.attributes.position;
    const speeds: number[] = [];
    const delays: number[] = [];
    for (let i = 0; i < pa.count; i++) {
      speeds.push(0.4 + seedRandom() * 1.8);
      delays.push(seedRandom() * 0.9);
    }
    const st = Date.now();
    function tick() {
      const el = (Date.now() - st) / 1000;
      for (let i = 0; i < pa.count; i++) {
        if (el > delays[i]) pa.array[i*3+1] -= speeds[i] * 0.016;
      }
      pa.needsUpdate = true;
      textWeb.material.color.lerpColors(new T.Color(0xcccccc), new T.Color(0x888888), Math.min(el/2,1));
      textWeb.material.opacity = Math.max(0, 1 - el / 2.2);
      if (el < 2.5) requestAnimationFrame(tick);
      else { heroGroup.remove(textWeb); setTimeout(spawnWelcome, 200); }
    }
    requestAnimationFrame(tick);
  }

  const welcomeChars: any[] = [];

  function spawnWelcome() {
    const chars = "welcome";
    const welcomeG = new T.Group();

    if (helvetiker && TextGeometry) {
      chars.split("").forEach((ch, i) => {
        const m = makeText(ch, 1.8, 0.5, 0x8B0000, 0x3d0000);
        m.position.set((i - chars.length/2) * 1.35, 0, 0);
        m.material.transparent = true;
        welcomeG.add(m);
        welcomeChars.push(m);
      });
    } else {
      const m = makeText("welcome", 1.8, 0.5, 0x8B0000, 0x3d0000);
      m.material.transparent = true;
      welcomeG.add(m);
      welcomeChars.push(m);
    }

    welcomeG.position.z = 4;
    scene.add(welcomeG);
    gsap.to(welcomeG.position, { z: 0, duration: 0.3, ease: "power4.out" });
    setTimeout(() => explodeWelcome(welcomeG), 1000);
  }

  function explodeWelcome(group: any) {
    const children = [...group.children];
    children.forEach((ch: any) => {
      const wp = new T.Vector3();
      ch.getWorldPosition(wp);
      scene.add(ch);
      group.remove(ch);
      ch.position.copy(wp);

      const vx = (seedRandom()-0.5)*9, vy = (seedRandom()-0.5)*7, vz = (seedRandom()-0.5)*5;
      const rx = (seedRandom()-0.5)*0.35, ry = (seedRandom()-0.5)*0.35, rz = (seedRandom()-0.5)*0.35;

      const st = Date.now();
      const fadeDelay = 1.5 + seedRandom() * 1.2;
      function charTick() {
        const el = (Date.now()-st)/1000;
        const drag = Math.pow(0.96, el * 60);
        ch.position.x += vx * 0.016 * drag;
        ch.position.y += vy * 0.016 * drag;
        ch.position.z += vz * 0.016 * drag;
        ch.rotation.x += rx;
        ch.rotation.y += ry;
        ch.rotation.z += rz;
        if (el > fadeDelay) ch.material.opacity = Math.max(0, ch.material.opacity - 0.008);
        if (ch.material.opacity <= 0) { scene.remove(ch); return; }
        requestAnimationFrame(charTick);
      }
      requestAnimationFrame(charTick);
    });

    // 1.5s blank silence then unlock scroll
    setTimeout(() => {
      transitionToScroll();
    }, 3500);
  }

  // ─── SECTION 01 SCROLL ZONE ────────────────────────────────────────────────
  function transitionToScroll() {
    state.phase = "scroll";
    state.scrollLocked = false;
    scrollContainer.style.pointerEvents = "all";
    showIsland("you can move now", 200);
    setTimeout(hideIsland, 2500);
  }

  scrollContainer.addEventListener("scroll", onScroll);

  function onScroll() {
    if (state.phase !== "scroll") {
      if (state.scrollLocked) scrollContainer.scrollTop = 0;
      return;
    }
    if (state.scrollLocked) { scrollContainer.scrollTop = 0; return; }

    const maxScroll = scrollContent.scrollHeight - scrollContainer.clientHeight;
    if (maxScroll <= 0) return;
    state.scrollProgress = Math.min(scrollContainer.scrollTop / maxScroll, 1);

    const now = Date.now();
    const dt = now - state.lastScrollTime;
    if (dt < 40 && state.lastScrollTime > 0) {
      showIsland("slow down.", 180);
    }
    state.lastScrollTime = now;

    // Camera forward
    camera.position.z = 6 - state.scrollProgress * 1.8;

    // Bg shape updates
    bgShapes.forEach((s, i) => {
      const brightness = 0.055 + state.scrollProgress * 0.25;
      s.mesh.material.color.setScalar(brightness);
      if (state.scrollProgress > 0.4) {
        const cT = Math.min((state.scrollProgress - 0.4) / 0.3, 1);
        s.mesh.material.emissive = new T.Color(0xffffff);
        s.mesh.material.emissiveIntensity = cT * 0.06;
        s.mesh.material.wireframe = cT > 0.65;
      }
      if (state.scrollProgress > 0.7 && i === 0) {
        const bT = (state.scrollProgress - 0.7) / 0.3;
        state.cursorTremor = bT > 0.2;
      }
    });

    if (state.scrollProgress >= 0.9) {
      triggerDestruction();
    }
  }

  // ─── SECTION 02 DESTRUCTION ────────────────────────────────────────────────
  let destructionDone = false;

  function triggerDestruction() {
    if (destructionDone) return;
    destructionDone = true;
    state.phase = "destruction";
    state.scrollLocked = true;
    scrollContainer.style.pointerEvents = "none";
    state.cursorTremor = false;

    showIsland("an error occurred.", 240);

    setTimeout(() => {
      showIsland("going home →", 200);
      setTimeout(() => {
        scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
        gsap.to(camera.position, { z: 8, duration: 1.5, ease: "power2.in" });

        bgShapes.forEach((s) => {
          s.mesh.material.wireframe = true;
          gsap.to(s.mesh.material, { emissiveIntensity: 0.18, duration: 0.4 });
        });

        setTimeout(collapseAll, 1100);
      }, 1200);
    }, 800);
  }

  function collapseAll() {
    // Camera shake
    const orig = camera.position.clone();
    camera.position.x += (seedRandom()-0.5)*0.12;
    camera.position.y += (seedRandom()-0.5)*0.12;
    setTimeout(() => { camera.position.x = orig.x; camera.position.y = orig.y; }, 80);

    const allPts: any[] = [];
    bgShapes.forEach((s) => {
      const pts = particlesFromMesh(s.mesh, 250);
      pts.position.copy(s.mesh.position);
      scene.add(pts);
      scene.remove(s.mesh);
      allPts.push(pts);
    });

    const st = Date.now();
    function convergeTick() {
      const el = (Date.now()-st)/1000;
      allPts.forEach((pts) => {
        const pa = pts.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          const wx = pa.array[i*3] + pts.position.x;
          const wy = pa.array[i*3+1] + pts.position.y;
          const wz = pa.array[i*3+2] + pts.position.z;
          pa.array[i*3] -= (wx / pa.count < 0 ? -1 : 1) * 0.06;
          pa.array[i*3+1] -= (wy / 10) * 0.1;
          pa.array[i*3+2] -= (wz / 10) * 0.1;
          // Move toward center
          pa.array[i*3] -= pa.array[i*3] * 0.04;
          pa.array[i*3+1] -= pa.array[i*3+1] * 0.04;
          pa.array[i*3+2] -= pa.array[i*3+2] * 0.04;
        }
        pa.needsUpdate = true;
      });
      if (el < 0.9) requestAnimationFrame(convergeTick);
      else explodeAll(allPts);
    }
    requestAnimationFrame(convergeTick);
  }

  function explodeAll(allPts: any[]) {
    const velMap: number[][][] = allPts.map((pts) => {
      const pa = pts.geometry.attributes.position;
      const v = [];
      for (let i = 0; i < pa.count; i++) {
        v.push([(seedRandom()-0.5)*7, (seedRandom()-0.5)*7, (seedRandom()-0.5)*5]);
      }
      return v;
    });

    const st = Date.now();
    function tick() {
      const el = (Date.now()-st)/1000;
      const t = el / 1.1;
      allPts.forEach((pts, pi) => {
        const pa = pts.geometry.attributes.position;
        velMap[pi].forEach((v, i) => {
          pa.array[i*3] += v[0] * 0.016;
          pa.array[i*3+1] += v[1] * 0.016;
          pa.array[i*3+2] += v[2] * 0.016;
        });
        pa.needsUpdate = true;
        pts.material.opacity = Math.max(0, 1 - t);
      });
      if (t < 1) requestAnimationFrame(tick);
      else { allPts.forEach((p) => scene.remove(p)); trailOneDot(); }
    }
    requestAnimationFrame(tick);
  }

  function trailOneDot() {
    const mesh = new T.Mesh(
      new T.SphereGeometry(0.045, 8, 8),
      new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
    );
    const sp = new T.Vector3((seedRandom()-0.5)*10, (seedRandom()-0.5)*7, (seedRandom()-0.5)*4);
    mesh.position.copy(sp);
    scene.add(mesh);
    gsap.to(mesh.material, { opacity: 1, duration: 0.4 });
    gsap.to(mesh.position, {
      x: 0, y: 0, z: 0,
      duration: 2.2,
      ease: "power2.out",
      onComplete: () => startRevival(mesh),
    });
  }

  // ─── SECTION 03 REVIVAL ────────────────────────────────────────────────────
  type Dot = { mesh: any; x: number; y: number; vx: number; vy: number; isMain: boolean; resistant: boolean; absorbed: boolean; dead: boolean; size: number; id: number };
  const dots: Dot[] = [];
  let mainDot: Dot | null = null;
  let dotId = 0;
  let revivalActive = false;
  let absorptionCount = 0;
  const geomVerts: T.Vector3[] = [new T.Vector3(0,0,0)];
  let mainObj: any = null;
  const revivalGroup = new T.Group();
  scene.add(revivalGroup);

  function startRevival(centerMesh: any) {
    state.phase = "revival";
    state.scrollLocked = true;
    gsap.to(camera.position, { x: 0, y: 0, z: 6, duration: 1.2, ease: "power2.out" });
    showIsland("wait.", 160);

    // Gravity pull toward center
    state.cursorGravity = true;
    state.gravityTarget.x = window.innerWidth / 2;
    state.gravityTarget.y = window.innerHeight / 2;

    const md: Dot = { mesh: centerMesh, x: 0, y: 0, vx: 0, vy: 0, isMain: true, resistant: false, absorbed: false, dead: false, size: 0.06, id: dotId++ };
    dots.push(md);
    mainDot = md;

    // Gentle pulse
    gsap.to(centerMesh.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 1, yoyo: true, repeat: -1, ease: "sine.inOut" });

    // Spawn dots
    let count = 1, interval = 1200;
    const spawnLoop = () => {
      if (count >= 32 || state.phase !== "revival") return;
      const ang = seedRandom() * Math.PI * 2;
      const rad = 0.6 + seedRandom() * 1.8;
      const sx = Math.cos(ang) * rad, sy = Math.sin(ang) * rad;
      const sz = 0.03 + seedRandom() * 0.04;
      const br = 0.8 + seedRandom() * 0.2;
      const resistant = seedRandom() < 0.25;

      const g = new T.SphereGeometry(sz, 7, 7);
      const m = new T.MeshBasicMaterial({ color: new T.Color(br, br, br) });
      const mesh = new T.Mesh(g, m);
      mesh.position.set(sx, sy, 0);
      revivalGroup.add(mesh);

      dots.push({ mesh, x: sx, y: sy, vx: 0, vy: 0, isMain: false, resistant, absorbed: false, dead: false, size: sz, id: dotId++ });
      count++;
      if (count === 8) revivalActive = true;
      interval = Math.max(380, interval - 45);
      setTimeout(spawnLoop, interval + seedRandom() * 180);
    };
    setTimeout(spawnLoop, 1200);

    runRevival();
  }

  let revRaf: number;
  function runRevival() {
    revRaf = requestAnimationFrame(runRevival);
    if (!revivalActive || !mainDot) return;
    const md = mainDot;

    // Find nearest target
    let nearest: Dot | null = null, nearDist = Infinity;
    dots.forEach((d) => {
      if (d.isMain || d.absorbed || d.dead) return;
      const dist = Math.hypot(md.x - d.x, md.y - d.y);

      if (d.resistant && dist < 1.6) {
        const ax = (d.x - md.x) / dist, ay = (d.y - md.y) / dist;
        d.vx += ax * 0.01; d.vy += ay * 0.01;
      }
      if (dist < nearDist) { nearDist = dist; nearest = d; }
    });

    if (nearest) {
      const nd = nearest as Dot;
      const dist = Math.hypot(md.x - nd.x, md.y - nd.y);
      if (dist > 0) {
        const dx = (nd.x - md.x) / dist, dy = (nd.y - md.y) / dist;
        const perp = { x: -dy * 0.003, y: dx * 0.003 };
        md.vx += dx * 0.009 + perp.x;
        md.vy += dy * 0.009 + perp.y;
      }
    }

    md.vx *= 0.91; md.vy *= 0.91;
    md.x += md.vx; md.y += md.vy;
    md.mesh.position.set(md.x, md.y, 0);

    dots.forEach((d) => {
      if (d.isMain || d.absorbed || d.dead) return;
      d.vx *= 0.90; d.vy *= 0.90;
      d.x += d.vx; d.y += d.vy;
      d.mesh.position.set(d.x, d.y, 0);

      // Kill escaped resistant dots
      if (d.resistant && Math.hypot(d.x, d.y) > 2.8) {
        d.dead = true; state.deadDotCount++;
        d.mesh.material.transparent = true;
        gsap.to(d.mesh.material, { opacity: 0, duration: 1, onComplete: () => revivalGroup.remove(d.mesh) });
        ripple(d.x, d.y);
        return;
      }

      const dist = Math.hypot(md.x - d.x, md.y - d.y);
      if (dist < md.size + d.size + 0.03) absorb(d);
    });
  }

  function ripple(x: number, y: number) {
    const g = new T.RingGeometry(0.02, 0.05, 14);
    const m = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: T.DoubleSide });
    const mesh = new T.Mesh(g, m);
    mesh.position.set(x, y, 0);
    scene.add(mesh);
    gsap.to(mesh.scale, { x: 6, y: 6, z: 6, duration: 1 });
    gsap.to(m, { opacity: 0, duration: 1, onComplete: () => scene.remove(mesh) });
  }

  function flashLine(x1: number, y1: number, x2: number, y2: number) {
    const g = new T.BufferGeometry().setFromPoints([new T.Vector3(x1,y1,0), new T.Vector3(x2,y2,0)]);
    const m = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    const l = new T.Line(g, m);
    scene.add(l);
    gsap.to(m, { opacity: 0, duration: 0.25, onComplete: () => scene.remove(l) });
  }

  function absorb(d: Dot) {
    d.absorbed = true;
    absorptionCount++;
    state.absorptionOrder.push(d.id);
    flashLine(mainDot!.x, mainDot!.y, d.x, d.y);
    revivalGroup.remove(d.mesh);

    // Grow main dot
    mainDot!.size += 0.005;
    const ns = mainDot!.size / 0.06;
    gsap.to(mainDot!.mesh.scale, { x: ns, y: ns, z: ns, duration: 0.2 });

    // Add geometry
    growGeometry(d.x, d.y);

    if (absorptionCount >= 18 && state.phase === "revival") {
      setTimeout(() => { if (state.phase === "revival") startConflict(); }, 1800);
    }
  }

  function growGeometry(x: number, y: number) {
    const vx = x + (seedRandom()-0.5)*0.35;
    const vy = y + (seedRandom()-0.5)*0.35;
    const vz = (seedRandom()-0.5)*0.5;
    geomVerts.push(new T.Vector3(vx, vy, vz));

    if (mainObj) scene.remove(mainObj);
    if (geomVerts.length < 4) return;

    const positions: number[] = [];
    for (let i = 1; i < geomVerts.length - 1; i++) {
      const p0 = geomVerts[0], p1 = geomVerts[i], p2 = geomVerts[i+1] || geomVerts[1];
      positions.push(p0.x,p0.y,p0.z, p1.x,p1.y,p1.z, p2.x,p2.y,p2.z);
    }

    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({
      color: 0xe8e8e8, roughness: 0.55, metalness: 0.25,
      wireframe: absorptionCount % 3 !== 0,
      emissive: 0x1a1a1a, emissiveIntensity: 0.1,
      transparent: true, opacity: 0.88, side: T.DoubleSide,
    });
    mainObj = new T.Mesh(g, mat);
    scene.add(mainObj);
  }

  // ─── SECTION 04 CONFLICT ───────────────────────────────────────────────────
  type Enemy = { mesh: any; vx: number; vy: number; isEnemy: boolean; alive: boolean };
  const enemies: Enemy[] = [];
  let conflictActive = false;
  let firstContact = false;

  function startConflict() {
    state.phase = "conflict";
    cancelAnimationFrame(revRaf);
    state.cursorGravity = false;

    showIsland("resistance", 160);
    islandEl.style.borderColor = "#8B0000";
    setTimeout(() => { islandEl.style.borderColor = "#1a1a1a"; hideIsland(); }, 2200);

    // First enemy contact — cursor flicker
    cursorDot.style.backgroundColor = "#8B0000";
    setTimeout(() => { cursorDot.style.backgroundColor = "#ffffff"; }, 200);

    const geomFns = [
      () => new T.IcosahedronGeometry(0.22, 0),
      () => new T.TorusGeometry(0.18, 0.07, 7, 10),
      () => new T.BoxGeometry(0.28, 0.28, 0.28),
    ];

    const total = 5 + Math.floor(seedRandom() * 4);
    for (let i = 0; i < total; i++) {
      setTimeout(() => {
        const fn = geomFns[Math.floor(seedRandom() * geomFns.length)];
        const mat = new T.MeshStandardMaterial({ color: 0x999999, roughness: 0.7, metalness: 0.1 });
        const mesh = new T.Mesh(fn(), mat);
        const side = Math.floor(seedRandom() * 4);
        switch(side) {
          case 0: mesh.position.set((seedRandom()-0.5)*5, 3, 0); break;
          case 1: mesh.position.set((seedRandom()-0.5)*5, -3, 0); break;
          case 2: mesh.position.set(-4.5, (seedRandom()-0.5)*4, 0); break;
          case 3: mesh.position.set(4.5, (seedRandom()-0.5)*4, 0); break;
        }
        scene.add(mesh);
        const e: Enemy = { mesh, vx: -mesh.position.x*0.008, vy: -mesh.position.y*0.008, isEnemy: false, alive: true };
        enemies.push(e);

        setTimeout(() => {
          if (seedRandom() < 0.45) {
            e.isEnemy = true;
            gsap.to(mat.color, { r: 0x6B/255, g: 0, b: 0, duration: 0.8 });
            e.vx *= 2.5; e.vy *= 2.5;
          }
        }, 2000);
      }, i * 350);
    }

    conflictActive = true;
    runConflict();
  }

  function runConflict() {
    requestAnimationFrame(runConflict);
    if (!conflictActive) return;

    const mp = mainDot ? new T.Vector3(mainDot.x, mainDot.y, 0) : new T.Vector3(0,0,0);

    enemies.forEach((e) => {
      if (!e.alive) return;
      if (e.isEnemy) {
        const dx = mp.x - e.mesh.position.x, dy = mp.y - e.mesh.position.y;
        const d = Math.hypot(dx, dy) || 1;
        e.vx += (dx/d) * 0.0025; e.vy += (dy/d) * 0.0025;
      }
      e.mesh.position.x += e.vx; e.mesh.position.y += e.vy;
      e.mesh.rotation.x += 0.012; e.mesh.rotation.y += 0.016;

      if (e.isEnemy && mainObj) {
        const dist = e.mesh.position.distanceTo(mp);
        if (dist < 1.0) {
          // Contact
          if (!firstContact) {
            firstContact = true;
            cursorDot.style.backgroundColor = "#8B0000";
            setTimeout(() => { cursorDot.style.backgroundColor = "#ffffff"; }, 200);
          }
          // Distort geometry
          if (mainObj && mainObj.geometry.attributes.position) {
            const pa = mainObj.geometry.attributes.position;
            const idx = Math.floor(seedRandom() * pa.count) * 3;
            pa.array[idx] += (seedRandom()-0.5)*0.07;
            pa.array[idx+1] += (seedRandom()-0.5)*0.07;
            pa.needsUpdate = true;
            mainObj.geometry.computeVertexNormals();
          }
          // Flicker
          if (mainObj) {
            const orig = mainObj.material.emissiveIntensity;
            mainObj.material.emissiveIntensity = 0.6;
            setTimeout(() => { if(mainObj) mainObj.material.emissiveIntensity = orig; }, 130);
          }
          // Fragment enemy
          fragmentEnemy(e);
          loseFragment();
        }
      }
    });

    const aliveEnemies = enemies.filter(e => e.alive && e.isEnemy);
    const hadEnemies = enemies.some(e => e.isEnemy);
    if (conflictActive && hadEnemies && aliveEnemies.length === 0) {
      conflictActive = false;
      onAllDefeated();
    }
  }

  function fragmentEnemy(e: Enemy) {
    e.alive = false;
    const pts = particlesFromMesh(e.mesh, 40);
    pts.position.copy(e.mesh.position);
    scene.add(pts);
    scene.remove(e.mesh);
    const pa = pts.geometry.attributes.position;
    const vels: number[][] = [];
    for (let i = 0; i < pa.count; i++) vels.push([(seedRandom()-0.5)*5,(seedRandom()-0.5)*5,(seedRandom()-0.5)*4]);
    const st = Date.now();
    function tick() {
      const el = (Date.now()-st)/1000;
      vels.forEach((v,i) => { pa.array[i*3]+=v[0]*0.016; pa.array[i*3+1]+=v[1]*0.016; pa.array[i*3+2]+=v[2]*0.016; });
      pa.needsUpdate = true;
      pts.material.opacity = Math.max(0, 1 - el/0.9);
      if (el < 0.9) requestAnimationFrame(tick); else scene.remove(pts);
    }
    requestAnimationFrame(tick);
  }

  function loseFragment() {
    if (!mainObj || geomVerts.length <= 4) return;
    const ri = 1 + Math.floor(seedRandom() * (geomVerts.length - 2));
    const removed = geomVerts.splice(ri, 1)[0];

    const fragG = new T.SphereGeometry(0.05, 6, 6);
    const fragM = new T.MeshBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.65 });
    const frag = new T.Mesh(fragG, fragM);
    frag.position.copy(removed);
    scene.add(frag);
    const vx = (seedRandom()-0.5)*0.025, vy = (seedRandom()-0.5)*0.025, vz = (seedRandom()-0.5)*0.015;
    function driftTick() {
      frag.position.x+=vx; frag.position.y+=vy; frag.position.z+=vz;
      fragM.opacity -= 0.003;
      if (fragM.opacity > 0) requestAnimationFrame(driftTick); else scene.remove(frag);
    }
    requestAnimationFrame(driftTick);
    growGeometry(0, 0); // Rebuild geometry without that vertex
  }

  // ─── SECTION 05 REBUILDING ─────────────────────────────────────────────────
  const orbiters: { mesh: any; angle: number; radius: number; speed: number }[] = [];

  function onAllDefeated() {
    state.phase = "rebuilding";
    showIsland("rebuilt", 160);
    islandEl.style.borderColor = "#00bb44";
    setTimeout(() => { islandEl.style.borderColor = "#1a1a1a"; hideIsland(); }, 2200);

    setTimeout(() => {
      spawnOrbiters();
      setTimeout(() => {
        state.scrollLocked = false;
        state.phase = "survival";
        scrollContainer.style.pointerEvents = "all";
        showIsland("you can move now", 210);
        setTimeout(hideIsland, 2800);
        startSurvival();
      }, 3200);
    }, 2000);
  }

  function spawnOrbiters() {
    const n = 4 + Math.floor(seedRandom() * 4);
    const geomFns = [
      () => new T.SphereGeometry(0.07, 7, 7),
      () => new T.OctahedronGeometry(0.09, 0),
      () => new T.BoxGeometry(0.1, 0.1, 0.1),
    ];
    for (let i = 0; i < n; i++) {
      const g = geomFns[Math.floor(seedRandom() * geomFns.length)]();
      const m = new T.MeshStandardMaterial({ color: 0x999999, roughness: 0.8 });
      const mesh = new T.Mesh(g, m);
      scene.add(mesh);
      orbiters.push({ mesh, angle: (i/n)*Math.PI*2, radius: 1.4 + seedRandom()*0.5, speed: 0.003 + seedRandom()*0.003 });
    }
  }

  // ─── SECTION 06 SURVIVAL ───────────────────────────────────────────────────
  let endTimer: any = null;

  function startSurvival() {
    endTimer = setTimeout(() => {
      if (!state.endTriggered) triggerEnd();
    }, 50000);
  }

  scrollContainer.addEventListener("scroll", () => {
    if (state.phase !== "survival") return;
    const maxScroll = scrollContent.scrollHeight - scrollContainer.clientHeight;
    if (maxScroll > 0 && scrollContainer.scrollTop / maxScroll > 0.94) {
      if (!state.endTriggered) triggerEnd();
    }
  });

  // ─── SECTION 07 END ────────────────────────────────────────────────────────
  function triggerEnd() {
    if (state.endTriggered) return;
    state.endTriggered = true;
    state.phase = "end";
    state.scrollLocked = true;
    clearTimeout(endTimer);

    // Island shrinks to dot then disappears
    gsap.to(islandEl, { width: "8px", height: "8px", duration: 0.5, ease: "power2.in" });
    gsap.to(islandEl, { opacity: 0, duration: 0.3, delay: 0.5 });

    // Traveling dot from edge
    const edges: [number,number,number][] = [[0,3.5,0],[0,-3.5,0],[-5,0,0],[5,0,0]];
    const sp = edges[Math.floor(seedRandom() * 4)];
    const endDotMesh = new T.Mesh(
      new T.SphereGeometry(0.055, 10, 10),
      new T.MeshBasicMaterial({ color: 0xffffff })
    );
    endDotMesh.position.set(...sp);
    scene.add(endDotMesh);

    gsap.to(endDotMesh.position, {
      x: 0, y: 0, z: 0,
      duration: 3.5,
      ease: "power1.inOut",
      onUpdate: () => {
        orbiters.forEach((o) => {
          if (endDotMesh.position.distanceTo(o.mesh.position) < 0.6) {
            const origEI = o.mesh.material.emissiveIntensity || 0;
            o.mesh.material.emissive = new T.Color(0xffffff);
            o.mesh.material.emissiveIntensity = 0.3;
            setTimeout(() => { o.mesh.material.emissiveIntensity = origEI; }, 200);
          }
        });
      },
      onComplete: () => showEndText(endDotMesh),
    });
  }

  function showEndText(dotMesh: any) {
    const et = makeText("end", 0.8, 0.2, 0xffffff);
    et.scale.set(0, 0, 0);
    et.position.set(0, -0.1, 0);
    scene.add(et);
    gsap.to(et.scale, { x: 1, y: 1, z: 1, duration: 1, ease: "expo.out" });

    setTimeout(() => doWhiteFill(dotMesh, et), 2800);
  }

  function doWhiteFill(dotMesh: any, endTextMesh: any) {
    const sphere = new T.Mesh(
      new T.SphereGeometry(0.12, 16, 16),
      new T.MeshBasicMaterial({ color: 0xffffff })
    );
    sphere.position.set(0, 0, 0);
    scene.add(sphere);
    scene.remove(dotMesh);

    const st = Date.now();
    function tick() {
      const el = (Date.now()-st)/1000;
      const e2 = el * el;
      const sc = 1 + e2 * 18;
      sphere.scale.set(sc, sc, sc);
      const r = sc * 0.12;

      orbiters.forEach((o) => {
        if (o.mesh.position.distanceTo(sphere.position) < r) {
          o.mesh.material.color.set(0xffffff);
          if (o.mesh.material.emissive) o.mesh.material.emissive.set(0xffffff);
        }
      });

      if (mainObj && r > 0.6) mainObj.material.color.set(0xffffff);
      if (endTextMesh && r > 1) endTextMesh.material.color.set(0xffffff);

      if (r > 7) {
        document.body.style.background = "#ffffff";
        renderer.setClearColor(0xffffff, 1);
        renderer.domElement.style.opacity = "0";
      }

      if (el < 3.2) requestAnimationFrame(tick);
      else {
        // Cursor last to go
        cursorDot.style.backgroundColor = "#000";
        setTimeout(() => {
          gsap.to(cursorDot, { opacity: 0, duration: 0.5 });
          hintBtn.style.display = "none";
        }, 1000);
      }
    }
    requestAnimationFrame(tick);
  }

  // ─── ISLAND HELPERS ────────────────────────────────────────────────────────
  let islandHideTimer: any = null;

  function showIsland(msg: string, width = 200) {
    clearTimeout(islandHideTimer);
    islandText.textContent = msg;
    gsap.killTweensOf(islandEl);
    gsap.killTweensOf(islandText);
    gsap.timeline()
      .to(islandEl, { width: `${width}px`, height: "36px", duration: 0.4, ease: "power2.out" })
      .to(islandText, { opacity: 1, duration: 0.2 }, "-=0.1");
    // Cursor pulse
    gsap.to(cursorDot, { width: "14px", height: "14px", duration: 0.15, yoyo: true, repeat: 1 });
  }

  function hideIsland(delay = 0) {
    islandHideTimer = setTimeout(() => {
      gsap.timeline()
        .to(islandText, { opacity: 0, duration: 0.2 })
        .to(islandEl, { width: "120px", height: "36px", duration: 0.3, ease: "power2.in" });
    }, delay);
  }

  // ─── CURSOR ────────────────────────────────────────────────────────────────
  let idleTimer: any = null;
  let longIdleTimer: any = null;
  let trailTimer: any = null;
  let isCursorPulsing = false;

  document.addEventListener("mousemove", (e) => {
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;

    clearTimeout(idleTimer);
    clearTimeout(longIdleTimer);
    if (isCursorPulsing) {
      gsap.killTweensOf(cursorDot);
      gsap.to(cursorDot, { width: "6px", height: "6px", duration: 0.2 });
      isCursorPulsing = false;
    }

    idleTimer = setTimeout(() => {
      isCursorPulsing = true;
      gsap.to(cursorDot, { width: "10px", height: "10px", duration: 1, yoyo: true, repeat: -1, ease: "sine.inOut" });
    }, 3000);

    longIdleTimer = setTimeout(() => {
      if (state.phase === "survival" || state.phase === "scroll") showIsland("still here?", 160);
    }, 30000);
  });

  function runCursor() {
    requestAnimationFrame(runCursor);

    if (state.cursorGravity) {
      const tx = state.gravityTarget.x + (state.mouseX - state.gravityTarget.x) * 0.25;
      const ty = state.gravityTarget.y + (state.mouseY - state.gravityTarget.y) * 0.25;
      state.cursorX += (tx - state.cursorX) * 0.15;
      state.cursorY += (ty - state.cursorY) * 0.15;
    } else if (state.cursorTremor) {
      const tx = state.mouseX + (Math.random()-0.5) * 6;
      const ty = state.mouseY + (Math.random()-0.5) * 6;
      state.cursorX += (tx - state.cursorX) * 0.35;
      state.cursorY += (ty - state.cursorY) * 0.35;
    } else {
      state.cursorX += (state.mouseX - state.cursorX) * 0.12;
      state.cursorY += (state.mouseY - state.cursorY) * 0.12;
    }

    cursorDot.style.left = state.cursorX + "px";
    cursorDot.style.top = state.cursorY + "px";

    // Trail during destruction
    if (state.phase === "destruction" && !trailTimer) {
      trailTimer = setInterval(() => {
        const g = document.createElement("div");
        g.style.cssText = `position:fixed;left:${state.cursorX}px;top:${state.cursorY}px;width:6px;height:6px;background:#fff;border-radius:50%;pointer-events:none;z-index:9998;opacity:0.3;transform:translate(-50%,-50%);`;
        document.body.appendChild(g);
        gsap.to(g, { opacity: 0, duration: 0.6, onComplete: () => g.remove() });
      }, 50);
    } else if (state.phase !== "destruction" && trailTimer) {
      clearInterval(trailTimer);
      trailTimer = null;
    }
  }
  runCursor();

  // ─── HINT ──────────────────────────────────────────────────────────────────
  hintBtn.addEventListener("click", () => {
    state.hintVisible = !state.hintVisible;
    hintPanel.classList.toggle("visible", state.hintVisible);
  });
  document.addEventListener("click", (e) => {
    if (!hintPanel.contains(e.target as Node) && e.target !== hintBtn) {
      state.hintVisible = false;
      hintPanel.classList.remove("visible");
    }
  });

  // ─── RESIZE ────────────────────────────────────────────────────────────────
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ─── MAIN RENDER LOOP ──────────────────────────────────────────────────────
  let time = 0;
  function render() {
    requestAnimationFrame(render);
    time += 0.01;

    bgShapes.forEach((s) => {
      s.mesh.rotation.x += s.rx;
      s.mesh.rotation.y += s.ry;
      s.mesh.rotation.z += s.rz;
    });

    if (mainObj) {
      mainObj.rotation.y += 0.004;
      mainObj.rotation.x = Math.sin(time * 0.18) * 0.06;
    }

    orbiters.forEach((o) => {
      o.angle += o.speed;
      o.mesh.position.x = Math.cos(o.angle) * o.radius;
      o.mesh.position.y = Math.sin(o.angle) * o.radius;
      o.mesh.rotation.x += 0.008;
      o.mesh.rotation.y += 0.012;
    });

    // Wide camera arc in survival
    if (state.phase === "survival" || state.phase === "rebuilding") {
      camera.position.x = Math.sin(time * 0.04) * 0.28;
      camera.position.y = Math.cos(time * 0.028) * 0.14;
    }

    // Gravity target tracks main dot position on screen
    if (mainDot && state.phase === "revival") {
      state.gravityTarget.x = window.innerWidth/2 + mainDot.x * 95;
      state.gravityTarget.y = window.innerHeight/2 - mainDot.y * 95;
    }

    renderer.render(scene, camera);
  }
  render();
}
