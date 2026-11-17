import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const $ = id => document.getElementById(id);
const host = $('world');

// Scene, renderer & camera
const scene = new THREE.Scene();
const skyDay = new THREE.Color('#d9e8e1');
const skySpace = new THREE.Color('#030508');
scene.background = skyDay.clone();
scene.fog = new THREE.Fog(skyDay.clone(), 95, 290);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
host.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 12000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 17;
controls.maxDistance = 85;
controls.maxPolarAngle = Math.PI * 0.465;
controls.minPolarAngle = 0.15;
controls.autoRotateSpeed = 0.65;

// Lighting
const hemiSkyDay = new THREE.Color(0xf2fbff), hemiGndDay = new THREE.Color(0xb6bba0);
const hemiSkySpace = new THREE.Color(0x25354e), hemiGndSpace = new THREE.Color(0x0a0d18);
const hemiLight = new THREE.HemisphereLight(hemiSkyDay.clone(), hemiGndDay.clone(), 2.7);
scene.add(hemiLight);

const sunDay = new THREE.Color(0xfff7dd), sunSpace = new THREE.Color(0xffffff);
const sun = new THREE.DirectionalLight(sunDay.clone(), 3.1);
sun.position.set(-28, 50, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 150 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);
scene.add(sun.target);

// Materials & Mesh helpers
const mat = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const grass = mat('#a9b69b'), sand = mat('#d9d6b9'), dark = mat('#4b5d54'), edge = mat('#889184');
const cream = mat('#f0eee0', 0.46, 0.3), orange = mat('#d77d43', 0.5, 0.22), glass = mat('#254549', 0.16, 0.7), metal = mat('#6f8078', 0.4, 0.55);

function mesh(geo, material, parent = scene, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
const box = (w, h, d, m, p = scene, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), m, p, x, y, z);
const cyl = (a, b, h, m, p = scene, x = 0, y = 0, z = 0, n = 64) => mesh(new THREE.CylinderGeometry(a, b, h, n), m, p, x, y, z);

// Group holding all ground outpost assets for clean visibility management
const outpostGroup = new THREE.Group();
scene.add(outpostGroup);

const water = mesh(new THREE.PlaneGeometry(3000, 3000), mat('#b2ccc2', 0.32, 0.12), outpostGroup, 0, -1.2, 0);
water.rotation.x = -Math.PI / 2;
water.castShadow = false;

let seed = 182;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function island(radius, y, color) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 100; i++) {
    const a = i / 100 * Math.PI * 2;
    const r = radius * (1 + 0.09 * Math.sin(a * 3) + 0.04 * Math.cos(a * 7));
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
    if (!i) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 1.5, bevelThickness: 0.6 });
  const o = mesh(geo, color, outpostGroup, 0, y, 0);
  o.rotation.x = -Math.PI / 2;
  return o;
}
island(58, -1, sand);
island(52, -0.45, grass);

// Ripples around shore
for (let i = 0; i < 8; i++) {
  const r = 62 + i * 3;
  const arc = new THREE.EllipseCurve(0, 0, r, r * 0.8, 0, Math.PI * 2);
  const g = new THREE.BufferGeometry().setFromPoints(arc.getPoints(140).map(p => new THREE.Vector3(p.x, -1.15, p.y)));
  outpostGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xd1e1d5, transparent: true, opacity: 0.2 - i * 0.017 })));
}

// Low poly mountains
for (let i = 0; i < 27; i++) {
  const x = -145 + i * 12, z = -92 - rand() * 47, h = 10 + rand() * 20;
  const mountain = mesh(new THREE.ConeGeometry(13 + rand() * 16, h, 5), mat(new THREE.Color().setHSL(0.36, 0.1, 0.56 + rand() * 0.13)), outpostGroup, x, h / 2 - 2, z);
  mountain.rotation.y = rand() * 6;
}

// Landing pad
cyl(10.6, 11, 0.35, sand, outpostGroup, 0, 0.78, 0, 80);
cyl(9.1, 9.4, 0.42, edge, outpostGroup, 0, 1.05, 0, 80);
cyl(8.7, 8.7, 0.14, dark, outpostGroup, 0, 1.33, 0, 80);

function ring(r, t, m, y = 1.415) {
  const o = mesh(new THREE.RingGeometry(r - t, r, 128), m, outpostGroup, 0, y, 0);
  o.rotation.x = -Math.PI / 2;
  o.castShadow = false;
  return o;
}
ring(8.18, 0.07, mat('#dad7ae'));
ring(6.6, 0.12, mat('#9da99a'));
ring(3.7, 0.045, mat('#7b8e7d'));

for (let i = 0; i < 32; i++) {
  const a = i / 32 * Math.PI * 2;
  const tick = box(0.09, 0.02, i % 4 === 0 ? 0.65 : 0.25, mat('#b3bba7'), outpostGroup, Math.sin(a) * 7.65, 1.43, Math.cos(a) * 7.65);
  tick.rotation.y = a;
}

const padCanvas = document.createElement('canvas');
padCanvas.width = 512; padCanvas.height = 512;
const pc = padCanvas.getContext('2d');
pc.fillStyle = '#c6cebc';
pc.font = '500 140px sans-serif';
pc.textAlign = 'center';
pc.fillText('01', 256, 294);
pc.font = '18px sans-serif';
pc.fillText('A S T E R  /  L A N D I N G', 256, 350);
const padLabel = mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(padCanvas), transparent: true, depthWrite: false }), outpostGroup, 0, 1.44, 0);
padLabel.rotation.x = -Math.PI / 2;
padLabel.rotation.z = Math.PI;
padLabel.castShadow = false;

const lightMat = new THREE.MeshStandardMaterial({ color: '#dcebc1', emissive: '#d4ed9a', emissiveIntensity: 1.8 });
for (let i = 0; i < 8; i++) {
  const a = i * Math.PI / 4;
  cyl(0.14, 0.17, 0.13, lightMat, outpostGroup, Math.cos(a) * 8.85, 1.4, Math.sin(a) * 8.85, 12);
}

// Service road
box(5, 0.025, 38, mat('#bdc1ab'), outpostGroup, 0, 0.69, 28);
for (let i = 0; i < 12; i++) box(0.08, 0.03, 1, mat('#e6e7cd'), outpostGroup, 0, 0.72, 13 + i * 2.6);

// Outpost buildings
const base = new THREE.Group();
base.position.set(21, 0, -11);
outpostGroup.add(base);
box(11, 3.8, 7, cream, base, 0, 2.5, 0);
box(11.6, 0.45, 7.6, mat('#8b9d8e'), base, 0, 4.6, 0);
box(6, 2.6, 0.08, glass, base, -0.8, 2.2, 3.55);
for (let i = 0; i < 5; i++) box(0.09, 2.6, 0.13, edge, base, -3.3 + i * 1.3, 2.2, 3.62);
box(2, 2, 0.1, orange, base, 4, 1.8, 3.6);
for (let i = 0; i < 8; i++) box(0.08, 0.18, 7.3, metal, base, -5 + i * 1.4, 4.91, 0);
cyl(0.12, 0.16, 5, metal, base, 3, 7.2, -1);
const dish = mesh(new THREE.SphereGeometry(1.6, 20, 12, 0, Math.PI * 2, 0, 0.85), cream, base, 3, 9.1, -1);
dish.rotation.z = -0.5;

for (let i = 0; i < 3; i++) {
  box(2.2, 1.3, 2, mat('#a0ac98'), outpostGroup, 16 + i * 2.8, 1.3, -3);
  box(0.12, 1.34, 2.05, edge, outpostGroup, 15.5 + i * 2.8, 1.3, -3);
}

cyl(0.08, 0.12, 9, metal, outpostGroup, -14, 5, 0, 12);
const sock = new THREE.Group();
sock.position.set(-14, 9.3, 0);
sock.rotation.z = -1.15;
outpostGroup.add(sock);
for (let i = 0; i < 5; i++) cyl(0.28 - i * 0.027, 0.3 - i * 0.027, 0.45, i % 2 ? cream : orange, sock, 0, -i * 0.45, 0, 12);

// Trees & rocks
const treeMat = [mat('#638374'), mat('#79927b'), mat('#8ba184')];
function tree(x, z, s) {
  const p = new THREE.Group();
  outpostGroup.add(p);
  p.position.set(x, 0.5, z);
  cyl(0.12 * s, 0.19 * s, 1.6 * s, mat('#7b8062'), p, 0, 0.8 * s, 0, 6);
  for (let j = 0; j < 3; j++) mesh(new THREE.ConeGeometry((1.15 - j * 0.23) * s, 2.5 * s, 7), treeMat[Math.floor(rand() * 3)], p, 0, (2.1 + j * 0.9) * s, 0);
}
for (let i = 0; i < 90; i++) {
  const a = rand() * Math.PI * 2, r = 20 + rand() * 28, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.73;
  if ((Math.abs(x) < 5 && z > 0) || (x > 13 && x < 30 && z < 0 && z > -18)) continue;
  tree(x, z, 0.6 + rand() * 0.8);
}
for (let i = 0; i < 35; i++) {
  const a = rand() * 6.28, r = 16 + rand() * 33;
  const stone = mesh(new THREE.DodecahedronGeometry(0.4 + rand() * 0.9, 0), mat('#b6b8a0'), outpostGroup, Math.cos(a) * r, 0.7, Math.sin(a) * r * 0.75);
  stone.scale.set(1.5, 0.65, 1);
  stone.rotation.y = rand() * 6;
}

// Clouds
const cloudMat = mat('#f0f5e9');
for (let i = 0; i < 15; i++) {
  const cl = new THREE.Group();
  outpostGroup.add(cl);
  cl.position.set(-160 + i * 25, 35 + rand() * 15, -90 - rand() * 70);
  for (let j = 0; j < 4; j++) {
    const c = mesh(new THREE.SphereGeometry(3 + rand() * 3, 12, 8), cloudMat, cl, j * 4, rand() * 2, 0);
    c.scale.y = 0.5;
    c.castShadow = false;
  }
}

// Explorer spaceship
const ship = new THREE.Group();
scene.add(ship);
ship.position.set(0, 4.1, 0);
ship.scale.setScalar(1.1);

const hull = mesh(new THREE.SphereGeometry(1, 40, 28), cream, ship, 0, 0, 0);
hull.scale.set(1.05, 0.59, 2.25);
const underside = mesh(new THREE.SphereGeometry(1, 32, 16), metal, ship, 0, -0.23, 0.25);
underside.scale.set(0.88, 0.34, 1.65);
const canopy = mesh(new THREE.SphereGeometry(1, 36, 20), glass, ship, 0, 0.44, -0.52);
canopy.scale.set(0.68, 0.48, 1.16);
const canopyFrame = mesh(new THREE.TorusGeometry(0.66, 0.035, 8, 40, Math.PI), cream, ship, 0, 0.49, -0.7);
canopyFrame.rotation.y = Math.PI / 2;
box(0.17, 0.055, 1.1, orange, ship, 0, 0.55, 1.05);

const flames = [];
function wing(sign) {
  const shape = new THREE.Shape();
  shape.moveTo(0.65, -0.6);
  shape.lineTo(3.65, 1);
  shape.lineTo(3.45, 1.65);
  shape.lineTo(0.7, 1.2);
  shape.closePath();
  const w = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.13, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.04, bevelSegments: 2 }), cream, ship);
  w.rotation.x = Math.PI / 2;
  w.scale.x = sign;
  w.position.y = -0.05;
  const strip = box(0.27, 0.08, 1.05, orange, ship, sign * 2.7, -0.04, 1.04);
  strip.rotation.y = sign * -0.3;

  const engine = cyl(0.37, 0.43, 1.6, cream, ship, sign * 1.75, -0.12, 1.08, 32);
  engine.rotation.x = Math.PI / 2;
  const collar = cyl(0.43, 0.43, 0.35, orange, ship, sign * 1.75, -0.12, 1.8, 32);
  collar.rotation.x = Math.PI / 2;
  const outlet = cyl(0.3, 0.34, 0.12, dark, ship, sign * 1.75, -0.12, 2, 32);
  outlet.rotation.x = Math.PI / 2;
  const glow = cyl(0.21, 0.26, 0.13, new THREE.MeshStandardMaterial({ color: '#c5f1d3', emissive: '#7de4d5', emissiveIntensity: 3 }), ship, sign * 1.75, -0.12, 2.08, 24);
  glow.rotation.x = Math.PI / 2;

  const flame = mesh(new THREE.ConeGeometry(0.22, 1.15, 20), new THREE.MeshBasicMaterial({ color: '#a2eede', transparent: true, opacity: 0.65 }), ship, sign * 1.75, -0.12, 2.6);
  flame.rotation.x = Math.PI / 2;
  flames.push(flame);

  const fin = box(0.12, 0.72, 0.75, orange, ship, sign * 0.75, 0.65, 1.4);
  fin.rotation.z = sign * -0.3;
  for (const z of [-0.7, 1.1]) {
    const leg = box(0.1, 0.48, 0.13, metal, ship, sign * 0.64, -0.63, z);
    leg.rotation.z = sign * -0.3;
    box(0.36, 0.09, 0.5, dark, ship, sign * 0.72, -0.88, z);
  }
}
wing(1);
wing(-1);
mesh(new THREE.SphereGeometry(0.08, 12, 8), lightMat, ship, 0, 0.02, -2.17);
ship.rotation.y = -0.55;

// Warp drive visual ring components on the ship
const warpDriveGroup = new THREE.Group();
ship.add(warpDriveGroup);
const warpRing1 = mesh(new THREE.RingGeometry(1.5, 1.72, 40), new THREE.MeshBasicMaterial({ color: 0x4fffc8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), warpDriveGroup, 0, 0, 1.3);
const warpRing2 = mesh(new THREE.RingGeometry(2.1, 2.32, 40), new THREE.MeshBasicMaterial({ color: 0x8efce8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), warpDriveGroup, 0, 0, 1.9);
warpDriveGroup.visible = false;

// -------------------------------------------------------------
// SPACE ENVIRONMENT: STARFIELD & CURVED ATMOSPHERIC LIMB
// -------------------------------------------------------------
const starCount = 3600;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(starCount * 3);
const starColor = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 1200 + Math.random() * 2800;
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPos[i * 3 + 2] = r * Math.cos(phi);

  const t = Math.random();
  if (t < 0.6) {
    starColor[i * 3] = 0.95; starColor[i * 3 + 1] = 0.98; starColor[i * 3 + 2] = 1.0;
  } else if (t < 0.85) {
    starColor[i * 3] = 0.55; starColor[i * 3 + 1] = 0.92; starColor[i * 3 + 2] = 1.0;
  } else {
    starColor[i * 3] = 1.0; starColor[i * 3 + 1] = 0.88; starColor[i * 3 + 2] = 0.68;
  }
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('color', new THREE.BufferAttribute(starColor, 3));

const starCanvas = document.createElement('canvas');
starCanvas.width = 32; starCanvas.height = 32;
const sctx = starCanvas.getContext('2d');
const sGrad = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
sGrad.addColorStop(0, 'rgba(255,255,255,1)');
sGrad.addColorStop(0.3, 'rgba(220,245,255,0.85)');
sGrad.addColorStop(0.65, 'rgba(120,210,240,0.22)');
sGrad.addColorStop(1, 'rgba(0,0,0,0)');
sctx.fillStyle = sGrad;
sctx.fillRect(0, 0, 32, 32);
const starTexture = new THREE.CanvasTexture(starCanvas);

const starMat = new THREE.PointsMaterial({
  size: 8.5,
  vertexColors: true,
  map: starTexture,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// Curved blue atmosphere limb seen when ascending to orbit
const limbCanvas = document.createElement('canvas');
limbCanvas.width = 512; limbCanvas.height = 512;
const lctx = limbCanvas.getContext('2d');
const lgrad = lctx.createRadialGradient(256, 256, 40, 256, 256, 256);
lgrad.addColorStop(0, 'rgba(180, 235, 222, 0.9)');
lgrad.addColorStop(0.32, 'rgba(85, 195, 195, 0.65)');
lgrad.addColorStop(0.65, 'rgba(30, 90, 135, 0.3)');
lgrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
lctx.fillStyle = lgrad;
lctx.fillRect(0, 0, 512, 512);

const limbMat = new THREE.MeshBasicMaterial({
  map: new THREE.CanvasTexture(limbCanvas),
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const atmoLimb = new THREE.Mesh(new THREE.PlaneGeometry(3500, 3500), limbMat);
atmoLimb.rotation.x = -Math.PI / 2;
atmoLimb.position.set(0, -15, 0);
scene.add(atmoLimb);

// -------------------------------------------------------------
// TELEPORT / WARP SPEED TUNNEL STREAKS & SHOCKWAVES
// -------------------------------------------------------------
const warpCount = 280;
const warpPos = new Float32Array(warpCount * 6);
const warpCol = new Float32Array(warpCount * 6);
for (let i = 0; i < warpCount; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 4.5 + Math.random() * 26;
  const x = Math.cos(a) * r;
  const y = Math.sin(a) * r;
  const z = -60 + Math.random() * 120;
  const len = 16 + Math.random() * 32;
  warpPos[i * 6] = x; warpPos[i * 6 + 1] = y; warpPos[i * 6 + 2] = z;
  warpPos[i * 6 + 3] = x; warpPos[i * 6 + 4] = y; warpPos[i * 6 + 5] = z + len;

  const isCyan = Math.random() > 0.35;
  const rC = isCyan ? 0.35 : 0.85, gC = isCyan ? 1.0 : 0.72, bC = 1.0;
  warpCol[i * 6] = rC; warpCol[i * 6 + 1] = gC; warpCol[i * 6 + 2] = bC;
  warpCol[i * 6 + 3] = rC; warpCol[i * 6 + 4] = gC; warpCol[i * 6 + 5] = bC;
}
const warpGeo = new THREE.BufferGeometry();
warpGeo.setAttribute('position', new THREE.BufferAttribute(warpPos, 3));
warpGeo.setAttribute('color', new THREE.BufferAttribute(warpCol, 3));
const warpMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
const warpStreaks = new THREE.LineSegments(warpGeo, warpMat);
const warpStreaksGroup = new THREE.Group();
warpStreaksGroup.add(warpStreaks);
scene.add(warpStreaksGroup);
warpStreaksGroup.visible = false;

// Shockwave rings
const jumpShockwave = mesh(new THREE.RingGeometry(0.2, 2.8, 64), new THREE.MeshBasicMaterial({ color: 0x6effe2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), scene);
jumpShockwave.visible = false;

const DEST_POS = new THREE.Vector3(2600, 1600, -3200);
const FINAL_POS = new THREE.Vector3(2655, 1606, -3235);

const arrivalShockwave = mesh(new THREE.RingGeometry(0.5, 4.2, 64), new THREE.MeshBasicMaterial({ color: 0x62ffd7, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), scene);
arrivalShockwave.position.copy(DEST_POS);
arrivalShockwave.visible = false;

// -------------------------------------------------------------
// DISTANT DESTINATION: "AETHELIA SANCTUARY — SECTOR 88"
// -------------------------------------------------------------
const destinationGroup = new THREE.Group();
destinationGroup.position.copy(DEST_POS);
scene.add(destinationGroup);
destinationGroup.visible = false;

// Distant destination rim light
const destLight = new THREE.DirectionalLight(0xd5f6ed, 0);
destLight.position.set(DEST_POS.x + 70, DEST_POS.y + 45, DEST_POS.z + 90);
scene.add(destLight);

function createPlanetTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#091c28');
  grad.addColorStop(0.18, '#103943');
  grad.addColorStop(0.36, '#216c68');
  grad.addColorStop(0.5, '#a3d8c8');
  grad.addColorStop(0.66, '#1d5e60');
  grad.addColorStop(0.84, '#0f2f3b');
  grad.addColorStop(1, '#06111a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Atmospheric swirl bands
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(235,250,244,0.13)' : 'rgba(10,32,46,0.18)';
    ctx.beginPath();
    const yBase = 25 + i * 21;
    ctx.moveTo(0, yBase);
    for (let x = 0; x <= 1024; x += 32) {
      const y = yBase + Math.sin(x * 0.016 + i * 1.1) * 7 + Math.cos(x * 0.028 - i * 0.4) * 4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(1024, yBase + 15); ctx.lineTo(0, yBase + 15); ctx.closePath(); ctx.fill();
  }
  // Great storm eye
  ctx.fillStyle = 'rgba(220,195,145,0.35)';
  ctx.beginPath(); ctx.ellipse(660, 290, 75, 30, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,248,230,0.48)';
  ctx.beginPath(); ctx.ellipse(660, 290, 42, 16, 0.1, 0, Math.PI * 2); ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

function createRingTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const cx = 256, cy = 256;
  for (let r = 132; r <= 248; r++) {
    const norm = (r - 132) / (248 - 132);
    if (norm >= 0.52 && norm <= 0.58) continue; // Cassini division
    const alpha = (0.3 + 0.45 * Math.sin(norm * Math.PI)) * (0.35 + 0.65 * Math.sin(r * 2.5));
    ctx.strokeStyle = `rgba(205, 235, 228, ${Math.max(0, Math.min(0.85, alpha))})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

// Giant Ringed Planet in the celestial background
mesh(new THREE.SphereGeometry(175, 48, 32), new THREE.MeshStandardMaterial({ map: createPlanetTexture(), roughness: 0.85, metalness: 0.05 }), destinationGroup, -160, 15, -560);
mesh(new THREE.SphereGeometry(181, 36, 24), new THREE.MeshBasicMaterial({ color: 0x5beedb, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending }), destinationGroup, -160, 15, -560);

const planetRings = mesh(new THREE.RingGeometry(205, 395, 128), new THREE.MeshStandardMaterial({ map: createRingTexture(), transparent: true, opacity: 0.88, side: THREE.DoubleSide, roughness: 0.65 }), destinationGroup, -160, 15, -560);
planetRings.rotation.x = Math.PI * 0.42;
planetRings.rotation.y = 0.32;

// The Orbital Sanctuary ("Aethelia Sanctuary")
const stationGroup = new THREE.Group();
stationGroup.position.set(-20, -12, -110);
destinationGroup.add(stationGroup);

// Central spindle & observation core
cyl(6, 7.5, 52, cream, stationGroup, 0, 0, 0, 32);
cyl(7.7, 7.7, 3.2, mat('#314c46', 0.25, 0.7), stationGroup, 0, 0, 0, 32);
cyl(7.72, 7.72, 2.2, new THREE.MeshBasicMaterial({ color: 0xffeaae, transparent: true, opacity: 0.85 }), stationGroup, 0, 0, 0, 32);
cyl(0.2, 0.35, 26, metal, stationGroup, 0, 35, 0, 12);
cyl(0.8, 0.8, 0.6, orange, stationGroup, 0, 48, 0, 16);
mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffaa44 }), stationGroup, 0, 49, 0);
cyl(0.15, 0.3, 20, metal, stationGroup, 0, -32, 0, 12);

// Rotating habitat promenade
const habitatRing = mesh(new THREE.TorusGeometry(38, 2.4, 16, 64), cream, stationGroup, 0, 0, 0);
habitatRing.rotation.x = Math.PI / 2;
for (let i = 0; i < 4; i++) {
  const spoke = box(38, 0.9, 0.9, metal, stationGroup, 0, 0, 0);
  spoke.rotation.y = i * Math.PI / 4;
}
const windowMat = new THREE.MeshBasicMaterial({ color: 0xfff0b8 });
for (let i = 0; i < 24; i++) {
  const a = i / 24 * Math.PI * 2;
  cyl(0.3, 0.3, 0.15, windowMat, stationGroup, Math.cos(a) * 38, 0, Math.sin(a) * 38, 8);
}

// Photovoltaic solar array wings
const solarMat = mat('#1b3246', 0.2, 0.8);
const solarL = box(30, 0.3, 9, solarMat, stationGroup, -24, 10, 0);
solarL.rotation.z = 0.1;
const solarR = box(30, 0.3, 9, solarMat, stationGroup, 24, 10, 0);
solarR.rotation.z = -0.1;

// Docking corridor & approach navigation beacons
const navBeacons = [];
for (let i = 0; i < 4; i++) {
  const pz = -50 + i * 20;
  const px = -8 + i * 14;
  const py = -5 + i * 2.5;
  cyl(0.18, 0.25, 9, metal, destinationGroup, px - 14, py, pz, 12);
  const portOrb = mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3b4e, transparent: true }), destinationGroup, px - 14, py + 4.8, pz);
  cyl(0.18, 0.25, 9, metal, destinationGroup, px + 14, py, pz, 12);
  const stbdOrb = mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshBasicMaterial({ color: 0x3bffa2, transparent: true }), destinationGroup, px + 14, py + 4.8, pz);
  navBeacons.push({ port: portOrb, stbd: stbdOrb, offset: i * 0.4 });
}

// Low-poly floating space asteroids
for (let i = 0; i < 8; i++) {
  const a = i / 8 * Math.PI * 2 + rand();
  const rad = 110 + rand() * 120;
  const rock = mesh(new THREE.DodecahedronGeometry(3 + rand() * 6, 1), mat('#6c7875', 0.9, 0.1), destinationGroup, Math.cos(a) * rad, -30 + rand() * 70, Math.sin(a) * rad);
  rock.rotation.set(rand() * 6, rand() * 6, rand() * 6);
}

// Ember Reach is a separate arrival environment, with a red moon and mining harbor.
const emberGroup = new THREE.Group();
emberGroup.position.set(-2800, 1900, -3600);
emberGroup.visible = false;
scene.add(emberGroup);
const emberStone = mat('#985b43', 0.95);
const emberMetal = mat('#474452', 0.55, 0.5);
const amberGlow = new THREE.MeshStandardMaterial({ color: '#ffd08a', emissive: '#ff862d', emissiveIntensity: 2 });
const redMoon = mesh(new THREE.SphereGeometry(170, 40, 28), mat('#b65c3d'), emberGroup, -160, 15, -560);
// Crater rims sit on the moon's visible surface.
for (let i = 0; i < 18; i++) {
  const x = (rand() - 0.5) * 230, y = (rand() - 0.5) * 210;
  const z = Math.sqrt(170 * 170 - x * x - y * y);
  const crater = mesh(new THREE.TorusGeometry(6 + rand() * 10, 1.8, 6, 20), emberStone, redMoon, x, y, z);
  crater.lookAt(emberGroup.localToWorld(new THREE.Vector3(-160 + x * 2, 15 + y * 2, -560 + z * 2)));
}
const harbor = new THREE.Group();
harbor.position.set(-20, -12, -110);
emberGroup.add(harbor);
const harborRock = mesh(new THREE.DodecahedronGeometry(34, 1), emberStone, harbor, 0, -22, 0);
harborRock.scale.set(1.6, 0.6, 1.2);
box(68, 3, 42, emberMetal, harbor, 0, 0, 0);
for (const x of [-26, 26]) {
  box(8, 24, 10, cream, harbor, x, 13, -10);
  box(10, 2, 12, orange, harbor, x, 26, -10);
  box(6, 4, 0.3, amberGlow, harbor, x, 20, -4.8);
}
box(60, 3, 5, orange, harbor, 0, 28, -10);
for (let i = 0; i < 6; i++) {
  const z = -35 + i * 14;
  for (const x of [-16, 16]) {
    cyl(0.3, 0.5, 8, emberMetal, emberGroup, x, -3, z, 8);
    mesh(new THREE.SphereGeometry(0.7, 12, 8), amberGlow, emberGroup, x, 1.5, z);
  }
}
for (let i = 0; i < 30; i++) {
  const a = rand() * Math.PI * 2, r = 100 + rand() * 230;
  const rock = mesh(new THREE.DodecahedronGeometry(3 + rand() * 10, 0), emberStone, emberGroup,
    Math.cos(a) * r, -40 + rand() * 100, Math.sin(a) * r - 80);
  rock.rotation.set(rand() * 6, rand() * 6, rand() * 6);
}

const destinations = {
  aethelia: {
    name: 'Aethelia Sanctuary', sector: '88', distance: '4.2',
    detail: 'Ringed planet · Orbital sanctuary', group: destinationGroup,
    position: DEST_POS.clone(), final: FINAL_POS.clone(), light: '#d5f6ed',
    title: 'A new home among the stars.'
  },
  ember: {
    name: 'Ember Reach', sector: '42', distance: '6.8',
    detail: 'Red moon · Asteroid harbor', group: emberGroup,
    position: emberGroup.position.clone(),
    final: emberGroup.position.clone().add(new THREE.Vector3(55, 6, -35)), light: '#ffd0a0',
    title: 'A warm welcome on the frontier.'
  }
};
let activeDestination = destinations.aethelia;

function updateDestinationChoice() {
  const selected = destinations[$('destination').value];
  $('destination-detail').textContent = selected.detail;
  if (!launched) {
    $('mission-description').textContent = `One slow lap. Then, onward to ${selected.name}.`;
  }
}
$('destination').addEventListener('change', updateDestinationChoice);

// -------------------------------------------------------------
// FLIGHT TRAJECTORY & DYNAMICS
// -------------------------------------------------------------
const TOTAL_TIME = 64;
let launched = false, startTime = 0, completed = false, paused = false, pauseStarted = 0, autoOrbit = false, freezeTarget = null;
let flightTime = 0, currentPhase = 0;
updateDestinationChoice();
const clock = new THREE.Clock();
const initialTarget = new THREE.Vector3();
let lastTarget = new THREE.Vector3();

function mobile() { return innerWidth <= 760; }
function defaultView() {
  const m = mobile();
  const target = launched ? ship.position.clone() : new THREE.Vector3(0, 4.1, 0);
  camera.position.copy(target).add(new THREE.Vector3(m ? 32 : 31, m ? 23 : 21, m ? 39 : 38));
  controls.target.copy(target);
  lastTarget.copy(target);
  controls.update();
}

function resize() {
  renderer.setSize(host.clientWidth, host.clientHeight);
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.fov = mobile() ? 44 : 38;
  camera.updateProjectionMatrix();
}
resize();
defaultView();
initialTarget.copy(controls.target);
addEventListener('resize', () => {
  resize();
  if (!launched) defaultView();
});

let noticeTimer;
function notice(text) {
  $('notice').textContent = text;
  $('notice').classList.add('visible');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => $('notice').classList.remove('visible'), 2800);
}

$('orbit').onclick = () => {
  autoOrbit = !autoOrbit;
  controls.autoRotate = autoOrbit;
  $('orbit').setAttribute('aria-pressed', String(autoOrbit));
  $('camera-mode').textContent = autoOrbit ? 'AUTO ORBIT' : launched ? 'FOLLOW CAMERA' : 'FREE ORBIT';
};

function zoom(factor) {
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset);
  controls.update();
}
$('zoom-in').onclick = () => zoom(0.83);
$('zoom-out').onclick = () => zoom(1.2);

$('reset').onclick = () => {
  autoOrbit = false;
  controls.autoRotate = false;
  $('orbit').setAttribute('aria-pressed', 'false');
  defaultView();
  $('camera-mode').textContent = launched ? 'FOLLOW CAMERA' : 'FREE ORBIT';
  notice('Camera reset');
};

function updateFlightButton() {
  const label = completed ? 'Replay departure' : paused ? 'Resume departure' : 'Pause departure';
  const icon = completed ? '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>' : paused ? '<path d="M8 5l11 7-11 7z"/>' : '<path d="M8 5v14M16 5v14"/>';
  $('launch').disabled = false;
  $('launch').innerHTML = `${label} <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
}

function hermite(t, p0, p1, v0, v1, dur) {
  const s = Math.max(0, Math.min(1, t / dur));
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  return p0 * h00 + p1 * h01 + dur * v0 * h10 + dur * v1 * h11;
}

const P_jump_start = new THREE.Vector3(185.5, 230, -53.7);

function flightPosition(t) {
  // Phase 1 (0 to 24s): Outpost lap circuit
  if (t <= 24) {
    const a = t / 24 * Math.PI * 2;
    return new THREE.Vector3(8 * Math.sin(a), 4.1 + 2 * (t / 24) + 0.25 * Math.sin(a), 8 * (1 - Math.cos(a)));
  }
  // Phase 2 (24 to 33s): Leaving outpost perimeter
  if (t <= 33) {
    const d = t - 24;
    return new THREE.Vector3(2.094 * d + 0.19 * d * d, 6.1 + 0.32 * d + 0.045 * d * d, -0.08 * d * d);
  }
  // Phase 3 (33 to 45s): Atmospheric ascent out of sky into space
  if (t <= 45) {
    const u = t - 33;
    const x = hermite(u, 34.236, 145, 5.514, 9.0, 12);
    const y = hermite(u, 12.625, 230, 1.13, 0.0, 12);
    const z = hermite(u, -6.48, -42, -1.44, -2.6, 12);
    return new THREE.Vector3(x, y, z);
  }
  // Phase 4 (45 to 49.5s): Orbital cruise & warp drive spooling
  if (t <= 49.5) {
    const w = t - 45;
    return new THREE.Vector3(145 + 9.0 * w, 230, -42 - 2.6 * w);
  }
  // Phase 5 (49.5 to 53.5s): Teleport / Warp Jump transit
  if (t <= 53.5) {
    const s = (t - 49.5) / 4.0;
    const ease = s < 0.5 ? 16 * Math.pow(s, 5) : 1 - Math.pow(-2 * s + 2, 5) / 2;
    return P_jump_start.clone().lerp(DEST_POS, ease);
  }
  // Phase 6 (53.5 to 64s): Arrival deceleration & docking approach corridor
  if (t <= 64) {
    const u = (t - 53.5) / 10.5;
    const ease = 1 - Math.pow(1 - u, 3);
    return DEST_POS.clone().lerp(FINAL_POS, ease);
  }
  // Hovering station-keeping at destination
  return new THREE.Vector3(FINAL_POS.x, FINAL_POS.y + Math.sin(t * 1.2) * 0.12, FINAL_POS.z);
}

function resetToOutpost() {
  launched = false;
  completed = false;
  paused = false;
  pauseStarted = 0;
  flightTime = 0;
  currentPhase = 0;
  freezeTarget = null;

  ship.position.set(0, 4.1, 0);
  ship.rotation.set(0, -0.55, 0);
  ship.scale.setScalar(1.1);

  scene.background.copy(skyDay);
  scene.fog.color.copy(skyDay);
  scene.fog.near = 95;
  scene.fog.far = 290;

  hemiLight.color.copy(hemiSkyDay);
  hemiLight.groundColor.copy(hemiGndDay);
  hemiLight.intensity = 2.7;
  sun.color.copy(sunDay);
  sun.intensity = 3.1;
  sun.position.set(-28, 50, 15);
  sun.target.position.set(0, 4.1, 0);
  destLight.intensity = 0;

  starMat.opacity = 0;
  atmoLimb.material.opacity = 0;
  warpDriveGroup.visible = false;
  warpStreaksGroup.visible = false;
  jumpShockwave.visible = false;
  arrivalShockwave.visible = false;

  outpostGroup.visible = true;
  Object.values(destinations).forEach(destination => { destination.group.visible = false; });
  $('scene-sector').textContent = 'SECTOR 07';
  $('world').setAttribute('aria-label', 'Interactive 3D scene of a spaceship at Aster Outpost');

  controls.maxPolarAngle = Math.PI * 0.465;
  document.querySelector('main').classList.remove('in-space');
  const vignette = document.querySelector('.vignette');
  if (vignette) vignette.style.removeProperty('opacity');
  const intro = document.querySelector('.intro');
  if (intro) intro.style.removeProperty('opacity');
  $('warp-flash').style.opacity = '0';

  defaultView();
}

function startDeparture() {
  if ($('loading')) $('loading').remove();
  if (completed) {
    resetToOutpost();
  }
  activeDestination = destinations[$('destination').value];
  DEST_POS.copy(activeDestination.position);
  FINAL_POS.copy(activeDestination.final);
  arrivalShockwave.position.copy(DEST_POS);
  destLight.position.copy(DEST_POS).add(new THREE.Vector3(70, 45, 90));
  destLight.target.position.copy(DEST_POS);
  scene.add(destLight.target);
  destLight.color.set(activeDestination.light);
  $('destination').disabled = true;
  launched = true;
  paused = false;
  pauseStarted = 0;
  flightTime = 0;
  currentPhase = 1;
  freezeTarget = null;
  startTime = clock.getElapsedTime();
  initialTarget.copy(controls.target);
  updateFlightButton();

  $('mission-title').textContent = 'A last look around.';
  $('mission-description').textContent = 'One gentle lap. Taking the scenic route.';
  $('status').textContent = 'In flight';
  $('phase-text').textContent = '01 / OUTPOST CIRCUIT';
  $('scene-state').textContent = 'TRACKING';
  $('tag-state').textContent = 'OUTPOST CIRCUIT';
  $('flight-time').textContent = `${TOTAL_TIME} SECONDS REMAINING`;
  $('progress-fill').style.width = '0%';
  $('camera-mode').textContent = autoOrbit ? 'AUTO ORBIT' : 'FOLLOW CAMERA';
  notice('Departure initiated. Enjoy the view.');
}

if (typeof window !== 'undefined') {
  window.__jumpToTime = t => { startTime = clock.getElapsedTime() - t; };
}

$('launch').onclick = () => {
  if (!launched || completed) {
    startDeparture();
    return;
  }
  const now = clock.getElapsedTime();
  if (paused) {
    startTime += now - pauseStarted;
    paused = false;
  } else {
    pauseStarted = now;
    paused = true;
  }
  updateFlightButton();
  notice(paused ? 'Flight paused. You can still explore the view.' : 'Departure resumed.');
};

const prevPosition = new THREE.Vector3();
const direction = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();
const projected = new THREE.Vector3();
let frame = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = clock.elapsedTime;

  if (!launched) {
    ship.position.y = 4.1 + Math.sin(now * 1.5) * 0.16;
    ship.rotation.z = Math.sin(now * 0.85) * 0.025;
  } else {
    flightTime = (paused ? pauseStarted : now) - startTime;
    const flightDt = paused ? 0 : dt;

    prevPosition.copy(ship.position);
    ship.position.copy(flightPosition(flightTime));

    if (flightTime < TOTAL_TIME) {
      direction.copy(flightPosition(flightTime + 0.04)).sub(ship.position).normalize();
      const horizDist = Math.hypot(direction.x, direction.z);
      if (horizDist > 0.01) {
        const heading = Math.atan2(-direction.x, -direction.z);
        ship.rotation.y += Math.atan2(Math.sin(heading - ship.rotation.y), Math.cos(heading - ship.rotation.y)) * Math.min(flightDt * 2.5, 1);
      }

      // Pitch calculation for ascent
      const pitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
      ship.rotation.x = THREE.MathUtils.lerp(ship.rotation.x, pitch * 0.85, Math.min(flightDt * 2, 1));
      ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, flightTime < 24 ? -0.14 : 0, flightDt * 2);
    } else {
      // Arrived & hovering station-keeping
      ship.rotation.x = THREE.MathUtils.lerp(ship.rotation.x, 0, flightDt);
      ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, Math.sin(now * 0.8) * 0.02, flightDt);
    }

    // Camera follow
    if (flightTime < TOTAL_TIME) {
      desiredTarget.copy(ship.position);
      if (flightTime < 4) {
        const blend = THREE.MathUtils.smoothstep(flightTime, 0, 4);
        desiredTarget.lerp(initialTarget, 1 - blend);
      }
      const delta = desiredTarget.clone().sub(controls.target);
      camera.position.add(delta);
      controls.target.copy(desiredTarget);
    } else if (!completed) {
      desiredTarget.copy(flightPosition(TOTAL_TIME));
      camera.position.add(desiredTarget.clone().sub(controls.target));
      controls.target.copy(desiredTarget);
      completed = true;
      freezeTarget = desiredTarget.clone();

      $('mission-title').textContent = activeDestination.title;
      $('destination').disabled = false;
      $('mission-description').textContent = `Arrival confirmed at Sector ${activeDestination.sector}. Welcome to ${activeDestination.name}.`;
      $('status').textContent = 'Arrived';
      updateFlightButton();
      $('phase-text').textContent = 'MISSION COMPLETE';
      $('flight-time').textContent = 'SAFE AT DESTINATION';
      $('tag-state').textContent = `STATION-KEEPING / SECTOR ${activeDestination.sector}`;
      $('scene-state').textContent = 'DESTINATION REACHED';
      $('progress-fill').style.width = '100%';
      $('camera-mode').textContent = autoOrbit ? 'AUTO ORBIT' : 'FREE ORBIT';
      notice(`Explorer–01 has arrived at ${activeDestination.name}. Safe travels.`);
    }

    // Phase management & storytelling UI
    if (!completed) {
      if (flightTime < 24 && currentPhase !== 1) {
        currentPhase = 1;
        $('phase-text').textContent = '01 / OUTPOST CIRCUIT';
        $('mission-title').textContent = 'A last look around.';
        $('mission-description').textContent = 'One gentle lap. Taking the scenic route.';
      } else if (flightTime >= 24 && flightTime < 33 && currentPhase !== 2) {
        currentPhase = 2;
        $('phase-text').textContent = '02 / COASTAL DEPARTURE';
        $('mission-title').textContent = 'Somewhere new awaits.';
        $('mission-description').textContent = 'Leaving the familiar. Following the horizon.';
        $('tag-state').textContent = 'HEADING OUT';
        notice('Explorer–01 leaving outpost perimeter.');
      } else if (flightTime >= 33 && flightTime < 45 && currentPhase !== 3) {
        currentPhase = 3;
        $('phase-text').textContent = '03 / CLIMB TO SPACE';
        $('mission-title').textContent = 'Breaching the atmosphere.';
        $('mission-description').textContent = 'Engines full throttle. Ascending out of the sky.';
        $('tag-state').textContent = 'ORBITAL ASCENT';
        notice('Atmospheric climb initiated. Reaching orbit.');
      } else if (flightTime >= 45 && flightTime < 49.5 && currentPhase !== 4) {
        currentPhase = 4;
        $('phase-text').textContent = '04 / WARP CHARGING';
        $('mission-title').textContent = 'Calculating jump vectors.';
        $('mission-description').textContent = `Quantum drive spooled. Target: ${activeDestination.name}, Sector ${activeDestination.sector}.`;
        $('tag-state').textContent = 'SPOOLING DRIVE';
        notice('Quantum warp drive charging.');
      } else if (flightTime >= 49.5 && flightTime < 53.5 && currentPhase !== 5) {
        currentPhase = 5;
        $('phase-text').textContent = '05 / HYPERJUMP TRANSIT';
        $('mission-title').textContent = 'Bending spacetime.';
        $('mission-description').textContent = `Hyperjump engaged. Transit distance: ${activeDestination.distance} light years.`;
        $('tag-state').textContent = 'WARP JUMP';
        notice('Hyperjump engaged! Entering warp corridor.');

        // Trigger warp jump flash & origin shockwave
        jumpShockwave.position.copy(P_jump_start);
        jumpShockwave.visible = true;
        $('warp-flash').style.opacity = '0.92';
        setTimeout(() => { $('warp-flash').style.opacity = '0'; }, 320);
      } else if (flightTime >= 53.5 && flightTime < TOTAL_TIME && currentPhase !== 6) {
        currentPhase = 6;
        $('phase-text').textContent = '06 / ARRIVAL APPROACH';
        $('mission-title').textContent = 'Dropping out of warp.';
        $('mission-description').textContent = `Approaching ${activeDestination.name}. Entering parking orbit.`;
        $('tag-state').textContent = 'APPROACHING DOCK';
        notice(`Arrival at Sector ${activeDestination.sector}. Welcome to ${activeDestination.name}.`);

        // Trigger arrival exit flash & shockwave
        arrivalShockwave.visible = true;
        $('warp-flash').style.opacity = '0.75';
        setTimeout(() => { $('warp-flash').style.opacity = '0'; }, 320);
      }

      $('status').textContent = paused ? 'Paused' : currentPhase === 5 ? 'In hyperjump' : currentPhase >= 4 ? 'Warp transit' : currentPhase >= 3 ? 'Ascending' : currentPhase === 2 ? 'Departing' : 'In flight';
      $('scene-state').textContent = paused ? 'PAUSED' : 'TRACKING';
      if (!paused) {
        $('tag-state').textContent = currentPhase === 1 ? 'OUTPOST CIRCUIT' : currentPhase === 2 ? 'HEADING OUT' : currentPhase === 3 ? 'ORBITAL ASCENT' : currentPhase === 4 ? 'SPOOLING DRIVE' : currentPhase === 5 ? 'WARP JUMP' : 'APPROACHING DOCK';
      }
      $('flight-time').textContent = `${Math.max(0, Math.ceil(TOTAL_TIME - flightTime))} SECONDS REMAINING`;
      $('progress-fill').style.width = `${Math.min(100, flightTime / TOTAL_TIME * 100)}%`;
    }

    // Sky, Fog, and Atmospheric transition to space (between 33s and 45s)
    const climbProgress = Math.max(0, Math.min(1, (flightTime - 33) / 12));
    const skyColor = new THREE.Color().lerpColors(skyDay, skySpace, climbProgress);
    scene.background.copy(skyColor);
    scene.fog.color.copy(skyColor);
    scene.fog.near = THREE.MathUtils.lerp(95, 1500, climbProgress);
    scene.fog.far = THREE.MathUtils.lerp(290, 15000, climbProgress);

    starMat.opacity = Math.max(0, Math.min(1, (climbProgress - 0.2) / 0.8));
    atmoLimb.material.opacity = Math.sin(climbProgress * Math.PI) * 0.85;

    hemiLight.color.lerpColors(hemiSkyDay, hemiSkySpace, climbProgress);
    hemiLight.groundColor.lerpColors(hemiGndDay, hemiGndSpace, climbProgress);
    hemiLight.intensity = THREE.MathUtils.lerp(2.7, 0.9, climbProgress);
    sun.color.lerpColors(sunDay, sunSpace, climbProgress);
    sun.intensity = THREE.MathUtils.lerp(3.1, 2.8, climbProgress);

    // Permit full 3D orbiting in space
    controls.maxPolarAngle = THREE.MathUtils.lerp(Math.PI * 0.465, Math.PI * 0.95, climbProgress);

    const mainEl = document.querySelector('main');
    if (climbProgress > 0.5) mainEl.classList.add('in-space');
    else mainEl.classList.remove('in-space');

    // Manage asset visibility between planetary ground and deep space
    Object.values(destinations).forEach(destination => {
      destination.group.visible = flightTime >= 33 && destination === activeDestination;
    });
    if (flightTime >= 53.5) {
      $('scene-sector').textContent = `SECTOR ${activeDestination.sector}`;
      $('world').setAttribute('aria-label', `Interactive 3D arrival at ${activeDestination.name}: ${activeDestination.detail}`);
    }
    if (flightTime >= 49.5) outpostGroup.visible = false;
    if (flightTime >= 33) {
      destLight.intensity = THREE.MathUtils.lerp(0, 1.4, Math.min(1, (flightTime - 33) / 12));
    }

    // Warp Spooling rings animation
    if (flightTime >= 45 && flightTime < 49.5) {
      warpDriveGroup.visible = true;
      const wp = (flightTime - 45) / 4.5;
      const ringAlpha = Math.min(1, wp * 1.5) * (0.55 + 0.35 * Math.sin(now * 15));
      warpRing1.material.opacity = ringAlpha;
      warpRing2.material.opacity = ringAlpha * 0.85;
      warpDriveGroup.rotation.z += flightDt * (4 + wp * 16);
      const pulse = 1 + Math.sin(now * 18) * (0.05 + wp * 0.15);
      warpDriveGroup.scale.set(pulse, pulse, 1);
    } else {
      warpDriveGroup.visible = false;
    }

    // Relativistic warp stretch & Hyperjump speed lines
    if (flightTime >= 49.5 && flightTime < 53.5) {
      warpStreaksGroup.visible = true;
      warpStreaksGroup.position.copy(ship.position);
      warpStreaksGroup.quaternion.copy(ship.quaternion);

      const warpFraction = (flightTime - 49.5) / 4.0;
      warpMat.opacity = Math.sin(warpFraction * Math.PI) * 0.92;

      // Animate streak lines rushing past
      const posAttr = warpGeo.attributes.position;
      const arr = posAttr.array;
      for (let i = 0; i < warpCount; i++) {
        arr[i * 6 + 2] += flightDt * 320;
        arr[i * 6 + 5] += flightDt * 320;
        if (arr[i * 6 + 2] > 70) {
          arr[i * 6 + 2] -= 140;
          arr[i * 6 + 5] -= 140;
        }
      }
      posAttr.needsUpdate = true;

      // Forward relativistic length dilation
      const wp = Math.sin(warpFraction * Math.PI);
      ship.scale.set(1.1 * (1 - wp * 0.15), 1.1 * (1 - wp * 0.15), 1.1 * (1 + wp * 0.55));
    } else {
      warpStreaksGroup.visible = false;
      ship.scale.setScalar(1.1);
    }

    // Animate shockwaves
    if (jumpShockwave.visible) {
      const elapsed = flightTime - 49.5;
      if (elapsed >= 0 && elapsed <= 0.8) {
        const s = elapsed / 0.8;
        jumpShockwave.scale.setScalar(1 + s * 45);
        jumpShockwave.material.opacity = (1 - s) * 0.9;
      } else {
        jumpShockwave.visible = false;
      }
    }

    if (arrivalShockwave.visible) {
      const elapsed = flightTime - 53.5;
      if (elapsed >= 0 && elapsed <= 2.2) {
        const s = elapsed / 2.2;
        arrivalShockwave.scale.setScalar(1 + s * 70);
        arrivalShockwave.material.opacity = (1 - s) * 0.95;
      } else {
        arrivalShockwave.visible = false;
      }
    }
  }

  // Keep stars pinned to camera position for infinite celestial sky effect
  stars.position.copy(camera.position);

  // Station and destination celestial animations
  habitatRing.rotation.y += dt * 0.08;
  navBeacons.forEach(b => {
    const blink = Math.sin(now * 4 + b.offset) > 0;
    b.port.material.opacity = blink ? 1 : 0.2;
    b.stbd.material.opacity = blink ? 1 : 0.2;
  });

  // Engine flames reactive to flight phase & thrust throttle
  flames.forEach((f, i) => {
    let baseScale = launched ? 1.4 : 0.5;
    let opacity = launched ? 0.75 : 0.4;
    let flameColor = '#a2eede';

    if (launched) {
      if (flightTime >= 33 && flightTime < 45) {
        baseScale = 2.0;
        opacity = 0.9;
        flameColor = '#68f5e2';
      } else if (flightTime >= 45 && flightTime < 49.5) {
        const wp = (flightTime - 45) / 4.5;
        baseScale = 2.0 + wp * 1.2;
        opacity = 1.0;
        flameColor = '#ffffff';
      } else if (flightTime >= 49.5 && flightTime < 53.5) {
        baseScale = 3.6;
        opacity = 1.0;
        flameColor = '#e6ffff';
      } else if (flightTime >= 53.5 && flightTime < TOTAL_TIME) {
        const ap = (flightTime - 53.5) / 10.5;
        baseScale = THREE.MathUtils.lerp(1.8, 0.7, ap);
        opacity = THREE.MathUtils.lerp(0.85, 0.5, ap);
        flameColor = '#8cefe0';
      } else if (flightTime >= TOTAL_TIME) {
        baseScale = 0.6;
        opacity = 0.45;
        flameColor = '#94efe2';
      }
    }

    f.scale.y = baseScale + Math.sin((launched ? flightTime : now) * 19 + i) * 0.12;
    f.material.opacity = opacity;
    f.material.color.set(flameColor);
  });

  // Directional sunlight follows ship
  if (launched) {
    sun.position.set(ship.position.x - 28, ship.position.y + 50, ship.position.z + 15);
    sun.target.position.copy(ship.position);
  }

  controls.update();
  renderer.render(scene, camera);

  // Ship UI tag positioning in screen space
  if (frame++ % 2 === 0) {
    projected.copy(ship.position).add(new THREE.Vector3(3, 1, 0)).project(camera);
    const x = (projected.x * 0.5 + 0.5) * host.clientWidth;
    const y = (-projected.y * 0.5 + 0.5) * host.clientHeight;
    const tag = $('ship-tag');
    tag.style.left = `${Math.min(host.clientWidth - (mobile() ? 125 : 175), Math.max(mobile() ? 20 : host.clientWidth * 0.4, x + 12))}px`;
    tag.style.top = `${y - 18}px`;
    tag.style.opacity = projected.z > 1 || y < 130 || y > host.clientHeight - 240 ? '0' : '1';
  }
}

animate();
setTimeout(() => {
  $('loading').style.opacity = '0';
  setTimeout(() => $('loading').remove(), 750);
}, 350);
