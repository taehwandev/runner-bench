// Falling snow. Flake positions are a closed-form function of time, wrapped
// in a box that follows the camera. Each flake is drawn as a short streak
// between where it was one shutter interval ago and where it is now, so a
// fast camera turns the snowfall into streaks without any stored state.

import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import { LAYOUT } from '../core/layout.js';
import { SEED, STATION, WIND } from '../config.js';
import { ATMO_GLSL, atmoUniforms } from './atmosphere.js';

const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uPrevTime;
uniform mat4 uPrevViewProj;
uniform vec3 uBox;
uniform vec2 uRes;
uniform float uProjScale;
uniform float uFlake;
uniform vec3 uHeadPos;
uniform vec3 uHeadDir;
uniform vec3 uLampPos;
uniform vec3 uLampColor;
uniform vec3 uDryMin[2];
uniform vec3 uDryMax[2];
varying vec2 vQ;
varying vec2 vShape; // half length, radius (px)
varying vec4 vColor;
${ATMO_GLSL}

vec3 flakeAt(float t){
  float fall = mix(1.5, 3.3, aSeed.w);
  vec3 p = aSeed.xyz * uBox;
  p.y -= fall * t;
  p.x += ${WIND[0].toFixed(2)} * t + sin(t * 0.7 + aSeed.w * 40.0) * 0.55;
  p.z += ${WIND[2].toFixed(2)} * t + cos(t * 0.5 + aSeed.w * 31.0) * 0.55;
  return p;
}

void main(){
  vec3 b1 = flakeAt(uTime);
  vec3 b0 = flakeAt(uPrevTime);
  vec3 rel = mod(b1 - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5;
  vec3 w1 = cameraPosition + rel;
  vec3 w0 = w1 - (b1 - b0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(w1, 1.0);
  vec4 c0 = uPrevViewProj * vec4(w0, 1.0);

  float dry = 0.0;
  for (int i = 0; i < 2; i++) {
    vec3 inside = step(uDryMin[i], w1) * step(w1, uDryMax[i]);
    dry = max(dry, inside.x * inside.y * inside.z);
  }
  if (c1.w < 0.35 || c0.w < 0.35 || dry > 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec2 p1 = c1.xy / c1.w * uRes * 0.5;
  vec2 p0 = c0.xy / c0.w * uRes * 0.5;
  vec2 d = p1 - p0;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  float px = uRes.y / 1000.0;
  len = min(len, 70.0 * px);
  float dist = c1.w;
  float size = uFlake * (0.6 + 0.8 * fract(aSeed.w * 7.31));
  float raw = size * uProjScale / dist;
  float rad = clamp(raw, 0.85 * px, 22.0 * px);
  float halfLen = len * 0.5;
  vec2 centre = p1 - dir * halfLen;
  vec2 q = vec2(position.x * (halfLen + rad), position.y * rad);
  vec2 ndc = (centre + dir * q.x + vec2(-dir.y, dir.x) * q.y) / (uRes * 0.5);
  gl_Position = vec4(ndc * c1.w, c1.z, c1.w);
  vQ = q;
  vShape = vec2(halfLen, rad);

  // light: cold sky, the headlight cone, and one warm practical lamp
  vec3 light = mix(vec3(0.50, 0.58, 0.80), vec3(0.16, 0.21, 0.34), uNight);
  vec3 L = w1 - uHeadPos;
  float dl = length(L);
  float cone = smoothstep(0.86, 0.985, dot(L / dl, uHeadDir));
  light += vec3(1.0, 0.88, 0.68) * cone * 150.0 / (dl * dl + 80.0);
  vec3 lp = w1 - uLampPos;
  light += uLampColor / (dot(lp, lp) + 30.0);

  float alpha = clamp(raw / (0.85 * px), 0.15, 1.0);          // sub-pixel flakes fade instead of shimmering
  alpha *= (2.0 * rad) / (2.0 * rad + len);                    // a streak spreads the same light
  alpha *= smoothstep(0.5, 3.0, dist);                         // no flake smeared across the lens
  alpha *= 1.0 - smoothstep(uBox.x * 0.36, uBox.x * 0.5, dist);
  alpha *= 0.55 + 0.45 * smoothstep(22.0 * px, 6.0 * px, raw); // near flakes are soft bokeh
  vec3 dirW = normalize(w1 - cameraPosition);
  alpha *= 1.0 - atmoFogAmount(cameraPosition.y, dirW, dist) * 0.8;
  vColor = vec4(light, alpha);
}
`;

const FRAG = /* glsl */ `
varying vec2 vQ;
varying vec2 vShape;
varying vec4 vColor;
void main(){
  float d = length(vec2(max(abs(vQ.x) - vShape.x, 0.0), vQ.y)) / vShape.y;
  float a = (1.0 - smoothstep(0.25, 1.0, d)) * vColor.a;
  gl_FragColor = vec4(vColor.rgb * a, 1.0);
}
`;

const LAYERS = [
  { count: 2200, box: [46, 34, 46], flake: 0.034 },
  { count: 4200, box: [130, 80, 130], flake: 0.06 },
];

function dryVolumes() {
  const b = LAYOUT.block;
  const st = LAYOUT.station;
  const x0 = st.side * (STATION.edge + STATION.canopySetback);
  const x1 = st.side * (STATION.edge + STATION.width + 0.5);
  return {
    min: [
      new THREE.Vector3(-b.halfWidth, 0, b.zFar),
      new THREE.Vector3(Math.min(x0, x1), st.floorY - 1, -(st.toS - 10)),
    ],
    max: [
      new THREE.Vector3(b.halfWidth, b.height, b.zNear),
      new THREE.Vector3(Math.max(x0, x1), st.floorY + 5.0, -(st.fromS + 16)),
    ],
  };
}

function buildLayer(layer, shared, rng) {
  const seeds = new Float32Array(layer.count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
  const quad = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = layer.count;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uBox: { value: new THREE.Vector3(...layer.box) },
      uFlake: { value: layer.flake },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  return mesh;
}

/**
 * Create the snowfall.
 * update({ time, prevTime, prevViewProj, width, height, fovDeg, lampPos, lampColor })
 */
export function createSnow(headPos, headDir) {
  const rng = makeRng(SEED + 409);
  const dry = dryVolumes();
  const shared = {
    ...atmoUniforms,
    uPrevTime: { value: 0 },
    uPrevViewProj: { value: new THREE.Matrix4() },
    uRes: { value: new THREE.Vector2(1080, 1920) },
    uProjScale: { value: 1000 },
    uHeadPos: headPos,
    uHeadDir: headDir,
    uLampPos: { value: new THREE.Vector3() },
    uLampColor: { value: new THREE.Vector3() },
    uDryMin: { value: dry.min },
    uDryMax: { value: dry.max },
  };
  const group = new THREE.Group();
  for (const layer of LAYERS) group.add(buildLayer(layer, shared, rng));
  return {
    group,
    update(f) {
      shared.uPrevTime.value = f.prevTime;
      shared.uPrevViewProj.value.copy(f.prevViewProj);
      shared.uRes.value.set(f.width, f.height);
      shared.uProjScale.value = f.height / (2 * Math.tan((f.fovDeg * Math.PI) / 360));
      shared.uLampPos.value.copy(f.lampPos);
      shared.uLampColor.value.copy(f.lampColor);
    },
  };
}
