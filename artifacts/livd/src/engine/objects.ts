import * as THREE from "three";

// ─── Material Factory ─────────────────────────────────────────────────────

export function metalMaterial(color: number, roughness = 0.25, metalness = 0.85): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    reflectivity: 0.7,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
  });
}

export function deepMaterial(color: number, roughness = 0.88, metalness = 0.05): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color, roughness, metalness });
}

export function glowMaterial(color: number, emissive: number, intensity = 0.25): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.5,
    metalness: 0.6,
    reflectivity: 0.5,
  });
}

// ─── Galaxy Particle System ────────────────────────────────────────────────
export interface Galaxy {
  points: THREE.Points;
  starCore: THREE.Mesh;
  coreLight: THREE.PointLight;
}

export function createGalaxy(): Galaxy {
  const N = 2200;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const ARMS = 3;

  for (let i = 0; i < N; i++) {
    const arm = Math.floor(Math.random() * ARMS);
    const armOffset = (arm / ARMS) * Math.PI * 2;
    const t = Math.pow(Math.random(), 0.65); // bias toward center
    const radius = t * 5.2;
    const spinAngle = radius * 2.0 + armOffset;
    const scatter = (0.9 - t * 0.55) * (Math.random() - 0.5) * 1.1;

    pos[i * 3]     = Math.cos(spinAngle) * radius + scatter;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 0.38 * (1 - t * 0.55);
    pos[i * 3 + 2] = Math.sin(spinAngle) * radius + scatter;

    const brightness = 0.035 + (1 - t) * 0.13 + Math.random() * 0.055;
    const blueShift = 0.85 + Math.random() * 0.15;
    col[i * 3]     = brightness * 0.72;
    col[i * 3 + 1] = brightness * 0.86;
    col[i * 3 + 2] = brightness * blueShift;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.038,
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.position.set(0, -0.4, -7.5);
  points.rotation.x = Math.PI * 0.1;

  // Central star core
  const coreGeo = new THREE.SphereGeometry(0.10, 12, 12);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0x99bbff,
    emissive: 0x2244cc,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.75,
  });
  const starCore = new THREE.Mesh(coreGeo, coreMat);
  starCore.position.set(0, -0.4, -7.5);

  // Point light from core
  const coreLight = new THREE.PointLight(0x5577ff, 0.45, 8);
  coreLight.position.set(0, -0.4, -7.5);

  return { points, starCore, coreLight };
}

// ─── Enemy Object Factory ──────────────────────────────────────────────────
export interface EnemyObject {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  isEnemy: boolean;
  alive: boolean;
  spawnedAt: number;
}

const _enemyGeos = [
  () => new THREE.IcosahedronGeometry(0.24, 1),
  () => new THREE.TorusGeometry(0.20, 0.08, 8, 12),
  () => new THREE.BoxGeometry(0.30, 0.30, 0.30),
  () => new THREE.OctahedronGeometry(0.26, 1),
];

export function createEnemy(spawnSide: number): EnemyObject {
  const geo = _enemyGeos[Math.floor(Math.random() * _enemyGeos.length)]();
  const mat = deepMaterial(0x111111);
  const mesh = new THREE.Mesh(geo, mat);

  const spread = 3.5;
  switch (spawnSide % 4) {
    case 0: mesh.position.set((Math.random() - 0.5) * spread, 3.5, 0); break;
    case 1: mesh.position.set((Math.random() - 0.5) * spread, -3.5, 0); break;
    case 2: mesh.position.set(-5.5, (Math.random() - 0.5) * spread, 0); break;
    case 3: mesh.position.set(5.5, (Math.random() - 0.5) * spread, 0); break;
  }

  return {
    mesh,
    vx: -mesh.position.x * 0.007,
    vy: -mesh.position.y * 0.007,
    vz: 0,
    isEnemy: false,
    alive: true,
    spawnedAt: Date.now(),
  };
}

// ─── Orbiter Factory ───────────────────────────────────────────────────────
export interface Orbiter {
  mesh: THREE.Mesh;
  angle: number;
  radius: number;
  speed: number;
  tiltX: number;
  tiltZ: number;
}

const _orbiterGeos = [
  () => new THREE.SphereGeometry(0.07, 8, 8),
  () => new THREE.OctahedronGeometry(0.09, 0),
  () => new THREE.BoxGeometry(0.10, 0.10, 0.10),
  () => new THREE.TetrahedronGeometry(0.10, 0),
];

export function createOrbiter(index: number, total: number): Orbiter {
  const geo = _orbiterGeos[index % _orbiterGeos.length]();
  const br = 0.25 + Math.random() * 0.25;
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(br, br, br),
    roughness: 0.6,
    metalness: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh,
    angle: (index / total) * Math.PI * 2,
    radius: 1.4 + Math.random() * 0.8,
    speed: 0.0022 + Math.random() * 0.003,
    tiltX: (Math.random() - 0.5) * 0.7,
    tiltZ: (Math.random() - 0.5) * 0.4,
  };
}
