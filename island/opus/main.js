import * as THREE from 'three';

/* =====================================================================
   Evening Isle — a deterministic 60 s time-lapse.
   Everything visible is a pure function of the timeline time `t`.
   ===================================================================== */

const DURATION = 60;
const SHOTS = [
  { name: 'Approach', start: 0 },
  { name: 'Orbit', start: 12 },
  { name: 'Shoreline', start: 25 },
  { name: 'Lighthouse', start: 37 },
  { name: 'Night', start: 48 },
];
const shotIndexAt = (t) => { let i = 0; for (let k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k].start) i = k; return i; };

/* ---------------- math / deterministic noise ---------------- */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(ix, iz) { let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash2(ix, iz), hash2(ix + 1, iz), ux), lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), ux), uz);
}
function fbm(x, z) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 4; i++) { s += a * vnoise(x, z); const nx = x * 1.6 + z * 1.2 + 17.1, nz = -x * 1.2 + z * 1.6 + 3.7; x = nx; z = nz; a *= 0.5; }
  return s / 0.9375;
}

/* ---------------- island height field ---------------- */
const EXTENT = 80; // terrain covers [-80, 80]^2
function heightAt(x, z) {
  const n1 = fbm(x * 0.035 + 11.3, z * 0.035 - 4.1), n2 = fbm(x * 0.035 - 7.7, z * 0.035 + 9.2);
  const wx = x + (n1 - 0.5) * 14, wz = z + (n2 - 0.5) * 14;
  const body = 1 - Math.hypot((wx - 3) / 34, (wz - 2) / 26);
  const head = 1 - Math.hypot((wx + 22) / 13, (wz + 3) / 11);
  const land = Math.max(body, head);
  let h = -7.5 + 7.3 * smooth(-0.55, 0.0, land);
  h += 1.7 * smooth(-0.02, 0.17, land);
  const hills = 5.5 * fbm(x * 0.06 + 2, z * 0.06 + 5) + 8 * Math.exp(-((x - 6) ** 2 + (z + 2) ** 2) / 240) + 4 * Math.exp(-((x + 8) ** 2 + (z + 10) ** 2) / 180);
  h += hills * smooth(0.12, 0.6, body);
  const edge = head + 0.11 * (fbm(x * 0.3, z * 0.3) - 0.5) + 0.04 * (vnoise(x * 1.1, z * 1.1) - 0.5);
  const c = smooth(-0.04, 0.02, edge) * 0.42 + smooth(0.035, 0.11, edge) * 0.58;
  const plateau = 15.5 + 2.0 * fbm(x * 0.1 + 5, z * 0.1) + 2.5 * smooth(0.3, 0.9, head);
  h = Math.max(h, lerp(h, plateau, c));
  return h;
}
function slopeAt(x, z) { const e = 0.6; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }
const LH = new THREE.Vector3(-27, 0, -3);
LH.y = heightAt(LH.x, LH.z) - 0.2;
// sea-ward shoreline along the south beach (used by the beach shot)
function shoreZ(x) { let z = 0; while (z < 60 && heightAt(x, z) > 0.05) z += 0.25; return z; }

/* ---------------- colour script (sRGB keys, linear interpolation) ---------------- */
const KT = [0, 12, 24, 31, 35, 41, 49, 60];
const KEYS = {
  sunEl: [18, 13.5, 7, 2, -1.5, -6, -11, -16],
  zen: ['#2b62a6', '#2e5c9c', '#35508a', '#2f3f78', '#262f66', '#151b48', '#090e2c', '#04071a'],
  hor: ['#9cc2de', '#d2cdb8', '#f2b47e', '#f78a58', '#d0687a', '#5c4a7a', '#2a3466', '#18224a'],
  glow: ['#ffe6bb', '#ffd08e', '#ff9e52', '#ff6e36', '#ff5638', '#a8485e', '#4a3a72', '#1a1e46'],
  glowAmt: [0.35, 0.5, 0.85, 1.25, 1.15, 0.75, 0.35, 0.15],
  sun: ['#fff2dc', '#ffe1b0', '#ffb66c', '#ff8a3c', '#ff6a2c', '#ff4a24', '#ff4a24', '#ff4a24'],
  sunI: [3.2, 2.9, 2.3, 1.3, 0.25, 0, 0, 0],
  hemiSky: ['#a5c4e2', '#b0bcd0', '#c0a8a0', '#b08890', '#8a6f90', '#4f5288', '#2c3766', '#1e2a52'],
  hemiGround: ['#2e5560', '#3a5050', '#4a4038', '#4a3236', '#3a2838', '#1c1a2a', '#0c0e1c', '#080a14'],
  hemiI: [1.35, 1.3, 1.2, 1.1, 1.05, 1.0, 0.95, 0.9],
  cLit: ['#fffaf2', '#fff0d8', '#ffc690', '#ff9a68', '#f07a86', '#8a5a8c', '#363a6a', '#232a52'],
  cDark: ['#a2b2c8', '#a8a4b0', '#8c7488', '#6c4c72', '#4c3a68', '#2a2a52', '#141832', '#0b0e22'],
  deep: ['#08405e', '#0b3c58', '#123852', '#162e4c', '#162644', '#0f1a36', '#070d22', '#040818'],
  shallow: ['#1fb5ae', '#2aa8a0', '#348c88', '#2f6670', '#2a5468', '#1c3a50', '#0e1e32', '#08121f'],
  foam: ['#f4f6f2', '#f6efe2', '#ffe0c2', '#f6bfa0', '#d8a0a4', '#7a7090', '#3a4062', '#2a3050'],
  isl: ['#34502e', '#3c4c2c', '#4a4028', '#3e2c26', '#2c2228', '#16161e', '#0a0c14', '#06080e'],
  belt: ['#000000', '#000000', '#000000', '#3a2030', '#7a4058', '#4a3058', '#000000', '#000000'],
  fogD: [0.0017, 0.0017, 0.0019, 0.0021, 0.0022, 0.0021, 0.0019, 0.0018],
  night: [0, 0, 0, 0, 0.05, 0.35, 0.85, 1],
  exposure: [0.95, 0.95, 1.0, 1.05, 1.1, 1.2, 1.35, 1.45],
  cover: [0.5, 0.48, 0.47, 0.47, 0.47, 0.47, 0.47, 0.48],
};
const KC = {}; // parsed colours
for (const k in KEYS) if (typeof KEYS[k][0] === 'string') KC[k] = KEYS[k].map((h) => new THREE.Color(h));
function keyIndex(t) { let i = 0; while (i < KT.length - 2 && t > KT[i + 1]) i++; return [i, clamp((t - KT[i]) / (KT[i + 1] - KT[i]), 0, 1)]; }
function kNum(name, t) { const [i, f] = keyIndex(t); return lerp(KEYS[name][i], KEYS[name][i + 1], f); }
function kCol(name, t, out) { const [i, f] = keyIndex(t); return out.copy(KC[name][i]).lerp(KC[name][i + 1], f); }

/* ---------------- renderer / scene ---------------- */
const canvas = document.getElementById('c');
const stage = document.getElementById('stage');
const dpr0 = window.devicePixelRatio || 1;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr0 < 2, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x88aacc, 0.0017);
const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.3, 6000);

/* direction-aware fog for all built-in materials: haze glows toward the sun */
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\nvarying float vFogDepth;\nvarying vec3 vFogPos;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\nvFogDepth = - mvPosition.z;\nvFogPos = mvPosition.xyz;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\nuniform vec3 fogColor;\nvarying float vFogDepth;\nvarying vec3 vFogPos;\nuniform float fogDensity;\nuniform vec3 fogSunColor;\nuniform vec3 fogSunDirView;\n#endif';
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  float fsd = max( dot( normalize( vFogPos ), fogSunDirView ), 0.0 );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor + fogSunColor * pow( fsd, 5.0 ), fogFactor );
#endif`;

/* shared uniforms */
const U = {
  uTime: { value: 0 },
  uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
  uGlowAmt: { value: 0 }, uSunColor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uMoonDir: { value: new THREE.Vector3(-0.55, 0.13, -0.83).normalize() }, uNight: { value: 0 }, uBelt: { value: new THREE.Color() },
  uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() }, uCover: { value: 0.45 },
  uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() },
  uIsl: { value: new THREE.Color() }, uFogDensity: { value: 0.0017 }, uSunI: { value: 1 },
  uHeight: { value: null }, uExtent: { value: EXTENT },
  uLampPos: { value: new THREE.Vector3() }, uLampColor: { value: new THREE.Color(1.0, 0.78, 0.45) }, uLamp: { value: 0 },
  uBeamDir: { value: new THREE.Vector2(1, 0) },
  fogSunColor: { value: new THREE.Color() }, fogSunDirView: { value: new THREE.Vector3() },
};

const NOISE_GLSL = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
vec3 vnoiseD(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f), du = 6.0*f*(1.0-f);
  float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1)); float k = a - b - c + d;
  return vec3(a + (b-a)*u.x + (c-a)*u.y + k*u.x*u.y, du * vec2(b - a + k*u.y, c - a + k*u.x)); }
float fbm4(vec2 p){ float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = m * p + 7.3; a *= 0.5; } return s / 0.9375; }
`;

const SKY_GLSL = /* glsl */`
uniform vec3 uZenith, uHorizon, uGlow, uSunColor, uSunDir, uMoonDir, uBelt;
uniform float uGlowAmt, uNight, uTime;
vec3 skyBase(vec3 d){
  float y = max(d.y, 0.0);
  vec3 col = mix(uZenith, uHorizon, pow(1.0 - y, 4.0));
  vec2 dh = normalize(d.xz + 1e-5), sh = normalize(uSunDir.xz + 1e-5);
  float az = dot(dh, sh) * 0.5 + 0.5;
  float sd = max(dot(d, uSunDir), 0.0);
  float hb = pow(1.0 - y, 7.0);
  col += uGlow * uGlowAmt * (pow(az, 5.0) * hb * 0.85 + pow(sd, 40.0) * 0.55);
  col += uSunColor * pow(sd, 350.0) * 1.2 * smoothstep(-0.06, 0.0, uSunDir.y);
  col += uBelt * pow(1.0 - az, 3.0) * exp(-y * 9.0);
  return col;
}
`;

/* ---------------- height texture for the ocean ---------------- */
const HT = 256;
{
  const data = new Uint8Array(HT * HT * 4);
  for (let j = 0; j < HT; j++) for (let i = 0; i < HT; i++) {
    const x = -EXTENT + (i + 0.5) / HT * 2 * EXTENT, z = -EXTENT + (j + 0.5) / HT * 2 * EXTENT;
    const h = heightAt(x, z), o = (j * HT + i) * 4;
    data[o] = Math.round(clamp((h + 8) / 32, 0, 1) * 255);
    data[o + 1] = Math.round(clamp((h + 4) / 6, 0, 1) * 255);
    data[o + 2] = 0; data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, HT, HT, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  U.uHeight.value = tex;
}

/* ---------------- sky dome ---------------- */
const skyMat = new THREE.ShaderMaterial({
  uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uCloudLit, uCloudDark; uniform float uCover;
  ${NOISE_GLSL}
  ${SKY_GLSL}
  vec3 stars(vec3 d){
    float a = uTime * 0.0045; float ca = cos(a), sa = sin(a);
    d = vec3(ca * d.x - sa * d.z, d.y, sa * d.x + ca * d.z);
    vec3 nrm = normalize(vec3(0.35, 0.55, 0.76));
    float band = exp(-pow(dot(d, nrm), 2.0) / 0.035);
    vec3 col = vec3(0.0);
    for (int L = 0; L < 2; L++){
      float sc = L == 0 ? 120.0 : 260.0;
      vec3 p = d * sc + float(L) * 17.0; vec3 c = floor(p); vec3 f = fract(p) - 0.5;
      float h = hash13(c);
      float thr = (L == 0 ? 0.93 : 0.86) - band * 0.1;
      if (h > thr){
        vec3 o = (vec3(hash13(c + 11.1), hash13(c + 23.7), hash13(c + 37.3)) - 0.5) * 0.5;
        float dist = length(f - o);
        float px = max(length(fwidth(p)) * 0.6, 0.04);
        float b = (L == 0 ? 2.6 : 0.9) * (0.25 + pow(hash13(c + 5.1), 5.0) * 3.5);
        float tw = 0.7 + 0.3 * sin(uTime * (2.0 + h * 6.0) + h * 80.0);
        vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.72), hash13(c + 2.2));
        col += tint * b * tw * smoothstep(px * 1.6, 0.0, dist) * min(1.0, 0.06 / px);
      }
    }
    vec2 mp = d.xz / (abs(d.y) + 0.6) * 5.0;
    col += vec3(0.42, 0.45, 0.62) * band * (fbm4(mp) * 0.5 + fbm4(mp * 3.1) * 0.35 - 0.2) * 0.22;
    return col;
  }
  vec4 clouds(vec3 d){
    vec2 uv = d.xz / (d.y + 0.11);
    vec2 w = vec2(uTime * 0.020, uTime * 0.007);
    float n = fbm4(uv * 0.55 + w + 3.0);
    float cov = smoothstep(uCover + 0.15, uCover + 0.27, n) * (0.5 + 0.5 * smoothstep(0.55, 0.12, d.y));
    float s = fbm4(vec2(uv.x * 0.2, uv.y * 1.3) + w * 0.6 + 11.0);
    float cov2 = smoothstep(0.56, 0.8, s) * 0.75 * smoothstep(0.35, 0.05, d.y);
    float hf = smoothstep(0.0, 0.07, d.y);
    float c = max(cov, cov2) * hf;
    float n2 = fbm4(uv * 0.55 + w + 3.0 + normalize(uSunDir.xz + 1e-4) * 0.18);
    float lit = clamp(0.55 + (n - n2) * 3.5, 0.0, 1.0);
    float fwd = pow(max(dot(d, uSunDir), 0.0), 5.0);
    vec3 cc = mix(uCloudDark, uCloudLit, lit * (0.65 + 0.35 * fwd));
    cc += uSunColor * fwd * (1.0 - c) * 0.9 * smoothstep(-0.12, 0.02, uSunDir.y);
    cc += uGlow * uGlowAmt * pow(1.0 - d.y, 6.0) * 0.25;
    return vec4(cc, c * 0.92);
  }
  void main(){
    vec3 d = normalize(vDir);
    vec3 col;
    if (d.y < 0.0) {
      col = skyBase(normalize(vec3(d.x, 0.0, d.z)));
    } else {
      col = skyBase(d);
      float sd = dot(d, uSunDir);
      float disc = smoothstep(0.99985, 0.99990, sd);
      col += uSunColor * pow(max(sd, 0.0), 2500.0) * 3.0;
      float md = dot(d, uMoonDir);
      float moon = smoothstep(0.99970, 0.99979, md);
      vec2 mq = (d.xy - uMoonDir.xy) * 900.0;
      col += vec3(1.0, 0.96, 0.86) * moon * 2.4 * uNight * (0.78 + 0.22 * vnoise(mq) - 0.1 * vnoise(mq * 2.7));
      col += vec3(0.55, 0.62, 0.85) * (pow(max(md, 0.0), 400.0) * 0.35 + pow(max(md, 0.0), 24.0) * 0.06) * uNight;
      col += stars(d) * uNight * smoothstep(0.0, 0.18, d.y) * (1.0 - moon);
      vec4 cl = clouds(d);
      col = mix(col, cl.rgb, cl.a);
      col += uSunColor * disc * (2.6 + 24.0 * smoothstep(0.03, 0.3, uSunDir.y)) * (1.0 - cl.a * 0.8);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), skyMat);
sky.renderOrder = -10; sky.frustumCulled = false;
scene.add(sky);

/* ---------------- ocean ---------------- */
function buildOceanGeometry() {
  const N = 220, pos = new Float32Array((N + 1) * (N + 1) * 3), idx = [];
  const m = (u) => u * 70 + Math.sign(u) * Math.pow(Math.abs(u), 3) * 2900;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const o = (j * (N + 1) + i) * 3;
    pos[o] = m(i / N * 2 - 1); pos[o + 1] = 0; pos[o + 2] = m(j / N * 2 - 1);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
const WAVES_GLSL = /* glsl */`
uniform sampler2D uHeight; uniform float uExtent;
const vec4 WV[4] = vec4[4](vec4(-0.92, 0.38, 23.0, 0.30), vec4(-0.55, 0.83, 13.5, 0.17), vec4(-0.98, -0.20, 8.2, 0.10), vec4(-0.35, -0.94, 5.1, 0.055));
float terrainH(vec2 xz){
  vec2 uv = xz / (2.0 * uExtent) + 0.5;
  vec4 s = texture2D(uHeight, uv);
  float hc = s.r * 32.0 - 8.0, hf = s.g * 6.0 - 4.0;
  return (hc > -3.6 && hc < 1.6) ? hf : hc;
}
void gerstner(vec2 p, float t, float amp, float fw, out vec3 disp, out vec3 nrm){
  disp = vec3(0.0); nrm = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < 4; i++){
    vec4 w = WV[i]; vec2 D = normalize(w.xy);
    float k = 6.2831853 / w.z, om = sqrt(9.8 * k);
    float A = w.w * amp * (1.0 - smoothstep(w.z * 0.25, w.z * 0.7, fw));
    float Q = 0.5 / (k * w.w * 4.0);
    float ph = k * dot(D, p) - om * t + float(i) * 1.7;
    float c = cos(ph), s = sin(ph);
    disp.xz += Q * A * D * c; disp.y += A * s;
    nrm.xz -= D * k * A * c; nrm.y -= Q * k * A * s;
  }
}
`;
const oceanMat = new THREE.ShaderMaterial({
  uniforms: U, fog: false,
  vertexShader: /* glsl */`
  precision highp float;
  uniform float uTime;
  ${WAVES_GLSL}
  varying vec3 vWorld; varying float vWaveH;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float camD = length(wp.xz - cameraPosition.xz);
    float depth = -terrainH(wp.xz);
    float amp = mix(0.22, 1.0, smoothstep(0.0, 4.5, depth)) * (1.0 - smoothstep(250.0, 700.0, camD));
    vec3 disp, n; gerstner(wp.xz, uTime, amp, 0.0, disp, n);
    wp.xyz += disp;
    vWorld = wp.xyz; vWaveH = disp.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`,
  fragmentShader: /* glsl */`
  precision highp float;
  ${NOISE_GLSL}
  ${SKY_GLSL}
  ${WAVES_GLSL}
  uniform vec3 uDeep, uShallow, uFoam, uIsl, uLampPos, uLampColor;
  uniform float uFogDensity, uSunI, uLamp;
  uniform vec2 uBeamDir;
  varying vec3 vWorld; varying float vWaveH;
  float islandHit(vec3 p, vec3 r){
    if (r.y > 0.5 || length(p.xz) > 150.0) return 0.0;
    float t = 0.8;
    for (int i = 0; i < 16; i++){
      vec3 q = p + r * t;
      if (abs(q.x) > uExtent || abs(q.z) > uExtent) return 0.0;
      float th = terrainH(q.xz);
      if (q.y < th) return smoothstep(0.0, 0.8 + t * 0.05, th - q.y + 0.3);
      t *= 1.32;
    }
    return 0.0;
  }
  void main(){
    vec3 wp = vWorld;
    vec3 toCam = cameraPosition - wp; float dist = length(toCam); vec3 V = toCam / dist;
    float th = terrainH(wp.xz);
    float depth = max(-th, 0.0);
    float shoreAmp = mix(0.22, 1.0, smoothstep(0.0, 4.5, depth));
    float fw = length(fwidth(wp.xz));
    vec3 disp, N; gerstner(wp.xz, uTime, shoreAmp, fw, disp, N);
    // fine detail: animated gradient noise (irregular, no tiling), faded by pixel footprint
    vec2 rp = wp.xz;
    vec2 q = rp; float fr = 0.7; vec2 grad = vec2(0.0);
    for (int i = 0; i < 4; i++){
      float fi = float(i);
      float lam = 1.0 / fr;
      float fade = 1.0 - smoothstep(lam * 0.12, lam * 0.45, fw);
      vec2 drift = vec2(cos(fi * 2.4 + 0.5), sin(fi * 2.4 + 0.5)) * uTime * (0.35 + fi * 0.18);
      vec3 nd = vnoiseD(q * fr + drift);
      grad += nd.yz * (0.11 / (1.0 + fi * 0.3)) * fade;
      q = mat2(0.8, 0.6, -0.6, 0.8) * q + 3.1; fr *= 2.03;
    }
    N.xz -= grad * shoreAmp;
    N = normalize(N);
    N = normalize(mix(N, vec3(0.0, 1.0, 0.0), smoothstep(150.0, 1400.0, dist) * 0.55));

    float NdV = max(dot(N, V), 0.0);
    vec3 R = reflect(-V, N); R.y = abs(R.y) + 0.002; R = normalize(R);
    float fres = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
    vec3 refl = skyBase(R);
    float hit = islandHit(wp + vec3(0.0, 0.05, 0.0), R);
    refl = mix(refl, uIsl, hit);

    vec3 body = mix(uShallow, uDeep, smoothstep(0.3, 7.0, depth));
    body = mix(uShallow * 1.2 + uFoam * 0.05, body, smoothstep(0.0, 0.8, depth));
    vec2 sh = normalize(uSunDir.xz + 1e-4);
    float sss = pow(max(dot(normalize(-V.xz + 1e-4), sh), 0.0), 3.0) * clamp(vWaveH * 2.0 + 0.3, 0.0, 1.0);
    body += uShallow * uSunColor * sss * 0.25 * uSunI * 0.4;

    vec3 col = mix(body, refl, fres);

    // speculars (added after fog so glitter survives toward the horizon)
    float sunVis = smoothstep(-0.035, 0.015, uSunDir.y);
    float sdot = max(dot(R, uSunDir), 0.0);
    vec3 spec = uSunColor * (pow(sdot, 1400.0) * 90.0 + pow(sdot, 160.0) * 4.0 + pow(sdot, 18.0) * 0.12) * sunVis * (1.0 - hit);
    float mdot = max(dot(R, uMoonDir), 0.0);
    spec += vec3(0.75, 0.8, 0.95) * (pow(mdot, 900.0) * 14.0 + pow(mdot, 90.0) * 0.6) * uNight * (1.0 - hit);
    vec3 Ld = uLampPos - wp; float lDist = length(Ld); Ld /= lDist;
    spec += uLampColor * pow(max(dot(R, Ld), 0.0), 220.0) * 26.0 * uLamp / (1.0 + lDist * 0.02);
    vec2 rel = wp.xz - uLampPos.xz; float rl = length(rel);
    float ba = abs(dot(rel / max(rl, 1e-3), uBeamDir));
    spec += uLampColor * pow(ba, 900.0) * exp(-rl / 160.0) * uLamp * (0.25 + 1.5 * fres) * 0.8;

    // foam
    float fN = vnoise(rp * 1.3 + vec2(uTime * 0.25, -uTime * 0.1)) * 0.55 + vnoise(rp * 3.7 - uTime * 0.3) * 0.45;
    float shore = 1.0 - smoothstep(0.0, 1.8, depth);
    float bands = sin(depth * 4.6 + uTime * 1.8 + fN * 2.5) * 0.5 + 0.5;
    float foam = shore * smoothstep(0.74, 0.95, bands * 0.78 + fN * 0.32 + shore * 0.12);
    foam = max(foam, smoothstep(0.22, 0.0, depth) * smoothstep(0.35, 0.65, fN));
    foam += smoothstep(0.42, 0.6, vWaveH) * smoothstep(0.55, 0.85, fN) * 0.45 * (1.0 - shore);
    foam = clamp(foam, 0.0, 1.0) * (1.0 - smoothstep(120.0, 380.0, dist));
    col = mix(col, uFoam, foam * 0.92);
    spec *= 1.0 - foam;

    vec3 fd = normalize(vec3(-V.x, 0.0, -V.z));
    vec3 fogCol = skyBase(vec3(fd.x, 0.012, fd.z));
    float ff = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    float sff = 1.0 - exp(-pow(uFogDensity * 0.62 * dist, 2.0));
    col = mix(col, fogCol, ff) + spec * (1.0 - sff);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,
});
const ocean = new THREE.Mesh(buildOceanGeometry(), oceanMat);
ocean.frustumCulled = false; ocean.renderOrder = 1;
scene.add(ocean);

/* ---------------- material helper (fog + optional sway) ---------------- */
const SWAY_VERT = /* glsl */`
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
{
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
  ip = instanceMatrix[3].xyz;
  #endif
  float ph = ip.x * 0.21 + ip.z * 0.17;
  float g = sin(uTime * 1.15 + ph) * 0.55 + sin(uTime * 2.35 + ph * 1.9) * 0.25 + sin(uTime * 0.37 + ph * 0.5) * 0.35;
  float w = aSway * aSway;
  vec2 wind = vec2(-0.86, 0.5);
  mvPosition.xz += wind * w * (0.32 + 0.24 * g);
  mvPosition.y -= w * 0.06 * abs(g);
  float fl = aFlutter * (sin(uTime * 5.3 + ph * 3.0 + aFlutter * 4.0) * 0.13 + sin(uTime * 8.7 + ph) * 0.05);
  mvPosition.y += fl; mvPosition.xz += wind * fl * 0.6;
}
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`;
function patch(mat, sway = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.fogSunColor = U.fogSunColor; sh.uniforms.fogSunDirView = U.fogSunDirView;
    if (sway) {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'uniform float uTime;\nattribute float aSway;\nattribute float aFlutter;\n' + sh.vertexShader.replace('#include <project_vertex>', SWAY_VERT);
    }
  };
  if (sway) mat.customProgramCacheKey = () => 'sway';
  return mat;
}

/* ---------------- terrain ---------------- */
{
  const SEG = 256;
  const g = new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const st = smooth(0.9, 2.2, slopeAt(x, z));
    if (st > 0) {
      p.setX(i, x + st * ((vnoise(y * 0.7 + 3, z * 0.45) - 0.5) * 2.2 + (vnoise(y * 2.1, z * 1.7 + 5) - 0.5) * 0.7));
      p.setZ(i, z + st * ((vnoise(x * 0.45 + 7, y * 0.7) - 0.5) * 2.2 + (vnoise(x * 1.7 + 1, y * 2.1) - 0.5) * 0.7));
      p.setY(i, y + st * (vnoise(x * 1.3, z * 1.3) - 0.5) * 0.8);
    }
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, cols = new Float32Array(p.count * 3);
  const C = (h) => new THREE.Color(h);
  const sand = C('#e2cc9c'), wet = C('#a48d66'), grassA = C('#4f7a2e'), grassB = C('#7d9440'), rockA = C('#8c7b68'), rockB = C('#5d5046'), under = C('#7a8a74');
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), slope = 1 - n.getY(i);
    const nz = fbm(x * 0.15, z * 0.15), nz2 = vnoise(x * 0.9, z * 0.9);
    // sand / wet sand / seabed
    tmp.copy(sand).lerp(wet, smooth(0.7, 0.1, y));
    if (y < -0.4) tmp.lerp(under, smooth(-0.4, -3, y));
    // grass
    const gStart = 1.9 + nz * 1.6;
    tmp2.copy(grassA).lerp(grassB, smooth(0.35, 0.75, nz2 * 0.5 + nz * 0.6));
    tmp.lerp(tmp2, smooth(gStart, gStart + 0.9, y));
    // rock on steep slopes, with strata
    const strata = 0.5 + 0.5 * Math.sin(y * 2.2 + nz * 3.0);
    tmp2.copy(rockA).lerp(rockB, strata * 0.7 + nz2 * 0.3);
    tmp.lerp(tmp2, smooth(0.28, 0.5, slope + (nz - 0.5) * 0.15));
    const v = 0.9 + nz2 * 0.2;
    cols[i * 3] = tmp.r * v; cols[i * 3 + 1] = tmp.g * v; cols[i * 3 + 2] = tmp.b * v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const terrain = new THREE.Mesh(g, patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true })));
  terrain.receiveShadow = true; terrain.castShadow = true;
  scene.add(terrain);
}

/* ---------------- palms ---------------- */
function buildPalm(rng, H, bend) {
  const P = [], Nn = [], Cc = [], S = [], F = [];
  const V3 = THREE.Vector3;
  const push = (p, n, c, s, f) => { P.push(p.x, p.y, p.z); Nn.push(n.x, n.y, n.z); Cc.push(c.r, c.g, c.b); S.push(s); F.push(f); };
  const wig = rng() * 6;
  const center = (s) => new V3(bend * H * s * s, H * s, 0.35 * bend * Math.sin(s * 2.5 + wig) * s);
  const rings = 10, sides = 7, ringData = [];
  const barkA = new THREE.Color('#7a6248'), barkB = new THREE.Color('#5a4634'), barkTop = new THREE.Color('#6f6a3e');
  for (let i = 0; i <= rings; i++) {
    const s = i / rings, c = center(s);
    const T = center(Math.min(1, s + 0.01)).sub(center(Math.max(0, s - 0.01))).normalize();
    const Uv = new V3(0, 0, 1).cross(T).normalize(), W = T.clone().cross(Uv).normalize();
    const r = 0.28 * (1 - 0.42 * s) * (i === 0 ? 1.35 : 1);
    const ring = [];
    for (let k = 0; k <= sides; k++) { const a = k / sides * Math.PI * 2; const nrm = Uv.clone().multiplyScalar(Math.cos(a)).addScaledVector(W, Math.sin(a)); ring.push({ p: c.clone().addScaledVector(nrm, r), n: nrm }); }
    const col = (i % 2 ? barkA : barkB).clone().lerp(barkTop, s > 0.92 ? 1 : 0);
    ringData.push({ ring, s, col });
  }
  for (let i = 0; i < rings; i++) for (let k = 0; k < sides; k++) {
    const A = ringData[i], B = ringData[i + 1];
    const q = [[A, k], [A, k + 1], [B, k + 1], [A, k], [B, k + 1], [B, k]];
    for (const [R, kk] of q) push(R.ring[kk].p, R.ring[kk].n, R.col, R.s, 0);
  }
  const top = center(1);
  // coconuts
  const nut = new THREE.IcosahedronGeometry(0.19, 0);
  const nutC = new THREE.Color('#4a3a22');
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + rng();
    const off = new V3(Math.cos(a) * 0.24, -0.28, Math.sin(a) * 0.24);
    const np = nut.attributes.position, nn = nut.attributes.normal;
    for (let i = 0; i < np.count; i++) push(new V3(np.getX(i), np.getY(i), np.getZ(i)).add(top).add(off), new V3(nn.getX(i), nn.getY(i), nn.getZ(i)), nutC, 1, 0);
  }
  // fronds
  const nF = 9 + Math.floor(rng() * 3);
  const up = new V3(0, 1, 0);
  for (let f = 0; f < nF; f++) {
    const phi = f / nF * Math.PI * 2 + rng() * 0.5;
    const hd = new V3(Math.cos(phi), 0, Math.sin(phi));
    const side = new V3(-hd.z, 0, hd.x);
    const dead = rng() < 0.12;
    const e0 = dead ? -0.3 : 0.25 + rng() * 0.6;
    const L = (dead ? 2.4 : 2.8 + rng() * 1.0) * (H / 7);
    const droop = 0.5 + rng() * 0.35;
    const spine = (u) => top.clone().addScaledVector(hd, L * u * 0.95).addScaledVector(up, L * (Math.sin(e0) * u - droop * u * u));
    const base = dead ? new THREE.Color('#7a6a3a') : new THREE.Color('#2f5a22').offsetHSL((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.04);
    const tip = dead ? new THREE.Color('#9a8450') : new THREE.Color('#7da23e').offsetHSL((rng() - 0.5) * 0.03, 0, 0);
    const segs = 11;
    for (let j = 0; j < segs; j++) {
      const u0 = j / segs, u1 = (j + 0.6) / segs, ut = (j + 0.35) / segs;
      const a = spine(u0), b = spine(u1);
      const w = 1.05 * Math.pow(Math.sin(Math.PI * Math.min(1, ut * 1.08 + 0.06)), 0.7) * L / 3.2;
      for (const sg of [-1, 1]) {
        const tp = spine(ut + 0.05).addScaledVector(side, sg * w).addScaledVector(up, -0.38 * w).addScaledVector(hd, 0.18 * w);
        const e1 = b.clone().sub(a), e2 = tp.clone().sub(a);
        const fn = e1.clone().cross(e2).normalize(); if (fn.y < 0) fn.negate();
        fn.lerp(up, 0.45).normalize();
        const cb = base.clone().lerp(tip, u0), ct = base.clone().lerp(tip, Math.min(1, u0 + 0.25));
        push(a, fn, cb, 1 + u0 * 0.12, u0);
        push(b, fn, cb, 1 + u1 * 0.12, u1);
        push(tp, fn, ct, 1 + ut * 0.12, ut + 0.25);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(S, 1));
  g.setAttribute('aFlutter', new THREE.Float32BufferAttribute(F, 1));
  return g;
}

const rng = mulberry32(20261118);
function scatter(count, tries, test, minDist) {
  const out = [];
  for (let i = 0; i < tries && out.length < count; i++) {
    const x = (rng() * 2 - 1) * 62, z = (rng() * 2 - 1) * 55;
    const h = heightAt(x, z);
    if (!test(x, z, h)) continue;
    if (out.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < minDist * minDist)) continue;
    out.push({ x, z, h });
  }
  return out;
}
const nearLH = (x, z, r) => (x - LH.x) ** 2 + (z - LH.z) ** 2 < r * r;
{
  const palms = scatter(46, 6000, (x, z, h) => h > 1.1 && h < 9 && slopeAt(x, z) < 0.45 && !nearLH(x, z, 9) && (h < 4.5 || rng() < 0.35), 3.0);
  const variants = [buildPalm(rng, 7.2, 0.32), buildPalm(rng, 8.4, 0.22), buildPalm(rng, 6.2, 0.42)];
  const mat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), true);
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  depthMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.vertexShader = 'uniform float uTime;\nattribute float aSway;\nattribute float aFlutter;\n' + sh.vertexShader.replace('#include <project_vertex>', SWAY_VERT); };
  depthMat.customProgramCacheKey = () => 'swaydepth';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  variants.forEach((geo, vi) => {
    const list = palms.filter((_, i) => i % 3 === vi);
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    im.customDepthMaterial = depthMat;
    list.forEach((pl, i) => {
      const out = Math.atan2(pl.z - 2, pl.x - 3);
      const phi = -out + (rng() - 0.5) * 1.2;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), phi);
      const s = 0.8 + rng() * 0.45;
      sc.set(s, s, s); ps.set(pl.x, pl.h - 0.25, pl.z);
      m4.compose(ps, q, sc); im.setMatrixAt(i, m4);
    });
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    scene.add(im);
  });
}

/* ---------------- bushes & rocks ---------------- */
{
  const bush = scatter(80, 6000, (x, z, h) => h > 2.4 && slopeAt(x, z) < 0.6 && !nearLH(x, z, 11), 2.4);
  const bg = new THREE.IcosahedronGeometry(1, 1);
  const bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) { const k = 1 + (hash2(Math.round(bp.getX(i) * 50), Math.round(bp.getZ(i) * 50 + bp.getY(i) * 7)) - 0.5) * 0.35; bp.setXYZ(i, bp.getX(i) * k, bp.getY(i) * k, bp.getZ(i) * k); }
  bg.computeVertexNormals();
  const bm = new THREE.InstancedMesh(bg, patch(new THREE.MeshStandardMaterial({ color: '#3f6a28', roughness: 0.9, flatShading: true })), bush.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  bush.forEach((b, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6.28);
    const k = 0.45 + rng() * 0.75; s.set(k * 1.3, k * (0.7 + rng() * 0.4), k * 1.2); p.set(b.x, b.h + k * 0.15, b.z);
    m4.compose(p, q, s); bm.setMatrixAt(i, m4);
    bm.setColorAt(i, col.setHSL(0.24 + rng() * 0.07, 0.45, 0.6 + rng() * 0.3));
  });
  bm.castShadow = true; bm.receiveShadow = true;
  scene.add(bm);

  const rocks = scatter(60, 8000, (x, z, h) => h > -1.2 && h < 1.4 && !(z > 10 && x > -16 && x < 34) && (slopeAt(x, z) > 0.25 || Math.hypot(x + 22, z + 3) < 18 || rng() < 0.12), 1.6);
  const rg = new THREE.DodecahedronGeometry(1, 0);
  const rp = rg.attributes.position;
  for (let i = 0; i < rp.count; i++) { const k = 1 + (hash2(Math.round(rp.getX(i) * 40 + 3), Math.round(rp.getZ(i) * 40 + rp.getY(i) * 9)) - 0.5) * 0.5; rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k * 0.8, rp.getZ(i) * k); }
  rg.computeVertexNormals();
  const rm = new THREE.InstancedMesh(rg, patch(new THREE.MeshStandardMaterial({ color: '#6e6258', roughness: 0.85, flatShading: true })), rocks.length);
  rocks.forEach((r, i) => {
    q.setFromEuler(new THREE.Euler(rng() * 0.6, rng() * 6.28, rng() * 0.6));
    const k = 0.5 + rng() * 1.4; s.set(k * (1 + rng() * 0.5), k, k * (1 + rng() * 0.5)); p.set(r.x, r.h + k * 0.1, r.z);
    m4.compose(p, q, s); rm.setMatrixAt(i, m4);
    rm.setColorAt(i, col.setHSL(0.07, 0.1, 0.65 + rng() * 0.3));
  });
  rm.castShadow = true; rm.receiveShadow = true;
  scene.add(rm);
}

/* ---------------- lighthouse ---------------- */
const lamp = {};
{
  const grp = new THREE.Group(); grp.position.copy(LH); scene.add(grp);
  const std = (o) => patch(new THREE.MeshStandardMaterial(o));
  const add = (geo, mat, y, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = cast; m.receiveShadow = true; grp.add(m); return m; };
  add(new THREE.CylinderGeometry(2.5, 3.0, 1.4, 24), std({ color: '#9a948a', roughness: 0.95 }), 0.5);
  // striped tower
  const tg = new THREE.CylinderGeometry(1.15, 1.75, 10, 28, 20);
  const tp = tg.attributes.position, tc = new Float32Array(tp.count * 3);
  const red = new THREE.Color('#b3322b'), white = new THREE.Color('#f1ebe0');
  for (let i = 0; i < tp.count; i++) { const c = (Math.floor((tp.getY(i) + 5 + 0.001) / 2.5) % 2) ? red : white; tc.set([c.r, c.g, c.b], i * 3); }
  tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  add(tg, std({ vertexColors: true, roughness: 0.6 }), 6.2);
  const dark = std({ color: '#2a2a2e', roughness: 0.5, metalness: 0.3 });
  add(new THREE.CylinderGeometry(1.85, 1.6, 0.3, 28), dark, 11.35);
  add(new THREE.TorusGeometry(1.75, 0.04, 6, 40).rotateX(Math.PI / 2), dark, 12.05);
  lamp.glass = std({ color: '#1c2024', roughness: 0.15, metalness: 0.2, emissive: new THREE.Color('#ffcf86'), emissiveIntensity: 0 });
  add(new THREE.CylinderGeometry(0.95, 0.95, 1.5, 16), lamp.glass, 12.25, false);
  add(new THREE.ConeGeometry(1.2, 1.25, 16), std({ color: '#7a1f1c', roughness: 0.5 }), 13.62);
  add(new THREE.SphereGeometry(0.16, 10, 8), dark, 14.3);
  lamp.y = 12.25;
  // keeper's cottage
  const cot = new THREE.Group(); cot.position.set(2.0, 0, -6.2); cot.rotation.y = -0.3; grp.add(cot);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.4, 3.2), std({ color: '#ebe4d6', roughness: 0.9 }));
  walls.position.y = 1.2; walls.castShadow = walls.receiveShadow = true; cot.add(walls);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 4.8, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 6), std({ color: '#8a3a2a', roughness: 0.8 }));
  roof.scale.set(1, 0.62, 1.0); roof.position.y = 3.05; roof.castShadow = true; cot.add(roof);
  lamp.win = std({ color: '#222', emissive: new THREE.Color('#ffb25a'), emissiveIntensity: 0 });
  for (const [x, z, ry] of [[-1.1, 1.61, 0], [1.1, 1.61, 0], [2.21, 0, Math.PI / 2], [-1.1, -1.61, 0]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), lamp.win); w.position.set(x, 1.3, z); w.rotation.y = ry; if (z < 0) w.rotation.y = Math.PI; cot.add(w);
  }
  // beam cones
  const bg = new THREE.CylinderGeometry(5.5, 0.3, 120, 32, 1, true); bg.translate(0, 60, 0); bg.rotateZ(-Math.PI / 2);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.8, 0.5) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */`varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main(){ vAlong = position.x / 120.0; vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`uniform float uOn; uniform vec3 uCol; varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main(){ float e = abs(dot(normalize(vN), normalize(vV))); e = pow(e, 3.0);
        float a = e * pow(1.0 - vAlong, 2.6) * smoothstep(0.0, 0.015, vAlong) * uOn * 0.1;
        gl_FragColor = vec4(uCol * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  lamp.beamMat = beamMat;
  lamp.beam = new THREE.Group(); lamp.beam.position.set(0, lamp.y, 0); grp.add(lamp.beam);
  for (const r of [0, Math.PI]) { const m = new THREE.Mesh(bg, beamMat); m.rotation.set(0, r, 0); m.rotation.z = r ? 0.03 : -0.03; m.frustumCulled = false; m.renderOrder = 5; lamp.beam.add(m); }
  // glow sprite (code-generated texture)
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d'); const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,230,190,0.8)'); gr.addColorStop(0.4, 'rgba(255,170,90,0.18)'); gr.addColorStop(1, 'rgba(255,150,80,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const gt = new THREE.CanvasTexture(cv); gt.colorSpace = THREE.SRGBColorSpace;
  lamp.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  lamp.sprite.renderOrder = 6; scene.add(lamp.sprite);
  lamp.light = new THREE.PointLight(0xffc27a, 0, 60, 1.6); lamp.light.position.set(0, lamp.y, 0); grp.add(lamp.light);
  lamp.world = new THREE.Vector3(LH.x, LH.y + lamp.y, LH.z);
  U.uLampPos.value.copy(lamp.world);
}

/* ---------------- gulls ---------------- */
const gulls = [];
{
  const g = new THREE.BufferGeometry();
  // body + two wings, attribute aWing = spanwise coordinate for flapping
  const P = [0, 0, -0.35, 0, 0.05, 0.4, 0.08, 0, 0, 0, 0, -0.35, -0.08, 0, 0, 0, 0.05, 0.4,
    0, 0.02, 0.1, 1.1, 0, -0.15, 0, 0.02, -0.15, 0, 0.02, 0.1, -1.1, 0, -0.15, 0, 0.02, -0.15];
  const Wg = [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(Wg, 1));
  g.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: '#2a2a30', side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.fogSunColor = U.fogSunColor; sh.uniforms.fogSunDirView = U.fogSunDirView;
    sh.vertexShader = 'uniform float uTime; uniform float uPhase; attribute float aWing;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position; transformed.y += abs(aWing) * sin(uTime * 7.0 + uPhase) * 0.55; transformed.x *= 1.0 - abs(aWing) * 0.15 * (1.0 + sin(uTime * 7.0 + uPhase));');
    mat.userData.sh = sh;
  };
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(g, mat.clone());
    const ph = { value: i * 1.9 };
    m.material.onBeforeCompile = (sh) => { mat.onBeforeCompile(sh); sh.uniforms.uPhase = ph; };
    m.material.customProgramCacheKey = () => 'gull';
    m.scale.setScalar(1.3);
    m.userData = { r: 22 + i * 4.5, h: 20 + (i % 3) * 4, sp: 0.22 + (i % 4) * 0.03, o: i * 0.9, cx: 4 + (i % 2) * 6, cz: 4 - (i % 3) * 5 };
    scene.add(m); gulls.push(m);
  }
}

/* ---------------- lights ---------------- */
const sunLight = new THREE.DirectionalLight(0xffffff, 3);
sunLight.castShadow = true;
const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600;
sunLight.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sunLight.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 1, far: 420 });
sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.04;
scene.add(sunLight, sunLight.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 1);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0x9fb4ff, 0);
moonLight.position.copy(U.uMoonDir.value).multiplyScalar(200);
scene.add(moonLight);

/* ---------------- overlay pass: vignette + fades ---------------- */
const ovScene = new THREE.Scene(), ovCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const ovMat = new THREE.ShaderMaterial({
  uniforms: { uFade: { value: 0 }, uTime: U.uTime },
  transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`varying vec2 vUv; uniform float uFade, uTime;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec2 q = (vUv - 0.5) * vec2(0.85, 1.0); float v = smoothstep(0.32, 0.86, length(q));
      float a = 1.0 - (1.0 - v * 0.55) * (1.0 - uFade);
      float g = (h(gl_FragCoord.xy + floor(uTime * 24.0) * 3.1) - 0.5) * 0.035;
      gl_FragColor = vec4(vec3(0.0), clamp(a + g, 0.0, 1.0)); }`,
});
ovScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ovMat));

/* ---------------- camera choreography ---------------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const beachX0 = 25, beachX1 = 9;
const beachZ = [];
for (let i = 0; i <= 8; i++) { const x = lerp(beachX0, beachX1, i / 8); beachZ.push(shoreZ(x)); }
function beachShoreZ(u) { const f = u * 8, i = Math.min(7, Math.floor(f)), k = f - i; return lerp(beachZ[i], beachZ[i + 1], smooth(0, 1, k)); }
// smooth the shoreline (moving average) so the dolly path is calm
const beachZs = beachZ.map((_, i, a) => (a[Math.max(0, i - 1)] + a[i] * 2 + a[Math.min(a.length - 1, i + 1)]) / 4);
beachZ.splice(0, beachZ.length, ...beachZs);

function cameraAt(t, out) {
  const s = shotIndexAt(t), t0 = SHOTS[s].start, t1 = s + 1 < SHOTS.length ? SHOTS[s + 1].start : DURATION;
  const u = clamp((t - t0) / (t1 - t0), 0, 1);
  let pos, look, fov = 50;
  if (s === 0) { // distant approach over the water, sun ahead
    const e = 0.45 * u + 0.55 * easeOut(u);
    pos = V(lerp(238, 96, e), lerp(6.5, 12, e) + 0.35 * Math.sin(t * 1.1), lerp(16, 6, e));
    look = V(lerp(-6, -8, e), lerp(19, 17, e), lerp(-2, -4, e));
    fov = 50;
  } else if (s === 1) { // slow orbit
    const th = 2.45 - (u * 0.8 + easeInOut(u) * 0.5);
    const R = lerp(120, 98, u), h = lerp(40, 26, u);
    pos = V(Math.cos(th) * R - 4, h, Math.sin(th) * R + 2);
    look = V(lerp(-13, -6, u), lerp(9, 6, u), lerp(-3, 2, u));
    fov = 46;
  } else if (s === 2) { // low pass along the beach, into the sunset
    const x = lerp(beachX0, beachX1, u);
    const z = beachShoreZ(u) + 4.5;
    pos = V(x, 3.0 + 0.1 * Math.sin(t * 0.9), z);
    const ax = x - 20, sp = V(ax, 0, shoreZ(ax) + 1).sub(pos).setY(0).normalize();
    const dir = sp.multiplyScalar(0.72).add(V(SUN_AZ.x, 0, SUN_AZ.y).multiplyScalar(0.28)).normalize();
    look = pos.clone().addScaledVector(dir, 50); look.y = 4.2;
    fov = 58;
  } else if (s === 3) { // lighthouse at dusk — beam ignites
    const a = lerp(-0.34, 0.26, easeInOut(u)), R = lerp(36, 26, u);
    pos = V(LH.x + Math.cos(a) * R, LH.y + lerp(3.0, 5.5, u), LH.z + Math.sin(a) * R);
    look = V(LH.x, LH.y + lerp(8.0, 10.5, u), LH.z);
    fov = 50;
  } else { // final pull-back into the night
    const e = easeInOut(u);
    pos = V(lerp(LH.x + 2, 102, e), lerp(6, 56, e) + Math.sin(e * Math.PI) * 12, lerp(LH.z + 50, 118, e));
    look = V(lerp(LH.x, -12, e), lerp(LH.y + 8, 23, e), lerp(LH.z, -6, e));
    fov = lerp(48, 50, e);
  }
  const ground = Math.max(heightAt(pos.x, pos.z), 0) + 2.2;
  if (pos.y < ground) pos.y = ground;
  out.position.copy(pos); out.lookAt(look);
  if (out.fov !== fov) { out.fov = fov; out.updateProjectionMatrix(); }
  return s;
}

/* ---------------- frame render: pure function of t ---------------- */
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), tmpV = new THREE.Vector3();
const SUN_AZ = new THREE.Vector2(-1, 0.06).normalize();
function lampLevel(t) {
  if (t < 38.2) return 0;
  if (t < 39.5) { const k = Math.floor(t * 15); return hash2(k, 7) > 0.42 ? 0.55 + hash2(k, 3) * 0.2 : 0.06; }
  return 0.6 + 0.4 * smooth(39.5, 40.6, t);
}
function renderAt(t) {
  t = clamp(t, 0, DURATION);
  U.uTime.value = t;
  // sun
  const el = THREE.MathUtils.degToRad(kNum('sunEl', t));
  U.uSunDir.value.set(SUN_AZ.x * Math.cos(el), Math.sin(el), SUN_AZ.y * Math.cos(el));
  kCol('zen', t, U.uZenith.value); kCol('hor', t, U.uHorizon.value); kCol('glow', t, U.uGlow.value);
  U.uGlowAmt.value = kNum('glowAmt', t); kCol('sun', t, U.uSunColor.value); kCol('belt', t, U.uBelt.value);
  kCol('cLit', t, U.uCloudLit.value); kCol('cDark', t, U.uCloudDark.value); U.uCover.value = kNum('cover', t);
  kCol('deep', t, U.uDeep.value); kCol('shallow', t, U.uShallow.value); kCol('foam', t, U.uFoam.value); kCol('isl', t, U.uIsl.value);
  const night = kNum('night', t); U.uNight.value = night;
  const fogD = kNum('fogD', t); U.uFogDensity.value = fogD; scene.fog.density = fogD;
  const sunI = kNum('sunI', t); U.uSunI.value = sunI;
  scene.fog.color.copy(U.uHorizon.value).multiplyScalar(0.9).lerp(U.uZenith.value, 0.08);
  U.fogSunColor.value.copy(U.uGlow.value).multiplyScalar(U.uGlowAmt.value * 0.55);
  renderer.toneMappingExposure = kNum('exposure', t);

  sunLight.color.copy(U.uSunColor.value); sunLight.intensity = sunI;
  sunLight.position.copy(U.uSunDir.value).multiplyScalar(220);
  sunLight.castShadow = sunI > 0.02;
  kCol('hemiSky', t, hemi.color); kCol('hemiGround', t, hemi.groundColor); hemi.intensity = kNum('hemiI', t);
  moonLight.intensity = night * 1.0;

  // lighthouse
  const lv = lampLevel(t);
  U.uLamp.value = lv;
  lamp.glass.emissiveIntensity = lv * 7;
  lamp.win.emissiveIntensity = smooth(36, 42, t) * 2.2;
  lamp.light.intensity = lv * 260;
  lamp.beamMat.uniforms.uOn.value = lv * (0.45 + 0.55 * night);
  const ang = t * 0.78 + 0.6;
  lamp.beam.rotation.y = ang;
  U.uBeamDir.value.set(Math.cos(ang), -Math.sin(ang));

  // gulls (afternoon only)
  for (const g of gulls) {
    const d = g.userData, a = t * d.sp + d.o;
    g.visible = t < 30;
    g.position.set(d.cx + Math.cos(a) * d.r, d.h + Math.sin(t * 0.7 + d.o) * 1.5, d.cz + Math.sin(a) * d.r);
    g.rotation.set(0, -a, Math.sin(t * 0.5 + d.o) * 0.25);
  }

  // camera
  const s = cameraAt(t, camera);
  camera.updateMatrixWorld();
  sky.position.copy(camera.position);
  const step = 6;
  ocean.position.set(Math.round(camera.position.x / step) * step, 0, Math.round(camera.position.z / step) * step);
  U.fogSunDirView.value.copy(U.uSunDir.value).transformDirection(camera.matrixWorldInverse);

  // lamp glow sprite (pulled toward camera so the lantern does not occlude it)
  tmpV.copy(camera.position).sub(lamp.world).normalize();
  lamp.sprite.position.copy(lamp.world).addScaledVector(tmpV, 1.4);
  const bd = new THREE.Vector2(tmpV.x, tmpV.z).normalize();
  const facing = Math.abs(bd.x * U.uBeamDir.value.x + bd.y * U.uBeamDir.value.y);
  const flare = Math.pow(facing, 40);
  lamp.sprite.scale.setScalar((4 + flare * 26) * (0.4 + 0.6 * lv));
  lamp.sprite.material.opacity = lv * (0.7 + flare * 0.3);
  lamp.sprite.visible = lv > 0.01;

  // fades: in from black, out to black
  ovMat.uniforms.uFade.value = 1 - smooth(0, 1.6, t) * (1 - smooth(57.4, 60, t));

  renderer.clear();
  renderer.render(scene, camera);
  renderer.render(ovScene, ovCam);
  return s;
}

/* ---------------- audio (WebAudio, generated) ---------------- */
const audio = {
  ctx: null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    const master = this.master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    const r = mulberry32(99);
    const noiseBuf = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = noiseBuf.getChannelData(c); let b = 0; for (let i = 0; i < d.length; i++) { const w = r() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5 + w * 0.15; } }
    const src = (rate = 1) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
    // surf
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    this.surf = ctx.createGain(); this.surf.gain.value = 0; src(1).connect(lp); lp.connect(this.surf); this.surf.connect(master);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.6;
    this.wash = ctx.createGain(); this.wash.gain.value = 0; src(1.37).connect(bp); bp.connect(this.wash); this.wash.connect(master);
    // reverb impulse
    const ir = ctx.createBuffer(2, ctx.sampleRate * 3, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    const verb = ctx.createConvolver(); verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.55; verb.connect(vg); vg.connect(master);
    // pad
    this.padF = ctx.createBiquadFilter(); this.padF.type = 'lowpass'; this.padF.frequency.value = 1500; this.padF.Q.value = 0.3;
    this.pad = ctx.createGain(); this.pad.gain.value = 0;
    this.padF.connect(this.pad); this.pad.connect(master); this.pad.connect(verb);
    this.voices = [];
    for (let i = 0; i < 4; i++) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o1.type = 'triangle'; o2.type = 'sine'; o2.detune.value = 7 + i * 2; o1.detune.value = -4;
      g.gain.value = 0.22 / (1 + i * 0.25);
      o1.connect(g); o2.connect(g); g.connect(this.padF); o1.start(); o2.start();
      this.voices.push([o1, o2]);
    }
    // night crickets
    const cr = ctx.createOscillator(); cr.frequency.value = 4300; const crg = ctx.createGain(); crg.gain.value = 0;
    const am = ctx.createOscillator(); am.frequency.value = 24; const amg = ctx.createGain(); amg.gain.value = 0.5;
    const crAmp = ctx.createGain(); crAmp.gain.value = 0.5; am.connect(amg); amg.connect(crAmp.gain);
    cr.connect(crAmp); crAmp.connect(crg); crg.connect(master); cr.start(); am.start();
    this.cricket = crg; this.verb = verb;
    this.lastShot = -1; this.lastT = 0;
  },
  CHORDS: [
    [174.61, 261.63, 329.63, 392.0],
    [146.83, 220.0, 261.63, 329.63],
    [116.54, 174.61, 220.0, 293.66],
    [98.0, 146.83, 233.08, 349.23],
    [87.31, 130.81, 261.63, 329.63],
  ],
  bell() {
    const ctx = this.ctx; if (!ctx) return; const now = ctx.currentTime;
    for (const [f, a, d] of [[523.25, 0.16, 5], [1046.5, 0.07, 3.5], [1567.98, 0.04, 2.5], [783.99, 0.05, 4]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(a, now + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + d);
      o.connect(g); g.connect(this.master); g.connect(this.verb); o.start(now); o.stop(now + d + 0.1);
    }
  },
  update(t, playing) {
    const ctx = this.ctx; if (!ctx) return; const now = ctx.currentTime;
    const fade = smooth(0, 2, t) * (1 - smooth(56.5, 60, t));
    this.master.gain.setTargetAtTime(playing ? fade * 0.85 : 0, now, 0.15);
    const swell = 0.5 + 0.32 * Math.sin(t * 0.85) + 0.18 * Math.sin(t * 0.31 + 1);
    const s = shotIndexAt(t);
    const close = s === 2 ? 1.6 : s === 0 ? 0.8 : 1.0;
    this.surf.gain.setTargetAtTime(0.16 * swell * close, now, 0.2);
    this.wash.gain.setTargetAtTime(0.035 * Math.pow(Math.max(0, Math.sin(t * 0.85 - 0.6)), 3) * close, now, 0.1);
    const night = kNum('night', t);
    this.pad.gain.setTargetAtTime(0.06 * (0.7 + 0.3 * night), now, 0.5);
    this.padF.frequency.setTargetAtTime(lerp(1600, 520, night), now, 0.8);
    this.cricket.gain.setTargetAtTime(0.0035 * night * (0.6 + 0.4 * Math.sin(t * 2.3)), now, 0.2);
    if (s !== this.lastShot) {
      this.CHORDS[s].forEach((f, i) => { this.voices[i][0].frequency.setTargetAtTime(f, now, 0.9); this.voices[i][1].frequency.setTargetAtTime(f * (i === 0 ? 0.5 : 1), now, 0.9); });
      this.lastShot = s;
    }
    if (playing && this.lastT < 38.25 && t >= 38.25 && t - this.lastT < 1) this.bell();
    this.lastT = t;
  },
  pause() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); },
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); },
};

/* ---------------- playback state, UI, input ---------------- */
const state = { time: 0, playing: false, started: false, finished: false, anchorT: 0, anchorWall: 0, shot: 0, dirty: true };
const $ = (id) => document.getElementById(id);
const hud = $('hud'), bar = $('bar'), shotLbl = $('shotLbl');
SHOTS.forEach((s, i) => { const d = document.createElement('div'); d.className = 'seg'; const end = i + 1 < SHOTS.length ? SHOTS[i + 1].start : DURATION; d.style.flex = String(end - s.start); d.appendChild(document.createElement('i')); bar.appendChild(d); });
const segs = [...bar.querySelectorAll('.seg i')];

let qualityScale = 1; // lowered automatically if the device can't hold ~60 fps (resolution only; frames stay deterministic)
function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  let w, h; if (W / H > 9 / 16) { h = H; w = H * 9 / 16; } else { w = W; h = W * 16 / 9; }
  w = Math.floor(w); h = Math.floor(h);
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
  const pr = Math.max(0.6, Math.min(window.devicePixelRatio || 1, MOBILE ? 1.75 : 2, 1920 / h) * qualityScale);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
  camera.aspect = 9 / 16; camera.updateProjectionMatrix();
  state.dirty = true;
}
window.addEventListener('resize', resize);
resize();

function updateHud() {
  const t = state.time;
  SHOTS.forEach((s, i) => { const end = i + 1 < SHOTS.length ? SHOTS[i + 1].start : DURATION; segs[i].style.width = (clamp((t - s.start) / (end - s.start), 0, 1) * 100) + '%'; });
  shotLbl.textContent = `${state.shot + 1}/${SHOTS.length} · ${SHOTS[state.shot].name}`;
  $('icoPause').innerHTML = state.playing ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4l13 8-13 8z"/>';
  $('pausedBadge').classList.toggle('on', state.started && !state.playing && !state.finished);
}
let idleTimer = 0;
function poke() { hud.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (state.playing) hud.classList.add('idle'); }, 2600); }

function seek(t) {
  t = clamp(Number(t) || 0, 0, DURATION);
  state.time = t; state.anchorT = t; state.anchorWall = performance.now();
  state.finished = false; $('endOv').classList.add('hidden');
  state.shot = renderAt(t); state.dirty = false;
  if (t >= DURATION) finish();
  audio.update(t, state.playing);
  updateHud();
  return t;
}
function play() {
  if (state.finished) return;
  state.playing = true; state.anchorT = state.time; state.anchorWall = performance.now();
  audio.resume(); updateHud(); poke();
}
function pause() { state.playing = false; audio.update(state.time, false); setTimeout(() => { if (!state.playing) audio.pause(); }, 200); updateHud(); poke(); }
function toggle() { if (!state.started || state.finished) return; state.playing ? pause() : play(); }
function finish() {
  state.playing = false; state.finished = true; state.time = DURATION;
  $('endOv').classList.remove('hidden'); hud.classList.add('off');
  audio.update(DURATION, false); setTimeout(() => audio.pause(), 600);
  updateHud();
}
function nextShot() {
  if (!state.started || state.finished) return;
  const s = shotIndexAt(state.time);
  if (s + 1 >= SHOTS.length) { seek(DURATION); return; }
  seek(SHOTS[s + 1].start); poke();
}
function prevShot() {
  if (!state.started || state.finished) return;
  const s = shotIndexAt(state.time);
  seek(state.time - SHOTS[s].start > 1.5 ? SHOTS[s].start : SHOTS[Math.max(0, s - 1)].start); poke();
}
function start() {
  audio.init(); audio.resume();
  state.started = true; $('startOv').classList.add('hidden'); $('endOv').classList.add('hidden'); hud.classList.remove('off');
  state.playing = true; seek(0); play();
}

$('btnStart').addEventListener('click', (e) => { e.stopPropagation(); start(); });
$('btnReplay').addEventListener('click', (e) => { e.stopPropagation(); start(); });
$('btnPause').addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
$('btnNext').addEventListener('click', (e) => { e.stopPropagation(); nextShot(); });
for (const el of [$('btnStart'), $('btnReplay'), $('btnPause'), $('btnNext')]) el.addEventListener('pointerdown', (e) => e.stopPropagation());

let ptr = null;
stage.addEventListener('pointerdown', (e) => { ptr = { x: e.clientX, y: e.clientY, t: performance.now() }; });
stage.addEventListener('pointerup', (e) => {
  if (!ptr) return; const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; const dt = performance.now() - ptr.t; ptr = null;
  if (!state.started || state.finished) return;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { dx < 0 ? nextShot() : prevShot(); return; }
  if (Math.hypot(dx, dy) < 12 && dt < 500) toggle();
});
stage.addEventListener('pointermove', () => { if (state.started) poke(); });
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key;
  if (!state.started || state.finished) { if (k === 'Enter' || k === ' ') { e.preventDefault(); start(); } return; }
  if (k === ' ' || k === 'k' || k === 'K' || k === 'p' || k === 'P') { e.preventDefault(); toggle(); }
  else if (k === 'ArrowRight' || k === 'n' || k === 'N') { e.preventDefault(); nextShot(); }
  else if (k === 'ArrowLeft') { e.preventDefault(); prevShot(); }
  else if (k === 'r' || k === 'R') start();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state.playing) pause(); });

const perf = { last: 0, acc: 0, n: 0 };
function loop(now) {
  requestAnimationFrame(loop);
  if (state.playing) {
    if (perf.last) { perf.acc += now - perf.last; perf.n++; }
    perf.last = now;
    if (perf.n >= 90) {
      const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
      if (avg > 19.5 && qualityScale > 0.55) { qualityScale *= 0.85; resize(); }
    }
    let t = state.anchorT + (now - state.anchorWall) / 1000;
    if (t >= DURATION) { state.time = DURATION; state.shot = renderAt(DURATION); finish(); return; }
    state.time = t;
    const prev = state.shot;
    state.shot = renderAt(t);
    audio.update(t, true);
    if (prev !== state.shot || (now | 0) % 4 === 0) updateHud();
    else SHOTS.forEach((s, i) => { if (i === state.shot) { const end = i + 1 < SHOTS.length ? SHOTS[i + 1].start : DURATION; segs[i].style.width = ((t - s.start) / (end - s.start) * 100) + '%'; } });
  } else if (state.dirty) {
    perf.last = 0;
    state.shot = renderAt(state.time); state.dirty = false;
  }
}

window.__scene = {
  get shot() { return state.shot; },
  get shotName() { return SHOTS[state.shot].name; },
  get time() { return state.time; },
  get playing() { return state.playing; },
  get duration() { return DURATION; },
  shots: SHOTS.map((s) => ({ ...s })),
  seek: (t) => seek(t),
  play: () => { if (!state.started) start(); else play(); },
  pause: () => pause(),
  next: () => nextShot(),
};

// idle poster frame behind the Start button; ?t=12.5 renders a specific still (frame capture)
const qs = new URLSearchParams(location.search);
if (qs.has('t')) {
  $('startOv').style.display = 'none'; $('endOv').style.display = 'none';
  seek(parseFloat(qs.get('t')));
  if (state.finished) $('endOv').classList.add('hidden');
} else {
  state.time = 0; renderAt(31); state.dirty = false;
}
requestAnimationFrame(loop);
