import * as THREE from 'three';
import { TAU, createRng, lerp } from './math.js';
import { LIGHTHOUSE_POS } from './terrain-data.js';

const SKY_VERT = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uMidSky;
uniform vec3 uHorizon;
uniform vec3 uAfterglow;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uStarVisibility;

varying vec3 vWorldDir;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbmSky(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise2(p);
    p = rot * p * 2.05;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  float h = clamp(dir.y, 0.0, 1.0);

  // Smooth vertical atmospheric gradient
  vec3 col = mix(uHorizon, uMidSky, smoothstep(0.0, 0.28, pow(h, 0.78)));
  col = mix(col, uZenith, smoothstep(0.22, 0.88, pow(h, 0.85)));

  // Azimuthal sunset / twilight afterglow lobe toward solar horizon
  vec2 horizDir = normalize(vec2(dir.x, dir.z) + 1e-5);
  vec2 sunHoriz = normalize(vec2(uSunDir.x, uSunDir.z) + 1e-5);
  float azDot = max(0.0, dot(horizDir, sunHoriz));
  float horizonBand = exp(-h * 7.5) * pow(azDot, 2.2);
  float twilightStrength = smoothstep(-0.26, 0.14, uSunDir.y);
  col += uAfterglow * horizonBand * 0.68 * twilightStrength;

  // Mie forward scattering halo around sun
  float sunCos = dot(dir, normalize(uSunDir));
  float aboveHorizon = smoothstep(-0.025, 0.015, dir.y);
  float sunVis = smoothstep(-0.10, 0.04, uSunDir.y);
  float mieHalo = pow(max(0.0, sunCos), 10.0) * 0.36 + pow(max(0.0, sunCos), 64.0) * 0.55;
  col += uSunColor * mieHalo * sunVis * aboveHorizon;

  // Crisp solar disc with limb darkening, setting behind the ocean horizon
  float sunAngular = smoothstep(0.99885, 0.99945, sunCos);
  float discHorizonClip = smoothstep(-0.002, 0.006, dir.y);
  vec3 discColor = mix(uSunColor * 1.4, vec3(1.0, 0.98, 0.92) * 2.2, smoothstep(0.9989, 0.9998, sunCos));
  col = mix(col, discColor, sunAngular * discHorizonClip * smoothstep(-0.05, 0.0, uSunDir.y));

  // Subtle Milky Way galactic band at night
  if (uStarVisibility > 0.01) {
    vec3 galAxis = normalize(vec3(0.55, 0.62, -0.56));
    float galPlane = 1.0 - abs(dot(dir, galAxis));
    float band = smoothstep(0.72, 0.99, galPlane) * smoothstep(0.06, 0.38, h);
    float dust = fbmSky(dir.xz * 4.5 + dir.y * 2.5);
    float darkRift = smoothstep(0.42, 0.68, fbmSky(dir.xz * 8.2 - 3.1));
    vec3 milkyColor = mix(vec3(0.05, 0.09, 0.19), vec3(0.12, 0.17, 0.30), dust);
    col += milkyColor * band * (0.55 + 0.65 * dust) * (1.0 - 0.45 * darkRift) * uStarVisibility;
  }

  // Below horizon fallback blends cleanly into horizon fog
  if (dir.y < 0.0) {
    col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.15, dir.y));
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aMag;
attribute vec3 aColor;

uniform float uTime;
uniform float uStarVisibility;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Brightest stars (low aMag) appear earlier at dusk; fainter stars appear deeper into night
  float appearStart = mix(0.03, 0.58, aMag);
  float vis = smoothstep(appearStart, min(1.0, appearStart + 0.38), uStarVisibility);

  // Deterministic atmospheric twinkle (stronger at low altitude, gentler overhead)
  float altFactor = clamp( normalize(position).y, 0.0, 1.0 );
  float twinkleAmp = mix(0.36, 0.12, altFactor);
  float twinkle = 1.0 + twinkleAmp * sin(uTime * (2.1 + aMag * 2.4) + aPhase) * cos(uTime * 1.37 + aPhase * 0.7);

  // Fade near horizon haze
  float horizonFade = smoothstep(0.015, 0.14, altFactor);

  vColor = aColor;
  vAlpha = vis * horizonFade * clamp(twinkle, 0.35, 1.35);
  gl_PointSize = aSize * uPixelRatio * (0.82 + 0.25 * vis);
}
`;

const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  if (vAlpha <= 0.004) discard;
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * 5.2);
  float halo = (1.0 - r) * 0.28;
  float alpha = (core + halo) * vAlpha;
  gl_FragColor = vec4(vColor * (1.0 + core * 0.65), alpha);
}
`;

const CLOUD_VERT = /* glsl */ `
attribute vec3 aCloudBase;
attribute vec3 aCloudScale;
attribute float aCloudSeed;
attribute float aCloudDrift;

uniform float uTime;

varying vec2 vUv;
varying float vSeed;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vSeed = aCloudSeed;

  // Slow deterministic trade-wind drift across sky
  vec3 center = aCloudBase;
  center.x += sin(uTime * 0.012 * aCloudDrift + aCloudSeed) * 18.0 + uTime * 0.38 * aCloudDrift;
  center.z += uTime * 0.14 * aCloudDrift;
  // Wrap gently within sky span so clouds never drift out of bounds
  center.x = mod(center.x + 260.0, 520.0) - 260.0;

  // Camera-facing billboard oriented softly upright for volumetric cumulus silhouette
  vec3 toCam = normalize(cameraPosition - center);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 up = normalize(cross(toCam, right));

  vec3 worldPos = center + right * (position.x * aCloudScale.x) + up * (position.y * aCloudScale.y);
  vWorldPos = worldPos;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
`;

const CLOUD_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uCloudLit;
uniform vec3 uCloudShadow;
uniform vec3 uHorizon;
uniform float uBeamAngle;
uniform float uBeamVisibility;
uniform vec2 uLighthouseXZ;

varying vec2 vUv;
varying float vSeed;
varying vec3 vWorldPos;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 654.21));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbmCloud(vec2 p) {
  float sum = 0.0;
  float amp = 0.52;
  for (int i = 0; i < 4; i++) {
    sum += amp * noise2(p);
    p = p * 2.08 + vec2(1.7, -1.3);
    amp *= 0.5;
  }
  return sum;
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  // Flat-bottomed cumulus dome envelope
  vec2 shaped = vec2(p.x * 0.95, p.y < 0.0 ? p.y * 1.65 : p.y * 1.05);
  float baseMask = 1.0 - dot(shaped, shaped);
  if (baseMask <= -0.25) discard;

  vec2 nUv = vUv * 3.4 + vec2(vSeed * 7.1 + uTime * 0.008, vSeed * 3.3);
  float billow = fbmCloud(nUv);
  float density = smoothstep(0.18, 0.68, baseMask + (billow - 0.48) * 0.62);
  if (density <= 0.01) discard;

  // Vertical + solar directional lighting inside cloud puff
  vec3 viewDir = normalize(vWorldPos - cameraPosition);
  float sunForward = pow(max(0.0, dot(viewDir, normalize(uSunDir))), 5.0);
  float topLight = smoothstep(-0.35, 0.65, p.y + (billow - 0.5) * 0.45);
  float rim = (1.0 - density) * 0.65 + topLight * 0.55;

  vec3 col = mix(uCloudShadow, uCloudLit, clamp(topLight * 0.82 + sunForward * 0.45, 0.0, 1.0));
  // Silver-gold lining near sun
  float sunUp = smoothstep(-0.14, 0.12, uSunDir.y);
  col += uCloudLit * sunForward * rim * 0.55 * sunUp;

  // Subtle warm lighthouse sweep bounce on low coastal clouds at night
  if (uBeamVisibility > 0.01) {
    vec2 rel = vWorldPos.xz - uLighthouseXZ;
    vec2 dirXZ = normalize(rel + 1e-4);
    vec2 beamDir = vec2(cos(uBeamAngle), sin(uBeamAngle));
    float align = abs(dot(dirXZ, beamDir)); // Twin opposing beams
    float sweep = pow(smoothstep(0.92, 1.0, align), 3.0);
    float distAtten = exp(-length(rel) * 0.0065);
    col += vec3(1.0, 0.78, 0.42) * sweep * distAtten * uBeamVisibility * (1.0 - topLight) * 0.28;
  }

  // Distance horizon blend
  float dist = length(vWorldPos.xz);
  float horizonFade = smoothstep(420.0, 160.0, dist);
  col = mix(uHorizon * 0.82, col, horizonFade);

  gl_FragColor = vec4(col, density * 0.78 * horizonFade);
}
`;

function createStarfield(pixelRatio) {
  const rng = createRng(424242);
  const count = 1900;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const mags = new Float32Array(count);

  const spectralPalette = [
    [0.74, 0.84, 1.0],  // Blue-white B/A star
    [0.92, 0.95, 1.0],  // Crisp white star
    [1.0, 0.96, 0.88],  // Warm solar white-gold
    [1.0, 0.86, 0.68],  // Amber K-type star
    [1.0, 0.76, 0.60],  // Soft coral-orange M star
  ];

  const radius = 740;
  for (let i = 0; i < count; i++) {
    // Concentrate 35% of stars gently toward the diagonal Milky Way band
    let dirX;
    let dirY;
    let dirZ;
    if (i < count * 0.35) {
      const theta = rng() * TAU;
      const spread = (rng() - 0.5) * (rng() + 0.15) * 0.52;
      // Rotate into galactic plane
      const lx = Math.cos(theta);
      const ly = spread;
      const lz = Math.sin(theta);
      dirX = lx * 0.82 - ly * 0.42 + lz * 0.38;
      dirY = Math.abs(lx * 0.45 + ly * 0.78 - lz * 0.42) + 0.02;
      dirZ = -lx * 0.35 + ly * 0.46 + lz * 0.81;
    } else {
      const u = rng();
      const v = rng();
      const theta = u * TAU;
      // Upper hemisphere y in [0.02, 1.0]
      dirY = 0.02 + Math.pow(v, 0.88) * 0.98;
      const rHoriz = Math.sqrt(Math.max(0, 1 - dirY * dirY));
      dirX = Math.cos(theta) * rHoriz;
      dirZ = Math.sin(theta) * rHoriz;
    }

    const len = Math.hypot(dirX, dirY, dirZ) || 1;
    positions[i * 3 + 0] = (dirX / len) * radius;
    positions[i * 3 + 1] = (dirY / len) * radius;
    positions[i * 3 + 2] = (dirZ / len) * radius;

    const mag = Math.pow(rng(), 0.58); // 0 = very bright, 1 = faint
    mags[i] = mag;
    sizes[i] = lerp(3.6, 1.05, mag);
    phases[i] = rng() * TAU;

    const spec = spectralPalette[Math.min(spectralPalette.length - 1, Math.floor(Math.pow(rng(), 1.25) * spectralPalette.length))];
    const brightness = lerp(1.15, 0.55, mag);
    colors[i * 3 + 0] = spec[0] * brightness;
    colors[i * 3 + 1] = spec[1] * brightness;
    colors[i * 3 + 2] = spec[2] * brightness;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geom.setAttribute('aMag', new THREE.BufferAttribute(mags, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uStarVisibility: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
  });

  const points = new THREE.Points(geom, mat);
  points.frustumCulled = false;
  points.renderOrder = 1;
  return points;
}

function createClouds() {
  const rng = createRng(9091);
  const puffCount = 58;
  const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
  const geom = new THREE.InstancedBufferGeometry();
  geom.index = plane.index;
  geom.attributes.position = plane.attributes.position;
  geom.attributes.uv = plane.attributes.uv;

  const bases = new Float32Array(puffCount * 3);
  const scales = new Float32Array(puffCount * 3);
  const seeds = new Float32Array(puffCount);
  const drifts = new Float32Array(puffCount);

  for (let i = 0; i < puffCount; i++) {
    // Place cumulus clusters in scenic ring around distant horizon, prioritizing N/NW/NE sky visible in 9:16
    const biasNorth = i < 38;
    const angle = biasNorth
      ? lerp(-Math.PI * 0.92, -Math.PI * 0.08, rng())
      : rng() * TAU;
    const dist = lerp(145, 340, rng());
    const y = lerp(42, 96, Math.pow(rng(), 0.85));

    bases[i * 3 + 0] = Math.cos(angle) * dist;
    bases[i * 3 + 1] = y;
    bases[i * 3 + 2] = Math.sin(angle) * dist;

    const w = lerp(44, 105, rng());
    const h = w * lerp(0.42, 0.64, rng());
    scales[i * 3 + 0] = w;
    scales[i * 3 + 1] = h;
    scales[i * 3 + 2] = 1;

    seeds[i] = rng() * 100;
    drifts[i] = lerp(0.65, 1.35, rng());
  }

  geom.setAttribute('aCloudBase', new THREE.InstancedBufferAttribute(bases, 3));
  geom.setAttribute('aCloudScale', new THREE.InstancedBufferAttribute(scales, 3));
  geom.setAttribute('aCloudSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geom.setAttribute('aCloudDrift', new THREE.InstancedBufferAttribute(drifts, 1));
  geom.instanceCount = puffCount;

  const mat = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 0.4, -1) },
      uCloudLit: { value: new THREE.Color(0xfff0d6) },
      uCloudShadow: { value: new THREE.Color(0x6e80a3) },
      uHorizon: { value: new THREE.Color(0xf5c98c) },
      uBeamAngle: { value: 0 },
      uBeamVisibility: { value: 0 },
      uLighthouseXZ: { value: new THREE.Vector2(LIGHTHOUSE_POS.x, LIGHTHOUSE_POS.z) },
    },
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

export function createSkySystem(pixelRatio = 1) {
  const group = new THREE.Group();

  const skyGeo = new THREE.SphereGeometry(820, 48, 32);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color() },
      uMidSky: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uAfterglow: { value: new THREE.Color() },
      uSunColor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3() },
      uStarVisibility: { value: 0 },
    },
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.frustumCulled = false;
  skyDome.renderOrder = 0;

  const stars = createStarfield(pixelRatio);
  const clouds = createClouds();

  group.add(skyDome, stars, clouds);

  return {
    group,
    setPixelRatio(dpr) {
      stars.material.uniforms.uPixelRatio.value = dpr;
    },
    update(t, atmo, cameraPos) {
      // Keep sky & stars centered on camera X/Z so horizon is infinitely far
      skyDome.position.set(cameraPos.x, 0, cameraPos.z);
      stars.position.set(cameraPos.x, 0, cameraPos.z);

      const su = skyMat.uniforms;
      su.uZenith.value.copy(atmo.zenith);
      su.uMidSky.value.copy(atmo.midSky);
      su.uHorizon.value.copy(atmo.horizon);
      su.uAfterglow.value.copy(atmo.afterglow);
      su.uSunColor.value.copy(atmo.sunColor);
      su.uSunDir.value.copy(atmo.sunDir);
      su.uStarVisibility.value = atmo.starVisibility;

      const stu = stars.material.uniforms;
      stu.uTime.value = t;
      stu.uStarVisibility.value = atmo.starVisibility;

      const cu = clouds.material.uniforms;
      cu.uTime.value = t;
      cu.uSunDir.value.copy(atmo.sunDir);
      cu.uCloudLit.value.copy(atmo.cloudLit);
      cu.uCloudShadow.value.copy(atmo.cloudShadow);
      cu.uHorizon.value.copy(atmo.horizon);
      cu.uBeamAngle.value = atmo.beamAngle;
      cu.uBeamVisibility.value = atmo.beamVisibility;
    },
  };
}
