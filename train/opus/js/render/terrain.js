// Snow-buried streets, the quay, the frozen bay and the far mountains.

import * as THREE from 'three';
import { ATMOS_GLSL, atmosUniforms, patchMaterial } from './atmosShader.js';
import { track, SHORE, BRIDGE, CITY } from '../core/landmarks.js';
import { mulberry32 } from '../core/rng.js';

const NOISE = /* glsl */ `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}`;

const surfVert = /* glsl */ `
varying vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const groundFrag = /* glsl */ `
${ATMOS_GLSL}
${NOISE}
uniform vec3 uAmbSky;
uniform float uCityGlow;
uniform float uBlock;
uniform float uStreet;
varying vec3 vWP;
void main() {
  vec2 p = vWP.xz;
  float sx = abs(fract(p.x / uBlock) - 0.5) * uBlock;
  float sz = abs(fract(p.y / uBlock) - 0.5) * uBlock;
  float ds = min(sx, sz);
  float street = 1.0 - smoothstep(uStreet * 0.5 - 1.5, uStreet * 0.5 + 1.5, ds);
  float n = vnoise(p * 0.08) * 0.6 + vnoise(p * 0.5) * 0.4;
  vec3 snow = vec3(0.78, 0.83, 0.94) * (0.85 + 0.15 * n);
  vec3 col = snow * uAmbSky * 0.85;
  col = mix(col, col * vec3(0.72, 0.7, 0.72), street * 0.55);
  float along = sx < sz ? p.y : p.x;
  float lampPool = pow(0.5 + 0.5 * cos(along / 34.0 * 6.2831), 6.0);
  col += vec3(1.0, 0.5, 0.2) * uCityGlow * (street * 0.18 + lampPool * exp(-ds * ds / 30.0) * 0.55);
  gl_FragColor = vec4(applyAtmos(col, vWP), 1.0);
}`;

const iceFrag = /* glsl */ `
${ATMOS_GLSL}
${NOISE}
uniform vec3 uAmbSky;
varying vec3 vWP;
void main() {
  vec2 p = vWP.xz;
  float n = vnoise(p * 0.02) * 0.6 + vnoise(p * 0.11) * 0.4;
  float crack = smoothstep(0.035, 0.0, abs(vnoise(p * 0.045) - 0.5)) * 0.6;
  float drift = smoothstep(0.55, 0.75, vnoise(p * 0.012 + 3.0));
  vec3 ice = mix(vec3(0.16, 0.2, 0.28), vec3(0.62, 0.68, 0.8), drift) * (0.8 + 0.4 * n);
  ice = mix(ice, vec3(0.05, 0.07, 0.1), crack);
  vec3 v = normalize(vWP - cameraPosition);
  float fres = pow(1.0 - abs(v.y), 4.0);
  vec3 refl = atmosFogColor(reflect(v, vec3(0.0, 1.0, 0.0)));
  vec3 col = ice * uAmbSky * 1.3 + refl * fres * 0.5 * (1.0 - drift);
  gl_FragColor = vec4(applyAtmos(col, vWP), 1.0);
}`;

function quad(corners) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(corners.flat()), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

const ridgeFrag = /* glsl */ `
${ATMOS_GLSL}
uniform float uShade;
varying vec3 vWP;
varying float vH;
void main() {
  vec3 dir = normalize(vWP - cameraPosition);
  vec3 base = atmosFogColor(dir);
  float cap = smoothstep(0.55, 0.95, vH);
  gl_FragColor = vec4(base * mix(uShade, uShade + 0.35, cap), 1.0);
}`;

const ridgeVert = /* glsl */ `
attribute float aH;
varying vec3 vWP;
varying float vH;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vH = aH;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// Jagged ridge lines beyond the bay, shaded from the fog colour so they read
// as layered silhouettes however far away they are.
function ridge(seed, radius, maxH, shade) {
  const rng = mulberry32(seed);
  const end = track.pointAt(BRIDGE.end);
  const cx = end.x, cz = end.z;
  const pos = [];
  const hs = [];
  const idx = [];
  const N = 160;
  let h = maxH * 0.5;
  for (let i = 0; i <= N; i++) {
    const a = end.h - 1.4 + (2.8 * i) / N;
    const r = radius + Math.sin(i * 0.37 + seed) * radius * 0.08;
    h = Math.max(maxH * 0.15, Math.min(maxH, h + (rng() - 0.5) * maxH * 0.35));
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    pos.push(x, -12, z, x, h, z);
    hs.push(0, 1);
    if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(hs), 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...atmosUniforms, uShade: { value: shade } },
    vertexShader: ridgeVert, fragmentShader: ridgeFrag, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

export function createTerrain() {
  const p = track.pointAt(SHORE);
  const T = [Math.cos(p.h), 0, Math.sin(p.h)];
  const S = [-T[2], 0, T[0]];
  const at = (a, b, y) => [p.x + S[0] * a + T[0] * b, y, p.z + S[2] * a + T[2] * b];
  const uniforms = {
    ...atmosUniforms,
    uAmbSky: { value: new THREE.Color() },
    uCityGlow: { value: 0.6 },
    uBlock: { value: CITY.block },
    uStreet: { value: CITY.street },
  };
  const groundMat = new THREE.ShaderMaterial({ uniforms, vertexShader: surfVert, fragmentShader: groundFrag, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(quad([at(-5000, 0, 0), at(-5000, -6000, 0), at(5000, -6000, 0), at(5000, 0, 0)]), groundMat);

  const iceMat = new THREE.ShaderMaterial({ uniforms, vertexShader: surfVert, fragmentShader: iceFrag, side: THREE.DoubleSide });
  const W = BRIDGE.waterY;
  const ice = new THREE.Mesh(quad([at(-6000, -200, W), at(-6000, 6000, W), at(6000, 6000, W), at(6000, -200, W)]), iceMat);

  const quayMat = patchMaterial(new THREE.MeshLambertMaterial({ color: 0x4a4e58 }), { snow: 0.9 });
  const quay = new THREE.Mesh(quad([at(-5000, 0, W), at(5000, 0, W), at(5000, 0, 0.2), at(-5000, 0, 0.2)]), quayMat);
  quay.material.side = THREE.DoubleSide;

  const group = new THREE.Group();
  group.add(ground, ice, quay, ridge(5, 1900, 260, 0.62), ridge(8, 2600, 420, 0.8));
  function update(atm) {
    uniforms.uAmbSky.value.setRGB(...atm.ambSky);
    uniforms.uCityGlow.value = atm.cityGlow;
  }
  return { object: group, update };
}
