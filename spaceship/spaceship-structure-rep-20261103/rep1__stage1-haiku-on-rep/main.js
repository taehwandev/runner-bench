import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---- Scene tuning ---------------------------------------------------------
const TAU = Math.PI * 2;
const PAD_RADIUS = 4.5;
const HOVER_HEIGHT = 3.2;
const ORBIT_RADIUS = 9;
const LAP_SECONDS = 16; // one slow lap around the pad
const TAKEOFF_SECONDS = 2.5; // ease from the pad out to the orbit ring
const LAP_SPEED = (ORBIT_RADIUS * TAU) / LAP_SECONDS;
const LAP_BANK = -0.3; // lean into the turn (radians)
const DEPART_GROWTH = 0.55; // exponential acceleration after the lap
const MAX_SPEED = 95;
const DEPART_HEADING = new THREE.Vector3(0.22, 0.42, -1).normalize();
const DEPART_DONE_SECONDS = 14; // after this the UI offers Replay
const HOME_TARGET = new THREE.Vector3(0, 2.4, 0);
const HOME_OFFSET = new THREE.Vector3(-11, 4.5, 15);
const SKY_COLOR = new THREE.Color('#bfe2ff');

// ---- Helpers --------------------------------------------------------------
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const smoothstep = (x, a, b) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const isNarrow = () => window.innerWidth / window.innerHeight < 0.9;

// Small seeded PRNG so the scenery is identical on every load
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shared by the ground mesh and everything placed on it, so props stay planted.
// Flat around the pad, rolling hills further out.
function terrainHeight(x, z) {
  const bumps = Math.sin(x * 0.021) * 2.2 + Math.cos(z * 0.017 + 1.3) * 2.0 + Math.sin((x + z) * 0.05) * 0.8;
  return bumps * smoothstep(Math.hypot(x, z), 18, 40);
}

function makeTexture(size, draw, repeat = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.setScalar(repeat);
  tex.anisotropy = 8;
  return tex;
}

// ---- Renderer, scene, camera, controls ------------------------------------
const canvas = document.getElementById('scene');
const statusEl = document.getElementById('status');
const compact = window.matchMedia('(max-width: 700px)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (err) {
  statusEl.textContent = 'WebGL is not available in this browser.';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
// Haze fades the far scenery toward the horizon colour, which keeps the sky seamless
scene.fog = new THREE.Fog(SKY_COLOR, 110, 900);

const camera = new THREE.PerspectiveCamera(48, 1, 0.2, 5000);
camera.position.copy(HOME_TARGET).addScaledVector(HOME_OFFSET, 1);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.9;
controls.minDistance = 3.5;
controls.maxDistance = 140;
controls.maxPolarAngle = Math.PI * 0.48; // keep the camera above the ground
controls.update();

// ---- Lighting and sky -----------------------------------------------------
scene.add(new THREE.HemisphereLight('#e4f3ff', '#6d8f52', 1.3));

const sun = new THREE.DirectionalLight('#fff0d4', 2.6);
sun.position.set(-30, 60, 25);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(compact ? 1024 : 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -22;
sun.shadow.camera.right = sun.shadow.camera.top = 22;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 160;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);

// The sky follows the camera so it never ends, even after the ship is very far away
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(3000, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color('#2f7fd8') },
      horizon: { value: SKY_COLOR },
      sunDir: { value: sun.position.clone().normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, zenith, pow(h, 0.55));
        float s = max(dot(vDir, normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 2.0 + pow(s, 12.0) * 0.12);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
);
sky.frustumCulled = false;
scene.add(sky);

// ---- Ground ---------------------------------------------------------------
const grassTex = makeTexture(
  256,
  (g, s) => {
    const r = rng(3);
    g.fillStyle = '#5f9b4a';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `hsla(${95 + r() * 30}, ${45 + r() * 25}%, ${28 + r() * 22}%, 0.55)`;
      g.fillRect(r() * s, r() * s, 2 + r() * 2, 2 + r() * 2);
    }
  },
  200
);

function buildGround() {
  const geo = new THREE.PlaneGeometry(2600, 2600, 200, 200).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);
}

// ---- Landing pad and control hut -----------------------------------------
const padTex = makeTexture(1024, (g, s) => {
  const c = s / 2;
  const r = rng(11);
  g.fillStyle = '#a3a9b2';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '60,64,70' : '235,238,242'}, ${0.05 + r() * 0.08})`;
    g.fillRect(r() * s, r() * s, 3, 3);
  }
  // Hazard ring
  g.lineWidth = 28;
  g.strokeStyle = '#f5c542';
  g.setLineDash([60, 40]);
  g.beginPath();
  g.arc(c, c, c - 30, 0, TAU);
  g.stroke();
  g.setLineDash([]);
  // Inner ring
  g.lineWidth = 10;
  g.strokeStyle = '#e8ecf2';
  g.beginPath();
  g.arc(c, c, c * 0.72, 0, TAU);
  g.stroke();
  // H marking
  g.fillStyle = '#f4f6f9';
  g.fillRect(c - 130, c - 170, 46, 340);
  g.fillRect(c + 84, c - 170, 46, 340);
  g.fillRect(c - 84, c - 23, 168, 46);
});

function buildPad() {
  const concrete = new THREE.MeshStandardMaterial({ color: '#a7adb6', roughness: 0.9 });
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(PAD_RADIUS + 0.35, PAD_RADIUS + 0.6, 0.35, 96),
    concrete
  );
  base.position.y = 0.17;
  base.receiveShadow = true;
  scene.add(base);

  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(PAD_RADIUS, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.85 })
  );
  surface.position.y = 0.36;
  surface.receiveShadow = true;
  scene.add(surface);

  // Ring of amber guide lights
  const lampGeo = new THREE.SphereGeometry(0.12, 12, 8);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(Math.cos(a) * (PAD_RADIUS - 0.2), 0.45, Math.sin(a) * (PAD_RADIUS - 0.2));
    scene.add(lamp);
  }

  // Small control hut off to the side
  const hut = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.2, 2.4),
    new THREE.MeshStandardMaterial({ color: '#e7ebf0', roughness: 0.6 })
  );
  wall.position.y = 1.1;
  wall.castShadow = wall.receiveShadow = true;
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.2, 2.8),
    new THREE.MeshStandardMaterial({ color: '#2f3d55', roughness: 0.7 })
  );
  roof.position.y = 2.3;
  roof.castShadow = true;
  const pane = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.9, 0.05),
    new THREE.MeshStandardMaterial({ color: '#7fd4ff', emissive: '#2a7aa8', roughness: 0.2 })
  );
  pane.position.set(0, 1.3, 1.22);
  hut.add(wall, roof, pane);
  hut.position.set(-14, terrainHeight(-14, -10), -10);
  hut.rotation.y = 0.5;
  scene.add(hut);
}

// ---- Scenery: forest, bushes, mountains, clouds ---------------------------
function buildForest(treeCount, bushCount) {
  const r = rng(42);
  const up = new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const tint = new THREE.Color();

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.22, 1.5, 6).translate(0, 0.75, 0),
    new THREE.MeshStandardMaterial({ color: '#6e4b2e', roughness: 1 }),
    treeCount
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.3, 3.0, 7).translate(0, 2.8, 0),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }),
    treeCount
  );
  const bushes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.8, 0),
    new THREE.MeshStandardMaterial({ color: '#4f9a52', roughness: 0.95, flatShading: true }),
    bushCount
  );

  // Scatter props on a ring beyond the pad, kept clear of the orbit path
  const placeAt = (index, minD, maxD, scaleMin, scaleMax, lift) => {
    const a = r() * TAU;
    const d = minD + r() * (maxD - minD);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    p.set(x, terrainHeight(x, z) + lift, z);
    q.setFromAxisAngle(up, r() * TAU);
    s.setScalar(scaleMin + r() * (scaleMax - scaleMin));
    return m.compose(p, q, s);
  };

  for (let i = 0; i < treeCount; i++) {
    const matrix = placeAt(i, 24, 260, 0.7, 1.6, 0);
    trunks.setMatrixAt(i, matrix);
    crowns.setMatrixAt(i, matrix);
    tint.setHSL(0.27 + r() * 0.05, 0.45, 0.26 + r() * 0.1);
    crowns.setColorAt(i, tint);
  }
  for (let i = 0; i < bushCount; i++) {
    bushes.setMatrixAt(i, placeAt(i, 18, 200, 0.6, 1.4, 0.3));
    tint.setHSL(0.25 + r() * 0.08, 0.5, 0.3 + r() * 0.1);
    bushes.setColorAt(i, tint);
  }

  for (const mesh of [trunks, crowns, bushes]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }
}

function buildMountains() {
  const r = rng(99);
  const cone = new THREE.ConeGeometry(1, 1, 7, 1, false).translate(0, 0.5, 0);
  const rock = new THREE.MeshStandardMaterial({ color: '#6f7f96', flatShading: true, roughness: 1 });
  const snow = new THREE.MeshStandardMaterial({ color: '#f4f8ff', flatShading: true, roughness: 0.8 });

  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU + r() * 0.2;
    const dist = 330 + r() * 90;
    const h = 60 + r() * 90;
    const w = h * (0.8 + r() * 0.5);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const base = -10;

    const peak = new THREE.Mesh(cone, rock);
    peak.scale.set(w, h, w);
    peak.position.set(x, base, z);
    scene.add(peak);

    if (h > 90) {
      const cap = new THREE.Mesh(cone, snow);
      cap.scale.set(w * 0.28, h * 0.28, w * 0.28);
      cap.position.set(x, base + h * 0.72, z);
      scene.add(cap);
    }
  }
}

function buildClouds() {
  const r = rng(7);
  const puff = new THREE.SphereGeometry(1, 14, 10);
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#c9dcf0',
    emissiveIntensity: 0.35,
    roughness: 1,
  });

  // Keep clouds out of the departure corridor so the ship is never hidden inside one
  let placed = 0;
  while (placed < 22) {
    const a = r() * TAU;
    const d = 90 + r() * 380;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.abs(x + 0.22 * z) < 80) continue;

    const cloud = new THREE.Group();
    cloud.position.set(x, 60 + r() * 45, z);
    const puffs = 4 + Math.floor(r() * 4);
    for (let p = 0; p < puffs; p++) {
      const rad = 4 + r() * 5;
      const m = new THREE.Mesh(puff, mat);
      m.scale.set(rad * 1.5, rad * 0.8, rad);
      m.position.set((p - puffs / 2) * 4.5 + (r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 4);
      cloud.add(m);
    }
    scene.add(cloud);
    placed++;
  }
}

// ---- Spaceship ------------------------------------------------------------
const glowTex = makeTexture(128, (g, s) => {
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(190,240,255,0.8)');
  grd.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
});

// The ship's nose points along local +Z, so lookAt() aims it along its heading
function buildShip() {
  const ship = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: '#eef2f7', metalness: 0.4, roughness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: '#2b6fe0', metalness: 0.3, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#3a4453', metalness: 0.6, roughness: 0.45 });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: '#8fe0ff',
    roughness: 0.05,
    clearcoat: 1,
    transparent: true,
    opacity: 0.8,
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#7ff3ff',
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // Fuselage: lathe profile around Y, rotated so the nose lies along +Z
  const profile = [
    [0, 1.5],
    [0.16, 1.32],
    [0.4, 0.8],
    [0.5, 0.1],
    [0.48, -0.7],
    [0.36, -1.1],
    [0.18, -1.28],
    [0, -1.32],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const fuselage = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 28).rotateX(Math.PI / 2).scale(1, 0.72, 1),
    hull
  );
  ship.add(fuselage);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 28, 16, 0, TAU, 0, Math.PI / 2), canopyMat);
  canopy.scale.set(0.8, 0.55, 1.5);
  canopy.position.set(0, 0.33, 0.55);
  ship.add(canopy);

  const wingGeo = new THREE.BoxGeometry(1.6, 0.06, 0.9);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, accent);
    wing.position.set(side * 0.95, -0.12, -0.35);
    wing.rotation.y = side * 0.25; // swept back

    // Navigation light at each wingtip (red port, green starboard)
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 8),
      new THREE.MeshBasicMaterial({ color: side < 0 ? '#ff5d5d' : '#5dff9b' })
    );
    tip.position.set(side * 0.8, 0.03, 0);
    wing.add(tip);
    ship.add(wing);
  }

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.7), accent);
  fin.position.set(0, 0.42, -0.95);
  ship.add(fin);

  // Engines: nozzle, glowing flame (base at the nozzle, tip trailing behind)
  const nozzleGeo = new THREE.CylinderGeometry(0.15, 0.19, 0.5, 16).rotateX(Math.PI / 2);
  const flameGeo = new THREE.ConeGeometry(0.13, 0.9, 14, 1, true)
    .translate(0, 0.45, 0)
    .rotateX(-Math.PI / 2);
  const flames = [];
  for (const side of [-1, 1]) {
    const nozzle = new THREE.Mesh(nozzleGeo, dark);
    nozzle.position.set(side * 0.22, -0.16, -1.0);
    ship.add(nozzle);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(side * 0.22, -0.16, -1.22);
    ship.add(flame);
    flames.push(flame);
  }

  // Hover glow and a little cyan light underneath
  const hoverGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: '#6fe7ff',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  hoverGlow.scale.setScalar(2.4);
  hoverGlow.position.set(0, -0.9, 0);
  ship.add(hoverGlow);

  const underLight = new THREE.PointLight('#7fe9ff', 6, 10, 2);
  underLight.position.set(0, -1.0, 0);
  ship.add(underLight);

  ship.traverse((o) => {
    if (o.isMesh && !o.material.transparent) o.castShadow = true;
  });
  ship.scale.setScalar(0.9);
  scene.add(ship);
  return { ship, flames };
}

const { ship, flames } = buildShip();

// Exhaust sparks
const PARTICLES = 120;
const EXHAUST_RATE = 70; // particles per second
const exhaustPos = new Float32Array(PARTICLES * 3).fill(1e6); // parked far away until used
const exhaustVel = new Float32Array(PARTICLES * 3);
const exhaustLife = new Float32Array(PARTICLES);
const exhaustGeo = new THREE.BufferGeometry();
exhaustGeo.setAttribute('position', new THREE.BufferAttribute(exhaustPos, 3));
const exhaust = new THREE.Points(
  exhaustGeo,
  new THREE.PointsMaterial({
    map: glowTex,
    color: '#a6f3ff',
    size: 0.6,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
exhaust.frustumCulled = false;
scene.add(exhaust);

// Ship path trail: a ring buffer of recent positions
const TRAIL_POINTS = 220;
const TRAIL_INTERVAL = 0.08;
const trailPositions = new Float32Array(TRAIL_POINTS * 3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
trailGeo.setDrawRange(0, 0);
const trail = new THREE.Line(
  trailGeo,
  new THREE.LineBasicMaterial({ color: '#8ff0ff', transparent: true, opacity: 0.6 })
);
trail.frustumCulled = false;
scene.add(trail);

buildGround();
buildPad();
buildForest(180, 120);
buildMountains();
buildClouds();

// ---- Ship state machine: hover -> lap -> depart ---------------------------
const shipState = {
  phase: 'hover',
  phaseT: 0,
  pos: new THREE.Vector3(0, HOVER_HEIGHT, 0),
  heading: new THREE.Vector3(0, 0, -1),
  speed: 0,
  bank: 0,
};

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
let elapsed = 0;

function updateShip(dt) {
  const s = shipState;
  const before = tmpA.copy(s.pos);
  s.phaseT += dt;
  let lean = 0;

  if (s.phase === 'hover') {
    s.pos.set(0, HOVER_HEIGHT + Math.sin(elapsed * 1.6) * 0.12, 0);
    s.speed = 0;
  } else if (s.phase === 'lap') {
    const k = clamp01(s.phaseT / LAP_SECONDS);
    const angle = k * TAU;
    const r = ORBIT_RADIUS * smoothstep(s.phaseT, 0, TAKEOFF_SECONDS);
    s.pos.set(r * Math.cos(angle), HOVER_HEIGHT + 0.9 * Math.sin(k * Math.PI), -r * Math.sin(angle));
    s.speed = LAP_SPEED;
    lean = LAP_BANK;

    tmpB.subVectors(s.pos, before);
    if (tmpB.lengthSq() > 1e-8) s.heading.lerp(tmpB.normalize(), 1 - Math.exp(-10 * dt)).normalize();

    if (k >= 1) {
      s.phase = 'depart';
      s.phaseT = 0;
    }
  } else {
    // Continue from the lap's tangent (-Z) and accelerate away, curving upward
    s.speed = Math.min(LAP_SPEED * Math.exp(DEPART_GROWTH * s.phaseT), MAX_SPEED);
    s.heading.lerp(DEPART_HEADING, 1 - Math.exp(-1.2 * dt)).normalize();
    s.pos.addScaledVector(s.heading, s.speed * dt);
  }

  s.bank = THREE.MathUtils.lerp(s.bank, lean, 1 - Math.exp(-2 * dt));
  ship.position.copy(s.pos);
  ship.lookAt(tmpA.copy(s.pos).add(s.heading));
  ship.rotateZ(s.bank);
  ship.updateMatrixWorld(true);

  // Engine flames stretch with throttle and flicker
  const len = s.phase === 'depart' ? 1.4 + 0.5 * clamp01(s.speed / MAX_SPEED) : s.phase === 'lap' ? 1.1 : 0.8;
  for (const f of flames) {
    f.scale.set(1, 1, len * (1 + 0.08 * Math.sin(elapsed * 45)));
  }
}

let exhaustAcc = 0;
let exhaustCursor = 0;

function updateExhaust(dt) {
  const s = shipState;
  const emit = new THREE.Vector3();
  const vel = new THREE.Vector3();

  exhaustAcc += dt * EXHAUST_RATE;
  while (exhaustAcc >= 1) {
    exhaustAcc -= 1;
    const i = exhaustCursor;
    exhaustCursor = (exhaustCursor + 1) % PARTICLES;
    emit.set((Math.random() - 0.5) * 0.4, -0.15, -1.3);
    ship.localToWorld(emit);
    exhaustPos.set([emit.x, emit.y, emit.z], i * 3);

    vel.copy(s.heading).multiplyScalar(-0.2 * s.speed);
    vel.y -= 1.0; // exhaust always drifts down a little
    exhaustVel.set(
      [
        vel.x + (Math.random() - 0.5) * 0.6,
        vel.y + (Math.random() - 0.5) * 0.6,
        vel.z + (Math.random() - 0.5) * 0.6,
      ],
      i * 3
    );
    exhaustLife[i] = 0.8 + Math.random() * 0.4;
  }

  for (let i = 0; i < PARTICLES; i++) {
    if (exhaustLife[i] <= 0) continue;
    exhaustLife[i] -= dt;
    const o = i * 3;
    if (exhaustLife[i] <= 0) {
      exhaustPos[o] = exhaustPos[o + 1] = exhaustPos[o + 2] = 1e6;
      continue;
    }
    exhaustPos[o] += exhaustVel[o] * dt;
    exhaustPos[o + 1] += exhaustVel[o + 1] * dt;
    exhaustPos[o + 2] += exhaustVel[o + 2] * dt;
  }
  exhaustGeo.attributes.position.needsUpdate = true;
}

let trailCount = 0;
let trailTimer = 0;

function updateTrail(dt) {
  if (shipState.phase === 'hover') return;
  trailTimer += dt;
  if (trailTimer < TRAIL_INTERVAL) return;
  trailTimer = 0;

  if (trailCount === TRAIL_POINTS) trailPositions.copyWithin(0, 3);
  else trailCount++;
  const i = (trailCount - 1) * 3;
  const p = shipState.pos;
  trailPositions[i] = p.x;
  trailPositions[i + 1] = p.y;
  trailPositions[i + 2] = p.z;
  trailGeo.setDrawRange(0, trailCount);
  trailGeo.attributes.position.needsUpdate = true;
}

function resetScene() {
  Object.assign(shipState, { phase: 'hover', phaseT: 0, speed: 0, bank: 0 });
  shipState.pos.set(0, HOVER_HEIGHT, 0);
  shipState.heading.set(0, 0, -1);
  trailCount = 0;
  trailGeo.setDrawRange(0, 0);
  exhaustLife.fill(0);
  exhaustPos.fill(1e6);
  exhaustGeo.attributes.position.needsUpdate = true;
}

// ---- Camera: follow, reset tween, zoom ------------------------------------
const followBtn = document.getElementById('follow');
let followOn = false;
let followAmt = 0; // eases 0 -> 1 so turning follow on never snaps the view
let tween = null;
const shift = new THREE.Vector3();

function setFollow(on) {
  followOn = on;
  controls.enablePan = !on; // panning would fight the follow lock
  followBtn.setAttribute('aria-pressed', String(on));
  followBtn.textContent = on ? 'Following' : 'Follow';
}

function homeCameraPosition() {
  return HOME_TARGET.clone().addScaledVector(HOME_OFFSET, isNarrow() ? 1.5 : 1);
}

function resetCamera() {
  setFollow(false);
  followAmt = 0;
  tween = {
    t: 0,
    duration: 1.1,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: homeCameraPosition(),
    toTarget: HOME_TARGET.clone(),
  };
}

// Moves the camera and its orbit target together, so the user's angle and zoom are kept
function updateCamera(dt) {
  if (tween) {
    tween.t += dt;
    const k = easeInOutCubic(clamp01(tween.t / tween.duration));
    camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
    if (tween.t >= tween.duration) tween = null;
    return;
  }

  followAmt = THREE.MathUtils.lerp(followAmt, followOn ? 1 : 0, 1 - Math.exp(-4 * dt));
  if (followAmt > 0.0005) {
    shift.subVectors(ship.position, controls.target).multiplyScalar(followAmt);
    camera.position.add(shift);
    controls.target.add(shift);
  }
}

function zoomBy(factor) {
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
  const dist = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).addScaledVector(offset.normalize(), dist);
}

// Any manual orbit or zoom cancels an in-progress reset
controls.addEventListener('start', () => {
  tween = null;
});

// ---- Actions and UI -------------------------------------------------------
const launchBtn = document.getElementById('launch');
const progressEl = document.getElementById('progress-bar');
let shownStatus = '';
let shownLabel = '';

function replay() {
  resetScene();
  resetCamera();
}

function launch() {
  const s = shipState;
  if (s.phase === 'hover') {
    s.phase = 'lap';
    s.phaseT = 0;
    setFollow(true);
  } else if (s.phase === 'depart' && s.phaseT >= DEPART_DONE_SECONDS) {
    replay();
  }
}

function refreshUI() {
  const s = shipState;
  let text;
  let label = 'Launch';
  let busy = false;
  let progress = 0;

  if (s.phase === 'hover') {
    text = 'Hovering over the pad';
  } else if (s.phase === 'lap') {
    progress = clamp01(s.phaseT / LAP_SECONDS);
    text = `Circling the pad · ${Math.round(progress * 100)}%`;
    label = 'Departing…';
    busy = true;
  } else if (s.phaseT < DEPART_DONE_SECONDS) {
    text = s.phaseT < 2 ? 'Lifting away' : 'Departing';
    label = 'Departing…';
    busy = true;
    progress = 1;
  } else {
    text = 'Departed · replay to start over';
    label = 'Replay';
    progress = 1;
  }

  if (text !== shownStatus) {
    statusEl.textContent = text;
    shownStatus = text;
  }
  if (label !== shownLabel) {
    launchBtn.textContent = label;
    shownLabel = label;
  }
  launchBtn.disabled = busy;
  progressEl.style.width = `${(progress * 100).toFixed(1)}%`;
}

launchBtn.addEventListener('click', launch);
followBtn.addEventListener('click', () => setFollow(!followOn));
document.getElementById('reset').addEventListener('click', resetCamera);
document.getElementById('zoom-in').addEventListener('click', () => zoomBy(0.8));
document.getElementById('zoom-out').addEventListener('click', () => zoomBy(1.25));

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const onButton = e.target instanceof HTMLButtonElement;
  if (e.code === 'Space' && !onButton) {
    e.preventDefault();
    launch();
    return;
  }
  switch (e.key.toLowerCase()) {
    case 'r':
      resetCamera();
      break;
    case 'f':
      setFollow(!followOn);
      break;
    case '+':
    case '=':
      zoomBy(0.8);
      break;
    case '-':
    case '_':
      zoomBy(1.25);
      break;
  }
});

// ---- Sizing and loop ------------------------------------------------------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.9 ? 62 : 48; // wider vertical FOV on portrait screens
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  updateShip(dt);
  updateExhaust(dt);
  updateTrail(dt);
  updateCamera(dt);
  controls.update();
  sky.position.copy(camera.position);
  refreshUI();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(frame);
