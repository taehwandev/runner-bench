import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSequence, UNITS_TO_METERS, SEPARATION, TOUCHDOWN_TIME, LZ1_COORDS, EARTH_RADIUS, MOON_RADIUS } from './sequence.js';
import { createMissionGame } from './mission-game.js';
import { createMissionUi } from './mission-ui.js';

const PAD_TOP = 2.2; // top of the launch mount; the engine bell sits on it
const LIFT_ANCHOR = new THREE.Vector3(0, 7, 0); // camera target sits this far above the rocket base
const DEFAULT_OFFSET = new THREE.Vector3(18, 5, 36); // camera offset from its target in the default view
const FLIGHT_HEADING = Math.atan2(-0.8, -0.6); // azimuth of travel; clouds are kept clear of it
const SUN_DIR = new THREE.Vector3(0.45, 0.8, -0.35).normalize();
const HORIZON = new THREE.Color('#cfe8ff');
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

const _rand = (min, max) => min + Math.random() * (max - min);
const _pick = (items) => items[Math.floor(Math.random() * items.length)];
const _angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const _easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const _setText = (el, value) => {
  if (el && el.textContent !== value) el.textContent = value;
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const ui = {
  canvas: $('scene'),
  launch: $('launch'),
  pause: $('pause'),
  zoomIn: $('zoom-in'),
  zoomOut: $('zoom-out'),
  follow: $('follow'),
  followBooster: $('follow-booster'),
  resetCam: $('reset-cam'),
  status: $('status'),
  met: $('met'),
  alt: $('alt'),
  speed: $('speed'),
  countdown: $('countdown'),
  boosterPip: $('booster-pip'),
  pipSwap: $('pip-swap'),
  pipTitle: $('pip-title'),
  pipStatus: $('pip-status'),
  pipAlt: $('pip-alt'),
  pipSpeed: $('pip-speed'),
  recoveryBanner: $('recovery-banner'),
  relaunchBtn: $('relaunch-btn'),
  brand: document.querySelector('.brand'),
};

// ---------- Renderer, scene, camera ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true });
} catch (err) {
  document.body.classList.add('no-webgl');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(HORIZON);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(HORIZON, 260, 1100);

// Far enough to hold the Moon, about 2000 units from the launch pad.
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 40000);
const pipCamera = new THREE.PerspectiveCamera(42, 1.6, 0.5, 40000);

const controls = new OrbitControls(camera, ui.canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 9000;
controls.maxPolarAngle = Math.PI * 0.49; // keep the camera above the ground
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.9;

// ---------- Lights ----------
scene.add(new THREE.HemisphereLight('#dcefff', '#5b7f3e', 1.35));
const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
sun.position.copy(SUN_DIR).multiplyScalar(90);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 50, bottom: -20, near: 1, far: 220 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ---------- Sky, ground and scenery ----------
// Everything on the ground lives in `world`, so it can be hidden once the rocket is in space.
const world = new THREE.Group();
scene.add(world);

const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    top: { value: new THREE.Color('#2b6cd0') },
    horizon: { value: HORIZON },
    sunDir: { value: SUN_DIR },
    space: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 top;
    uniform vec3 horizon;
    uniform vec3 sunDir;
    uniform float space;
    varying vec3 vDir;
    void main() {
      float h = clamp(vDir.y, 0.0, 1.0);
      vec3 col = mix(horizon, top, pow(h, 0.55));
      float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
      col += vec3(1.0, 0.95, 0.8) * (pow(s, 6.0) * 0.18 + pow(s, 120.0) * 0.8);
      vec3 d = normalize(vDir);
      vec3 cell = floor(d * 420.0);
      float star = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float points = step(0.9975, star) * pow(max(0.0, 1.0 - length(fract(d * 420.0) - 0.5) * 2.0), 3.0);
      vec3 spaceCol = vec3(0.004, 0.008, 0.025) + vec3(points * 1.8);
      col = mix(col, spaceCol, space);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMaterial);
sky.frustumCulled = false;
scene.add(sky);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(3000, 72),
  new THREE.MeshStandardMaterial({ color: '#6fa84a', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
world.add(ground);

function addHills() {
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const colors = ['#5e9a4a', '#4c8a52', '#6aa55a', '#58903f'];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + _rand(-0.1, 0.1);
    const r = _rand(360, 480);
    const size = _rand(60, 120);
    const hill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: _pick(colors), roughness: 1 }));
    hill.scale.set(size * 1.6, size * 0.55, size * 1.2);
    hill.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    world.add(hill);
  }
}

function addMountains() {
  const geo = new THREE.ConeGeometry(1, 1, 7, 1);
  geo.translate(0, 0.5, 0); // base sits on the ground
  const mat = new THREE.MeshStandardMaterial({ color: '#7f97ad', roughness: 1, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + _rand(-0.15, 0.15);
    const r = _rand(900, 1050);
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(_rand(140, 220), _rand(160, 300), _rand(140, 220));
    m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    world.add(m);
  }
}

function addForest(count) {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2, 6);
  trunkGeo.translate(0, 1, 0);
  const crownGeo = new THREE.ConeGeometry(1.6, 4.5, 8);
  crownGeo.translate(0, 4.25, 0); // crown base at y = 2
  const trunks = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 1 }),
    count,
  );
  const crowns = new THREE.InstancedMesh(
    crownGeo,
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }),
    count,
  );
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    let px, pz;
    do {
      const a = _rand(0, TAU);
      const r = _rand(34, 240);
      px = Math.cos(a) * r;
      pz = Math.sin(a) * r;
    } while (Math.hypot(px - LZ1_COORDS.x, pz - LZ1_COORDS.z) < 16);
    dummy.position.set(px, 0, pz);
    dummy.rotation.y = _rand(0, TAU);
    dummy.scale.setScalar(_rand(0.8, 1.6));
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crowns.setMatrixAt(i, dummy.matrix);
    crowns.setColorAt(i, tint.setHSL(_rand(0.24, 0.37), _rand(0.4, 0.6), _rand(0.24, 0.4)));
  }
  trunks.castShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  world.add(trunks, crowns);
}

function addClouds(count) {
  const group = new THREE.Group();
  const puffGeo = new THREE.SphereGeometry(1, 16, 12);
  const puffMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
  for (let i = 0; i < count; i++) {
    let a = _rand(0, TAU);
    // Keep clouds well off the flight path so they never hide the rocket.
    while (_angleGap(a, FLIGHT_HEADING) < 0.7) a = _rand(0, TAU);
    const cluster = new THREE.Group();
    const puffs = 4 + Math.floor(_rand(0, 4));
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(puffGeo, puffMat);
      p.scale.set(_rand(6, 11), _rand(4, 7), _rand(6, 10));
      p.position.set(j * _rand(5, 8) - puffs * 2.5, _rand(-1, 1.5), _rand(-2, 2));
      cluster.add(p);
    }
    const r = _rand(320, 520);
    cluster.position.set(Math.cos(a) * r, _rand(70, 130), Math.sin(a) * r);
    group.add(cluster);
  }
  world.add(group);
}

// ---------- Launch complex ----------
let serviceArm;

function buildLaunchComplex() {
  const concrete = new THREE.MeshStandardMaterial({ color: '#b5bcc5', roughness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: '#8d969f', roughness: 0.5, metalness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: '#eef1f4', roughness: 0.5 });
  const add = (geo, mat, x, y, z, parent = world) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Concrete pad and a raised mount with a flame gap in the middle.
  add(new THREE.BoxGeometry(24, 1.2, 24), concrete, 0, -0.6, 0);
  add(new THREE.BoxGeometry(9, PAD_TOP, 3), concrete, 0, PAD_TOP / 2, 3);
  add(new THREE.BoxGeometry(9, PAD_TOP, 3), concrete, 0, PAD_TOP / 2, -3);
  add(new THREE.BoxGeometry(3, PAD_TOP, 3), concrete, 3, PAD_TOP / 2, 0);
  add(new THREE.BoxGeometry(3, PAD_TOP, 3), concrete, -3, PAD_TOP / 2, 0);

  // Lattice tower with a service arm that retracts at liftoff.
  const tower = new THREE.Group();
  tower.position.set(-8, 0, 0);
  world.add(tower);
  const legGeo = new THREE.BoxGeometry(0.45, 18, 0.45);
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) add(legGeo, steel, x, 9, z, tower);
  const braceX = new THREE.BoxGeometry(2.9, 0.2, 0.2);
  const braceZ = new THREE.BoxGeometry(0.2, 0.2, 2.9);
  for (let y = 3; y < 18; y += 3) {
    add(braceX, steel, 0, y, -1.2, tower);
    add(braceX, steel, 0, y, 1.2, tower);
    add(braceZ, steel, -1.2, y, 0, tower);
    add(braceZ, steel, 1.2, y, 0, tower);
  }
  add(new THREE.BoxGeometry(3.2, 0.35, 3.2), steel, 0, 18.1, 0, tower);
  serviceArm = add(new THREE.BoxGeometry(5.8, 0.4, 0.5), steel, -3.9, 9, 0);

  // Fuel tank and a small blockhouse for scale.
  add(new THREE.CylinderGeometry(1.8, 1.8, 7, 32), white, 9, 3.5, -9);
  add(new THREE.SphereGeometry(1.8, 32, 12, 0, TAU, 0, Math.PI / 2), white, 9, 7, -9);
  add(new THREE.BoxGeometry(6, 3, 5), white, -14, 1.5, 12);
  add(new THREE.BoxGeometry(6.6, 0.3, 5.6), steel, -14, 3.15, 12);
}

// ---------- Landing Zone 1 ----------
function buildLandingZone() {
  const lzGroup = new THREE.Group();
  lzGroup.position.set(LZ1_COORDS.x, 0, LZ1_COORDS.z);
  world.add(lzGroup);

  const padGeo = new THREE.CylinderGeometry(LZ1_COORDS.radius, LZ1_COORDS.radius + 0.6, 0.6, 64);
  padGeo.translate(0, 0.3, 0); // top at y = 0.6

  const padCanvas = document.createElement('canvas');
  padCanvas.width = padCanvas.height = 1024;
  const ctx = padCanvas.getContext('2d');

  ctx.fillStyle = '#222831';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.save();
  ctx.translate(512, 512);

  // Hazard border ring
  ctx.beginPath();
  ctx.arc(0, 0, 485, 0, TAU);
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#f59e0b';
  ctx.stroke();

  // Outer solid white circle
  ctx.beginPath();
  ctx.arc(0, 0, 435, 0, TAU);
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Inner yellow circle
  ctx.beginPath();
  ctx.arc(0, 0, 240, 0, TAU);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#fbbf24';
  ctx.stroke();

  // Bullseye circle
  ctx.beginPath();
  ctx.arc(0, 0, 75, 0, TAU);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Big stylized SpaceX X in center
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-110, -110);
  ctx.lineTo(110, 110);
  ctx.moveTo(110, -110);
  ctx.lineTo(-110, 110);
  ctx.stroke();

  // Cardinal direction ticks
  ctx.lineWidth = 6;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 435, Math.sin(a) * 435);
    ctx.lineTo(Math.cos(a) * 365, Math.sin(a) * 365);
    ctx.stroke();
  }

  // Stencil text
  ctx.font = 'bold 44px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LZ - 1', 0, -290);
  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('SPACEX RECOVERY PAD', 0, 290);

  ctx.restore();

  const padTex = new THREE.CanvasTexture(padCanvas);
  padTex.colorSpace = THREE.SRGBColorSpace;

  const padSideMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.95 });
  const padTopMat = new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.85, metalness: 0.1 });
  const padMesh = new THREE.Mesh(padGeo, [padSideMat, padTopMat, padSideMat]);
  padMesh.receiveShadow = true;
  lzGroup.add(padMesh);

  // 4 floodlights
  const poleGeo = new THREE.BoxGeometry(0.3, 4, 0.3);
  poleGeo.translate(0, 2, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fff6ec' });

  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const r = LZ1_COORDS.radius + 1.2;
    const lx = Math.cos(a) * r;
    const lz = Math.sin(a) * r;

    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(lx, 0, lz);
    pole.castShadow = true;
    lzGroup.add(pole);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.6), lampMat);
    lamp.position.set(lx, 4.1, lz);
    lzGroup.add(lamp);

    const light = new THREE.PointLight('#ffecd1', 1.8, 30, 1.2);
    light.position.set(lx, 4.2, lz);
    lzGroup.add(light);
  }

  // Small radar tracking station
  const dishBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 2, 16), poleMat);
  dishBase.position.set(-LZ1_COORDS.radius - 2.5, 1, 0);
  dishBase.castShadow = true;
  lzGroup.add(dishBase);

  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12, 0, TAU, 0, Math.PI / 3), poleMat);
  dish.position.set(-LZ1_COORDS.radius - 2.5, 2.5, 0);
  dish.rotation.x = -Math.PI / 4;
  dish.rotation.y = Math.PI / 6;
  dish.castShadow = true;
  lzGroup.add(dish);

  return lzGroup;
}

function createSootTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f3f5f8';
  ctx.fillRect(0, 0, 512, 512);

  const grad = ctx.createLinearGradient(0, 512, 0, 100);
  grad.addColorStop(0, 'rgba(28, 30, 34, 0.95)');
  grad.addColorStop(0.2, 'rgba(42, 45, 50, 0.8)');
  grad.addColorStop(0.5, 'rgba(80, 85, 95, 0.45)');
  grad.addColorStop(0.8, 'rgba(150, 155, 165, 0.15)');
  grad.addColorStop(1, 'rgba(243, 245, 248, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = 'rgba(25, 28, 32, 0.35)';
  for (let i = 0; i < 20; i++) {
    const sx = _rand(15, 495);
    const sw = _rand(4, 18);
    const sh = _rand(160, 380);
    ctx.fillRect(sx, 512 - sh, sw, sh);
  }

  const topGrad = ctx.createLinearGradient(0, 0, 0, 90);
  topGrad.addColorStop(0, 'rgba(32, 35, 40, 0.88)');
  topGrad.addColorStop(1, 'rgba(243, 245, 248, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 512, 90);

  ctx.fillStyle = 'rgba(20, 20, 25, 0.75)';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STAGE 1 · REUSED', 256, 260);
  ctx.font = 'bold 15px monospace';
  ctx.fillText('FLIGHT-PROVEN · B1082', 256, 285);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- Rocket ----------
function buildRocket() {
  const rocket = new THREE.Group();
  const booster = new THREE.Group();
  const upper = new THREE.Group();
  rocket.add(booster, upper);
  const white = new THREE.MeshStandardMaterial({ color: '#f3f5f8', roughness: 0.38, metalness: 0.05 });
  const red = new THREE.MeshStandardMaterial({ color: '#d7392c', roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#3b4048', roughness: 0.6, metalness: 0.5 });

  const cleanBoosterMat = white;
  const sootTexture = createSootTexture();
  const sootBoosterMat = new THREE.MeshStandardMaterial({
    map: sootTexture,
    roughness: 0.55,
    metalness: 0.05,
  });

  // Lathe profile (radius, height): engine bell, body and ogive nose. Base at y = 0, tip at y = 14.
  const profile = [
    [0.95, 0],
    [0.5, 1.2],
    [0.9, 1.9],
    [1, 2.1],
    [1, 11.6],
    [0.96, 12.2],
    [0.8, 12.9],
    [0.5, 13.5],
    [0.2, 13.85],
    [0.01, 14],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  booster.add(new THREE.Mesh(new THREE.LatheGeometry(profile.slice(0, 3), 40), dark));
  const boosterBodyMesh = new THREE.Mesh(new THREE.LatheGeometry([
    ...profile.slice(2, 4), new THREE.Vector2(1, 7),
  ], 40), cleanBoosterMat);
  booster.add(boosterBodyMesh);

  function setBoosterFlightProven(count) {
    boosterBodyMesh.material = count > 0 ? sootBoosterMat : cleanBoosterMat;
  }

  upper.add(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(1, 7), ...profile.slice(4),
  ], 40), white));
  const upperBell = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 0.8, 32), dark);
  upperBell.position.y = 7.4;
  upper.add(upperBell);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.012, 1.012, 1.5, 40, 1, true), red);
  band.position.y = 9.2;
  upper.add(band);

  const finShape = new THREE.Shape([
    new THREE.Vector2(0.4, 0),
    new THREE.Vector2(2.3, 0),
    new THREE.Vector2(1.2, 3.4),
    new THREE.Vector2(0.4, 3.6),
  ]);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: false });
  finGeo.translate(0, 0.8, -0.07);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(finGeo, white);
    fin.rotation.y = (i * Math.PI) / 2;
    fin.castShadow = true;
    booster.add(fin);
  }

  // 4 Landing legs around booster base
  const legs = [];
  const carbonMat = new THREE.MeshStandardMaterial({ color: '#16191d', roughness: 0.55, metalness: 0.35 });
  const strutMat = new THREE.MeshStandardMaterial({ color: '#8d969f', roughness: 0.4, metalness: 0.7 });
  const footMat = new THREE.MeshStandardMaterial({ color: '#111315', roughness: 0.85 });

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const legHolder = new THREE.Group();
    legHolder.rotation.y = angle;
    booster.add(legHolder);

    const pivot = new THREE.Group();
    pivot.position.set(1.05, 0.4, 0);
    legHolder.add(pivot);

    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.8, 0.28), carbonMat);
    legMesh.position.y = 1.9;
    legMesh.castShadow = true;
    pivot.add(legMesh);

    const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.45), footMat);
    footMesh.position.set(0, 0, 0);
    pivot.add(footMesh);

    const strutPivot = new THREE.Group();
    strutPivot.position.set(1.02, 1.8, 0);
    legHolder.add(strutPivot);

    const strutCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 12), strutMat);
    strutCylinder.position.y = -0.95;
    strutPivot.add(strutCylinder);

    legs.push({ pivot, strutPivot, legMesh });
  }

  function updateLandingLegs(progress) {
    const deployAngle = progress * (64 * Math.PI / 180);
    for (const leg of legs) {
      leg.pivot.rotation.z = -deployAngle;
      leg.strutPivot.rotation.z = -deployAngle * 0.75;
      leg.strutPivot.scale.set(1, 1 + progress * 0.65, 1);
    }
  }

  // 4 Titanium grid fins near top of booster (y = 6.6)
  const gridFins = [];
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: '#34383e',
    roughness: 0.35,
    metalness: 0.8,
  });

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const finHolder = new THREE.Group();
    finHolder.rotation.y = angle;
    booster.add(finHolder);

    const pivot = new THREE.Group();
    pivot.position.set(1.02, 6.6, 0);
    finHolder.add(pivot);

    const finFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.65), titaniumMat);
    finFrame.position.set(0.32, 0, 0);
    finFrame.castShadow = true;
    pivot.add(finFrame);

    gridFins.push(pivot);
  }

  function updateGridFins(progress) {
    const angle = progress * (Math.PI / 2);
    for (const fin of gridFins) {
      fin.rotation.z = -angle;
    }
  }

  rocket.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { rocket, booster, upper, updateLandingLegs, updateGridFins, setBoosterFlightProven };
}

// Flame cone with vertex colour falloff: bright at the nozzle, dark at the tip, so additive blending fades it out.
function makeFlameCone(radius, hot, cool) {
  const geo = new THREE.ConeGeometry(radius, 1, 28, 1, true);
  geo.rotateX(Math.PI); // apex now at y = -0.5
  geo.translate(0, -0.5, 0); // apex at y = -1, base at the nozzle (y = 0)
  const pos = geo.attributes.position;
  const colors = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const f = THREE.MathUtils.clamp(-pos.getY(i), 0, 1);
    c.copy(hot).lerp(cool, f).multiplyScalar(Math.pow(1 - f, 0.8));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, material);
}

function buildFlame(glowTex) {
  const group = new THREE.Group();
  const outer = makeFlameCone(0.95, new THREE.Color('#fff2b8'), new THREE.Color('#ff6a1c'));
  const inner = makeFlameCone(0.42, new THREE.Color('#ffffff'), new THREE.Color('#ffd06a'));
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: '#ffd9a0',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.position.y = -0.5;
  const light = new THREE.PointLight('#ff9d4a', 0, 60, 1.5);
  light.position.y = -1.5;
  group.add(outer, inner, glow, light);
  group.visible = false;
  return { group, outer, inner, glow, light };
}

function updateFlame(flame, throttle, t) {
  flame.group.visible = throttle > 0.02;
  if (!flame.group.visible) {
    flame.light.intensity = 0;
    return;
  }
  const flicker = 0.93 + 0.04 * Math.sin(t * 37) + 0.03 * Math.sin(t * 61);
  const length = (1.5 + 9 * throttle) * flicker;
  const w = 0.45 + 0.55 * throttle;
  flame.outer.scale.set(w, length, w);
  flame.inner.scale.set(w * 0.55, length * 0.75, w * 0.55);
  flame.glow.scale.setScalar((2.5 + 4 * throttle) * flicker);
  flame.glow.material.opacity = throttle;
  flame.light.intensity = 90 * throttle * flicker;
}

// ---------- Smoke ----------
class _SmokePool {
  constructor(parent, count, map) {
    this.items = [];
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0 }),
      );
      sprite.visible = false;
      parent.add(sprite);
      this.items.push({ sprite, age: 0, life: 0, size: 1, grow: 0, peak: 0, spin: 0, vel: new THREE.Vector3() });
    }
  }

  spawn(position, velocity, { size, grow, life, peak, tint, spin = 0 }) {
    const item = this.items.find((it) => it.life === 0);
    if (!item) return;
    item.age = 0;
    item.life = life;
    item.size = size;
    item.grow = grow;
    item.peak = peak;
    item.spin = spin;
    item.vel.copy(velocity);
    item.sprite.position.copy(position);
    item.sprite.material.color.setScalar(tint);
    item.sprite.material.rotation = _rand(0, TAU);
    item.sprite.visible = true;
  }

  update(dt) {
    for (const it of this.items) {
      if (it.life === 0) continue;
      it.age += dt;
      if (it.age >= it.life) {
        it.life = 0;
        it.sprite.visible = false;
        continue;
      }
      const k = it.age / it.life;
      it.sprite.position.addScaledVector(it.vel, dt);
      it.vel.multiplyScalar(1 - 0.6 * dt);
      it.vel.y += 0.35 * dt; // smoke rises
      it.sprite.scale.setScalar(it.size + it.grow * k);
      it.sprite.material.opacity = it.peak * (k < 0.15 ? k / 0.15 : (1 - k) / 0.85);
      it.sprite.material.rotation += it.spin * dt;
    }
  }

  clear() {
    for (const it of this.items) {
      it.life = 0;
      it.sprite.visible = false;
    }
  }
}

function radialTexture(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- Build the scene ----------
addHills();
addMountains();
addForest(320);
addClouds(22);
buildLaunchComplex();
buildLandingZone();

const smokeTex = radialTexture([
  [0, 'rgba(255,255,255,0.95)'],
  [0.35, 'rgba(255,255,255,0.55)'],
  [1, 'rgba(255,255,255,0)'],
]);
const glowTex = radialTexture([
  [0, 'rgba(255,250,220,1)'],
  [0.2, 'rgba(255,170,70,0.85)'],
  [1, 'rgba(255,90,20,0)'],
]);

const { rocket, booster, upper, updateLandingLegs, updateGridFins, setBoosterFlightProven } = buildRocket();
const flame = buildFlame(glowTex);
rocket.add(flame.group);
const boosterFlame = buildFlame(glowTex);
booster.add(boosterFlame.group);
boosterFlame.group.position.set(0, 0, 0);
let boosterEmitAcc = 0;
let boosterLandedBurstDone = false;
rocket.position.set(0, PAD_TOP, 0);
scene.add(rocket);
// The return capsule replaces the upper stage at separation; its local up points away from Earth.
const capsule = new THREE.Group();
const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.45, 2.2, 32),
  new THREE.MeshStandardMaterial({ color: '#e8edf2', metalness: 0.25, roughness: 0.5 }));
shell.position.y = 1.1;
capsule.add(shell);
const shield = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.48, 0.25, 32),
  new THREE.MeshStandardMaterial({ color: '#34343a', roughness: 0.9 }));
capsule.add(shield);
const heat = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff5815', transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false }));
heat.position.y = 0.5;
heat.scale.set(12, 12, 1);
capsule.add(heat);
const parachutes = new THREE.Group();
for (let i = 0; i < 3; i++) {
  const a = i * TAU / 3;
  const x = Math.cos(a) * 3, z = Math.sin(a) * 3;
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 12, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: i === 1 ? '#f5f0e5' : '#ed6045', side: THREE.DoubleSide }));
  canopy.position.set(x, 8, z);
  parachutes.add(canopy);
  for (let j = 0; j < 4; j++) {
    const b = j * TAU / 4;
    parachutes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 2, 0), new THREE.Vector3(x + Math.cos(b) * 2.1, 8, z + Math.sin(b) * 2.1),
    ]), new THREE.LineBasicMaterial({ color: '#e5e2d9' })));
  }
}
capsule.add(parachutes);
rocket.add(capsule);
const ocean = new THREE.Mesh(new THREE.CircleGeometry(45, 64),
  new THREE.MeshStandardMaterial({ color: '#167eb0', roughness: 0.3, metalness: 0.15 }));
ocean.visible = false;
scene.add(ocean);
const smoke = new _SmokePool(scene, 180, smokeTex);
const spentStage = upper.clone();
spentStage.visible = false;
scene.add(spentStage);
const spentVelocity = new THREE.Vector3();
let stageSeparationTime = 0;
let prevStageCapsule = false;
const boosterStart = new THREE.Vector3();
const boosterVelocity = new THREE.Vector3();
const boosterRotation = new THREE.Quaternion();

// ---------- Earth, Moon and mission paths ----------
// Built once from the mission geometry (it is the same on every run), then shown only while the rocket is in space.
const missionGroup = new THREE.Group();
missionGroup.visible = false;
scene.add(missionGroup);

// Sequence positions are relative to the launch mount, which sits at PAD_TOP in the scene.
const _toScene = (p) => new THREE.Vector3(p.x, PAD_TOP + p.y, p.z);

function surfaceTexture(base, colours, blobs, minSize, maxSize) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < blobs; i++) {
    g.fillStyle = _pick(colours);
    g.beginPath();
    g.ellipse(_rand(0, 1024), _rand(0, 512), _rand(minSize, maxSize), _rand(minSize, maxSize) * 0.6, _rand(0, TAU), 0, TAU);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const earthMesh = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS, 96, 64),
  new THREE.MeshStandardMaterial({
    map: surfaceTexture('#1f5fa8', ['#4d8f3d', '#6aa050', '#8a7a48', '#3f7a3a', 'rgba(255,255,255,0.75)'], 260, 8, 34),
    roughness: 0.9,
  }),
);
earthMesh.add(new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS * 1.03, 64, 48),
  new THREE.MeshBasicMaterial({
    color: '#7fc4ff',
    transparent: true,
    opacity: 0.2,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
));
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(MOON_RADIUS, 64, 48),
  new THREE.MeshStandardMaterial({
    map: surfaceTexture('#aeb3ba', ['#8d939b', '#9aa0a8', '#c4c9d0'], 140, 6, 26),
    roughness: 1,
  }),
);

// Circle through centre c with radius r in the plane of unit vectors u and w (u at angle 0).
function ringPoints(c, r, u, w, count) {
  const out = [];
  for (let i = 0; i <= count; i++) {
    const a = (i / count) * TAU;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    out.push(new THREE.Vector3(
      c.x + r * (ca * u.x + sa * w.x),
      PAD_TOP + c.y + r * (ca * u.y + sa * w.y),
      c.z + r * (ca * u.z + sa * w.z),
    ));
  }
  return out;
}

const pathMaterial = new THREE.LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.55, depthWrite: false });
// The spacecraft is only a few units long next to the planets, so a glow marker keeps it easy to find.
const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex,
  color: '#ffffff',
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
}));
missionGroup.add(beacon);
let missionBuilt = false;

function buildMission(s) {
  const { earth, moon } = s;
  earthMesh.position.copy(_toScene(earth.center));
  moonMesh.position.copy(_toScene(moon.center));
  const earthOrbit = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(ringPoints(earth.center, earth.orbitRadius, earth.u, earth.w, 160).slice(0, -1)),
    pathMaterial,
  );
  const moonOrbit = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(ringPoints(moon.center, moon.orbitRadius, moon.n, moon.a, 120).slice(0, -1)),
    pathMaterial,
  );
  const transfer = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(s.transferPoints.map(_toScene)),
    pathMaterial,
  );
  missionGroup.add(earthMesh, moonMesh, earthOrbit, moonOrbit, transfer);
  missionBuilt = true;
}

// Nearest surface: the launch mount before orbit, then the nearest body's surface.
function altitudeMeters(s) {
  if (!s.earth) return s.position.y * UNITS_TO_METERS;
  const dist = (c) => Math.hypot(s.position.x - c.x, s.position.y - c.y, s.position.z - c.z);
  let altitude = dist(s.earth.center) - s.earth.radius;
  if (s.moon) altitude = Math.min(altitude, dist(s.moon.center) - s.moon.radius);
  return altitude * UNITS_TO_METERS;
}

// ---------- Simulation and camera ----------
const seq = createSequence();
const game = createMissionGame();
let missionMode = true; // mission game with decisions; false is the free-flight cinematic
const anchor = new THREE.Vector3();
const scratch = new THREE.Vector3();
const dirVec = new THREE.Vector3();
let following = true;
let tween = null;
let framing = null; // eases the camera offset to a mission view: { t, duration, from, to }
let emitAcc = 0;
let prevPhase = 'ready';
let paused = false;
let simulationTime = 0;

function framingScale() {
  return camera.aspect < 0.9 ? 1.35 : 1;
}

let cameraMode = 'rocket'; // 'rocket' or 'booster'

function anchorPoint(out) {
  if (cameraMode === 'booster') {
    const bOffset = scratch.set(0, 3.5, 0).applyQuaternion(booster.quaternion);
    return out.copy(booster.position).add(bOffset);
  }
  return out.copy(LIFT_ANCHOR).applyQuaternion(rocket.quaternion).add(rocket.position);
}

function switchCameraMode(mode) {
  if (cameraMode === mode) return;
  cameraMode = mode;
  following = true;
  setFollowUi();
  framing = null;
  const target = anchorPoint(scratch);
  const offset = mode === 'booster'
    ? new THREE.Vector3(12, 6, 16)
    : DEFAULT_OFFSET.clone().multiplyScalar(framingScale());
  tween = {
    t: 0,
    duration: 1.0,
    fromTarget: controls.target.clone(),
    fromPosition: camera.position.clone(),
    offset,
  };
}

function resetCamera({ animate = true } = {}) {
  following = true;
  cameraMode = 'rocket';
  setFollowUi();
  framing = null;
  const offset = DEFAULT_OFFSET.clone().multiplyScalar(framingScale());
  if (!animate) {
    anchorPoint(controls.target);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    return;
  }
  tween = {
    t: 0,
    duration: 1.1,
    fromTarget: controls.target.clone(),
    fromPosition: camera.position.clone(),
    offset,
  };
}

function zoomBy(factor) {
  tween = null;
  framing = null;
  const offset = camera.position.clone().sub(controls.target);
  const len = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).add(offset.setLength(len));
  controls.update();
}

function setFollowUi() {
  ui.follow.setAttribute('aria-pressed', String(following && cameraMode === 'rocket'));
  if (ui.followBooster) {
    ui.followBooster.setAttribute('aria-pressed', String(following && cameraMode === 'booster'));
  }
}

// Offset from the spacecraft for each mission phase: the orbit is seen from outside and above so the lap is
// visible, the transfer is framed side-on so both Earth and Moon fit, and the lunar lap is seen from above.
function missionOffset(s) {
  const craft = _toScene(s.position);
  const heading = new THREE.Vector3(s.direction.x, s.direction.y, s.direction.z);
  if (s.capsule) {
    const radial = new THREE.Vector3(s.earth.u.x, s.earth.u.y, s.earth.u.z);
    const side = new THREE.Vector3().crossVectors(radial, new THREE.Vector3(s.earth.w.x, s.earth.w.y, s.earth.w.z)).normalize();
    return radial.multiplyScalar(18).addScaledVector(side, 42).multiplyScalar(framingScale());
  }
  if (s.phase === 'insertion' || s.phase === 'orbit' || s.phase === 'lunar') {
    const body = s.phase === 'lunar' ? s.moon.center : s.earth.center;
    const radial = craft.clone().sub(_toScene(body)).normalize();
    const normal = new THREE.Vector3().crossVectors(heading, radial).normalize();
    if (normal.y < 0) normal.negate();
    const distance = s.phase === 'lunar' ? 600 : 1000;
    return radial.multiplyScalar(0.9).addScaledVector(normal, 0.44).normalize().multiplyScalar(distance);
  }
  // Transfer: the Earth-Moon line lies across the view. Back far enough that both bodies fit both within the
  // frame width and within the frame height, since the line rises steeply out of the horizontal.
  const axis = _toScene(s.moon.center).sub(_toScene(s.earth.center)).normalize();
  const side = new THREE.Vector3().crossVectors(axis, UP).normalize();
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const distance = Math.max(2400, 1600 / (tanHalfFov * camera.aspect), 1400 / tanHalfFov);
  return side.multiplyScalar(distance);
}

function startFraming(s) {
  following = true;
  setFollowUi();
  tween = null;
  const to = missionOffset(s);
  framing = {
    t: 0,
    duration: 2,
    from: camera.position.clone().sub(controls.target),
    to,
  };
}

function updateCamera(dt) {
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / tween.duration);
    const k = _easeInOutCubic(tween.t);
    const goal = anchorPoint(scratch);
    controls.target.lerpVectors(tween.fromTarget, goal, k);
    camera.position.lerpVectors(tween.fromPosition, goal.clone().add(tween.offset), k);
    if (tween.t >= 1) tween = null;
  } else if (framing) {
    framing.t = Math.min(1, framing.t + dt / framing.duration);
    const k = _easeInOutCubic(framing.t);
    const goal = anchorPoint(scratch);
    controls.target.copy(goal);
    camera.position.copy(goal).add(framing.from.clone().lerp(framing.to, k));
    if (framing.t >= 1) framing = null;
  } else if (following) {
    // Move target and camera by the same step so the user's orbit angle and zoom are kept.
    const step = scratch.subVectors(anchorPoint(anchor), controls.target).multiplyScalar(1 - Math.exp(-dt * 4));
    controls.target.add(step);
    camera.position.add(step);
  }
  controls.update();
}

// ---------- Per-frame sync ----------
let vibrateTime = 0;

function placeRocket(s, dt) {
  if (s.capsule && prevStageCapsule === false && s.phase === 'reentry') {
    spentStage.position.copy(rocket.position);
    spentStage.quaternion.copy(rocket.quaternion);
    spentVelocity.set(s.direction.x, s.direction.y, s.direction.z).multiplyScalar(-8);
    stageSeparationTime = s.flight;
    spentStage.visible = true;
  }
  if (!s.capsule) spentStage.visible = false;
  if (spentStage.visible) {
    spentStage.position.addScaledVector(spentVelocity, dt);
    spentStage.visible = s.flight - stageSeparationTime < 4;
  }
  prevStageCapsule = s.capsule;
  upper.visible = !s.capsule;
  capsule.visible = s.capsule;
  heat.visible = s.phase === 'reentry';
  parachutes.visible = s.phase === 'parachute' || s.phase === 'departed';
  parachutes.scale.setScalar(s.phase === 'parachute' ? Math.min(1, 0.1 + s.phaseTime / 2) : 1);
  ocean.visible = s.capsule;
  if (s.capsule) {
    const radial = dirVec.set(s.earth.u.x, s.earth.u.y, s.earth.u.z);
    ocean.position.copy(_toScene(s.earth.center)).addScaledVector(radial, EARTH_RADIUS + 0.15);
    ocean.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), radial);
  }
  if (s.separated && booster.parent === rocket) {
    scene.attach(booster);
  } else if (!s.separated && booster.parent !== rocket) {
    rocket.add(booster);
    booster.position.set(0, 0, 0);
    booster.quaternion.identity();
  }
  if (s.separated) {
    const b = s.booster;
    if (b) {
      booster.position.set(b.position.x, b.position.y, b.position.z);
      booster.quaternion.setFromUnitVectors(UP, dirVec.set(b.direction.x, b.direction.y, b.direction.z).normalize());
      if (missionMode && game.view().boosterLost) booster.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
      updateLandingLegs(b.legsProgress);
      updateGridFins(b.gridFinsProgress);
      updateFlame(boosterFlame, b.throttle, simulationTime);
      emitBoosterExhaust(b, dt);
      if (b.rcsActive) emitRcsPuffs(b, dt);
      if (b.landed && !boosterLandedBurstDone) {
        burstAtLandingPad();
        boosterLandedBurstDone = true;
      }
    }
    booster.visible = true;
  } else {
    booster.visible = true;
    updateLandingLegs(0);
    updateGridFins(0);
    boosterFlame.group.visible = false;
    boosterLandedBurstDone = false;
  }
  flame.group.position.y = s.separated ? 7 : 0;
  const p = s.position;
  rocket.position.set(p.x, PAD_TOP + p.y, p.z);
  if (s.flight === 0 && s.throttle > 0) {
    vibrateTime += dt;
    rocket.position.x += Math.sin(vibrateTime * 90) * 0.03 * s.throttle;
    rocket.position.z += Math.cos(vibrateTime * 77) * 0.03 * s.throttle;
  }
  rocket.quaternion.setFromUnitVectors(UP, dirVec.set(s.direction.x, s.direction.y, s.direction.z).normalize());
}

function burstAtLandingPad() {
  for (let i = 0; i < 70; i++) {
    const a = _rand(0, TAU);
    const r = _rand(2, 7);
    const pos = scratch.set(LZ1_COORDS.x + Math.cos(a) * r, LZ1_COORDS.y + _rand(0.2, 1.2), LZ1_COORDS.z + Math.sin(a) * r);
    const vel = new THREE.Vector3(Math.cos(a) * _rand(3, 8), _rand(0.5, 2.5), Math.sin(a) * _rand(3, 8));
    smoke.spawn(pos, vel, {
      size: _rand(3.5, 5.5),
      grow: _rand(7, 11),
      life: _rand(3.5, 6),
      peak: 0.8,
      tint: _rand(0.75, 0.95),
      spin: _rand(-0.3, 0.3),
    });
  }
}

function emitBoosterExhaust(b, dt) {
  if (b.throttle < 0.05) return;
  boosterEmitAcc += dt * 32 * b.throttle;
  const nozzle = scratch.set(0, -0.6, 0);
  booster.localToWorld(nozzle);
  const back = dirVec.set(-b.direction.x, -b.direction.y, -b.direction.z).multiplyScalar(b.speedMps * 0.05 + 1);
  while (boosterEmitAcc >= 1) {
    boosterEmitAcc -= 1;
    const jitter = new THREE.Vector3(_rand(-0.6, 0.6), _rand(-0.3, 0.3), _rand(-0.6, 0.6));
    smoke.spawn(nozzle, back.clone().add(jitter), {
      size: _rand(2.2, 3.2),
      grow: _rand(5, 8),
      life: _rand(3.5, 5.5),
      peak: 0.55,
      tint: _rand(0.8, 0.98),
      spin: _rand(-0.4, 0.4),
    });
  }
}

function emitRcsPuffs(b, dt) {
  const topPos = scratch.set(0, 6.8, 0);
  booster.localToWorld(topPos);
  for (let i = 0; i < 2; i++) {
    const a = _rand(0, TAU);
    const vel = new THREE.Vector3(Math.cos(a) * 4, _rand(-0.5, 0.5), Math.sin(a) * 4);
    smoke.spawn(topPos, vel, {
      size: 0.8,
      grow: 2.2,
      life: 0.45,
      peak: 0.6,
      tint: 0.95,
      spin: _rand(-1, 1),
    });
  }
}

function burstAtPad() {
  for (let i = 0; i < 70; i++) {
    const a = _rand(0, TAU);
    const r = _rand(3, 9);
    const pos = scratch.set(Math.cos(a) * r, _rand(0.5, 2), Math.sin(a) * r);
    const vel = new THREE.Vector3(Math.cos(a) * _rand(2, 6), _rand(0.5, 2.5), Math.sin(a) * _rand(2, 6));
    smoke.spawn(pos, vel, {
      size: _rand(4, 6),
      grow: _rand(8, 12),
      life: _rand(4, 7),
      peak: 0.8,
      tint: _rand(0.7, 0.95),
      spin: _rand(-0.3, 0.3),
    });
  }
}

function emitExhaust(s, dt) {
  // No smoke in vacuum: once the mission has started, the burns show as flame only.
  if (s.throttle < 0.05 || s.earth) return;
  emitAcc += dt * 34 * s.throttle;
  const nozzle = scratch.set(0, s.separated ? 6.4 : -0.6, 0);
  rocket.localToWorld(nozzle);
  const back = dirVec.set(-s.direction.x, -s.direction.y, -s.direction.z).multiplyScalar(s.speed * 0.25 + 1);
  while (emitAcc >= 1) {
    emitAcc -= 1;
    const jitter = new THREE.Vector3(_rand(-0.8, 0.8), _rand(-0.4, 0.4), _rand(-0.8, 0.8));
    smoke.spawn(nozzle, back.clone().add(jitter), {
      size: _rand(2.5, 3.5),
      grow: _rand(6, 9),
      life: _rand(4, 6),
      peak: 0.6,
      tint: _rand(0.82, 1),
      spin: _rand(-0.4, 0.4),
    });
  }
}

function onPhaseChange(phase, s) {
  if (phase === 'ignition') burstAtPad();
  if (phase === 'ascent') serviceArm.visible = false;
  if (cameraMode === 'rocket' && following && (phase === 'insertion' || phase === 'transfer' || phase === 'lunar' || phase === 'return' || phase === 'reentry')) startFraming(s);
}

// ---------- HUD ----------
const PHASE_LABEL = {
  ready: 'Ready',
  countdown: 'Countdown',
  ignition: 'Ignition',
  ascent: 'Ascent',
  insertion: 'Orbit insertion',
  orbit: 'Earth orbit',
  transfer: 'Trans-lunar',
  lunar: 'Lunar orbit',
  return: 'Return to Earth',
  reentry: 'Capsule re-entry',
  parachute: 'Parachute descent',
  departed: 'Splashdown',
};
let overlayText = '';

function formatMet(seconds) {
  const m = Math.floor(seconds / 60);
  const sec = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${String(m).padStart(2, '0')}:${sec}`;
}

function setOverlay(text) {
  if (text === overlayText) return;
  overlayText = text;
  ui.countdown.textContent = text;
  ui.countdown.classList.toggle('hidden', !text);
  // Restart the entrance animation for each new value.
  ui.countdown.classList.remove('tick');
  void ui.countdown.offsetWidth;
  ui.countdown.classList.add('tick');
}

function boosterStatusText(b) {
  if (!b) return 'Separation';
  if (b.phase === 'flip') return 'Flip maneuver';
  if (b.phase === 'braking') return 'Braking burn';
  if (b.phase === 'glide') return 'Atmospheric entry';
  if (b.phase === 'landing') return b.legsProgress > 0.4 ? 'Legs deployed' : 'Landing burn';
  if (b.phase === 'landed') return missionMode && game.view().boosterLost ? 'Booster lost' : 'Booster landed';
  return 'In flight';
}

function updateHud(s) {
  const busy = s.phase !== 'ready' && s.phase !== 'departed';
  let status = PHASE_LABEL[s.phase];
  if (s.phase === 'ascent' && s.flight < 2.5) status = 'Liftoff';
  else if (s.phase === 'ascent' && s.separated) status = 'Upper stage';

  if (cameraMode === 'booster' && s.booster && s.separated) {
    status = boosterStatusText(s.booster);
  }

  if (paused) status = `Paused · ${status}`;
  _setText(ui.status, status);

  let met = '—';
  if (s.phase === 'countdown') met = `T−${s.countdown.toFixed(1)} s`;
  else if (s.phase === 'ignition') met = 'T−0.0 s';
  else if (busy || s.phase === 'departed') met = `T+ ${formatMet(s.flight)}`;
  _setText(ui.met, met);

  if (cameraMode === 'booster' && s.booster && s.separated) {
    _setText(ui.alt, `${s.booster.altitudeMeters.toLocaleString('en-US')} m`);
    _setText(ui.speed, `${s.booster.speedMps.toLocaleString('en-US')} m/s`);
  } else {
    _setText(ui.alt, `${Math.round(altitudeMeters(s)).toLocaleString('en-US')} m`);
    _setText(ui.speed, `${Math.round(s.speed * UNITS_TO_METERS).toLocaleString('en-US')} m/s`);
  }

  let text = '';
  if (s.phase === 'countdown') text = String(Math.ceil(s.countdown));
  else if (s.phase === 'ignition') text = 'Ignition';
  else if (s.phase === 'ascent' && s.flight < 2) text = 'Liftoff';
  setOverlay(text);

  // A mission booster that missed the pad is not recovered; a recovery only counts once the mission is over.
  const mission = missionMode ? game.view() : null;
  const boosterLanded = Boolean(s.booster && s.booster.landed) && !(mission && mission.boosterLost);
  const recovered = boosterLanded && !(mission && mission.active);

  // Recovery banner and launch/relaunch button
  if (recovered && s.phase !== 'ready' && s.phase !== 'countdown' && s.phase !== 'ignition') {
    if (ui.recoveryBanner) ui.recoveryBanner.classList.remove('hidden');
    ui.launch.disabled = false;
    _setText(ui.launch, 'Launch Recovered Rocket');
  } else {
    if (ui.recoveryBanner) ui.recoveryBanner.classList.add('hidden');
    ui.launch.disabled = false;
    let launchLabel = 'Launch';
    if (mission && mission.failed) {
      launchLabel = 'Retry mission';
      ui.launch.disabled = false;
    } else if (s.phase === 'departed') {
      launchLabel = (s.reuseCount > 0 || recovered) ? 'Launch Recovered Rocket' : 'Replay';
    } else if (recovered) {
      launchLabel = 'Launch Recovered Rocket';
    } else if (busy) {
      launchLabel = 'Replay';
    }
    _setText(ui.launch, launchLabel);
  }

  ui.pause.disabled = false;
  _setText(ui.pause, paused ? 'Resume' : 'Pause');

  // PiP UI & Follow Booster button
  if (s.separated) {
    if (ui.boosterPip) ui.boosterPip.classList.remove('hidden');
    if (ui.followBooster) ui.followBooster.classList.remove('hidden');
    _setText(ui.pipTitle, cameraMode === 'booster' ? 'UPPER STAGE CAM' : 'STAGE 1 CAMERA');
    if (s.booster) {
      _setText(ui.pipStatus, cameraMode === 'booster' ? PHASE_LABEL[s.phase] : boosterStatusText(s.booster));
      _setText(ui.pipAlt, cameraMode === 'booster'
        ? `${Math.round(altitudeMeters(s)).toLocaleString('en-US')} m`
        : `${s.booster.altitudeMeters.toLocaleString('en-US')} m`);
      _setText(ui.pipSpeed, cameraMode === 'booster'
        ? `${Math.round(s.speed * UNITS_TO_METERS).toLocaleString('en-US')} m/s`
        : `${s.booster.speedMps.toLocaleString('en-US')} m/s`);
    }
  } else {
    if (ui.boosterPip) ui.boosterPip.classList.add('hidden');
    if (ui.followBooster) ui.followBooster.classList.add('hidden');
  }

  // Reuse badge in top panel
  if (ui.brand) {
    let brandBadge = document.getElementById('reuse-badge');
    if (s.reuseCount > 0) {
      if (!brandBadge) {
        brandBadge = document.createElement('span');
        brandBadge.id = 'reuse-badge';
        brandBadge.className = 'brand-badge';
        ui.brand.appendChild(brandBadge);
      }
      _setText(brandBadge, `Flight #${s.reuseCount + 1} (Flight-Proven)`);
    } else if (brandBadge) {
      brandBadge.remove();
    }
  }
}

// ---------- Input ----------
function launch() {
  if (missionMode) {
    startMission();
    return;
  }
  const snap = seq.snapshot();
  if (snap.phase === 'departed' || (snap.booster && snap.booster.landed)) {
    relaunch();
    return;
  }
  if (snap.phase !== 'ready') {
    relaunch();
    return;
  }
  paused = false;
  setBoosterFlightProven(snap.reuseCount);
  seq.start();
}

function resetLaunchScene() {
  paused = false;
  smoke.clear();
  serviceArm.visible = true;
  emitAcc = 0;
  vibrateTime = 0;
  simulationTime = 0;
  switchCameraMode('rocket');
  resetCamera();
}

function relaunch() {
  if (missionMode) {
    startMission();
    return;
  }
  resetLaunchScene();
  seq.relaunch();
  setBoosterFlightProven(seq.snapshot().reuseCount);
}

// Starts a mission: the sequence resets, then the game's decisions take over its plan.
function startMission() {
  resetLaunchScene();
  seq.relaunch();
  setBoosterFlightProven(seq.snapshot().reuseCount);
  game.begin();
  seq.setPlan(game.plan());
}

function setMissionMode(on) {
  if (game.locked() || on === missionMode) return;
  missionMode = on;
  game.reset();
  missionUi.setMode(on);
}

const missionUi = createMissionUi({
  onChoose: (id) => game.choose(id),
  onRestart: () => startMission(),
  onToggleAutopilot: () => game.toggleAutopilot(),
  onToggleMode: () => setMissionMode(!missionMode),
});
missionUi.setMode(missionMode);

ui.launch.addEventListener('click', launch);
if (ui.relaunchBtn) {
  ui.relaunchBtn.addEventListener('click', relaunch);
}
ui.pause.addEventListener('click', () => {
  paused = !paused;
  updateHud(seq.snapshot());
});
ui.resetCam.addEventListener('click', () => resetCamera());
ui.zoomIn.addEventListener('click', () => zoomBy(0.8));
ui.zoomOut.addEventListener('click', () => zoomBy(1.25));
ui.follow.addEventListener('click', () => {
  if (cameraMode !== 'rocket') {
    switchCameraMode('rocket');
  } else {
    following = !following;
    setFollowUi();
  }
});
if (ui.followBooster) {
  ui.followBooster.addEventListener('click', () => {
    if (cameraMode !== 'booster') {
      switchCameraMode('booster');
    } else {
      following = !following;
      setFollowUi();
    }
  });
}
if (ui.pipSwap) {
  ui.pipSwap.addEventListener('click', (e) => {
    e.stopPropagation();
    switchCameraMode(cameraMode === 'booster' ? 'rocket' : 'booster');
  });
}
if (ui.boosterPip) {
  ui.boosterPip.addEventListener('click', () => {
    switchCameraMode(cameraMode === 'booster' ? 'rocket' : 'booster');
  });
}
controls.addEventListener('start', () => {
  // A user drag or wheel takes over from an in-progress camera move.
  tween = null;
  framing = null;
});

window.addEventListener('keydown', (e) => {
  // Shortcuts only when focus is not on a control, so Space and Enter still activate buttons.
  if (e.repeat || (e.target !== document.body && e.target !== document.documentElement)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    const snap = seq.snapshot();
    if (snap.booster && snap.booster.landed) {
      relaunch();
    } else {
      launch();
    }
  } else if (e.key === 'r' || e.key === 'R') {
    resetCamera();
  } else if (e.key === 'b' || e.key === 'B') {
    if (seq.snapshot().separated) {
      switchCameraMode(cameraMode === 'booster' ? 'rocket' : 'booster');
    }
  } else if (e.key === 'a' || e.key === 'A') {
    if (missionMode) game.toggleAutopilot();
  } else if (e.key === 'm' || e.key === 'M') {
    setMissionMode(!missionMode);
  }
});

// Number keys answer a decision whatever has focus; they never activate a button, so Launch keeps its focus.
window.addEventListener('keydown', (e) => {
  if (!missionMode || e.repeat || !/^[1-4]$/.test(e.key)) return;
  const pending = game.view().pending;
  if (pending) game.choose(pending.options[Number(e.key) - 1]?.id);
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Loop ----------
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  // The mission holds the flight while a decision is open or after a failure; the camera keeps moving.
  const holding = missionMode && game.holdsSim();
  const simDt = paused || holding ? 0 : dt;
  simulationTime += simDt;

  seq.update(simDt);
  const s = seq.snapshot();
  if (missionMode) {
    game.update(s, paused ? 0 : dt);
    const plan = game.plan();
    if (plan) seq.setPlan(plan);
    missionUi.render(game.view());
    if (game.autoRestartDue()) startMission();
  }
  if (s.phase !== prevPhase) {
    onPhaseChange(s.phase, s);
    prevPhase = s.phase;
  }

  // Once the upper stage takes over, the ground is gone and the Earth and Moon take its place.
  const inSpace = Boolean(s.earth);
  if (inSpace && !missionBuilt) buildMission(s);
  if (inSpace) earthMesh.rotation.y += simDt * 0.03;

  placeRocket(s, simDt);
  updateFlame(flame, s.throttle, simulationTime);
  emitExhaust(s, simDt);
  smoke.update(simDt);

  updateCamera(dt);
  if (inSpace) {
    beacon.visible = !s.capsule;
    beacon.position.copy(rocket.position);
    beacon.scale.setScalar(Math.max(8, camera.position.distanceTo(rocket.position) * 0.03));
  }
  const space = inSpace ? 1 : THREE.MathUtils.smoothstep(s.position.y, 180, 550);
  skyMaterial.uniforms.space.value = space;
  // Distant bodies would be swallowed by the ground fog, so it reaches far out once in space.
  scene.fog.far = inSpace ? 60000 : 1100;
  scene.fog.color.copy(HORIZON).lerp(new THREE.Color('#010207'), space);
  sky.position.copy(camera.position);

  // Main camera render
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.setScissorTest(false);

  if (cameraMode === 'booster') {
    world.visible = true;
    missionGroup.visible = false;
  } else {
    world.visible = !inSpace;
    missionGroup.visible = inSpace;
  }
  renderer.render(scene, camera);

  // Render PiP if separated and pip is visible
  if (s.separated && ui.boosterPip && !ui.boosterPip.classList.contains('hidden')) {
    const rect = ui.boosterPip.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      // Three.js applies the renderer pixel ratio to viewport and scissor coordinates.
      const pipX = Math.round(rect.left);
      const pipY = Math.round(h - rect.bottom);
      const pipW = Math.round(rect.width);
      const pipH = Math.round(rect.height);

      renderer.setScissorTest(true);
      renderer.setScissor(pipX, pipY, pipW, pipH);
      renderer.setViewport(pipX, pipY, pipW, pipH);

      pipCamera.aspect = rect.width / rect.height;
      pipCamera.updateProjectionMatrix();

      if (cameraMode === 'booster') {
        world.visible = !inSpace;
        missionGroup.visible = inSpace;
        pipCamera.position.copy(rocket.position).add(new THREE.Vector3(14, 5, 20));
        pipCamera.lookAt(rocket.position.x, rocket.position.y + 2, rocket.position.z);
        renderer.render(scene, pipCamera);
      } else {
        world.visible = true;
        missionGroup.visible = false;
        pipCamera.position.copy(booster.position).add(new THREE.Vector3(12, 5, 14));
        pipCamera.lookAt(booster.position.x, booster.position.y + 3, booster.position.z);
        renderer.render(scene, pipCamera);
      }

      renderer.setScissorTest(false);
    }
  }

  updateHud(s);
}

resetCamera({ animate: false });
document.body.classList.add('ready');
frame();
