// Snowfall and steam. Both are pure functions of time t (no per-frame state),
// so seek(t) always reproduces the exact same flakes and puffs.

import * as THREE from 'three';
import { mulberry32, hashInt } from '../core/rng.js';
import { ATMOS_GLSL, atmosUniforms } from './atmosShader.js';

// ------------------------------------------------------------------ snow
const snowVert = /* glsl */ `
attribute vec3 aSeed;
attribute float aRand;
uniform float uTime;
uniform float uBox;
uniform float uFall;
uniform float uSize;
uniform float uPxScale;
uniform vec3 uHeadPos;
uniform vec3 uHeadDir;
uniform vec3 uTunC;      // tunnel centre (deck level)
uniform vec3 uTunAxis;   // unit tangent of the straight bore
uniform vec3 uTunSize;   // half length, half width, height
varying float vAlpha;
varying float vLit;
varying vec3 vWP;
void main() {
  float t = uTime;
  vec3 p = aSeed * uBox;
  p.y -= uFall * (0.7 + 0.6 * aRand) * t;
  p.x += 1.8 * t + sin(t * (0.5 + aRand) + aRand * 30.0) * 0.8;
  p.z += 0.6 * t + cos(t * (0.4 + aRand * 0.7) + aRand * 17.0) * 0.8;
  vec3 origin = cameraPosition - uBox * 0.5;
  p = mod(p - origin, uBox) + origin;
  vWP = p;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  gl_PointSize = clamp(uSize * (0.55 + 0.9 * aRand) * uPxScale / max(dist, 0.1), 1.0, 40.0);
  vAlpha = smoothstep(0.35, 1.4, dist) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(p - cameraPosition)));
  // no snowfall inside the tunnel bore (it still falls beyond the portals)
  vec3 r = p - uTunC;
  vec3 inside = step(abs(vec3(dot(r, uTunAxis), dot(r, vec3(-uTunAxis.z, 0.0, uTunAxis.x)), r.y - uTunSize.z * 0.5 + 1.5)),
                     vec3(uTunSize.x, uTunSize.y, uTunSize.z * 0.5 + 1.5));
  vAlpha *= 1.0 - inside.x * inside.y * inside.z;
  vec3 hp = p - uHeadPos;
  float hd = length(hp);
  float cone = smoothstep(0.94, 0.99, dot(hp / max(hd, 1e-3), uHeadDir));
  vLit = cone / (1.0 + hd * hd * 0.006);
  gl_Position = projectionMatrix * mv;
}`;

const snowFrag = /* glsl */ `
${ATMOS_GLSL}
uniform vec3 uColor;
varying float vAlpha;
varying float vLit;
varying vec3 vWP;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float a = (1.0 - r2) * (1.0 - r2) * vAlpha;
  vec3 col = uColor + vec3(1.0, 0.9, 0.75) * vLit * 1.4;
  col = mix(col, atmosFogColor(normalize(vWP - cameraPosition)), atmosFogFactor(vWP) * 0.7);
  gl_FragColor = vec4(col, a * 0.85);
}`;

export function createSnow({ count, box, size, fall, seed, tunnel }) {
  const rng = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seeds[i * 3] = rng(); seeds[i * 3 + 1] = rng(); seeds[i * 3 + 2] = rng();
    rand[i] = rng();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  const uniforms = {
    ...atmosUniforms,
    uBox: { value: box }, uFall: { value: fall }, uSize: { value: size }, uPxScale: { value: 1000 },
    uHeadPos: { value: new THREE.Vector3() }, uHeadDir: { value: new THREE.Vector3(0, 0, 1) },
    uColor: { value: new THREE.Color() },
    uTunC: { value: new THREE.Vector3(...tunnel.center) },
    uTunAxis: { value: new THREE.Vector3(...tunnel.axis) },
    uTunSize: { value: new THREE.Vector3(...tunnel.size) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: snowVert, fragmentShader: snowFrag, transparent: true, depthWrite: false,
  });
  const object = new THREE.Points(geo, material);
  object.frustumCulled = false;
  object.renderOrder = 5;
  return {
    object,
    update(atm, head) {
      uniforms.uColor.value.setRGB(...atm.ambSky).multiplyScalar(1.5).addScalar(0.05);
      uniforms.uHeadPos.value.copy(head.pos);
      uniforms.uHeadDir.value.copy(head.dir);
    },
    setPixelScale: (s) => { uniforms.uPxScale.value = s; },
    dispose: () => { geo.dispose(); material.dispose(); },
  };
}

// ------------------------------------------------------------------ steam
const steamVert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute float aSpin;
uniform float uPxScale;
varying float vAlpha;
varying float vSpin;
varying vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mv = viewMatrix * wp;
  float dist = -mv.z;
  gl_PointSize = clamp(aSize * uPxScale / max(dist, 0.1), 1.0, 320.0);
  vAlpha = aAlpha * smoothstep(1.0, 4.0, dist);
  vSpin = aSpin;
  gl_Position = projectionMatrix * mv;
}`;

const steamFrag = /* glsl */ `
${ATMOS_GLSL}
uniform vec3 uColor;
varying float vAlpha;
varying float vSpin;
varying vec3 vWP;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float c = cos(vSpin), s = sin(vSpin);
  q = mat2(c, -s, s, c) * q;
  float r = length(q);
  if (r > 1.0) discard;
  float billow = vn(q * 2.6 + vSpin * 7.0) * 0.6 + vn(q * 5.3 - vSpin * 3.0) * 0.4;
  float a = smoothstep(1.0, 0.15, r + (billow - 0.5) * 0.55) * vAlpha;
  vec3 col = uColor * (0.75 + 0.5 * billow);
  col = mix(col, atmosFogColor(normalize(vWP - cameraPosition)), atmosFogFactor(vWP));
  gl_FragColor = vec4(col, a);
}`;

// emitter(tb) -> { pos:[x,y,z], vel:[x,y,z], strength } at birth time tb (may be < 0).
export function createSteam({ rate, life, emitter, rise = 3, growth = 1.6, size0 = 1.2, seed = 1, dragK = 3.5, opacity = 0.75 }) {
  const max = Math.ceil(rate * life) + 2;
  const pos = new Float32Array(max * 3);
  const sizes = new Float32Array(max);
  const alphas = new Float32Array(max);
  const spins = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geo.setAttribute('aSpin', new THREE.BufferAttribute(spins, 1));
  const uniforms = { ...atmosUniforms, uPxScale: { value: 1000 }, uColor: { value: new THREE.Color() } };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: steamVert, fragmentShader: steamFrag, transparent: true, depthWrite: false,
  });
  const object = new THREE.Points(geo, material);
  object.frustumCulled = false;
  object.renderOrder = 4;

  function update(t, atm) {
    uniforms.uColor.value.setRGB(...atm.ambSky).multiplyScalar(1.9).add(new THREE.Color(0.06, 0.055, 0.05));
    const k1 = Math.floor(t * rate);
    const k0 = Math.ceil((t - life) * rate);
    let n = 0;
    for (let k = k1; k >= k0 && n < max; k--) {     // newest first
      const tb = k / rate;
      const age = t - tb;
      const e = emitter(tb);
      if (e.strength <= 0.001) continue;
      const h1 = hashInt(k * 3 + seed), h2 = hashInt(k * 3 + 1 + seed * 7), h3 = hashInt(k * 3 + 2 + seed * 13);
      const drag = (1 - Math.exp(-age * dragK)) / dragK;
      const lift = rise * (1 - Math.exp(-age * 0.9)) / 0.9 + 0.35 * age;
      pos[n * 3] = e.pos[0] + e.vel[0] * drag + (1.4 + (h1 - 0.5) * 1.6) * age;
      pos[n * 3 + 1] = e.pos[1] + e.vel[1] * drag + lift * (0.8 + 0.4 * h2);
      pos[n * 3 + 2] = e.pos[2] + e.vel[2] * drag + (0.5 + (h3 - 0.5) * 1.6) * age;
      sizes[n] = (size0 + growth * age) * (0.75 + 0.5 * h2);
      const fadeIn = Math.min(1, age * 5);
      alphas[n] = e.strength * fadeIn * Math.pow(Math.max(0, 1 - age / life), 1.6) * opacity;
      spins[n] = h3 * 6.283 + age * (h1 - 0.5) * 0.6;
      n++;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSpin.needsUpdate = true;
  }
  return {
    object, update,
    setPixelScale: (s) => { uniforms.uPxScale.value = s; },
    dispose: () => { geo.dispose(); material.dispose(); },
  };
}
