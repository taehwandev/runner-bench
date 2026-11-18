import * as THREE from 'three';
import { mulberry32 } from './prng.js';

export function createSkySystem() {
  const group = new THREE.Group();

  // 1. Procedural Atmospheric Sky Dome (Sun, Moon, Milky Way, High Clouds)
  const skyGeo = new THREE.SphereGeometry(420, 36, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-0.7, 0.3, -0.5).normalize() },
      uMoonDir: { value: new THREE.Vector3(0.5, 0.4, 0.5).normalize() },
      uZenith: { value: new THREE.Color(0x1a5da8) },
      uMid: { value: new THREE.Color(0x4f98cf) },
      uHorizon: { value: new THREE.Color(0xf4d4a6) },
      uSunGlow: { value: new THREE.Color(0xffe09c) },
      uCloudLit: { value: new THREE.Color(0xfff6e8) },
      uCloudShadow: { value: new THREE.Color(0x90aec8) },
      uStarAlpha: { value: 0 },
      uMoonAlpha: { value: 0 },
      uNightFactor: { value: 0 },
      uSunsetFactor: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldDir;

      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunGlow;
      uniform vec3 uCloudLit;
      uniform vec3 uCloudShadow;
      uniform float uStarAlpha;
      uniform float uMoonAlpha;
      uniform float uNightFactor;
      uniform float uSunsetFactor;

      float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
        for (int i = 0; i < 4; i++) {
          v += a * noise2(p);
          p = rot * p * 2.04;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);

        // Smooth 3-stop atmospheric sky gradient
        vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.24, h));
        sky = mix(sky, uZenith, smoothstep(0.18, 0.78, h));

        // Subtle below-horizon mirror haze
        if (dir.y < 0.0) {
          sky = mix(uHorizon, uHorizon * 0.45, clamp(-dir.y * 4.0, 0.0, 1.0));
        }

        // Directional sunset/afterglow warmth near sun azimuth
        float sunDot = dot(dir, normalize(uSunDir));
        float sunVis = smoothstep(-0.18, 0.04, uSunDir.y);
        float horizonBand = exp(-abs(dir.y) * 5.8);
        float azimGlow = pow(max(sunDot, 0.0), 3.0) * horizonBand;
        sky += uSunGlow * azimGlow * (0.48 + 0.55 * uSunsetFactor) * (1.0 - uNightFactor * 0.85);

        // Broad Mie scattering halo around sun
        float mieHalo = pow(max(sunDot, 0.0), 18.0) * 0.55 + pow(max(sunDot, 0.0), 120.0) * 1.1;
        sky += uSunGlow * mieHalo * sunVis;

        // Crisp sun disk with soft limb darkening
        float sunDisk = smoothstep(0.9982, 0.99945, sunDot) * smoothstep(-0.025, 0.015, dir.y) * sunVis;
        vec3 sunCoreCol = mix(vec3(1.0, 0.96, 0.86), vec3(1.0, 0.62, 0.34), uSunsetFactor);
        sky += sunCoreCol * sunDisk * 3.8;

        // Milky Way band arching diagonally across the portrait night sky
        if (uStarAlpha > 0.001 && dir.y > 0.0) {
          // Tilted galactic plane aligned for dramatic diagonal sweep in Shots 4 & 5
          vec3 galNormal = normalize(vec3(0.76, -0.52, -0.39));
          float galDist = abs(dot(dir, galNormal));
          float band = exp(-galDist * galDist * 14.0);
          vec2 galUV = vec2(atan(dir.z, dir.x) * 2.8, dir.y * 5.8);
          float dust = fbm(galUV * 2.2 + vec2(3.1, 1.7));
          float rift = smoothstep(0.30, 0.68, fbm(galUV * 4.5 - vec2(1.4, 2.8)));
          float mw = band * (0.38 + 0.62 * dust) * (1.0 - 0.52 * rift) * smoothstep(0.04, 0.32, dir.y);
          vec3 mwCol = mix(vec3(0.22, 0.36, 0.66), vec3(0.56, 0.46, 0.72), dust);
          sky += mwCol * mw * uStarAlpha * 0.68;
        }

        // Luminous Moon with subtle crescent-gibbous shading and silver halo
        if (uMoonAlpha > 0.001) {
          vec3 mDir = normalize(uMoonDir);
          float mDot = dot(dir, mDir);
          float moonHalo = pow(max(mDot, 0.0), 22.0) * 0.28 + pow(max(mDot, 0.0), 180.0) * 0.72;
          sky += vec3(0.68, 0.82, 1.0) * moonHalo * uMoonAlpha;

          float moonRadius = 0.99915;
          float moonMask = smoothstep(moonRadius - 0.00024, moonRadius + 0.00018, mDot);
          if (moonMask > 0.001) {
            vec3 mUp = vec3(0.0, 1.0, 0.0);
            vec3 mRight = normalize(cross(mUp, mDir));
            vec3 mOrthoUp = cross(mDir, mRight);
            vec2 mUV = vec2(dot(dir - mDir, mRight), dot(dir - mDir, mOrthoUp)) * 34.0;
            float maria = fbm(mUV * 2.4 + vec2(4.2, 1.8));
            float phase = smoothstep(-0.45, 0.35, mUV.x + 0.52);
            vec3 moonCol = mix(vec3(0.80, 0.88, 0.98), vec3(1.0, 0.99, 0.95), maria) * (0.42 + 0.58 * phase);
            sky = mix(sky, moonCol * 1.75, moonMask * uMoonAlpha);
          }
        }

        // Procedural drifting cloud layer projected on upper sky dome
        if (dir.y > 0.015) {
          vec2 cloudUV = dir.xz / (dir.y + 0.24) * 0.85;
          vec2 drift = vec2(uTime * 0.014, uTime * 0.006);
          float c1 = fbm(cloudUV * 1.25 + drift);
          float c2 = fbm(cloudUV * 2.6 - drift * 0.6 + vec2(5.2, 1.9));
          float density = smoothstep(0.47, 0.78, c1 * 0.72 + c2 * 0.34);

          // Fade clouds cleanly toward horizon to avoid aliasing
          float horizFade = smoothstep(0.015, 0.20, dir.y);
          density *= horizFade;

          // Cloud lighting: silver lining toward sun/moon + fiery sunset underside
          float lightDot = mix(max(sunDot, 0.0), max(dot(dir, normalize(uMoonDir)), 0.0), uNightFactor);
          float edgeLit = smoothstep(0.15, 0.85, c2) * 0.55 + pow(lightDot, 4.0) * 0.75;
          vec3 cCol = mix(uCloudShadow, uCloudLit, clamp(edgeLit, 0.0, 1.0));
          // Extra sunset rim glow near sun
          cCol += uSunGlow * pow(max(sunDot, 0.0), 6.0) * (1.0 - density * 0.4) * (0.35 + 0.45 * uSunsetFactor) * (1.0 - uNightFactor);

          sky = mix(sky, cCol, density * (0.82 - 0.35 * uNightFactor));
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyMesh);

  // 2. Deterministic Twinkling Starfield
  const starCount = 2400;
  const rand = mulberry32(90210);
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starColors = new Float32Array(starCount * 3);
  const starPhases = new Float32Array(starCount);

  const palette = [
    new THREE.Color(0xcad8ff), // blue-white
    new THREE.Color(0xffffff), // pure white
    new THREE.Color(0xfff1d6), // warm white
    new THREE.Color(0xffd7a8), // pale gold
    new THREE.Color(0xb2d8ff), // pale cyan
  ];

  for (let i = 0; i < starCount; i++) {
    // Upper hemisphere biased slightly above horizon
    const u = rand();
    const v = rand();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(0.03 + v * 0.97);
    const r = 385;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    // Power-law star brightness distribution (hero stars + dense delicate pinpoints)
    const mag = Math.pow(rand(), 2.8);
    starSizes[i] = 1.8 + mag * 5.6;
    starPhases[i] = rand() * Math.PI * 2;

    const col = palette[Math.floor(rand() * palette.length)];
    const bright = 0.72 + mag * 0.28;
    starColors[i * 3] = col.r * bright;
    starColors[i * 3 + 1] = col.g * bright;
    starColors[i * 3 + 2] = col.b * bright;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));

  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aColor;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vElevFade;
      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vColor = aColor;
        float speed = 1.4 + fract(aPhase * 1.7) * 2.2;
        vTwinkle = 0.68 + 0.32 * sin(uTime * speed + aPhase);
        vec3 dir = normalize(position);
        vElevFade = smoothstep(0.05, 0.25, dir.y);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = aSize * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vElevFade;
      uniform float uAlpha;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = exp(-d * d * 18.0);
        float alpha = core * vTwinkle * vElevFade * uAlpha;
        gl_FragColor = vec4(vColor * 1.75, alpha);
      }
    `,
  });

  const starPoints = new THREE.Points(starGeo, starMat);
  group.add(starPoints);

  function update(t, atmo, pixelRatio) {
    skyMat.uniforms.uTime.value = t;
    skyMat.uniforms.uSunDir.value.copy(atmo.sunDir);
    skyMat.uniforms.uMoonDir.value.copy(atmo.moonDir);
    skyMat.uniforms.uZenith.value.copy(atmo.skyZenith);
    skyMat.uniforms.uMid.value.copy(atmo.skyMid);
    skyMat.uniforms.uHorizon.value.copy(atmo.skyHorizon);
    skyMat.uniforms.uSunGlow.value.copy(atmo.sunGlow);
    skyMat.uniforms.uCloudLit.value.copy(atmo.cloudLit);
    skyMat.uniforms.uCloudShadow.value.copy(atmo.cloudShadow);
    skyMat.uniforms.uStarAlpha.value = atmo.starAlpha;
    skyMat.uniforms.uMoonAlpha.value = atmo.moonAlpha;
    skyMat.uniforms.uNightFactor.value = atmo.nightFactor;
    skyMat.uniforms.uSunsetFactor.value = atmo.sunsetFactor;

    starMat.uniforms.uTime.value = t;
    starMat.uniforms.uAlpha.value = atmo.starAlpha;
    starMat.uniforms.uPixelRatio.value = pixelRatio;
    starPoints.visible = atmo.starAlpha > 0.002;
  }

  return { group, update };
}
