// Sky dome (gradient, sun, moon, clouds, milky way, meteor), stars and gulls.
import * as THREE from 'three';
import { U, GLSL_COMMON, GLSL_FRAG, rng } from './common.js';

export function buildSkyDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${GLSL_FRAG}
      uniform vec3 uSunDisc; uniform float uMoonI; uniform vec3 uMilkyN;
      uniform vec3 uMeteorA; uniform vec3 uMeteorB;
      varying vec3 vDir;
      const float MOON_R = 0.017;
      void main() {
        vec3 d = normalize(vDir);
        if (d.y < 0.0) d = normalize(vec3(d.x, 0.0, d.z));
        vec3 c = skyBase(d);

        // milky way
        float mw = exp(-pow(dot(d, uMilkyN) / 0.17, 2.0));
        if (uNight > 0.01 && mw > 0.01) {
          vec2 mp = vec2(atan(d.z, d.x), d.y) * 0.35;
          float mn = nz(mp * 0.9 + 0.1) * 0.6 + nz(mp * 2.7 + 0.5) * 0.4;
          c += vec3(0.10, 0.12, 0.20) * mw * smoothstep(0.30, 0.75, mn) * uNight * 0.07 * smoothstep(0.02, 0.3, d.y);
        }

        // sun disc
        float sdot = dot(d, uSunDir);
        c += uSunDisc * smoothstep(0.99950, 0.99972, sdot);

        // moon
        float md = dot(d, uMoonDir);
        float mdc = max(md, 0.0);
        c += vec3(0.42, 0.52, 0.80) * (pow(mdc, 600.0) * 0.10 + pow(mdc, 60.0) * 0.010) * uNight;
        if (md > 0.9997) {
          vec3 tx = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
          vec3 ty = cross(tx, uMoonDir);
          vec2 lp = vec2(dot(d, tx), dot(d, ty)) / MOON_R;
          float r2 = dot(lp, lp);
          if (r2 < 1.0) {
            vec3 mn = vec3(lp, sqrt(1.0 - r2));
            float ph = smoothstep(-0.55, 0.15, dot(mn, normalize(vec3(-0.62, -0.30, 0.72))));
            float mar = nz(lp * 0.045 + 0.31) * 0.6 + nz(lp * 0.13 + 0.7) * 0.4;
            vec3 mc = vec3(1.0, 0.96, 0.88) * (0.55 + 0.75 * smoothstep(0.3, 0.7, mar)) * (0.6 + 0.4 * mn.z);
            c += mc * ph * uMoonI * smoothstep(1.0, 0.90, r2);
          }
        }

        // one shooting star
        float ms = (uTime - 52.4) / 0.85;
        if (ms > 0.0 && ms < 1.0) {
          vec3 head = normalize(mix(uMeteorA, uMeteorB, ms));
          vec3 tail = normalize(mix(uMeteorA, uMeteorB, max(ms - 0.30, 0.0)));
          vec3 ab = head - tail;
          float h = clamp(dot(d - tail, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
          float dd = length(d - tail - ab * h);
          c += vec3(0.85, 0.92, 1.0) * exp(-dd * dd * 420000.0) * h * h * sin(3.14159 * ms) * 2.2;
        }

        vec4 cl = clouds(d, c, 1.0);
        c = mix(c, cl.rgb, cl.a);
        gl_FragColor = finish(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

export function buildStars() {
  const r = rng(4242), N = 3400;
  const pos = new Float32Array(N * 3), dat = new Float32Array(N * 4);
  // milky-way plane normal (in the star frame) used to bias density
  const mw = new THREE.Vector3(0.45, 0.35, 0.82).normalize();
  let i = 0;
  while (i < N) {
    const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    const v = new THREE.Vector3(Math.cos(a) * s, z, Math.sin(a) * s);
    const band = Math.exp(-Math.pow(v.dot(mw) / 0.2, 2));
    if (r() > 0.42 + 0.58 * band) continue;
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    const m = Math.pow(r(), 5.0);          // few bright stars, many faint
    dat[i * 4] = 1.5 + m * 3.4;            // size
    dat[i * 4 + 1] = 0.55 + m * 1.6;       // brightness
    dat[i * 4 + 2] = r();                  // twinkle phase
    dat[i * 4 + 3] = r();                  // colour temperature
    i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aDat', new THREE.BufferAttribute(dat, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform mat3 uStarRot; uniform float uPx;
      attribute vec4 aDat;
      varying vec4 vCol;
      void main() {
        vec3 d = normalize(uStarRot * position);
        vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * d, 1.0);
        gl_Position = p.xyww;
        float tw = 0.72 + 0.28 * sin(uTime * (2.0 + aDat.z * 5.0) + aDat.z * 60.0);
        float vis = uNight * smoothstep(0.015, 0.28, d.y);
        vis *= 1.0 - clouds(d, vec3(0.0), 0.0).a;
        vis *= smoothstep(0.9996, 0.9990, dot(d, uMoonDir));
        vec3 tint = mix(vec3(1.0, 0.82, 0.66), vec3(0.72, 0.84, 1.0), aDat.w);
        vCol = vec4(tint, aDat.y * tw * vis);
        gl_PointSize = max(aDat.x * uPx, 1.0) * (vis > 0.001 ? 1.0 : 0.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec4 vCol;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float f = exp(-dot(q, q) * 14.0) - 0.03;
        if (f <= 0.0) discard;
        gl_FragColor = vec4(vCol.rgb * vCol.a * f * 2.1, 1.0);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -99;
  return pts;
}

// A handful of gulls wheeling over the headland during the day.
export function buildGulls() {
  const r = rng(77), pos = [], flap = [], bird = [], ctr = [], idx = [];
  const BIRDS = 9;
  for (let b = 0; b < BIRDS; b++) {
    const overCove = b >= 6;
    const cx = overCove ? -30 + r() * 20 : 38 + r() * 26, cz = overCove ? 20 + r() * 20 : -52 + r() * 34;
    const rad = 14 + r() * 26, h = (overCove ? 14 : 30) + r() * 22, sp = (0.16 + r() * 0.14) * (r() < 0.5 ? -1 : 1), ph = r() * 6.283;
    const base = pos.length / 3;
    // x: span, z: forward
    const verts = [
      [0, 0, 0.55, 0], [0, 0, -0.45, 0],          // body nose/tail
      [0.95, 0, 0.05, 0.55], [2.0, 0, -0.35, 1],   // right wing mid/tip
      [-0.95, 0, 0.05, 0.55], [-2.0, 0, -0.35, 1], // left wing
    ];
    for (const v of verts) {
      pos.push(v[0], v[1], v[2]); flap.push(v[3]);
      bird.push(rad, h, sp, ph); ctr.push(cx, cz);
    }
    idx.push(base, base + 2, base + 1, base + 2, base + 3, base + 1, base, base + 1, base + 4, base + 4, base + 1, base + 5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlap', new THREE.Float32BufferAttribute(flap, 1));
  g.setAttribute('aBird', new THREE.Float32BufferAttribute(bird, 4));
  g.setAttribute('aCtr', new THREE.Float32BufferAttribute(ctr, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform float uGulls;
      attribute float aFlap; attribute vec4 aBird; attribute vec2 aCtr;
      varying vec3 vW; varying float vShade;
      void main() {
        float ang = aBird.w + aBird.z * uTime;
        vec2 cs = vec2(cos(ang), sin(ang));
        vec3 c = vec3(aCtr.x + cs.x * aBird.x, aBird.y + sin(uTime * 0.4 + aBird.w * 3.0) * 2.5, aCtr.y + cs.y * aBird.x);
        vec2 fwd = vec2(-cs.y, cs.x) * sign(aBird.z);
        vec2 side = vec2(fwd.y, -fwd.x);
        float glide = smoothstep(-0.2, 0.5, sin(uTime * 0.55 + aBird.w * 2.0));
        float fl = sin(uTime * 8.0 + aBird.w * 7.0) * mix(0.25, 1.0, glide) + 0.25;
        vec3 lp = position * uGulls * 0.8;
        float up = aFlap * aFlap * fl * 0.85 * uGulls;
        vec3 wp = c + vec3(side.x * lp.x + fwd.x * lp.z, up, side.y * lp.x + fwd.y * lp.z);
        vW = wp; vShade = 0.55 + 0.45 * aFlap;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${GLSL_FRAG}
      varying vec3 vW; varying float vShade;
      void main() {
        vec3 col = vec3(0.75, 0.76, 0.78) * vShade * (uAmbSky * 1.2 + uLightCol * 0.35);
        gl_FragColor = finish(applyFog(col, vW), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}
