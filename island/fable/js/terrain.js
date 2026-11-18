// Island layout, height function, terrain mesh and the height/canopy texture.
import * as THREE from 'three';
import { U, GLSL_COMMON, GLSL_FRAG, HM_WORLD, makeNoise2D, fbm2, smooth, clamp } from './common.js';

const nA = makeNoise2D(11), nB = makeNoise2D(23), nC = makeNoise2D(37), nD = makeNoise2D(53);

// Cove faces west-south-west, toward the sunset.
export const BAY_A = Math.atan2(0.49, -0.87);
export const PLATEAU = { x: 34, z: -24, r: 25 };
const pl = Math.hypot(PLATEAU.x, PLATEAU.z);
export const LIGHTHOUSE = { x: PLATEAU.x + (PLATEAU.x / pl) * 15, z: PLATEAU.z + (PLATEAU.z / pl) * 15 };
export const COTTAGE = { x: LIGHTHOUSE.x - 10.5, z: LIGHTHOUSE.z + 4.5 };
const STACKS = [
  { x: 80, z: -50, r: 5.5, h: 10 }, { x: 71, z: -66, r: 4, h: 6.5 },
  { x: 87, z: -34, r: 3.4, h: 4.6 }, { x: 60, z: -76, r: 3, h: 3.2 },
  { x: 94, z: -58, r: 2.6, h: 2.4 },
];

export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function shoreRadius(a) {
  const cx = Math.cos(a), cz = Math.sin(a);
  let R = 58 + 9 * nA(cx * 1.1 + 3.1, cz * 1.1 - 1.7) + 4 * nA(cx * 2.7 - 5.0, cz * 2.7 + 2.0);
  const da = angDiff(a, BAY_A);
  R -= 15 * Math.exp(-(da / 0.42) * (da / 0.42));
  return R;
}
const ARMS = [BAY_A - 0.66, BAY_A + 0.64].map((a) => {
  const r = shoreRadius(a) + 1.5;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, r: 7.5, h: 3.4 };
});

export function heightAt(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const s = shoreRadius(a) - r; // metres inland from the waterline
  let h;
  if (s < 0) {
    h = -22 * (1 - Math.exp(s / 300));
    if (s < -45) h -= (-s - 45) * 0.25;
  } else {
    h = 2.0 * (1 - Math.exp(-s / 26));
    const inland = smooth(9, 40, s);
    h += inland * (5.0 + 5.0 * fbm2(nB, x * 0.035, z * 0.035, 3) + 1.6 * nB(x * 0.09 + 4, z * 0.09));
    h += 0.16 * nC(x * 0.21, z * 0.21) * smooth(3, 12, s);
  }
  // Headland plateau: sheer toward the sea, a softer ramp inland.
  const dlx = x - LIGHTHOUSE.x, dlz = z - LIGHTHOUSE.z, dl2 = dlx * dlx + dlz * dlz;
  const px = x - PLATEAU.x, pz = z - PLATEAU.z;
  let pd = Math.hypot(px, pz) + 7 * nC(x * 0.045, z * 0.045) + 2.5 * nC(x * 0.13 + 9, z * 0.13);
  pd += 3.2 * Math.abs(nD(x * 0.085 + 2, z * 0.085)) - 1.2;
  pd -= 9 * Math.exp(-dl2 / 110);
  const w = 3 + 13 * smooth(2, 26, s);
  const pm = 1 - smooth(PLATEAU.r - w, PLATEAU.r + w, pd);
  let top = 23 + 2.4 * nD(x * 0.05, z * 0.05) + 0.9 * nD(x * 0.16, z * 0.16);
  const flat = Math.exp(-((x - (LIGHTHOUSE.x + COTTAGE.x) / 2) ** 2 + (z - (LIGHTHOUSE.z + COTTAGE.z) / 2) ** 2) / 170);
  top = top + (23.5 - top) * Math.min(1, flat * 1.6);
  const ledge = 1.6 * nD(x * 0.3, z * 0.3) * pm * (1 - pm) * 4;
  h = Math.max(h, top * Math.pow(pm, 0.7) - 20 * (1 - pm) + ledge);
  for (const k of STACKS) {
    const d = Math.hypot(x - k.x, z - k.z) + 1.4 * nC(x * 0.3, z * 0.3);
    const m = 1 - smooth(k.r * 0.3, k.r, d);
    h = Math.max(h, (k.h + 16) * m - 16 + 0.5 * nD(x * 0.5, z * 0.5) * m);
  }
  for (const k of ARMS) {
    const d = Math.hypot(x - k.x, z - k.z) + 2.4 * nC(x * 0.2 + 3, z * 0.2);
    const m = 1 - smooth(k.r * 0.2, k.r, d);
    h = Math.max(h, (k.h + 3) * m - 3 + 0.6 * nD(x * 0.6, z * 0.6) * m);
  }
  return h;
}

// A point on the sand, `inset` metres inland of the waterline at polar angle a.
export function beachPoint(a, inset) {
  const r = shoreRadius(a) - inset, x = Math.cos(a) * r, z = Math.sin(a) * r;
  return { x, y: Math.max(heightAt(x, z), 0.15), z };
}
// The low camera pass along the cove; palms keep clear of it.
export const BEACH_PASS = { a0: BAY_A - 0.52, a1: BAY_A + 0.36, inset: 9.5 };

export function slopeAt(x, z) {
  const e = 0.6;
  const dx = heightAt(x + e, z) - heightAt(x - e, z), dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

// Height (R) + canopy occlusion (G) texture shared by water, shadows and AO.
const HM = 512;
const hmData = new Float32Array(HM * HM * 2);
export function buildHeightField() {
  for (let j = 0; j < HM; j++) for (let i = 0; i < HM; i++) {
    const x = ((i + 0.5) / HM - 0.5) * HM_WORLD, z = ((j + 0.5) / HM - 0.5) * HM_WORLD;
    hmData[(j * HM + i) * 2] = heightAt(x, z);
  }
}
export function splatCanopy(x, z, r, amt) {
  const ci = (x / HM_WORLD + 0.5) * HM, cj = (z / HM_WORLD + 0.5) * HM, rr = (r / HM_WORLD) * HM;
  const i0 = Math.max(0, Math.floor(ci - rr * 2)), i1 = Math.min(HM - 1, Math.ceil(ci + rr * 2));
  const j0 = Math.max(0, Math.floor(cj - rr * 2)), j1 = Math.min(HM - 1, Math.ceil(cj + rr * 2));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d2 = ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2) / (rr * rr);
    const k = (j * HM + i) * 2 + 1;
    hmData[k] = Math.min(1, hmData[k] + amt * Math.exp(-d2 * 1.6));
  }
}
export function finalizeHeightTexture() {
  const half = new Uint16Array(HM * HM * 4);
  for (let i = 0; i < HM * HM; i++) {
    half[i * 4] = THREE.DataUtils.toHalfFloat(clamp(hmData[i * 2], -60, 60));
    half[i * 4 + 1] = THREE.DataUtils.toHalfFloat(hmData[i * 2 + 1]);
    half[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const tex = new THREE.DataTexture(half, HM, HM, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  U.uHeight.value = tex;
}

export function buildTerrain() {
  const N = 300, half = 140, step = (half * 2) / N, W = N + 1;
  const hs = new Float32Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) hs[j * W + i] = heightAt(-half + i * step, -half + j * step);
  const pos = new Float32Array(W * W * 3), nor = new Float32Array(W * W * 3);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    pos[k * 3] = -half + i * step; pos[k * 3 + 1] = hs[k]; pos[k * 3 + 2] = -half + j * step;
    const hl = hs[j * W + Math.max(i - 1, 0)], hr = hs[j * W + Math.min(i + 1, N)];
    const hd = hs[Math.max(j - 1, 0) * W + i], hu = hs[Math.min(j + 1, N) * W + i];
    const nx = (hl - hr) / (2 * step), nz = (hd - hu) / (2 * step);
    const l = Math.hypot(nx, 1, nz);
    nor[k * 3] = nx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = nz / l;
  }
  const idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    if (Math.max(hs[a], hs[b], hs[c], hs[d]) < -9) continue;
    // split along the diagonal with the smaller height difference
    if (Math.abs(hs[a] - hs[d]) < Math.abs(hs[b] - hs[c])) idx.push(a, c, d, a, d, b);
    else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vN = normal;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${GLSL_FRAG}
      varying vec3 vW; varying vec3 vN;
      void main() {
        if (uClip > 0.5 && vW.y < -0.02) discard;
        vec3 N = normalize(vN);
        vec4 t1 = texture2D(uNoise, vW.xz * 0.021);
        vec4 t2 = texture2D(uNoise, vW.xz * 0.115 + 0.3);
        vec4 t3 = texture2D(uNoise, vW.xz * 0.53 + 0.6);
        float slope = 1.0 - N.y;
        // bump from the slope channels
        vec2 bump = (t2.ba - 0.5) * 0.35 + (t3.ba - 0.5) * 0.45;
        float rmask = smoothstep(0.20, 0.42, slope + (t3.g - 0.5) * 0.16);
        N = normalize(N + vec3(bump.x, 0.0, bump.y) * mix(0.25, 1.0, rmask));
        vec3 V = normalize(cameraPosition - vW);

        vec3 sand = mix(vec3(0.62, 0.50, 0.33), vec3(0.80, 0.70, 0.50), t2.r * 0.7 + t3.r * 0.3);
        float wet = smoothstep(0.62, 0.06, vW.y + (t2.g - 0.5) * 0.25);
        sand *= mix(1.0, 0.50, wet);
        vec3 grass = mix(vec3(0.045, 0.13, 0.03), vec3(0.20, 0.30, 0.07), t1.g * 0.6 + t3.r * 0.4);
        grass = mix(grass, vec3(0.30, 0.30, 0.10), smoothstep(0.55, 0.9, t2.r) * 0.5);
        float strata = texture2D(uNoise, vec2(0.37 + dot(vW.xz, vec2(0.0016, 0.0021)), vW.y * 0.034 + (t1.r - 0.5) * 0.035)).g;
        float crack = texture2D(uNoise, vec2(dot(vW.xz, vec2(0.071, 0.053)), vW.y * 0.012 + 0.2)).r;
        vec3 rock = mix(vec3(0.20, 0.17, 0.145), vec3(0.36, 0.31, 0.26), smoothstep(0.15, 0.85, strata));
        rock *= mix(0.72, 1.06, smoothstep(0.30, 0.62, crack * 0.6 + t3.g * 0.4));
        rock = mix(rock, rock * vec3(1.0, 0.82, 0.66), t1.r);
        rock *= mix(0.55, 1.0, smoothstep(0.0, 2.2, vW.y + t2.r)); // tide-darkened base
        float gmask = smoothstep(1.5, 3.0, vW.y + (t2.r - 0.5) * 1.6) * smoothstep(0.45, 0.25, slope);
        vec3 alb = mix(sand, grass, gmask);
        alb = mix(alb, rock, rmask);

        float sh = terrainShadow(vW + vec3(0.0, 0.15, 0.0));
        float ao = 1.0 - 0.6 * canopy(vW.xz);
        float dif = max(dot(N, uLightDir), 0.0);
        vec3 amb = mix(uAmbGnd, uAmbSky, N.y * 0.5 + 0.5) * ao;
        vec3 col = alb * (uLightCol * dif * sh * mix(1.0, ao, 0.6) + amb + lampLight(vW, N));
        // wet sand sheen picks up the sky
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        col += wet * (1.0 - rmask) * fr * skyBase(R) * 0.55;
        gl_FragColor = finish(applyFog(col, vW), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}
