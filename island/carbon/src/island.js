import * as THREE from 'three';
import {
  TAU,
  clamp,
  lerp,
  saturate,
  smoothstep,
  createRng,
  fbm2D,
  ridgedFbm2D,
} from './math.js';
import {
  LIGHTHOUSE_POS,
  COTTAGE_POS,
  sampleTerrainInfo,
  sampleTerrainNormal,
} from './terrain-data.js';

function injectIslandSurfaceShader(material, uniformsRef) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBeamAngle = uniformsRef.uBeamAngle;
    shader.uniforms.uLighthousePower = uniformsRef.uLighthousePower;
    shader.uniforms.uLighthouseOrigin = uniformsRef.uLighthouseOrigin;
    shader.uniforms.uWetnessTime = uniformsRef.uWetnessTime;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aWetness;
        attribute float aRockMask;
        varying float vWetness;
        varying float vRockMask;
        varying vec3 vWorldPositionIsl;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vWetness = aWetness;
        vRockMask = aRockMask;
        vWorldPositionIsl = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uBeamAngle;
        uniform float uLighthousePower;
        uniform vec3 uLighthouseOrigin;
        uniform float uWetnessTime;
        varying float vWetness;
        varying float vRockMask;
        varying vec3 vWorldPositionIsl;

        float hashIsl(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noiseIsl(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hashIsl(i), hashIsl(i + vec2(1.0, 0.0)), f.x),
            mix(hashIsl(i + vec2(0.0, 1.0)), hashIsl(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Crisp fragment-level geological strata on cliffs & wind ripples on coral sand
        float strataBand = sin(vWorldPositionIsl.y * 5.8 + noiseIsl(vWorldPositionIsl.xz * 0.65) * 3.2) * 0.5 + 0.5;
        float fineCrag = noiseIsl(vWorldPositionIsl.xz * 2.6 + vWorldPositionIsl.y * 1.9);
        float sandGrain = noiseIsl(vWorldPositionIsl.xz * 4.5);
        float rockDetail = mix(0.76, 1.24, strataBand * 0.62 + fineCrag * 0.38);
        float sandDetail = mix(0.94, 1.06, sandGrain);
        diffuseColor.rgb *= mix(sandDetail, rockDetail, vRockMask);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float swashPulse = 0.5 + 0.5 * sin(uWetnessTime * 2.40);
        float activeWet = vWetness * (0.68 + 0.32 * swashPulse);
        roughnessFactor = mix(roughnessFactor, 0.11, clamp(activeWet, 0.0, 1.0));`
      )
      .replace(
        '#include <dithering_fragment>',
        `if (uLighthousePower > 0.01) {
          vec2 rel = vWorldPositionIsl.xz - uLighthouseOrigin.xz;
          float dist = length(rel);
          vec2 dirXZ = rel / max(0.001, dist);
          vec2 beamDir = vec2(cos(uBeamAngle), sin(uBeamAngle));
          float align = abs(dot(dirXZ, beamDir));
          float sweep = pow(smoothstep(0.91, 1.0, align), 2.1);
          float vertCone = smoothstep(16.0, 2.5, abs(vWorldPositionIsl.y - (uLighthouseOrigin.y - dist * 0.22)));
          float atten = smoothstep(2.5, 8.0, dist) * exp(-dist * 0.030) * vertCone;
          gl_FragColor.rgb += gl_FragColor.rgb * vec3(1.65, 1.20, 0.60) * sweep * atten * uLighthousePower * 2.4;
        }
        #include <dithering_fragment>`
      );
  };
}

function buildIslandTerrainMesh(sharedUniforms) {
  const segs = 176;
  const span = 68;
  const geo = new THREE.PlaneGeometry(span, span, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const wetness = new Float32Array(count);
  const rockMasks = new Float32Array(count);

  const cSeabed = new THREE.Color(0xd2be96);
  const cWetSand = new THREE.Color(0xba9e76);
  const cDrySand = new THREE.Color(0xf4e3be);
  const cGrassLow = new THREE.Color(0x4f7d34);
  const cGrassHigh = new THREE.Color(0x346128);
  const cSunMoss = new THREE.Color(0x70943e);
  const cRockDark = new THREE.Color(0x524942);
  const cRockMid = new THREE.Color(0x786a5c);
  const cRockWarm = new THREE.Color(0x9b8873);
  const cPath = new THREE.Color(0xbca98b);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const info = sampleTerrainInfo(x, z);
    const h = info.height;
    pos.setY(i, h);

    const nrm = sampleTerrainNormal(x, z, 0.30);
    const slope = 1.0 - nrm.y;
    const grain = fbm2D(x * 0.65, z * 0.65, 3, 811) * 0.5 + 0.5;
    const strata = Math.sin(h * 3.1 + fbm2D(x * 0.25, z * 0.25, 2, 907) * 1.5) * 0.5 + 0.5;

    const rockMask = saturate(smoothstep(0.21, 0.40, slope) + info.cliffness * smoothstep(0.08, 0.24, slope));
    rockMasks[i] = rockMask;

    if (h < 0.0) {
      tmp.copy(cSeabed).lerp(cWetSand, smoothstep(-1.6, 0.0, h));
    } else {
      // Wide luminous coral-sand beach up to y ~ 2.2m on gentle slopes
      const beachToGrass = smoothstep(1.65 + grain * 0.45, 2.95 + grain * 0.45, h);
      tmp.copy(cDrySand);

      const wetBand = smoothstep(0.68, -0.04, h) * (1.0 - rockMask);
      tmp.lerp(cWetSand, wetBand * 0.82);
      wetness[i] = wetBand;

      const grassCol = cGrassLow.clone().lerp(cGrassHigh, grain * 0.72).lerp(cSunMoss, smoothstep(4.5, 10.5, h) * 0.45);
      tmp.lerp(grassCol, beachToGrass);
    }

    if (rockMask > 0.01) {
      const rockCol = cRockDark.clone().lerp(cRockMid, strata * 0.72).lerp(cRockWarm, grain * smoothstep(1.5, 9.5, h) * 0.72);
      const spray = smoothstep(1.9, -0.4, h);
      rockCol.multiplyScalar(lerp(1.0, 0.66, spray));
      tmp.lerp(rockCol, rockMask);
      wetness[i] = Math.max(wetness[i], spray * rockMask * 0.75);
    }

    const pathT = clamp(((x - COTTAGE_POS.x) * (LIGHTHOUSE_POS.x - COTTAGE_POS.x) + (z - COTTAGE_POS.z) * (LIGHTHOUSE_POS.z - COTTAGE_POS.z)) / 18.5, 0, 1);
    const px = lerp(COTTAGE_POS.x, LIGHTHOUSE_POS.x, pathT);
    const pz = lerp(COTTAGE_POS.z, LIGHTHOUSE_POS.z, pathT);
    const distPath = Math.hypot(x - px, z - pz);
    const pathMask = smoothstep(1.5, 0.6, distPath) * smoothstep(8.6, 9.8, h);
    tmp.lerp(cPath, pathMask * 0.75);

    colors[i * 3 + 0] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aWetness', new THREE.BufferAttribute(wetness, 1));
  geo.setAttribute('aRockMask', new THREE.BufferAttribute(rockMasks, 1));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.02,
  });
  injectIslandSurfaceShader(mat, sharedUniforms);

  return new THREE.Mesh(geo, mat);
}

function buildCoastalRocks(sharedUniforms) {
  const rng = createRng(7717);
  const baseGeo = new THREE.IcosahedronGeometry(1.0, 1);
  const pos = baseGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n = 0.78 + 0.34 * ridgedFbm2D(vx * 1.4 + 3.1, vz * 1.4 - vy * 1.1, 3, 613);
    pos.setXYZ(i, vx * n, vy * n * 0.74, vz * n);
  }
  baseGeo.computeVertexNormals();
  baseGeo.setAttribute('aWetness', new THREE.BufferAttribute(new Float32Array(pos.count).fill(0.28), 1));
  baseGeo.setAttribute('aRockMask', new THREE.BufferAttribute(new Float32Array(pos.count).fill(1.0), 1));

  const count = 82;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.80,
    metalness: 0.04,
  });
  injectIslandSurfaceShader(mat, sharedUniforms);

  const inst = new THREE.InstancedMesh(baseGeo, mat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < 900) {
    attempts++;
    const angle = rng() * TAU;
    const rad = lerp(6.5, 22.5, Math.pow(rng(), 0.74));
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;
    const info = sampleTerrainInfo(x, z);

    // Keep wide sandy crescent beach clean and open; cluster rocks on cliff bases & outer bay points
    const inSandyCove = x > -10.5 && x < 4.5 && z > 2.5 && z < 16.5 && info.cliffness < 0.25;
    if (inSandyCove) continue;
    if (info.height < -0.9 || info.height > 9.4) continue;
    if (Math.hypot(x - LIGHTHOUSE_POS.x, z - LIGHTHOUSE_POS.z) < 4.2) continue;
    if (Math.hypot(x - COTTAGE_POS.x, z - COTTAGE_POS.z) < 3.6) continue;

    const isShoreRock = info.height < 1.3;
    const sx = lerp(0.45, isShoreRock ? 1.75 : 1.05, rng());
    const sy = sx * lerp(0.50, 0.90, rng());
    const sz = sx * lerp(0.68, 1.22, rng());

    dummy.position.set(x, info.height - sy * 0.28, z);
    dummy.rotation.set((rng() - 0.5) * 0.45, rng() * TAU, (rng() - 0.5) * 0.45);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    inst.setMatrixAt(placed, dummy.matrix);

    const shade = lerp(0.32, 0.56, rng()) * (info.height < 0.6 ? 0.78 : 1.0);
    color.setRGB(shade * 1.08, shade * 0.99, shade * 0.89);
    inst.setColorAt(placed, color);
    placed++;
  }

  inst.count = placed;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  return inst;
}

export function createIslandSystem() {
  const group = new THREE.Group();
  const sharedUniforms = {
    uBeamAngle: { value: 0 },
    uLighthousePower: { value: 0 },
    uLighthouseOrigin: { value: new THREE.Vector3(LIGHTHOUSE_POS.x, 20.6, LIGHTHOUSE_POS.z) },
    uWetnessTime: { value: 0 },
  };

  const terrainMesh = buildIslandTerrainMesh(sharedUniforms);
  const rocksMesh = buildCoastalRocks(sharedUniforms);
  group.add(terrainMesh, rocksMesh);

  return {
    group,
    update(t, atmo) {
      sharedUniforms.uWetnessTime.value = t;
      sharedUniforms.uBeamAngle.value = atmo.beamAngle;
      sharedUniforms.uLighthousePower.value = atmo.lighthousePower;
    },
  };
}
