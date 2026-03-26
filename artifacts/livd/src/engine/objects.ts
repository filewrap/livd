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

// ─── Background Shape Factory ─────────────────────────────────────────────
export interface BgObject {
  mesh: THREE.Mesh;
  rotVel: THREE.Vector3;
  basePos: THREE.Vector3;
  crackMorph: number;  // 0–1
}

export function createBgObjects(): BgObject[] {
  const configs: {
    geo: THREE.BufferGeometry;
    pos: [number, number, number];
  }[] = [
    { geo: new THREE.IcosahedronGeometry(0.65, 1), pos: [-3.8, 0.8, -4.5] },
    { geo: new THREE.OctahedronGeometry(0.80, 1),  pos: [ 3.5,-0.6, -5.0] },
    { geo: new THREE.DodecahedronGeometry(0.60, 0),pos: [-3.2,-1.5, -4.0] },
    { geo: new THREE.IcosahedronGeometry(0.50, 1), pos: [ 3.8, 1.8, -5.5] },
  ];

  return configs.map(({ geo, pos }) => {
    const mat = deepMaterial(0x0e0e0e);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return {
      mesh,
      rotVel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.004,
        (Math.random() - 0.5) * 0.004,
        (Math.random() - 0.5) * 0.003,
      ),
      basePos: new THREE.Vector3(...pos),
      crackMorph: 0,
    };
  });
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
  () => new THREE.IcosahedronGeometry(0.26, 1),
  () => new THREE.TorusGeometry(0.22, 0.09, 10, 14),
  () => new THREE.BoxGeometry(0.35, 0.35, 0.35),
  () => new THREE.OctahedronGeometry(0.28, 1),
];

export function createEnemy(spawnSide: number): EnemyObject {
  const geo = _enemyGeos[Math.floor(Math.random() * _enemyGeos.length)]();
  const mat = deepMaterial(0x111111);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

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
  () => new THREE.SphereGeometry(0.08, 10, 10),
  () => new THREE.OctahedronGeometry(0.10, 1),
  () => new THREE.BoxGeometry(0.12, 0.12, 0.12),
  () => new THREE.TetrahedronGeometry(0.11, 0),
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
  mesh.castShadow = true;
  return {
    mesh,
    angle: (index / total) * Math.PI * 2,
    radius: 1.5 + Math.random() * 0.7,
    speed: 0.0025 + Math.random() * 0.003,
    tiltX: (Math.random() - 0.5) * 0.6,
    tiltZ: (Math.random() - 0.5) * 0.4,
  };
}
