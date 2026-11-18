// Lighthouse, keeper's cottage, jetty, rowboat, light beams and glow sprites.
import * as THREE from 'three';
import { U, GLSL_COMMON, GLSL_FRAG, Builder, rng, makePropMaterial } from './common.js';
import { heightAt, shoreRadius, LIGHTHOUSE, COTTAGE } from './terrain.js';
import { JETTY_A } from './flora.js';

const WHITE = [0.80, 0.78, 0.73], RED = [0.55, 0.075, 0.05], DARK = [0.07, 0.08, 0.09];
const WARM = [1.0, 0.72, 0.36];

function buildLighthouse(B, glows) {
  const gy = heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z) - 0.4;
  const toCottage = Math.atan2(COTTAGE.z - LIGHTHOUSE.z, COTTAGE.x - LIGHTHOUSE.x);
  B.at(LIGHTHOUSE.x, gy, LIGHTHOUSE.z);
  B.frustum(3.4, 3.15, 0, 1.3, 20, [0.42, 0.40, 0.37], undefined, true);
  const rad = (y) => 2.7 - ((y - 1.3) / 14) * 0.95;
  const bands = [[1.3, 4.4, WHITE], [4.4, 7.0, RED], [7.0, 10.0, WHITE], [10.0, 12.4, RED], [12.4, 15.3, WHITE]];
  for (const [y0, y1, c] of bands) B.frustum(rad(y0), rad(y1), y0, y1, 24, c);
  B.frustum(rad(15.3), 2.75, 15.3, 15.8, 24, [0.16, 0.16, 0.17]);   // corbel
  B.frustum(2.75, 2.75, 15.8, 16.0, 24, DARK, undefined, true, true); // gallery deck
  B.frustum(2.62, 2.62, 16.92, 17.0, 24, DARK);                      // hand rail
  B.frustum(2.62, 2.62, 16.45, 16.5, 24, DARK);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    B.box(0.07, 1.0, 0.07, DARK, undefined, Math.cos(a) * 2.62, 16.5, Math.sin(a) * 2.62);
  }
  B.frustum(1.45, 1.45, 16.0, 16.5, 16, WHITE);                      // lantern base
  B.frustum(1.3, 1.3, 16.5, 18.6, 16, [1.0, 0.80, 0.45], [0, 0, 3.2, 2]); // glass
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    B.box(0.09, 2.1, 0.09, DARK, undefined, Math.cos(a) * 1.33, 17.55, Math.sin(a) * 1.33);
  }
  B.frustum(1.7, 1.6, 18.6, 18.8, 16, DARK, undefined, false, true);
  B.frustum(1.6, 0.14, 18.8, 20.2, 16, [0.30, 0.06, 0.05]);          // roof
  B.at(LIGHTHOUSE.x, gy + 20.4, LIGHTHOUSE.z);
  B.blob(0.24, 1.0, rng(5), DARK, DARK, null, 6, 4, 0);
  // door + tower windows
  const door = (a, y, w, h, col, aux) => {
    const r = rad(Math.max(y, 1.3)) + 0.02;
    B.at(LIGHTHOUSE.x + Math.cos(a) * r, gy + y, LIGHTHOUSE.z + Math.sin(a) * r, -a + Math.PI / 2);
    B.box(w, h, 0.14, col, aux);
  };
  door(toCottage, 2.3, 1.0, 2.0, [0.16, 0.10, 0.06]);
  [[toCottage + 0.5, 6.0], [toCottage - 1.4, 8.6], [toCottage + 2.6, 11.2], [toCottage - 2.9, 5.2]].forEach(([a, y]) => {
    door(a, y, 0.42, 0.75, WARM, [0, 0, 1.6, 1]);
    const r = rad(y) + 0.3;
    glows.push({ p: [LIGHTHOUSE.x + Math.cos(a) * r, gy + y, LIGHTHOUSE.z + Math.sin(a) * r], size: 1.3, kind: 1, col: WARM });
  });
  const lamp = new THREE.Vector3(LIGHTHOUSE.x, gy + 17.55, LIGHTHOUSE.z);
  glows.push({ p: lamp.toArray(), size: 6.5, kind: 0, col: [1.0, 0.86, 0.6] });
  return lamp;
}

function buildCottage(B, glows) {
  const gy = heightAt(COTTAGE.x, COTTAGE.z) - 0.3;
  const ry = 0.5, L = 6.4, Wd = 4.4, Hw = 2.9;
  const M = new THREE.Matrix4().makeRotationY(ry); M.setPosition(COTTAGE.x, gy, COTTAGE.z);
  B.setMatrix(M);
  B.box(L + 0.3, 0.5, Wd + 0.3, [0.36, 0.34, 0.32], undefined, 0, 0.1, 0);
  B.box(L, Hw, Wd, WHITE, undefined, 0, 0.3 + Hw / 2, 0);
  // gabled roof
  const y0 = 0.3 + Hw, y1 = y0 + 1.7, ox = L / 2 + 0.35, oz = Wd / 2 + 0.4, roof = [0.42, 0.15, 0.09];
  const sl = 1.7 / oz;
  for (const s of [-1, 1]) {
    const n = [0, 1, s * sl];
    const a = B.vert(-ox, y0 - 0.15, s * oz, ...n, roof, [0, 0, 0, 0]), b = B.vert(ox, y0 - 0.15, s * oz, ...n, roof, [0, 0, 0, 0]);
    const c = B.vert(ox, y1, 0, ...n, roof, [0, 0, 0, 0]), d = B.vert(-ox, y1, 0, ...n, roof, [0, 0, 0, 0]);
    B.quad(a, b, c, d);
  }
  for (const s of [-1, 1]) {
    const x = s * L / 2;
    const a = B.vert(x, y0, -Wd / 2, s, 0, 0, WHITE, [0, 0, 0, 0]), b = B.vert(x, y0, Wd / 2, s, 0, 0, WHITE, [0, 0, 0, 0]);
    const c = B.vert(x, y1 - 0.12, 0, s, 0, 0, WHITE, [0, 0, 0, 0]);
    B.tri(a, b, c);
  }
  B.box(0.7, 1.6, 0.7, [0.40, 0.36, 0.33], undefined, L / 2 - 1.3, y1 - 0.1, 0.5);
  const tmp = new THREE.Vector3();
  const win = (x, y, z, w, h, alongX) => {
    B.box(alongX ? w : 0.12, h, alongX ? 0.12 : w, WARM, [0, 0, 1.5, 1], x, y, z);
    const k = 0.35;
    tmp.set(x + (alongX ? 0 : Math.sign(x) * k), y, z + (alongX ? Math.sign(z) * k : 0)).applyMatrix4(M);
    glows.push({ p: tmp.toArray(), size: 2.3, kind: 1, col: WARM });
  };
  for (const s of [-1, 1]) {
    win(-1.7, 1.85, s * Wd / 2, 1.0, 0.95, true);
    win(1.6, 1.85, s * Wd / 2, 1.0, 0.95, true);
  }
  win(-L / 2, 1.85, 0, 1.0, 0.95, false);
  B.box(0.95, 1.95, 0.12, [0.15, 0.10, 0.06], undefined, 0, 1.3, Wd / 2 + 0.02);
}

function buildJetty(B, glows) {
  const R = shoreRadius(JETTY_A), dx = Math.cos(JETTY_A), dz = Math.sin(JETTY_A);
  const r0 = R - 2.5, len = 21, deckY = 0.95, r = rng(31);
  const ry = -JETTY_A;                       // local +x runs out to sea
  const M = new THREE.Matrix4().makeRotationY(ry); M.setPosition(dx * r0, 0, dz * r0);
  B.setMatrix(M);
  const planks = 30, pw = len / planks;
  for (let i = 0; i < planks; i++) {
    const k = 0.75 + r() * 0.4;
    B.box(pw - 0.05, 0.09, 1.75 + (r() - 0.5) * 0.12, [0.26 * k, 0.20 * k, 0.145 * k], undefined, (i + 0.5) * pw, deckY + (r() - 0.5) * 0.02, 0);
  }
  for (const s of [-1, 1]) B.box(len, 0.16, 0.14, [0.15, 0.115, 0.085], undefined, len / 2, deckY - 0.13, s * 0.7);
  for (let x = 2.2; x <= len; x += 3.1) for (const s of [-1, 1]) {
    const last = x + 3.1 > len;
    const topY = last && s > 0 ? 2.7 : deckY + 0.35 + r() * 0.2;
    B.box(0.2, topY + 4, 0.2, [0.17, 0.13, 0.10], undefined, x, (topY - 4) / 2, s * 0.86);
    if (last && s > 0) {
      B.box(0.5, 0.06, 0.06, DARK, undefined, x - 0.22, topY - 0.08, s * 0.86);
      B.box(0.26, 0.34, 0.26, WARM, [0, 0, 2.6, 3], x - 0.45, topY - 0.35, s * 0.86);
      B.box(0.34, 0.05, 0.34, DARK, undefined, x - 0.45, topY - 0.16, s * 0.86);
      const lp = new THREE.Vector3(x - 0.45, topY - 0.35, s * 0.86).applyMatrix4(M);
      glows.push({ p: lp.toArray(), size: 2.6, kind: 2, col: WARM });
    }
  }
  // mooring point for the boat (beside the outer third of the jetty)
  const moor = new THREE.Vector3(len - 6.5, 0, -2.4).applyMatrix4(M);
  return { moor, heading: ry + 0.12 };
}

function buildBoat() {
  const B = new Builder();
  const ST = 8, Lh = 2.1, hull = [0.66, 0.70, 0.70], trim = [0.45, 0.10, 0.07], inner = [0.30, 0.24, 0.18];
  const ring = [];
  for (let i = 0; i <= ST; i++) {
    const t = i / ST, x = (t * 2 - 1) * Lh;
    const w = 0.78 * Math.pow(Math.sin(Math.PI * (t * 0.86 + 0.07)), 0.62);
    const sheer = 0.42 + 0.22 * Math.pow(Math.abs(t * 2 - 1), 2.2);
    const pts = [[-w, sheer], [-w * 0.82, 0.08], [0, -0.16], [w * 0.82, 0.08], [w, sheer]];
    ring.push(pts.map(([z, y], j) => B.vert(x, y, z, 0, j === 2 ? -1 : -0.3, Math.sign(z) || 0, j === 0 || j === 4 ? trim : hull, [0, 0, 0, 0])));
  }
  for (let i = 0; i < ST; i++) for (let j = 0; j < 4; j++) B.quad(ring[i][j], ring[i + 1][j], ring[i + 1][j + 1], ring[i][j + 1]);
  B.box(0.28, 0.05, 1.3, inner, undefined, -0.7, 0.30, 0);
  B.box(0.28, 0.05, 1.2, inner, undefined, 0.75, 0.30, 0);
  B.box(3.4, 0.04, 1.1, inner, undefined, 0, 0.02, 0);
  const mesh = new THREE.Mesh(B.build(), makePropMaterial());
  mesh.frustumCulled = false;
  return mesh;
}

function buildBeams() {
  const SEG = 48, LEN = 320, R1 = 15, pos = [], nor = [], along = [], idx = [];
  for (const dir of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(dir * 1.2, c * 0.5, s * 0.5, dir * LEN, c * R1, s * R1);
      nor.push(0, c, s, 0, c, s); along.push(0, 1);
    }
    for (let i = 0; i < SEG; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 3, k, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: /* glsl */ `
      attribute float aAlong;
      varying vec3 vW; varying vec3 vN; varying float vAlong;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vAlong = aAlong;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${GLSL_FRAG}
      varying vec3 vW; varying vec3 vN; varying float vAlong;
      void main() {
        if (uClip > 0.5 && vW.y < 0.0) discard;
        vec3 V = normalize(cameraPosition - vW);
        float edge = pow(abs(dot(normalize(vN), V)), 2.6);
        float dust = 1.0;
        float I = uBeamOn * edge * pow(1.0 - vAlong, 1.8) * (0.085 + 0.30 * exp(-vAlong * 16.0)) * dust;
        vec3 c = uLampCol * I;
        gl_FragColor = finish(c, 0.0);
        if (uLinearOut < 0.5) gl_FragColor.rgb = max(gl_FragColor.rgb - 0.004, 0.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  return mesh;
}

// Camera-facing additive sprites. kind 0 lamp, 1 window, 2 jetty lantern.
function buildGlows(glows) {
  const pos = [], corner = [], par = [], col = [], idx = [];
  glows.forEach((gl, i) => {
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(...gl.p); corner.push(cx, cy); par.push(gl.size, gl.kind); col.push(...gl.col);
    }
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('aPar', new THREE.Float32BufferAttribute(par, 2));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: /* glsl */ `
      uniform float uLampOn; uniform float uWindowOn; uniform float uLanternOn; uniform float uFlare; uniform float uTime;
      attribute vec2 aCorner; attribute vec2 aPar; attribute vec3 aCol;
      varying vec2 vC; varying vec3 vCol; varying float vKind; varying float vFl; varying vec3 vW;
      void main() {
        float kind = aPar.y;
        float on = kind < 0.5 ? uLampOn : (kind < 1.5 ? uWindowOn : uLanternOn);
        float flick = 1.0 + (kind > 0.5 ? 0.06 * sin(uTime * 9.0 + position.x * 3.0) * sin(uTime * 5.3 + position.z) : 0.0);
        float fl = kind < 0.5 ? uFlare : 0.0;
        float size = aPar.x * (1.0 + fl * 2.6) * flick;
        vec4 mv = viewMatrix * vec4(position, 1.0);
        mv.xyz *= (length(mv.xyz) - (kind < 0.5 ? 3.0 : 0.6)) / length(mv.xyz); // pull toward the eye
        mv.xy += aCorner * size;
        vC = aCorner; vKind = kind; vFl = fl; vW = position;
        vCol = aCol * on * (kind < 0.5 ? (0.55 + fl * 2.6) : 0.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${GLSL_FRAG}
      varying vec2 vC; varying vec3 vCol; varying float vKind; varying float vFl; varying vec3 vW;
      void main() {
        if (uClip > 0.5 && vW.y < 0.0) discard;
        float r2 = dot(vC, vC);
        if (r2 > 1.0) discard;
        float r = sqrt(r2);
        float g = exp(-r2 * 26.0) * 1.6 + exp(-r2 * 5.0) * 0.28 + pow(1.0 - r, 3.0) * 0.05;
        if (vKind < 0.5) {
          float streak = exp(-abs(vC.y) * 46.0) * exp(-abs(vC.x) * 2.6) + exp(-abs(vC.x) * 60.0) * exp(-abs(vC.y) * 5.0) * 0.5;
          g += streak * (0.10 + vFl * 0.9);
        }
        g *= 1.0 - smoothstep(0.75, 1.0, r);
        float fogT = exp(-length(vW - cameraPosition) * uFogDen * 0.6);
        gl_FragColor = finish(vCol * g * fogT, 0.0);
        if (uLinearOut < 0.5) gl_FragColor.rgb = max(gl_FragColor.rgb - 0.004, 0.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 30;
  return mesh;
}

export function buildStructures() {
  const B = new Builder(), glows = [];
  const lamp = buildLighthouse(B, glows);
  buildCottage(B, glows);
  const jetty = buildJetty(B, glows);
  const solid = new THREE.Mesh(B.build(), makePropMaterial());
  solid.frustumCulled = false;
  const boat = buildBoat();
  const beams = buildBeams();
  beams.position.copy(lamp);
  const glow = buildGlows(glows);
  // deterministic poses driven only by scene time
  function update(t, beamAngle) {
    beams.rotation.set(0, -beamAngle, 0);
    boat.position.set(jetty.moor.x, 0.06 + 0.045 * Math.sin(t * 1.15) + 0.02 * Math.sin(t * 2.3 + 1), jetty.moor.z);
    boat.rotation.set(0.05 * Math.sin(t * 0.9 + 0.5), jetty.heading + 0.05 * Math.sin(t * 0.31), 0.035 * Math.sin(t * 1.4));
  }
  return { meshes: [solid, boat, beams, glow], lamp, update };
}
