import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const TAU = Math.PI * 2;
const CONFIG = {
  hoverHeight: 2.4,       // m above the pad surface
  padRadius: 4,           // m
  lapRadius: 8,           // m, distance of the lap from the pad centre
  lapDuration: 20,        // s for the single slow lap
  lapRamp: 4,             // s to spread out from the pad to the lap radius
  lapStart: (3 * Math.PI) / 4, // lap begins on the far side of the pad from the home camera
  departAccel: 7,         // m/s² added to the lap speed while leaving
  cruiseSpeed: 58,        // m/s top speed on the way out
  exitDistance: 500,      // m along the departure path when the ship counts as departed
  disappearDistance: 2000,// m when the ship is fully lost in the haze and follow stops
  chaseDistance: 36,      // m camera distance kept while following during the climb
  farChaseDistance: 300,  // m camera distance the chase eases out to as the ship recedes
  homeDistance: 24,       // m default camera distance on wide screens
  homeTarget: new THREE.Vector3(0, 1.4, 0),
  visibleHalfWidth: 7,    // m kept in frame horizontally at home (follow mode keeps the ship centred on the lap)
};
const LAP_SPEED = (TAU * CONFIG.lapRadius) / CONFIG.lapDuration;
const FORWARD = new THREE.Vector3(0, 0, 1);      // nose of the ship model points along +Z
const DEPART_DIR = new THREE.Vector3(-1, 0.2, -1).normalize(); // continues the lap's tangent, away from the camera
const HOME_DIR = new THREE.Vector3(0.6, 0.2, 0.7).normalize(); // low angle so the sky fills the top third

const smoothstep = (x) => { const c = THREE.MathUtils.clamp(x, 0, 1); return c * c * (3 - 2 * c); };
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// ---------- Renderer, scene, camera ----------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const HORIZON = new THREE.Color('#d3ecff');
const SKY_TOP = new THREE.Color('#2f7fd6');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(HORIZON, 160, 1400);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 4000);

// ---------- Lights and sky ----------
const sunPosition = new THREE.Vector3(60, 110, 50);
const hemi = new THREE.HemisphereLight(0xdff2ff, 0x6b8f4a, 1.5);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.copy(sunPosition);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 300;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(2500, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: SKY_TOP },
      horizon: { value: HORIZON },
      sunDir: { value: sunPosition.clone().normalize() },
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
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.95, 0.8) * pow(s, 240.0) * 0.9;
        col += vec3(1.0, 0.9, 0.7) * pow(s, 8.0) * 0.12;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
);
sky.frustumCulled = false;
scene.add(sky);

// ---------- Textures generated on canvas (no external image files) ----------
function canvasTexture(size, draw, { repeat = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  return tex;
}

function radialTexture(stops) {
  return canvasTexture(128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([offset, alpha]) => grd.addColorStop(offset, `rgba(255,255,255,${alpha})`));
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
}

const grassTexture = canvasTexture(256, (g, s) => {
  g.fillStyle = '#8cbb6a';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 1200; i++) {
    g.fillStyle = `hsla(${95 + Math.random() * 25}, ${40 + Math.random() * 25}%, ${30 + Math.random() * 25}%, 0.28)`;
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 3);
  }
}, { repeat: true });
grassTexture.repeat.set(160, 160);

const padTexture = canvasTexture(512, (g, s) => {
  const c = s / 2;
  g.clearRect(0, 0, s, s);
  g.fillStyle = '#eef2f6';
  g.beginPath();
  g.arc(c, c, 214, 0, TAU);
  g.fill();
  g.strokeStyle = '#ffc93c';
  g.lineWidth = 26;
  g.beginPath();
  g.arc(c, c, 232, 0, TAU);
  g.stroke();
  g.fillStyle = '#2f5fb0';
  g.font = 'bold 300px system-ui, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('H', c, c + 12);
});

const glowTexture = radialTexture([[0, 1], [0.25, 0.55], [0.6, 0.14], [1, 0]]);
const shadowTexture = radialTexture([[0, 0.8], [0.5, 0.45], [1, 0]]);

// ---------- Ground ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(6000, 6000),
  new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---------- Landing pad ----------
const pad = new THREE.Group();
const slab = new THREE.Mesh(
  new THREE.CylinderGeometry(CONFIG.padRadius, CONFIG.padRadius + 0.3, 0.4, 80),
  new THREE.MeshStandardMaterial({ color: '#c3c9d1', roughness: 0.9 })
);
slab.position.y = 0.2;
slab.castShadow = true;
slab.receiveShadow = true;
const rim = new THREE.Mesh(
  new THREE.CylinderGeometry(4.9, 5.0, 0.12, 80),
  new THREE.MeshStandardMaterial({ color: '#5d6670', roughness: 1 })
);
rim.position.y = 0.06;
rim.receiveShadow = true;
const marking = new THREE.Mesh(
  new THREE.CircleGeometry(3.6, 72),
  new THREE.MeshStandardMaterial({ map: padTexture, transparent: true, roughness: 0.6 })
);
marking.rotation.x = -Math.PI / 2;
marking.position.y = 0.403;
marking.receiveShadow = true;
pad.add(slab, rim, marking);

const padLightMaterial = new THREE.MeshBasicMaterial({ color: 0xffb347 });
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * TAU;
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), padLightMaterial);
  light.position.set(Math.cos(a) * 4.02, 0.42, Math.sin(a) * 4.02);
  pad.add(light);
}
scene.add(pad);

// ---------- Surrounding scenery ----------
const rand = (a, b) => a + Math.random() * (b - a);
const polar = (r, a) => new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
const UP = new THREE.Vector3(0, 1, 0);
const clearRadius = 45; // keep the pad area open so the lap and climb read cleanly

function addForest(count = 240) {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.2, 6);
  trunkGeo.translate(0, 1.1, 0);
  const crownGeo = new THREE.ConeGeometry(1.8, 4.2, 7);
  crownGeo.translate(0, 3.6, 0);

  const trunks = new THREE.InstancedMesh(
    trunkGeo, new THREE.MeshStandardMaterial({ color: '#7a5536', roughness: 1 }), count
  );
  const crowns = new THREE.InstancedMesh(
    crownGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true }), count
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const p = polar(rand(clearRadius, 330), rand(0, TAU));
    const sc = rand(0.8, 1.7);
    s.set(sc, sc * rand(0.9, 1.25), sc);
    m.compose(p, q.setFromAxisAngle(UP, rand(0, TAU)), s);
    trunks.setMatrixAt(i, m);
    crowns.setMatrixAt(i, m);
    crowns.setColorAt(i, color.setHSL(rand(0.26, 0.34), rand(0.4, 0.6), rand(0.26, 0.4)));
  }
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks, crowns);
}

function addRocks(count = 70) {
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: '#a2a8ae', roughness: 0.95, flatShading: true }),
    count
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const sc = rand(0.4, 2.4);
    s.set(sc * rand(0.8, 1.3), sc * rand(0.5, 0.9), sc * rand(0.8, 1.3));
    q.setFromEuler(new THREE.Euler(rand(0, TAU), rand(0, TAU), rand(0, TAU)));
    m.compose(polar(rand(30, 260), rand(0, TAU)).setY(sc * 0.2), q, s);
    rocks.setMatrixAt(i, m);
  }
  rocks.castShadow = true;
  scene.add(rocks);
}

function addHills(count = 18) {
  const mat = new THREE.MeshStandardMaterial({ color: '#6fa35a', roughness: 1 });
  for (let i = 0; i < count; i++) {
    const r = rand(90, 150);
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), mat);
    hill.scale.set(r, r * rand(0.22, 0.34), r);
    hill.position.copy(polar(rand(400, 560), (i / count) * TAU + rand(-0.2, 0.2)));
    hill.receiveShadow = true;
    scene.add(hill);
  }
}

function addMountains(count = 22) {
  const cone = new THREE.ConeGeometry(1, 1, 8, 1);
  for (let i = 0; i < count; i++) {
    const rad = rand(160, 260);
    const h = rand(220, 360);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.58, 0.12, rand(0.5, 0.62)),
      roughness: 1,
      flatShading: true,
    });
    const peak = new THREE.Mesh(cone, mat);
    peak.scale.set(rad, h, rad);
    peak.position.copy(polar(rand(900, 1150), (i / count) * TAU + rand(-0.1, 0.1)));
    peak.position.y = h / 2 - 8;
    scene.add(peak);
  }
}

const clouds = [];
function addClouds(count = 14) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.08 });
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat);
      puff.scale.setScalar(rand(6, 11));
      puff.position.set((j - 2) * 7 + rand(-2, 2), rand(0, 2.5), rand(-4, 4));
      group.add(puff);
    }
    group.position.set(rand(-500, 500), rand(95, 150), rand(-500, 500));
    group.userData.speed = rand(1.5, 3.5);
    scene.add(group);
    clouds.push(group);
  }
}

addForest();
addRocks();
addHills();
addMountains();
addClouds();

// ---------- Spaceship ----------
function buildShip() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#e8eef6', metalness: 0.45, roughness: 0.3 });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#ff7a3d', metalness: 0.2, roughness: 0.45 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#2b3442', metalness: 0.6, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#7fd6ff', metalness: 0.1, roughness: 0.05, emissive: '#15506b', emissiveIntensity: 0.6 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff4040' });

  // Fuselage: a lathe profile, turned so its axis runs along Z (nose at +Z).
  const profile = [
    [0.0, -2.0], [0.45, -1.7], [0.85, -1.1], [1.0, -0.2],
    [1.0, 0.6], [0.8, 1.4], [0.45, 1.85], [0.0, 2.05],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const hullGeo = new THREE.LatheGeometry(profile, 48);
  hullGeo.rotateX(Math.PI / 2);
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.scale.y = 0.7;
  hull.castShadow = true;
  group.add(hull);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 16), glassMat);
  canopy.scale.set(1, 0.55, 1.5);
  canopy.position.set(0, 0.42, 0.7);
  group.add(canopy);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 1.1), accentMat);
  fin.position.set(0, 0.95, -1.0);
  fin.castShadow = true;
  group.add(fin);

  // Swept wings with a wingtip beacon each.
  const beacons = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.5), accentMat);
    wing.position.set(side * 1.5, -0.2, -0.35);
    wing.rotation.y = side * 0.35;
    wing.castShadow = true;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), beaconMat);
    beacon.position.set(side * 0.95, 0.06, -0.4);
    wing.add(beacon);
    beacons.push(beacon);
    group.add(wing);
  }

  // Twin engines under the wings with glowing nozzles at the back.
  const engineGeo = new THREE.CylinderGeometry(0.32, 0.38, 1.7, 20);
  engineGeo.rotateX(Math.PI / 2);
  const nozzleGeo = new THREE.CircleGeometry(0.3, 20);
  nozzleGeo.rotateY(Math.PI); // face -Z, toward the exhaust
  const nozzleMat = new THREE.MeshBasicMaterial({ color: '#9ff0ff' });

  const exhausts = [];
  for (const side of [-1, 1]) {
    const x = side * 0.95;
    const engine = new THREE.Mesh(engineGeo, darkMat);
    engine.position.set(x, -0.45, -1.2);
    engine.castShadow = true;
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.set(x, -0.45, -2.07);
    group.add(engine, nozzle);

    // Soft additive glow sprites trailing behind each nozzle (opposite the motion).
    [[-2.3, 1.0, 0.9], [-3.1, 1.7, 0.6], [-4.1, 2.6, 0.35]].forEach(([z, size, alpha], i) => {
      const mat = new THREE.SpriteMaterial({
        map: glowTexture,
        color: i === 0 ? '#e9fbff' : '#7fe3ff',
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, -0.45, z);
      group.add(sprite);
      exhausts.push({ sprite, mat, size, alpha, phase: side * 2 + i });
    });
  }

  return { group, exhausts, beacons };
}

const ship = buildShip();
scene.add(ship.group);

// Soft contact shadow that follows the ship over the pad or grass.
const blobMaterial = new THREE.MeshBasicMaterial({
  map: shadowTexture, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false,
});
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMaterial);
blob.rotation.x = -Math.PI / 2;
scene.add(blob);

// ---------- Flight state ----------
const shipPos = new THREE.Vector3(0, CONFIG.hoverHeight, 0);
const prevPos = shipPos.clone();
const aimDir = FORWARD.clone();
const aimQuat = new THREE.Quaternion();
const bankQuat = new THREE.Quaternion();
const targetQuat = new THREE.Quaternion();
const velocity = new THREE.Vector3();
const scratch = new THREE.Vector3();
const flight = {
  phase: 'hover', // hover -> lap -> depart -> gone
  phaseTime: 0,
  departStart: new THREE.Vector3(),
  departDistance: 0,
  thrust: 0.35,
  followOn: false,
};

const PHASE_TEXT = {
  hover: 'Hovering above the landing pad',
  lap: 'Slow lap around the pad…',
  depart: 'Departing — climbing away',
  gone: 'Departed — the ship has left the area',
};

const statusEl = document.getElementById('status');
const departBtn = document.getElementById('depart');
const followBtn = document.getElementById('follow');

function syncUi() {
  statusEl.textContent = PHASE_TEXT[flight.phase];
  departBtn.textContent = flight.phase === 'hover' ? 'Depart' : flight.phase === 'gone' ? 'Departed' : 'Departing…';
  departBtn.disabled = flight.phase !== 'hover';
  followBtn.setAttribute('aria-pressed', String(flight.followOn));
}

function startDeparture() {
  if (flight.phase !== 'hover') return;
  flight.phase = 'lap';
  flight.phaseTime = 0;
  flight.followOn = true;
  syncUi();
}

function updateShip(dt, t) {
  let thrustTarget = 0.35;
  let ramp = 0;
  let bank = 0;

  if (flight.phase === 'hover') {
    shipPos.set(0, CONFIG.hoverHeight + Math.sin(t * 1.4) * 0.12, 0);
    aimDir.copy(FORWARD);
    bank = Math.sin(t * 1.1) * 0.04;
    thrustTarget = 0.35 + Math.sin(t * 5) * 0.05;
  } else if (flight.phase === 'lap') {
    flight.phaseTime += dt;
    ramp = smoothstep(flight.phaseTime / CONFIG.lapRamp);
    const angle = CONFIG.lapStart + (flight.phaseTime / CONFIG.lapDuration) * TAU;
    const r = CONFIG.lapRadius * ramp;
    shipPos.set(Math.cos(angle) * r, CONFIG.hoverHeight + 1.2 * ramp, Math.sin(angle) * r);
    thrustTarget = 0.6;

    // Lean into the turn: lift the side of the ship that faces the pad centre.
    const right = scratch.set(-1, 0, 0).applyQuaternion(ship.group.quaternion);
    const cx = -shipPos.x;
    const cz = -shipPos.z;
    const len = Math.hypot(cx, cz) || 1;
    const lean = ((cx / len) * right.x + (cz / len) * right.z) * 0.5;
    bank = THREE.MathUtils.clamp(lean, -0.5, 0.5) * ramp;

    if (flight.phaseTime >= CONFIG.lapDuration) {
      flight.phase = 'depart';
      flight.phaseTime = 0;
      flight.departStart.copy(shipPos);
      flight.departDistance = 0;
      syncUi();
    }
  } else {
    // depart / gone: straight climb away along DEPART_DIR, accelerating to cruise speed.
    flight.phaseTime += dt;
    const speed = Math.min(CONFIG.cruiseSpeed, LAP_SPEED + CONFIG.departAccel * flight.phaseTime);
    flight.departDistance += speed * dt;
    shipPos.copy(flight.departStart).addScaledVector(DEPART_DIR, flight.departDistance);
    thrustTarget = 0.55 + 0.45 * (speed / CONFIG.cruiseSpeed);
    if (flight.phase === 'depart' && flight.departDistance >= CONFIG.exitDistance) {
      flight.phase = 'gone';
      syncUi();
    }
    if (flight.phase === 'gone' && flight.departDistance >= CONFIG.disappearDistance) {
      flight.followOn = false; // lost in the haze; the camera now rests where it is
      syncUi();
    }
  }

  // Heading follows real velocity; during hover the nose holds its position.
  velocity.subVectors(shipPos, prevPos);
  prevPos.copy(shipPos);
  if (dt > 0 && flight.phase !== 'hover') {
    velocity.divideScalar(dt);
    if (velocity.lengthSq() > 1e-4) aimDir.copy(velocity).normalize();
  }

  aimQuat.setFromUnitVectors(FORWARD, aimDir);
  bankQuat.setFromAxisAngle(FORWARD, bank);
  targetQuat.copy(aimQuat).multiply(bankQuat);
  ship.group.quaternion.slerp(targetQuat, 1 - Math.exp(-5 * dt));
  ship.group.position.copy(shipPos);

  flight.thrust += (thrustTarget - flight.thrust) * (1 - Math.exp(-3 * dt));
}

function updateEffects(dt, t) {
  const k = flight.thrust;
  for (const ex of ship.exhausts) {
    const flicker = 1 + 0.08 * Math.sin(t * 37 + ex.phase);
    ex.sprite.scale.setScalar(ex.size * (0.5 + 0.9 * k) * flicker);
    ex.mat.opacity = ex.alpha * k;
  }
  const blink = Math.sin(t * 5) > 0;
  for (const b of ship.beacons) b.visible = blink;

  // Pad lights brighten while the ship is circling and leaving.
  const padGlow = flight.phase === 'lap' || flight.phase === 'depart' ? 1.6 : 1;
  padLightMaterial.color.setRGB(1, 0.7, 0.28).multiplyScalar(padGlow);

  // Contact shadow: under the ship on the pad or grass, fading and widening with altitude.
  const onPad = Math.hypot(shipPos.x, shipPos.z) < CONFIG.padRadius + 0.5;
  const surface = onPad ? 0.42 : 0.03;
  const alt = Math.max(0, shipPos.y - surface);
  blob.position.set(shipPos.x, surface, shipPos.z);
  blob.scale.setScalar(4.5 + alt * 0.5);
  blobMaterial.opacity = THREE.MathUtils.clamp(0.55 - alt * 0.03, 0, 0.55);

  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 600) c.position.x = -600;
  }
}

// ---------- Camera ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;           // orbit and zoom only, so follow mode and touch stay predictable
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.9;
controls.minDistance = 6;
controls.maxDistance = 160;
controls.maxPolarAngle = Math.PI * 0.49; // stay above the ground

function homeDistance() {
  const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  return Math.max(CONFIG.homeDistance, CONFIG.visibleHalfWidth / halfTan);
}

function homePose() {
  const pos = CONFIG.homeTarget.clone().addScaledVector(HOME_DIR, homeDistance());
  return { pos, target: CONFIG.homeTarget.clone() };
}

const initialHome = homePose();
camera.position.copy(initialHome.pos);
controls.target.copy(initialHome.target);
controls.update();

// Keep the subject centred in the space above the control dock on every screen size.
const dock = document.querySelector('.dock');
function applyViewOffset() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dockSpace = dock.getBoundingClientRect().height + 14;
  const shift = Math.round(Math.min(dockSpace, h * 0.4) / 2);
  camera.setViewOffset(w, h, 0, shift, w, h);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyViewOffset();
}
window.addEventListener('resize', onResize);
onResize();

let tween = null;
function resetCamera() {
  flight.followOn = false;
  syncUi();
  const home = homePose();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  tween = {
    t: 0,
    duration: reduced ? 0.01 : 1.1,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: home.pos,
    toTarget: home.target,
  };
}

function zoomBy(factor) {
  tween = null;
  const offset = scratch.subVectors(camera.position, controls.target);
  const d = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
  offset.setLength(d);
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

function updateCamera(dt) {
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / tween.duration);
    const e = easeInOutCubic(tween.t);
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
    if (tween.t >= 1) tween = null;
    return;
  }
  if (!flight.followOn) return;

  // Move target and camera by the same amount so the user's orbit angle and zoom are kept.
  const k = 1 - Math.exp(-18 * dt);
  const shift = scratch.subVectors(shipPos, controls.target).multiplyScalar(k);
  controls.target.add(shift);
  camera.position.add(shift);

  // While leaving, ease the chase camera back so the ship recedes and shrinks into the haze.
  if (flight.phase === 'depart' || flight.phase === 'gone') {
    const gone = flight.phase === 'gone';
    const want = gone ? CONFIG.farChaseDistance : CONFIG.chaseDistance;
    const rate = gone ? 0.15 : 0.6;
    const offset = scratch.subVectors(camera.position, controls.target);
    const d = offset.length();
    if (d < want) {
      offset.setLength(d + (want - d) * (1 - Math.exp(-rate * dt)));
      camera.position.copy(controls.target).add(offset);
    }
  }
}

// ---------- Controls ----------
departBtn.addEventListener('click', startDeparture);
followBtn.addEventListener('click', () => {
  flight.followOn = !flight.followOn;
  syncUi();
});
document.getElementById('zoom-in').addEventListener('click', () => zoomBy(0.8));
document.getElementById('zoom-out').addEventListener('click', () => zoomBy(1.25));
document.getElementById('reset').addEventListener('click', resetCamera);

window.addEventListener('keydown', (e) => {
  // Let focused buttons handle their own keys (Space/Enter activate them natively).
  if (e.target.closest?.('button') || e.altKey || e.ctrlKey || e.metaKey) return;
  switch (e.key) {
    case ' ':
      e.preventDefault();
      startDeparture();
      break;
    case 'f':
    case 'F':
      if (!e.repeat) { flight.followOn = !flight.followOn; syncUi(); }
      break;
    case 'r':
    case 'R':
      if (!e.repeat) resetCamera();
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

// ---------- Loop ----------
let last = performance.now();
let elapsed = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  elapsed += dt;

  updateShip(dt, elapsed);
  updateEffects(dt, elapsed);
  updateCamera(dt);
  controls.update();
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
}

syncUi();
renderer.setAnimationLoop(frame);
window.__padReady = true;
