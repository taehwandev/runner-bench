// Soft additive light points (street lamps, beacons, bridge lamps, station lamps).
// Size is in world metres; optional per-point blink.

import * as THREE from 'three';
import { ATMOS_GLSL, atmosUniforms } from './atmosShader.js';

const vert = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aBlink;   // 0 = steady, otherwise phase (radians)
uniform float uPxScale;
uniform float uTime;
varying vec3 vColor;
varying vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mv = viewMatrix * wp;
  float blink = aBlink == 0.0 ? 1.0 : smoothstep(0.55, 0.95, sin(uTime * 2.4 + aBlink));
  vColor = aColor * blink;
  gl_PointSize = clamp(aSize * uPxScale / -mv.z, 1.5, 160.0);
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
${ATMOS_GLSL}
varying vec3 vColor;
varying vec3 vWP;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 18.0);
  float halo = exp(-r2 * 3.5) * 0.35;
  float fog = atmosFogFactor(vWP);
  gl_FragColor = vec4(vColor * (core * 2.4 + halo) * (1.0 - fog * 0.92), 1.0);
}`;

export function createGlowPoints(points, { pxScale = 900 } = {}) {
  const n = points.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const blink = new Float32Array(n);
  points.forEach((p, i) => {
    pos.set(p.p, i * 3);
    col.set(p.color, i * 3);
    size[i] = p.size;
    blink[i] = p.blink || 0;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aBlink', new THREE.BufferAttribute(blink, 1));
  const uniforms = { ...atmosUniforms, uPxScale: { value: pxScale } };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, fragmentShader: frag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const object = new THREE.Points(geo, material);
  object.frustumCulled = false;
  return {
    object,
    setPixelScale: (s) => { uniforms.uPxScale.value = s; },
    dispose: () => { geo.dispose(); material.dispose(); },
  };
}
