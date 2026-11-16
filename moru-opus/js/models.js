// Procedural models: everything is built from primitives and merged per material
// to keep draw calls low on mobile GPUs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class Builder {
  constructor() { this.parts = new Map(); }
  add(mat, geo, o = {}) {
    const R = REDIRECT.get(mat);
    if (R) { o = { ...o }; if (R.uv && !o.uv) o.uv = R.uv; if (o.c === undefined) o.c = R.c; o.ci = (o.ci ?? 1) * R.ci; mat = R.mat; }
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (o.uv) {
      const a = g.attributes.uv, [u0, v0, u1, v1] = o.uv;
      for (let i = 0; i < a.count; i++) a.setXY(i, u0 + (u1 - u0) * a.getX(i), v0 + (v1 - v0) * a.getY(i));
    }
    const col = new Float32Array(n * 3); _c.set(o.c ?? 0xffffff);
    if (o.ci) _c.multiplyScalar(o.ci);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const r = o.r || [0, 0, 0], p = o.p || [0, 0, 0], s = o.s || [1, 1, 1];
    _e.set(r[0], r[1], r[2]); _q.setFromEuler(_e); _m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
    g.applyMatrix4(_m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }
  box(mat, w, h, d, x, y, z, o = {}) { return this.add(mat, G.box, { ...o, p: [x, y, z], s: [w, h, d] }); }
  build(mirror = false) {
    const grp = new THREE.Group();
    for (const [mat, geos] of this.parts) {
      const merged = mergeGeometries(geos, false);
      if (mirror) {
        merged.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
        for (const a of Object.values(merged.attributes)) {
          const n = a.itemSize, arr = a.array;
          for (let i = 0; i < a.count; i += 3) for (let k = 0; k < n; k++) {
            const t = arr[(i + 1) * n + k]; arr[(i + 1) * n + k] = arr[(i + 2) * n + k]; arr[(i + 2) * n + k] = t;
          }
        }
      }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      grp.add(mesh);
    }
    return grp;
  }
}

// shared unit geometries
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 12),
  plane: new THREE.PlaneGeometry(1, 1),
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
  torus: new THREE.TorusGeometry(0.5, 0.06, 6, 24),
};

export const M = {}; // materials
const REDIRECT = new Map();
export const TX = {};

export function initMaterials() {
  TX.glow = T.glowTexture();
  TX.signs = T.signAtlas();
  TX.shops = T.shopAtlas();
  TX.facades = [0, 1, 2, 3].map(i => T.windowTexture(i, 100 + i * 17));
  TX.hazard = T.stripeTexture('#ff8a00', '#141018', 5);
  TX.redWhite = T.stripeTexture('#ff2840', '#f2f2f2', 4);
  TX.mesh = T.meshTexture(); TX.mesh.repeat.set(4, 4);
  TX.tunnel = T.tunnelTexture();

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const basic = (o) => new THREE.MeshBasicMaterial(o);
  M.neon = basic({ vertexColors: true, color: new THREE.Color(2.2, 2.2, 2.2) });
  M.neonSoft = basic({ vertexColors: true, color: new THREE.Color(1.1, 1.1, 1.1) });
  M.glow = basic({ map: TX.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  M.signs = basic({ map: TX.signs, color: new THREE.Color(1.9, 1.9, 1.9) });
  M.shops = basic({ map: TX.shops, color: new THREE.Color(0.85, 0.85, 0.85) });
  M.metal = std({ color: 0x23232d, metalness: 0.7, roughness: 0.35, envMapIntensity: 0.8 });
  M.darkMetal = std({ color: 0x121218, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.5 });
  M.concrete = std({ color: 0x34323d, roughness: 0.85, metalness: 0.05, envMapIntensity: 0.3 });
  M.facade = [];
  const tints = [0xffffff, 0xc8d8ff, 0xffd0f0];
  for (const tx of TX.facades) for (const t of tints) {
    M.facade.push(std({ color: 0x4a4658, map: tx, emissive: new THREE.Color(t), emissiveMap: tx, emissiveIntensity: 1.0, roughness: 0.55, metalness: 0.3, envMapIntensity: 0.6 }));
  }
  M.rubber = std({ color: 0x0b0b0e, roughness: 0.9 });
  M.chrome = std({ color: 0xcfd4e0, metalness: 1, roughness: 0.15, envMapIntensity: 1.4 });
  M.glass = std({ color: 0x0a0d18, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.6, emissive: 0x0a1028 });
  M.headlight = basic({ color: new THREE.Color(3.2, 3.0, 2.6) });
  M.taillight = basic({ color: new THREE.Color(3.0, 0.15, 0.2) });
  M.blinkAmber = basic({ color: new THREE.Color(3, 1.5, 0.1) });
  M.blinkRedA = basic({ color: new THREE.Color(3, 0.1, 0.1) });
  M.blinkRedB = basic({ color: new THREE.Color(3, 0.1, 0.1) });
  M.lamp = basic({ color: new THREE.Color(3, 2.4, 1.6) });
  M.hazard = std({ map: TX.hazard, roughness: 0.6, emissive: 0xffffff, emissiveMap: TX.hazard, emissiveIntensity: 0.35 });
  M.redWhite = std({ map: TX.redWhite, roughness: 0.5, emissive: 0xffffff, emissiveMap: TX.redWhite, emissiveIntensity: 0.5 });
  M.meshFence = std({ map: TX.mesh, color: 0x9a9ab0, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
  M.tunnel = std({ map: TX.tunnel, color: 0x9a96a8, roughness: 0.7, metalness: 0.2, envMapIntensity: 0.4 });
  M.orangePlastic = std({ color: 0xff6a00, roughness: 0.5, emissive: 0x401000 });
  M.white = std({ color: 0xe6e6ee, roughness: 0.5 });
  M.paints = [0x1b2a6a, 0x5a0f4f, 0x0e4b4b, 0x7a1020, 0xd8dae6, 0x111116, 0x3b2a6a, 0x206040].map(c => std({ color: c, metalness: 0.75, roughness: 0.28, envMapIntensity: 1.5 }));
  M.taxi = std({ color: 0xf5b800, metalness: 0.5, roughness: 0.3, envMapIntensity: 1.2 });
  M.containers = [0xc0451b, 0x1b6c7a, 0x6b2a8a, 0x9a8a20].map(c => std({ color: c, metalness: 0.4, roughness: 0.6, envMapIntensity: 0.6 }));
  // draw-call reduction: merged structural + emissive materials used by the Builder
  M.struct = std({ vertexColors: true, metalness: 0.55, roughness: 0.5, envMapIntensity: 0.7 });
  M.emis = basic({ map: TX.signs, vertexColors: true });
  const WHITE = [0.92, 0.05, 0.95, 0.2];
  REDIRECT.set(M.neon, { mat: M.emis, uv: WHITE, c: 0xffffff, ci: 2.2 });
  REDIRECT.set(M.signs, { mat: M.emis, c: 0xffffff, ci: 1.9 });
  REDIRECT.set(M.headlight, { mat: M.emis, uv: WHITE, c: 0xfff2e0, ci: 3.0 });
  REDIRECT.set(M.taillight, { mat: M.emis, uv: WHITE, c: 0xff0d14, ci: 3.0 });
  REDIRECT.set(M.metal, { mat: M.struct, c: 0x2a2a36, ci: 1 });
  REDIRECT.set(M.darkMetal, { mat: M.struct, c: 0x16161d, ci: 1 });
  REDIRECT.set(M.concrete, { mat: M.struct, c: 0x3a3844, ci: 1 });
  REDIRECT.set(M.rubber, { mat: M.struct, c: 0x0b0b0e, ci: 1 });
  REDIRECT.set(M.chrome, { mat: M.struct, c: 0xa0a6b8, ci: 1 });
  // coins / gems
  M.coin = basic({ color: new THREE.Color(2.0, 1.35, 0.25) });
  M.gem = basic({ color: new THREE.Color(2.6, 0.4, 2.4) });
  return M;
}

// ======================= RUNNER =======================
export function makeRunner() {
  const suit = new THREE.MeshStandardMaterial({ color: 0x1c1f38, roughness: 0.55, metalness: 0.3, envMapIntensity: 1 });
  const armor = new THREE.MeshStandardMaterial({ color: 0xaab4cc, roughness: 0.35, metalness: 0.5, envMapIntensity: 1.2 });
  const cyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.6, 3.0) });
  const pink = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.2, 1.1) });
  const visor = new THREE.MeshStandardMaterial({ color: 0x050510, emissive: new THREE.Color(0.1, 1.6, 2.2), metalness: 1, roughness: 0.1 });
  const mats = { suit, armor, cyan, pink, visor };
  const m = (geo, mat, x, y, z, sx, sy, sz, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o; };
  const capsule = new THREE.CapsuleGeometry(0.5, 1, 4, 10);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); // lean pivot
  const hips = new THREE.Group(); hips.position.y = 0.96; body.add(hips);
  m(G.box, suit, 0, 0, 0, 0.34, 0.2, 0.22, hips);
  m(G.box, cyan, 0, 0.06, -0.115, 0.3, 0.025, 0.01, hips);
  const torso = new THREE.Group(); torso.position.y = 0.08; hips.add(torso);
  m(capsule, suit, 0, 0.27, 0, 0.36, 0.26, 0.24, torso);
  m(G.box, armor, 0, 0.36, -0.1, 0.34, 0.26, 0.08, torso);
  m(G.box, cyan, 0, 0.28, -0.145, 0.24, 0.025, 0.01, torso);
  m(G.box, cyan, 0, 0.4, -0.145, 0.04, 0.2, 0.01, torso);
  // backpack + battery strip
  m(G.box, armor, 0, 0.32, 0.17, 0.3, 0.36, 0.14, torso);
  m(G.box, pink, 0, 0.32, 0.245, 0.06, 0.28, 0.02, torso);
  m(G.box, cyan, 0.12, 0.45, 0.245, 0.03, 0.06, 0.02, torso);
  const head = new THREE.Group(); head.position.y = 0.62; torso.add(head);
  m(G.sphere, armor, 0, 0.08, 0, 0.3, 0.32, 0.32, head);
  m(G.box, visor, 0, 0.09, -0.12, 0.26, 0.1, 0.1, head);
  m(G.box, cyan, 0, 0.09, -0.172, 0.22, 0.02, 0.01, head);
  m(G.box, pink, 0, 0.25, 0.02, 0.03, 0.08, 0.26, head); // fin
  const limbs = {};
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(side * 0.24, 0.48, 0); torso.add(sh);
    m(G.sphere, armor, 0, 0, 0, 0.16, 0.14, 0.16, sh);
    m(capsule, suit, 0, -0.14, 0, 0.1, 0.18, 0.1, sh);
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    m(capsule, suit, 0, -0.13, 0, 0.09, 0.16, 0.09, el);
    m(G.box, cyan, side * 0.045, -0.13, 0, 0.012, 0.16, 0.05, el);
    m(G.sphere, armor, 0, -0.3, 0, 0.11, 0.11, 0.11, el);
    const th = new THREE.Group(); th.position.set(side * 0.1, -0.06, 0); hips.add(th);
    m(capsule, suit, 0, -0.21, 0, 0.14, 0.26, 0.14, th);
    m(G.box, armor, 0, -0.18, -0.07, 0.1, 0.18, 0.03, th);
    const kn = new THREE.Group(); kn.position.y = -0.43; th.add(kn);
    m(capsule, suit, 0, -0.2, 0, 0.11, 0.26, 0.11, kn);
    m(G.box, armor, 0, -0.16, -0.05, 0.09, 0.2, 0.04, kn);
    const foot = new THREE.Group(); foot.position.y = -0.42; kn.add(foot);
    m(G.box, armor, 0, -0.02, -0.05, 0.12, 0.08, 0.26, foot);
    m(G.box, pink, 0, -0.06, -0.05, 0.13, 0.02, 0.27, foot);
    limbs[side < 0 ? 'L' : 'R'] = { sh, el, th, kn, foot };
  }
  // merge static meshes inside each bone group per material (fewer draw calls)
  const groups = []; root.traverse(o => { if (o.isGroup) groups.push(o); });
  for (const grp of groups) {
    const byMat = new Map();
    for (const c of [...grp.children]) if (c.isMesh) {
      c.updateMatrix();
      let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      g.applyMatrix4(c.matrix);
      if (!byMat.has(c.material)) byMat.set(c.material, []);
      byMat.get(c.material).push(g); grp.remove(c);
    }
    for (const [mat, list] of byMat) grp.add(new THREE.Mesh(mergeGeometries(list, false), mat));
  }
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return { root, body, hips, torso, head, limbs, mats };
}

// ======================= VEHICLES (front faces +z) =======================
function wheels(b, W, L, r, zs) {
  for (const z of zs) for (const s of [-1, 1]) {
    b.add(M.rubber, G.cyl, { p: [s * W / 2, r, z], r: [0, 0, Math.PI / 2], s: [r * 2, 0.26, r * 2] });
    b.add(M.neon, G.cyl, { p: [s * (W / 2 + 0.135), r, z], r: [0, 0, Math.PI / 2], s: [r * 1.1, 0.01, r * 1.1], c: 0x40e0ff, ci: 0.6 });
  }
}
function lightsAndGlow(b, W, L, H, accent, front, o = {}) {
  const fz = L / 2 + 0.01, rz = -L / 2 - 0.01;
  // headlights
  for (const s of [-1, 1]) b.box(M.headlight, 0.36, 0.1, 0.04, s * (W / 2 - 0.3), o.hy ?? 0.72, fz);
  b.box(M.neon, W * 0.7, 0.03, 0.03, 0, (o.hy ?? 0.72) + 0.1, fz, { c: accent });
  // taillights
  b.box(M.taillight, W * 0.9, 0.07, 0.04, 0, o.ty ?? 0.82, rz);
  // underglow and side sills
  b.add(M.glow, G.plane, { p: [0, 0.04, 0], r: [-Math.PI / 2, 0, 0], s: [W + 1.6, L + 1.4, 1], c: accent, ci: 0.7 });
  for (const s of [-1, 1]) b.box(M.neon, 0.02, 0.03, L * 0.7, s * (W / 2 + 0.01), 0.36, 0, { c: accent });
  if (front) {
    // headlight wash on the road + glare
    b.add(M.glow, G.plane, { p: [0, 0.03, L / 2 + 4], r: [-Math.PI / 2, 0, 0], s: [W + 1.5, 9, 1], c: 0xfff0d8, ci: 0.55 });
    for (const s of [-1, 1]) b.add(M.glow, G.plane, { p: [s * (W / 2 - 0.3), o.hy ?? 0.72, fz + 0.05], s: [1.4, 0.9, 1], c: 0xfff4e0, ci: 1.0 });
    // wet road streak reflections of headlights
    for (const s of [-1, 1]) b.add(M.glow, G.plane, { p: [s * (W / 2 - 0.3), 0.025, L / 2 + 2.5], r: [-Math.PI / 2, 0, 0], s: [0.5, 5.5, 1], c: 0xfff0d8, ci: 0.5 });
  }
}

export function makeCar(kind, rnd, front = true) {
  const b = new Builder();
  const accent = T.NEON[(rnd() * 6) | 0];
  let L, W, H;
  if (kind === 'sports') {
    L = 4.4; W = 1.95; H = 1.15;
    const paint = M.paints[(rnd() * M.paints.length) | 0];
    b.box(paint, W, 0.42, L, 0, 0.42, 0);
    b.box(paint, W * 0.96, 0.16, L * 0.36, 0, 0.7, L * 0.25, { r: [0.12, 0, 0] });
    b.box(M.glass, W * 0.78, 0.36, L * 0.38, 0, 0.82, -0.25);
    b.box(paint, W * 0.74, 0.05, L * 0.28, 0, 1.0, -0.35);
    b.box(paint, W * 0.98, 0.06, 0.4, 0, 0.98, -L / 2 + 0.25); // spoiler
    b.box(M.darkMetal, W * 1.02, 0.14, 0.3, 0, 0.3, L / 2 - 0.1);
    wheels(b, W, L, 0.34, [L * 0.32, -L * 0.32]);
    lightsAndGlow(b, W, L, H, accent, front, { hy: 0.55, ty: 0.6 });
  } else if (kind === 'taxi' || kind === 'sedan') {
    L = 4.5; W = 1.85; H = 1.45;
    const paint = kind === 'taxi' ? M.taxi : M.paints[(rnd() * M.paints.length) | 0];
    b.box(paint, W, 0.55, L, 0, 0.6, 0);
    b.box(paint, W * 0.97, 0.12, L * 0.3, 0, 0.92, L * 0.3);
    b.box(M.glass, W * 0.86, 0.46, L * 0.46, 0, 1.1, -0.2);
    b.box(paint, W * 0.84, 0.06, L * 0.4, 0, 1.35, -0.25);
    b.box(M.darkMetal, W * 1.02, 0.18, 0.25, 0, 0.42, L / 2);
    b.box(M.darkMetal, W * 1.02, 0.18, 0.25, 0, 0.42, -L / 2);
    if (kind === 'taxi') {
      b.box(M.headlight, 0.7, 0.2, 0.3, 0, 1.48, -0.2);
      b.box(M.neon, 0.72, 0.04, 0.32, 0, 1.6, -0.2, { c: 0xff2bd6 });
      for (let i = 0; i < 6; i++) b.box(M.darkMetal, 0.12, 0.12, 0.02, 0, 0.6 + (i % 2) * 0.12, -0.6 + i * 0.25, {}); // checker hint
    }
    wheels(b, W, L, 0.36, [L * 0.32, -L * 0.32]);
    lightsAndGlow(b, W, L, H, accent, front);
  } else if (kind === 'van') {
    L = 5.2; W = 2.0; H = 2.3;
    const paint = M.paints[(rnd() * M.paints.length) | 0];
    b.box(paint, W, 1.8, L, 0, 1.25, 0);
    b.box(M.glass, W * 0.9, 0.6, 0.06, 0, 1.6, L / 2 + 0.01);
    b.box(M.glass, 0.04, 0.5, L * 0.5, W / 2 + 0.01, 1.65, 0.3); b.box(M.glass, 0.04, 0.5, L * 0.5, -W / 2 - 0.01, 1.65, 0.3);
    b.box(M.neon, 0.03, 0.12, L * 0.85, W / 2 + 0.02, 1.0, 0, { c: accent }); b.box(M.neon, 0.03, 0.12, L * 0.85, -W / 2 - 0.02, 1.0, 0, { c: accent });
    b.box(M.darkMetal, W * 1.02, 0.25, 0.25, 0, 0.45, L / 2);
    b.box(M.blinkAmber, 0.6, 0.12, 0.3, 0, 2.2, 0.6);
    wheels(b, W, L, 0.4, [L * 0.33, -L * 0.33]);
    lightsAndGlow(b, W, L, H, accent, front, { hy: 0.85, ty: 1.1 });
  } else if (kind === 'truck') {
    L = 7.5; W = 2.3; H = 3.3;
    const paint = M.paints[(rnd() * M.paints.length) | 0];
    b.box(paint, W, 2.1, 2.0, 0, 1.55, L / 2 - 1.0); // cab
    b.box(M.glass, W * 0.9, 0.8, 0.06, 0, 2.0, L / 2 + 0.01);
    b.box(M.containers[(rnd() * 4) | 0], W * 1.02, 2.7, L - 2.2, 0, 1.95, -1.1);
    for (let i = 0; i < 8; i++) b.box(M.darkMetal, W * 1.05, 2.6, 0.06, 0, 1.95, -L / 2 + 0.3 + i * 0.75);
    b.box(M.hazard, W * 1.04, 0.3, L - 2.3, 0, 0.75, -1.1);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.box(M.blinkAmber, 0.04, 0.1, 0.16, s * (W / 2 + 0.03), 3.1, -L / 2 + 0.6 + i * 1.6);
    b.box(M.neon, W * 0.9, 0.05, 0.05, 0, 2.7, L / 2 - 0.05, { c: accent });
    wheels(b, W, L, 0.5, [L / 2 - 1, -L / 2 + 1.2, -L / 2 + 2.4]);
    lightsAndGlow(b, W, L, H, accent, front, { hy: 0.85, ty: 1.0 });
  } else if (kind === 'bus') {
    L = 10; W = 2.5; H = 3.2;
    const paint = M.paints[(rnd() * M.paints.length) | 0];
    b.box(paint, W, 2.6, L, 0, 1.65, 0);
    b.box(M.shops, 0.04, 1.0, L * 0.85, W / 2 + 0.01, 2.0, -0.3, { uv: TX.shops.userData[1] });
    b.box(M.shops, 0.04, 1.0, L * 0.85, -W / 2 - 0.01, 2.0, -0.3, { uv: TX.shops.userData[6] });
    b.box(M.glass, W * 0.92, 1.2, 0.06, 0, 2.0, L / 2 + 0.01);
    b.add(M.signs, G.plane, { p: [0, 2.85, L / 2 + 0.02], s: [W * 0.8, W * 0.2, 1], uv: TX.signs.userData.h[21] });
    b.box(M.neon, 0.03, 0.08, L * 0.95, W / 2 + 0.02, 1.35, 0, { c: accent }); b.box(M.neon, 0.03, 0.08, L * 0.95, -W / 2 - 0.02, 1.35, 0, { c: accent });
    wheels(b, W, L, 0.5, [L / 2 - 1.8, -L / 2 + 2]);
    lightsAndGlow(b, W, L, H, accent, front, { hy: 0.8, ty: 1.2 });
  }
  const g = b.build();
  g.userData = { L, W, H };
  return g;
}

// ======================= OBSTACLES =======================
export function makeBarrier(kind) {
  const b = new Builder();
  if (kind === 'sawhorse') {
    for (const s of [-1, 1]) {
      b.box(M.darkMetal, 0.08, 1.0, 0.08, s * 0.85, 0.48, 0.18, { r: [0.25, 0, 0] });
      b.box(M.darkMetal, 0.08, 1.0, 0.08, s * 0.85, 0.48, -0.18, { r: [-0.25, 0, 0] });
    }
    b.box(M.hazard, 2.05, 0.28, 0.06, 0, 0.82, 0);
    b.box(M.hazard, 2.05, 0.2, 0.06, 0, 0.42, 0);
    b.box(M.blinkAmber, 0.16, 0.16, 0.16, -0.8, 1.05, 0);
    b.box(M.blinkAmber, 0.16, 0.16, 0.16, 0.8, 1.05, 0);
    b.add(M.glow, G.plane, { p: [0, 0.03, 1.5], r: [-Math.PI / 2, 0, 0], s: [1.2, 3.5, 1], c: 0xff9a20, ci: 0.6 });
  } else {
    // jersey barrier
    b.box(M.white, 2.1, 0.35, 0.7, 0, 0.175, 0);
    b.box(M.white, 2.1, 0.5, 0.36, 0, 0.6, 0);
    b.box(M.hazard, 2.11, 0.22, 0.37, 0, 0.62, 0.001);
    b.box(M.neon, 2.12, 0.03, 0.38, 0, 0.86, 0, { c: 0xff7a00 });
    b.box(M.blinkAmber, 0.18, 0.12, 0.12, 0, 0.92, 0);
    b.add(M.glow, G.plane, { p: [0, 0.03, 1.6], r: [-Math.PI / 2, 0, 0], s: [2.6, 3.5, 1], c: 0xff7a00, ci: 0.45 });
  }
  return b.build();
}

export function makeBeam() {
  // overhead scaffold: must slide under. Spans 1.15 .. 3.6
  const b = new Builder();
  for (const s of [-1, 1]) {
    b.box(M.metal, 0.12, 3.7, 0.12, s * 1.1, 1.85, 0);
    b.box(M.blinkAmber, 0.2, 0.2, 0.2, s * 1.1, 3.75, 0);
  }
  b.box(M.hazard, 2.3, 0.42, 0.3, 0, 1.36, 0);
  b.box(M.neon, 2.3, 0.04, 0.32, 0, 1.15, 0, { c: 0xff2bd6 });
  b.add(M.meshFence, G.plane, { p: [0, 2.55, 0], s: [2.1, 2.0, 1], uv: [0, 0, 4, 4] });
  b.box(M.metal, 2.3, 0.1, 0.14, 0, 3.55, 0);
  // down chevrons sign
  b.add(M.glow, G.plane, { p: [0, 1.36, 0.17], s: [2.6, 1.2, 1], c: 0xff2bd6, ci: 0.35 });
  for (let i = -2; i <= 2; i++) b.box(M.neon, 0.18, 0.05, 0.02, i * 0.42, 1.36, 0.16, { c: 0xffffff, ci: 0.8 });
  b.add(M.glow, G.plane, { p: [0, 0.03, 1.5], r: [-Math.PI / 2, 0, 0], s: [2.2, 3.5, 1], c: 0xff2bd6, ci: 0.45 });
  return b.build();
}

export function makeContainer(rnd) {
  const b = new Builder();
  const mat = M.containers[(rnd() * 4) | 0];
  b.box(mat, 2.1, 2.5, 2.6, 0, 1.25, 0);
  for (let i = 0; i < 7; i++) b.box(mat, 0.06, 2.4, 2.62, -0.9 + i * 0.3, 1.25, 0);
  b.box(M.hazard, 2.15, 0.35, 2.65, 0, 0.3, 0);
  b.box(M.neon, 2.16, 0.04, 2.66, 0, 2.5, 0, { c: T.NEON[(rnd() * 4) | 0] });
  b.add(M.signs, G.plane, { p: [0, 1.6, 1.31], s: [1.8, 0.45, 1], uv: TX.signs.userData.h[(rnd() * 32) | 0] });
  b.box(M.blinkAmber, 0.22, 0.22, 0.22, 0.7, 2.62, 0.9);
  b.add(M.glow, G.plane, { p: [0.7, 2.62, 0.9], s: [1.6, 1.6, 1], c: 0xff9a20, ci: 0.5 });
  return b.build();
}

export function makeCone() {
  const b = new Builder();
  b.box(M.darkMetal, 0.4, 0.05, 0.4, 0, 0.025, 0);
  b.add(M.orangePlastic, G.cone, { p: [0, 0.38, 0], s: [0.34, 0.7, 0.34] });
  b.add(M.neon, G.cyl, { p: [0, 0.42, 0], s: [0.21, 0.08, 0.21], c: 0xffffff, ci: 0.6 });
  return b.build();
}

export function makeGate() {
  // level crossing: two gate arms + signal posts. Arms at y 1.0-1.25 across road.
  const b = new Builder();
  for (const s of [-1, 1]) {
    b.box(M.metal, 0.16, 3.4, 0.16, s * 4.3, 1.7, 0);
    b.box(M.darkMetal, 0.5, 0.6, 0.5, s * 4.3, 0.3, 0);
    b.box(M.redWhite, 4.3, 0.18, 0.12, s * 2.15, 1.12, 0);
    b.box(M.darkMetal, 0.9, 0.9, 0.08, s * 4.3, 2.4, 0.12); // signal back plate
    b.add(M.blinkRedA, G.sphere, { p: [s * 4.3 - 0.25, 2.4, 0.2], s: [0.26, 0.26, 0.1] });
    b.add(M.blinkRedB, G.sphere, { p: [s * 4.3 + 0.25, 2.4, 0.2], s: [0.26, 0.26, 0.1] });
    // crossbuck
    b.box(M.white, 1.6, 0.18, 0.04, s * 4.3, 3.2, 0.1, { r: [0, 0, 0.6] });
    b.box(M.white, 1.6, 0.18, 0.04, s * 4.3, 3.2, 0.1, { r: [0, 0, -0.6] });
    for (let i = 0; i < 4; i++) b.add(M.blinkRedA, G.sphere, { p: [s * (0.5 + i * 1.1), 1.27, 0], s: [0.1, 0.1, 0.1] });
  }
  b.add(M.glow, G.plane, { p: [0, 0.03, 1.8], r: [-Math.PI / 2, 0, 0], s: [8, 4, 1], c: 0xff2030, ci: 0.55 });
  for (const s of [-1, 1]) b.add(M.glow, G.plane, { p: [s * 4.3, 2.4, 0.3], s: [2.6, 2.6, 1], c: 0xff2030, ci: 0.6 });
  // rails & ties (track sits behind the gate)
  const t = new Builder();
  for (const z of [-3.7, -2.3]) t.box(M.chrome, 80, 0.08, 0.1, 0, 0.04, z);
  for (let x = -40; x < 40; x += 1.2) t.box(M.darkMetal, 0.3, 0.05, 2.4, x, 0.02, -3);
  const g = new THREE.Group(); g.add(b.build()); g.add(t.build());
  return g;
}

export function makeTrain(rnd, cars = 4) {
  // runs along x. head at +x end (local x=0), body extends to -x
  const b = new Builder();
  const CL = 16, W = 3.0, H = 3.4;
  const livery = T.NEON[(rnd() * 3) | 0];
  for (let i = 0; i < cars; i++) {
    const cx = -CL / 2 - i * (CL + 0.6);
    b.box(M.white, CL, H, W, cx, H / 2 + 0.5, 0);
    b.box(M.darkMetal, CL, 0.6, W * 0.9, cx, 0.4, 0);
    b.box(M.shops, CL * 0.9, 1.0, 0.04, cx, 2.3, W / 2 + 0.01, { uv: TX.shops.userData[(i * 3) % 16] });
    b.box(M.neon, CL, 0.1, 0.04, cx, 1.4, W / 2 + 0.02, { c: livery });
    b.box(M.neon, CL, 0.05, 0.04, cx, 3.6, W / 2 + 0.02, { c: livery, ci: 0.6 });
  }
  b.box(M.glass, 0.1, 1.2, W * 0.8, 0.01, 2.6, 0);
  b.box(M.headlight, 0.08, 0.2, 0.5, 0.05, 1.3, 0.9); b.box(M.headlight, 0.08, 0.2, 0.5, 0.05, 1.3, -0.9);
  b.add(M.glow, G.plane, { p: [0.2, 1.3, 1.6], s: [5, 3, 1], c: 0xfff0d0, ci: 0.9 });
  const g = b.build(); g.userData.length = cars * (CL + 0.6);
  return g;
}

// ======================= POWER-UP / PICKUPS =======================
export function makePowerup(kind) {
  const color = kind === 'shield' ? 0x3ac8ff : kind === 'magnet' ? 0xff3b6b : 0xffd23a;
  const b = new Builder();
  b.add(M.neon, G.torus, { s: [1.1, 1.1, 1.1], c: color });
  b.add(M.glow, G.plane, { s: [2.6, 2.6, 1], c: color, ci: 0.8 });
  if (kind === 'shield') {
    b.add(M.neon, G.cyl6, { r: [Math.PI / 2, 0, 0], s: [0.55, 0.08, 0.65], c: 0xbff0ff });
    b.add(M.neon, G.cyl6, { r: [Math.PI / 2, 0, 0], s: [0.4, 0.1, 0.48], c: 0x1a80ff, ci: 0.5 });
  } else if (kind === 'magnet') {
    b.add(M.neon, new THREE.TorusGeometry(0.22, 0.07, 6, 16, Math.PI), { p: [0, 0.02, 0], r: [0, 0, Math.PI], c: 0xff3b6b });
    b.box(M.neon, 0.14, 0.2, 0.14, -0.22, 0.1, 0, { c: 0xffffff }); b.box(M.neon, 0.14, 0.2, 0.14, 0.22, 0.1, 0, { c: 0xffffff });
  } else {
    for (let i = 0; i < 2; i++) {
      b.box(M.neon, 0.34, 0.08, 0.06, -0.12, 0.1 + i * 0.26 - 0.2, 0, { r: [0, 0, 0.7], c: 0xffe066 });
      b.box(M.neon, 0.34, 0.08, 0.06, 0.12, 0.1 + i * 0.26 - 0.2, 0, { r: [0, 0, -0.7], c: 0xffe066 });
    }
  }
  const g = b.build();
  g.add(new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: TX.glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 })));
  g.children.at(-1).position.set(0, -1.15, 0); g.children.at(-1).rotation.x = -Math.PI / 2; g.children.at(-1).scale.set(2.4, 2.4, 1);
  return g;
}

// ======================= STREET PROPS =======================
export function makeLamp() {
  // at x=0 on curb, arm reaching toward -x (road)
  const b = new Builder();
  b.box(M.darkMetal, 0.14, 6.2, 0.14, 0, 3.1, 0);
  b.box(M.darkMetal, 0.3, 0.4, 0.3, 0, 0.2, 0);
  b.box(M.darkMetal, 1.9, 0.1, 0.12, -0.95, 6.1, 0);
  b.box(M.darkMetal, 0.7, 0.14, 0.3, -1.8, 6.05, 0);
  b.box(M.lamp, 0.6, 0.04, 0.22, -1.8, 5.97, 0);
  const g = b.build();
  const gb = new Builder();
  gb.add(M.glow, G.plane, { p: [-1.8, 5.85, 0.2], s: [1.5, 1.0, 1], c: 0xffffff, ci: 0.6 });
  gb.add(M.glow, G.plane, { p: [-1.8, 0.03, 0], r: [-Math.PI / 2, 0, 0], s: [5.5, 6.5, 1], c: 0xffffff, ci: 0.38 });
  gb.add(M.glow, G.plane, { p: [-1.8, 0.035, 3.6], r: [-Math.PI / 2, 0, 0], s: [0.9, 9, 1], c: 0xffffff, ci: 0.4 });
  const glow = gb.build(); g.add(glow); g.userData.glow = glow.children[0];
  return g;
}

export function makeArrowBoard() {
  const b = new Builder();
  b.box(M.darkMetal, 0.1, 2.4, 0.1, 0, 1.2, 0);
  b.box(M.darkMetal, 2.0, 1.1, 0.12, 0, 2.6, 0);
  for (let i = 0; i < 3; i++) {
    b.box(M.blinkAmber, 0.4, 0.08, 0.04, -0.55 + i * 0.5, 2.75, 0.07, { r: [0, 0, 0.6] });
    b.box(M.blinkAmber, 0.4, 0.08, 0.04, -0.55 + i * 0.5, 2.45, 0.07, { r: [0, 0, -0.6] });
  }
  b.add(M.glow, G.plane, { p: [0, 2.6, 0.2], s: [3.4, 2.2, 1], c: 0xff9a20, ci: 0.6 });
  b.add(M.glow, G.plane, { p: [0, 0.03, 2.5], r: [-Math.PI / 2, 0, 0], s: [1.4, 6, 1], c: 0xff9a20, ci: 0.4 });
  return b.build();
}

// Overpass across the road: deck at y 7.5..9.2
export function makeOverpass(rnd, accent) {
  const b = new Builder();
  b.box(M.concrete, 70, 1.4, 7, 0, 8.3, 0);
  b.box(M.concrete, 70, 0.9, 0.3, 0, 9.4, 3.35); b.box(M.concrete, 70, 0.9, 0.3, 0, 9.4, -3.35);
  for (const s of [-1, 1]) for (const z of [-2, 2]) b.box(M.concrete, 1.0, 7.6, 1.0, s * 5.6, 3.8, z);
  b.box(M.neon, 70, 0.08, 0.06, 0, 7.6, 3.52, { c: accent });
  b.box(M.neon, 70, 0.06, 0.06, 0, 9.0, 3.52, { c: accent, ci: 0.6 });
  b.add(M.signs, G.plane, { p: [0, 8.3, 3.53], s: [6, 1.5, 1], uv: TX.signs.userData.h[21] });
  b.add(M.signs, G.plane, { p: [-11, 8.3, 3.53], s: [5, 1.25, 1], uv: TX.signs.userData.h[(rnd() * 32) | 0] });
  b.add(M.signs, G.plane, { p: [11, 8.3, 3.53], s: [5, 1.25, 1], uv: TX.signs.userData.h[(rnd() * 32) | 0] });
  for (let x = -3; x <= 3; x += 3) {
    b.box(M.lamp, 0.8, 0.05, 0.3, x, 7.57, 0);
    b.add(M.glow, G.plane, { p: [x, 0.04, 0], r: [-Math.PI / 2, 0, 0], s: [4, 7, 1], c: 0xffd9a0, ci: 0.35 });
  }
  b.add(M.glow, G.plane, { p: [0, 0.035, 6], r: [-Math.PI / 2, 0, 0], s: [8, 10, 1], c: new THREE.Color(accent).getHex(), ci: 0.25 });
  for (let x = -34; x <= 34; x += 2) b.box(M.metal, 0.06, 0.8, 0.06, x, 10.2, 3.35);
  b.box(M.metal, 70, 0.06, 0.08, 0, 10.6, 3.35);
  return b.build();
}

// Tunnel ring segment (8m long), centred at z=0
export function makeTunnelSeg(accent, i) {
  const b = new Builder();
  const L = 8;
  for (const s of [-1, 1]) {
    b.add(M.tunnel, G.box, { p: [s * 7.6, 3.6, 0], s: [0.4, 7.2, L], uv: [0, 0, 2, 2] });
    b.box(M.darkMetal, 0.6, 7.2, 0.6, s * 7.3, 3.6, -L / 2 + 0.3);
    b.box(M.neon, 0.05, 0.12, L, s * 7.38, 1.0, 0, { c: accent });
    b.box(M.lamp, 0.06, 0.3, 1.2, s * 7.38, 4.2, 0);
    b.add(M.glow, G.plane, { p: [s * 6.2, 0.035, 0], r: [-Math.PI / 2, 0, 0], s: [2.2, 7, 1], c: 0xffc070, ci: 0.3 });
  }
  b.box(M.concrete, 15.6, 0.4, L, 0, 7.3, 0);
  b.box(M.darkMetal, 15.6, 0.6, 0.6, 0, 6.9, -L / 2 + 0.3);
  for (const x of [-2.3, 2.3]) {
    b.box(M.neon, 0.25, 0.05, L * 0.8, x, 7.08, 0, { c: i % 2 ? 0xffb050 : accent, ci: 0.9 });
    b.add(M.glow, G.plane, { p: [x, 0.03, 0], r: [-Math.PI / 2, 0, 0], s: [1.5, L * 1.1, 1], c: i % 2 ? 0xffb050 : accent, ci: 0.3 });
  }
  return b.build();
}

export function makeTunnelPortal(accent) {
  const b = new Builder();
  b.box(M.concrete, 40, 6, 2, 0, 10.2, 0);
  for (const s of [-1, 1]) b.box(M.concrete, 12, 14, 2, s * 13.8, 6, 0);
  b.box(M.hazard, 15.2, 0.5, 0.1, 0, 7.45, 1.02);
  b.box(M.neon, 15.2, 0.1, 0.1, 0, 7.2, 1.05, { c: accent });
  for (const s of [-1, 1]) b.box(M.neon, 0.1, 7.2, 0.1, s * 7.6, 3.6, 1.05, { c: accent });
  b.add(M.signs, G.plane, { p: [0, 9.5, 1.03], s: [8, 2, 1], uv: TX.signs.userData.h[21] });
  return b.build();
}

// ======================= BUILDINGS =======================
// Street face at local x=0 facing -x; building occupies x in [0, depth], z in [-L/2, L/2]
function facadeBox(w, h, d, offU, offV) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], null, null, [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (!dims[f]) { uv.setXY(i, 0.004, 0.996); continue; }
    uv.setXY(i, uv.getX(i) * dims[f][0] / T.FACADE_W + offU, uv.getY(i) * dims[f][1] / T.FACADE_H + offV);
  }
  return g;
}

export function makeBuilding(rnd, pal, tall, side = 1) {
  const b = new Builder();
  const F = (c) => side < 0 ? [c[2], c[1], c[0], c[3]] : c;
  const L = 9 + Math.floor(rnd() * 4) * 2.5;
  const D = 10 + rnd() * 8;
  const H = tall ? 22 + rnd() * 45 : 7 + rnd() * 12;
  const fm = M.facade[(rnd() * M.facade.length) | 0];
  const ou = Math.floor(rnd() * 8) / 8, ov = Math.floor(rnd() * 16) / 16;
  const neon = () => pal.neon[(rnd() * pal.neon.length) | 0];
  // ground floor podium
  b.add(M.concrete, G.box, { p: [D / 2, 2, 0], s: [D, 4, L] });
  b.add(fm, facadeBox(D, H - 4, L, ou, ov), { p: [D / 2, 4 + (H - 4) / 2, 0] });
  // storefront
  const shop = TX.shops.userData[(rnd() * 16) | 0];
  b.add(M.shops, G.plane, { p: [-0.02, 1.75, 0], r: [0, -Math.PI / 2, 0], s: [L * 0.86, 3.0, 1], uv: F(shop) });
  b.add(M.glow, G.plane, { p: [-1.6, 0.19, 0], r: [-Math.PI / 2, 0, 0], s: [3.2, L * 0.9, 1], c: 0xffc890, ci: 0.25 });
  // awning
  const ac = neon();
  b.box(M.darkMetal, 1.4, 0.12, L * 0.9, -0.7, 3.4, 0);
  b.box(M.neon, 0.05, 0.05, L * 0.9, -1.42, 3.36, 0, { c: ac });
  // corner neon tubes
  const tc = neon();
  if (rnd() < 0.7) for (const z of [-L / 2, L / 2]) b.box(M.neon, 0.08, H - 4, 0.08, -0.04, 4 + (H - 4) / 2, z, { c: tc });
  // horizontal bands
  if (rnd() < 0.6) { const n = 1 + (rnd() * 3) | 0; for (let i = 0; i < n; i++) { const y = 4.2 + rnd() * (H - 6); b.box(M.neon, 0.06, 0.1, L, -0.04, y, 0, { c: tc, ci: 0.8 }); } }
  // facade sign above the shop
  const hs = TX.signs.userData.h[(rnd() * 32) | 0];
  const sw = Math.min(L * 0.8, 4 + rnd() * 3);
  b.add(M.signs, G.plane, { p: [-0.06, 4.8, (rnd() - 0.5) * (L - sw) * 0.8], r: [0, -Math.PI / 2, 0], s: [sw, sw / 4, 1], uv: F(hs) });
  // blade sign sticking out over the sidewalk, facing the runner (+z)
  const bladeCount = rnd() < 0.75 ? (rnd() < 0.35 ? 2 : 1) : 0;
  for (let i = 0; i < bladeCount; i++) {
    const vs = TX.signs.userData.v[(rnd() * 15) | 0];
    const bh = 3.5 + rnd() * 3, by = 5 + rnd() * Math.max(0.1, Math.min(H - 6, 10) - bh / 2), bz = L / 2 - 1 - i * (L - 2);
    b.box(M.darkMetal, 1.5, bh + 0.2, 0.18, -0.85, by, bz);
    b.add(M.signs, G.plane, { p: [-0.85, by, bz + 0.1], s: [1.35, bh, 1], uv: F(vs) });
    b.add(M.signs, G.plane, { p: [-0.85, by, bz - 0.1], r: [0, Math.PI, 0], s: [1.35, bh, 1], uv: F(vs) });
    // wet reflection streak on sidewalk
    b.add(M.glow, G.plane, { p: [-1.2, 0.19, bz + 3], r: [-Math.PI / 2, 0, 0], s: [1.6, 8, 1], c: pal.neon[0], ci: 0.35 });
  }
  // setback tower
  if (tall && rnd() < 0.6) {
    const h2 = 6 + rnd() * 18, d2 = D * 0.7, l2 = L * 0.7;
    b.add(fm, facadeBox(d2, h2, l2, ou + 0.25, ov), { p: [D / 2 + 1, H + h2 / 2, 0] });
    b.box(M.neon, 0.08, 0.08, l2, D / 2 + 1 - d2 / 2 - 0.04, H + h2, 0, { c: tc });
  }
  // roof stuff
  b.box(M.darkMetal, D * 0.3, 1.2, L * 0.25, D * 0.6, H + 0.6, L * 0.2);
  if (rnd() < 0.5) b.add(M.metal, G.cyl, { p: [D * 0.4, H + 1.5, -L * 0.25], s: [2, 3, 2] });
  if (rnd() < 0.5) { b.box(M.metal, 0.08, 6, 0.08, D * 0.5, H + 3, 0); b.box(M.neon, 0.25, 0.25, 0.25, D * 0.5, H + 6.1, 0, { c: 0xff2020, ci: 0.8 }); }
  // roof billboard facing the runner
  if (rnd() < (tall ? 0.45 : 0.7)) {
    const bs = TX.signs.userData.h[(rnd() * 32) | 0];
    const bw = 6 + rnd() * 5, by = H + 2 + bw / 8;
    b.box(M.darkMetal, 0.12, bw / 4 + 2, 0.12, 0.5, H + (bw / 4 + 2) / 2, L / 2 - 0.5);
    b.box(M.darkMetal, bw + 0.3, bw / 4 + 0.3, 0.15, bw / 2 - 0.5, by, L / 2 - 0.6);
    b.add(M.signs, G.plane, { p: [bw / 2 - 0.5, by, L / 2 - 0.5], s: [bw, bw / 4, 1], uv: F(bs) });
  }
  const g = b.build(side < 0);
  g.userData = { L, D, H };
  return g;
}

// Far skyline layer
export function makeSkyline(seed, tall, color) {
  const tex = T.skylineTexture(seed, tall);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, color, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1400, 350), mat);
  return mesh;
}
