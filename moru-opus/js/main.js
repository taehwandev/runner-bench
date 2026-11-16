import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as T from './textures.js';
import * as MD from './models.js';
import { M, G, TX } from './models.js';
import { Sound } from './audio.js';

// ============================================================ constants
const SPAWN = 175;                 // spawn horizon (m ahead)
const LANE_X = [-2.3, 0, 2.3];
const JUMP_V = 9.4, GRAV = 27;     // apex ~1.64m, airtime ~0.7s
const SLIDE_T = 0.62;
const COMBO_TIME = 3.4;
const DISTRICT_LEN = 900;
const POWER_TIME = { shield: 14, magnet: 10, overdrive: 4.5 };
const DISTRICTS = [
  { name: 'NEON DOWNTOWN', fog: 0x1c0a30, skyTop: 0x04020c, curb: '#00e5ff', lamp: [3, 2.2, 1.5], rain: 1, tall: 0.8, neon: ['#ff2bd6', '#00e5ff', '#a259ff', '#ff3355'], feat: { rail: 1, construction: 1, tunnel: 0.7 } },
  { name: 'LANTERN MARKET', fog: 0x2a0812, skyTop: 0x080104, curb: '#ffb000', lamp: [3, 1.5, 0.6], rain: 0.35, tall: 0.3, neon: ['#ff3355', '#ffb000', '#ff7a00', '#ff2bd6'], feat: { rail: 0.8, construction: 0.6, tunnel: 0.3 } },
  { name: 'HARBOR WORKS', fog: 0x061a22, skyTop: 0x010507, curb: '#ffb000', lamp: [2.2, 2.6, 3], rain: 0.8, tall: 0.35, neon: ['#00e5ff', '#ffb000', '#7cff4f', '#e8f6ff'], feat: { rail: 1.2, construction: 1.6, tunnel: 1 } },
  { name: 'SYNTH BOULEVARD', fog: 0x14062e, skyTop: 0x030110, curb: '#a259ff', lamp: [2.6, 1.3, 3], rain: 0, tall: 0.6, neon: ['#a259ff', '#7cff4f', '#ff2bd6', '#00e5ff'], feat: { rail: 0.6, construction: 0.8, tunnel: 1.4 } },
];
for (const d of DISTRICTS) d.C = { fog: new THREE.Color(d.fog), top: new THREE.Color(d.skyTop), curb: new THREE.Color(d.curb), glow: new THREE.Color(d.neon[0]), lamp: new THREE.Color(...d.lamp) };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = Math.random;
const pick = (arr) => arr[(rand() * arr.length) | 0];
const wpick = (w) => { let s = 0; for (const k in w) s += w[k]; let r = rand() * s; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return Object.keys(w)[0]; };
const speedAt = (D) => 17 + 23 * (1 - Math.exp(-D / 2800));
const diffAt = (D) => Math.min(1, D / 5000);
const districtAt = (D) => Math.floor(Math.max(0, D) / DISTRICT_LEN) % DISTRICTS.length;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ============================================================ renderer / scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.info.autoReset = false;
const MAX_PR = isTouch ? 1.75 : 1.5;
let pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PR);

const scene = new THREE.Scene();
const fogColor = new THREE.Color(DISTRICTS[0].fog);
scene.fog = new THREE.Fog(fogColor.clone(), 22, 182);
scene.background = fogColor.clone();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 900);
scene.add(camera);

MD.initMaterials();
M.glow.side = THREE.DoubleSide;

// environment map for reflections (neon-ish room)
{
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.BoxGeometry(50, 50, 50), new THREE.MeshBasicMaterial({ color: 0x07040e, side: THREE.BackSide })));
  const panel = (c, x, y, z, w, h, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; es.add(m); };
  panel(new THREE.Color(3, 0.3, 2.2), -20, 4, -8, 10, 3, Math.PI / 2);
  panel(new THREE.Color(0.2, 2.2, 3), -20, 3, 12, 8, 2, Math.PI / 2);
  panel(new THREE.Color(3, 0.4, 2.2), 20, 3, -14, 8, 2, -Math.PI / 2);
  panel(new THREE.Color(0.2, 2.2, 3), 20, 6, 4, 12, 2, -Math.PI / 2);
  panel(new THREE.Color(2.5, 0.25, 1.8), -6, 2.5, -24, 2.5, 0.6, 0);
  panel(new THREE.Color(0.2, 1.6, 2.6), 5, 4, -24, 3, 0.4, 0);
  panel(new THREE.Color(2.6, 1.2, 0.2), 1, 6, -24, 1.2, 1.2, 0);
  panel(new THREE.Color(1.2, 0.5, 3), -6, 8, 24, 14, 3, 0);
  panel(new THREE.Color(0.12, 0.06, 0.22), 0, 22, 0, 30, 30, 0);
  es.children.at(-1).rotation.x = Math.PI / 2;
  scene.environment = pm.fromScene(es, 0.03).texture;
  pm.dispose();
}

// lights
const hemi = new THREE.HemisphereLight(0x5a4aa0, 0x120818, 0.7);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9ab0ff, 0.6); moon.position.set(-10, 20, 10); scene.add(moon);
const playerLight = new THREE.PointLight(0x40e8ff, 5, 8, 2); scene.add(playerLight);
const fxLight = new THREE.PointLight(0xffd23a, 0, 14, 2); scene.add(fxLight);

// sky dome
const skyMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color(DISTRICTS[0].skyTop) }, horizon: { value: fogColor.clone() }, glow: { value: new THREE.Color(0xff2bd6) } },
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; varying vec3 vP;
    void main(){ float h = clamp(vP.y, -0.2, 1.0); vec3 c = mix(horizon, top, smoothstep(0.0, 0.45, h));
    c += glow * 0.18 * exp(-abs(h) * 9.0); gl_FragColor = vec4(c, 1.0); }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 12), skyMat); sky.renderOrder = -10; scene.add(sky);
const skyFar = MD.makeSkyline(3, true, new THREE.Color(0.55, 0.45, 0.85)); skyFar.renderOrder = -9; scene.add(skyFar);
const skyNear = MD.makeSkyline(8, false, new THREE.Color(0.8, 0.6, 1.0)); skyNear.renderOrder = -8; scene.add(skyNear);
skyFar.scale.set(1, 0.75, 1); skyNear.scale.set(0.8, 0.5, 1);

// ground strips (static, textures scroll)
const roadTex = T.roadTextures();
const ROAD_LEN = 230;
for (const t of [roadTex.map, roadTex.rough]) t.repeat.set(1, ROAD_LEN / T.ROAD_TILE);
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex.map, roughnessMap: roadTex.rough, roughness: 1, metalness: 0.7, envMapIntensity: 1.8, color: 0x8a86a0 });
const road = new THREE.Mesh(new THREE.PlaneGeometry(T.ROAD_W, ROAD_LEN), roadMat);
road.rotation.x = -Math.PI / 2; road.position.z = -ROAD_LEN / 2 + 12; scene.add(road);
const swTex = T.sidewalkTexture(); swTex.repeat.set(1, ROAD_LEN / 20);
const swMat = new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.55, metalness: 0.45, envMapIntensity: 1.0, color: 0x6a6678 });
for (const s of [-1, 1]) {
  const sw = new THREE.Mesh(new THREE.PlaneGeometry(3.6, ROAD_LEN), swMat);
  sw.rotation.x = -Math.PI / 2; sw.position.set(s * 5.6, 0.16, -ROAD_LEN / 2 + 12); scene.add(sw);
  const curb = new THREE.Mesh(G.box, M.concrete); curb.scale.set(0.22, 0.17, ROAD_LEN); curb.position.set(s * 3.9, 0.08, -ROAD_LEN / 2 + 12); scene.add(curb);
}
const curbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(DISTRICTS[0].curb).multiplyScalar(2.2) });
for (const s of [-1, 1]) { const c = new THREE.Mesh(G.box, curbMat); c.scale.set(0.04, 0.04, ROAD_LEN); c.position.set(s * 3.78, 0.15, -ROAD_LEN / 2 + 12); scene.add(c); }
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x0b0a10, roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.position.z = -250; scene.add(ground);

// scrolling world container
const world = new THREE.Group(); scene.add(world);

// ============================================================ prototypes
const PROTO = { buildings: [], cars: {}, blocks: {} };
{
  const r = T.rng(1234);
  DISTRICTS.forEach((d, di) => {
    const set = { '-1': [], '1': [] };
    for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
      const tall = r() < d.tall;
      set[side].push(MD.makeBuilding(r, d, tall, side));
    }
    PROTO.buildings[di] = set;
  });
  const rr = T.rng(99);
  PROTO.cars.sedan = [0, 1, 2, 3, 4].map(() => MD.makeCar('sedan', rr, true));
  PROTO.cars.taxi = [0, 1].map(() => MD.makeCar('taxi', rr, true));
  PROTO.cars.sports = [0, 1, 2].map(() => MD.makeCar('sports', rr, true));
  PROTO.blocks.van = [0, 1, 2].map(() => MD.makeCar('van', rr, false));
  PROTO.blocks.truck = [0, 1].map(() => MD.makeCar('truck', rr, false));
  PROTO.blocks.bus = [0, 1].map(() => MD.makeCar('bus', rr, false));
  PROTO.blocks.container = [0, 1, 2, 3].map(() => MD.makeContainer(rr));
  PROTO.barrier = MD.makeBarrier('jersey');
  PROTO.sawhorse = MD.makeBarrier('sawhorse');
  PROTO.beam = MD.makeBeam();
  PROTO.cone = MD.makeCone();
  PROTO.gate = MD.makeGate();
  PROTO.trains = [0, 1].map(() => MD.makeTrain(rr, 4));
  PROTO.lamp = MD.makeLamp();
  PROTO.arrow = MD.makeArrowBoard();
  PROTO.overpass = DISTRICTS.map(d => MD.makeOverpass(rr, d.neon[1]));
  PROTO.tseg = DISTRICTS.map(d => [0, 1].map(i => MD.makeTunnelSeg(d.neon[0], i)));
  PROTO.portal = DISTRICTS.map(d => MD.makeTunnelPortal(d.neon[0]));
  PROTO.power = { shield: MD.makePowerup('shield'), magnet: MD.makePowerup('magnet'), overdrive: MD.makePowerup('overdrive') };
}
const OB = {
  barrier: { t: 'low', hw: 1.05, y0: 0, y1: 0.95, hd: 0.35 },
  sawhorse: { t: 'low', hw: 1.05, y0: 0, y1: 1.0, hd: 0.3 },
  beam: { t: 'high', hw: 1.15, y0: 1.12, y1: 3.8, hd: 0.2 },
  container: { t: 'block', hw: 1.05, y0: 0, y1: 2.6, hd: 1.3 },
  van: { t: 'block', hw: 1.0, y0: 0, y1: 2.3, hd: 2.6 },
  truck: { t: 'block', hw: 1.15, y0: 0, y1: 3.3, hd: 3.75 },
  bus: { t: 'block', hw: 1.25, y0: 0, y1: 3.2, hd: 5 },
  sedan: { t: 'car', hw: 0.93, y0: 0, y1: 1.42, hd: 2.25 },
  taxi: { t: 'car', hw: 0.93, y0: 0, y1: 1.5, hd: 2.25 },
  sports: { t: 'car', hw: 0.98, y0: 0, y1: 1.12, hd: 2.2 },
  gate: { t: 'gate', hw: 4.2, y0: 0.98, y1: 1.32, hd: 0.15 },
};

// ============================================================ runner
const runner = MD.makeRunner();
scene.add(runner.root);
const shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 2), new THREE.ShaderMaterial({
  uniforms: { t: { value: 0 }, color: { value: new THREE.Color(0.3, 1.4, 3.0) }, a: { value: 1 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform float t; uniform vec3 color; uniform float a; varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float hex = step(0.92, fract(vP.y*6.0 + t*1.5)) * 0.35; gl_FragColor = vec4(color * (f + hex*f + 0.04) * a, 1.0); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
}));
shieldMesh.position.y = 0.95; shieldMesh.visible = false; runner.root.add(shieldMesh);
const magnetRings = new THREE.Group();
for (let i = 0; i < 2; i++) {
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.62 + i * 0.12, 0.015, 6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.25, 0.6), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  r.rotation.x = Math.PI / 2; magnetRings.add(r);
}
magnetRings.visible = false; runner.root.add(magnetRings);
const boostGlow = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: TX.glow, color: 0xffc030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
boostGlow.rotation.x = -Math.PI / 2; boostGlow.scale.set(2.4, 7, 1); boostGlow.position.set(0, 0.05, 2.2); runner.root.add(boostGlow);
const footGlow = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: TX.glow, color: 0x30d8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
footGlow.rotation.x = -Math.PI / 2; footGlow.scale.set(2.2, 3.0, 1); footGlow.position.set(0, 0.04, 0.3); runner.root.add(footGlow);

// ribbons trailing behind the runner
class Ribbon {
  constructor(n, width, color) {
    this.n = n; this.w = width; this.pts = []; this.color = new THREE.Color(color);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.col = new Float32Array(n * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; scene.add(this.mesh);
    for (let i = 0; i < n; i++) this.pts.push(new THREE.Vector3(0, -10, 0));
  }
  update(p, dz, intensity, w) {
    for (const q of this.pts) q.z += dz;
    this.pts.pop(); this.pts.unshift(p.clone());
    const width = w ?? this.w;
    for (let i = 0; i < this.n; i++) {
      const q = this.pts[i], f = (1 - i / (this.n - 1));
      const hw = width * (0.3 + 0.7 * f);
      this.pos.set([q.x, q.y + hw, q.z, q.x, q.y - hw, q.z], i * 6);
      const k = f * f * intensity;
      for (let j = 0; j < 2; j++) { this.col[i * 6 + j * 3] = this.color.r * k; this.col[i * 6 + j * 3 + 1] = this.color.g * k; this.col[i * 6 + j * 3 + 2] = this.color.b * k; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.color.needsUpdate = true;
  }
  reset() { for (const q of this.pts) q.set(0, -10, 0); }
}
const ribbons = [new Ribbon(22, 0.13, 0x20e8ff), new Ribbon(14, 0.04, 0xff3ad8), new Ribbon(14, 0.04, 0xff3ad8)];

// ============================================================ particles
const PN = 700;
const particles = (() => {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(PN * 3), col = new Float32Array(PN * 3), size = new Float32Array(PN);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { scale: { value: 500 } },
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale;
      void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = min(size*scale/ -mv.z, 48.0); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC*a, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  const P = []; for (let i = 0; i < PN; i++) P.push({ life: 0, max: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, r: 1, g: 1, b: 1, grav: 0, drag: 0, attach: 1 });
  let cursor = 0;
  return {
    mat, emit(x, y, z, o) {
      const p = P[cursor]; cursor = (cursor + 1) % PN;
      p.x = x; p.y = y; p.z = z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.life = p.max = o.life || 0.6;
      p.s = o.size || 0.15; const c = o.color; p.r = c.r; p.g = c.g; p.b = c.b; p.grav = o.grav ?? 9; p.drag = o.drag ?? 1; p.attach = o.attach ?? 1;
    },
    burst(x, y, z, n, color, spd, o = {}) {
      const c = new THREE.Color(color).multiplyScalar(o.bright ?? 2);
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2, e = (rand() - 0.3) * Math.PI, s = spd * (0.4 + rand() * 0.8);
        this.emit(x + (rand() - 0.5) * (o.spread || 0.3), y + (rand() - 0.5) * (o.spread || 0.3), z + (rand() - 0.5) * (o.spread || 0.3),
          { vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + (o.up || 0), vz: Math.sin(a) * Math.cos(e) * s + (o.vz || 0), life: (o.life || 0.6) * (0.6 + rand() * 0.6), size: (o.size || 0.15) * (0.6 + rand() * 0.8), color: c, grav: o.grav, drag: o.drag, attach: o.attach });
      }
    },
    update(dt, worldDz) {
      for (let i = 0; i < PN; i++) {
        const p = P[i];
        if (p.life <= 0 || p.z > 4) { p.life = 0; size[i] = 0; continue; }
        p.life -= dt; const k = Math.max(0, p.life / p.max);
        p.vy -= p.grav * dt; const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt + worldDz * p.attach;
        if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.4; }
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        col[i * 3] = p.r * k; col[i * 3 + 1] = p.g * k; col[i * 3 + 2] = p.b * k; size[i] = p.s * (0.4 + 0.6 * k);
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
    },
    clear() { for (const p of P) p.life = 0; },
  };
})();

// rain streaks
const RAIN_N = 650;
const rain = (() => {
  const pos = new Float32Array(RAIN_N * 6), drops = [];
  for (let i = 0; i < RAIN_N; i++) drops.push({ x: (rand() - 0.5) * 34, y: rand() * 18, z: -rand() * 70 + 8, l: 0.5 + rand() * 0.6 });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.LineBasicMaterial({ color: 0x9ab4ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.LineSegments(g, mat); lines.frustumCulled = false; scene.add(lines);
  return {
    mat, lines, update(dt, speed, amount) {
      lines.visible = amount > 0.02; if (!lines.visible) return;
      mat.opacity = 0.34 * amount;
      const vy = -26, vz = speed, len = Math.hypot(vy, vz);
      for (let i = 0; i < RAIN_N; i++) {
        const d = drops[i];
        d.y += vy * dt; d.z += vz * dt;
        if (d.y < 0 || d.z > 9) { d.y = 10 + rand() * 8; d.z = -rand() * 70 + 6; d.x = (rand() - 0.5) * 34; if (d.y < 0 && rand() < 0.15 * amount && Math.abs(d.x) < 4) particles.emit(d.x, 0.05, d.z, { vy: 1.5, life: 0.2, size: 0.12, color: new THREE.Color(0.4, 0.5, 0.9), grav: 8 }); }
        const k = d.l / len;
        pos.set([d.x, d.y, d.z, d.x - 0 * k, d.y - vy * k, d.z - vz * k], i * 6);
      }
      g.attributes.position.needsUpdate = true;
    },
  };
})();

// speed lines (camera-space)
const SL_N = 70;
const speedLines = (() => {
  const pos = new Float32Array(SL_N * 6), L = [];
  for (let i = 0; i < SL_N; i++) { const a = rand() * Math.PI * 2, r = 1.4 + rand() * 2.6; L.push({ x: Math.cos(a) * r * 0.7, y: Math.sin(a) * r, z: -rand() * 40, l: 2 + rand() * 4 }); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.LineBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const lines = new THREE.LineSegments(g, mat); lines.frustumCulled = false; camera.add(lines);
  return {
    mat, update(dt, speed, amt) {
      mat.opacity = amt; lines.visible = amt > 0.01; if (!lines.visible) return;
      for (let i = 0; i < SL_N; i++) {
        const s = L[i]; s.z += speed * 1.6 * dt;
        if (s.z > 0) { s.z = -30 - rand() * 15; const a = rand() * Math.PI * 2, r = 1.3 + rand() * 2.8; s.x = Math.cos(a) * r * 0.7; s.y = Math.sin(a) * r; }
        const l = s.l * (0.5 + speed / 40);
        pos.set([s.x, s.y, s.z, s.x, s.y, s.z - l], i * 6);
      }
      g.attributes.position.needsUpdate = true;
    },
  };
})();

// coins (instanced)
const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 6); coinGeo.rotateX(Math.PI / 2);
const coinMesh = new THREE.InstancedMesh(coinGeo, M.coin, 300); coinMesh.frustumCulled = false; scene.add(coinMesh);
const gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.42, 0), M.gem, 40); gemMesh.frustumCulled = false; scene.add(gemMesh);
const coinGlowMesh = new THREE.InstancedMesh(G.plane, new THREE.MeshBasicMaterial({ map: TX.glow, color: new THREE.Color(0.55, 0.36, 0.08), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 340);
coinGlowMesh.frustumCulled = false; scene.add(coinGlowMesh);

// ============================================================ post processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.42, 0.88); composer.addPass(bloom);
composer.addPass(new OutputPass());
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uCA: { value: 0.002 }, uVig: { value: 0.75 }, uTime: { value: 0 }, uTint: { value: new THREE.Color(1, 0, 0) }, uTintAmt: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uCA, uVig, uTime, uTintAmt; uniform vec3 uTint; varying vec2 vUv;
    void main(){ vec2 d = vUv - 0.5; float r = length(d); vec2 off = d * uCA * (0.5 + r * 2.0);
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c = mix(c, uTint, uTintAmt * smoothstep(0.15, 0.85, r));
      c *= 1.0 - uVig * smoothstep(0.3, 0.95, r);
      float n = fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * 0.02;
      gl_FragColor = vec4(c, 1.0); }`,
});
composer.addPass(finalPass);

let viewW = 1, viewH = 1, baseFov = 70;
function resize() {
  viewW = window.innerWidth; viewH = window.innerHeight;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(viewW, viewH, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(viewW, viewH);
  bloom.setSize(Math.round(viewW * pixelRatio * 0.5), Math.round(viewH * pixelRatio * 0.5));
  const a = viewW / viewH;
  camera.aspect = a;
  baseFov = clamp(2 * Math.atan(0.42 / a) * 180 / Math.PI, 58, 80);
  camera.updateProjectionMatrix();
  particles.mat.uniforms.scale.value = (viewH * pixelRatio) / (2 * Math.tan(baseFov * Math.PI / 360));
  document.getElementById('rotate').classList.toggle('show', isTouch && a > 1.15);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ============================================================ game state
const sound = new Sound();
const ui = {};
for (const id of ['score', 'best', 'coins', 'mult', 'combobar', 'combotxt', 'combo', 'popups', 'banner', 'start', 'over', 'pause', 'flash', 'hud', 'powers', 'mute', 'ovScore', 'ovBest', 'ovNew', 'ovStats', 'startBest', 'dist']) ui[id] = document.getElementById(id);
let best = +(localStorage.getItem('nightline_best') || 0);

const S = {
  state: 'menu', dist: 0, speed: 12, score: 0, coins: 0, combo: 0, comboT: 0, maxCombo: 0, nears: 0,
  timeScale: 1, deathT: 0, overT: 0, trauma: 0, time: 0, district: -1, flash: 0, flashColor: '#fff',
  shield: 0, magnet: 0, over: 0, grace: 0, overMul: 1, startD: 0, lastBell: 0,
};
const P = { lane: 1, x: 0, y: 0, vy: 0, slide: 0, slideAge: 9, air: false, jumpBuf: 0, slideQueued: false, laneT: -9, fromLane: 1, invuln: 0, phase: 0, landDip: 0, deadSpin: 0, knock: 0 };
const mult = () => Math.min(10, 1 + Math.floor(S.combo / 2));

let obstacles = [], decor = [], cones = [], trains = [], powerups = [], coins = [], debris = [], queue = [], gates = [];
const gen = {};
const scenery = { b: { '-1': 0, '1': 0 }, lamp: 0, lampSide: 1 };
const visual = { fog: fogColor.clone(), top: new THREE.Color(DISTRICTS[0].skyTop), curb: new THREE.Color(DISTRICTS[0].curb), lamp: new THREE.Color(...DISTRICTS[0].lamp), rain: 1, glow: new THREE.Color(DISTRICTS[0].neon[0]) };

function inRanges(list, D, pad = 0) { for (const r of list) if (D >= r.a - pad && D <= r.b + pad) return r; return null; }

// ============================================================ generator
function genReset(enabled) {
  Object.assign(gen, {
    enabled, D: 42, pass: [true, true, true], reserved: [0, 0, 0], nextFeature: 470, nextPower: 150, powerIdx: 0,
    nextOverpass: enabled ? 300 : 120, tunnels: [], gaps: [], pathLane: 1, featCount: 0,
  });
}
function push(it) { queue.push(it); }

function genFill() { while (gen.D < S.dist + SPAWN + 140) genStep(); }

function genStep() {
  const v = speedAt(gen.D), diff = diffAt(gen.D);
  if (gen.D >= gen.nextOverpass) {
    const D = gen.nextOverpass;
    if (!inRanges(gen.tunnels, D, 20) && !inRanges(gen.gaps, D, 12)) { push({ D, t: 'overpass', train: rand() < 0.65 }); gen.gaps.push({ a: D - 5, b: D + 5 }); }
    gen.nextOverpass += 200 + rand() * 260;
  }
  if (!gen.enabled) { gen.D += 25; return; }
  if (gen.D >= gen.nextFeature) { feature(v, diff); return; }
  const gap = v * lerp(1.3, 0.66, Math.pow(diff, 0.8)) * (0.92 + rand() * 0.22);
  const R = gen.D + gap;
  for (let tries = 0; tries < 12; tries++) {
    const slots = choosePattern(diff, R);
    if (placeRow(R, slots, gap, v, diff)) return;
  }
  placeRow(R, [null, null, null], gap, v, diff);
}

function choosePattern(diff, R) {
  const w = { single: Math.max(0.5, 3 - 2.6 * diff), double: R < 160 ? 0.3 : 0.8 + 2 * diff, mixed: R > 200 ? 0.8 + diff : 0, wall: R > 140 ? 0.35 + 0.7 * diff : 0, traffic: R > 230 ? 1 + 1.5 * diff : 0, breather: 0.45 };
  const kind = wpick(w);
  const s = [null, null, null];
  const low = () => ({ k: rand() < 0.65 ? 'barrier' : 'sawhorse' });
  const high = () => ({ k: 'beam' });
  const block = () => ({ k: R < 900 ? pick(['van', 'van', 'container', 'truck']) : pick(['van', 'container', 'truck', 'truck', 'bus']) });
  const car = () => ({ k: pick(['sedan', 'sedan', 'taxi', 'sports']) });
  const any = () => { const r = rand(); return r < 0.34 ? low() : r < 0.64 ? high() : block(); };
  const lanes = [0, 1, 2].sort(() => rand() - 0.5);
  switch (kind) {
    case 'single': s[lanes[0]] = any(); break;
    case 'double': s[lanes[0]] = block(); s[lanes[1]] = rand() < 0.5 ? block() : any(); if (diff > 0.3 && rand() < 0.35) s[lanes[2]] = rand() < 0.5 ? low() : high(); break;
    case 'mixed': s[lanes[0]] = low(); s[lanes[1]] = high(); s[lanes[2]] = block(); break;
    case 'wall': { const m = rand(); for (let l = 0; l < 3; l++) s[l] = m < 0.4 ? low() : m < 0.75 ? high() : (rand() < 0.5 ? low() : high()); break; }
    case 'traffic': s[lanes[0]] = car(); if (diff > 0.3 && rand() < 0.5) s[lanes[1]] = car(); else if (diff > 0.45 && rand() < 0.4) s[lanes[1]] = block(); break;
  }
  return s;
}

function slotType(s) { return s ? OB[s.k].t : null; }
function passable(s) { const t = slotType(s); return !t || t === 'low' || t === 'high' || t === 'gate'; }

function placeRow(R, slots, gap, v, diff, opts = {}) {
  // fairness checks
  for (let l = 0; l < 3; l++) { const t = slotType(slots[l]); if (t && t !== 'car' && gen.reserved[l] > R - 4) return false; }
  const maxShift = gap >= v * 0.95 ? 2 : 1;
  const reach = [0, 1, 2].map(l => passable(slots[l]) && [0, 1, 2].some(p => gen.pass[p] && Math.abs(l - p) <= maxShift));
  if (!reach.some(Boolean)) return false;
  // commit obstacles
  for (let l = 0; l < 3; l++) {
    const s = slots[l]; if (!s) continue;
    const t = OB[s.k].t;
    if (t === 'car') {
      const u = 7 + 8 * diff;
      push({ D: R, t: 'obs', k: s.k, lane: l, u });
      gen.reserved[l] = R + u * SPAWN / v + 12;
    } else push({ D: R, t: 'obs', k: s.k, lane: l });
  }
  // path + coins
  let path = gen.pathLane;
  if (!reach[path]) { const opts2 = [0, 1, 2].filter(l => reach[l]); path = opts2.sort((a, b) => Math.abs(a - gen.pathLane) - Math.abs(b - gen.pathLane))[0]; }
  else if (rand() < 0.25) { const alt = [0, 1, 2].filter(l => reach[l] && l !== path && Math.abs(l - path) === 1); if (alt.length) path = pick(alt); }
  const prevPath = gen.pathLane, a = gen.D;
  if (!opts.noCoins && rand() < 0.78) {
    const t = slotType(slots[path]);
    const half = 0.354 * v;
    const mid = a + (R - a) * 0.45;
    for (let z = a + 5; z <= R + (t === 'low' ? half : 2); z += 2.4) {
      const lane = z < mid ? prevPath : path;
      if (z < mid && passable(null) && lane !== path && Math.abs(z - mid) < 2) continue;
      let y = 0.9;
      if (lane === path && t === 'low' && Math.abs(z - R) < half) { const k = (z - R) / half; y = 0.75 + 1.55 * (1 - k * k); }
      else if (lane === path && t === 'low' && z > R - half - 2 && z < R) continue;
      if (lane === path && t === 'high' && Math.abs(z - R) < 4) y = 0.5;
      push({ D: z, t: 'coin', x: LANE_X[lane], y });
    }
  }
  // risk: gem/coins hugging a blocked lane (grab late, dodge late → near miss)
  const blocked = [0, 1, 2].filter(l => !passable(slots[l]) && Math.abs(l - path) === 1);
  if (blocked.length && rand() < 0.3 + 0.35 * diff) {
    const bl = pick(blocked), isCar = slotType(slots[bl]) === 'car';
    const end = R - OB[slots[bl].k].hd - (isCar ? 7 : 2.2);
    for (let i = 0; i < 4; i++) { const z = end - 4 - i * 2.4; if (z > a + 4) push({ D: z, t: 'coin', x: LANE_X[bl], y: 0.9 }); }
    if (end > a + 3) push({ D: end, t: 'coin', x: LANE_X[bl], y: 1.0, gem: true });
  }
  // gem above a jump arc sometimes
  if (slotType(slots[path]) === 'low' && rand() < 0.3) push({ D: R, t: 'coin', x: LANE_X[path], y: 2.45, gem: true });
  // power-up between rows on a lane passable in both
  if (R >= gen.nextPower && !opts.noPower) {
    const ok = [0, 1, 2].filter(l => gen.pass[l] && reach[l]);
    if (ok.length) {
      const order = ['magnet', 'overdrive', 'shield'];
      const kind = gen.powerIdx < 3 ? order[gen.powerIdx] : pick(['shield', 'magnet', 'overdrive', 'magnet', 'shield']);
      gen.powerIdx++;
      push({ D: a + (R - a) * 0.5, t: 'power', kind, x: LANE_X[ok.includes(path) ? path : pick(ok)] });
      gen.nextPower = R + (gen.powerIdx < 2 ? 250 : 340) + rand() * 200;
    }
  }
  gen.pass = reach; gen.D = R; gen.pathLane = path;
  return true;
}

function feature(v, diff) {
  const d = DISTRICTS[districtAt(gen.D)];
  const kind = gen.featCount === 0 ? 'rail' : gen.featCount === 1 ? 'construction' : gen.featCount === 2 ? 'tunnel' : wpick(d.feat);
  gen.featCount++;
  if (kind === 'rail') {
    let R = gen.D + v * 1.3;
    R = Math.max(R, ...gen.reserved.map(x => x + 6));
    push({ D: R, t: 'gate' });
    gen.gaps.push({ a: R - 7, b: R + 12 });
    gen.D = R - 0.01; gen.pass = [true, true, true];
    for (let z = R - 8; z <= R + 4; z += 2.4) push({ D: z, t: 'coin', x: LANE_X[gen.pathLane], y: 0.5 });
    push({ D: R, t: 'coin', x: LANE_X[(gen.pathLane + 1 + (rand() * 2 | 0)) % 3], y: 0.5, gem: true });
    gen.D = R + v * 0.95;
    gen.nextFeature = gen.D + 280 + rand() * 220;
  } else if (kind === 'construction') {
    const start = gen.D + v * 0.9, n = 4 + Math.floor(diff * 3 + rand() * 2);
    push({ D: start - 14, t: 'arrow', x: 4.6 }); push({ D: start - 14, t: 'arrow', x: -4.6 });
    let R = start;
    for (let i = 0; i < n; i++) {
      const gap = v * lerp(1.05, 0.72, diff) * (i === 0 ? 1.2 : 1);
      const Ri = gen.D + gap;
      let ok = false;
      for (let tries = 0; tries < 14 && !ok; tries++) {
        const s = [0, 1, 2].map(() => { const r = rand(); return r < 0.28 ? null : r < 0.55 ? { k: rand() < 0.5 ? 'barrier' : 'sawhorse' } : r < 0.82 ? { k: 'beam' } : { k: 'container' }; });
        if (s.every(x => !x)) continue;
        ok = placeRow(Ri, s, gap, v, diff, { noPower: true });
      }
      if (!ok) placeRow(Ri, [null, null, null], gap, v, diff);
      R = Ri;
    }
    for (let z = start - 10; z < R + 10; z += 5) { push({ D: z, t: 'cone', x: -1.15 + (rand() - 0.5) * 0.1 }); push({ D: z + 2.5, t: 'cone', x: 1.15 + (rand() - 0.5) * 0.1 }); }
    gen.nextFeature = gen.D + 300 + rand() * 250;
  } else {
    const start = gen.D + 25, len = Math.round((120 + rand() * 110) / 8) * 8;
    gen.tunnels.push({ a: start, b: start + len });
    push({ D: start, t: 'portal' });
    for (let z = start + 4; z < start + len; z += 8) push({ D: z, t: 'tseg', i: Math.round(z / 8) });
    gen.nextFeature = start + len + 160 + rand() * 200;
    // rows continue normally inside the tunnel
    const gap = v * lerp(1.3, 0.66, Math.pow(diff, 0.8));
    placeRow(gen.D + gap, choosePattern(diff, gen.D + gap), gap, v, diff) || placeRow(gen.D + gap, [null, null, null], gap, v, diff);
  }
}

// ============================================================ spawning
function addToWorld(obj, x, D, y = 0) { obj.position.set(x, y, -D); world.add(obj); return obj; }

function spawnItem(it) {
  const di = districtAt(it.D);
  switch (it.t) {
    case 'obs': {
      const def = OB[it.k];
      let obj;
      if (def.t === 'car') obj = pick(PROTO.cars[it.k]).clone();
      else if (def.t === 'block') { obj = pick(PROTO.blocks[it.k]).clone(); if (it.k !== 'container' && rand() < 0.5) obj.rotation.y = Math.PI; }
      else obj = PROTO[it.k].clone();
      const o = { k: it.k, t: def.t, lane: it.lane, x: LANE_X[it.lane], D: it.D, hw: def.hw, y0: def.y0, y1: def.y1, hd: def.hd, obj, u: it.u || 0, passed: false, prevRel: null, minClear: 9, whooshed: false };
      if (o.u) o.D = it.D + o.u * (it.D - S.dist) / Math.max(5, S.speed);
      addToWorld(obj, o.x, o.D);
      obstacles.push(o);
      break;
    }
    case 'gate': {
      const obj = PROTO.gate.clone(); addToWorld(obj, 0, it.D);
      const def = OB.gate;
      obstacles.push({ k: 'gate', t: 'gate', lane: -1, x: 0, D: it.D, hw: def.hw, y0: def.y0, y1: def.y1, hd: def.hd, obj, u: 0, passed: false, prevRel: null, minClear: 9 });
      const tr = pick(PROTO.trains).clone(); addToWorld(tr, -200, it.D + 3);
      trains.push({ obj: tr, D: it.D, kind: 'cross', len: tr.userData.length || 66 });
      gates.push({ D: it.D });
      decor.push({ obj, Dmax: it.D + 10 });
      break;
    }
    case 'coin': coins.push({ x: it.x, y: it.y, D: it.D, gem: !!it.gem, free: false, px: 0, py: 0, pz: 0, prevRel: null, ph: rand() * 6 }); break;
    case 'power': {
      const obj = PROTO.power[it.kind].clone(); addToWorld(obj, it.x, it.D, 1.2);
      powerups.push({ kind: it.kind, x: it.x, D: it.D, obj, prevRel: null });
      break;
    }
    case 'cone': { const obj = PROTO.cone.clone(); addToWorld(obj, it.x, it.D); cones.push({ obj, x: it.x, D: it.D, hit: false, vx: 0, vy: 0, vz: 0, rs: 0 }); break; }
    case 'arrow': { const obj = PROTO.arrow.clone(); addToWorld(obj, it.x, it.D, 0.16); decor.push({ obj, Dmax: it.D + 2 }); break; }
    case 'overpass': {
      const obj = PROTO.overpass[di].clone(); addToWorld(obj, 0, it.D); decor.push({ obj, Dmax: it.D + 5 });
      if (it.train) { const tr = pick(PROTO.trains).clone(); addToWorld(tr, -200, it.D, 9.0); trains.push({ obj: tr, D: it.D, kind: 'over', len: tr.userData.length || 66, dir: rand() < 0.5 ? 1 : -1 }); if (tr.userData) tr.scale.x = 1; }
      break;
    }
    case 'portal': { const obj = PROTO.portal[di].clone(); addToWorld(obj, 0, it.D); decor.push({ obj, Dmax: it.D + 2 }); break; }
    case 'tseg': { const obj = PROTO.tseg[di][it.i % 2].clone(); addToWorld(obj, 0, it.D); decor.push({ obj, Dmax: it.D + 4 }); break; }
  }
}

function spawnScenery() {
  const horizon = S.dist + SPAWN;
  for (const side of [-1, 1]) {
    while (scenery.b[side] < horizon) {
      const D = scenery.b[side];
      const blk = inRanges(gen.tunnels, D, 2) || inRanges(gen.gaps, D, 1);
      if (blk) { scenery.b[side] = blk.b + 3; continue; }
      const di = districtAt(D);
      const proto = pick(PROTO.buildings[di][side]);
      const L = proto.userData.L;
      // make sure the building does not run into a gap
      const nextGap = [...gen.tunnels, ...gen.gaps].filter(r => r.a > D && r.a < D + L + 1)[0];
      if (nextGap) { scenery.b[side] = nextGap.b + 3; continue; }
      const obj = proto.clone();
      addToWorld(obj, side * 7.4, D + L / 2);
      decor.push({ obj, Dmax: D + L + 2 });
      scenery.b[side] = D + L + 0.4 + rand() * 2.5;
    }
  }
  while (scenery.lamp < horizon) {
    const D = scenery.lamp;
    scenery.lamp += 13;
    scenery.lampSide *= -1;
    if (inRanges(gen.tunnels, D, 6) || inRanges(gen.gaps, D, 3)) continue;
    const obj = PROTO.lamp.clone();
    if (scenery.lampSide < 0) obj.rotation.y = Math.PI;
    addToWorld(obj, scenery.lampSide * 4.05, D, 0);
    decor.push({ obj, Dmax: D + 1 });
  }
}

// ============================================================ reset / start
function clearWorld() {
  for (const arr of [obstacles, decor, cones, trains, powerups, debris]) for (const o of arr) if (o.obj) world.remove(o.obj);
  obstacles = []; decor = []; cones = []; trains = []; powerups = []; coins = []; debris = []; queue = []; gates = [];
  particles.clear(); ribbons.forEach(r => r.reset());
}

function resetRun(enabled) {
  clearWorld();
  S.dist = 0; S.score = 0; S.coins = 0; S.combo = 0; S.comboT = 0; S.maxCombo = 0; S.nears = 0;
  S.shield = S.magnet = S.over = S.grace = 0; S.overMul = 1; S.timeScale = 1; S.trauma = 0; S.district = -1;
  S.speed = enabled ? speedAt(0) : 11;
  Object.assign(P, { lane: 1, x: 0, y: 0, vy: 0, slide: 0, slideAge: 9, air: false, jumpBuf: 0, slideQueued: false, laneT: -9, fromLane: 1, invuln: 0, landDip: 0, deadSpin: 0, knock: 0 });
  runner.root.position.set(0, 0, 0); runner.root.rotation.set(0, 0, 0); runner.body.rotation.set(0, 0, 0);
  genReset(enabled);
  scenery.b['-1'] = -20; scenery.b['1'] = -17; scenery.lamp = -14; scenery.lampSide = 1;
  world.position.z = 0;
  genFill(); processQueue(); spawnScenery();
}

function goFullscreen() {
  if (!isTouch || document.fullscreenElement) return;
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' });
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('portrait').catch(() => {})).catch(() => {});
  } catch (e) { /* not supported */ }
}
function startGame() {
  sound.init();
  goFullscreen();
  resetRun(true);
  S.state = 'playing';
  ui.start.classList.add('hidden'); ui.over.classList.add('hidden'); ui.pause.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  sound.ui();
}

function processQueue() {
  const h = S.dist + SPAWN;
  let w = 0;
  for (let i = 0; i < queue.length; i++) { const it = queue[i]; if (it.D < h) spawnItem(it); else queue[w++] = it; }
  queue.length = w;
}

// ============================================================ input
function act(a) {
  if (S.state !== 'playing') return;
  if (a === 'left' || a === 'right') {
    const nl = clamp(P.lane + (a === 'left' ? -1 : 1), 0, 2);
    if (nl !== P.lane) { P.fromLane = P.lane; P.lane = nl; P.laneT = S.time; sound.lane(); }
    else { S.trauma = Math.min(1, S.trauma + 0.12); }
  } else if (a === 'up') {
    if (!P.air) doJump(); else P.jumpBuf = 0.18;
  } else if (a === 'down') {
    if (P.air) { P.vy = Math.min(P.vy, -22); P.slideQueued = true; }
    else startSlide();
  }
}
function doJump() {
  P.air = true; P.vy = JUMP_V; P.slide = 0; P.jumpBuf = 0; sound.jump();
  particles.burst(P.x, 0.1, 0.2, 8, 0x60e8ff, 3, { life: 0.35, size: 0.18, grav: 4 });
}
function startSlide() {
  if (P.slide <= 0) sound.slide();
  P.slide = SLIDE_T; P.slideAge = 0; P.slideQueued = false;
  for (let i = 0; i < 10; i++) particles.emit(P.x + (rand() - 0.5) * 0.6, 0.08, 0.3, { vx: (rand() - 0.5) * 3, vy: 1 + rand() * 2, vz: 3 + rand() * 4, life: 0.4, size: 0.16, color: new THREE.Color(1.5, 0.6, 2.0), grav: 6, attach: 0.6 });
}
function tap() {
  if (S.state === 'menu') startGame();
  else if (S.state === 'over' && S.overT > 0.45) startGame();
  else if (S.state === 'paused') resume();
}
let touch = null;
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest && e.target.closest('button')) return;
  sound.init();
  touch = { x: e.clientX, y: e.clientY, t: performance.now(), fired: false, id: e.pointerId };
}, { passive: true });
window.addEventListener('pointermove', (e) => {
  if (!touch || touch.fired || e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y, th = Math.max(18, Math.min(viewW, viewH) * 0.055);
  if (Math.abs(dx) > th || Math.abs(dy) > th) {
    touch.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right'); else act(dy < 0 ? 'up' : 'down');
  }
}, { passive: true });
window.addEventListener('pointerup', (e) => {
  sound.init();
  if (!touch || e.pointerId !== touch.id) return;
  if (!touch.fired) {
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.hypot(dx, dy) < 30) tap();
  }
  touch = null;
});
window.addEventListener('pointercancel', () => { touch = null; });
// block browser gestures: scroll, pinch-zoom, pull-to-refresh, double-tap zoom
const stop = (e) => { if (e.cancelable) e.preventDefault(); };
document.addEventListener('touchmove', stop, { passive: false });
document.addEventListener('touchstart', (e) => { if (!(e.target.closest && e.target.closest('button'))) stop(e); }, { passive: false });
document.addEventListener('gesturestart', stop);
document.addEventListener('dblclick', stop);
document.addEventListener('contextmenu', stop);
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  const map = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', ' ': 'up', arrowdown: 'down', s: 'down' };
  if (k === 'm') { toggleMute(); return; }
  if ((k === 'p' || k === 'escape') && S.state === 'playing') { pause(); return; }
  if (S.state !== 'playing') { if (k === 'enter' || k === ' ' || map[k]) { sound.init(); tap(); } e.preventDefault(); return; }
  if (map[k]) { e.preventDefault(); if (!e.repeat) act(map[k]); }
});
function toggleMute() { sound.init(); sound.setMuted(!sound.muted); ui.mute.textContent = sound.muted ? '🔇' : '🔊'; }
ui.mute.addEventListener('click', (e) => { e.stopPropagation(); toggleMute(); });
ui.mute.textContent = sound.muted ? '🔇' : '🔊';
function pause() { if (S.state !== 'playing') return; S.state = 'paused'; ui.pause.classList.remove('hidden'); }
function resume() { S.state = 'playing'; ui.pause.classList.add('hidden'); last = performance.now(); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); if (sound.ctx) sound.ctx.suspend(); }
  else if (sound.ctx) sound.ctx.resume();
});

// ============================================================ feedback
function popup(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'pop ' + cls; el.textContent = text;
  el.style.setProperty('--dx', ((rand() - 0.5) * 60).toFixed(0) + 'px');
  ui.popups.appendChild(el);
  setTimeout(() => el.remove(), 1100);
  while (ui.popups.children.length > 5) ui.popups.firstChild.remove();
}
function flash(color, amt) { S.flash = Math.max(S.flash, amt); S.flashColor = color; }
function banner(text, sub) {
  ui.banner.innerHTML = `<small>${sub}</small>${text}`;
  ui.banner.classList.remove('show'); void ui.banner.offsetWidth; ui.banner.classList.add('show');
}

function nearMiss(label, pts, o, big) {
  S.combo++; S.nears++; S.maxCombo = Math.max(S.maxCombo, S.combo);
  S.comboT = COMBO_TIME;
  const m = mult(), gain = pts * m;
  S.score += gain;
  popup(`${label} +${gain}`, big ? 'big' : '');
  sound.nearMiss(S.combo);
  const sx = o ? clamp(o.x, P.x - 1.2, P.x + 1.2) : P.x;
  particles.burst(sx, 1.0, 0, 14, big ? 0xffd23a : 0x40f0ff, 6, { life: 0.4, size: 0.14, grav: 0, drag: 3, attach: 1 });
  S.trauma = Math.min(1, S.trauma + 0.08);
  ui.combo.classList.remove('pulse'); void ui.combo.offsetWidth; ui.combo.classList.add('pulse');
  if (S.combo % 2 === 0 && m > 1) flash('#40f0ff', 0.12);
}

function smash(o) {
  o.smashed = true;
  const side = Math.sign(o.x - P.x) || (rand() < 0.5 ? -1 : 1);
  debris.push({ obj: o.obj, vx: side * (5 + rand() * 4), vy: 7 + rand() * 4, vz: -(S.speed + 10), rx: (rand() - 0.5) * 8, ry: (rand() - 0.5) * 6, rz: side * 4, t: 1.4 });
  const rel = S.dist - o.D;
  particles.burst(o.x, 1, rel, 40, 0xffb030, 12, { life: 0.7, size: 0.2, up: 3, vz: -S.speed * 0.5 });
  particles.burst(o.x, 1, rel, 20, 0xffffff, 8, { life: 0.4, size: 0.12, up: 2 });
  S.trauma = Math.min(1, S.trauma + 0.35);
  sound.smash();
  const gain = 120 * mult(); S.score += gain; popup(`SMASH +${gain}`, 'gold');
}

function hit(o) {
  if (S.over > 0 || S.grace > 0) { smash(o); return; }
  if (P.invuln > 0) return;
  if (S.shield > 0) {
    S.shield = 0; P.invuln = 1.0; smash(o);
    sound.shieldBreak(); flash('#40c0ff', 0.5); S.trauma = 0.7;
    particles.burst(P.x, 1, 0, 60, 0x40c8ff, 9, { life: 0.8, size: 0.2, grav: 2 });
    popup('SHIELD BROKEN', 'blue');
    return;
  }
  die(o);
}

function die(o) {
  S.state = 'dead'; S.deathT = 0;
  sound.hit(); sound.setIntensity(0, 400);
  S.trauma = 1; flash('#ff2040', 0.85);
  const rel = o ? S.dist - o.D : 0;
  particles.burst(P.x, 1.0, Math.min(0, rel + 0.5), 80, 0xff6a20, 11, { life: 0.9, size: 0.2, up: 4 });
  particles.burst(P.x, 1.0, 0, 40, 0x40e8ff, 7, { life: 1.0, size: 0.16, up: 3 });
  P.vy = 6.5; P.air = true; P.knock = 6;
  if (S.combo > 0) S.combo = 0;
}

function gameOver() {
  S.state = 'over'; S.overT = 0;
  const sc = Math.floor(S.score), isNew = sc > best;
  if (isNew) { best = sc; localStorage.setItem('nightline_best', String(best)); }
  ui.ovScore.textContent = sc.toLocaleString();
  ui.ovBest.textContent = best.toLocaleString();
  ui.ovNew.classList.toggle('hidden', !isNew);
  ui.ovStats.innerHTML = `<div><b>${Math.floor(S.dist)}m</b>distance</div><div><b>${S.coins}</b>chips</div><div><b>${S.nears}</b>near misses</div><div><b>x${Math.min(10, 1 + Math.floor(S.maxCombo / 2))}</b>best multi</div>`;
  ui.over.classList.remove('hidden'); ui.hud.classList.add('hidden');
  ui.startBest.textContent = best.toLocaleString();
}

function activatePower(kind) {
  S[kind === 'overdrive' ? 'over' : kind] = POWER_TIME[kind];
  sound.power(kind);
  const col = kind === 'shield' ? '#40c0ff' : kind === 'magnet' ? '#ff3b6b' : '#ffd23a';
  flash(col, 0.35);
  popup(kind === 'shield' ? 'SHIELD' : kind === 'magnet' ? 'MAGNET' : 'OVERDRIVE!', kind === 'overdrive' ? 'gold big' : kind === 'shield' ? 'blue big' : 'pink big');
  particles.burst(P.x, 1.2, 0, 50, new THREE.Color(col).getHex(), 8, { life: 0.6, size: 0.2, grav: 0, drag: 2 });
  if (kind === 'overdrive') S.trauma = 0.5;
}

// ============================================================ update
let last = performance.now();
const frameTimes = []; let qualityTimer = 0;
const tmpV = new THREE.Vector3(), dummy = new THREE.Object3D();
const camState = { x: 0, y: 3.6, roll: 0, fovKick: 0 };

function update(rdt) {
  const playing = S.state === 'playing', dead = S.state === 'dead', menu = S.state === 'menu';
  if (S.state === 'paused') return;
  // time scale (slow-mo on death)
  if (dead) S.timeScale = lerp(S.timeScale, 0.35, rdt * 6); else S.timeScale = lerp(S.timeScale, 1, rdt * 4);
  const dt = rdt * S.timeScale;
  S.time += dt;

  // speed
  let target = menu ? 11 : speedAt(S.dist);
  if (S.over > 0) S.overMul = lerp(S.overMul, 1.7, dt * 4); else S.overMul = lerp(S.overMul, 1, dt * 2);
  target *= S.overMul;
  if (dead || S.state === 'over') S.speed = Math.max(0, S.speed - S.speed * dt * 3.5 - dt * 4);
  else S.speed = lerp(S.speed, target, dt * 2);
  const dz = S.speed * dt;
  S.dist += dz;
  world.position.z = S.dist;

  // texture scroll
  const off = (S.dist / T.ROAD_TILE) % 1;
  roadTex.map.offset.y = off; roadTex.rough.offset.y = off; swTex.offset.y = (S.dist / 20) % 1;

  if (playing || menu) { genFill(); processQueue(); spawnScenery(); }

  // district change
  const di = districtAt(S.dist);
  if (di !== S.district) {
    const first = S.district === -1; S.district = di;
    const d = DISTRICTS[di];
    if (playing) { banner(d.name, `DISTRICT ${String(Math.floor(S.dist / DISTRICT_LEN) + 1).padStart(2, '0')}`); if (!first) sound.district(); }
  }
  {
    const d = DISTRICTS[S.district], k = Math.min(1, rdt * 0.8);
    visual.fog.lerp(d.C.fog, k);
    visual.top.lerp(d.C.top, k);
    visual.curb.lerp(d.C.curb, k);
    visual.glow.lerp(d.C.glow, k);
    visual.lamp.lerp(d.C.lamp, k);
    visual.rain = lerp(visual.rain, d.rain, k);
    const inTun = inRanges(gen.tunnels, S.dist, -2);
    scene.fog.color.copy(visual.fog); if (inTun) scene.fog.color.multiplyScalar(0.5);
    scene.background.copy(scene.fog.color);
    skyMat.uniforms.horizon.value.copy(visual.fog); skyMat.uniforms.top.value.copy(visual.top); skyMat.uniforms.glow.value.copy(visual.glow);
    curbMat.color.copy(visual.curb).multiplyScalar(2.2);
    M.lamp.color.copy(visual.lamp);
    hemi.intensity = lerp(hemi.intensity, inTun ? 0.35 : 0.7, rdt * 3);
  }

  // ---- player
  if (playing) {
    const tx = LANE_X[P.lane];
    P.x = lerp(P.x, tx, 1 - Math.exp(-rdt * 16));
    if (P.air) {
      P.vy -= GRAV * dt; P.y += P.vy * dt;
      if (P.y <= 0) {
        P.y = 0; P.air = false; P.vy = 0; P.landDip = 0.18;
        sound.land();
        particles.burst(P.x, 0.08, 0.2, 10, 0x8090ff, 3.5, { life: 0.35, size: 0.18, grav: 3, attach: 0.8 });
        if (P.slideQueued) startSlide(); else if (P.jumpBuf > 0) doJump();
      }
    }
    P.jumpBuf = Math.max(0, P.jumpBuf - dt);
    if (P.slide > 0) { P.slide -= dt; }
    P.slideAge += dt;
    P.invuln = Math.max(0, P.invuln - dt);
    // powers
    for (const k of ['shield', 'magnet', 'over']) if (S[k] > 0) {
      S[k] = Math.max(0, S[k] - dt);
      if (S[k] === 0 && k === 'over') { S.grace = 1.0; }
    }
    S.grace = Math.max(0, S.grace - dt);
    // combo timer
    if (S.combo > 0) { S.comboT -= dt; if (S.comboT <= 0) { if (S.combo >= 4) { sound.comboLost(); popup('COMBO LOST', 'dim'); } S.combo = 0; } }
    S.score += dz * mult();
  } else if (dead) {
    P.vy -= GRAV * 0.8 * dt; P.y = Math.max(0, P.y + P.vy * dt);
    P.knock = Math.max(0, P.knock - dt * 8);
    runner.root.position.z += P.knock * dt;
    S.deathT += rdt;
    if (S.deathT > 1.25) gameOver();
  } else if (menu) {
    P.x = lerp(P.x, Math.sin(S.time * 0.4) * 0.8, rdt * 2);
  }
  if (S.state === 'over') S.overT += rdt;

  // ---- obstacles
  const hH = P.slide > 0 ? 0.85 : 1.72;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (o.u && !o.smashed) { o.D -= o.u * dt; o.obj.position.z = -o.D; }
    const rel = S.dist - o.D;
    if (o.smashed) { obstacles.splice(i, 1); continue; }
    if (rel - o.hd > 25) { world.remove(o.obj); obstacles.splice(i, 1); continue; }
    if (o.t === 'high' && rel > 1.2) o.obj.visible = false;
    if (playing) {
      const prev = o.prevRel ?? rel;
      const zLo = Math.min(prev, rel) - o.hd, zHi = Math.max(prev, rel) + o.hd;
      const xOver = Math.abs(P.x - o.x) < o.hw + 0.3;
      if (zLo < 0.3 && zHi > -0.3 && xOver) {
        if (P.y < o.y1 && P.y + hH > o.y0) { hit(o); if (S.state !== 'playing') break; continue; }
        o.minClear = Math.min(o.minClear, o.t === 'high' ? o.y0 - (P.y + hH) : P.y - o.y1);
      }
      // oncoming whoosh
      if (o.u && !o.whooshed && rel > -14) { o.whooshed = true; sound.whoosh(clamp((o.x - P.x) / 3, -1, 1)); }
      if (!o.passed && rel - o.hd > 0.3) {
        o.passed = true;
        const sameLane = Math.abs(P.x - o.x) < o.hw + 0.3;
        const recent = S.time - P.laneT < 0.42 && P.fromLane === o.lane && P.lane !== o.lane;
        if (o.t === 'gate') { if (P.slide > 0 && P.slideAge < 0.32) nearMiss('LIMBO', 60, o); else if (o.minClear < 0.4) nearMiss('HURDLE', 60, o); }
        else if (sameLane && o.t === 'low' && o.minClear < 0.5) nearMiss('CLOSE JUMP', 50, o);
        else if (sameLane && o.t === 'high' && P.slideAge < 0.3) nearMiss('LATE SLIDE', 50, o);
        else if (sameLane && o.t === 'car') nearMiss('VAULT!', 200, o, true);
        else if (recent) nearMiss('CLOSE CALL', 80, o, true);
        else if (o.t === 'car' && Math.abs(P.lane - o.lane) === 1 && !P.air) nearMiss('WHOOSH', 30, o);
      }
    }
    o.prevRel = rel;
  }
  // debris
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.t -= dt; d.vy -= 20 * dt;
    d.obj.position.x += d.vx * dt; d.obj.position.y = Math.max(-3, d.obj.position.y + d.vy * dt); d.obj.position.z += d.vz * dt + 0;
    d.obj.rotation.x += d.rx * dt; d.obj.rotation.y += d.ry * dt; d.obj.rotation.z += d.rz * dt;
    if (d.t <= 0) { world.remove(d.obj); debris.splice(i, 1); }
  }
  // cones
  for (let i = cones.length - 1; i >= 0; i--) {
    const c = cones[i], rel = S.dist - c.D + (c.hit ? 0 : 0);
    if (!c.hit && playing && Math.abs(rel) < 0.6 && Math.abs(P.x - c.x) < 0.55 && P.y < 0.6) {
      c.hit = true; c.vx = Math.sign(c.x - P.x || 1) * (3 + rand() * 3); c.vy = 4 + rand() * 3; c.vz = -(S.speed * 0.8); c.rs = (rand() - 0.5) * 20;
      sound.cone(); particles.burst(c.x, 0.4, rel, 8, 0xff8a20, 4, { life: 0.4, size: 0.12 });
    }
    if (c.hit) {
      c.vy -= 20 * dt; c.obj.position.x += c.vx * dt; c.obj.position.y = Math.max(0, c.obj.position.y + c.vy * dt); c.obj.position.z += c.vz * dt;
      c.obj.rotation.x += c.rs * dt; c.obj.rotation.z += c.rs * 0.7 * dt; c.vz *= Math.exp(-dt * 1.5);
    }
    if (S.dist - c.D > 30) { world.remove(c.obj); cones.splice(i, 1); }
  }
  // decor despawn
  for (let i = decor.length - 1; i >= 0; i--) { if (S.dist - decor[i].Dmax > 22) { world.remove(decor[i].obj); decor.splice(i, 1); } }
  // trains (motion tied to distance so they always clear in time)
  for (let i = trains.length - 1; i >= 0; i--) {
    const t = trains[i], rel = S.dist - t.D;
    if (t.kind === 'cross') {
      const p = (rel + 95) / 77;
      t.obj.position.x = lerp(-70, 100, clamp(p, -0.2, 1.4));
    } else {
      const p = (rel + 175) / 170;
      t.obj.position.x = t.dir * lerp(-90, 120, p);
      t.obj.rotation.y = t.dir > 0 ? 0 : Math.PI;
    }
    if (rel > 30) { world.remove(t.obj); trains.splice(i, 1); }
  }
  // crossing bells
  for (let i = gates.length - 1; i >= 0; i--) {
    const rel = S.dist - gates[i].D;
    if (rel > 5) { gates.splice(i, 1); continue; }
    if (playing && rel > -140 && S.time - S.lastBell > 0.42) { S.lastBell = S.time; sound.bell(); }
  }
  // power-ups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i], rel = S.dist - p.D;
    p.obj.rotation.y += rdt * 2.5; p.obj.position.y = 1.2 + Math.sin(S.time * 4) * 0.15;
    const prev = p.prevRel ?? rel;
    if (playing && Math.min(prev, rel) < 0.9 && Math.max(prev, rel) > -0.9 && Math.abs(P.x - p.x) < 1.1) {
      activatePower(p.kind); world.remove(p.obj); powerups.splice(i, 1); continue;
    }
    p.prevRel = rel;
    if (rel > 15) { world.remove(p.obj); powerups.splice(i, 1); }
  }
  // coins
  updateCoins(dt, rdt, playing);

  // ---- visuals
  animateRunner(rdt, dt);
  const shieldOn = S.shield > 0;
  shieldMesh.visible = shieldOn || P.invuln > 0;
  if (shieldMesh.visible) {
    shieldMesh.material.uniforms.t.value = S.time;
    shieldMesh.material.uniforms.a.value = shieldOn ? (S.shield < 2.5 ? (Math.sin(S.time * 20) > 0 ? 1 : 0.25) : 1) : (Math.sin(S.time * 30) > 0 ? 0.6 : 0);
    const s = 1 + Math.sin(S.time * 6) * 0.03; shieldMesh.scale.set(s, s * (P.slide > 0 ? 0.6 : 1), s);
    shieldMesh.position.y = P.slide > 0 ? 0.55 : 0.95;
  }
  magnetRings.visible = S.magnet > 0;
  if (magnetRings.visible) { magnetRings.children.forEach((r, i) => { r.position.y = 0.5 + i * 0.6 + Math.sin(S.time * 5 + i) * 0.2; r.rotation.z = S.time * (i ? -3 : 3); }); }
  boostGlow.visible = S.over > 0 || S.overMul > 1.05;
  boostGlow.material.opacity = clamp((S.overMul - 1) / 0.7, 0, 1) * 0.55;
  fxLight.intensity = boostGlow.material.opacity * 14; fxLight.position.set(P.x, 1.5, 0);
  playerLight.position.set(P.x, 2.6 + P.y, 2.2);
  playerLight.color.set(S.over > 0 ? 0xffc040 : shieldOn ? 0x40a0ff : 0x40e8ff);
  footGlow.material.opacity = P.y > 0.1 ? 0.25 : 0.6;
  // ribbons
  const ri = (playing || menu) ? 1 : 0.5;
  const bp = runner.torso.getWorldPosition(tmpV).clone(); bp.z += 0.25; bp.y += 0.3;
  ribbons[0].color.set(S.over > 0 ? 0xffc030 : shieldOn ? 0x3a9cff : 0x20e8ff);
  ribbons[0].update(bp, dz, ri * (S.over > 0 ? 1.4 : 1.1), S.over > 0 ? 0.22 : 0.13);
  ribbons[1].update(runner.limbs.L.foot.getWorldPosition(new THREE.Vector3()), dz, ri);
  ribbons[2].update(runner.limbs.R.foot.getWorldPosition(new THREE.Vector3()), dz, ri);
  // particles: running spray on the wet road + overdrive sparks
  if ((playing || menu) && !P.air && rand() < 0.5) particles.emit(P.x + (rand() - 0.5) * 0.4, 0.05, 0.3, { vx: (rand() - 0.5) * 2, vy: 1.5 + rand() * 1.5, vz: 2 + rand() * 2, life: 0.3, size: 0.1, color: new THREE.Color(0.5, 0.7, 1.4), grav: 9, attach: 0.5 });
  if (S.over > 0) for (let k = 0; k < 2; k++) particles.emit(P.x + (rand() - 0.6) * 2.4, rand() * 2.2, -1 - rand() * 2, { vx: (rand() - 0.5), vy: 0, vz: 15 + rand() * 10, life: 0.35, size: 0.12, color: new THREE.Color(3, 1.8, 0.3), grav: 0, attach: 0 });
  particles.update(dt, dz);
  rain.update(dt, S.speed, visual.rain);
  const slAmt = clamp((S.speed - 24) / 20, 0, 0.5) + (S.over > 0 ? 0.6 : 0);
  speedLines.mat.color.set(S.over > 0 ? 0xffe08a : 0xbff4ff);
  speedLines.update(dt, S.speed, slAmt);

  // blink materials
  const bl = Math.sin(S.time * 7) > 0;
  M.blinkAmber.color.setRGB(bl ? 3 : 0.4, bl ? 1.5 : 0.2, bl ? 0.1 : 0.02);
  const rb = Math.sin(S.time * 9) > 0;
  M.blinkRedA.color.setRGB(rb ? 3.5 : 0.25, 0.08, 0.08); M.blinkRedB.color.setRGB(rb ? 0.25 : 3.5, 0.08, 0.08);

  updateCamera(rdt, dt);
  updateHUD(rdt);
  // music intensity
  if (sound.ctx) {
    if (playing) sound.setIntensity(clamp(0.5 + S.speed / 60 + (mult() > 3 ? 0.3 : 0), 0, 1), S.over > 0 ? 18000 : 9000);
    else if (menu) sound.setIntensity(0.35, 1400);
    else if (S.state === 'over') sound.setIntensity(0.1, 500);
  }
}

function updateCoins(dt, rdt, playing) {
  let ci = 0, gi = 0, gl = 0;
  const px = P.x, py = P.y + (P.slide > 0 ? 0.45 : 0.9);
  const spin = S.time * 4;
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    let x, y, z;
    const rel = S.dist - c.D;
    if (!c.free) {
      x = c.x; y = c.y; z = rel;
      if (S.magnet > 0 && playing && rel > -26 && rel < 1 && Math.abs(c.x - px) < 6) { c.free = true; c.px = x; c.py = y; c.pz = z; }
    }
    if (c.free) {
      const k = 1 - Math.exp(-rdt * 9);
      c.px = lerp(c.px, px, k); c.py = lerp(c.py, py, k); c.pz = lerp(c.pz, 0, k * 1.3);
      x = c.px; y = c.py; z = c.pz;
    }
    const prev = c.prevRel ?? z;
    c.prevRel = z;
    if (playing && Math.min(prev, z) < 0.75 && Math.max(prev, z) > -0.75 && Math.abs(x - px) < 0.95 && Math.abs(y - py) < 1.15) {
      coins.splice(i, 1);
      S.coins += c.gem ? 5 : 1;
      const m = mult();
      if (c.gem) { S.score += 60 * m; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); S.comboT = COMBO_TIME; popup(`DATA GEM +${60 * m}`, 'pink'); }
      else { S.score += 10 * m; if (S.combo > 0) S.comboT = Math.min(COMBO_TIME, S.comboT + 0.3); }
      sound.coin(c.gem);
      particles.burst(x, y, z, c.gem ? 22 : 7, c.gem ? 0xff40e0 : 0xffc030, c.gem ? 5 : 3, { life: 0.35, size: 0.13, grav: 0, drag: 4, attach: 0.3 });
      continue;
    }
    if (rel > 12 && !c.free) { coins.splice(i, 1); continue; }
    if (z < -SPAWN) continue;
    dummy.position.set(x, y + Math.sin(S.time * 3 + c.ph) * 0.08, z);
    dummy.rotation.set(0, spin + c.ph, 0); dummy.scale.setScalar(1);
    dummy.updateMatrix();
    if (c.gem) { if (gi < 40) gemMesh.setMatrixAt(gi++, dummy.matrix); }
    else if (ci < 300) coinMesh.setMatrixAt(ci++, dummy.matrix);
    if (gl < 340 && z > -110) {
      dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(c.gem ? 2.0 : 1.1); dummy.updateMatrix();
      coinGlowMesh.setMatrixAt(gl++, dummy.matrix);
    }
  }
  coinMesh.count = ci; gemMesh.count = gi; coinGlowMesh.count = gl;
  coinMesh.instanceMatrix.needsUpdate = true; gemMesh.instanceMatrix.needsUpdate = true; coinGlowMesh.instanceMatrix.needsUpdate = true;
}

// ---- runner animation
const pose = {};
function setRot(obj, axis, v, k) { obj.rotation[axis] = lerp(obj.rotation[axis], v, k); }
function animateRunner(rdt, dt) {
  const R = runner, L = R.limbs.L, Rr = R.limbs.R;
  R.root.position.x = P.x; R.root.position.y = P.y;
  if (S.state !== 'dead' && S.state !== 'over') R.root.position.z = 0;
  const k = 1 - Math.exp(-rdt * 18);
  const running = S.state === 'playing' || S.state === 'menu';
  if (S.state === 'dead' || S.state === 'over') {
    if (P.y > 0.05) R.body.rotation.x = Math.min(1.5, R.body.rotation.x + rdt * 4);
    else setRot(R.body, 'x', 1.5, k);
    R.body.position.y = lerp(R.body.position.y, P.y <= 0.05 ? 0.22 : 0, k);
    for (const [lim, s] of [[L, 1], [Rr, -1]]) { setRot(lim.th, 'x', 0.3 * s, k); setRot(lim.kn, 'x', -0.4, k); setRot(lim.sh, 'x', -1.2 - s * 0.5, k); setRot(lim.sh, 'z', s * -0.8, k); }
    return;
  }
  R.body.position.y = 0;
  R.body.rotation.x = lerp(R.body.rotation.x, 0, k);
  const freq = 2 * Math.PI * (1.25 + S.speed * 0.045);
  P.phase += dt * freq;
  const ph = P.phase;
  // lean into lane changes
  const tx = running && S.state === 'playing' ? LANE_X[P.lane] : P.x;
  setRot(R.body, 'z', clamp(-(tx - P.x) * 0.16, -0.35, 0.35), k);
  setRot(R.body, 'y', clamp((tx - P.x) * -0.1, -0.25, 0.25), k);
  if (P.slide > 0) {
    R.hips.position.y = lerp(R.hips.position.y, 0.42, k);
    setRot(R.hips, 'x', 0.75, k); setRot(R.torso, 'x', 0.25, k); setRot(R.torso, 'y', 0, k); setRot(R.head, 'x', -0.6, k);
    setRot(L.th, 'x', 0.95, k); setRot(L.kn, 'x', -0.1, k); setRot(Rr.th, 'x', 0.6, k); setRot(Rr.kn, 'x', -1.1, k);
    setRot(L.sh, 'x', 0.9, k); setRot(Rr.sh, 'x', 0.9, k); setRot(L.el, 'x', 0.4, k); setRot(Rr.el, 'x', 0.4, k);
    setRot(L.sh, 'z', -0.5, k); setRot(Rr.sh, 'z', 0.5, k);
    if (rand() < 0.6) particles.emit(P.x + (rand() - 0.5) * 0.5, 0.06, 0.2, { vx: (rand() - 0.5) * 3, vy: 1 + rand() * 2, vz: 3, life: 0.3, size: 0.12, color: new THREE.Color(2.5, 0.8, 2.4), grav: 6, attach: 0.6 });
  } else if (P.air) {
    const up = P.vy > 0;
    R.hips.position.y = lerp(R.hips.position.y, 0.96, k);
    setRot(R.hips, 'x', 0, k); setRot(R.torso, 'x', up ? -0.35 : -0.15, k); setRot(R.torso, 'y', 0, k); setRot(R.head, 'x', 0.25, k);
    setRot(L.th, 'x', 1.25, k); setRot(L.kn, 'x', -1.6, k); setRot(Rr.th, 'x', up ? 0.1 : 0.5, k); setRot(Rr.kn, 'x', up ? -0.4 : -0.9, k);
    setRot(L.sh, 'x', -2.4, k); setRot(Rr.sh, 'x', -2.0, k); setRot(L.el, 'x', 0.3, k); setRot(Rr.el, 'x', 0.3, k);
    setRot(L.sh, 'z', -0.4, k); setRot(Rr.sh, 'z', 0.4, k);
  } else {
    const s = Math.sin(ph), c = Math.cos(ph);
    R.hips.position.y = 0.93 + Math.abs(c) * 0.07;
    setRot(R.hips, 'x', 0, k);
    R.torso.rotation.x = -0.32; R.torso.rotation.y = s * 0.18; R.head.rotation.x = 0.25;
    L.th.rotation.x = s * 0.95; Rr.th.rotation.x = -s * 0.95;
    L.kn.rotation.x = -(0.25 + Math.max(0, c) * 1.5); Rr.kn.rotation.x = -(0.25 + Math.max(0, -c) * 1.5);
    L.sh.rotation.x = -s * 0.9; Rr.sh.rotation.x = s * 0.9;
    L.el.rotation.x = 1.3 + s * 0.2; Rr.el.rotation.x = 1.3 - s * 0.2;
    L.sh.rotation.z = -0.12; Rr.sh.rotation.z = 0.12;
  }
}

function updateCamera(rdt, dt) {
  const k = 1 - Math.exp(-rdt * 7);
  camState.x = lerp(camState.x, P.x * 0.6, k);
  const sp = clamp((S.speed - 17) / 25, 0, 1.5);
  P.landDip = Math.max(0, P.landDip - rdt * 0.9);
  let cy = 3.05 + P.y * 0.45 - P.landDip * 1.2 + (P.slide > 0 ? -0.3 : 0);
  let cz = 6.0 + sp * 0.6;
  if (S.state === 'menu') { cy = 3.2 + Math.sin(S.time * 0.3) * 0.3; cz = 7.8; }
  camState.y = lerp(camState.y, cy, 1 - Math.exp(-rdt * 8));
  S.trauma = Math.max(0, S.trauma - rdt * 1.6);
  const sh = S.trauma * S.trauma;
  const t = S.time * 40;
  camera.position.set(camState.x + Math.sin(t * 1.3) * sh * 0.5, camState.y + Math.sin(t * 1.7 + 1) * sh * 0.4, cz);
  if (S.state === 'menu') camera.position.x += Math.sin(S.time * 0.25) * 1.5;
  camera.lookAt(camState.x * 0.75 + (S.state === 'menu' ? Math.sin(S.time * 0.25) * 0.5 : 0), 1.25 + P.y * 0.3, -14);
  const vx = LANE_X[P.lane] - P.x;
  camState.roll = lerp(camState.roll, S.state === 'playing' ? clamp(vx * 0.03, -0.06, 0.06) : 0, k);
  camera.rotateZ(camState.roll + Math.sin(t * 2.1) * sh * 0.05);
  const fov = baseFov + sp * 6 + (S.overMul - 1) * 20;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, k); camera.updateProjectionMatrix(); }
  // sky follows camera
  sky.position.copy(camera.position);
  skyFar.position.set(camera.position.x * 0.9, 70, camera.position.z - 640);
  skyNear.position.set(camera.position.x * 0.8, 30, camera.position.z - 480);
  // post fx
  S.flash = Math.max(0, S.flash - rdt * 2.5);
  finalPass.uniforms.uTime.value = S.time % 100;
  finalPass.uniforms.uCA.value = 0.0015 + (S.overMul - 1) * 0.012 + S.trauma * 0.012;
  finalPass.uniforms.uTint.value.set(S.flashColor);
  finalPass.uniforms.uTintAmt.value = S.flash;
}

// ---- HUD
const hudCache = {};
function setText(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.textContent = v; } }
const powerEls = {};
for (const k of ['shield', 'magnet', 'over']) powerEls[k] = document.querySelector(`.pw[data-k="${k}"]`);
function updateHUD() {
  if (S.state !== 'playing' && S.state !== 'dead') return;
  setText(ui.score, 'score', Math.floor(S.score).toLocaleString());
  setText(ui.coins, 'coins', String(S.coins));
  setText(ui.dist, 'dist', Math.floor(S.dist) + 'm');
  const m = mult();
  setText(ui.mult, 'mult', 'x' + m);
  ui.combo.classList.toggle('active', S.combo > 0);
  ui.combo.dataset.tier = m >= 8 ? '3' : m >= 5 ? '2' : m >= 3 ? '1' : '0';
  setText(ui.combotxt, 'ctxt', S.combo > 0 ? `COMBO ${S.combo}` : 'NEAR-MISS TO BUILD COMBO');
  ui.combobar.style.transform = `scaleX(${S.combo > 0 ? clamp(S.comboT / COMBO_TIME, 0, 1) : 0})`;
  for (const k of ['shield', 'magnet', 'over']) {
    const el = powerEls[k], v = S[k];
    const on = v > 0; if (el.classList.contains('on') !== on) el.classList.toggle('on', on);
    if (on) el.querySelector('i').style.transform = `scaleX(${v / POWER_TIME[k === 'over' ? 'overdrive' : k]})`;
  }
}

// ---- adaptive quality
function adaptQuality(rdt) {
  frameTimes.push(rdt); if (frameTimes.length > 90) frameTimes.shift();
  qualityTimer += rdt;
  if (qualityTimer > 2 && frameTimes.length >= 60) {
    qualityTimer = 0;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    if (avg > 1 / 50 && pixelRatio > 0.9) { pixelRatio = Math.max(0.9, pixelRatio - 0.2); resize(); frameTimes.length = 0; }
    else if (avg > 1 / 40 && bloom.enabled && pixelRatio <= 1.0) { bloom.strength = 0.6; }
  }
}

// ============================================================ main loop
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  if (rdt <= 0) return;
  update(rdt);
  if (S.state !== 'paused') { renderer.info.reset(); composer.render(rdt); }
  if (S.state === 'playing' || S.state === 'menu') adaptQuality(rdt);
}

// ============================================================ boot
window.__game = {
  get state() { return S.state; },
  get score() { return Math.floor(S.score); },
  get combo() { return S.combo; },
  get alive() { return S.state === 'playing' || S.state === 'paused'; },
  get distance() { return Math.floor(S.dist); },
  get speed() { return S.speed; },
  start: () => { if (S.state !== 'playing') startGame(); },
  input: (a) => act(a),
  give: (k) => { if (S.state === 'playing') activatePower(k); },
  debug: () => ({ lane: P.lane, x: P.x, y: P.y, air: P.air, slide: P.slide, speed: S.speed, nears: S.nears, coins: S.coins, shield: S.shield, magnet: S.magnet, over: S.over,
    tun: !!inRanges(gen.tunnels, S.dist), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, pr: pixelRatio, gate: gates.length ? S.dist - gates[0].D : null,
    obs: obstacles.map(o => ({ lane: o.lane, t: o.t, k: o.k, rel: S.dist - o.D, hd: o.hd, u: o.u })) }),
};
ui.startBest.textContent = best.toLocaleString();
resize();
resetRun(false);
S.state = 'menu';
document.getElementById('loading').remove();
requestAnimationFrame((t) => { last = t; frame(t); });
