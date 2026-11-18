// Ocean: camera-centred polar grid, Gerstner swell, analytic sky reflection,
// planar island reflection, shallow-water colour and shore foam.
import * as THREE from 'three';
import { U, GLSL_COMMON, GLSL_FRAG, rng } from './common.js';

// [wavelength m, amplitude m, heading deg] — swell runs toward the cove.
const WAVES = [
  [74, 0.50, 14], [47, 0.34, -20], [29, 0.22, 32], [18, 0.14, -6],
  [11.5, 0.085, 50], [7.3, 0.05, -38], [4.6, 0.032, 22], [2.9, 0.018, -62],
];

function waveCalls(fn, acc, fadeMul, count) {
  const r = rng(909);
  let s = '';
  WAVES.forEach(([L, A, deg], i) => {
    const ph = r() * 6.283;
    if (i >= count) return;
    const k = (2 * Math.PI) / L, w = Math.sqrt(9.81 * k), a = (deg * Math.PI) / 180;
    const Q = 0.62 / (k * A * WAVES.length);
    s += `${fn}(xz, vec2(${Math.cos(a).toFixed(5)}, ${Math.sin(a).toFixed(5)}), ${k.toFixed(5)}, ${A.toFixed(4)}, ` +
      `${w.toFixed(5)}, ${Q.toFixed(4)}, ${ph.toFixed(4)}, clamp(1.0 - dist / ${(L * fadeMul).toFixed(1)}, 0.0, 1.0), ${acc});\n`;
  });
  return s;
}

export function buildOcean(reflectionTexture) {
  const RINGS = 230, SEG = 200, R0 = 1.4, K = Math.log(6500 / R0 + 1) / RINGS;
  const pos = new Float32Array((RINGS * SEG + 1) * 3);
  let p = 3;
  for (let i = 1; i <= RINGS; i++) {
    const r = R0 * (Math.exp(K * i) - 1);
    for (let j = 0; j < SEG; j++) {
      const a = ((j + (i % 2) * 0.5) / SEG) * Math.PI * 2;
      pos[p++] = Math.cos(a) * r; pos[p++] = 0; pos[p++] = Math.sin(a) * r;
    }
  }
  const idx = [];
  for (let j = 0; j < SEG; j++) idx.push(0, 1 + ((j + 1) % SEG), 1 + j);
  for (let i = 1; i < RINGS; i++) {
    const a0 = 1 + (i - 1) * SEG, b0 = 1 + i * SEG;
    for (let j = 0; j < SEG; j++) {
      const j1 = (j + 1) % SEG;
      idx.push(a0 + j, a0 + j1, b0 + j1, a0 + j, b0 + j1, b0 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);

  const uniforms = Object.assign({}, U, {
    uRefl: { value: reflectionTexture },
    uReflM: { value: new THREE.Matrix4() },
  });
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      varying vec3 vW; varying vec2 vXZ;
      void wave(vec2 xz, vec2 D, float k, float A, float w, float Q, float ph, float fade, inout vec3 disp) {
        float f = k * dot(D, xz) - w * uTime + ph;
        disp.xz += D * (Q * A * cos(f) * fade);
        disp.y += A * sin(f) * fade;
      }
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec2 xz = wp.xz; vXZ = xz;
        float dist = length(wp.xyz - cameraPosition);
        float depth = -hmap(xz);
        vec3 disp = vec3(0.0);
        ${waveCalls('wave', 'disp', 12, 6)}
        disp *= shoreDamp(depth);
        float swash = 0.10 * sin(uTime * 0.85 + nz(xz * 0.011) * 9.0) * (1.0 - smoothstep(0.5, 4.0, depth));
        wp.xyz += disp; wp.y += swash;
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${GLSL_FRAG}
      uniform sampler2D uRefl; uniform mat4 uReflM;
      varying vec3 vW; varying vec2 vXZ;
      void waveN(vec2 xz, vec2 D, float k, float A, float w, float Q, float ph, float fade, inout vec3 n) {
        float f = k * dot(D, xz) - w * uTime + ph;
        float ka = k * A * fade;
        n.xz -= D * (ka * cos(f));
        n.y -= Q * ka * sin(f);
      }
      void main() {
        vec2 xz = vXZ;
        float dist = length(vW - cameraPosition);
        vec3 V = (cameraPosition - vW) / dist;
        float hT = hmap(vW.xz);
        float depth = max(vW.y - hT, 0.0);
        float damp = shoreDamp(-hT);

        vec3 n = vec3(0.0, 1.0, 0.0);
        ${waveCalls('waveN', 'n', 45, 8)}
        n.xz *= damp; n.y = mix(1.0, n.y, damp);
        vec2 d1 = texture2D(uNoise, xz * 0.033 + uTime * vec2(0.011, 0.007)).ba - 0.5;
        vec2 d2 = texture2D(uNoise, xz * 0.105 - uTime * vec2(0.014, -0.019)).ba - 0.5;
        vec2 d3 = texture2D(uNoise, xz * 0.0062 + uTime * vec2(0.0016, 0.0024)).ba - 0.5;
        vec2 d4 = texture2D(uNoise, xz * 0.31 + uTime * vec2(-0.03, 0.022)).ba - 0.5;
        n.xz += (d1 * 0.42 + d2 * 0.30 + d4 * 0.16) * mix(0.45, 1.0, damp) + d3 * 0.13;
        vec3 N = normalize(n);

        float NV = max(dot(N, V), 0.0);
        float F = 0.02 + 0.98 * pow(1.0 - NV, 5.0);
        float far = smoothstep(60.0, 1600.0, dist);
        F = min(F, mix(0.92, 0.70, far));

        vec3 R0 = reflect(-V, N);
        vec3 R = R0; R.y = abs(R.y) + 0.07 * far; R = normalize(R);
        vec3 sky = skyBase(R);
        vec4 cl = clouds(R, sky, 0.0);
        sky = mix(sky, cl.rgb, cl.a);
        // planar reflection of the island (premultiplied alpha)
        vec4 rc = uReflM * vec4(vW.x, 0.0, vW.z, 1.0);
        vec2 ruv = rc.xy / rc.w + N.xz * vec2(0.45, 1.0) * min(1.0, 34.0 / dist);
        vec4 rf = texture2D(uRefl, clamp(ruv, 0.002, 0.998));
        rf *= 0.82;
        sky = sky * (1.0 - rf.a) + rf.rgb;

        // water body
        vec3 irr = uAmbSky * 1.15 + uLightCol * max(uLightDir.y, 0.0) * 0.55;
        float shl = exp(-depth * 0.30);
        vec3 body = mix(vec3(0.010, 0.075, 0.135), vec3(0.14, 0.95, 0.80), shl * shl) * irr;
        body += vec3(0.30, 0.26, 0.17) * irr * exp(-depth * 1.4) * 0.5; // sand showing through
        float crest = smoothstep(0.1, 0.9, vW.y) * damp;
        body += vec3(0.03, 0.22, 0.20) * uLightCol * pow(max(dot(V, -vec3(uLightAz.x, 0.0, uLightAz.y)), 0.0), 3.0) * crest * 0.5;

        vec3 col = mix(body, sky, F);

        // key-light glitter
        float sdot = max(dot(R0, uLightDir), 0.0);
        float spec = pow(sdot, mix(520.0, 150.0, far)) * mix(7.0, 2.6, far);
        col += uLightCol * spec * mix(1.0, 0.6, uNight);

        // lighthouse: lamp streak and sweeping beam
        vec3 Ll = normalize(uLampPos - vW);
        float ld = max(dot(R0, Ll), 0.0);
        float lampAtt = 1.0 / (1.0 + dot(uLampPos - vW, uLampPos - vW) / 30000.0);
        col += uLampCol * uLampOn * pow(ld, 260.0) * 5.0 * lampAtt;
        float cone = beamCone(vW) * uBeamOn * smoothstep(8.0, 30.0, length(vW.xz - uLampPos.xz));
        col += uLampCol * cone * lampAtt * (0.012 + pow(ld, 30.0) * 0.16 + pow(ld, 160.0) * 1.3);

        // foam
        float nA = texture2D(uNoise, xz * 0.045 + uTime * vec2(0.004, 0.006)).r;
        float nB = texture2D(uNoise, xz * 0.23 - uTime * vec2(0.010, 0.004)).g;
        float nC = texture2D(uNoise, xz * 0.61 + uTime * vec2(0.012, -0.008)).r;
        float shore = 1.0 - smoothstep(0.0, 0.60, depth);
        float band = smoothstep(0.50, 0.95, sin(depth * 9.0 + uTime * 1.05 + nA * 7.0) * 0.5 + 0.5);
        float lace = smoothstep(0.38, 0.62, nB * 0.6 + nC * 0.4);
        float foam = shore * (band * 0.75 + 0.25) * smoothstep(0.30, 0.55, nB * 0.5 + nC * 0.5 + shore * 0.45);
        foam = max(foam, smoothstep(0.10, 0.015, depth) * (0.75 + 0.25 * nC));
        foam += (1.0 - smoothstep(0.3, 1.9, depth)) * lace * smoothstep(0.50, 0.80, nA) * 0.30;
        foam += smoothstep(0.85, 1.25, vW.y + (nB - 0.5) * 0.4) * lace * 0.45 * damp * (1.0 - far);
        foam = clamp(foam, 0.0, 1.0);
        vec3 foamCol = vec3(0.92, 0.95, 0.97) * (uAmbSky * 1.25 + uLightCol * 0.42 + uLampCol * cone * lampAtt * 0.2);
        col = mix(col, foamCol, foam);

        float alpha = clamp(1.0 - exp(-depth * 3.4), 0.0, 1.0);
        alpha = max(alpha, max(foam, F * smoothstep(0.0, 0.12, depth)));
        gl_FragColor = finish(applyFog(col, vW), alpha);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}
