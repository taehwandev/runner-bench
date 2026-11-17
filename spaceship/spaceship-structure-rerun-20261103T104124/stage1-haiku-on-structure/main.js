import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ---------- Tunables ---------- */
const PAD_RADIUS = 7;
const HOVER_HEIGHT = 3.2;
const LAP_RADIUS = 10;
const LAP_TIME = 14;          // seconds for one slow lap around the pad
const SPOOL_TIME = 3;         // seconds to drift from the pad out to lap radius
const DEPART_TIME = 6;        // seconds to accelerate from lap speed to cruise
const CRUISE_SPEED = 55;
const TWO_PI = Math.PI * 2;
const LAP_SPEED = (TWO_PI * LAP_RADIUS) / LAP_TIME;
const DEPART_DIR = new THREE.Vector3(0.25, 0.22, 1).normalize();
const FOCUS_HOME = new THREE.Vector3(0, 1.5, 0);
const CAMERA_OFFSET = new THREE.Vector3(0, 5, 15);
const RESET_RATE = 8;         // higher = snappier reset glide
const RESET_TIME = 1.0;       // seconds the reset glide runs before it stops

const ease = (x) => x * x * (3 - 2 * x);

/* ---------- Renderer, camera, controls ---------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#cfe8ff');
scene.fog = new THREE.Fog(HORIZON, 160, 950);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
camera.position.copy(FOCUS_HOME).add(CAMERA_OFFSET);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(FOCUS_HOME);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false; // panning would fight the follow camera
controls.rotateSpeed = 0.7;
controls.minDistance = 4;
controls.maxDistance = 260;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();

/* ---------- Sky and lighting ---------- */
const SUN_DIR = new THREE.Vector3(70, 120, 50).normalize();

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1800, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#2b6cd4') },
      horizon: { value: HORIZON },
      sunDir: { value: SUN_DIR },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        float s = max(dot(vDir, normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.93, 0.75) * (pow(s, 600.0) * 1.5 + pow(s, 6.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
sky.renderOrder = -1;
scene.add(sky);

const sun = new THREE.DirectionalLight('#fff3dc', 2.6);
sun.position.copy(SUN_DIR).multiplyScalar(120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 300 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);

scene.add(new THREE.HemisphereLight('#bfe6ff', '#6b8f4e', 1.1));

/* ---------- Seeded random so the scenery is the same on every load ---------- */
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const between = (a, b) => a + (b - a) * rand();

/* ---------- Ground with gentle hills; flat around the pad ---------- */
function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const hills =
    3.2 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.024) +
    2.2 * Math.sin(x * 0.047 - z * 0.033 + 2.1) +
    1.2 * Math.cos(z * 0.09 + x * 0.05);
  return hills * THREE.MathUtils.smoothstep(r, 22, 90);
}

const groundGeo = new THREE.PlaneGeometry(2400, 2400, 240, 240);
groundGeo.rotateX(-Math.PI / 2);
const groundPos = groundGeo.attributes.position;
for (let i = 0; i < groundPos.count; i++) {
  groundPos.setY(i, groundHeight(groundPos.getX(i), groundPos.getZ(i)));
}
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(
  groundGeo,
  new THREE.MeshStandardMaterial({ color: '#8dc264', roughness: 1 })
);
ground.receiveShadow = true;
scene.add(ground);

/* ---------- Trees ---------- */
const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6).translate(0, 0.8, 0);
const crownGeo = new THREE.ConeGeometry(1.4, 3.2, 7).translate(0, 2.8, 0);
const crownTopGeo = new THREE.ConeGeometry(1.0, 2.4, 7).translate(0, 4.4, 0);
const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 });
const leafMats = ['#3f8f4a', '#2f7a3d', '#58a85a'].map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true })
);

for (let i = 0; i < 110; i++) {
  const angle = rand() * TWO_PI;
  const dist = between(24, 170);
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  const leaf = leafMats[Math.floor(rand() * leafMats.length)];
  const tree = new THREE.Group();
  tree.add(
    new THREE.Mesh(trunkGeo, trunkMat),
    new THREE.Mesh(crownGeo, leaf),
    new THREE.Mesh(crownTopGeo, leaf)
  );
  tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  tree.position.set(x, groundHeight(x, z), z);
  tree.scale.setScalar(between(0.8, 1.5));
  tree.rotation.y = rand() * TWO_PI;
  scene.add(tree);
}

/* ---------- Distant mountain ring ---------- */
const mountainMats = ['#6f8fa8', '#7d9a7a', '#8a9bb0'].map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true })
);
for (let i = 0; i < 26; i++) {
  const angle = (i / 26) * TWO_PI + between(-0.1, 0.1);
  const dist = between(430, 560);
  const height = between(70, 150);
  const mountain = new THREE.Mesh(
    new THREE.ConeGeometry(height * between(0.6, 0.9), height, 7),
    mountainMats[i % mountainMats.length]
  );
  mountain.position.set(Math.cos(angle) * dist, height / 2 - 4, Math.sin(angle) * dist);
  scene.add(mountain);
}

/* ---------- Clouds (drift slowly) ---------- */
const cloudMat = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  roughness: 1,
  emissive: '#ffffff',
  emissiveIntensity: 0.12,
});
const cloudGeo = new THREE.SphereGeometry(1, 16, 12);
const clouds = [];
for (let i = 0; i < 14; i++) {
  const cloud = new THREE.Group();
  const puffs = 4 + Math.floor(rand() * 3);
  for (let j = 0; j < puffs; j++) {
    const puff = new THREE.Mesh(cloudGeo, cloudMat);
    puff.position.set(between(-3, 3), between(-0.6, 0.6), between(-1.5, 1.5));
    puff.scale.set(between(2, 3.5), between(1, 1.6), between(2, 3));
    cloud.add(puff);
  }
  const angle = rand() * TWO_PI;
  const dist = between(60, 350);
  cloud.position.set(Math.cos(angle) * dist, between(55, 95), Math.sin(angle) * dist);
  cloud.userData.speed = between(0.6, 1.4);
  scene.add(cloud);
  clouds.push(cloud);
}

/* ---------- Landing pad ---------- */
function makePadTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#c9ced6';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#f2b531';
  g.lineWidth = 22;
  g.beginPath();
  g.arc(size / 2, size / 2, 220, 0, TWO_PI);
  g.stroke();
  g.fillStyle = '#f2b531';
  g.font = 'bold 260px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('H', size / 2, size / 2 + 12);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function buildPad() {
  const pad = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS + 0.4, 0.8, 64),
    new THREE.MeshStandardMaterial({ color: '#b7bec7', roughness: 0.85 })
  );
  base.position.y = 0.4;
  base.castShadow = true;
  base.receiveShadow = true;

  const top = new THREE.Mesh(
    new THREE.CircleGeometry(PAD_RADIUS - 0.5, 64),
    new THREE.MeshStandardMaterial({ map: makePadTexture(), roughness: 0.8 })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.81;
  top.receiveShadow = true;

  const lampGeo = new THREE.SphereGeometry(0.22, 12, 8);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TWO_PI;
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(Math.cos(a) * (PAD_RADIUS + 0.1), 0.6, Math.sin(a) * (PAD_RADIUS + 0.1));
    pad.add(lamp);
  }
  pad.add(base, top);
  return pad;
}
scene.add(buildPad());

/* ---------- Spaceship (nose points along +Z) ---------- */
function buildShip() {
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#e9eef5', metalness: 0.35, roughness: 0.3 });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#ff7a2f', metalness: 0.2, roughness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#4fc3ff', metalness: 0.6, roughness: 0.1, emissive: '#0b3b5c', emissiveIntensity: 0.4,
  });

  // Fuselage: lathe around Y, then turned so the nose points along +Z
  const profile = [
    [0, -1.3], [0.4, -1.15], [0.65, -0.7], [0.74, -0.1],
    [0.72, 0.5], [0.5, 1.0], [0.25, 1.25], [0, 1.35],
  ];
  const hullGeo = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 28);
  hullGeo.rotateX(Math.PI / 2);
  ship.add(new THREE.Mesh(hullGeo, hullMat));

  const wingGeo = new THREE.BoxGeometry(1.8, 0.08, 0.9);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, accentMat);
    wing.position.set(side * 1.5, -0.1, -0.35);
    wing.rotation.z = -side * 0.12;
    ship.add(wing);

    const navLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 8),
      new THREE.MeshBasicMaterial({ color: side < 0 ? '#ff3b3b' : '#4cff7a' })
    );
    navLight.position.set(side * 2.4, -0.06, -0.35);
    ship.add(navLight);
  }

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.9), accentMat);
  fin.position.set(0, 0.7, -0.7);
  ship.add(fin);

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 24, 12, 0, TWO_PI, 0, Math.PI / 2),
    glassMat
  );
  cockpit.scale.set(1, 0.6, 1.5);
  cockpit.position.set(0, 0.5, 0.35);
  ship.add(cockpit);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.45, 20), accentMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0, -1.45);
  ship.add(nozzle);

  // Flame points toward -Z (behind the ship); scaled each frame by throttle
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 1.5, 14),
    new THREE.MeshBasicMaterial({
      color: '#ffb45a', transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  flame.geometry.rotateX(-Math.PI / 2);
  flame.position.set(0, 0, -2.43);
  ship.add(flame);

  ship.traverse((o) => { if (o.isMesh && o !== flame) o.castShadow = true; });
  ship.userData.flame = flame;
  return ship;
}

const ship = buildShip();
ship.position.set(0, HOVER_HEIGHT, 0);
scene.add(ship);

/* ---------- Flight state ---------- */
const state = { phase: 'idle', t: 0, speed: 0 };
let followActive = false;
let resetting = false;
let resetTimer = 0;
const shipVelocity = new THREE.Vector3(0, 0, 1);

const launchBtn = document.getElementById('launch');
const statusEl = document.getElementById('status');
const barEl = document.getElementById('bar');

const PHASE_TEXT = {
  idle: 'Hovering above the landing pad',
  lap: 'Making a slow lap around the pad',
  depart: 'Accelerating away',
  cruise: 'Flying off into the distance',
};

function setPhase(phase) {
  state.phase = phase;
  state.t = 0;
  statusEl.textContent = PHASE_TEXT[phase];
}

function launch() {
  if (state.phase !== 'idle') return;
  setPhase('lap');
  followActive = true;
  resetting = false;
  launchBtn.disabled = true;
  launchBtn.textContent = 'Departing…';
}

/* ---------- Ship motion ---------- */
const _tmpV = new THREE.Vector3();
const _next = new THREE.Vector3();

function updateShip(dt, elapsed) {
  const bob = Math.sin(elapsed * 1.6) * 0.1;
  state.t += dt;

  if (state.phase === 'idle') {
    _next.set(0, HOVER_HEIGHT + bob, 0);
    state.speed = 0;
  } else if (state.phase === 'lap') {
    // Drift out from the pad, then circle at constant angular speed
    const angle = TWO_PI * Math.min(state.t / LAP_TIME, 1);
    const radius = LAP_RADIUS * ease(Math.min(state.t / SPOOL_TIME, 1));
    _next.set(Math.cos(angle) * radius, HOVER_HEIGHT + bob, Math.sin(angle) * radius);
    state.speed = LAP_SPEED;
    if (state.t >= LAP_TIME) setPhase('depart');
  } else {
    // Straight-line departure: speed eases up from lap speed to cruise
    const u = Math.min(state.t / DEPART_TIME, 1);
    state.speed = LAP_SPEED + (CRUISE_SPEED - LAP_SPEED) * ease(u);
    _next.copy(ship.position).addScaledVector(DEPART_DIR, state.speed * dt);
    if (state.phase === 'depart' && state.t >= DEPART_TIME) setPhase('cruise');
  }

  // Turn the nose along the direction of travel (smoothed); hover keeps its heading
  if (state.phase !== 'idle' && dt > 0) {
    _tmpV.subVectors(_next, ship.position).divideScalar(dt);
    if (_tmpV.lengthSq() > 0.01) shipVelocity.lerp(_tmpV, 1 - Math.exp(-6 * dt));
  }
  ship.position.copy(_next);
  ship.lookAt(_tmpV.copy(ship.position).add(shipVelocity));

  // Engine flame grows with throttle and flickers
  const throttle =
    state.phase === 'idle' ? 0.25 :
    state.phase === 'lap' ? 0.55 :
    0.6 + 0.4 * (state.speed / CRUISE_SPEED);
  const flicker = 0.9 + 0.1 * Math.sin(elapsed * 45);
  ship.userData.flame.scale.set(throttle, throttle, throttle * flicker);
}

/* ---------- Camera follow and reset ---------- */
const _corr = new THREE.Vector3();
const _move = new THREE.Vector3();

// Move the camera and its target by the ship's per-frame displacement, so the
// user's orbit angle and zoom distance stay as they set them. A small
// correction removes any leftover offset without visible lag.
function followShip(delta, dt) {
  _corr.subVectors(ship.position, controls.target).multiplyScalar(1 - Math.exp(-4 * dt));
  _move.copy(delta).add(_corr);
  controls.target.add(_move);
  camera.position.add(_move);
}

const _goal = new THREE.Vector3();
const _focus = new THREE.Vector3();

function updateReset(dt) {
  resetTimer -= dt;
  if (resetTimer <= 0) {
    resetting = false;
    return;
  }
  _focus.copy(followActive ? ship.position : FOCUS_HOME);
  _goal.copy(_focus).add(CAMERA_OFFSET);
  const k = 1 - Math.exp(-RESET_RATE * dt);
  camera.position.lerp(_goal, k);
  controls.target.lerp(_focus, k);
}

function resetCamera() {
  resetting = true;
  resetTimer = RESET_TIME;
}

// Any manual orbit or zoom cancels an in-progress reset glide
controls.addEventListener('start', () => { resetting = false; });

/* ---------- Buttons and keys ---------- */
const zoom = (factor) => {
  if (factor > 1) controls.dollyOut(factor);
  else controls.dollyIn(1 / factor);
  controls.update();
};

launchBtn.addEventListener('click', launch);
document.getElementById('zoom-in').addEventListener('click', () => zoom(1.25));
document.getElementById('zoom-out').addEventListener('click', () => zoom(1 / 1.25));
document.getElementById('reset').addEventListener('click', resetCamera);

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === 'l') { e.preventDefault(); launch(); }
  else if (key === 'r') { e.preventDefault(); resetCamera(); }
  else if (key === '+' || key === '=') { e.preventDefault(); zoom(1.25); }
  else if (key === '-' || key === '_') { e.preventDefault(); zoom(1 / 1.25); }
});

/* ---------- Resize (wider field of view on portrait screens) ---------- */
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? 70 : 50;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* ---------- Main loop ---------- */
const clock = new THREE.Clock();
const _before = new THREE.Vector3();
const _delta = new THREE.Vector3();
let elapsed = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  _before.copy(ship.position);
  updateShip(dt, elapsed);
  _delta.subVectors(ship.position, _before);

  if (followActive) followShip(_delta, dt);
  if (resetting) updateReset(dt);
  controls.update();

  if (state.phase === 'lap') {
    barEl.style.width = `${Math.min(state.t / LAP_TIME, 1) * 100}%`;
  } else if (state.phase !== 'idle') {
    barEl.style.width = '100%';
  }

  for (const cloud of clouds) {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x > 380) cloud.position.x = -380;
  }

  sky.position.copy(camera.position);
  renderer.render(scene, camera);
});
