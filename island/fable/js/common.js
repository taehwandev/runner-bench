// Shared helpers: seeded randomness, noise, uniforms and GLSL chunks.
import * as THREE from 'three';

export const DUR = 60;
export const HM_WORLD = 280; // heightmap covers [-140, 140] in x and z

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function rng(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded 2D gradient noise, roughly [-1, 1].
export function makeNoise2D(seed) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = r() * Math.PI * 2;
    gx[i] = Math.cos(a); gy[i] = Math.sin(a);
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return function (x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const X = x0 & 255, Y = y0 & 255;
    const g00 = perm[X + perm[Y]], g10 = perm[X + 1 + perm[Y]];
    const g01 = perm[X + perm[Y + 1]], g11 = perm[X + 1 + perm[Y + 1]];
    const n00 = gx[g00] * fx + gy[g00] * fy;
    const n10 = gx[g10] * (fx - 1) + gy[g10] * fy;
    const n01 = gx[g01] * fx + gy[g01] * (fy - 1);
    const n11 = gx[g11] * (fx - 1) + gy[g11] * (fy - 1);
    const u = fade(fx), v = fade(fy);
    return 1.5 * lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  };
}

export function fbm2(n, x, y, oct) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * n(x * f, y * f);
    f *= 2.03; a *= 0.5;
  }
  return s;
}

// Tileable noise texture. R,G: smooth value noise (32 cells). B,A: slope field
// of a tileable fbm, used for water ripples.
export function makeNoiseTexture() {
  const S = 256;
  const data = new Uint8Array(S * S * 4);
  const lat = (seed, P) => {
    const r = rng(seed); const a = new Float32Array(P * P);
    for (let i = 0; i < a.length; i++) a[i] = r();
    return a;
  };
  const sample = (a, P, x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    let fx = x - x0, fy = y - y0;
    fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const i0 = ((x0 % P) + P) % P, i1 = (i0 + 1) % P;
    const j0 = ((y0 % P) + P) % P, j1 = (j0 + 1) % P;
    return lerp(lerp(a[j0 * P + i0], a[j0 * P + i1], fx), lerp(a[j1 * P + i0], a[j1 * P + i1], fx), fy);
  };
  const A = lat(101, 32), B = lat(202, 32), C1 = lat(303, 16), C2 = lat(404, 32), C3 = lat(505, 64);
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = y * S + x;
    data[i * 4] = Math.round(sample(A, 32, u * 32, v * 32) * 255);
    data[i * 4 + 1] = Math.round(sample(B, 32, u * 32, v * 32) * 255);
    H[i] = sample(C1, 16, u * 16, v * 16) + 0.5 * sample(C2, 32, u * 32, v * 32) + 0.25 * sample(C3, 64, u * 64, v * 64);
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const xm = (x + S - 1) % S, xp = (x + 1) % S, ym = (y + S - 1) % S, yp = (y + 1) % S;
    const dx = (H[y * S + xp] - H[y * S + xm]) * 4.5;
    const dy = (H[yp * S + x] - H[ym * S + x]) * 4.5;
    data[i * 4 + 2] = Math.round(clamp(dx * 0.5 + 0.5, 0, 1) * 255);
    data[i * 4 + 3] = Math.round(clamp(dy * 0.5 + 0.5, 0, 1) * 255);
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const v3 = (x = 0, y = 0, z = 0) => ({ value: new THREE.Vector3(x, y, z) });
const v2 = (x = 0, y = 0) => ({ value: new THREE.Vector2(x, y) });

// One shared uniform set; every material references the same objects.
export const U = {
  uTime: { value: 0 },
  uSunDir: v3(0, 1, 0), uSunAz: v2(1, 0), uMoonDir: v3(0, 1, 0),
  uLightDir: v3(0, 1, 0), uLightAz: v2(1, 0), uLightCol: v3(),
  uAmbSky: v3(), uAmbGnd: v3(),
  uZenith: v3(), uMid: v3(), uHorizon: v3(), uSunGlow: v3(), uSunCol: v3(), uSunDisc: v3(),
  uCloudLit: v3(), uCloudDark: v3(), uCloudCov: { value: 0.5 },
  uFogDen: { value: 0.001 }, uExposure: { value: 1 }, uNight: { value: 0 }, uMoonI: { value: 0 },
  uLinearOut: { value: 0 }, uClip: { value: 0 },
  uNoise: { value: null }, uHeight: { value: null },
  uLampPos: v3(), uBeamDir: v2(1, 0), uBeamOn: { value: 0 }, uLampOn: { value: 0 },
  uLampCol: v3(1.0, 0.86, 0.6),
  uWindowOn: { value: 0 }, uLanternOn: { value: 0 }, uFlare: { value: 0 },
  uStarRot: { value: new THREE.Matrix3() }, uMilkyN: v3(0, 0, 1),
  uMeteorA: v3(), uMeteorB: v3(), uGulls: { value: 1 },
  uPx: { value: 1 },
};

export const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir; uniform vec2 uSunAz; uniform vec3 uMoonDir;
uniform vec3 uLightDir; uniform vec2 uLightAz; uniform vec3 uLightCol;
uniform vec3 uAmbSky; uniform vec3 uAmbGnd;
uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uSunGlow; uniform vec3 uSunCol;
uniform vec3 uCloudLit; uniform vec3 uCloudDark; uniform float uCloudCov;
uniform float uFogDen; uniform float uExposure; uniform float uNight;
uniform float uLinearOut; uniform float uClip;
uniform sampler2D uNoise; uniform sampler2D uHeight;
uniform vec3 uLampPos; uniform vec2 uBeamDir; uniform float uBeamOn; uniform float uLampOn; uniform vec3 uLampCol;
const vec2 WIND = vec2(0.94, -0.34);

float nz(vec2 p) { return texture2D(uNoise, p).r; }
float hmap(vec2 xz) { return texture2D(uHeight, xz / ${HM_WORLD.toFixed(1)} + 0.5).r; }
float canopy(vec2 xz) { return texture2D(uHeight, xz / ${HM_WORLD.toFixed(1)} + 0.5).g; }

vec3 skyBase(vec3 d) {
  float y = clamp(d.y, 0.0, 1.0);
  vec2 dh = normalize(d.xz + vec2(1e-5));
  float az = dot(dh, uSunAz) * 0.5 + 0.5;
  float az2 = az * az;
  vec3 hor = mix(uHorizon, uSunGlow, az2 * az);
  vec3 mid = mix(uMid, uSunGlow, 0.30 * az2 * az2);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.24, y));
  c = mix(c, uZenith, smoothstep(0.06, 0.74, y));
  float sd = max(dot(d, uSunDir), 0.0);
  float sd2 = sd * sd; float sd8 = sd2 * sd2 * sd2 * sd2;
  c += uSunCol * (sd2 * sd2 * sd * 0.05 + sd8 * sd8 * sd8 * sd8 * 0.20 + pow(sd, 420.0) * 0.55);
  return c;
}

// q = 1: full quality (sky dome), q = 0: cheap (reflections, star occlusion)
vec4 clouds(vec3 d, vec3 base, float q) {
  float y = d.y;
  if (y < 0.012) return vec4(0.0);
  vec2 p = d.xz / (y + 0.16) * 0.052;
  vec2 w1 = uTime * vec2(0.0042, -0.0016);
  float nl = (nz(p + w1) * 0.5 + nz(p * 2.03 + w1 * 1.5 + 0.37) * 0.25) / 0.75;
  float n = nl;
  if (q > 0.5) n = (nl * 0.75 + nz(p * 4.01 + w1 * 2.1 + 0.71) * 0.125 + nz(p * 8.07 + w1 * 2.9) * 0.0625) / 0.9375;
  float th = mix(0.68, 0.42, uCloudCov);
  float cov = smoothstep(th, th + 0.13, n);
  float lit = 0.45;
  if (q > 0.5) {
    vec2 o = uLightAz * 0.011;
    float n2 = (nz(p + w1 + o) * 0.5 + nz(p * 2.03 + w1 * 1.5 + 0.37 + o * 2.03) * 0.25) / 0.75;
    lit = clamp((nl - n2) * 7.0 + 0.42, 0.0, 1.0);
  }
  vec3 col = mix(uCloudDark, uCloudLit, lit);
  col *= mix(1.0, 0.72, smoothstep(th + 0.10, th + 0.34, n));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * pow(sd, 10.0) * (1.0 - cov * 0.7) * 0.30;
  float hz = smoothstep(0.012, 0.22, y);
  col = mix(base, col, 0.30 + 0.70 * hz);
  float a = cov * smoothstep(0.012, 0.085, y) * 0.95;
  if (q > 0.5) {
    float ci = nz(p * vec2(0.45, 2.7) + w1 * 0.55 + 0.21) * nz(p * 1.6 - w1 * 0.25 + 0.63);
    float ca = smoothstep(0.24, 0.46, ci) * 0.30 * hz;
    vec3 cc = mix(base, mix(uCloudDark, uCloudLit, 0.8), 0.8);
    float at = a + ca * (1.0 - a);
    col = (col * a + cc * ca * (1.0 - a)) / max(at, 1e-4);
    a = at;
  }
  return vec4(col, a);
}

float shoreDamp(float depth) { return mix(0.05, 1.0, smoothstep(0.0, 6.0, depth)); }

// Soft heightfield shadow marched toward the key light.
float terrainShadow(vec3 p) {
  if (uLightDir.y <= 0.0) return 0.0;
  float sh = 1.0; float t = 1.3;
  for (int i = 0; i < 9; i++) {
    vec3 q = p + uLightDir * t;
    float h = hmap(q.xz);
    sh = min(sh, clamp((q.y - h) / (0.10 * t + 0.25) + 1.0, 0.0, 1.0));
    t *= 1.62;
  }
  return sh;
}

float beamCone(vec3 p) {
  vec2 v = p.xz - uLampPos.xz;
  float c = abs(dot(normalize(v + vec2(1e-4)), uBeamDir));
  return smoothstep(0.972, 0.9994, c);
}

vec3 lampLight(vec3 p, vec3 n) {
  vec3 v = p - uLampPos; float d = length(v); vec3 dir = v / max(d, 1e-3);
  float att = 1.0 / (1.0 + d * d / 9000.0);
  float nd = clamp(dot(n, -dir) * 0.6 + 0.4, 0.0, 1.0);
  float beam = uBeamOn * beamCone(p) * att * nd * 0.6 * smoothstep(3.0, 12.0, d);
  float omni = uLampOn / (1.0 + d * d / 45.0) * clamp(dot(n, -dir) * 0.5 + 0.5, 0.0, 1.0) * 0.32 * smoothstep(-9.0, -1.5, v.y);
  return uLampCol * (beam + omni);
}

vec3 applyFog(vec3 c, vec3 wpos) {
  vec3 v = wpos - cameraPosition; float dist = length(v);
  float f = 1.0 - exp(-dist * uFogDen);
  vec3 fc = skyBase(normalize(vec3(v.x, 0.035 * dist, v.z)));
  return mix(c, fc, f);
}
`;

export const GLSL_FRAG = /* glsl */ `
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec4 finish(vec3 c, float a) {
  if (uLinearOut > 0.5) return vec4(c, a);
  c = aces(c * uExposure);
  c = pow(c, vec3(1.0 / 2.2));
  // gentle filmic grade: lifted warm highlights, cool shadows
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.20);
  c = clamp(c, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.42);
  c = mix(c, c * vec3(1.03, 1.0, 0.96), smoothstep(0.4, 1.0, l));
  c = mix(c, c * vec3(0.95, 0.99, 1.06), smoothstep(0.35, 0.0, l));
  c += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  return vec4(c, a);
}
`;

// Small geometry accumulator used for all hand-built props.
export class Builder {
  constructor() {
    this.p = []; this.n = []; this.c = []; this.a = []; this.u = []; this.i = [];
    this.m = new THREE.Matrix4(); this.nm = new THREE.Matrix3();
    this._v = new THREE.Vector3();
  }
  setMatrix(m) { this.m.copy(m); this.nm.getNormalMatrix(m); return this; }
  at(x, y, z, ry = 0) {
    const m = new THREE.Matrix4().makeRotationY(ry); m.setPosition(x, y, z);
    return this.setMatrix(m);
  }
  vert(x, y, z, nx, ny, nz, col, aux, u = 0, v = 0) {
    const t = this._v.set(x, y, z).applyMatrix4(this.m);
    this.p.push(t.x, t.y, t.z);
    t.set(nx, ny, nz).applyMatrix3(this.nm).normalize();
    this.n.push(t.x, t.y, t.z);
    this.c.push(col[0], col[1], col[2]);
    this.a.push(aux[0], aux[1], aux[2], aux[3]);
    this.u.push(u, v);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  box(sx, sy, sz, col, aux = [0, 0, 0, 0], cx = 0, cy = 0, cz = 0) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const faces = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
      [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, 1], [-1, 0, 0]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    ];
    for (const [n, a, b] of faces) {
      const idx = [];
      for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = (n[0] + a[0] * sa + b[0] * sb) * hx + cx;
        const y = (n[1] + a[1] * sa + b[1] * sb) * hy + cy;
        const z = (n[2] + a[2] * sa + b[2] * sb) * hz + cz;
        idx.push(this.vert(x, y, z, n[0], n[1], n[2], col, aux));
      }
      this.quad(idx[0], idx[1], idx[2], idx[3]);
    }
  }
  frustum(r0, r1, y0, y1, seg, col, aux = [0, 0, 0, 0], capTop = false, capBot = false) {
    const sl = (r0 - r1) / (y1 - y0);
    const base = this.p.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      this.vert(c * r0, y0, s * r0, c, sl, s, col, aux);
      this.vert(c * r1, y1, s * r1, c, sl, s, col, aux);
    }
    for (let i = 0; i < seg; i++) {
      const k = base + i * 2;
      this.quad(k, k + 1, k + 3, k + 2);
    }
    const cap = (r, y, ny) => {
      const c0 = this.vert(0, y, 0, 0, ny, 0, col, aux);
      const b = this.p.length / 3;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        this.vert(Math.cos(a) * r, y, Math.sin(a) * r, 0, ny, 0, col, aux);
      }
      for (let i = 0; i < seg; i++) this.tri(c0, b + i, b + i + 1);
    };
    if (capTop) cap(r1, y1, 1);
    if (capBot) cap(r0, y0, -1);
  }
  // Lumpy ellipsoid: bushes, canopies, boulders, coconuts.
  blob(r, sy, rnd, colTop, colBot, auxFn, su = 9, sv = 6, rough = 0.28) {
    const base = this.p.length / 3;
    const k1 = rnd() * 6.28, k2 = rnd() * 6.28, k3 = rnd() * 6.28;
    for (let j = 0; j <= sv; j++) {
      const v = j / sv, ph = v * Math.PI;
      for (let i = 0; i <= su; i++) {
        const u = i / su, th = u * Math.PI * 2;
        let x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th);
        const d = 1 + rough * (Math.sin(th * 3 + k1 + y * 2.5) * 0.5 + Math.sin(th * 5 + k2) * Math.sin(ph * 4 + k3) * 0.5);
        const t = y * 0.5 + 0.5;
        const col = [lerp(colBot[0], colTop[0], t), lerp(colBot[1], colTop[1], t), lerp(colBot[2], colTop[2], t)];
        this.vert(x * r * d, y * r * sy * d, z * r * d, x, y / sy, z, col, auxFn ? auxFn(t) : [0, 0, 0, 0]);
      }
    }
    for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
      const k = base + j * (su + 1) + i;
      this.quad(k, k + 1, k + su + 2, k + su + 1);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aAux', new THREE.Float32BufferAttribute(this.a, 4));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

// aAux = (sway weight, phase, emissive amount, kind)
// kind: 0 solid, 1 window, 2 lamp glass, 3 jetty lantern, 4 foliage
export function makePropMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      attribute vec3 aColor; attribute vec4 aAux;
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec4 vAux;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float s = sin(uTime * 1.25 + aAux.y) * 0.6 + sin(uTime * 2.9 + aAux.y * 1.7) * 0.25 + 0.35;
        wp.xz += WIND * s * aAux.x * 0.42;
        wp.y -= abs(s) * aAux.x * 0.03;
        vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = aColor; vAux = aAux;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${GLSL_FRAG}
      uniform float uWindowOn; uniform float uLanternOn;
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec4 vAux;
      void main() {
        if (uClip > 0.5 && vW.y < -0.02) discard;
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        if (dot(N, V) < 0.0) N = -N;
        float kind = vAux.w;
        float ndl = dot(N, uLightDir);
        float dif = kind > 3.5 ? clamp((ndl + 0.45) / 1.45, 0.0, 1.0) : max(ndl, 0.0);
        float sh = terrainShadow(vW + N * 0.3);
        vec3 amb = mix(uAmbGnd, uAmbSky, N.y * 0.5 + 0.5);
        if (kind > 3.5) amb *= 1.0 - 0.35 * canopy(vW.xz) * (1.0 - smoothstep(0.0, 4.0, vW.y - hmap(vW.xz)));
        vec3 alb = vC;
        vec3 emi = vec3(0.0);
        if (vAux.z > 0.01) {
          float on = kind < 1.5 ? uWindowOn : (kind < 2.5 ? uLampOn : uLanternOn);
          alb = mix(vec3(0.06, 0.08, 0.10), vC * 0.25, 0.3);
          emi = vC * vAux.z * on;
        }
        vec3 col = alb * (uLightCol * dif * sh + amb + lampLight(vW, N)) + emi;
        if (kind > 3.5) col += alb * uLightCol * pow(max(dot(-V, uLightDir), 0.0), 3.0) * 0.35 * sh;
        gl_FragColor = finish(applyFog(col, vW), 1.0);
      }`,
  });
}
