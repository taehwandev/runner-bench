import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
const TWO_PI = Math.PI * 2;
const PAD_RADIUS = 7;
const PAD_TOP = 0.5;
const HOVER_HEIGHT = 3;
const LAP_RADIUS = 16;
const LAP_ALTITUDE = 7;
const LAP_DURATION = 18; // seconds for one slow lap
const RISE_DURATION = 3.5; // seconds to climb out and reach the lap path
const DEPART_ACCEL = 9; // units/s² — the ship keeps speeding up
const DEPART_LIMIT = 1400; // distance from the pad where the ship is "gone"
const GROUND_SIZE = 4200;
const CLIMB_DURATION = 12;
const JUMP_DURATION = 4;
const DESTINATIONS = {
  azure: { name: 'Azure Reach', position: new THREE.Vector3(10000, 1800, -10000) },
  ember: { name: 'Ember Rings', position: new THREE.Vector3(-10000, 2400, -12000) },
};

// Departure heads away from the default camera, toward the far horizon.
const DEPART_TOWARD = new THREE.Vector3(-0.33, 0, -0.94).normalize();
const DEPART_HEADING = Math.atan2(DEPART_TOWARD.z, DEPART_TOWARD.x);
const DEPART_SPEED_0 = (TWO_PI * LAP_RADIUS) / LAP_DURATION; // match lap speed

// The lap starts where the orbit tangent points along DEPART_TOWARD, so the
// ship leaves the lap heading straight out without an extra turn.
const LAP_START = DEPART_HEADING - Math.PI / 2;
const LAP_START_POS = new THREE.Vector3(
  LAP_RADIUS * Math.cos(LAP_START),
  LAP_ALTITUDE,
  LAP_RADIUS * Math.sin(LAP_START),
);

const DEFAULT_CAM = {
  position: new THREE.Vector3(26, 13, 34),
  target: new THREE.Vector3(0, 3, 0),
};

const HORIZON_COLOR = 0xcfe8ff;
const SUN_DIR = new THREE.Vector3(0.5, 0.75, -0.45).normalize();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = THREE.MathUtils.damp;

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);

// Gentle rolling terrain, perfectly flat around the pad.
function groundHeight(x, z) {
  const d = Math.hypot(x, z);
  const flat = smoothstep(26, 90, d);
  const h =
    14 * Math.sin(x * 0.0045 + 1.3) * Math.cos(z * 0.0052) +
    4 * Math.sin(x * 0.03) * Math.sin(z * 0.027);
  return h * flat;
}

// Keep trees and rocks out of the pad and out of the departure corridor.
function clearOfPath(x, z) {
  const rx = x - LAP_START_POS.x;
  const rz = z - LAP_START_POS.z;
  const along = rx * DEPART_TOWARD.x + rz * DEPART_TOWARD.z;
  const lateral = Math.abs(DEPART_TOWARD.x * rz - DEPART_TOWARD.z * rx);
  const inCorridor = along > -10 && along < DEPART_LIMIT + 40 && lateral < 22;
  return !inCorridor && Math.hypot(x, z) > 42;
}

function scatter(count, minR, maxR) {
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 12; tries++) {
    const a = rand() * TWO_PI;
    const r = Math.sqrt(rand() * (maxR * maxR - minR * minR) + minR * minR);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!clearOfPath(x, z)) continue;
    out.push({ x, z, y: groundHeight(x, z), s: 0.8 + rand() * 0.7, r: rand() * TWO_PI });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Renderer, scene, camera, controls
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(HORIZON_COLOR, 350, 2600);

const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 8000);
camera.position.copy(DEFAULT_CAM.position);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(DEFAULT_CAM.target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 8;
controls.maxDistance = 400;
controls.minPolarAngle = 0.05;
controls.maxPolarAngle = Math.PI * 0.49; // stay above the ground
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.update();

// Any manual orbit/zoom cancels an in-progress camera tween.
let tween = null;
controls.addEventListener('start', () => {
  tween = null;
});

// ---------------------------------------------------------------------------
// Sky, sun, lights
// ---------------------------------------------------------------------------
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(3500, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#2f6fd0') },
      horizonColor: { value: new THREE.Color(HORIZON_COLOR) },
      sunDir: { value: SUN_DIR },
      spaceMix: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunDir;
      uniform float spaceMix;
      varying vec3 vWorld;
      void main() {
        vec3 d = normalize(vWorld);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.93, 0.75) * (pow(s, 900.0) * 1.2 + pow(s, 12.0) * 0.18);
        vec3 cell = floor(d * 850.0);
        float star = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        float stars = step(0.998, star) * (0.5 + 0.5 * star);
        vec3 space = vec3(0.004, 0.008, 0.025) + vec3(0.75, 0.85, 1.0) * stars;
        col = mix(col, space, spaceMix);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }),
);
sky.renderOrder = -10;
scene.add(sky);

const sun = new THREE.DirectionalLight('#fff3dc', 2.6);
sun.position.copy(SUN_DIR).multiplyScalar(160);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 400 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight('#c4e6ff', '#5b7a3a', 1.1));

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------
function makeGrassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#6fae4a';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const dark = rand() < 0.5;
    g.fillStyle = dark ? 'rgba(60,120,40,0.35)' : 'rgba(150,200,90,0.3)';
    g.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 2 + rand() * 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GROUND_SIZE / 24, GROUND_SIZE / 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 210, 210);
groundGeo.rotateX(-Math.PI / 2);
const groundPos = groundGeo.attributes.position;
for (let i = 0; i < groundPos.count; i++) {
  groundPos.setY(i, groundHeight(groundPos.getX(i), groundPos.getZ(i)));
}
groundGeo.computeVertexNormals();

const ground = new THREE.Mesh(
  groundGeo,
  new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1 }),
);
ground.receiveShadow = true;
scene.add(ground);

// ---------------------------------------------------------------------------
// Landing pad
// ---------------------------------------------------------------------------
const padGroup = new THREE.Group();
scene.add(padGroup);

const slab = new THREE.Mesh(
  new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS + 0.4, 0.5, 96),
  new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.9 }),
);
slab.position.y = 0.25;
slab.receiveShadow = true;
slab.castShadow = true;
padGroup.add(slab);

const ringMark = new THREE.Mesh(
  new THREE.RingGeometry(PAD_RADIUS * 0.7, PAD_RADIUS * 0.76, 96),
  new THREE.MeshBasicMaterial({ color: 0xffd23f }),
);
ringMark.rotation.x = -Math.PI / 2;
ringMark.position.y = PAD_TOP + 0.02;
padGroup.add(ringMark);

const paint = new THREE.MeshBasicMaterial({ color: 0xffffff });
const hMark = new THREE.Group();
hMark.position.y = PAD_TOP + 0.02;
[
  [-0.8, 0, 0.35, 2.6, 0.02],
  [0.8, 0, 0.35, 2.6, 0.02],
  [0, 0, 1.6, 0.35, 0.02],
].forEach(([x, y, w, d, h]) => {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint);
  bar.position.set(x, y, 0);
  hMark.add(bar);
});
padGroup.add(hMark);

const lampMats = [];
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * TWO_PI;
  const mat = new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true });
  lampMats.push(mat);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat);
  lamp.position.set(Math.cos(a) * (PAD_RADIUS - 0.25), PAD_TOP + 0.12, Math.sin(a) * (PAD_RADIUS - 0.25));
  padGroup.add(lamp);
}

// Eight floodlight posts ringing the pad, just inside the lap path.
const postGeo = new THREE.CylinderGeometry(0.12, 0.18, 4, 8);
postGeo.translate(0, 2, 0);
const postMat = new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.2, roughness: 0.5 });
const headGeo = new THREE.SphereGeometry(0.42, 14, 10);
const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xffe9b0, emissiveIntensity: 0.9 });
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * TWO_PI + 0.4;
  const x = Math.cos(a) * 12.5;
  const z = Math.sin(a) * 12.5;
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(x, 0.5, z);
  post.castShadow = true;
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(x, 4.6, z);
  scene.add(post, head);
}

// ---------------------------------------------------------------------------
// Surrounding scenery (instanced where possible)
// ---------------------------------------------------------------------------
const dummy = new THREE.Object3D();
function instanced(geo, mat, items, { castShadow = true, yOffset = 0, sy = 1 } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    dummy.position.set(it.x, it.y + yOffset, it.z);
    dummy.rotation.set(0, it.r, 0);
    dummy.scale.set(it.s, it.s * sy, it.s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
trunkGeo.translate(0, 1.5, 0);
const crownGeo = new THREE.ConeGeometry(2.2, 6, 7);
crownGeo.translate(0, 6, 0);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 });
const crownMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.9, flatShading: true });

const trees = scatter(260, 40, 650);
instanced(trunkGeo, trunkMat, trees);
instanced(crownGeo, crownMat, trees);

const bushes = scatter(260, 22, 560);
const bushGeo = new THREE.SphereGeometry(1, 8, 6);
bushGeo.translate(0, 0.5, 0);
instanced(bushGeo, new THREE.MeshStandardMaterial({ color: 0x5ea552, roughness: 1, flatShading: true }), bushes, { sy: 0.7 });

const rocks = scatter(70, 30, 700);
instanced(
  new THREE.DodecahedronGeometry(1, 0),
  new THREE.MeshStandardMaterial({ color: 0x9a9fa8, roughness: 0.95, flatShading: true }),
  rocks,
  { yOffset: -0.2, sy: 0.7 },
);

// Distant mountains, softened by the horizon fog.
const mountainGeo = new THREE.ConeGeometry(1, 1, 7);
mountainGeo.translate(0, 0.5, 0);
const mountainMat = new THREE.MeshStandardMaterial({ color: 0x7e95b8, roughness: 1, flatShading: true });
for (let i = 0; i < 26; i++) {
  const a = (i / 26) * TWO_PI + rand() * 0.2;
  const r = 2050 + rand() * 120;
  const w = 220 + rand() * 180;
  const h = 260 + rand() * 260;
  const m = new THREE.Mesh(mountainGeo, mountainMat);
  m.scale.set(w, h, w);
  m.position.set(Math.cos(a) * r, -30, Math.sin(a) * r);
  scene.add(m);
}

// Soft clouds that drift slowly across the sky.
const puffGeo = new THREE.SphereGeometry(1, 14, 10);
const cloudMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 1,
  emissive: 0xdfe9f5,
  emissiveIntensity: 0.25,
});
const clouds = [];
for (let i = 0; i < 28; i++) {
  const cloud = new THREE.Group();
  const puffs = 4 + Math.floor(rand() * 3);
  for (let p = 0; p < puffs; p++) {
    const puff = new THREE.Mesh(puffGeo, cloudMat);
    puff.position.set((rand() - 0.5) * 16, (rand() - 0.5) * 3, (rand() - 0.5) * 8);
    puff.scale.setScalar(4 + rand() * 4);
    cloud.add(puff);
  }
  const a = rand() * TWO_PI;
  const r = 120 + rand() * 780;
  cloud.position.set(Math.cos(a) * r, 90 + rand() * 60, Math.sin(a) * r);
  cloud.userData.speed = 1.5 + rand() * 2.5;
  scene.add(cloud);
  clouds.push(cloud);
}

// ---------------------------------------------------------------------------
// Spaceship (nose along +X; heading is applied to the root group)
// ---------------------------------------------------------------------------
function buildShip() {
  const root = new THREE.Group();
  const pitch = new THREE.Group();
  const bank = new THREE.Group();
  root.add(pitch);
  pitch.add(bank);

  const hull = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, metalness: 0.3, roughness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x2a7de1, metalness: 0.4, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4152, metalness: 0.6, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x0d2b4d,
    metalness: 0.2,
    roughness: 0.08,
    emissive: 0x12477a,
    emissiveIntensity: 0.5,
  });

  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    bank.add(m);
    return m;
  };

  // Fuselage and nose
  add(new THREE.SphereGeometry(1, 32, 16), hull).scale.set(2.6, 0.85, 1.0);
  const noseGeo = new THREE.ConeGeometry(0.85, 1.6, 32);
  noseGeo.rotateZ(-Math.PI / 2);
  add(noseGeo, hull, 3.0, 0, 0);

  // Cockpit canopy
  add(new THREE.SphereGeometry(0.7, 24, 12), glass, 1.2, 0.55, 0).scale.set(1.2, 0.7, 0.9);

  // Swept delta wings (one extruded shape, mirrored for the other side)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(1.2, 0);
  wingShape.lineTo(-1.6, 0);
  wingShape.lineTo(-2.4, 2.9);
  wingShape.lineTo(-0.7, 2.9);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: 1,
  });
  wingGeo.rotateX(-Math.PI / 2);
  add(wingGeo, accent, 0, -0.05, 0);
  add(wingGeo, accent, 0, -0.05, 0).scale.z = -1;

  // Tail fin
  const finShape = new THREE.Shape();
  finShape.moveTo(0.9, 0);
  finShape.lineTo(-0.9, 0);
  finShape.lineTo(-1.5, 1.6);
  finShape.lineTo(-0.6, 1.6);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: false });
  finGeo.translate(0, 0, -0.06);
  add(finGeo, accent, -1.4, 0.7, 0);

  // Engines and flames
  const engineGeo = new THREE.CylinderGeometry(0.42, 0.52, 1.6, 20);
  engineGeo.rotateZ(Math.PI / 2);
  const flameOuterGeo = new THREE.ConeGeometry(0.36, 1.8, 16);
  flameOuterGeo.translate(0, 0.9, 0);
  flameOuterGeo.rotateZ(Math.PI / 2);
  const flameInnerGeo = new THREE.ConeGeometry(0.2, 1.1, 12);
  flameInnerGeo.translate(0, 0.55, 0);
  flameInnerGeo.rotateZ(Math.PI / 2);
  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: 0x3aa0ff,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameInnerMat = new THREE.MeshBasicMaterial({
    color: 0x9ff2ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const flames = [];
  for (const z of [-0.75, 0.75]) {
    add(engineGeo, dark, -2.5, -0.25, z);
    for (const [geo, mat] of [
      [flameOuterGeo, flameOuterMat],
      [flameInnerGeo, flameInnerMat],
    ]) {
      const f = new THREE.Mesh(geo, mat);
      f.position.set(-3.3, -0.25, z);
      bank.add(f);
      flames.push(f);
    }
  }

  // Navigation lights: steady wingtips, blinking strobe on the fin
  const tipGeo = new THREE.SphereGeometry(0.12, 10, 8);
  add(tipGeo, new THREE.MeshBasicMaterial({ color: 0xff4d4d }), -1.55, 0.05, -2.9);
  add(tipGeo, new THREE.MeshBasicMaterial({ color: 0x4dff88 }), -1.55, 0.05, 2.9);
  const strobe = add(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), -1.4, 2.3, 0);
  strobe.castShadow = false;

  return { root, pitch, bank, flames, strobe };
}

const ship = buildShip();
scene.add(ship.root);

// Each destination owns a separate arrival scene, shown only after the jump.
const destination = new THREE.Group();
destination.position.copy(DESTINATIONS.azure.position);
const planet = new THREE.Mesh(
  new THREE.SphereGeometry(170, 48, 32),
  new THREE.MeshStandardMaterial({ color: 0x6486bd, roughness: 0.85, emissive: 0x101a38 }),
);
planet.position.set(-280, -110, -900);
destination.add(planet);
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(32, 24, 16),
  new THREE.MeshStandardMaterial({ color: 0xc2b7a4, roughness: 1 }),
);
moon.position.set(180, 100, -700);
destination.add(moon);
scene.add(destination);

function buildEmberArrival() {
  const group = new THREE.Group();
  group.position.copy(DESTINATIONS.ember.position);
  const world = new THREE.Group();
  world.position.set(-150, -40, -700);
  world.rotation.set(0.35, 0.15, 0.4);
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(155, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0xd78a48, roughness: 0.85, emissive: 0x341508 }),
  );
  world.add(globe);
  for (const [inner, outer, color] of [[195, 220, 0xf3ce88], [230, 265, 0xa56c45], [275, 310, 0xe3b570]]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 96),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1 }),
    );
    ring.rotation.x = -Math.PI / 2;
    world.add(ring);
  }
  group.add(world);
  const random = mulberry32(711);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9e8270, roughness: 1, flatShading: true });
  const belt = new THREE.InstancedMesh(rockGeo, rockMat, 70);
  const rock = new THREE.Object3D();
  for (let i = 0; i < 70; i++) {
    rock.position.set((random() - 0.5) * 1000, (random() - 0.5) * 360, -350 - random() * 850);
    rock.rotation.set(random() * Math.PI, random() * Math.PI, 0);
    rock.scale.setScalar(2 + random() * 8);
    rock.updateMatrix();
    belt.setMatrixAt(i, rock.matrix);
  }
  group.add(belt);
  scene.add(group);
  return group;
}

const arrivalScenes = { azure: destination, ember: buildEmberArrival() };

// A camera-facing expanding ring and core make both ends of the jump visible.
const jumpEffect = new THREE.Group();
const jumpRing = new THREE.Mesh(
  new THREE.RingGeometry(0.8, 1, 64),
  new THREE.MeshBasicMaterial({ color: 0x65dfff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
);
const jumpCore = new THREE.Mesh(
  new THREE.CircleGeometry(1, 64),
  new THREE.MeshBasicMaterial({ color: 0xc8f7ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
);
jumpEffect.add(jumpRing, jumpCore);
scene.add(jumpEffect);

// Soft ground shadow that shrinks and fades with altitude.
function makeBlobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.9)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false, color: 0x000000 }),
);
blob.rotation.x = -Math.PI / 2;
blob.renderOrder = 1;
scene.add(blob);

// ---------------------------------------------------------------------------
// Flight state machine: hover → rise → lap → depart → climb → jump → arrived
// ---------------------------------------------------------------------------
const state = {
  phase: 'hover',
  phaseT: 0,
  time: 0,
  pos: new THREE.Vector3(0, HOVER_HEIGHT, 0),
  riseFrom: new THREE.Vector3(),
  heading: 0,
  roll: 0,
  pitch: 0,
  flame: 0.6,
  zoomGoal: 1,
  camScale: 1,
  follow: false,
  paused: false,
  climbFrom: new THREE.Vector3(),
  spaceMix: 0,
  jumped: false,
  destinationId: 'azure',
};

function setPhase(phase) {
  state.phase = phase;
  state.phaseT = 0;
}

function updateShip(dt) {
  const s = state;
  s.phaseT += dt;

  let headingGoal = 0;
  let omega = 0; // turn rate, drives banking
  let pitchGoal = 0;
  let flameGoal = 0.6;

  switch (s.phase) {
    case 'hover':
      s.pos.set(0, HOVER_HEIGHT + Math.sin(s.time * 1.6) * 0.18, 0);
      break;

    case 'rise': {
      const k = easeInOut(clamp01(s.phaseT / RISE_DURATION));
      s.pos.lerpVectors(s.riseFrom, LAP_START_POS, k);
      headingGoal = DEPART_HEADING;
      flameGoal = 1.0;
      if (s.phaseT >= RISE_DURATION) setPhase('lap');
      break;
    }

    case 'lap': {
      const u = clamp01(s.phaseT / LAP_DURATION);
      const th = LAP_START + TWO_PI * u;
      s.pos.set(LAP_RADIUS * Math.cos(th), LAP_ALTITUDE, LAP_RADIUS * Math.sin(th));
      headingGoal = th + Math.PI / 2; // tangent to the orbit
      omega = TWO_PI / LAP_DURATION;
      flameGoal = 0.8;
      if (u >= 1) setPhase('depart');
      break;
    }

    case 'depart': {
      const speed = DEPART_SPEED_0 + DEPART_ACCEL * s.phaseT;
      s.pos.addScaledVector(DEPART_TOWARD, speed * dt);
      s.pos.y = LAP_ALTITUDE + Math.min(s.phaseT * 0.5, 6);
      headingGoal = DEPART_HEADING;
      pitchGoal = 0.06;
      flameGoal = 1.0 + 0.6 * clamp01(s.phaseT / 4);
      s.zoomGoal = 1 + 1.4 * clamp01(s.phaseT / 15);
      if (Math.hypot(s.pos.x, s.pos.z) >= DEPART_LIMIT) {
        s.climbFrom.copy(s.pos);
        setPhase('climb');
      }
      break;
    }

    case 'climb': {
      const u = clamp01(s.phaseT / CLIMB_DURATION);
      s.pos.copy(s.climbFrom).addScaledVector(DEPART_TOWARD, 380 * u);
      s.pos.y = s.climbFrom.y + 1500 * easeInOut(u);
      s.spaceMix = smoothstep(0.15, 0.9, u);
      headingGoal = DEPART_HEADING;
      pitchGoal = 0.55 * Math.sin(Math.PI * u);
      flameGoal = 1.5;
      if (u >= 1) setPhase('jump');
      break;
    }

    case 'jump': {
      const u = clamp01(s.phaseT / JUMP_DURATION);
      headingGoal = DEPART_HEADING;
      flameGoal = 1.5;
      if (u >= 0.5 && !s.jumped) {
        s.pos.copy(DESTINATIONS[s.destinationId].position);
        s.jumped = true;
      }
      if (u >= 1) setPhase('arrived');
      break;
    }

    case 'arrived':
      headingGoal = DEPART_HEADING;
      flameGoal = 0.7;
      break;
  }

  s.heading += wrapAngle(headingGoal - s.heading) * (1 - Math.exp(-4 * dt));
  s.roll = damp(s.roll, THREE.MathUtils.clamp(omega * 1.2, -0.42, 0.42), 3, dt);
  s.pitch = damp(s.pitch, pitchGoal, 2, dt);
  s.flame = damp(s.flame, flameGoal, 4, dt);

  ship.root.position.copy(s.pos);
  ship.root.rotation.y = -s.heading; // three.js yaw is clockwise-positive; heading is atan2(z, x)
  ship.bank.rotation.x = s.roll;
  ship.pitch.rotation.z = s.pitch;

  ship.flames.forEach((f, i) => {
    f.scale.x = s.flame * (0.92 + 0.08 * Math.sin(s.time * 41 + i * 1.7));
  });
  ship.strobe.visible = s.time % 1.4 < 0.15;
}

function launch() {
  if (state.phase === 'arrived') {
    resetScene();
    tween = null;
    camera.position.copy(DEFAULT_CAM.position);
    controls.target.copy(DEFAULT_CAM.target);
    state.heading = state.roll = state.pitch = 0;
    state.flame = 0.6;
    state.camScale = 1;
  }
  if (state.phase !== 'hover') return;
  state.destinationId = el.destination.value;
  state.riseFrom.copy(state.pos);
  state.follow = true;
  syncFollowButton();
  setPhase('rise');
}

function resetScene() {
  state.paused = false;
  setPhase('hover');
  state.pos.set(0, HOVER_HEIGHT, 0);
  state.zoomGoal = 1;
  state.spaceMix = 0;
  state.jumped = false;
  state.follow = false;
  syncFollowButton();
  resetCamera();
}

// ---------------------------------------------------------------------------
// Camera: follow, zoom, reset
// ---------------------------------------------------------------------------
const followGoal = new THREE.Vector3();

// The orbit target sits exactly on the ship every frame, so the ship stays in
// the center of the view at any zoom. The camera moves by the same delta, which
// keeps the user's viewing angle and zoom. While departing, the distance eases
// out so the ship stays readable as it recedes.
function followShip(dt) {
  followGoal.copy(state.pos);
  const shift = followGoal.sub(controls.target);
  controls.target.copy(state.pos);
  camera.position.add(shift);

  state.camScale = damp(state.camScale, state.zoomGoal, 1.5, dt);
  const offset = camera.position.clone().sub(controls.target);
  const base = offset.length() / state.camScale; // user's own zoom, excluding our scaling
  offset.setLength(base * state.camScale);
  camera.position.copy(controls.target).add(offset);
}

function tweenCamera(position, target, duration = 1.1) {
  tween = {
    fromP: camera.position.clone(),
    fromT: controls.target.clone(),
    toP: position.clone(),
    toT: target.clone(),
    t: 0,
    duration,
  };
}

function updateTween(dt) {
  if (!tween) return;
  tween.t += dt;
  const e = easeInOut(clamp01(tween.t / tween.duration));
  camera.position.lerpVectors(tween.fromP, tween.toP, e);
  controls.target.lerpVectors(tween.fromT, tween.toT, e);
  if (tween.t >= tween.duration) tween = null;
}

function resetCamera() {
  state.follow = false;
  syncFollowButton();
  tweenCamera(DEFAULT_CAM.position, DEFAULT_CAM.target);
}

function toggleFollow() {
  state.follow = !state.follow;
  syncFollowButton();
}

function zoomCamera(factor) {
  tween = null;
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() / factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

// ---------------------------------------------------------------------------
// Ambient animation
// ---------------------------------------------------------------------------
function animateAmbient(dt) {
  lampMats.forEach((mat, i) => {
    const wave = Math.sin(state.time * 3 - (i / 16) * TWO_PI * 2);
    mat.opacity = 0.45 + 0.55 * (0.5 + 0.5 * wave);
  });

  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 1000) c.position.x = -1000;
  }

  const s = state;
  const gy = Math.hypot(s.pos.x, s.pos.z) < PAD_RADIUS ? PAD_TOP : groundHeight(s.pos.x, s.pos.z);
  const alt = Math.max(0, s.pos.y - gy);
  blob.position.set(s.pos.x, gy + 0.05, s.pos.z);
  blob.scale.setScalar(2.2 + alt * 0.25);
  blob.material.opacity = 0.5 * Math.exp(-alt / 14);
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
const el = {
  status: document.getElementById('status'),
  bar: document.getElementById('progress-bar'),
  launch: document.getElementById('launch'),
  resetScene: document.getElementById('reset-scene'),
  pause: document.getElementById('pause'),
  zoomIn: document.getElementById('zoom-in'),
  zoomOut: document.getElementById('zoom-out'),
  resetCam: document.getElementById('reset-cam'),
  follow: document.getElementById('follow'),
  hint: document.getElementById('hint'),
  destination: document.getElementById('destination'),
  destinationNote: document.getElementById('destination-note'),
};

const STATUS_TEXT = {
  hover: 'Hovering over Pad 07. Launch when ready.',
  rise: 'Lifting off…',
  lap: 'Slow lap around the pad',
  depart: 'Departing: accelerating out',
  climb: 'Climbing out of the atmosphere',
  jump: 'Jumping to a distant destination',
  arrived: 'Arrived at a distant world. Replay the departure or reset the scene.',
};

let lastStatus = '';
function updateHud() {
  const phase = state.phase;
  let progress = 0;
  let text = STATUS_TEXT[phase];
  const arrivalName = DESTINATIONS[state.destinationId].name;
  if (phase === 'hover') text = `Hovering over Pad 07. Ready for ${DESTINATIONS[el.destination.value].name}.`;
  if (phase === 'jump') text = `Jumping to ${arrivalName}…`;
  if (phase === 'arrived') text = `Arrived at ${arrivalName}. Choose a destination and replay, or reset the scene.`;

  if (phase === 'lap') {
    progress = clamp01(state.phaseT / LAP_DURATION);
    text = `${STATUS_TEXT.lap} · ${Math.round(progress * 100)}%`;
  } else if (phase === 'depart') {
    progress = clamp01(Math.hypot(state.pos.x, state.pos.z) / DEPART_LIMIT);
  } else if (phase === 'climb') {
    progress = clamp01(state.phaseT / CLIMB_DURATION);
  } else if (phase === 'jump') {
    progress = clamp01(state.phaseT / JUMP_DURATION);
  } else if (phase === 'arrived') {
    progress = 1;
  }

  if (state.paused) text = `Paused · ${text}`;

  if (text !== lastStatus) {
    el.status.textContent = text;
    lastStatus = text;
    document.body.dataset.phase = phase;
  }
  el.bar.style.width = `${(progress * 100).toFixed(1)}%`;

  const flying = phase !== 'hover';
  el.destination.disabled = flying && phase !== 'arrived';
  el.destinationNote.textContent = el.destination.disabled
    ? `Route locked · ${arrivalName}`
    : phase === 'arrived' ? 'Choose your next destination, then replay.' : 'Choose your arrival scene before launch.';
  el.launch.disabled = flying && phase !== 'arrived';
  el.launch.textContent = phase === 'hover' ? 'Launch' : phase === 'arrived' ? 'Replay' : 'In flight…';
  el.pause.disabled = !flying || phase === 'arrived';
  el.pause.textContent = state.paused ? 'Resume' : 'Pause';
  el.pause.setAttribute('aria-pressed', String(state.paused));
  el.resetScene.disabled = !flying;
}

function syncFollowButton() {
  el.follow.setAttribute('aria-pressed', String(state.follow));
}

el.launch.addEventListener('click', launch);
el.destination.addEventListener('change', updateHud);
el.pause.addEventListener('click', () => {
  state.paused = !state.paused;
  updateHud();
});
el.resetScene.addEventListener('click', resetScene);
el.zoomIn.addEventListener('click', () => zoomCamera(1.25));
el.zoomOut.addEventListener('click', () => zoomCamera(1 / 1.25));
el.resetCam.addEventListener('click', resetCamera);
el.follow.addEventListener('click', toggleFollow);

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement) return;
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      launch();
      break;
    case 'KeyR':
      resetCamera();
      break;
    case 'KeyF':
      toggleFollow();
      break;
    case 'Equal':
    case 'NumpadAdd':
      zoomCamera(1.2);
      break;
    case 'Minus':
    case 'NumpadSubtract':
      zoomCamera(1 / 1.2);
      break;
  }
});

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
el.hint.textContent = coarsePointer
  ? 'Drag to orbit · Pinch to zoom · Two fingers to pan'
  : 'Drag to orbit · Scroll to zoom · Right-drag to pan · Space to launch';

function resize() {
  const vv = window.visualViewport;
  const w = vv && vv.width ? vv.width : window.innerWidth;
  const h = vv && vv.height ? vv.height : window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.8 ? 66 : 50; // widen the view on portrait phones
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));
resize();

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!state.paused) {
    state.time += dt;
    updateShip(dt);
  }
  updateTween(dt);
  if (state.follow) followShip(dt);
  controls.update();
  animateAmbient(state.paused ? 0 : dt);
  sky.position.copy(camera.position);
  sky.material.uniforms.spaceMix.value = state.spaceMix;
  scene.fog.color.set(HORIZON_COLOR).lerp(new THREE.Color(0x02040d), state.spaceMix);
  scene.fog.near = THREE.MathUtils.lerp(350, 3000, state.spaceMix);
  scene.fog.far = THREE.MathUtils.lerp(2600, 7500, state.spaceMix);
  for (const [id, arrival] of Object.entries(arrivalScenes)) {
    arrival.visible = state.jumped && id === state.destinationId;
  }
  const pulse = state.phase === 'jump' ? Math.pow(Math.sin(Math.PI * ((state.phaseT / JUMP_DURATION * 2) % 1)), 2) : 0;
  jumpEffect.position.copy(state.pos);
  jumpEffect.quaternion.copy(camera.quaternion);
  jumpRing.scale.setScalar(3 + pulse * 13);
  jumpCore.scale.setScalar(3 + pulse * 8);
  jumpRing.material.opacity = pulse * 0.95;
  jumpCore.material.opacity = Math.pow(pulse, 4) * 0.8;
  updateHud();

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(frame);
