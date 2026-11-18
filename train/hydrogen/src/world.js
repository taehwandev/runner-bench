import * as THREE from 'three';
import { createRng, hash1D, clamp, lerp } from './prng.js';
import { trackPath, TRACK_Y, WORLD_ZONES } from './timeline.js';

function buildRibbonMesh(sStart, sEnd, step, halfWidth, yTop, yBottom, material) {
  const count = Math.floor((sEnd - sStart) / step) + 1;
  // Cross-section: 4 vertices per slice (top-left, top-right, bot-right, bot-left)
  // Build top face, left wall, right wall cleanly
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const pos = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const s = Math.min(sStart + i * step, sEnd);
    trackPath.sample(s, pos, fwd, right);
    const v = (s - sStart) * 0.1;

    // 0: top-left, 1: top-right, 2: bot-left, 3: bot-right, 4: sideL-top, 5: sideL-bot, 6: sideR-top, 7: sideR-bot
    const lx = pos.x - right.x * halfWidth;
    const lz = pos.z - right.z * halfWidth;
    const rx = pos.x + right.x * halfWidth;
    const rz = pos.z + right.z * halfWidth;

    // Top face vertices (0, 1)
    positions.push(lx, yTop, lz, rx, yTop, rz);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, v, 1, v);

    // Left face vertices (2, 3)
    positions.push(lx, yTop, lz, lx, yBottom, lz);
    normals.push(-right.x, 0, -right.z, -right.x, 0, -right.z);
    uvs.push(0, v, 1, v);

    // Right face vertices (4, 5)
    positions.push(rx, yTop, rz, rx, yBottom, rz);
    normals.push(right.x, 0, right.z, right.x, 0, right.z);
    uvs.push(0, v, 1, v);

    // Bottom face vertices (6, 7)
    positions.push(lx, yBottom, lz, rx, yBottom, rz);
    normals.push(0, -1, 0, 0, -1, 0);
    uvs.push(0, v, 1, v);
  }

  for (let i = 0; i < count - 1; i++) {
    const a = i * 8;
    const b = (i + 1) * 8;
    // Top
    indices.push(a + 0, a + 1, b + 0, a + 1, b + 1, b + 0);
    // Left
    indices.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
    // Right
    indices.push(a + 4, a + 5, b + 4, a + 5, b + 5, b + 4);
    // Bottom
    indices.push(a + 6, b + 6, a + 7, a + 7, b + 6, b + 7);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function buildOffsetRail(sStart, sEnd, step, lateralOffset, yTop, yBottom, halfW, material) {
  const count = Math.floor((sEnd - sStart) / step) + 1;
  const positions = [];
  const normals = [];
  const indices = [];

  const pos = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const s = Math.min(sStart + i * step, sEnd);
    trackPath.sample(s, pos, fwd, right);
    const cx = pos.x + right.x * lateralOffset;
    const cz = pos.z + right.z * lateralOffset;
    const lx = cx - right.x * halfW;
    const lz = cz - right.z * halfW;
    const rx = cx + right.x * halfW;
    const rz = cz + right.z * halfW;

    positions.push(lx, yTop, lz, rx, yTop, rz, lx, yBottom, lz, rx, yBottom, rz);
    normals.push(0, 1, 0, 0, 1, 0, -right.x, 0.3, -right.z, right.x, 0.3, right.z);
  }

  for (let i = 0; i < count - 1; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    indices.push(a + 0, a + 1, b + 0, a + 1, b + 1, b + 0);
    indices.push(a + 0, b + 0, a + 2, a + 2, b + 0, b + 2);
    indices.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return new THREE.Mesh(geo, material);
}

function createSkyDome() {
  const skyGeo = new THREE.SphereGeometry(1700, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uNight: { value: 0.0 },
      uTime: { value: 0.0 },
      uFogColor: { value: new THREE.Color(0x1b2842) },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDir;
      uniform float uNight;
      uniform float uTime;
      uniform vec3 uFogColor;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec3 d = normalize(vWorldDir);
        float h = clamp(d.y, -0.2, 1.0);

        // Dusk palette -> Deep frozen night palette
        vec3 duskZenith = vec3(0.035, 0.065, 0.145);
        vec3 duskMid = vec3(0.125, 0.165, 0.285);
        vec3 duskHorizon = vec3(0.42, 0.25, 0.24);

        vec3 nightZenith = vec3(0.012, 0.022, 0.055);
        vec3 nightMid = vec3(0.032, 0.055, 0.115);
        vec3 nightHorizon = vec3(0.055, 0.085, 0.145);

        vec3 zenith = mix(duskZenith, nightZenith, uNight);
        vec3 mid = mix(duskMid, nightMid, uNight);
        vec3 horizon = mix(duskHorizon, nightHorizon, uNight);

        vec3 col = mix(horizon, mid, smoothstep(0.03, 0.26, h));
        col = mix(col, zenith, smoothstep(0.20, 0.72, h));

        // Faint sunset glow toward -Z / -X horizon during dusk
        float sunAz = max(0.0, dot(normalize(vec2(d.x, d.z)), normalize(vec2(-0.35, -0.94))));
        float horizonGlow = pow(sunAz, 3.0) * exp(-abs(h - 0.07) * 14.0) * (1.0 - uNight * 0.88);
        col += vec3(0.48, 0.22, 0.12) * horizonGlow;

        // Blend smoothly into scene fog color at and below the horizon to eliminate ground-edge seam
        col = mix(uFogColor, col, smoothstep(-0.01, 0.09, h));

        // Subtle high-altitude cold stars appearing as dusk deepens
        if (h > 0.12) {
          vec2 starUv = floor(vec2(atan(d.z, d.x) * 180.0, d.y * 280.0));
          float s = hash(starUv);
          if (s > 0.9965) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 1.8 + s * 100.0);
            float vis = smoothstep(0.12, 0.45, h) * mix(0.25, 0.95, uNight);
            col += vec3(0.75, 0.85, 1.0) * twinkle * vis * 0.65;
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return { mesh: new THREE.Mesh(skyGeo, skyMat), material: skyMat };
}

function createSnowSystem() {
  const COUNT = 3200;
  const rng = createRng(55123);

  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT * 3);

  for (let i = 0; i < COUNT; i++) {
    positions[i * 3 + 0] = rng() * 96.0;
    positions[i * 3 + 1] = rng() * 68.0;
    positions[i * 3 + 2] = rng() * 96.0;

    seeds[i * 3 + 0] = 0.6 + rng() * 0.9; // fall speed multiplier
    seeds[i * 3 + 1] = rng() * 6.283; // phase
    seeds[i * 3 + 2] = 0.65 + rng() * 1.35; // size
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uPixelRatio: { value: 1.0 },
      uInTunnel: { value: 0.0 },
    },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      uniform vec3 uCenter;
      uniform float uPixelRatio;
      varying float vAlpha;

      void main() {
        vec3 boxSize = vec3(96.0, 68.0, 96.0);
        vec3 wind = vec3(3.4, -7.8 * aSeed.x, 1.6);
        vec3 p = position + wind * uTime;
        // Flutter
        p.x += sin(uTime * 1.4 + aSeed.y) * 1.3;
        p.z += cos(uTime * 1.1 + aSeed.y * 1.3) * 1.1;

        // Wrap deterministically inside box around camera target
        vec3 rel = mod(p - uCenter + boxSize * 0.5, boxSize) - boxSize * 0.5;
        vec3 worldPos = uCenter + rel;

        // Fade near box edges so particles never pop
        float edge = 1.0 - max(max(abs(rel.x) / 48.0, abs(rel.y) / 34.0), abs(rel.z) / 48.0);
        vAlpha = clamp(edge * 4.5, 0.0, 1.0) * (0.35 + 0.35 * fract(aSeed.y));

        vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
        float dist = max(1.0, -mv.z);
        gl_PointSize = clamp(aSeed.z * uPixelRatio * (135.0 / dist), 1.2, 7.5);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      uniform float uInTunnel;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        float soft = exp(-r2 * 3.4) * smoothstep(1.0, 0.2, r2);
        // Slightly calmer snow inside tunnel interior
        float alpha = soft * vAlpha * mix(1.0, 0.25, uInTunnel);
        gl_FragColor = vec4(0.88, 0.93, 1.0, alpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, material: mat };
}

export function createWorld(scene, textures) {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // 1. Sky dome
  const sky = createSkyDome();
  worldGroup.add(sky.mesh);

  // 2. Ground & Frozen River Gorge
  const snowGroundMat = new THREE.MeshStandardMaterial({
    map: textures.snowGround,
    color: 0xa7bbd4,
    roughness: 0.92,
    metalness: 0.04,
  });

  // City snow floor covering s in [-450 .. 1000]
  const cityGround = new THREE.Mesh(new THREE.PlaneGeometry(3200, 1800), snowGroundMat);
  cityGround.rotation.x = -Math.PI / 2;
  cityGround.position.set(0, 0, -250);
  cityGround.receiveShadow = true;
  worldGroup.add(cityGround);

  // Frozen river ice sheet below the long bridge (s > 1000, y = -18)
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x162336,
    roughness: 0.65,
    metalness: 0.18,
  });
  const iceSheet = new THREE.Mesh(new THREE.PlaneGeometry(4200, 3200), iceMat);
  iceSheet.rotation.x = -Math.PI / 2;
  iceSheet.position.set(220, -18, -2200);
  worldGroup.add(iceSheet);

  // Embankment cliff wall at river edge (z = -1000)
  const concreteMat = new THREE.MeshStandardMaterial({
    map: textures.concrete,
    color: 0x76879c,
    roughness: 0.86,
    metalness: 0.12,
  });
  const cliffWall = new THREE.Mesh(new THREE.BoxGeometry(1600, 20, 30), concreteMat);
  cliffWall.position.set(0, -9, -1012);
  worldGroup.add(cliffWall);

  // 3. Elevated Track Ribbon, Rails, Sleepers, Piers
  const deckRibbon = buildRibbonMesh(-160, 1820, 4.0, 2.75, TRACK_Y - 0.15, TRACK_Y - 1.9, concreteMat);
  worldGroup.add(deckRibbon);

  // Snow-crusted trackside ballast shoulder
  const snowShoulderMat = new THREE.MeshStandardMaterial({
    color: 0xc2d3e8,
    roughness: 0.9,
    metalness: 0.05,
  });
  const leftShoulder = buildOffsetRail(-160, 1820, 6.0, -2.35, TRACK_Y - 0.02, TRACK_Y - 0.16, 0.36, snowShoulderMat);
  const rightShoulder = buildOffsetRail(-160, 1820, 6.0, 2.35, TRACK_Y - 0.02, TRACK_Y - 0.16, 0.36, snowShoulderMat);
  worldGroup.add(leftShoulder, rightShoulder);

  // Twin steel rails
  const steelRailMat = new THREE.MeshStandardMaterial({
    color: 0x8ea2ba,
    metalness: 0.88,
    roughness: 0.22,
  });
  const railL = buildOffsetRail(-160, 1820, 3.0, -0.78, TRACK_Y + 0.06, TRACK_Y - 0.15, 0.075, steelRailMat);
  const railR = buildOffsetRail(-160, 1820, 3.0, 0.78, TRACK_Y + 0.06, TRACK_Y - 0.15, 0.075, steelRailMat);
  worldGroup.add(railL, railR);

  // Instanced sleepers along entire track
  const sleeperStep = 1.0;
  const sleeperCount = Math.floor((1820 - -160) / sleeperStep);
  const sleeperGeo = new THREE.BoxGeometry(2.65, 0.12, 0.26);
  const sleeperMat = new THREE.MeshStandardMaterial({
    color: 0x262e3a,
    roughness: 0.85,
  });
  const sleeperInst = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleeperCount);
  const dummy = new THREE.Object3D();
  const sPos = new THREE.Vector3();
  const sFwd = new THREE.Vector3();
  const sRight = new THREE.Vector3();

  for (let i = 0; i < sleeperCount; i++) {
    const s = -160 + i * sleeperStep;
    const th = trackPath.sample(s, sPos, sFwd, sRight);
    dummy.position.set(sPos.x, TRACK_Y - 0.12, sPos.z);
    dummy.rotation.set(0, -th, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    sleeperInst.setMatrixAt(i, dummy.matrix);
  }
  sleeperInst.instanceMatrix.needsUpdate = true;
  worldGroup.add(sleeperInst);

  // Instanced viaduct concrete piers (s in [-140, 990] outside tunnel interior)
  const pierCoords = [];
  for (let s = -140; s <= 865; s += 24) pierCoords.push(s);
  const pierGeo = new THREE.BoxGeometry(3.6, TRACK_Y - 1.8, 2.6);
  const pierCapGeo = new THREE.BoxGeometry(5.6, 1.4, 3.0);
  const pierInst = new THREE.InstancedMesh(pierGeo, concreteMat, pierCoords.length);
  const pierCapInst = new THREE.InstancedMesh(pierCapGeo, concreteMat, pierCoords.length);
  for (let i = 0; i < pierCoords.length; i++) {
    const th = trackPath.sample(pierCoords[i], sPos);
    dummy.position.set(sPos.x, (TRACK_Y - 1.8) * 0.5, sPos.z);
    dummy.rotation.set(0, -th, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pierInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(sPos.x, TRACK_Y - 2.3, sPos.z);
    dummy.updateMatrix();
    pierCapInst.setMatrixAt(i, dummy.matrix);
  }
  pierInst.instanceMatrix.needsUpdate = true;
  pierCapInst.instanceMatrix.needsUpdate = true;
  worldGroup.add(pierInst, pierCapInst);

  // Instanced viaduct & bridge lampposts
  const lampPositions = [];
  for (let s = -100; s <= 1740; s += 36) {
    if (s >= 624 && s <= 776) continue; // station has its own canopy lights
    if (s >= 870 && s <= 1006) continue; // tunnel interior has bulkheads
    lampPositions.push(s);
  }
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 5.2, 6);
  const lampHeadGeo = new THREE.BoxGeometry(0.65, 0.16, 0.28);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x263140, metalness: 0.6, roughness: 0.5 });
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffe4b5,
    emissive: 0xffae4a,
    emissiveIntensity: 3.2,
  });
  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length * 2);
  const lampHeadInst = new THREE.InstancedMesh(lampHeadGeo, lampGlowMat, lampPositions.length * 2);

  let lpIdx = 0;
  for (let i = 0; i < lampPositions.length; i++) {
    const s = lampPositions[i];
    const th = trackPath.sample(s, sPos, sFwd, sRight);
    for (const side of [-1, 1]) {
      const lx = sPos.x + sRight.x * side * 2.55;
      const lz = sPos.z + sRight.z * side * 2.55;
      dummy.position.set(lx, TRACK_Y + 2.4, lz);
      dummy.rotation.set(0, -th, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(lpIdx, dummy.matrix);

      dummy.position.set(lx - sRight.x * side * 0.28, TRACK_Y + 4.95, lz - sRight.z * side * 0.28);
      dummy.updateMatrix();
      lampHeadInst.setMatrixAt(lpIdx, dummy.matrix);
      lpIdx++;
    }
  }
  poleInst.instanceMatrix.needsUpdate = true;
  lampHeadInst.instanceMatrix.needsUpdate = true;
  worldGroup.add(poleInst, lampHeadInst);

  // 4. Layered Frozen City Towers (InstancedMesh with facade + snow caps + aviation beacons)
  const rng = createRng(202611);
  const towerData = [];

  // Place towers along the city track (s in [-220 .. 920]) keeping clear of track, station, tunnel & river
  for (let s = -220; s <= 920; s += 26) {
    trackPath.sample(s, sPos, sFwd, sRight);

    // Near canyon flankers + midground + distant monoliths on both sides
    // Keep near wall at least 13m clear of track centerline for clean camera corridors
    const tiers = [
      { minOff: 29, maxOff: 44, minH: 52, maxH: 124, minW: 14, maxW: 22 },
      { minOff: 56, maxOff: 100, minH: 72, maxH: 162, minW: 18, maxW: 32 },
      { minOff: 112, maxOff: 225, minH: 92, maxH: 215, minW: 24, maxW: 44 },
    ];

    for (const side of [-1, 1]) {
      for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
        const tier = tiers[tierIdx];
        if (rng() < 0.2) continue;

        const off = lerp(tier.minOff, tier.maxOff, rng());
        const jitterS = (rng() - 0.5) * 16;
        const bx = sPos.x + sRight.x * side * off + sFwd.x * jitterS;
        const bz = sPos.z + sRight.z * side * off + sFwd.z * jitterS;

        // Keep city buildings south of river cliff (z > -950)
        if (bz < -945) continue;
        // Avoid overlapping station platform footprint (x in [-24..28], z in [-795..-610])
        if (bz < -610 && bz > -795 && Math.abs(bx) < 32) continue;
        // Avoid overlapping tunnel megablock footprint (x in [-52..52], z in [-1025..-855])
        if (bz < -855 && bz > -1025 && Math.abs(bx) < 54) continue;

        const w = lerp(tier.minW, tier.maxW, rng());
        const d = lerp(tier.minW, tier.maxW, rng());
        const h = lerp(tier.minH, tier.maxH, rng());
        const rotY = (rng() - 0.5) * 0.28;

        towerData.push({ x: bx, z: bz, w, d, h, rotY, tier: tierIdx, hasBeacon: h > 110 && rng() < 0.55 });
      }
    }
  }

  // Far backdrop skyline framing the city canyon & distant river banks (keep bridge corridor open)
  for (let i = 0; i < 40; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const bx = side * lerp(175, 480, rng());
    const bz = lerp(-920, 120, rng());
    towerData.push({
      x: bx,
      z: bz,
      w: lerp(28, 58, rng()),
      d: lerp(28, 58, rng()),
      h: lerp(115, 245, rng()),
      rotY: rng() * 0.5,
      tier: 2,
      hasBeacon: rng() < 0.4,
    });
  }

  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  // Adjust UV tiling slightly via standard material
  const towerMat = new THREE.MeshStandardMaterial({
    map: textures.tower.map,
    emissiveMap: textures.tower.emissiveMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1.15,
    roughness: 0.72,
    metalness: 0.22,
  });

  const towerInst = new THREE.InstancedMesh(towerGeo, towerMat, towerData.length);
  const snowCapGeo = new THREE.BoxGeometry(1.01, 0.9, 1.01);
  const snowCapInst = new THREE.InstancedMesh(snowCapGeo, snowShoulderMat, towerData.length);

  const beacons = towerData.filter((t) => t.hasBeacon);
  const beaconGeo = new THREE.SphereGeometry(0.65, 8, 8);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff2b2b,
    emissive: 0xff1e1e,
    emissiveIntensity: 3.6,
  });
  const beaconInst = new THREE.InstancedMesh(beaconGeo, beaconMat, beacons.length);

  const tintColor = new THREE.Color();
  let bIdx = 0;
  for (let i = 0; i < towerData.length; i++) {
    const t = towerData[i];
    dummy.position.set(t.x, t.h * 0.5, t.z);
    dummy.rotation.set(0, t.rotY, 0);
    dummy.scale.set(t.w, t.h, t.d);
    dummy.updateMatrix();
    towerInst.setMatrixAt(i, dummy.matrix);

    // Subtle cool depth tint variation
    const shade = t.tier === 0 ? 1.0 : t.tier === 1 ? 0.85 : 0.72;
    tintColor.setRGB(shade, shade * 1.02, shade * 1.08);
    towerInst.setColorAt(i, tintColor);

    // Snow cap on roof
    dummy.position.set(t.x, t.h + 0.4, t.z);
    dummy.scale.set(t.w, 1.0, t.d);
    dummy.updateMatrix();
    snowCapInst.setMatrixAt(i, dummy.matrix);

    if (t.hasBeacon) {
      dummy.position.set(t.x, t.h + 2.2, t.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      beaconInst.setMatrixAt(bIdx++, dummy.matrix);
    }
  }
  towerInst.instanceMatrix.needsUpdate = true;
  if (towerInst.instanceColor) towerInst.instanceColor.needsUpdate = true;
  snowCapInst.instanceMatrix.needsUpdate = true;
  beaconInst.instanceMatrix.needsUpdate = true;
  worldGroup.add(towerInst, snowCapInst, beaconInst);

  // 4b. Snow-buried urban street-level plinths, drifts & streetlamps under viaduct
  const streetBlockData = [];
  const streetLampCoords = [];
  for (let s = -180; s <= 850; s += 28) {
    trackPath.sample(s, sPos, sFwd, sRight);
    for (const side of [-1, 1]) {
      if (rng() < 0.85) {
        const off = lerp(14, 48, rng());
        streetBlockData.push({
          x: sPos.x + sRight.x * side * off,
          z: sPos.z + sRight.z * side * off,
          w: lerp(10, 22, rng()),
          d: lerp(12, 24, rng()),
          h: lerp(4, 14, rng()),
        });
      }
      streetLampCoords.push({
        x: sPos.x + sRight.x * side * 7.5,
        z: sPos.z + sRight.z * side * 7.5,
      });
    }
  }
  const sBlockInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), concreteMat, streetBlockData.length);
  const sBlockSnowInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.03, 0.7, 1.03), snowShoulderMat, streetBlockData.length);
  for (let i = 0; i < streetBlockData.length; i++) {
    const b = streetBlockData[i];
    dummy.position.set(b.x, b.h * 0.5, b.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    sBlockInst.setMatrixAt(i, dummy.matrix);
    dummy.position.set(b.x, b.h + 0.3, b.z);
    dummy.scale.set(b.w, 1, b.d);
    dummy.updateMatrix();
    sBlockSnowInst.setMatrixAt(i, dummy.matrix);
  }
  sBlockInst.instanceMatrix.needsUpdate = true;
  sBlockSnowInst.instanceMatrix.needsUpdate = true;
  worldGroup.add(sBlockInst, sBlockSnowInst);

  const stLampPostInst = new THREE.InstancedMesh(poleGeo, poleMat, streetLampCoords.length);
  const stLampBulbInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 8), lampGlowMat, streetLampCoords.length);
  for (let i = 0; i < streetLampCoords.length; i++) {
    const sl = streetLampCoords[i];
    dummy.position.set(sl.x, 2.6, sl.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    stLampPostInst.setMatrixAt(i, dummy.matrix);
    dummy.position.set(sl.x, 5.25, sl.z);
    dummy.updateMatrix();
    stLampBulbInst.setMatrixAt(i, dummy.matrix);
  }
  stLampPostInst.instanceMatrix.needsUpdate = true;
  stLampBulbInst.instanceMatrix.needsUpdate = true;
  worldGroup.add(stLampPostInst, stLampBulbInst);

  // 5. ELEVATED STATION PLATFORM (s in [630..772], straight along X=0, -Z)
  const stationGroup = new THREE.Group();
  worldGroup.add(stationGroup);

  const stLen = WORLD_ZONES.stationEnd - WORLD_ZONES.stationStart; // 142 m
  const stCenterZ = -(WORLD_ZONES.stationStart + stLen * 0.5); // -701

  // Main right-side concrete passenger platform (x in [2.3 .. 10.5])
  const platMesh = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.6, stLen), concreteMat);
  platMesh.position.set(6.4, TRACK_Y + 0.2, stCenterZ);
  platMesh.receiveShadow = true;
  stationGroup.add(platMesh);

  // Safety yellow/amber edge line along platform
  const edgeLineMat = new THREE.MeshStandardMaterial({
    color: 0xe09f3e,
    emissive: 0x704510,
    emissiveIntensity: 0.4,
    roughness: 0.7,
  });
  const edgeLine = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, stLen), edgeLineMat);
  edgeLine.position.set(2.45, TRACK_Y + 1.02, stCenterZ);
  stationGroup.add(edgeLine);

  // Station supporting columns down to ground
  for (let z = -WORLD_ZONES.stationStart - 10; z >= -WORLD_ZONES.stationEnd + 10; z -= 22) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.8, TRACK_Y - 0.6, 1.8), concreteMat);
    col.position.set(7.4, (TRACK_Y - 0.6) * 0.5, z);
    stationGroup.add(col);
  }

  // Station canopy roof & steel ribs
  const stationRoof = new THREE.Mesh(
    new THREE.BoxGeometry(10.6, 0.45, stLen - 6),
    new THREE.MeshStandardMaterial({ color: 0x243040, metalness: 0.6, roughness: 0.45 })
  );
  stationRoof.position.set(6.8, TRACK_Y + 6.4, stCenterZ);
  stationRoof.rotation.z = -0.06;
  stationGroup.add(stationRoof);

  const stationRoofSnow = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.22, stLen - 8), snowShoulderMat);
  stationRoofSnow.position.set(6.8, TRACK_Y + 6.72, stCenterZ);
  stationRoofSnow.rotation.z = -0.06;
  stationGroup.add(stationRoofSnow);

  const canopyBeamMat = new THREE.MeshStandardMaterial({ color: 0x1b2430, metalness: 0.7, roughness: 0.4 });
  const cyanStripMat = new THREE.MeshStandardMaterial({
    color: 0xa8e8ff,
    emissive: 0x5cc8ff,
    emissiveIntensity: 2.6,
  });
  const amberStationMat = new THREE.MeshStandardMaterial({
    color: 0xffd59a,
    emissive: 0xff9b38,
    emissiveIntensity: 2.8,
  });

  for (let z = -WORLD_ZONES.stationStart - 8; z >= -WORLD_ZONES.stationEnd + 8; z -= 15) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 5.4, 0.42), canopyBeamMat);
    pillar.position.set(7.8, TRACK_Y + 3.6, z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.32, 0.34), canopyBeamMat);
    arm.position.set(6.5, TRACK_Y + 6.1, z);
    const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.18), cyanStripMat);
    lightStrip.position.set(4.5, TRACK_Y + 5.9, z);
    stationGroup.add(pillar, arm, lightStrip);
  }

  // Warm platform benches / heated beacons + station PointLights
  for (let z = -655; z >= -755; z -= 32) {
    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 2.6), canopyBeamMat);
    kiosk.position.set(8.6, TRACK_Y + 2.2, z);
    const glowPanel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 1.8), amberStationMat);
    glowPanel.position.set(7.85, TRACK_Y + 2.3, z);
    stationGroup.add(kiosk, glowPanel);
  }

  const stLight1 = new THREE.PointLight(0x7ad6ff, 48, 55, 1.5);
  stLight1.position.set(4.8, TRACK_Y + 5.4, -675);
  const stLight2 = new THREE.PointLight(0xffad52, 52, 60, 1.5);
  stLight2.position.set(5.2, TRACK_Y + 5.2, -735);
  stationGroup.add(stLight1, stLight2);

  // 6. TOWER BLOCK TUNNEL (s in [876..1000], straight along X=0, -Z)
  const tunnelGroup = new THREE.Group();
  worldGroup.add(tunnelGroup);

  const tunLen = WORLD_ZONES.tunnelEnd - WORLD_ZONES.tunnelStart; // 124 m
  const tunCenterZ = -(WORLD_ZONES.tunnelStart + tunLen * 0.5); // -938

  // Colossal megablock flanking wings + upper skyscraper straddling the tracks
  const megaMat = new THREE.MeshStandardMaterial({
    map: textures.tower.map,
    emissiveMap: textures.tower.emissiveMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1.0,
    roughness: 0.74,
    metalness: 0.25,
  });

  // Left wing (x in [-32 .. -6])
  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(26, 138, tunLen), megaMat);
  leftWing.position.set(-19, 69, tunCenterZ);
  // Right wing (x in [+6 .. +32])
  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(26, 138, tunLen), megaMat);
  rightWing.position.set(19, 69, tunCenterZ);
  // Lower bridge base below rails (y in [0 .. 20.1])
  const lowerPodium = new THREE.Mesh(new THREE.BoxGeometry(12, 20.1, tunLen), concreteMat);
  lowerPodium.position.set(0, 10.05, tunCenterZ);
  // Upper megablock tower directly above tunnel bore (y in [31.5 .. 148])
  const upperBlock = new THREE.Mesh(new THREE.BoxGeometry(64, 116.5, tunLen), megaMat);
  upperBlock.position.set(0, 31.5 + 58.25, tunCenterZ);
  // Snow on megablock roof
  const megaSnow = new THREE.Mesh(new THREE.BoxGeometry(64.5, 1.2, tunLen + 0.5), snowShoulderMat);
  megaSnow.position.set(0, 148.6, tunCenterZ);
  tunnelGroup.add(leftWing, rightWing, lowerPodium, upperBlock, megaSnow);

  // Tunnel interior concrete ceiling & side wall ribs + sodium bulkhead lights
  const tunCeiling = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.8, tunLen), concreteMat);
  tunCeiling.position.set(0, TRACK_Y + 9.2, tunCenterZ);
  tunnelGroup.add(tunCeiling);

  const ribGeo = new THREE.BoxGeometry(0.65, 9.6, 1.1);
  const tunRibCount = 16;
  const tunRibInst = new THREE.InstancedMesh(ribGeo, canopyBeamMat, tunRibCount * 2);
  const tunLightGeo = new THREE.BoxGeometry(0.18, 0.42, 2.2);
  const tunLightInst = new THREE.InstancedMesh(tunLightGeo, amberStationMat, tunRibCount * 2);

  let trIdx = 0;
  for (let i = 0; i < tunRibCount; i++) {
    const z = -WORLD_ZONES.tunnelStart - 4 - (i / (tunRibCount - 1)) * (tunLen - 8);
    for (const side of [-1, 1]) {
      dummy.position.set(side * 5.65, TRACK_Y + 4.4, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tunRibInst.setMatrixAt(trIdx, dummy.matrix);

      dummy.position.set(side * 5.25, TRACK_Y + 5.8, z);
      dummy.updateMatrix();
      tunLightInst.setMatrixAt(trIdx, dummy.matrix);
      trIdx++;
    }
  }
  tunRibInst.instanceMatrix.needsUpdate = true;
  tunLightInst.instanceMatrix.needsUpdate = true;
  tunnelGroup.add(tunRibInst, tunLightInst);

  // Tunnel portal warning beacons (entrance & exit)
  for (const pz of [-WORLD_ZONES.tunnelStart, -WORLD_ZONES.tunnelEnd]) {
    for (const px of [-5.2, 5.2]) {
      const pBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), amberStationMat);
      pBeacon.position.set(px, TRACK_Y + 8.5, pz);
      tunnelGroup.add(pBeacon);
    }
  }

  // Interior PointLights so the armored train reads vividly inside the tunnel
  for (const lz of [-898, -938, -978]) {
    const tLight = new THREE.PointLight(0xff9c38, 65, 58, 1.4);
    tLight.position.set(0, TRACK_Y + 7.2, lz);
    tunnelGroup.add(tLight);
  }

  // 7. COLOSSAL NIGHT SUSPENSION BRIDGE (s in [1000..1780])
  const bridgeGroup = new THREE.Group();
  worldGroup.add(bridgeGroup);

  const pylonS = [1150, 1380, 1610];
  const cablePairs = [];

  for (const ps of pylonS) {
    const th = trackPath.sample(ps, sPos, sFwd, sRight);

    const pylonGroup = new THREE.Group();
    pylonGroup.position.set(sPos.x, 0, sPos.z);
    pylonGroup.rotation.y = -th;
    bridgeGroup.add(pylonGroup);

    // Twin A-frame legs plunging down to ice sheet y = -18 up to y = 78
    for (const side of [-4.2, 4.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.9, 96, 3.2), concreteMat);
      leg.position.set(side, 30, 0);
      leg.rotation.z = side > 0 ? 0.035 : -0.035;
      pylonGroup.add(leg);
    }
    // Crossbeams at y = 44 and y = 74
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(9.4, 2.2, 2.8), concreteMat);
    cross1.position.set(0, 44, 0);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.8, 2.8), concreteMat);
    cross2.position.set(0, 74, 0);
    // Warm architectural floodlight strips & red aviation tip beacons
    const pylonGlow = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 2.95), amberStationMat);
    pylonGlow.position.set(0, 72.4, 0);
    const topBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), beaconMat);
    topBeacon.position.set(0, 78.8, 0);
    pylonGroup.add(cross1, cross2, pylonGlow, topBeacon);

    // Stay cables radiating from pylon top (y = 72) down to deck edges along track
    for (const cOff of [-85, -62, -40, -20, 20, 40, 62, 85]) {
      const deckS = ps + cOff;
      const dPos = trackPath.getPoint(deckS);
      const dRight = new THREE.Vector3();
      trackPath.sample(deckS, dPos, sFwd, dRight);

      for (const side of [-1, 1]) {
        const topPt = new THREE.Vector3(
          sPos.x + sRight.x * side * 2.8,
          72,
          sPos.z + sRight.z * side * 2.8
        );
        const botPt = new THREE.Vector3(
          dPos.x + dRight.x * side * 2.75,
          TRACK_Y - 0.1,
          dPos.z + dRight.z * side * 2.75
        );
        cablePairs.push({ topPt, botPt });
      }
    }
  }

  // Render all bridge stay cables in 1 InstancedMesh
  const cableGeo = new THREE.CylinderGeometry(0.065, 0.065, 1, 6);
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x90a8c8,
    metalness: 0.7,
    roughness: 0.35,
  });
  const cableInst = new THREE.InstancedMesh(cableGeo, cableMat, cablePairs.length);
  const cMid = new THREE.Vector3();
  const cDir = new THREE.Vector3();
  const cQuat = new THREE.Quaternion();
  const upVec = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < cablePairs.length; i++) {
    const { topPt, botPt } = cablePairs[i];
    cMid.addVectors(topPt, botPt).multiplyScalar(0.5);
    cDir.subVectors(topPt, botPt);
    const len = cDir.length();
    cDir.normalize();
    cQuat.setFromUnitVectors(upVec, cDir);
    dummy.position.copy(cMid);
    dummy.quaternion.copy(cQuat);
    dummy.scale.set(1, len, 1);
    dummy.updateMatrix();
    cableInst.setMatrixAt(i, dummy.matrix);
  }
  cableInst.instanceMatrix.needsUpdate = true;
  bridgeGroup.add(cableInst);

  // 8. Continuous Deterministic Snowfall
  const snow = createSnowSystem();
  worldGroup.add(snow.points);

  function update(timeSec, focusPos, state, pixelRatio, fogColor) {
    const night = clamp(timeSec / 60.0, 0, 1);
    sky.material.uniforms.uNight.value = night;
    sky.material.uniforms.uTime.value = timeSec;
    if (fogColor) sky.material.uniforms.uFogColor.value.copy(fogColor);
    sky.mesh.position.copy(focusPos);

    snow.material.uniforms.uTime.value = timeSec;
    snow.material.uniforms.uCenter.value.copy(focusPos);
    snow.material.uniforms.uPixelRatio.value = pixelRatio;
    snow.material.uniforms.uInTunnel.value = state.inTunnel ? 1.0 : 0.0;
  }

  return {
    update,
  };
}
