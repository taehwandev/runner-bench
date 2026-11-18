// Instanced tower blocks with procedural lit windows, roof snow and drifts.
// One draw call for the whole skyline.

import * as THREE from 'three';
import { ATMOS_GLSL, atmosUniforms } from './atmosShader.js';
import { createGlowPoints } from './glowPoints.js';

const vert = /* glsl */ `
attribute vec4 aStyle;   // seed, lit fraction, floor height, column width
attribute vec3 aTint;
varying vec3 vWP;
varying vec3 vN;
varying vec2 vFac;
varying vec4 vStyle;
varying vec3 vTint;
varying float vFace;
void main() {
  mat4 im = instanceMatrix;
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  float sx = length(im[0].xyz), sy = length(im[1].xyz), sz = length(im[2].xyz);
  vN = normalize(mat3(modelMatrix) * (mat3(im) * (normal / vec3(sx, sy, sz))));
  float u = abs(normal.x) > 0.5 ? position.z * sz * sign(normal.x) : position.x * sx * -sign(normal.z);
  vFac = vec2(u + 0.5 * (abs(normal.x) > 0.5 ? sz : sx), position.y * sy);
  vFace = normal.x * 3.0 + normal.z * 7.0;
  vWP = wp.xyz;
  vStyle = aStyle;
  vTint = aTint;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const frag = /* glsl */ `
${ATMOS_GLSL}
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uSunLight;
uniform float uCityGlow;
uniform float uWindowGain;
varying vec3 vWP;
varying vec3 vN;
varying vec2 vFac;
varying vec4 vStyle;
varying vec3 vTint;
varying float vFace;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec3 n = normalize(vN);
  float seed = vStyle.x, litFrac = vStyle.y, floorH = vStyle.z, colW = vStyle.w;
  vec3 light = mix(uAmbGround, uAmbSky, 0.5 + 0.5 * n.y);
  light += uSunLight * max(dot(n, normalize(uSunDir + vec3(0.0, 0.3, 0.0))), 0.0) * 0.55;
  light += vec3(1.0, 0.55, 0.25) * uCityGlow * 0.35 * exp(-max(vWP.y, 0.0) / 30.0) * (1.0 - max(n.y, 0.0));
  vec3 snowCol = vec3(0.80, 0.85, 0.95);
  vec3 col;
  vec3 emit = vec3(0.0);

  if (n.y > 0.5) {
    col = snowCol * (0.82 + 0.18 * vnoise(vWP.xz * 0.35)) * light * 1.15;
  } else {
    vec2 cell = vec2(vFac.x / colW, vWP.y / floorH);
    vec2 id = floor(cell);
    vec2 f = fract(cell);
    vec2 fw = fwidth(cell);
    float wx = smoothstep(0.17 - fw.x, 0.17 + fw.x, f.x) * smoothstep(0.83 + fw.x, 0.83 - fw.x, f.x);
    float wy = smoothstep(0.24 - fw.y, 0.24 + fw.y, f.y) * smoothstep(0.80 + fw.y, 0.80 - fw.y, f.y);
    float win = wx * wy;
    float floorHash = hash12(vec2(id.y, seed * 17.0 + vFace));
    float h = hash13(vec3(id, seed * 31.0 + vFace * 5.0));
    float lit = step(h, litFrac * (0.25 + 1.5 * floorHash * floorHash));
    float h2 = hash13(vec3(id.yx, seed + 7.0));
    vec3 lc = mix(vec3(1.0, 0.56, 0.26), vec3(1.0, 0.8, 0.52), h2);
    lc = mix(lc, vec3(0.62, 0.8, 1.0), step(0.9, h2));
    lc *= (0.35 + 0.95 * h2) * uWindowGain;
    float lod = smoothstep(0.3, 0.85, max(fw.x, fw.y));
    float avgWin = 0.36;
    float w = mix(win, avgWin, lod);
    // grime streaks and frost
    float streak = vnoise(vec2(vFac.x * 0.7, vWP.y * 0.03) + seed);
    vec3 wall = vTint * (0.75 + 0.35 * streak) * light;
    vec3 glass = (vTint * 0.25 + vec3(0.05, 0.07, 0.1)) * light + uFogColor * 0.08;
    col = mix(wall, glass, w);
    emit = lc * mix(lit * win, litFrac * 0.55 * avgWin, lod);
    // snow ledges every few floors and drifts banked against the base
    float ledgeEvery = floorH * (6.0 + floor(fract(seed) * 6.0));
    float lf = fract(vWP.y / ledgeEvery);
    float lfw = fwidth(vWP.y / ledgeEvery);
    float ledge = (1.0 - smoothstep(0.0, 0.035 + lfw, lf)) * (1.0 - lod) * step(0.3, fract(seed * 3.7));
    float drift = 1.4 + 3.2 * vnoise(vWP.xz * 0.06 + seed);
    float base = 1.0 - smoothstep(drift - 0.4, drift + 0.4, vWP.y);
    col = mix(col, snowCol * light, max(ledge * 0.85, base));
    emit *= (1.0 - base) * (1.0 - ledge);
  }
  col += emit;
  gl_FragColor = vec4(applyAtmos(col, vWP), 1.0);
}`;

export function createCity(layout) {
  const { boxes, lamps, beacons } = layout;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const styleAttr = new Float32Array(boxes.length * 4);
  const tintAttr = new Float32Array(boxes.length * 3);
  const uniforms = {
    ...atmosUniforms,
    uAmbSky: { value: new THREE.Color() },
    uAmbGround: { value: new THREE.Color() },
    uSunLight: { value: new THREE.Color() },
    uCityGlow: { value: 0.6 },
    uWindowGain: { value: 1.15 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag });
  const mesh = new THREE.InstancedMesh(geo, material, boxes.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  boxes.forEach((b, i) => {
    q.setFromAxisAngle(up, b.rot);
    m.compose(new THREE.Vector3(b.x, b.y0, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    mesh.setMatrixAt(i, m);
    styleAttr.set(b.style, i * 4);
    c.setHex(b.tint);
    tintAttr.set([c.r, c.g, c.b], i * 3);
  });
  geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(styleAttr, 4));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tintAttr, 3));
  mesh.frustumCulled = false;

  const group = new THREE.Group();
  group.add(mesh);
  const lampPts = createGlowPoints(lamps.map((p) => ({ p, color: [1.0, 0.55, 0.22], size: 2.2 })));
  const beaconPts = createGlowPoints(beacons.map((b) => ({ p: b.p, color: b.color, size: 5, blink: b.phase })));
  group.add(lampPts.object, beaconPts.object);

  function update(atm) {
    uniforms.uAmbSky.value.setRGB(...atm.ambSky);
    uniforms.uAmbGround.value.setRGB(...atm.ambGround);
    uniforms.uSunLight.value.setRGB(...atm.sunLight).multiplyScalar(atm.sunGlowAmt);
    uniforms.uCityGlow.value = atm.cityGlow;
  }
  return {
    object: group,
    update,
    glow: [lampPts, beaconPts],
    dispose() { geo.dispose(); material.dispose(); lampPts.dispose(); beaconPts.dispose(); },
  };
}
