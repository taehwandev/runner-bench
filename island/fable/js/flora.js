// Palms, jungle canopy and boulders. Everything is placed from a fixed seed.
import * as THREE from 'three';
import { U, GLSL_COMMON, GLSL_FRAG, Builder, rng, lerp, makePropMaterial } from './common.js';
import { heightAt, slopeAt, shoreRadius, angDiff, splatCanopy, BAY_A, PLATEAU, LIGHTHOUSE, COTTAGE, BEACH_PASS } from './terrain.js';

export const JETTY_A = BAY_A + 0.13;

function nearStructures(x, z, d) {
  return Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < d || Math.hypot(x - COTTAGE.x, z - COTTAGE.z) < d;
}

function placePalms(r) {
  const palms = [];
  const jr = shoreRadius(JETTY_A), jx = Math.cos(JETTY_A) * jr, jz = Math.sin(JETTY_A) * jr;
  const far = (x, z, d) => palms.every((p) => Math.hypot(p.x - x, p.z - z) > d);
  for (const [da, s] of [[-0.40, 6.4], [-0.22, 6.0], [-0.03, 6.6], [0.24, 6.2], [0.33, 13.4], [-0.12, 13.0]]) {
    const a = BAY_A + da, rad = shoreRadius(a) - s, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    palms.push({ x, z, h: heightAt(x, z), out: new THREE.Vector2(Math.cos(a), Math.sin(a)), seaward: s < 10 ? 1 : 0.4 });
  }
  let tries = 0;
  while (palms.length < 58 && tries++ < 6000) {
    const a = r() * Math.PI * 2, s = 5.5 + r() * r() * 26;
    const nearCove = Math.exp(-Math.pow(angDiff(a, BAY_A) / 0.9, 2));
    if (r() > 0.35 + 0.65 * nearCove) continue;
    const rad = shoreRadius(a) - s, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const h = heightAt(x, z);
    if (h < 0.75 || h > 5.0 || slopeAt(x, z) > 0.3) continue;
    if (Math.hypot(x - jx, z - jz) < 4.5 || !far(x, z, 3.0)) continue;
    if (a > BEACH_PASS.a0 - 0.08 && a < BEACH_PASS.a1 + 0.08 && Math.abs(s - BEACH_PASS.inset) < 2.0) continue;
    const out = new THREE.Vector2(Math.cos(a), Math.sin(a));
    palms.push({ x, z, h, out, seaward: 1 - Math.min(1, s / 22) });
  }
  tries = 0;
  let top = 0;
  while (top < 7 && tries++ < 3000) {
    const x = PLATEAU.x + (r() - 0.5) * 50, z = PLATEAU.z + (r() - 0.5) * 50, h = heightAt(x, z);
    if (h < 20 || slopeAt(x, z) > 0.25 || nearStructures(x, z, 7.5) || !far(x, z, 4)) continue;
    const a = r() * 6.283;
    palms.push({ x, z, h, out: new THREE.Vector2(Math.cos(a), Math.sin(a)), seaward: 0.3 });
    top++;
  }
  return palms;
}

function buildPalm(P, B, F, r) {
  const H = 6.5 + r() * 5.0, phase = r() * 6.283;
  const leanAmt = (0.6 + r() * 2.6) * (0.4 + P.seaward);
  const la = Math.atan2(P.out.y, P.out.x) + (r() - 0.5) * 1.4;
  const lx = Math.cos(la) * leanAmt, lz = Math.sin(la) * leanAmt;
  const base = new THREE.Vector3(P.x, P.h - 0.25, P.z);
  const trunkAt = (u) => new THREE.Vector3(base.x + lx * Math.pow(u, 1.8), base.y + H * u, base.z + lz * Math.pow(u, 1.8));
  // trunk
  B.setMatrix(new THREE.Matrix4());
  const RINGS = 11, SIDES = 6, t0 = B.p.length / 3;
  const tone = 0.85 + r() * 0.3;
  for (let j = 0; j <= RINGS; j++) {
    const u = j / RINGS, c = trunkAt(u);
    const rad = lerp(0.34, 0.16, Math.pow(u, 0.7)) * (j === 0 ? 1.25 : 1);
    const k = (j % 2 ? 0.80 : 1.0) * tone;
    const col = [0.30 * k, 0.24 * k, 0.185 * k];
    for (let i = 0; i <= SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      B.vert(c.x + cx * rad, c.y, c.z + cz * rad, cx, 0.15, cz, col, [u * u, phase, 0, 0]);
    }
  }
  for (let j = 0; j < RINGS; j++) for (let i = 0; i < SIDES; i++) {
    const k = t0 + j * (SIDES + 1) + i;
    B.quad(k, k + 1, k + SIDES + 2, k + SIDES + 1);
  }
  const top = trunkAt(1);
  // coconuts
  for (let i = 0; i < 3; i++) {
    const a = r() * 6.283;
    B.at(top.x + Math.cos(a) * 0.3, top.y - 0.28, top.z + Math.sin(a) * 0.3);
    B.blob(0.19, 1.1, r, [0.20, 0.15, 0.07], [0.09, 0.07, 0.04], () => [1, phase, 0, 0], 6, 4, 0.05);
  }
  // fronds: three-vertex ribbons folded along the rachis
  const NF = 11 + Math.floor(r() * 4), SEG = 9;
  const g0 = 0.8 + r() * 0.35;
  for (let f = 0; f < NF; f++) {
    const rank = (f + r() * 0.6) / NF;                 // 0 young/upright .. 1 old/hanging
    const az = f * 2.39996 + r() * 0.5;
    const L = lerp(3.0, 4.6, r()) * (0.85 + 0.15 * H / 9);
    let pitch = lerp(1.15, -0.25, rank) + (r() - 0.5) * 0.2;
    const droop = lerp(1.5, 2.3, r()) + rank * 0.5;
    const W = 0.62 + r() * 0.2;
    const dx = Math.cos(az), dz = Math.sin(az), sx = -dz, sz = dx;
    const fph = r() * 6.283;
    let px = top.x, py = top.y, pz = top.z;
    const b0 = F.p.length / 3;
    const green = [lerp(0.07, 0.15, r()) * g0, lerp(0.22, 0.34, r()) * g0, lerp(0.04, 0.09, r()) * g0];
    for (let s = 0; s <= SEG; s++) {
      const v = s / SEG;
      const th = pitch - droop * Math.pow(v, 1.35);
      if (s > 0) {
        const ds = L / SEG;
        px += dx * Math.cos(th) * ds; py += Math.sin(th) * ds; pz += dz * Math.cos(th) * ds;
      }
      const w = W * Math.pow(Math.sin(Math.PI * Math.min(v * 0.93 + 0.05, 1)), 0.55);
      // local up of the ribbon (perpendicular to the rachis in the vertical plane)
      const ux = -dx * Math.sin(th), uy = Math.cos(th), uz = -dz * Math.sin(th);
      const fold = 0.42 * w;
      const aux = [1, phase, v, fph];
      for (const e of [-1, 0, 1]) {
        const ae = Math.abs(e);
        const nx = ux + sx * e * 0.55, ny = uy, nz = uz + sz * e * 0.55;
        F.vert(px + sx * w * e - ux * fold * ae, py - uy * fold * ae, pz + sz * w * e - uz * fold * ae, nx, ny, nz, green, aux, e, v);
      }
    }
    for (let s = 0; s < SEG; s++) {
      const k = b0 + s * 3;
      F.quad(k, k + 1, k + 4, k + 3); F.quad(k + 1, k + 2, k + 5, k + 4);
    }
  }
  splatCanopy(top.x, top.z, 3.2, 0.45);
}

function buildJungle(B, r) {
  let n = 0, tries = 0;
  while (n < 250 && tries++ < 9000) {
    const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 62, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const s = shoreRadius(a) - rad, h = heightAt(x, z);
    if (s < 15 || h < 2.6 || slopeAt(x, z) > 0.55 || nearStructures(x, z, 8.5)) continue;
    const big = r() < 0.3;
    const R = big ? 3.2 + r() * 1.8 : 1.6 + r() * 1.7;
    const lift = big ? 2.2 + r() * 2.0 : R * 0.35;
    const k = 0.75 + r() * 0.5, warm = r();
    const topC = [lerp(0.09, 0.20, warm) * k, lerp(0.26, 0.34, warm) * k, 0.07 * k];
    const botC = [0.025 * k, 0.07 * k, 0.03 * k];
    const ph = r() * 6.283;
    B.at(x, h + lift, z, r() * 6.283);
    B.blob(R, 0.62 + r() * 0.2, r, topC, botC, (t) => [0.25 * t, ph, 0, 4], 9, 6, 0.3);
    if (big) {
      B.at(x, h - 0.3, z);
      B.frustum(0.32, 0.2, 0, lift, 5, [0.20, 0.16, 0.12]);
    }
    splatCanopy(x, z, R * 1.25, big ? 0.8 : 0.6);
    n++;
  }
}

function buildBoulders(B, r) {
  let n = 0, tries = 0;
  while (n < 26 && tries++ < 4000) {
    const a = r() * Math.PI * 2, s = -3 + r() * 9, rad = shoreRadius(a) - s;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad, h = heightAt(x, z);
    const coveMid = Math.abs(angDiff(a, BAY_A)) < 0.45;
    if (coveMid || h > 6 || h < -1.2) continue;
    const R = 0.5 + r() * r() * 1.8, k = 0.7 + r() * 0.5;
    B.at(x, h + R * 0.15, z, r() * 6.283);
    B.blob(R, 0.6 + r() * 0.25, r, [0.36 * k, 0.32 * k, 0.28 * k], [0.12 * k, 0.11 * k, 0.10 * k], null, 7, 5, 0.22);
    n++;
  }
}

function makeFrondMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      attribute vec3 aColor; attribute vec4 aAux;
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec2 vUv;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float s = sin(uTime * 1.25 + aAux.y) * 0.6 + sin(uTime * 2.9 + aAux.y * 1.7) * 0.25 + 0.35;
        wp.xz += WIND * s * aAux.x * 0.42;
        float v = aAux.z; float v2 = v * v;
        wp.y += (sin(uTime * 2.3 + aAux.w + v * 3.0) * 0.20 + sin(uTime * 5.1 + aAux.w * 2.0 + v * 7.0) * 0.05) * v2;
        wp.xz += vec2(-WIND.y, WIND.x) * sin(uTime * 1.7 + aAux.w * 1.3) * 0.16 * v2 + WIND * (s * 0.22 * v2);
        vW = wp.xyz; vN = normal; vC = aColor; vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${GLSL_FRAG}
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec2 vUv;
      void main() {
        if (uClip > 0.5 && vW.y < -0.02) discard;
        float u = abs(vUv.x), v = vUv.y;
        // leaflets: saw-tooth gaps that open toward the edge
        float saw = fract(v * 24.0 - u * 2.2);
        if (u > 0.10 && saw < 0.10 + 0.42 * u) discard;
        if (u > 1.0 - v * v * v * 0.5) discard;
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float ndl = dot(N, uLightDir);
        float sh = terrainShadow(vW);
        float dif = max(ndl, 0.0) * 0.8 + max(-ndl, 0.0) * 0.35;
        vec3 alb = vC * mix(1.25, 0.75, u) * mix(1.0, 0.8, saw);
        alb = mix(alb, vec3(0.30, 0.30, 0.10), smoothstep(0.75, 1.0, v) * 0.35);
        vec3 amb = mix(uAmbGnd, uAmbSky, 0.65);
        vec3 col = alb * (uLightCol * dif * sh + amb + lampLight(vW, N));
        // light through the leaves when looking toward the sun
        col += alb * vec3(1.2, 1.0, 0.4) * uLightCol * pow(max(dot(-V, uLightDir), 0.0), 4.0) * 0.5 * sh;
        gl_FragColor = finish(applyFog(col, vW), 1.0);
      }`,
  });
}

export function buildFlora() {
  const r = rng(2026);
  const B = new Builder(), F = new Builder();
  for (const p of placePalms(r)) buildPalm(p, B, F, r);
  buildJungle(B, r);
  buildBoulders(B, r);
  const props = new THREE.Mesh(B.build(), makePropMaterial());
  const fronds = new THREE.Mesh(F.build(), makeFrondMaterial());
  props.frustumCulled = fronds.frustumCulled = false;
  return [props, fronds];
}
