import * as THREE from 'three';
import { TAU, lerp } from './math.js';
import { ISLAND_WORLD_EXTENT, LIGHTHOUSE_POS } from './terrain-data.js';

const OCEAN_VERT = /* glsl */ `
uniform float uTime;
uniform sampler2D uBathymetry;
uniform float uIslandExtent;

varying vec3 vWorldPos;
varying float vWaveCrest;
varying vec2 vBathyUv;

vec4 sampleBathy(vec2 xz) {
  vec2 uv = (xz + uIslandExtent) / (2.0 * uIslandExtent);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return vec4(0.0, 1.0, 0.0, 0.0);
  }
  return texture2D(uBathymetry, uv);
}

vec3 gerstnerWave(vec2 pos, vec2 dir, float amp, float wavelength, float speed, float t, inout float crest) {
  float k = 6.2831853 / wavelength;
  float phase = k * dot(dir, pos) - speed * t;
  float s = sin(phase);
  float c = cos(phase);
  crest += max(0.0, s) * amp * 2.2;
  return vec3(dir.x * amp * 0.55 * c, amp * s, dir.y * amp * 0.55 * c);
}

void main() {
  vec3 pos = position;
  vec4 bathy = sampleBathy(pos.xz);
  float terrainH = bathy.r * 28.0 - 14.0;
  float depth = max(0.0, -terrainH);

  // Smoothly damp geometric wave height past r=95m so outer horizon rings never alias
  float r = length(pos.xz);
  float geomFade = smoothstep(165.0, 75.0, r);
  float shoal = smoothstep(0.08, 1.8, depth) * (1.0 + 0.28 * smoothstep(5.0, 1.5, depth));
  float ampScale = shoal * geomFade;

  float crest = 0.0;
  vec3 disp = vec3(0.0);
  disp += gerstnerWave(pos.xz, normalize(vec2(-0.28, -0.96)), 0.24 * ampScale, 19.0, 1.85, uTime, crest);
  disp += gerstnerWave(pos.xz, normalize(vec2(0.46, -0.89)), 0.15 * ampScale, 12.2, 2.25, uTime, crest);
  disp += gerstnerWave(pos.xz, normalize(vec2(-0.76, -0.65)), 0.09 * ampScale, 7.6, 2.65, uTime, crest);
  disp += gerstnerWave(pos.xz, normalize(vec2(0.22, 0.97)), 0.06 * ampScale, 4.9, 3.05, uTime, crest);

  // Gentle shoreline run-up wash on the beach
  float sdfMeters = (bathy.g * 2.0 - 1.0) * 28.0;
  float swash = sin(sdfMeters * 1.55 + uTime * 2.40) * 0.065 * smoothstep(4.5, 0.0, abs(sdfMeters));

  vec3 world = vec3(pos.x + disp.x, disp.y + swash, pos.z + disp.z);
  vWorldPos = world;
  vWaveCrest = crest;
  vBathyUv = (world.xz + uIslandExtent) / (2.0 * uIslandExtent);

  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const OCEAN_FRAG = /* glsl */ `
uniform float uTime;
uniform sampler2D uBathymetry;
uniform float uIslandExtent;

uniform vec3 uZenith;
uniform vec3 uMidSky;
uniform vec3 uHorizon;
uniform vec3 uAfterglow;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uSunIntensity;
uniform vec3 uMoonDir;
uniform float uMoonIntensity;

uniform vec3 uWaterDeep;
uniform vec3 uWaterShallow;
uniform vec3 uFogColor;
uniform float uFogDensity;

uniform vec3 uLighthousePos;
uniform float uLighthousePower;
uniform float uBeamAngle;

varying vec3 vWorldPos;
varying float vWaveCrest;
varying vec2 vBathyUv;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.5);
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

float fbmFoam(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    v += a * noise2(p);
    p = rot * p * 2.12;
    a *= 0.5;
  }
  return v;
}

// Analytical multi-octave directional wave slope (anti-aliased by distance)
vec3 evalWaveSlopeAndHeight(vec2 xz, float t, float distCam) {
  vec2 slope = vec2(0.0);
  float heightSum = 0.0;

  // 8 octaves from 19m ocean swell down to 0.45m wind ripples
  vec2 dirs[8];
  dirs[0] = vec2(-0.28, -0.96);
  dirs[1] = vec2(0.45, -0.89);
  dirs[2] = vec2(-0.76, -0.65);
  dirs[3] = vec2(0.22, 0.97);
  dirs[4] = vec2(-0.53, 0.85);
  dirs[5] = vec2(0.86, -0.51);
  dirs[6] = vec2(-0.91, 0.41);
  dirs[7] = vec2(0.38, -0.92);

  float freqs[8];
  freqs[0] = 0.33; freqs[1] = 0.52; freqs[2] = 0.83; freqs[3] = 1.28;
  freqs[4] = 2.15; freqs[5] = 3.65; freqs[6] = 6.20; freqs[7] = 10.8;

  float amps[8];
  amps[0] = 0.22; amps[1] = 0.14; amps[2] = 0.085; amps[3] = 0.052;
  amps[4] = 0.032; amps[5] = 0.019; amps[6] = 0.011; amps[7] = 0.0065;

  float speeds[8];
  speeds[0] = 1.85; speeds[1] = 2.25; speeds[2] = 2.65; speeds[3] = 3.05;
  speeds[4] = 3.45; speeds[5] = 4.10; speeds[6] = 4.85; speeds[7] = 5.60;

  for (int i = 0; i < 8; i++) {
    // Attenuate ultra-fine ripples at far distances to prevent pixel shimmer while keeping swells alive to horizon
    float atten = exp(-distCam * freqs[i] * 0.0022);
    float ph = dot(dirs[i], xz) * freqs[i] - t * speeds[i];
    // Sharpen wave crests slightly using 2nd harmonic
    float c = cos(ph) + 0.28 * cos(2.0 * ph);
    float s = sin(ph) + 0.14 * sin(2.0 * ph);
    slope += dirs[i] * (amps[i] * freqs[i] * c * atten);
    heightSum += amps[i] * s * atten;
  }

  return vec3(slope, heightSum);
}

vec3 evalSkyReflection(vec3 dir) {
  float h = clamp(abs(dir.y), 0.0, 1.0);
  vec3 col = mix(uHorizon, uMidSky, smoothstep(0.0, 0.30, pow(h, 0.8)));
  col = mix(col, uZenith, smoothstep(0.24, 0.90, pow(h, 0.85)));

  vec2 horizDir = normalize(vec2(dir.x, dir.z) + 1e-5);
  vec2 sunHoriz = normalize(vec2(uSunDir.x, uSunDir.z) + 1e-5);
  float azDot = max(0.0, dot(horizDir, sunHoriz));
  float horizonBand = exp(-h * 6.5) * pow(azDot, 2.0);
  float twilightStrength = smoothstep(-0.26, 0.16, uSunDir.y);
  col += uAfterglow * horizonBand * 0.72 * twilightStrength;
  return col;
}

void main() {
  bool inIslandBounds = vBathyUv.x >= 0.0 && vBathyUv.x <= 1.0 && vBathyUv.y >= 0.0 && vBathyUv.y <= 1.0;
  vec4 bathy = inIslandBounds ? texture2D(uBathymetry, vBathyUv) : vec4(0.0, 1.0, 0.0, 0.0);

  float terrainH = bathy.r * 28.0 - 14.0;
  float sdfMeters = inIslandBounds ? (bathy.g * 2.0 - 1.0) * 28.0 : 40.0;
  float cliffness = bathy.b;
  float coastalOcc = bathy.a;

  float waterDepth = vWorldPos.y - terrainH;
  if (waterDepth < -0.14) discard;

  float distCam = length(vWorldPos - cameraPosition);
  vec3 wh = evalWaveSlopeAndHeight(vWorldPos.xz, uTime, distCam);
  // Calm fine chop slightly in ultra-shallow beach swash (< 0.6m)
  float shallowCalm = mix(0.45, 1.0, smoothstep(0.0, 0.9, waterDepth));
  vec3 N = normalize(vec3(-wh.x * shallowCalm, 1.0, -wh.y * shallowCalm));

  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdotV = max(0.04, dot(N, V));

  // Tempered Fresnel so foreground ocean swells retain rich translucent water color
  float fresnel = clamp(0.035 + 0.66 * pow(1.0 - NdotV, 4.1), 0.035, 0.72);

  // Tropical bathymetry: deep Pacific cobalt -> vibrant turquoise lagoon -> golden sandy swash
  float lagoonMask = exp(-max(0.0, waterDepth) * 0.36);
  vec3 baseWater = mix(uWaterDeep, uWaterShallow, lagoonMask);

  float sandSwashMask = exp(-max(0.0, waterDepth) * 1.85) * (1.0 - cliffness);
  vec3 sandTint = mix(vec3(0.06, 0.15, 0.24), vec3(0.84, 0.76, 0.58), clamp(uSunIntensity * 0.38, 0.08, 1.0));
  baseWater = mix(baseWater, sandTint, sandSwashMask * 0.52);

  // Backlit emerald-turquoise subsurface scattering in wave crests
  vec3 sunDirN = normalize(uSunDir);
  float sunAbove = smoothstep(-0.06, 0.08, sunDirN.y);
  float backLight = pow(max(0.0, dot(V, -sunDirN)), 2.6);
  float sss = (vWaveCrest * 0.85 + max(0.0, wh.z) * 1.4) * (0.35 + 0.65 * backLight) * sunAbove;
  baseWater += mix(vec3(0.05, 0.52, 0.54), uSunColor * 0.5, 0.32) * sss * 0.75;

  // Sky reflection with subtle island silhouette reflection darkening
  vec3 R = reflect(-V, N);
  R.y = abs(R.y) * 0.88 + 0.03;
  vec3 skyRefl = evalSkyReflection(R);
  float islandReflMask = coastalOcc * smoothstep(0.32, 0.02, R.y) * 0.48;
  skyRefl *= (1.0 - islandReflMask);

  vec3 color = mix(baseWater, skyRefl, fresnel);

  // Sparkling solar glitter path across moving wave facets
  if (sunAbove > 0.001) {
    vec3 H = normalize(sunDirN + V);
    float NdotH = max(0.0, dot(N, H));
    float sunBlocked = coastalOcc * smoothstep(0.24, 0.02, sunDirN.y) * smoothstep(-0.15, 0.55, dot(normalize(vWorldPos.xz + 1e-4), -sunDirN.xz));
    float shadowMask = 1.0 - sunBlocked * 0.78;
    float glintSparkle = pow(NdotH, 320.0) * 4.2;
    float glintPath = pow(NdotH, 34.0) * 0.48;
    color += uSunColor * (glintSparkle + glintPath) * sunAbove * shadowMask * (0.45 + 0.55 * uSunIntensity);
  }

  // Cool silver-blue moonlit wave highlights at night
  if (uMoonIntensity > 0.01) {
    vec3 Hm = normalize(normalize(uMoonDir) + V);
    float mSpec = pow(max(0.0, dot(N, Hm)), 110.0) * 0.68 + pow(max(0.0, dot(N, Hm)), 20.0) * 0.14;
    color += vec3(0.58, 0.76, 1.0) * mSpec * uMoonIntensity;
  }

  // Rotating lighthouse beam reflection streak across dark ocean waves
  if (uLighthousePower > 0.01) {
    vec2 relXZ = vWorldPos.xz - uLighthousePos.xz;
    float distLH = length(relXZ);
    vec2 dirLH = relXZ / max(0.001, distLH);
    vec2 beamDir = vec2(cos(uBeamAngle), sin(uBeamAngle));
    float beamAlign = abs(dot(dirLH, beamDir));
    float cone = pow(smoothstep(0.93, 1.0, beamAlign), 2.2);
    vec3 lightVec = normalize(uLighthousePos - vWorldPos);
    vec3 Hl = normalize(lightVec + V);
    float waveCatch = 0.25 + 2.2 * pow(max(0.0, dot(N, Hl)), 26.0);
    float rangeFade = smoothstep(4.0, 14.0, distLH) * exp(-distLH * 0.013);
    color += vec3(1.0, 0.78, 0.42) * cone * waveCatch * rangeFade * uLighthousePower * 1.35;
  }

  // Crisp multi-layered lacy shoreline surf & cliff splash foam
  if (sdfMeters < 13.5 && sdfMeters > -1.2) {
    float n1 = fbmFoam(vWorldPos.xz * 1.45 + vec2(uTime * 0.16, -uTime * 0.20));
    float n2 = fbmFoam(vWorldPos.xz * 4.2 - vec2(uTime * 0.32, uTime * 0.24));
    // Cellular foam web pattern (sharp white veins with translucent water holes)
    float laceWeb = smoothstep(0.34, 0.72, n2 + (1.0 - abs(n1 * 2.0 - 1.0)) * 0.35);

    // Asymmetric breaking surf crests rolling inward toward shore (sdfMeters -> 0)
    float wavePhase = sdfMeters * 1.85 + uTime * 2.40 + (n1 - 0.5) * 1.9;
    float sWave = sin(wavePhase);
    float crestLine = pow(max(0.0, sWave), 3.2) * smoothstep(11.5, 0.5, sdfMeters) * smoothstep(-0.3, 0.35, sdfMeters);
    float trailingLace = max(0.0, sin(wavePhase - 0.8)) * laceWeb * 0.55 * smoothstep(7.5, 0.4, sdfMeters);

    // Crisp shoreline swash ribbon + cliff base splash
    float swashOsc = 0.35 * sin(uTime * 2.40 + n1 * 3.0);
    float waterEdgeRibbon = smoothstep(0.85 + swashOsc, 0.05, abs(sdfMeters - 0.25)) * (0.55 + 0.45 * laceWeb);
    float cliffFoam = cliffness * smoothstep(2.8, 0.0, sdfMeters) * laceWeb * (0.65 + 0.35 * sin(uTime * 3.2 + n1 * 4.0));

    float foamTotal = clamp(waterEdgeRibbon * 0.92 + crestLine * (0.55 + 0.55 * laceWeb) + trailingLace + cliffFoam * 0.95, 0.0, 1.0);

    vec3 foamDay = mix(vec3(0.95, 0.97, 1.0), uSunColor + vec3(0.32), clamp(0.32 * sunAbove, 0.0, 0.42));
    vec3 foamNight = vec3(0.46, 0.58, 0.76) * (0.48 + 0.72 * uMoonIntensity);
    vec3 foamColor = mix(foamNight, foamDay, smoothstep(-0.12, 0.18, uSunDir.y));
    color = mix(color, foamColor, foamTotal * 0.92);
  }

  // Subtle whitecap flecks on open ocean crests
  float openCap = smoothstep(0.36, 0.54, vWaveCrest + wh.z * 0.6) * smoothstep(220.0, 25.0, distCam) * 0.28;
  vec3 capCol = mix(vec3(0.36, 0.48, 0.66), vec3(0.95, 0.97, 1.0), smoothstep(-0.1, 0.15, uSunDir.y));
  color = mix(color, capCol, openCap);

  // Exponential distance fog matching scene atmosphere
  float fogFactor = 1.0 - exp(-pow(distCam * uFogDensity, 2.0));
  color = mix(color, uFogColor, clamp(fogFactor, 0.0, 1.0));

  // Crisp feathered edge over wet beach sand
  float shoreAlpha = smoothstep(-0.12, 0.14, waterDepth);
  gl_FragColor = vec4(color, shoreAlpha);
}
`;

function createPolarOceanGeometry() {
  const radialSegs = 160;
  const innerRings = 132;
  const outerRings = 40;
  const totalRings = innerRings + outerRings;
  const innerMaxR = 115.0; // High density across ALL camera positions (0..86m)
  const outerMaxR = 820.0;

  const vertCount = (totalRings + 1) * (radialSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const indices = new Uint32Array(totalRings * radialSegs * 6);

  let vPtr = 0;
  for (let ir = 0; ir <= totalRings; ir++) {
    let r;
    if (ir <= innerRings) {
      const u = ir / innerRings;
      r = innerMaxR * Math.pow(u, 1.18);
    } else {
      const u = (ir - innerRings) / outerRings;
      r = lerp(innerMaxR, outerMaxR, Math.pow(u, 1.85));
    }

    for (let ia = 0; ia <= radialSegs; ia++) {
      const theta = (ia / radialSegs) * TAU;
      positions[vPtr++] = Math.cos(theta) * r;
      positions[vPtr++] = 0;
      positions[vPtr++] = Math.sin(theta) * r;
    }
  }

  let iPtr = 0;
  const stride = radialSegs + 1;
  for (let ir = 0; ir < totalRings; ir++) {
    for (let ia = 0; ia < radialSegs; ia++) {
      const a = ir * stride + ia;
      const b = a + stride;
      const c = a + 1;
      const d = b + 1;
      indices[iPtr++] = a;
      indices[iPtr++] = b;
      indices[iPtr++] = c;
      indices[iPtr++] = c;
      indices[iPtr++] = b;
      indices[iPtr++] = d;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  return geom;
}

export function createOceanSystem(bathymetryTex) {
  const geom = createPolarOceanGeometry();
  const mat = new THREE.ShaderMaterial({
    vertexShader: OCEAN_VERT,
    fragmentShader: OCEAN_FRAG,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uBathymetry: { value: bathymetryTex },
      uIslandExtent: { value: ISLAND_WORLD_EXTENT },
      uZenith: { value: new THREE.Color() },
      uMidSky: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uAfterglow: { value: new THREE.Color() },
      uSunColor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.4, -1) },
      uSunIntensity: { value: 3.0 },
      uMoonDir: { value: new THREE.Vector3(0.5, 0.7, 0.5) },
      uMoonIntensity: { value: 0.0 },
      uWaterDeep: { value: new THREE.Color(0x062d54) },
      uWaterShallow: { value: new THREE.Color(0x16a7a8) },
      uFogColor: { value: new THREE.Color() },
      uFogDensity: { value: 0.0024 },
      uLighthousePos: { value: new THREE.Vector3(LIGHTHOUSE_POS.x, 20.6, LIGHTHOUSE_POS.z) },
      uLighthousePower: { value: 0 },
      uBeamAngle: { value: 0 },
    },
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;

  return {
    mesh,
    update(t, atmo) {
      const u = mat.uniforms;
      u.uTime.value = t;
      u.uZenith.value.copy(atmo.zenith);
      u.uMidSky.value.copy(atmo.midSky);
      u.uHorizon.value.copy(atmo.horizon);
      u.uAfterglow.value.copy(atmo.afterglow);
      u.uSunColor.value.copy(atmo.sunColor);
      u.uSunDir.value.copy(atmo.sunDir);
      u.uSunIntensity.value = atmo.sunIntensity;
      u.uMoonDir.value.copy(atmo.moonDir);
      u.uMoonIntensity.value = atmo.moonIntensity;
      u.uWaterDeep.value.copy(atmo.waterDeep);
      u.uWaterShallow.value.copy(atmo.waterShallow);
      u.uFogColor.value.copy(atmo.fogColor);
      u.uFogDensity.value = atmo.fogDensity;
      u.uLighthousePower.value = atmo.lighthousePower;
      u.uBeamAngle.value = atmo.beamAngle;
    },
  };
}
