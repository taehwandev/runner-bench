import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { signTexture, stripeTexture, glowTexture, beamTexture, iconTexture } from './textures.js';

// ---------- shared resources ----------
export const R = {};
export function initResources() {
  R.glowTex = glowTexture();
  R.beamTex = beamTexture();
  R.stripeOrange = stripeTexture('#ff8a1a', '#120c16', 6);
  R.stripeYellow = stripeTexture('#ffd23f', '#100c12', 8);
  R.stripeRed = stripeTexture('#ff2244', '#f4f0f8', 6);
  R.mat = {
    tire: new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x9aa4b8, metalness: 1, roughness: 0.25 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x07101e, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.6 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc8d0e0, metalness: 1, roughness: 0.15 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15131c, metalness: 0.4, roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x2c2a38, metalness: 0.8, roughness: 0.35 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x3a3646, roughness: 0.85 }),
    head: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.0, 2.6) }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.15, 0.25) }),
    amber: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.4, 0.1) }),
    amberOff: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.1, 0.0) }),
    redLamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 0.1, 0.12) }),
    stripeO: new THREE.MeshBasicMaterial({ map: R.stripeOrange, color: new THREE.Color(1.3, 1.3, 1.3) }),
    stripeY: new THREE.MeshBasicMaterial({ map: R.stripeYellow, color: new THREE.Color(1.15, 1.15, 1.15) }),
    stripeR: new THREE.MeshBasicMaterial({ map: R.stripeRed, color: new THREE.Color(1.1, 1.1, 1.1) }),
    windowLit: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.9) }),
  };
  R.paints = {};
  R.neon = {};
  R.templates = {};
}

export function paint(hex) {
  if (!R.paints[hex]) R.paints[hex] = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.65, roughness: 0.28, envMapIntensity: 1.3 });
  return R.paints[hex];
}
export function neonMat(hex, k = 2.4) {
  const key = hex + '_' + k;
  if (!R.neon[key]) { const c = new THREE.Color(hex).multiplyScalar(k); R.neon[key] = new THREE.MeshBasicMaterial({ color: c }); }
  return R.neon[key];
}
export function glowMat(hex, opacity = 0.8) {
  const key = 'g' + hex + opacity;
  if (!R.neon[key]) R.neon[key] = new THREE.MeshBasicMaterial({ map: R.glowTex, color: hex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  return R.neon[key];
}

// Collect geometry pieces, then merge them by material -> few draw calls per model.
class Builder {
  constructor() { this.parts = new Map(); this.extra = []; }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }
  box(w, h, d, mat, x, y, z, rx, ry, rz) { return this.add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz); }
  build() {
    const grp = new THREE.Group();
    for (const [mat, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(geo, mat);
      if (mat.transparent) mesh.renderOrder = 2;
      grp.add(mesh);
    }
    for (const e of this.extra) grp.add(e);
    return grp;
  }
}

function profileGeo(points, depth, bevel = 0.06) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2); // shape +x -> world -z (front)
  return g;
}

function flatQuad(w, l, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
  m.renderOrder = 1;
  return m;
}

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14);
const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 8);

function addWheels(b, xs, zs, r = 1) {
  for (const x of xs) for (const z of zs) {
    b.add(wheelGeo, R.mat.tire, x, 0.36 * r, z, 0, 0, Math.PI / 2, r, 1, r);
    b.add(rimGeo, R.mat.rim, x, 0.36 * r, z, 0, 0, Math.PI / 2, r, 1, r);
  }
}

// kind: sedan | taxi | sport | van | truck | bus ; oncoming adds headlight beams
export function makeVehicle(kind, color, glow, oncoming = false) {
  const key = [kind, color, glow, oncoming].join('|');
  if (R.templates[key]) return R.templates[key].clone();
  const b = new Builder();
  const body = paint(color);
  let len = 4.3, top = 1.45, wid = 1.8;
  if (kind === 'sedan' || kind === 'taxi' || kind === 'sport') {
    const low = kind === 'sport' ? 0.85 : 1;
    const P = kind === 'sport'
      ? [[-2.2, 0.28], [2.25, 0.28], [2.35, 0.45], [2.2, 0.62], [0.7, 0.78], [-1.7, 0.84], [-2.25, 0.8], [-2.3, 0.5]]
      : [[-2.15, 0.3], [2.15, 0.3], [2.22, 0.56], [2.08, 0.82], [0.9, 0.93], [-1.55, 0.97], [-2.12, 0.92], [-2.2, 0.6]];
    b.add(profileGeo(P, wid - 0.16), body);
    const G = kind === 'sport'
      ? [[0.75, 0.76], [-0.1, 1.16], [-0.9, 1.18], [-1.75, 0.82]]
      : [[0.92, 0.9], [0.2, 1.38], [-1.0, 1.42], [-1.58, 0.95]];
    b.add(profileGeo(G, wid - 0.42, 0.04), R.mat.glass);
    // roof panel
    b.box(wid - 0.5, 0.05, kind === 'sport' ? 0.75 : 1.15, body, 0, kind === 'sport' ? 1.19 : 1.44, kind === 'sport' ? 0.5 : 0.4);
    addWheels(b, [-0.86, 0.86], [-1.35, 1.35]);
    top = kind === 'sport' ? 1.2 : 1.45; len = 4.4;
    // lights: front at -z
    b.box(0.5, 0.1, 0.06, R.mat.head, -0.6, 0.66 * low, -2.22);
    b.box(0.5, 0.1, 0.06, R.mat.head, 0.6, 0.66 * low, -2.22);
    b.box(wid - 0.2, 0.08, 0.06, R.mat.tail, 0, 0.75 * low, 2.22);
    b.box(wid, 0.08, 0.1, R.mat.chrome, 0, 0.42, -2.2);
    b.box(wid, 0.08, 0.1, R.mat.chrome, 0, 0.42, 2.2);
    if (kind === 'taxi') {
      b.box(0.7, 0.24, 0.32, neonMat('#ffd23f', 1.8), 0, 1.6, 0.3);
      b.box(wid - 0.12, 0.12, 4.0, R.mat.dark, 0, 0.72, 0, 0, 0, 0);
      // checker band
      for (let i = -6; i <= 6; i++) b.box(wid - 0.1, 0.06, 0.14, i % 2 ? neonMat('#fff', 1) : R.mat.dark, 0, 0.72, i * 0.3);
    }
    if (kind === 'sport') {
      b.box(wid - 0.2, 0.05, 0.4, body, 0, 0.95, 2.05); // spoiler
      b.box(0.06, 0.18, 0.06, body, -0.6, 0.86, 2.05); b.box(0.06, 0.18, 0.06, body, 0.6, 0.86, 2.05);
    }
  } else if (kind === 'van') {
    const P = [[-2.4, 0.3], [2.4, 0.3], [2.48, 0.6], [2.3, 1.05], [1.6, 1.25], [1.1, 2.15], [-2.35, 2.2], [-2.45, 1.0]];
    b.add(profileGeo(P, wid - 0.1), body);
    b.add(profileGeo([[1.65, 1.25], [1.15, 2.05], [0.7, 2.05], [0.75, 1.25]], wid - 0.06, 0.02), R.mat.glass);
    b.box(wid + 0.02, 0.18, 3.0, neonMat(glow, 1.4), 0, 1.45, 0.5); // logo band
    addWheels(b, [-0.88, 0.88], [-1.55, 1.6]);
    b.box(0.4, 0.14, 0.06, R.mat.head, -0.62, 0.8, -2.5); b.box(0.4, 0.14, 0.06, R.mat.head, 0.62, 0.8, -2.5);
    b.box(0.16, 0.5, 0.06, R.mat.tail, -0.8, 1.0, 2.48); b.box(0.16, 0.5, 0.06, R.mat.tail, 0.8, 1.0, 2.48);
    top = 2.2; len = 4.9;
  } else if (kind === 'truck') {
    // cab
    b.add(profileGeo([[1.6, 0.4], [3.3, 0.4], [3.35, 1.3], [3.0, 2.6], [1.6, 2.7]], 2.2), body);
    b.add(profileGeo([[3.02, 1.55], [3.25, 1.45], [2.95, 2.45], [2.4, 2.45], [2.4, 1.55]], 2.25, 0.01), R.mat.glass);
    // container
    b.box(2.35, 2.8, 4.9, R.mat.steel, 0, 1.95, 1.0);
    for (let i = 0; i < 9; i++) b.box(2.4, 2.7, 0.06, R.mat.dark, 0, 1.95, -1.3 + i * 0.55);
    for (const sx of [-1.19, 1.19]) b.box(0.05, 0.1, 4.9, neonMat(glow, 2.2), sx, 3.3, 1.0);
    b.box(2.42, 0.1, 0.05, neonMat(glow, 2.2), 0, 3.3, 3.46);
    b.box(2.42, 0.1, 4.9, neonMat(glow, 2.2), 0, 0.62, 1.0);
    addWheels(b, [-1.0, 1.0], [-2.6, 1.0, 2.6]);
    b.box(0.4, 0.16, 0.06, R.mat.head, -0.75, 0.9, -3.37); b.box(0.4, 0.16, 0.06, R.mat.head, 0.75, 0.9, -3.37);
    b.box(2.2, 0.1, 0.06, R.mat.tail, 0, 0.75, 3.46);
    for (let i = 0; i < 5; i++) b.box(0.08, 0.08, 0.06, R.mat.amber, -0.8 + i * 0.4, 3.38, -3.0);
    top = 3.4; len = 6.8;
  } else if (kind === 'bus') {
    const L = 11;
    b.box(2.5, 2.6, L, body, 0, 1.6, 0);
    b.box(2.56, 0.9, L - 1.4, R.mat.glass, 0, 2.15, 0.3);
    // lit windows
    for (let i = 0; i < 8; i++) b.box(2.58, 0.6, 0.95, R.mat.windowLit, 0, 2.15, -3.6 + i * 1.18);
    b.box(2.58, 0.12, L, neonMat(glow, 2.2), 0, 1.4, 0);
    b.box(2.0, 1.1, 0.08, R.mat.glass, 0, 2.0, -L / 2 - 0.02);
    b.box(1.6, 0.25, 0.1, neonMat('#ffb52b', 2.0), 0, 2.72, -L / 2 - 0.04);
    b.box(2.2, 0.14, 0.1, R.mat.tail, 0, 0.9, L / 2 + 0.02);
    b.box(0.45, 0.16, 0.06, R.mat.head, -0.85, 0.8, -L / 2 - 0.03); b.box(0.45, 0.16, 0.06, R.mat.head, 0.85, 0.8, -L / 2 - 0.03);
    addWheels(b, [-1.1, 1.1], [-3.6, 3.4], 1.2);
    top = 2.9; len = L; wid = 2.5;
  }
  // underglow & ground reflections
  b.extra.push(flatQuad(wid + 1.6, len + 1.2, glowMat(glow, 0.55), 0, 0.03, 0));
  if (oncoming) {
    const beamM = new THREE.MeshBasicMaterial({ map: R.beamTex, color: 0xfff1d0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const x of [-0.6, 0.6]) {
      const q = flatQuad(2.4, 14, beamM, x, 0.035, -len / 2 - 7);
      q.rotation.z = Math.PI; // wide end away from the car
      b.extra.push(q);
    }
    const hg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), glowMat('#fff3d8', 0.9));
    hg.position.set(0, 0.7, -len / 2 - 0.15); hg.scale.set(2.6, 0.9, 1); hg.rotation.y = Math.PI; b.extra.push(hg);
  } else {
    const tg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), glowMat('#ff2040', 0.7));
    tg.position.set(0, 0.8, len / 2 + 0.2); tg.scale.set(2.4, 0.7, 1); b.extra.push(tg);
  }
  const grp = b.build();
  grp.userData = { len, top, wid };
  R.templates[key] = grp;
  return grp.clone();
}

// ---------- obstacles ----------
export function makeBarricade(variant = 0) {
  const key = 'barricade' + variant;
  if (R.templates[key]) return R.templates[key].clone();
  const b = new Builder();
  if (variant === 0) {
    // sawhorse barricade with striped boards + amber lamps
    for (const x of [-0.8, 0.8]) {
      b.box(0.08, 1.0, 0.08, R.mat.steel, x, 0.45, -0.18, 0.35, 0, 0);
      b.box(0.08, 1.0, 0.08, R.mat.steel, x, 0.45, 0.18, -0.35, 0, 0);
    }
    b.add(new THREE.BoxGeometry(1.95, 0.28, 0.06), R.mat.stripeO, 0, 0.78, 0);
    b.add(new THREE.BoxGeometry(1.95, 0.2, 0.06), R.mat.stripeO, 0, 0.42, 0);
    b.box(0.16, 0.16, 0.16, R.mat.amber, -0.8, 1.0, 0);
    b.box(0.16, 0.16, 0.16, R.mat.amber, 0.8, 1.0, 0);
    const g1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat('#ffa020', 0.9)); g1.position.set(-0.8, 1.0, 0.1); g1.scale.setScalar(1.1);
    const g2 = g1.clone(); g2.position.x = 0.8;
    b.extra.push(g1, g2, flatQuad(2.6, 2.4, glowMat('#ff9020', 0.4), 0, 0.03, 0.8));
  } else {
    // jersey barrier with neon strip
    b.add(profileGeo([[-0.35, 0], [0.35, 0], [0.2, 0.3], [0.12, 0.85], [-0.12, 0.85], [-0.2, 0.3]], 1.9, 0.03), R.mat.concrete);
    b.add(new THREE.BoxGeometry(1.9, 0.12, 0.02), R.mat.stripeR, 0, 0.55, 0.2);
    b.box(1.9, 0.05, 0.05, neonMat('#ff2bd6', 2.6), 0, 0.88, 0);
    b.extra.push(flatQuad(2.6, 2.0, glowMat('#ff2bd6', 0.35), 0, 0.03, 0.7));
  }
  const g = b.build(); R.templates[key] = g; return g.clone();
}

export function makeBeam(color) {
  const key = 'beam' + color;
  if (R.templates[key]) return R.templates[key].clone();
  const b = new Builder();
  // posts at lane edges up to a gantry
  for (const x of [-1.05, 1.05]) {
    b.box(0.14, 3.2, 0.14, R.mat.steel, x, 1.6, 0);
    b.box(0.3, 0.06, 0.3, R.mat.steel, x, 0.03, 0);
  }
  b.box(2.3, 0.14, 0.3, R.mat.steel, 0, 3.2, 0);
  // hanging hazard beam
  b.add(new THREE.BoxGeometry(2.1, 0.5, 0.36), R.mat.stripeY, 0, 1.55, 0);
  b.box(2.12, 0.06, 0.38, neonMat(color, 2.6), 0, 1.28, 0);
  b.box(0.04, 1.4, 0.04, R.mat.chrome, -0.7, 2.5, 0); b.box(0.04, 1.4, 0.04, R.mat.chrome, 0.7, 2.5, 0);
  // warning sign
  const tex = signTexture('▼ DUCK ▼', color, { w: 256, h: 64 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6) }));
  sign.position.set(0, 2.05, 0.19);
  b.extra.push(sign, flatQuad(2.8, 3, glowMat(color, 0.35), 0, 0.03, 0.4));
  const g = b.build(); R.templates[key] = g; return g.clone();
}

export function makeContainer(color) {
  const key = 'cont' + color;
  if (R.templates[key]) return R.templates[key].clone();
  const b = new Builder();
  b.box(2.0, 2.2, 3.0, paint(color), 0, 1.15, 0);
  for (let i = 0; i < 7; i++) b.box(2.04, 2.1, 0.05, R.mat.dark, 0, 1.15, -1.3 + i * 0.43);
  b.add(new THREE.BoxGeometry(2.04, 0.3, 0.05), R.mat.stripeO, 0, 0.4, 1.52);
  for (const sx of [-1.02, 1.02]) b.box(0.05, 0.06, 3.02, neonMat('#ffb52b', 2), sx, 2.27, 0);
  b.box(2.06, 0.06, 0.05, neonMat('#ffb52b', 2), 0, 2.27, 1.51);
  b.box(0.2, 0.2, 0.2, R.mat.amber, -0.8, 2.4, 1.3); b.box(0.2, 0.2, 0.2, R.mat.amber, 0.8, 2.4, 1.3);
  const g1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat('#ffa020', 0.8)); g1.position.set(0, 2.4, 1.45); g1.scale.set(2.6, 0.8, 1);
  b.extra.push(g1, flatQuad(3, 4, glowMat('#ffb52b', 0.3), 0, 0.03, 0.5));
  const g = b.build(); R.templates[key] = g; return g.clone();
}

export function makeGate() {
  const key = 'gate';
  if (R.templates[key]) return R.templates[key].clone();
  const b = new Builder();
  b.add(new THREE.BoxGeometry(2.2, 0.16, 0.12), R.mat.stripeR, 0, 0.8, 0);
  for (const x of [-0.8, 0, 0.8]) b.box(0.12, 0.12, 0.14, R.mat.redLamp, x, 0.8, 0);
  b.box(0.06, 0.8, 0.06, R.mat.steel, -0.95, 0.4, 0); b.box(0.06, 0.8, 0.06, R.mat.steel, 0.95, 0.4, 0);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat('#ff2040', 0.8)); gl.position.set(0, 0.8, 0.1); gl.scale.set(3, 0.7, 1);
  b.extra.push(gl, flatQuad(2.6, 2.6, glowMat('#ff2040', 0.35), 0, 0.03, 0.6));
  const g = b.build(); R.templates[key] = g; return g.clone();
}

export function makeCone() {
  const key = 'cone';
  if (R.templates[key]) return R.templates[key].clone();
  const b = new Builder();
  b.add(new THREE.ConeGeometry(0.2, 0.7, 10), neonMat('#ff7a10', 1.1), 0, 0.37, 0);
  b.add(new THREE.CylinderGeometry(0.11, 0.14, 0.1, 10), neonMat('#ffffff', 1.4), 0, 0.42, 0);
  b.box(0.45, 0.05, 0.45, R.mat.dark, 0, 0.025, 0);
  const g = b.build(); R.templates[key] = g; return g.clone();
}

// ---------- pickups ----------
function cloneWithParts(tpl, names) {
  const c = tpl.clone();
  c.userData = {};
  for (const n of names) c.userData[n] = c.children[tpl.children.indexOf(tpl.userData[n])];
  return c;
}
export function makePowerup(kind) {
  const key = 'pu_' + kind;
  if (!R.templates[key]) R.templates[key] = buildPowerup(kind);
  return cloneWithParts(R.templates[key], ['core', 'ring', 'icon']);
}
export function makeGem() {
  if (!R.templates.gem) R.templates.gem = buildGem();
  return cloneWithParts(R.templates.gem, ['m', 'w']);
}
function buildPowerup(kind) {
  const colors = { shield: '#4cc9ff', magnet: '#ff4f7b', drive: '#ffd23f' };
  const col = colors[kind];
  const grp = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.2), wireframe: true }));
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(kind, col), color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false }));
  icon.scale.setScalar(0.9);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  glow.scale.setScalar(2.6);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.5) }));
  grp.add(glow, core, icon, ring);
  grp.add(flatQuad(2.2, 2.2, glowMat(col, 0.5), 0, -1.17, 0));
  grp.userData = { core, ring, icon };
  return grp;
}

function buildGem() {
  const grp = new THREE.Group();
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: 0xff3df0, emissive: new THREE.Color(1.6, 0.2, 1.3), metalness: 0.6, roughness: 0.15 }));
  m.scale.y = 1.5;
  const w = new THREE.Mesh(new THREE.OctahedronGeometry(0.47, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 3), wireframe: true }));
  w.scale.y = 1.5;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.glowTex, color: '#ff2bd6', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95 }));
  glow.scale.setScalar(2.4);
  grp.add(glow, m, w);
  grp.userData = { m, w };
  return grp;
}

// ---------- runner character ----------
export function makeRunner() {
  const suit = new THREE.MeshStandardMaterial({ color: 0x1c1430, metalness: 0.35, roughness: 0.45 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2a1650, metalness: 0.5, roughness: 0.3 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x2b2238, metalness: 0.7, roughness: 0.25 });
  const neonC = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 3.0) });
  const neonM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.5, 2.4) });
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const cap = (r, l, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 8), m);
  const t = cap(0.2, 0.34, jacket); t.position.y = 0.32; t.scale.set(1.15, 1, 0.8); torso.add(t);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), neonC); stripe.position.set(0, 0.34, -0.17); torso.add(stripe);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.16), suit); pack.position.set(0, 0.36, 0.2); torso.add(pack);
  const packL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.02), neonM); packL.position.set(0, 0.42, 0.29); torso.add(packL);
  const packL2 = packL.clone(); packL2.position.y = 0.3; torso.add(packL2);
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), skin); skull.scale.set(1, 1.1, 1.05); head.add(skull);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.12), neonC); visor.position.set(0, 0.02, -0.12); head.add(visor);
  const hair = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), neonM); hair.position.set(0, 0.16, 0.08); hair.rotation.x = 1.0; head.add(hair);
  const mkLimb = (len, r, m, y) => {
    const pivot = new THREE.Group(); pivot.position.y = y;
    const upper = cap(r, len, m); upper.position.y = -len / 2 - r * 0.5; pivot.add(upper);
    const joint = new THREE.Group(); joint.position.y = -len - r; pivot.add(joint);
    const lower = cap(r * 0.9, len, m); lower.position.y = -len / 2 - r * 0.4; joint.add(lower);
    return { pivot, joint };
  };
  const armL = mkLimb(0.22, 0.07, jacket, 0.56), armR = mkLimb(0.22, 0.07, jacket, 0.56);
  armL.pivot.position.x = -0.3; armR.pivot.position.x = 0.3; torso.add(armL.pivot, armR.pivot);
  for (const a of [armL, armR]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 4, 10), neonC); band.rotation.x = Math.PI / 2; band.position.y = -0.2; a.joint.add(band); }
  const legL = mkLimb(0.3, 0.09, suit, 0), legR = mkLimb(0.3, 0.09, suit, 0);
  legL.pivot.position.x = -0.13; legR.pivot.position.x = 0.13; hips.add(legL.pivot, legR.pivot);
  for (const l of [legL, legR]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.3), neonM); shoe.position.set(0, -0.42, -0.05); l.joint.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.31), neonC); sole.position.set(0, -0.48, -0.05); l.joint.add(sole);
  }
  // ground glow
  const shadow = flatQuad(1.6, 1.6, new THREE.MeshBasicMaterial({ map: R.glowTex, color: 0x22e6ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.04, 0);
  g.add(shadow);
  return { group: g, body, hips, torso, head, armL, armR, legL, legR, shadow };
}
