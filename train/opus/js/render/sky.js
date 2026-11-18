// Dusk sky dome: gradient, sunset glow, drifting cloud banks, stars and moon.
// Its horizon uses the same fog colour as the scene so the city melts into it.

import * as THREE from 'three';
import { ATMOS_GLSL, atmosUniforms } from './atmosShader.js';

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const frag = /* glsl */ `
${ATMOS_GLSL}
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uStars;
uniform vec3 uMoonDir;
uniform float uGlowAmt;
varying vec3 vDir;

float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.07; a *= 0.5; } return s; }

void main() {
  vec3 d = normalize(vDir);
  float el = d.y;
  float s = max(dot(d, uSunDir), 0.0);
  vec3 sky = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.55, el), 0.55));
  sky += uSunGlow * (pow(s, 10.0) * 0.9 + pow(s, 3.0) * 0.25) * (1.0 - smoothstep(0.0, 0.45, el));

  // Cloud banks: lit warm from below toward the sunset, cold elsewhere.
  vec2 uv = d.xz / max(el + 0.18, 0.05) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
  float c = fbm(uv * 1.3);
  c = smoothstep(0.48, 0.82, c) * smoothstep(0.02, 0.16, el) * (1.0 - smoothstep(0.45, 0.85, el));
  vec3 cloudCol = mix(uZenith * 0.7 + uFogColor * 0.25, uSunGlow * 0.9 + uHorizon * 0.4, pow(s, 3.0) * uGlowAmt);
  sky = mix(sky, cloudCol, c * 0.75);

  // Stars
  vec3 sp = d * 420.0;
  vec3 cell = floor(sp);
  float h = hash13(cell);
  float star = step(0.9965, h) * smoothstep(0.35, 0.05, length(fract(sp) - 0.5));
  star *= 0.6 + 0.4 * sin(uTime * (2.0 + h * 5.0) + h * 40.0);
  sky += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.06, 0.3, el) * (1.0 - c) * 1.6;

  // Moon with halo
  float m = dot(d, uMoonDir);
  float disc = smoothstep(0.99974, 0.99982, m);
  float crater = 0.85 + 0.15 * vnoise(d.xy * 900.0);
  sky += vec3(1.0, 0.96, 0.88) * disc * crater * (0.5 + 1.1 * uStars) * (1.0 - c * 0.8);
  sky += vec3(0.55, 0.6, 0.8) * pow(max(m, 0.0), 900.0) * 0.5 * uStars;
  sky += vec3(0.35, 0.4, 0.6) * pow(max(m, 0.0), 60.0) * 0.08 * uStars;

  // Melt into the shared fog colour at the horizon line.
  sky = mix(atmosFogColor(d), sky, smoothstep(-0.03, 0.14, el));
  gl_FragColor = vec4(sky, 1.0);
}`;

export function createSky() {
  const uniforms = {
    ...atmosUniforms,
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uStars: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(0, 0.2, -1) },
    uGlowAmt: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, fragmentShader: frag,
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;

  function update(atm, camera) {
    mesh.position.copy(camera.position);
    uniforms.uZenith.value.setRGB(...atm.zenith);
    uniforms.uHorizon.value.setRGB(...atm.horizon);
    uniforms.uStars.value = atm.stars;
    uniforms.uMoonDir.value.set(...atm.moonDir);
    uniforms.uGlowAmt.value = atm.sunGlowAmt;
  }
  return { object: mesh, update, dispose: () => { mesh.geometry.dispose(); material.dispose(); } };
}

// Static dusk environment for reflections on steel (armour plates, rails).
export function createEnvironment(renderer) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 sunDir = normalize(vec3(-0.88, 0.05, -0.47));
        float s = max(dot(d, sunDir), 0.0);
        vec3 zenith = vec3(0.05, 0.07, 0.16);
        vec3 horizon = mix(vec3(0.28, 0.3, 0.42), vec3(0.9, 0.48, 0.3), pow(s, 3.0));
        vec3 col = mix(horizon, zenith, smoothstep(0.0, 0.6, d.y));
        col = mix(col, vec3(0.06, 0.06, 0.08), smoothstep(0.0, -0.25, d.y));
        // a few warm city-light panels low on the horizon
        float band = smoothstep(0.02, -0.02, d.y) * smoothstep(-0.3, -0.05, d.y);
        col += vec3(0.5, 0.3, 0.12) * band;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  mat.dispose();
  return rt.texture;
}
