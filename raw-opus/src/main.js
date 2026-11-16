import * as THREE from 'three';
import { Audio } from './audio.js';
import { initResources, R, makeVehicle, makeBarricade, makeBeam, makeContainer, makeGate, makeCone, makePowerup, makeGem, makeRunner, glowMat } from './models.js';
import { World, DISTRICTS, districtAt, LANE_W, ROAD_HALF } from './world.js';
import { Particles, Post } from './fx.js';
import { prepareChunks, mirrorRow } from './patterns.js';

// ------------------------------------------------------------------ setup
const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const canvas = $('c');
const isMobile = matchMedia('(pointer: coarse)').matches;
window.__perf = { fps: 0 };
const quality = { low: false, bloom: params.get('bloom') !== '0', level: 0, maxDpr: isMobile ? 1.75 : 1.5 };

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1d0a36, 18, 150);
const camera = new THREE.PerspectiveCamera(80, 1, 0.1, 900);
scene.add(camera);

initResources();
// env map: a dark room with neon panels -> glossy car paint / glass pick up colored reflections
{
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x0a0614, side: THREE.BackSide })));
  const panels = [[0xff2bd6, -14, 4, 0, 0, Math.PI / 2, 6, 14], [0x22e6ff, 14, 3, -4, 0, -Math.PI / 2, 5, 12], [0xffb070, 0, 14, 0, Math.PI / 2, 0, 18, 4],
    [0x8a4dff, 0, 2, -14, 0, 0, 20, 3], [0xff4f7b, 4, 6, 14, 0, Math.PI, 8, 4]];
  for (const [c, x, y, z, rx, ry, w, h] of panels) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
  }
  const rt = pm.fromScene(env, 0.03);
  scene.environment = rt.texture;
  pm.dispose();
}
scene.add(new THREE.HemisphereLight(0x6a5aff, 0x200818, 0.6));
const moon = new THREE.DirectionalLight(0xff9adf, 0.5); moon.position.set(-4, 10, 6); scene.add(moon);
const rim = new THREE.DirectionalLight(0x40e0ff, 0.6); rim.position.set(5, 4, -10); scene.add(rim);

const world = new World(scene, quality);
camera.add(world.speedLines);
const particles = new Particles(scene, 700);
const post = new Post(renderer, scene, camera, quality);
const audio = new Audio();
const CHUNKS = prepareChunks();

// ------------------------------------------------------------------ player
const runner = makeRunner();
scene.add(runner.group);
const shieldMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0.3, 0.8, 1.6) }, uHit: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform float uTime; uniform vec3 uCol; uniform float uHit; varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
      float hex = 0.5 + 0.5*sin(vP.y*14.0 - uTime*6.0) * sin(atan(vP.z,vP.x)*9.0);
      float a = f*0.9 + hex*0.12*f + 0.04 + uHit;
      gl_FragColor = vec4(uCol * a, 1.0); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 16), shieldMat);
shieldMesh.position.y = 0.95; shieldMesh.scale.y = 1.15; runner.group.add(shieldMesh); shieldMesh.visible = false;
const magnetRings = new THREE.Group();
for (let i = 0; i < 2; i++) {
  const r = new THREE.Mesh(new THREE.TorusGeometry(1.0 + i * 0.25, 0.035, 6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.6, 1.0), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  r.rotation.x = Math.PI / 2; magnetRings.add(r);
}
magnetRings.position.y = 0.9; runner.group.add(magnetRings); magnetRings.visible = false;
const driveGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.glowTex, color: 0xffc830, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.0 }));
driveGlow.scale.set(3.5, 4, 1); driveGlow.position.y = 1.0; runner.group.add(driveGlow);

// coins (instanced)
const MAX_COINS = 180;
const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 6); coinGeo.rotateX(Math.PI / 2);
const coinMesh = new THREE.InstancedMesh(coinGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.5, 2.0) }), MAX_COINS);
coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); coinMesh.frustumCulled = false;
scene.add(coinMesh);
const coinGlowMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: R.glowTex, color: 0x22c8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), MAX_COINS);
coinGlowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); coinGlowMesh.frustumCulled = false;
scene.add(coinGlowMesh);

// ------------------------------------------------------------------ game state
const LANES = [-LANE_W, 0, LANE_W];
const GRAV = 40, JUMP_V = 11.2;
const STAND_H = 1.7, SLIDE_H = 0.8;
const POWER_DUR = { shield: 12, magnet: 10, drive: 5 };
const COLORS = { shield: [0.4, 0.8, 1.6], magnet: [1.6, 0.3, 0.6], drive: [1.6, 1.2, 0.2] };

const G = {
  state: 'menu', score: 0, combo: 0, alive: false,
  dist: 0, speed: 0, time: 0, best: +(localStorage.getItem('nn_best') || 0),
};
let P; // player state
let obstacles = [], coins = [], pickups = [], decor = [], pendingCars = [];
let nextChunkS = 0, beatsSincePower = 0, lastPowerS = 0, chunkCount = 0;
let chainTimer = 0, mult = 1, topMult = 1, nearCount = 0, coinTotal = 0, coinStreak = 0, coinStreakT = 0;
let shake = 0, timeScale = 1, slowTarget = 1, flashT = 0, hitFlash = 0;
let curDistrict = 0, hintsShown = {}, deathT = 0, overShownAt = 0;
let fovKick = 0, hitStopT = 0, wakeLock = null;

window.__game = {
  get state() { return G.state; },
  get score() { return Math.floor(G.score); },
  get combo() { return G.combo; },
  get alive() { return G.alive; },
  get multiplier() { return mult; },
  get distance() { return Math.floor(G.dist); },
  get speed() { return G.speed; },
  start: () => startRun(),
  input: (a) => act(a),
  _power: (k) => { if (P.power[k] !== undefined) collect(k, P.x, 1, 0); },
};

function resetPlayer() {
  P = {
    lane: 1, x: 0, y: 0, vy: 0, grounded: true, slideT: 0, jumpBuf: 0, slideBuf: 0,
    lastLaneT: -10, lastLaneFrom: 1, phase: 0, power: { shield: 0, magnet: 0, drive: 0 }, grace: 0,
    tumble: 0, lean: 0,
  };
}
resetPlayer();

function clearWorld() {
  for (const o of obstacles) scene.remove(o.mesh);
  for (const p of pickups) scene.remove(p.mesh);
  for (const d of decor) scene.remove(d.mesh);
  obstacles = []; coins = []; pickups = []; decor = []; pendingCars = [];
  particles.clear();
}

function speedFor(d) { return 17 + 19 * (1 - Math.exp(-d / 2000)); }
function difficulty(d) { return Math.min(1, d / 3600); }
function beatTime(d) { return 0.86 - 0.32 * difficulty(d); }

// ------------------------------------------------------------------ spawning
const PAINTS = ['#d8dce8', '#16161e', '#b0122a', '#1b3a8a', '#e8c020', '#30303a', '#6a1aa0', '#0e7a6a'];
const pick = a => a[Math.floor(Math.random() * a.length)];

function districtNeon(s) { return DISTRICTS[districtAt(s)].neon; }

function addObstacle(type, lane, s, extra = {}) {
  let mesh, len = 0.5, ymin = 0, ymax = 1.0, halfW = 0.95, kind = 'low', moving = 0;
  const neon = districtNeon(s);
  switch (type) {
    case 'L': mesh = makeBarricade(0); len = 0.5; ymax = 1.0; break;
    case 'J': mesh = makeBarricade(1); len = 0.7; ymax = 0.9; break;
    case 'R': mesh = makeGate(); len = 0.3; ymin = 0.55; ymax = 0.95; break;
    case 'H': mesh = makeBeam(pick(neon)); len = 0.4; ymin = 1.2; ymax = 3.4; kind = 'high'; break;
    case 'X': mesh = makeContainer(pick(['#a8321e', '#1e5aa8', '#2a7a3a', '#c88a12'])); len = 3.0; ymax = 2.4; kind = 'block'; halfW = 1.0; break;
    case 'B': {
      const k = pick(['sedan', 'sedan', 'taxi', 'sport', 'van']);
      mesh = makeVehicle(k, k === 'taxi' ? '#f2c21b' : pick(PAINTS), pick(neon));
      len = mesh.userData.len; ymax = 2.4; kind = 'block'; halfW = 0.92; break;
    }
    case 'T': mesh = makeVehicle('truck', pick(PAINTS), pick(neon)); len = mesh.userData.len; ymax = 3.5; kind = 'block'; halfW = 1.15; break;
    case 'U': mesh = makeVehicle('bus', pick(['#1a2a6a', '#7a1030', '#0e5a5a']), pick(neon)); len = mesh.userData.len; ymax = 3.0; kind = 'block'; halfW = 1.25; break;
    case 'C': case 'S': {
      const k = pick(['sedan', 'taxi', 'sport', 'sedan', 'van']);
      mesh = makeVehicle(k, k === 'taxi' ? '#f2c21b' : pick(PAINTS), pick(neon), true);
      mesh.rotation.y = Math.PI;
      len = mesh.userData.len; ymax = 2.4; kind = 'block'; halfW = 0.92;
      moving = extra.v;
      if (type === 'S') {
        // blinker lamps
        const bl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), R.mat.amber);
        const side = Math.sign(LANES[extra.from] - LANES[lane]);
        bl.position.set(side * 0.8, 0.7, -len / 2 - 0.05); // car is rotated PI
        const blg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat('#ffa020', 0.9)); blg.position.copy(bl.position); blg.position.z -= 0.05; blg.rotation.y = Math.PI;
        mesh.add(bl, blg); extra.blink = [bl, blg];
      }
      break;
    }
  }
  const x = type === 'S' ? LANES[extra.from] : LANES[lane];
  // long vehicles: front edge at the row
  const sc = (type === 'T' || type === 'U' || type === 'X' || type === 'B') ? s + len / 2 - 0.3 : s;
  mesh.position.set(x, 0, G.dist - sc);
  scene.add(mesh);
  const o = { type, lane, s: sc, len, ymin, ymax, halfW, kind, mesh, x, moving, passed: false, minGap: 99, smashed: false, vel: null, ...extra };
  obstacles.push(o);
  return o;
}

function laneBlockedByCar(lane, s) {
  for (const o of obstacles) if (o.moving && (o.lane === lane || o.from === lane) && o.s > s && o.arriveS < s) return true;
  for (const c of pendingCars) if ((c.lane === lane || c.from === lane) && c.arriveS < s) return true;
  return false;
}

function addCoin(lane, s, y = 0.9) { if (coins.length < MAX_COINS) coins.push({ x: LANES[lane], s, y, lane, taken: false, mag: false }); }
function addGem(lane, s, y = 1.0) {
  const mesh = makeGem(); mesh.position.set(LANES[lane], y, G.dist - s); scene.add(mesh);
  pickups.push({ kind: 'gem', lane, x: LANES[lane], s, y, mesh, taken: false });
}
function addPower(lane, s, kind) {
  const mesh = makePowerup(kind); mesh.position.set(LANES[lane], 1.2, G.dist - s); scene.add(mesh);
  pickups.push({ kind, lane, x: LANES[lane], s, y: 1.2, mesh, taken: false });
}
function addCones(s, side) {
  for (let k = 0; k < 3; k++) {
    const m = makeCone(); m.position.set(side * (ROAD_HALF - 0.35), 0, 0); scene.add(m);
    decor.push({ mesh: m, s: s - 3 + k * 3 });
  }
}

function spawnChunk() {
  const d = difficulty(nextChunkS);
  const v = speedFor(nextChunkS);
  const beat = beatTime(nextChunkS) * v; // meters per beat
  // choose tier
  const r = Math.random();
  let tier = 0;
  if (d > 0.05) tier = r < 0.45 ? 1 : 0;
  if (d > 0.22) tier = r < 0.3 ? 2 : r < 0.75 ? 1 : 0;
  if (d > 0.45) tier = r < 0.35 ? 3 : r < 0.7 ? 2 : r < 0.9 ? 1 : 0;
  if (d > 0.75) tier = r < 0.5 ? 3 : r < 0.85 ? 2 : 1;
  if (chunkCount < 3) tier = 0;
  const pool = CHUNKS.filter(c => c.t === tier);
  const ch = pick(pool);
  const mirror = Math.random() < 0.5;
  let s = nextChunkS;
  const carV = 9 + d * 7;
  let hasConstruction = false;
  ch.rows.forEach((row0, ri) => {
    const row = mirror ? mirrorRow(row0) : row0;
    if (ri > 0) s += beat * row.gap;
    let railDone = false;
    for (let l = 0; l < 3; l++) {
      const t = row.o[l];
      if (t === '.') continue;
      if (t === 'C' || t === 'S') {
        let from = l;
        if (t === 'S') {
          const opts = [l - 1, l + 1].filter(x => x >= 0 && x <= 2 && row.o[x] === '.');
          from = opts.length ? pick(opts) : l;
        }
        pendingCars.push({ type: from === l ? 'C' : 'S', lane: l, from, arriveS: s, v: carV });
        continue;
      }
      if (laneBlockedByCar(l, s)) continue; // never let a car drive through a static obstacle
      if (t === 'R' && !railDone) { world.addRailCrossing(s); railDone = true; }
      if (t === 'L' || t === 'X') hasConstruction = true;
      addObstacle(t, l, s);
    }
    for (let l = 0; l < 3; l++) {
      const c = row.c[l];
      const ob = row.o[l];
      if (c === 'c') for (let k = 0; k < 5; k++) addCoin(l, s - 2.5 - k * 2.2);
      else if (c === 'a') for (let k = -3; k <= 3; k++) { const f = k / 3.6; addCoin(l, s + k * 1.6, 0.9 + 1.6 * (1 - f * f)); }
      else if (c === 's') for (let k = -2; k <= 2; k++) addCoin(l, s + k * 1.8, 0.45);
      else if (c === 'n') for (let k = 0; k < 6; k++) addCoin(l, s + k * beat / 6);
      else if (c === 'g') addGem(l, s, ob === 'H' ? 0.5 : (ob === '.' ? 1.0 : 2.1));
      else if (c === 'G') addGem(l, s - beat * 0.45, 1.0);
      else if (c === 'p') addPower(l, s, pick(['shield', 'magnet', 'drive']));
    }
  });
  if (hasConstruction && Math.random() < 0.7) addCones(nextChunkS, Math.random() < 0.5 ? -1 : 1);
  chunkCount++;
  // breather: coin trail, maybe a power-up
  let gapBeats = 2.2;
  const wantPower = (s - lastPowerS) > 380 + Math.random() * 200 && chunkCount > 2;
  if (wantPower || Math.random() < 0.35) {
    const l = Math.floor(Math.random() * 3);
    const s0 = s + beat * 1.2;
    for (let k = 0; k < 8; k++) addCoin(l, s0 + k * 2.2);
    if (wantPower) {
      const kinds = ['shield', 'magnet', 'drive'];
      addPower((l + 1 + Math.floor(Math.random() * 2)) % 3, s0 + 8, pick(kinds));
      lastPowerS = s0;
    }
    gapBeats = 3.4;
  }
  nextChunkS = s + beat * gapBeats;
}

function spawnPendingCars() {
  const v = Math.max(1, G.speed);
  for (let i = pendingCars.length - 1; i >= 0; i--) {
    const c = pendingCars[i];
    const tArrive = (c.arriveS - G.dist) / v;
    const sNow = c.arriveS + c.v * tArrive; // where the car must be now to arrive on time
    if (sNow - G.dist < 175 || tArrive < 3) {
      const o = addObstacle(c.type, c.lane, sNow, { v: c.v, from: c.from, arriveS: c.arriveS });
      o.s = sNow; o.mesh.position.z = G.dist - sNow;
      pendingCars.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------------ HUD
const hud = { score: $('score'), dist: $('dist'), mult: $('comboMult'), bar: $('comboBar'), label: $('comboLabel'), combo: $('combo'), coins: $('coinCount'), powers: $('powers'), popups: $('popups'), banner: $('banner'), bannerText: $('bannerText') };
let lastHud = {};
function popup(text, color = '#fff', sub = '') {
  if (hud.popups.childElementCount > 4) hud.popups.firstChild.remove();
  const d = document.createElement('div'); d.className = 'popup'; d.style.color = color;
  d.style.marginTop = `${(hud.popups.childElementCount % 3) * 30}px`;
  d.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
  hud.popups.appendChild(d);
  setTimeout(() => d.remove(), 950);
}
function banner(name, color) {
  hud.bannerText.textContent = name; hud.banner.style.color = color;
  hud.banner.classList.remove('show'); void hud.banner.offsetWidth; hud.banner.classList.add('show');
}
const powerEls = {};
function updateHud() {
  const sc = Math.floor(G.score);
  if (sc !== lastHud.score) { hud.score.textContent = sc.toLocaleString('en-US'); lastHud.score = sc; }
  const dm = Math.floor(G.dist);
  if (dm !== lastHud.dist) { hud.dist.textContent = dm + ' m'; lastHud.dist = dm; }
  if (mult !== lastHud.mult) {
    hud.mult.textContent = mult;
    hud.combo.classList.toggle('dim', mult <= 1);
    if (mult > (lastHud.mult || 1)) { hud.combo.classList.add('bump'); setTimeout(() => hud.combo.classList.remove('bump'), 120); }
    lastHud.mult = mult;
  }
  if (G.combo !== lastHud.combo) { hud.label.textContent = 'CHAIN ' + G.combo; lastHud.combo = G.combo; }
  hud.bar.style.width = (G.combo > 0 ? Math.max(0, chainTimer / 3.2) * 100 : 0).toFixed(1) + '%';
  if (coinTotal !== lastHud.coins) { hud.coins.textContent = coinTotal; lastHud.coins = coinTotal; }
  for (const k of ['shield', 'magnet', 'drive']) {
    const t = P.power[k];
    let el = powerEls[k];
    if (t > 0 && !el) {
      el = powerEls[k] = document.createElement('div');
      el.className = 'pw-item pw-' + k;
      el.innerHTML = `<div class="pw-icon">${{ shield: '◈', magnet: '∩', drive: '»' }[k]}</div><div><div>${{ shield: 'SHIELD', magnet: 'MAGNET', drive: 'OVERDRIVE' }[k]}</div><div class="pw-bar"><i></i></div></div>`;
      hud.powers.appendChild(el);
    } else if (t <= 0 && el) { el.remove(); delete powerEls[k]; }
    if (el) {
      el.querySelector('i').style.width = (t / POWER_DUR[k] * 100).toFixed(1) + '%';
      el.classList.toggle('blink', t < 1.5);
    }
  }
}

// ------------------------------------------------------------------ scoring
function bumpChain(n = 1) {
  G.combo += n; chainTimer = 3.2;
  mult = Math.min(10, 1 + Math.floor(G.combo / 2));
  topMult = Math.max(topMult, mult);
  audio.intensity = Math.min(1, 0.25 + mult / 10);
}
function award(pts) { G.score += pts * mult; }

// ------------------------------------------------------------------ input
function act(a) {
  if (G.state !== 'playing') return;
  if (a === 'left' || a === 'right') {
    const nl = Math.max(0, Math.min(2, P.lane + (a === 'left' ? -1 : 1)));
    if (nl !== P.lane) { P.lastLaneFrom = P.lane; P.lane = nl; P.lastLaneT = G.time; audio.lane(); }
  } else if (a === 'up') {
    if (P.grounded) doJump(); else P.jumpBuf = 0.18;
  } else if (a === 'down') {
    if (!P.grounded) { P.vy = Math.min(P.vy, -22); P.slideBuf = 0.3; }
    else doSlide();
  }
}
function doJump() {
  P.vy = JUMP_V; P.grounded = false; P.slideT = 0; audio.jump();
  particles.emit(P.x, 0.1, 0, { n: 8, color: [0.4, 1.6, 2], speed: 3, up: 1, life: 0.4, size: 0.25 });
}
function doSlide() {
  if (P.slideT <= 0) audio.slide();
  P.slideT = 0.62;
}
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down' };
addEventListener('keydown', e => {
  const a = KEYMAP[e.code];
  if (a) e.preventDefault();
  if (e.repeat) return;
  if (G.state === 'menu' || (G.state === 'over' && performance.now() - overShownAt > 450)) {
    if (a === 'up' || e.code === 'Enter' || e.code === 'Space') startRun();
    return;
  }
  if (G.state === 'paused') { resume(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { pause(); return; }
  if (a) act(a);
});

let touch = null;
const SWIPE = () => Math.max(22, Math.min(innerWidth, innerHeight) * 0.055);
addEventListener('pointerdown', e => {
  touch = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, fired: false };
  if (G.state === 'menu') { startRun(); touch.fired = true; }
  else if (G.state === 'over' && performance.now() - overShownAt > 450) { startRun(); touch.fired = true; }
  else if (G.state === 'paused') { resume(); touch.fired = true; }
}, { passive: true });
addEventListener('pointermove', e => {
  if (!touch || e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  const th = SWIPE();
  if (Math.abs(dx) < th && Math.abs(dy) < th) return;
  if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right'); else act(dy < 0 ? 'up' : 'down');
  // re-arm from here so a continued drag can chain another swipe
  touch.x = e.clientX; touch.y = e.clientY; touch.fired = true;
}, { passive: true });
addEventListener('pointerup', e => {
  if (!touch || e.pointerId !== touch.id) return;
  touch = null;
}, { passive: true });
addEventListener('pointercancel', () => { touch = null; });
// block scroll / zoom / pull-to-refresh / context menu
for (const ev of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'dblclick']) {
  document.addEventListener(ev, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
}
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'playing') pause(); });

function pause() { if (G.state !== 'playing') return; G.state = 'paused'; $('pause').classList.remove('hidden'); audio.setMuffle(true, 400); }
function resume() { G.state = 'playing'; $('pause').classList.add('hidden'); audio.setMuffle(false); lastT = performance.now(); }

// ------------------------------------------------------------------ run lifecycle
function startRun() {
  audio.init(); audio.ui();
  if (isMobile && document.documentElement.requestFullscreen && !document.fullscreenElement && params.get('fs') !== '0') {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('portrait').catch(() => { })).catch(() => { });
  }
  if (navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then(l => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => { });
  clearWorld(); resetPlayer();
  const start = +(params.get('start') || 0);
  world.reset(start);
  G.state = 'playing'; G.alive = true; G.score = 0; G.combo = 0; G.dist = start; G.time = 0; G.speed = speedFor(0);
  mult = 1; topMult = 1; chainTimer = 0; nearCount = 0; coinTotal = 0; coinStreak = 0;
  nextChunkS = start + 55; lastPowerS = start - 220; chunkCount = 0; curDistrict = districtAt(start);
  timeScale = 1; slowTarget = 1; shake = 0; hitFlash = 0;
  hintsShown = {};
  lastHud = {};
  for (const k in powerEls) { powerEls[k].remove(); delete powerEls[k]; }
  runner.group.rotation.set(0, 0, 0); runner.body.rotation.set(0, 0, 0); runner.group.visible = true;
  $('start').classList.add('hidden'); $('over').classList.add('hidden'); $('hud').classList.remove('hidden');
  banner(DISTRICTS[curDistrict].name, DISTRICTS[curDistrict].neon[0]);
  audio.intensity = 0.2; audio.tempo = 104; audio.startMusic();
  // early freebie coin trail to teach collecting
  for (let k = 0; k < 8; k++) addCoin(1, start + 18 + k * 2.4);
}

function die(o) {
  if (params.has('auto')) console.log('DEATH', JSON.stringify({ type: o.type, lane: o.lane, from: o.from, ox: +o.x.toFixed(2), px: +P.x.toFixed(2), plane: P.lane, py: +P.y.toFixed(2), slide: P.slideT > 0, d: Math.floor(G.dist), v: +G.speed.toFixed(1), near: obstacles.filter(q => Math.abs(q.s - G.dist) < 30).map(q => q.type + q.lane + '@' + Math.round(q.s - G.dist)).join(' ') }));
  G.alive = false; G.state = 'dying'; deathT = 0;
  audio.crash(); audio.stopMusic();
  shake = 1.2; hitFlash = 1; slowTarget = 0.25;
  particles.emit(P.x, 1, 0, { n: 60, color: [[3, 0.6, 2], [0.5, 2.5, 3], [3, 2, 0.6]], speed: 10, up: 4, life: 1.0, size: 0.35, world: false });
  if (o && o.mesh) o.vel = null;
  P.tumble = 1;
  navigator.vibrate?.(180);
}

function gameOver() {
  G.state = 'over';
  const sc = Math.floor(G.score);
  const isBest = sc > G.best;
  if (isBest) { G.best = sc; localStorage.setItem('nn_best', String(sc)); }
  $('overScore').textContent = sc.toLocaleString('en-US');
  $('overBest').textContent = G.best.toLocaleString('en-US');
  $('bestStart').textContent = G.best.toLocaleString('en-US');
  $('newBest').classList.toggle('hidden', !isBest);
  $('stDist').textContent = Math.floor(G.dist);
  $('stNear').textContent = nearCount;
  $('stCoins').textContent = coinTotal;
  $('stCombo').textContent = 'x' + topMult;
  $('over').classList.remove('hidden'); $('hud').classList.add('hidden');
  overShownAt = performance.now();
  runner.group.visible = false;
}

function smash(o) {
  o.smashed = true;
  o.vel = new THREE.Vector3((Math.random() - 0.5) * 8 + (o.x - P.x) * 3, 7 + Math.random() * 4, G.speed * 0.85 + 8);
  o.spin = new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
  particles.emit(o.x, 1, o.mesh.position.z + 0.5, { n: 30, color: [[3, 1.6, 0.3], [3, 0.5, 1.5], [1, 1, 1]], speed: 9, up: 4, life: 0.8, size: 0.3 });
  audio.smash(); shake = Math.max(shake, 0.45);
}

function hit(o) {
  if (P.power.drive > 0 || P.grace > 0) {
    smash(o); award(50); bumpChain(1); popup('SMASH', '#ffd23f', '+' + 50 * mult);
    return;
  }
  if (P.power.shield > 0) {
    P.power.shield = 0; P.grace = 1.0; smash(o);
    audio.shieldBreak(); shake = 0.8; flashT = 0.6; slowTarget = 0.35; setTimeout(() => { slowTarget = 1; }, 380);
    particles.emit(P.x, 1, 0, { n: 50, color: [0.4, 1.4, 3], speed: 8, up: 2, life: 0.7, size: 0.3, world: false });
    popup('SHIELD BROKEN', '#4cc9ff');
    navigator.vibrate?.(60);
    return;
  }
  die(o);
}

// ------------------------------------------------------------------ main update
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
let blinkT = 0;

function update(dt) {
  const realDt = dt;
  timeScale += (slowTarget - timeScale) * Math.min(1, realDt * 8);
  dt *= timeScale;
  G.time += dt;
  blinkT += dt;

  if (G.state === 'playing') {
    const base = speedFor(G.dist);
    const target = base * (P.power.drive > 0 ? 1.65 : 1);
    G.speed += (target - G.speed) * Math.min(1, dt * (P.power.drive > 0 ? 3 : 1.5));
    const ds = G.speed * dt;
    G.dist += ds;
    award(ds * 0.5);
    audio.tempo = 104 + difficulty(G.dist) * 22;

    // district change
    const di = districtAt(G.dist);
    if (di !== curDistrict) {
      curDistrict = di; world.setDistrict(di);
      banner(DISTRICTS[di].name, DISTRICTS[di].neon[0]);
      audio.powerup();
    }
    while (nextChunkS < G.dist + 165) spawnChunk();
    spawnPendingCars();
    world.scheduleAhead(G.dist);

    // timers
    if (chainTimer > 0) { chainTimer -= dt; if (chainTimer <= 0) { if (G.combo >= 4) popup('CHAIN LOST', '#8a7aa0'); G.combo = 0; mult = 1; audio.intensity = 0.25; } }
    coinStreakT -= dt; if (coinStreakT <= 0) coinStreak = 0;
    for (const k in P.power) if (P.power[k] > 0) {
      P.power[k] -= dt;
      if (P.power[k] <= 0) { P.power[k] = 0; if (k === 'drive') P.grace = 1.2; }
    }
    if (P.grace > 0) P.grace -= dt;

    updatePlayer(dt);
    updateObstacles(dt, ds);
    updateCollectibles(dt, ds);
    hints();
    autopilot();
  } else if (G.state === 'dying') {
    deathT += realDt;
    G.speed *= Math.pow(0.05, dt);
    const ds = G.speed * dt; G.dist += ds;
    updateObstacles(dt, ds, true);
    updateCollectibles(dt, ds);
    // tumble
    runner.body.rotation.x -= dt * 9; runner.group.position.y = Math.max(0, runner.group.position.y + (3 - deathT * 9) * dt);
    runner.group.position.z += dt * 4;
    if (deathT > 1.25) { slowTarget = 1; gameOver(); }
  } else if (G.state === 'menu' || G.state === 'over') {
    // attract mode: cruise the city
    G.speed = 14; const ds = G.speed * dt; G.dist += ds;
    if (G.state === 'menu') { animateRunner(dt, 14); runner.group.position.set(0, 0, 0); }
    updateObstacles(dt, ds, true);
    updateCollectibles(dt, ds);
  }

  particles.update(dt, G.speed * dt);

  // power-up visuals
  shieldMesh.visible = P.power.shield > 0 || P.grace > 0;
  shieldMat.uniforms.uTime.value = G.time;
  if (P.grace > 0 && P.power.shield <= 0) { shieldMesh.visible = Math.floor(G.time * 14) % 2 === 0; shieldMat.uniforms.uCol.value.setRGB(1.6, 1.4, 0.4); }
  else shieldMat.uniforms.uCol.value.setRGB(0.3, 0.8, 1.6);
  if (P.power.shield > 0 && P.power.shield < 1.5) shieldMesh.visible = Math.floor(G.time * 10) % 2 === 0;
  magnetRings.visible = P.power.magnet > 0;
  magnetRings.children.forEach((r, i) => { r.rotation.z = G.time * (i ? -3 : 4); r.rotation.x = Math.PI / 2 + Math.sin(G.time * 3 + i) * 0.3; r.scale.setScalar(1 + 0.08 * Math.sin(G.time * 10 + i * 2)); });
  const drv = P.power.drive > 0 ? 1 : 0;
  driveGlow.material.opacity += (drv * 0.9 - driveGlow.material.opacity) * Math.min(1, realDt * 6);
  if (drv && G.state === 'playing') particles.emit(P.x + (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 1.3, 0.3, { n: 2, color: [[3, 2.2, 0.4], [3, 0.8, 0.2]], speed: 1, up: 0, life: 0.3, size: 0.22, grav: 0, world: false, dir: [0, 0, 5] });
  if (P.power.magnet > 0 && Math.random() < 0.5) particles.emit(P.x + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 2, -2 - Math.random() * 6, { n: 1, color: [2.6, 0.5, 1.2], speed: 0.5, up: 0, life: 0.35, size: 0.16, grav: 0, world: false, dir: [0, 0, 12] });

  // barricade lamps blink
  const on = Math.floor(blinkT * 2.5) % 2 === 0;
  R.mat.amber.color.setRGB(on ? 3 : 0.35, on ? 1.4 : 0.15, on ? 0.1 : 0.0);
}

function updatePlayer(dt) {
  // lateral
  const tx = LANES[P.lane];
  const prevX = P.x;
  P.x += (tx - P.x) * Math.min(1, dt * 15);
  const vx = (P.x - prevX) / Math.max(dt, 1e-4);
  P.lean += (-vx * 0.035 - P.lean) * Math.min(1, dt * 10);
  // vertical
  if (!P.grounded) {
    P.vy -= GRAV * dt * (P.vy < 0 ? 1.25 : 1);
    P.y += P.vy * dt;
    if (P.y <= 0) {
      P.y = 0; P.vy = 0; P.grounded = true; audio.land();
      particles.emit(P.x, 0.1, 0.2, { n: 10, color: [0.6, 0.6, 1.2], speed: 3, up: 0.6, life: 0.35, size: 0.22 });
      if (P.jumpBuf > 0) { P.jumpBuf = 0; doJump(); }
      else if (P.slideBuf > 0) { P.slideBuf = 0; doSlide(); }
    }
  }
  P.jumpBuf -= dt; P.slideBuf -= dt;
  if (P.slideT > 0) {
    P.slideT -= dt;
    if (Math.random() < 0.6) particles.emit(P.x + (Math.random() - 0.5) * 0.4, 0.08, 0.3, { n: 1, color: [2.5, 1.4, 0.4], speed: 2, up: 1.5, life: 0.3, size: 0.12, grav: 12 });
  }
  animateRunner(dt, G.speed);
  runner.group.position.set(P.x, P.y, 0);
  runner.group.rotation.z = P.lean;
}

function animateRunner(dt, speed) {
  const r = runner;
  P.phase += dt * (6 + speed * 0.32);
  const ph = P.phase;
  let hipsY = 0.92, bodyRx = 0, torsoRx = -0.22;
  let lL = Math.sin(ph) * 0.95, lR = -lL;
  let kL = -Math.max(0, Math.sin(ph + 1.6)) * 1.5 - 0.15, kR = -Math.max(0, Math.sin(ph + 1.6 + Math.PI)) * 1.5 - 0.15;
  let aL = -lL * 0.9, aR = -lR * 0.9, eL = 1.2, eR = 1.2;
  let bob = Math.abs(Math.sin(ph)) * 0.09;
  if (G.state === 'playing' && !P.grounded) {
    lL = 1.1; lR = 0.2; kL = -1.6; kR = -0.6; aL = -2.4; aR = -2.2; eL = 0.4; eR = 0.4; bob = 0; torsoRx = -0.35;
  } else if (G.state === 'playing' && P.slideT > 0) {
    bodyRx = 1.15; hipsY = 0.35; lL = 1.45; lR = 1.2; kL = -0.1; kR = -0.5; aL = -0.6; aR = 0.6; eL = 0.3; eR = 0.3; bob = 0; torsoRx = 0;
  }
  const k = Math.min(1, dt * 18);
  const L = (o, p, v) => { o[p] += (v - o[p]) * k; };
  L(r.hips.position, 'y', hipsY + bob);
  L(r.body.rotation, 'x', bodyRx);
  L(r.torso.rotation, 'x', torsoRx);
  L(r.legL.pivot.rotation, 'x', lL); L(r.legR.pivot.rotation, 'x', lR);
  L(r.legL.joint.rotation, 'x', kL); L(r.legR.joint.rotation, 'x', kR);
  L(r.armL.pivot.rotation, 'x', aL); L(r.armR.pivot.rotation, 'x', aR);
  L(r.armL.joint.rotation, 'x', eL); L(r.armR.joint.rotation, 'x', eR);
  r.armL.pivot.rotation.z = -0.15; r.armR.pivot.rotation.z = 0.15;
  r.shadow.position.y = 0.04 - (P.y || 0);
  r.shadow.material.opacity = 0.5 / (1 + (P.y || 0));
}

function updateObstacles(dt, ds, passive = false) {
  const ph = P.y, pH = P.slideT > 0 ? SLIDE_H : STAND_H;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (o.moving && !o.smashed) {
      o.s -= o.moving * dt;
      // swerve: switch lanes shortly before arrival
      if (o.type === 'S') {
        const tArr = (o.s - G.dist) / Math.max(1, G.speed + o.moving);
        const f = Math.min(1, Math.max(0, (1.75 - tArr) / 0.7));
        const e = f * f * (3 - 2 * f);
        o.x = LANES[o.from] + (LANES[o.lane] - LANES[o.from]) * e;
        o.mesh.rotation.y = Math.PI + (LANES[o.lane] - LANES[o.from]) * 0.12 * Math.sin(f * Math.PI);
        const bl = Math.floor(G.time * 6) % 2 === 0;
        o.blink.forEach(b => b.visible = bl);
      }
      // horn when bearing down on the player's lane
      if (!o.honked && !passive && Math.abs(o.x - P.x) < 1.2 && o.s - G.dist < 38 && o.s - G.dist > 8) { o.honked = true; audio.horn(); }
    }
    if (o.smashed && o.vel) {
      o.vel.y -= 25 * dt;
      o.mesh.position.x += o.vel.x * dt; o.mesh.position.y = Math.max(-2, o.mesh.position.y + o.vel.y * dt);
      o.s += o.vel.z * dt;
      o.mesh.rotation.x += o.spin.x * dt; o.mesh.rotation.y += o.spin.y * dt; o.mesh.rotation.z += o.spin.z * dt;
    } else {
      o.mesh.position.x = o.x;
    }
    o.mesh.position.z = G.dist - o.s;
    // once behind the runner, get out of the camera's way
    if (G.state === 'playing' || G.state === 'menu') o.mesh.visible = o.mesh.position.z < 2.2 + o.len / 2 || o.smashed;
    const dz = o.s - G.dist;
    if (dz < -o.len / 2 - 25 || (o.smashed && o.mesh.position.y < -1.5)) { scene.remove(o.mesh); obstacles.splice(i, 1); continue; }
    if (passive || o.smashed || G.state !== 'playing') continue;
    // collision
    const zOverlap = Math.abs(dz) < o.len / 2 + 0.35;
    const gap = Math.abs(o.x - P.x) - (o.halfW + 0.32);
    if (zOverlap) {
      o.minGap = Math.min(o.minGap, gap);
      if (gap < 0) {
        const yOverlap = ph < o.ymax && ph + pH > o.ymin;
        if (yOverlap) { hit(o); if (!G.alive) return; continue; }
        o.cleared = true;
      }
    }
    // passed: evaluate near miss / clean clear
    if (!o.passed && dz < -o.len / 2 - 0.4) {
      o.passed = true;
      if (o.cleared) {
        const tag = o.kind === 'high' ? 'DUCK!' : 'HOP!';
        award(30); bumpChain(1); popup(tag, o.kind === 'high' ? '#22e6ff' : '#ffb52b', '+' + 30 * mult);
      } else if (o.minGap < 1.2 && o.kind === 'block') {
        const recent = G.time - P.lastLaneT < 0.55 && P.lastLaneFrom === o.lane;
        if (o.minGap < 0.62 || recent) {
          const big = !!o.moving;
          const pts = big ? 150 : 100;
          nearCount++; bumpChain(big ? 2 : 1); award(pts);
          popup(big ? 'WHOOSH!' : 'NEAR MISS', big ? '#ff2bd6' : '#ff4fd8', '+' + pts * mult);
          audio.nearMiss(G.combo);
          shake = Math.max(shake, 0.18);
          if (big) { slowTarget = 0.55; clearTimeout(hitStopT); hitStopT = setTimeout(() => { if (G.state === 'playing') slowTarget = 1; }, 110); }
          fovKick = Math.min(fovKick + 4, 8);
          particles.emit((o.x + P.x) / 2, 1.0, 0, { n: 16, color: [[3, 0.5, 2.4], [0.6, 2.5, 3]], speed: 5, up: 1, life: 0.45, size: 0.22, world: false });
        }
      }
    }
  }
}

function collect(kind, x, y, z) {
  if (kind === 'coin') {
    coinTotal++; coinStreak++; coinStreakT = 0.7;
    award(10); chainTimer = Math.max(chainTimer, Math.min(3.2, chainTimer + 0.4));
    audio.coin(coinStreak);
    particles.emit(x, y, z, { n: 6, color: [0.5, 2.4, 3], speed: 3, up: 1, life: 0.35, size: 0.2, grav: 2 });
  } else if (kind === 'gem') {
    award(250); bumpChain(2); audio.gem();
    popup('GEM', '#ff2bd6', '+' + 250 * mult);
    particles.emit(x, y, z, { n: 26, color: [[3, 0.6, 2.8], [2, 1.5, 3]], speed: 6, up: 2, life: 0.6, size: 0.3, grav: 4 });
    flashT = Math.max(flashT, 0.15);
  } else {
    P.power[kind] = POWER_DUR[kind];
    if (kind === 'drive') { fovKick = 10; shake = 0.3; }
    audio.powerup();
    popup({ shield: 'SHIELD', magnet: 'MAGNET', drive: 'OVERDRIVE!' }[kind], { shield: '#4cc9ff', magnet: '#ff4f7b', drive: '#ffd23f' }[kind]);
    particles.emit(x, y, z, { n: 40, color: COLORS[kind], speed: 7, up: 2, life: 0.7, size: 0.35, grav: 2 });
    flashT = 0.35;
  }
}

function updateCollectibles(dt, ds) {
  const playing = G.state === 'playing';
  const pH = P.slideT > 0 ? SLIDE_H : STAND_H;
  const mag = P.power.magnet > 0;
  let n = 0;
  const spin = G.time * 4;
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    const dz = c.s - G.dist;
    if (dz < -8) { coins.splice(i, 1); continue; }
    if (playing) {
      if (mag && dz < 28 && dz > -1) c.mag = true;
      if (c.mag) {
        const k = Math.min(1, dt * 9);
        c.x += (P.x - c.x) * k; c.y += (P.y + 1.0 - c.y) * k; c.s += (G.dist - c.s) * k;
      }
      const dzz = c.s - G.dist;
      if (Math.abs(c.x - P.x) < 0.85 && Math.abs(dzz) < 0.9 && c.y > P.y - 0.3 && c.y < P.y + pH + 0.35) {
        collect('coin', c.x, c.y, G.dist - c.s); coins.splice(i, 1); continue;
      }
    }
    if (dz > 160 || dz < -1.2) continue;
    tmpE.set(0, spin + c.s * 0.3, 0); tmpQ.setFromEuler(tmpE);
    tmpV.set(c.x, c.y + Math.sin(G.time * 3 + c.s) * 0.06, G.dist - c.s);
    tmpS.set(1, 1, 1);
    tmpM.compose(tmpV, tmpQ, tmpS); coinMesh.setMatrixAt(n, tmpM);
    tmpQ.copy(camera.quaternion); tmpM.compose(tmpV, tmpQ, tmpS); coinGlowMesh.setMatrixAt(n, tmpM);
    n++;
  }
  coinMesh.count = n; coinGlowMesh.count = n;
  coinMesh.instanceMatrix.needsUpdate = true; coinGlowMesh.instanceMatrix.needsUpdate = true;

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    const dz = p.s - G.dist;
    if (dz < -8) { scene.remove(p.mesh); pickups.splice(i, 1); continue; }
    if (playing) {
      if (mag && p.kind === 'gem' && dz < 28 && dz > -1) p.mag = true;
      if (p.mag) { const k = Math.min(1, dt * 9); p.x += (P.x - p.x) * k; p.y += (P.y + 1 - p.y) * k; p.s += (G.dist - p.s) * k; }
      const dzz = p.s - G.dist;
      if (Math.abs(p.x - P.x) < 1.0 && Math.abs(dzz) < 1.1 && p.y > P.y - 0.5 && p.y < P.y + pH + 0.6) {
        collect(p.kind, p.x, p.y, G.dist - p.s); scene.remove(p.mesh); pickups.splice(i, 1); continue;
      }
    }
    p.mesh.position.set(p.x, p.y + Math.sin(G.time * 3 + p.s) * 0.12, G.dist - p.s);
    const u = p.mesh.userData;
    if (p.kind === 'gem') { u.m.rotation.y += dt * 3; u.w.rotation.y -= dt * 2; }
    else { u.core.rotation.x += dt * 1.5; u.core.rotation.y += dt * 2; u.ring.rotation.x = G.time * 2; u.ring.rotation.y = G.time * 1.3; }
  }
  for (let i = decor.length - 1; i >= 0; i--) {
    const d = decor[i];
    d.mesh.position.z = G.dist - d.s;
    if (d.s - G.dist < -15) { scene.remove(d.mesh); decor.splice(i, 1); }
  }
}

// test-only autopilot (?auto): dodges using the same rules a player would
function autopilot() {
  if (!params.has('auto') || G.state !== 'playing') return;
  const look = 14 + G.speed * 0.6;
  const blocked = l => obstacles.some(o => !o.smashed && o.kind === 'block' && (o.lane === l || (o.type === 'S' && o.from === l)) &&
    o.s - o.len / 2 - G.dist < look && o.s + o.len / 2 - G.dist > -1.5);
  if (blocked(P.lane)) {
    const order = [P.lane - 1, P.lane + 1, P.lane - 2, P.lane + 2].filter(l => l >= 0 && l <= 2);
    const t = order.find(l => !blocked(l) && (Math.abs(l - P.lane) === 1 || !blocked((l + P.lane) / 2) || true));
    if (t !== undefined) act(t < P.lane ? 'left' : 'right');
    return;
  }
  const ahead = obstacles.filter(o => !o.smashed && o.lane === P.lane && o.s - o.len / 2 - G.dist > 0 && o.s - o.len / 2 - G.dist < look).sort((a, b) => a.s - b.s)[0];
  if (ahead) {
    const d = ahead.s - ahead.len / 2 - G.dist;
    if (ahead.kind === 'low' && d < 2 + G.speed * 0.16 && P.grounded) act('up');
    if (ahead.kind === 'high' && d < 2 + G.speed * 0.14 && P.slideT <= 0.1) act('down');
  }
}

function hints() {
  if (G.best > 2500 || G.dist > 600) return;
  for (const o of obstacles) {
    const dz = o.s - G.dist;
    if (o.lane !== P.lane || dz > 22 || dz < 6 || o.hinted) continue;
    const key = o.kind === 'high' ? 'slide' : o.kind === 'low' ? 'jump' : 'lane';
    if ((hintsShown[key] || 0) >= 2) continue;
    hintsShown[key] = (hintsShown[key] || 0) + 1; o.hinted = true;
    popup({ slide: 'SWIPE ↓ SLIDE', jump: 'SWIPE ↑ JUMP', lane: 'SWIPE ← → DODGE' }[key], '#ffffff');
  }
}

// ------------------------------------------------------------------ camera & lights
const camPos = new THREE.Vector3(0, 4.6, 8), camLook = new THREE.Vector3(0, 1.2, -10);
let baseFov = 80;
function updateCamera(dt, realDt) {
  const tx = P.x * 0.55;
  const ty = 4.0 + P.y * 0.4 - (P.slideT > 0 ? 0.35 : 0);
  const k = Math.min(1, realDt * 7);
  camPos.x += (tx - camPos.x) * k; camPos.y += (ty - camPos.y) * k;
  camPos.z = 6.6;
  camLook.set(P.x * 0.7, 2.3 + P.y * 0.3, -12);
  shake = Math.max(0, shake - realDt * 1.6);
  const s2 = shake * shake, t = performance.now() * 0.001;
  const bob = (G.state === 'playing' && P.grounded && P.slideT <= 0) ? Math.abs(Math.sin(P.phase)) * 0.06 : 0;
  camera.position.set(camPos.x + Math.sin(t * 47) * s2 * 0.5, camPos.y + bob + Math.sin(t * 59 + 1) * s2 * 0.4, camPos.z);
  camera.lookAt(camLook);
  camera.rotateZ(P.lean * 0.35 + Math.sin(t * 37) * s2 * 0.04);
  // speed feel: FOV opens up with speed & overdrive
  fovKick = Math.max(0, fovKick - realDt * 8);
  const sp = (G.speed - 17) / 19;
  const targetFov = baseFov + sp * 6 + (P.power.drive > 0 ? 10 : 0) + fovKick;
  camera.fov += (targetFov - camera.fov) * Math.min(1, realDt * 4);
  camera.updateProjectionMatrix();
}

const extraLights = [];
function gatherLights() {
  extraLights.length = 0;
  for (const o of obstacles) {
    const z = o.mesh.position.z;
    if (z < -110 || z > 6 || o.smashed) continue;
    if (o.moving) extraLights.push({ x: o.x, y: 0.7, z: z + o.len / 2 + 0.4, r: 1.8, g: 1.6, b: 1.2, radius: 0.15 });
    else if (o.type === 'L') extraLights.push({ x: o.x, y: 1.0, z, r: R.mat.amber.color.r * 0.3, g: R.mat.amber.color.g * 0.3, b: 0.02, radius: 0.35 });
    else if (o.type === 'B' || o.type === 'T' || o.type === 'U') extraLights.push({ x: o.x, y: 0.8, z: z + o.len / 2, r: 0.7, g: 0.02, b: 0.06, radius: 0.5 });
    else if (o.type === 'H') extraLights.push({ x: o.x, y: 1.3, z, r: 0.5, g: 0.4, b: 0.5, radius: 0.4 });
  }
  for (const p of pickups) {
    const z = p.mesh.position.z; if (z < -80 || z > 5) continue;
    const c = p.kind === 'gem' ? [1.2, 0.2, 1.0] : COLORS[p.kind].map(v => v * 0.6);
    extraLights.push({ x: p.x, y: p.y, z, r: c[0], g: c[1], b: c[2], radius: 0.5 });
  }
  const dr = P.power.drive > 0;
  extraLights.push({ x: P.x, y: 1.0 + P.y, z: 0, r: dr ? 0.45 : 0.04, g: dr ? 0.3 : 0.25, b: dr ? 0.05 : 0.35, radius: 0.6 });
  return extraLights;
}

// ------------------------------------------------------------------ resize & quality
let W = 0, H = 0, dpr = 1;
function resize() {
  W = innerWidth; H = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, quality.maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  post.setSize(W, H, dpr);
  camera.aspect = W / H;
  // keep the three lanes framed in portrait: derive vertical FOV from a target horizontal FOV
  const hf = 54 * Math.PI / 180;
  let vf = 2 * Math.atan(Math.tan(hf / 2) / camera.aspect) * 180 / Math.PI;
  baseFov = Math.max(58, Math.min(96, vf));
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  particles.mat.uniforms.uScale.value = H * dpr / (2 * Math.tan(camera.fov * Math.PI / 360));
}
addEventListener('resize', resize);
screen.orientation?.addEventListener?.('change', () => setTimeout(resize, 150));
resize();

// adaptive quality: step down resolution / bloom if frames are slow
let perfAcc = 0, perfN = 0, perfWarm = 0;
function perf(dtMs) {
  if (params.has('noadapt') || G.state !== 'playing') return;
  perfWarm += dtMs; if (perfWarm < 3000) return;
  perfAcc += dtMs; perfN++;
  if (perfAcc > 2500) {
    const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
    if (avg > 20.5 && quality.level < 4) {
      quality.level++;
      if (quality.level === 1) quality.maxDpr = Math.min(quality.maxDpr, 1.4);
      if (quality.level === 2) quality.maxDpr = 1.15;
      if (quality.level === 3) { post.bloom.strength = 0.7; post.bloom.setSize(Math.floor(W * dpr / 4), Math.floor(H * dpr / 4)); }
      if (quality.level === 4) { quality.maxDpr = 0.9; }
      resize();
    }
  }
}

// ------------------------------------------------------------------ loop
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let realDt = Math.min(0.05, (now - lastT) / 1000);
  perf(now - lastT);
  window.__perf.fps = window.__perf.fps * 0.95 + (1000 / Math.max(1, now - lastT)) * 0.05;
  lastT = now;
  if (G.state === 'paused') { post.render(); return; }
  update(realDt);
  updateCamera(realDt * timeScale, realDt);
  world.update(realDt * timeScale, G.dist, G.speed, camera, gatherLights());
  world.speedU.uTime.value += realDt * timeScale * (0.4 + G.speed / 30);
  const sl = Math.max(0, (G.speed - 22) / 14) * 0.6 + (P.power.drive > 0 ? 1 : 0);
  world.speedU.uAmt.value += (Math.min(1.2, sl) - world.speedU.uAmt.value) * Math.min(1, realDt * 4);
  world.speedU.uCol.value.setRGB(P.power.drive > 0 ? 1.5 : 0.8, P.power.drive > 0 ? 1.1 : 0.9, P.power.drive > 0 ? 0.3 : 1.2);
  // post fx
  hitFlash = Math.max(0, hitFlash - realDt * 1.5);
  flashT = Math.max(0, flashT - realDt * 2.5);
  const fx = post.fx.uniforms;
  fx.uTime.value = now * 0.001;
  fx.uCA.value = hitFlash * 3 + (P.power.drive > 0 ? 0.9 : 0) + fovKick * 0.05;
  fx.uRadial.value = P.power.drive > 0 ? 1 : Math.max(0, (G.speed - 26) / 12) * 0.5;
  fx.uTint.value.set(hitFlash * 0.5 + flashT * 0.15, flashT * 0.15, flashT * 0.2);
  fx.uVig.value = 1.0 + hitFlash;
  $('flash').style.opacity = (flashT * 0.25).toFixed(3);
  if (G.state === 'playing') updateHud();
  renderer.info.reset();
  post.render();
  window.__perf.calls = renderer.info.render.calls; window.__perf.tris = renderer.info.render.triangles;
}

// ------------------------------------------------------------------ boot
$('bestStart').textContent = G.best.toLocaleString('en-US');
// attract-mode traffic so the menu has life
function attract() {
  if (G.state === 'menu') {
    if (Math.random() < 0.5) addObstacle('C', Math.random() < 0.5 ? 0 : 2, G.dist + 140, { v: 10, arriveS: G.dist });
    else addObstacle('B', Math.random() < 0.5 ? 0 : 2, G.dist + 140);
  }
  setTimeout(attract, 1600 + Math.random() * 1500);
}
world.reset();
attract();
requestAnimationFrame(t => { lastT = t; $('loading').classList.add('gone'); setTimeout(() => $('loading').remove(), 600); frame(t); });
