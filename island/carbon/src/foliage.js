import * as THREE from 'three';
import {
  TAU,
  lerp,
  saturate,
  smoothstep,
  createRng,
} from './math.js';
import {
  LIGHTHOUSE_POS,
  COTTAGE_POS,
  sampleTerrainInfo,
  sampleTerrainNormal,
} from './terrain-data.js';

const SWAY_GLSL = /* glsl */ `
vec2 calcPalmSway(float t, float wind, float phase, float normH) {
  float bend = normH * normH;
  float primary = sin(t * 1.48 + phase) * 0.62 + sin(t * 2.75 + phase * 1.7) * 0.38;
  float lateral = cos(t * 1.15 + phase * 1.3) * 0.42;
  vec2 dir = vec2(-0.82 * (0.38 + 0.62 * primary) + 0.25 * lateral, 0.44 * (0.38 + 0.62 * primary) + 0.30 * lateral);
  return dir * wind * bend * 0.78;
}
`;

function createPalmTrunkGeometry() {
  const radialSegs = 9;
  const heightSegs = 14;
  const geo = new THREE.CylinderGeometry(0.10, 0.25, 1.0, radialSegs, heightSegs, false);
  geo.translate(0, 0.5, 0);

  const pos = geo.attributes.position;
  const normHeights = new Float32Array(pos.count);
  const colors = new Float32Array(pos.count * 3);
  const cBase = new THREE.Color(0x523e2e);
  const cMid = new THREE.Color(0x78604a);
  const cRing = new THREE.Color(0x967d64);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    normHeights[i] = y;
    const curve = Math.pow(y, 1.52) * 0.28;
    const ring = 1.0 + 0.055 * Math.sin(y * 46.0);
    pos.setX(i, pos.getX(i) * ring + curve);
    pos.setZ(i, pos.getZ(i) * ring);

    const ringShade = 0.5 + 0.5 * Math.sin(y * 46.0);
    tmp.copy(cBase).lerp(cMid, smoothstep(0.0, 0.75, y)).lerp(cRing, ringShade * 0.38);
    colors[i * 3 + 0] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('aNormH', new THREE.BufferAttribute(normHeights, 1));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function createPalmFrondGeometry() {
  const pairs = 16;
  const positions = [];
  const colors = [];
  const frondU = [];
  const sideV = [];
  const indices = [];

  const cStem = new THREE.Color(0x698f35);
  const cInner = new THREE.Color(0x3b7326);
  const cTip = new THREE.Color(0x7aa43c);
  const tmp = new THREE.Color();

  for (let i = 0; i <= pairs; i++) {
    const u = i / pairs;
    const x = u * 2.95;
    const archY = Math.sin(u * Math.PI * 0.70) * 0.50 - Math.pow(u, 2.15) * 1.02;
    const leafletSpan = Math.sin(Math.pow(u, 0.68) * Math.PI) * 0.68 * (1.0 - 0.16 * u);
    const droop = leafletSpan * 0.44;

    positions.push(x, archY, 0);
    positions.push(x - u * 0.18, archY - droop, -leafletSpan);
    positions.push(x - u * 0.18, archY - droop, leafletSpan);

    frondU.push(u, u, u);
    sideV.push(0.0, 1.0, 1.0);

    tmp.copy(cStem).lerp(cTip, u * 0.55);
    colors.push(tmp.r, tmp.g, tmp.b);

    tmp.copy(cInner).lerp(cTip, Math.pow(u, 0.85));
    colors.push(tmp.r, tmp.g, tmp.b);
    colors.push(tmp.r, tmp.g, tmp.b);

    if (i < pairs) {
      const base = i * 3;
      const next = (i + 1) * 3;
      indices.push(base, next, base + 1);
      indices.push(base + 1, next, next + 1);
      indices.push(base, base + 2, next);
      indices.push(base + 2, next + 2, next);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('aFrondU', new THREE.Float32BufferAttribute(frondU, 1));
  geo.setAttribute('aSideV', new THREE.Float32BufferAttribute(sideV, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createTropicalFernGeometry() {
  // 8 arched botanical fern/pandanus blades radiating cleanly from ground
  const blades = 8;
  const segs = 4;
  const positions = [];
  const colors = [];
  const indices = [];

  const cBase = new THREE.Color(0x285420);
  const cTip = new THREE.Color(0x639136);
  const tmp = new THREE.Color();

  let vOffset = 0;
  for (let b = 0; b < blades; b++) {
    const az = (b / blades) * TAU + (b % 2) * 0.22;
    const len = b % 2 === 0 ? 0.92 : 0.72;
    const cosA = Math.cos(az);
    const sinA = Math.sin(az);
    const perpX = -sinA;
    const perpZ = cosA;

    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const r = u * len;
      const y = Math.sin(u * Math.PI * 0.76) * 0.52 * len;
      const halfW = Math.sin(Math.pow(u, 0.65) * Math.PI) * 0.14;

      positions.push(cosA * r - perpX * halfW, y, sinA * r - perpZ * halfW);
      positions.push(cosA * r + perpX * halfW, y, sinA * r + perpZ * halfW);

      tmp.copy(cBase).lerp(cTip, u);
      colors.push(tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b);

      if (s < segs) {
        const i0 = vOffset + s * 2;
        indices.push(i0, i0 + 2, i0 + 1);
        indices.push(i0 + 1, i0 + 2, i0 + 3);
      }
    }
    vOffset += (segs + 1) * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function selectPalmPlacements() {
  const rng = createRng(5150);
  const trees = [];
  let attempts = 0;

  while (trees.length < 28 && attempts < 1400) {
    attempts++;
    const angle = rng() * TAU;
    const r = lerp(4.0, 18.5, Math.pow(rng(), 0.78));
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const info = sampleTerrainInfo(x, z);
    const nrm = sampleTerrainNormal(x, z, 0.35);

    // Place palms above dry beach swash line (y > 1.75m) so golden sand shore stays open & clear!
    if (info.height < 1.75 || info.height > 8.6) continue;
    if (1.0 - nrm.y > 0.30) continue;
    if (Math.hypot(x - LIGHTHOUSE_POS.x, z - LIGHTHOUSE_POS.z) < 5.6) continue;
    if (Math.hypot(x - COTTAGE_POS.x, z - COTTAGE_POS.z) < 4.5) continue;

    let tooClose = false;
    for (let j = 0; j < trees.length; j++) {
      if (Math.hypot(x - trees[j].x, z - trees[j].z) < 2.45) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const outwardYaw = Math.atan2(z - 0.5, x + 0.5) + (rng() - 0.5) * 0.65;
    const height = lerp(5.0, 8.8, rng()) * (info.height < 3.2 ? 1.06 : 0.88);
    const scaleXZ = lerp(0.85, 1.20, rng());
    const phase = rng() * TAU;

    trees.push({
      x,
      y: info.height - 0.12,
      z,
      yaw: -outwardYaw,
      height,
      scaleXZ,
      phase,
    });
  }
  return trees;
}

function applyLighthouseCatchGLSL(shader, uniforms, isFrond = false) {
  shader.uniforms.uBeamAngle = uniforms.uBeamAngle;
  shader.uniforms.uLighthousePower = uniforms.uLighthousePower;
  shader.uniforms.uLighthouseOrigin = uniforms.uLighthouseOrigin;
  shader.uniforms.uSunDirFol = uniforms.uSunDir;
  shader.uniforms.uSunColorFol = uniforms.uSunColor;

  const frondHeader = isFrond ? 'varying float vFrondU;\nvarying float vSideV;' : '';
  const frondCutout = isFrond
    ? `// Feathery individual coconut palm leaflets along frond spine
      float leafletWave = fract(vFrondU * 26.0 - vSideV * 0.55);
      float bladeFill = mix(1.0, 0.58, smoothstep(0.08, 0.95, vSideV));
      if (vSideV > 0.10 && leafletWave > bladeFill) discard;`
    : '';

  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform float uBeamAngle;
      uniform float uLighthousePower;
      uniform vec3 uLighthouseOrigin;
      uniform vec3 uSunDirFol;
      uniform vec3 uSunColorFol;
      varying vec3 vFolWorldPos;
      ${frondHeader}`
    )
    .replace(
      '#include <color_fragment>',
      `${frondCutout}
      #include <color_fragment>`
    )
    .replace(
      '#include <dithering_fragment>',
      `vec3 viewToFrag = normalize(vFolWorldPos - cameraPosition);
      float sunTrans = pow(max(0.0, dot(viewToFrag, normalize(uSunDirFol))), 2.6) * smoothstep(-0.08, 0.20, uSunDirFol.y);
      gl_FragColor.rgb += gl_FragColor.rgb * uSunColorFol * sunTrans * 1.15;

      if (uLighthousePower > 0.01) {
        vec2 rel = vFolWorldPos.xz - uLighthouseOrigin.xz;
        float dist = length(rel);
        vec2 dirXZ = rel / max(0.001, dist);
        vec2 beamDir = vec2(cos(uBeamAngle), sin(uBeamAngle));
        float sweep = pow(smoothstep(0.91, 1.0, abs(dot(dirXZ, beamDir))), 2.0);
        float atten = smoothstep(2.0, 7.0, dist) * exp(-dist * 0.03);
        gl_FragColor.rgb += gl_FragColor.rgb * vec3(1.75, 1.25, 0.62) * sweep * atten * uLighthousePower * 2.5;
      }
      #include <dithering_fragment>`
    );
}

function clampScale(s) {
  return Math.max(0.70, Math.min(1.32, s));
}

function buildPalms(trees, sharedUniforms) {
  const trunkGeo = createPalmTrunkGeometry();
  const frondGeo = createPalmFrondGeometry();
  const cocoGeo = new THREE.SphereGeometry(0.15, 7, 6);

  const treePhasesTrunk = new Float32Array(trees.length);
  const trunkMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.02,
  });

  trunkMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWind = sharedUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aNormH;
        attribute float aTreePhase;
        uniform float uTime;
        uniform float uWind;
        varying vec3 vFolWorldPos;
        ${SWAY_GLSL}`
      )
      .replace(
        '#include <project_vertex>',
        `vec4 worldPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        worldPos.xz += calcPalmSway(uTime, uWind, aTreePhase, aNormH);
        vFolWorldPos = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;`
      );
    applyLighthouseCatchGLSL(shader, sharedUniforms, false);
  };

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const frondsPerTree = 12;
  const totalFronds = trees.length * frondsPerTree;
  const coconutsPerTree = 3;
  const totalCoconuts = trees.length * coconutsPerTree;

  const frondTreePhase = new Float32Array(totalFronds);
  const frondPhase = new Float32Array(totalFronds);

  const frondMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  frondMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWind = sharedUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aFrondU;
        attribute float aSideV;
        attribute float aTreePhase;
        attribute float aFrondPhase;
        uniform float uTime;
        uniform float uWind;
        varying vec3 vFolWorldPos;
        varying float vFrondU;
        varying float vSideV;
        ${SWAY_GLSL}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFrondU = aFrondU;
        vSideV = aSideV;
        float flutter = sin(uTime * 3.15 + aTreePhase + aFrondPhase - aFrondU * 2.4) * 0.14 * uWind;
        float gustLift = cos(uTime * 1.65 + aFrondPhase) * 0.09 * uWind;
        transformed.y += (flutter + gustLift) * aFrondU * aFrondU;
        transformed.z += sin(uTime * 4.2 + aFrondPhase * 1.9 + aFrondU * 3.5) * 0.05 * aFrondU * uWind;`
      )
      .replace(
        '#include <project_vertex>',
        `vec4 worldPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        worldPos.xz += calcPalmSway(uTime, uWind, aTreePhase, 1.0);
        vFolWorldPos = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;`
      );
    applyLighthouseCatchGLSL(shader, sharedUniforms, true);
  };

  const cocoMat = new THREE.MeshStandardMaterial({
    color: 0x5c4124,
    roughness: 0.72,
  });
  const cocoPhase = new Float32Array(totalCoconuts);
  cocoMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWind = sharedUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aTreePhase;
        uniform float uTime;
        uniform float uWind;
        ${SWAY_GLSL}`
      )
      .replace(
        '#include <project_vertex>',
        `vec4 worldPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        worldPos.xz += calcPalmSway(uTime, uWind, aTreePhase, 1.0);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;`
      );
  };

  const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, totalFronds);
  const cocoInst = new THREE.InstancedMesh(cocoGeo, cocoMat, totalCoconuts);

  const rng = createRng(8282);
  const dummy = new THREE.Object3D();
  const topLocal = new THREE.Vector3();
  let fIdx = 0;
  let cIdx = 0;

  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    treePhasesTrunk[i] = t.phase;

    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(0, t.yaw, 0);
    dummy.scale.set(t.scaleXZ, t.height, t.scaleXZ);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    topLocal.set(0.28, 1.0, 0).applyMatrix4(dummy.matrix);

    for (let f = 0; f < frondsPerTree; f++) {
      const layer = f < 5 ? 0 : 1;
      const az = (f / frondsPerTree) * TAU + (rng() - 0.5) * 0.28;
      const pitch = layer === 0 ? lerp(0.30, 0.55, rng()) : lerp(-0.18, 0.16, rng());
      const roll = (rng() - 0.5) * 0.24;
      const fScale = lerp(0.84, 1.16, rng()) * (t.height / 6.8);

      dummy.position.copy(topLocal);
      dummy.rotation.order = 'YXZ';
      dummy.rotation.set(roll, az, pitch);
      dummy.scale.setScalar(clampScale(fScale));
      dummy.updateMatrix();
      frondInst.setMatrixAt(fIdx, dummy.matrix);

      frondTreePhase[fIdx] = t.phase;
      frondPhase[fIdx] = rng() * TAU;
      fIdx++;
    }

    for (let c = 0; c < coconutsPerTree; c++) {
      const caz = (c / coconutsPerTree) * TAU + rng() * 0.6;
      dummy.position.set(
        topLocal.x + Math.cos(caz) * 0.16,
        topLocal.y - 0.16,
        topLocal.z + Math.sin(caz) * 0.16
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1.0, 1.18, 1.0);
      dummy.updateMatrix();
      cocoInst.setMatrixAt(cIdx, dummy.matrix);
      cocoPhase[cIdx] = t.phase;
      cIdx++;
    }
  }

  trunkGeo.setAttribute('aTreePhase', new THREE.InstancedBufferAttribute(treePhasesTrunk, 1));
  frondGeo.setAttribute('aTreePhase', new THREE.InstancedBufferAttribute(frondTreePhase, 1));
  frondGeo.setAttribute('aFrondPhase', new THREE.InstancedBufferAttribute(frondPhase, 1));
  cocoGeo.setAttribute('aTreePhase', new THREE.InstancedBufferAttribute(cocoPhase, 1));

  trunkInst.frustumCulled = false;
  frondInst.frustumCulled = false;
  cocoInst.frustumCulled = false;

  return { trunkInst, frondInst, cocoInst };
}

function buildCoastalFerns(sharedUniforms) {
  const rng = createRng(6363);
  const fernGeo = createTropicalFernGeometry();
  const maxCount = 135;
  const phases = new Float32Array(maxCount);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWind = sharedUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aBushPhase;
        uniform float uTime;
        uniform float uWind;
        varying vec3 vFolWorldPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float hMask = clamp(transformed.y * 2.0, 0.0, 1.0);
        transformed.x += sin(uTime * 2.5 + aBushPhase) * 0.09 * hMask * uWind;
        transformed.z += cos(uTime * 2.1 + aBushPhase * 1.4) * 0.07 * hMask * uWind;`
      )
      .replace(
        '#include <project_vertex>',
        `vec4 worldPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        vFolWorldPos = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;`
      );
    applyLighthouseCatchGLSL(shader, sharedUniforms, false);
  };

  const inst = new THREE.InstancedMesh(fernGeo, mat, maxCount);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  let placed = 0;
  let attempts = 0;
  while (placed < maxCount && attempts < 1100) {
    attempts++;
    const angle = rng() * TAU;
    const rad = lerp(2.0, 18.0, Math.pow(rng(), 0.75));
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;
    const info = sampleTerrainInfo(x, z);
    const nrm = sampleTerrainNormal(x, z, 0.35);

    if (info.height < 2.2 || info.height > 10.2) continue;
    if (1.0 - nrm.y > 0.34) continue;
    if (Math.hypot(x - LIGHTHOUSE_POS.x, z - LIGHTHOUSE_POS.z) < 4.2) continue;
    if (Math.hypot(x - COTTAGE_POS.x, z - COTTAGE_POS.z) < 3.4) continue;

    const s = lerp(0.75, 1.55, rng());
    dummy.position.set(x, info.height - 0.04, z);
    dummy.rotation.set(0, rng() * TAU, 0);
    dummy.scale.set(s, s * lerp(0.85, 1.25, rng()), s);
    dummy.updateMatrix();
    inst.setMatrixAt(placed, dummy.matrix);

    color.setHSL(lerp(0.24, 0.30, rng()), lerp(0.45, 0.65, rng()), lerp(0.45, 0.68, rng()));
    inst.setColorAt(placed, color);
    phases[placed] = rng() * TAU;
    placed++;
  }

  inst.count = placed;
  fernGeo.setAttribute('aBushPhase', new THREE.InstancedBufferAttribute(phases, 1));
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.frustumCulled = false;
  return inst;
}

function buildSeabirds() {
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0.0, 0.0, 0.18,   -0.42, 0.08, -0.06,   0.0, 0.0, -0.16,
    0.0, 0.0, 0.18,    0.0, 0.0, -0.16,     0.42, 0.08, -0.06,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();

  const count = 7;
  const mat = new THREE.MeshBasicMaterial({
    color: 0x26212c,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });

  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.frustumCulled = false;
  const rng = createRng(3131);
  const orbits = [];
  for (let i = 0; i < count; i++) {
    orbits.push({
      cx: lerp(-6, 8, rng()),
      cz: lerp(-8, 10, rng()),
      rx: lerp(12, 24, rng()),
      rz: lerp(10, 20, rng()),
      baseY: lerp(16.0, 25.0, rng()),
      speed: lerp(0.18, 0.28, rng()),
      phase: rng() * TAU,
    });
  }

  const dummy = new THREE.Object3D();
  return {
    mesh: inst,
    update(t, atmo) {
      const duskFade = saturate(1.0 - smoothstep(26.0, 34.0, t));
      inst.visible = duskFade > 0.01;
      if (!inst.visible) return;
      mat.opacity = 0.82 * duskFade;
      mat.color.copy(atmo.cloudShadow).multiplyScalar(0.55);

      for (let i = 0; i < count; i++) {
        const o = orbits[i];
        const ang = t * o.speed + o.phase;
        const x = o.cx + Math.cos(ang) * o.rx;
        const z = o.cz + Math.sin(ang) * o.rz;
        const y = o.baseY + Math.sin(t * 0.7 + o.phase) * 1.4;
        const dx = -Math.sin(ang) * o.rx;
        const dz = Math.cos(ang) * o.rz;
        const heading = Math.atan2(dx, dz);
        const flap = 1.0 + 0.15 * Math.sin(t * 6.8 + o.phase * 2.0);

        dummy.position.set(x, y, z);
        dummy.rotation.set(0, heading, 0.22);
        dummy.scale.set(flap, 1.0, 1.0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}

export function createFoliageSystem() {
  const group = new THREE.Group();
  const sharedUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.7 },
    uBeamAngle: { value: 0 },
    uLighthousePower: { value: 0 },
    uLighthouseOrigin: { value: new THREE.Vector3(LIGHTHOUSE_POS.x, 20.6, LIGHTHOUSE_POS.z) },
    uSunDir: { value: new THREE.Vector3(0, 0.4, -1) },
    uSunColor: { value: new THREE.Color(0xfff0c8) },
  };

  const trees = selectPalmPlacements();
  const { trunkInst, frondInst, cocoInst } = buildPalms(trees, sharedUniforms);
  const ferns = buildCoastalFerns(sharedUniforms);
  const birds = buildSeabirds();

  group.add(trunkInst, frondInst, cocoInst, ferns, birds.mesh);

  return {
    group,
    update(t, atmo) {
      sharedUniforms.uTime.value = t;
      sharedUniforms.uWind.value = atmo.windStrength;
      sharedUniforms.uBeamAngle.value = atmo.beamAngle;
      sharedUniforms.uLighthousePower.value = atmo.lighthousePower;
      sharedUniforms.uSunDir.value.copy(atmo.sunDir);
      sharedUniforms.uSunColor.value.copy(atmo.sunColor);
      birds.update(t, atmo);
    },
  };
}
