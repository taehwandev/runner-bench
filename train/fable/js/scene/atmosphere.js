// Dusk atmosphere: one sky model shared by the sky dome, the fog on every
// material, and the lights. The fog colour depends on the view direction so
// distant towers melt into the exact sky colour behind them.

import * as THREE from 'three';
import { GLOW_DIR, MOON_DIR } from '../config.js';

const v3 = (a) => `vec3(${a.map((n) => n.toFixed(4)).join(',')})`;

/** Uniforms shared by every material in the scene. */
export const atmoUniforms = {
  uNight: { value: 0 }, // 0 = dusk, 1 = night
  uHaze: { value: 1 }, // fog strength multiplier
  uTime: { value: 0 },
};

export const NOISE_GLSL = /* glsl */ `
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash11(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

export const ATMO_GLSL = /* glsl */ `
uniform float uNight;
uniform float uHaze;
const vec3 ATMO_GLOW = normalize(${v3(GLOW_DIR)});
const vec3 ATMO_MOON = normalize(${v3(MOON_DIR)});

vec3 atmoSkyGlow(vec3 d, float glow){
  float h = d.y;
  vec3 zen = mix(vec3(0.012, 0.022, 0.072), vec3(0.004, 0.007, 0.022), uNight);
  vec3 mid = mix(vec3(0.034, 0.062, 0.150), vec3(0.012, 0.020, 0.052), uNight);
  vec3 hor = mix(vec3(0.085, 0.120, 0.205), vec3(0.030, 0.040, 0.080), uNight);
  vec3 c = mix(hor, mid, smoothstep(-0.02, 0.22, h));
  c = mix(c, zen, smoothstep(0.15, 0.85, h));
  float toward = dot(normalize(d.xz + 1e-5), normalize(ATMO_GLOW.xz)) * 0.5 + 0.5;
  c += vec3(1.05, 0.40, 0.18) * pow(toward, 5.0) * exp(-abs(h) * 9.0) * mix(1.0, 0.10, uNight) * glow;
  c += vec3(0.42, 0.17, 0.26) * pow(toward, 2.0) * exp(-max(h, 0.0) * 3.5) * mix(0.42, 0.05, uNight) * glow;
  float moon = max(dot(normalize(d), ATMO_MOON), 0.0);
  c += vec3(0.30, 0.38, 0.55) * pow(moon, 14.0) * (0.10 + 0.22 * uNight);
  return c;
}

vec3 atmoSky(vec3 d){ return atmoSkyGlow(d, 1.0); }

vec3 atmoFogColor(vec3 d){
  vec3 hd = normalize(vec3(d.x, max(d.y, 0.0) * 0.35 + 0.035, d.z));
  vec3 c = atmoSkyGlow(hd, 0.36); // fog only borrows a little of the afterglow
  float below = smoothstep(0.0, -0.55, d.y);
  return mix(c, c * 0.62 + vec3(0.035, 0.022, 0.026) * (1.0 - 0.5 * uNight), below);
}

// Analytic height fog: thick over the buried streets, thin above the roofs.
float atmoFogAmount(float camY, vec3 dir, float dist){
  const float SCALE = 52.0;
  float dy = dir.y * dist / SCALE;
  float k = abs(dy) < 1e-3 ? 1.0 : (1.0 - exp(-dy)) / dy;
  float tau = dist * (0.00019 + 0.0026 * exp(-max(camY, -20.0) / SCALE) * k);
  return 1.0 - exp(-tau * uHaze);
}

vec3 atmoApply(vec3 col, vec3 viewPos){
  float dist = length(viewPos);
  vec3 dir = normalize((vec4(viewPos, 0.0) * viewMatrix).xyz);
  float f = atmoFogAmount(cameraPosition.y, dir, dist);
  return mix(col, atmoFogColor(dir), f);
}

// For additive lights: how much of the light survives the fog.
float atmoTransmit(vec3 viewPos){
  float dist = length(viewPos);
  vec3 dir = normalize((vec4(viewPos, 0.0) * viewMatrix).xyz);
  return 1.0 - atmoFogAmount(cameraPosition.y, dir, dist);
}
`;

/** Route every built-in material's fog through the shared atmosphere. */
export function installAtmosphere() {
  THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying vec3 vAtmoView;\n#endif';
  THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vAtmoView = mvPosition.xyz;\n#endif';
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG\n varying vec3 vAtmoView;\n${ATMO_GLSL}\n#endif`;
  THREE.ShaderChunk.fog_fragment =
    '#ifdef USE_FOG\n gl_FragColor.rgb = atmoApply(gl_FragColor.rgb, vAtmoView);\n#endif';
  // Built-in materials have no hook of their own, so the shared uniforms are
  // attached for all of them here.
  THREE.Material.prototype.onBeforeCompile = function attachAtmosphere(shader) {
    Object.assign(shader.uniforms, atmoUniforms);
  };
}

const SKY_FRAGMENT = /* glsl */ `
varying vec3 vDir;
uniform float uTime;
${NOISE_GLSL}
${ATMO_GLSL}
void main(){
  vec3 d = normalize(vDir);
  vec3 col = atmoSky(d);
  float up = smoothstep(0.02, 0.30, d.y);

  // moon: a pale disc with a wide halo
  float md = dot(d, ATMO_MOON);
  float disc = smoothstep(0.99925, 0.99962, md);
  float mare = 0.75 + 0.25 * vnoise(d.xy * 190.0);
  vec3 moon = vec3(0.92, 0.95, 1.0) * disc * mare * (1.6 + 1.8 * uNight);
  moon += vec3(0.42, 0.52, 0.75) * (pow(max(md, 0.0), 900.0) * 0.55 + pow(max(md, 0.0), 90.0) * 0.14);

  // stars in the gaps
  vec2 sp = d.xz / (d.y + 0.35) * 46.0;
  vec2 cell = floor(sp);
  float sr = hash21(cell);
  vec2 so = vec2(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5;
  float star = smoothstep(0.09, 0.0, length(fract(sp) - 0.5 - so * 0.7)) * step(0.83, sr);
  float twinkle = 0.7 + 0.3 * sin(uTime * (2.0 + sr * 5.0) + sr * 40.0);
  vec3 stars = vec3(0.75, 0.85, 1.0) * star * twinkle * smoothstep(0.12, 0.6, d.y) * (0.25 + 0.75 * uNight);

  // heavy snow cloud with torn gaps, lit from below by the afterglow
  vec2 cp = d.xz / (d.y + 0.16) * 1.35 + vec2(uTime * 0.004, uTime * 0.0016);
  float cl = fbm(cp + 0.6 * fbm(cp * 1.9));
  float cover = smoothstep(0.34, 0.66, cl) * up;
  float toward = dot(normalize(d.xz + 1e-5), normalize(ATMO_GLOW.xz)) * 0.5 + 0.5;
  vec3 cloud = mix(vec3(0.050, 0.060, 0.115), vec3(0.015, 0.020, 0.045), uNight);
  cloud += vec3(0.75, 0.30, 0.22) * pow(toward, 3.0) * exp(-d.y * 4.5) * (1.0 - cover * 0.5) * mix(0.55, 0.06, uNight);
  cloud += vec3(0.20, 0.26, 0.40) * pow(max(md, 0.0), 22.0) * (0.25 + 0.5 * uNight);

  col += (moon + stars) * (1.0 - cover * 0.94);
  col = mix(col, cloud, cover * 0.86);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Sky dome that follows the camera. Returns { mesh, update(camera) }. */
export function createSky() {
  const material = new THREE.ShaderMaterial({
    uniforms: atmoUniforms,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(5200, 32, 16), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return {
    mesh,
    update(camera) {
      mesh.position.copy(camera.position);
    },
  };
}

/**
 * Sky light, the low warm afterglow, and one movable practical light used for
 * the station lamps and the tunnel ribs. Returns handles to drive them.
 */
export function createLights() {
  const group = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x6d83c4, 0x1b2030, 1);
  const glow = new THREE.DirectionalLight(0xffb690, 1);
  glow.position.set(GLOW_DIR[0], GLOW_DIR[1] + 0.12, GLOW_DIR[2]).multiplyScalar(100);
  const moon = new THREE.DirectionalLight(0x8fa8e0, 1);
  moon.position.set(MOON_DIR[0], MOON_DIR[1], MOON_DIR[2]).multiplyScalar(100);
  const practical = new THREE.PointLight(0xffc58a, 0, 60, 1.6);
  group.add(hemi, glow, glow.target, moon, moon.target, practical);
  return {
    group,
    practical,
    /** night: 0 = dusk, 1 = full night. */
    set(night) {
      atmoUniforms.uNight.value = night;
      hemi.intensity = 2.3 - 1.5 * night;
      glow.intensity = 1.15 - 1.05 * night;
      moon.intensity = 0.25 + 0.75 * night;
    },
  };
}
