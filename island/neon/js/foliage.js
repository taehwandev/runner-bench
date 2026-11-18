import * as THREE from 'three';
import { mulberry32, clamp, smoothstep } from './prng.js';
import { getIslandHeight, getIslandNormal, LIGHTHOUSE_POS, COTTAGE_POS } from './terrain.js';

// Build a gracefully curved, tapered palm trunk geometry (origin at base y=0, tip at ~(leanX, height, 0))
function createCurvedTrunkGeometry(height = 1.0, lean = 0.22) {
  const segsY = 12;
  const segsR = 7;
  const geo = new THREE.CylinderGeometry(0.036, 0.082, height, segsR, segsY, false);
  geo.translate(0, height * 0.5, 0);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const colBase = new THREE.Color(0x523f2f);
  const colTop = new THREE.Color(0x785e46);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp(y / height, 0, 1);

    // Graceful S-curve bend
    const curveX = Math.pow(t, 1.55) * lean;
    // Subtle bark ring ridges
    const ring = 1.0 + Math.sin(t * Math.PI * 18.0) * 0.055;
    pos.setXYZ(i, x * ring + curveX, y, z * ring);

    tmp.copy(colBase).lerp(colTop, t);
    const ringShade = 0.9 + 0.1 * Math.sin(t * Math.PI * 18.0);
    colors[i * 3] = tmp.r * ringShade;
    colors[i * 3 + 1] = tmp.g * ringShade;
    colors[i * 3 + 2] = tmp.b * ringShade;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return { geo, tipOffset: new THREE.Vector3(lean, height, 0) };
}

// Build a single sculpted arched palm frond with V-angled leaflet silhouette
function createPalmFrondGeometry() {
  const segs = 12;
  const length = 3.2;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const colStem = new THREE.Color(0x3a6e24);
  const colTip = new THREE.Color(0x5a8e32);
  const tmp = new THREE.Color();

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = t * length;
    // Graceful upward arch then drooping tip
    const y = Math.sin(t * Math.PI * 0.78) * 0.72 - t * t * 0.95;
    // Frond width envelope (tapers at base and tip, slight jagged leaflet modulation)
    const env = Math.sin(Math.pow(t, 0.75) * Math.PI);
    const serrate = 0.78 + 0.22 * Math.abs(Math.sin(t * Math.PI * 9.0));
    const halfW = env * 0.62 * serrate;
    const droopY = -halfW * 0.42; // V-fold downward

    // 3 vertices across: left edge, center spine, right edge
    positions.push(-halfW, y + droopY, z);
    positions.push(0, y, z);
    positions.push(halfW, y + droopY, z);

    uvs.push(0, t, 0.5, t, 1, t);

    tmp.copy(colStem).lerp(colTip, t);
    // Slightly darker along spine for depth
    colors.push(tmp.r, tmp.g, tmp.b);
    colors.push(tmp.r * 0.82, tmp.g * 0.85, tmp.b * 0.8);
    colors.push(tmp.r, tmp.g, tmp.b);

    if (i < segs) {
      const row = i * 3;
      const next = (i + 1) * 3;
      // Left quad
      indices.push(row, next, row + 1);
      indices.push(row + 1, next, next + 1);
      // Right quad
      indices.push(row + 1, next + 1, row + 2);
      indices.push(row + 2, next + 1, next + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Inject deterministic vertex-shader wind sway into a MeshStandardMaterial
function attachWindShader(material, windUniform, strength = 1.0, isFrond = false) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uWindTime;
      `
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        vec3 instOrigin = vec3(0.0);
        #ifdef USE_INSTANCING
          instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #endif
        float phase = instOrigin.x * 0.37 + instOrigin.z * 0.29;
        float gust = sin(uWindTime * 1.45 + phase) * 0.65 + sin(uWindTime * 2.75 + phase * 1.9) * 0.35;
        float swayFactor = ${isFrond ? 'clamp(position.z / 3.2, 0.0, 1.0)' : 'clamp(position.y, 0.0, 1.0)'};
        swayFactor = swayFactor * swayFactor;
        transformed.x += gust * ${strength.toFixed(3)} * swayFactor;
        transformed.y += cos(uWindTime * 2.1 + phase) * ${(strength * 0.45).toFixed(3)} * swayFactor;
        transformed.z += sin(uWindTime * 1.2 + phase * 0.8) * ${(strength * 0.35).toFixed(3)} * swayFactor;
      `
      );
  };
}

export function createFoliageSystem() {
  const group = new THREE.Group();
  const rand = mulberry32(13379);
  const windTimeUniform = { value: 0 };

  // 1. Place tropical palm trees on the beach fringe and lush eastern ridge
  const palms = [];

  // Hand-curated hero palms framing the crescent beach & cottage silhouette
  const heroPalms = [
    [6.5, 10.2, 6.4, 0.3],
    [9.2, 8.8, 5.8, -0.5],
    [13.4, 6.2, 6.1, 1.1],
    [2.2, 11.4, 5.5, 2.3],
    [-2.4, 10.2, 5.9, 2.8],
    [4.4, 3.2, 6.6, 0.9],
    [8.8, 1.5, 6.2, -1.2],
    [11.8, -2.2, 5.7, -2.1],
    [2.5, -5.8, 5.4, 0.4],
    [-1.2, 5.2, 5.2, 1.8],
  ];

  for (const [px, pz, scaleH, rotY] of heroPalms) {
    const py = getIslandHeight(px, pz);
    if (py > 0.6) {
      palms.push({ x: px, y: py - 0.18, z: pz, scaleH, rotY });
    }
  }

  // Additional seeded grove palms across gentle vegetated slopes
  for (let i = 0; i < 65 && palms.length < 28; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 4.5 + rand() * 14.5;
    const px = Math.cos(ang) * dist + 2.0;
    const pz = Math.sin(ang) * dist + 1.5;
    const py = getIslandHeight(px, pz);
    if (py < 1.1 || py > 9.5) continue;

    const normal = getIslandNormal(px, pz);
    if (normal.y < 0.78) continue; // skip steep cliffs

    // Keep clear of lighthouse & cottage
    if (Math.hypot(px - LIGHTHOUSE_POS.x, pz - LIGHTHOUSE_POS.z) < 5.2) continue;
    if (Math.hypot(px - COTTAGE_POS.x, pz - COTTAGE_POS.z) < 3.4) continue;

    // Avoid overlapping existing palms
    let tooClose = false;
    for (const other of palms) {
      if (Math.hypot(px - other.x, pz - other.z) < 2.4) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    palms.push({
      x: px,
      y: py - 0.2,
      z: pz,
      scaleH: 4.5 + rand() * 2.6,
      rotY: rand() * Math.PI * 2,
    });
  }

  // Instanced trunks
  const { geo: trunkGeo, tipOffset } = createCurvedTrunkGeometry(1.0, 0.24);
  const trunkMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  attachWindShader(trunkMat, windTimeUniform, 0.045, false);

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palms.length);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;

  // Instanced fronds (8 fronds per palm)
  const frondsPerPalm = 8;
  const frondGeo = createPalmFrondGeometry();
  const frondMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  attachWindShader(frondMat, windTimeUniform, 0.28, true);

  const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palms.length * frondsPerPalm);
  frondInst.castShadow = true;
  frondInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const tipWorld = new THREE.Vector3();
  const frondTint = new THREE.Color();
  let frondIdx = 0;

  palms.forEach((p, idx) => {
    const leanScale = p.scaleH;
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rotY, 0);
    dummy.scale.set(leanScale, leanScale, leanScale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);

    // Compute world-space crown tip position
    tipWorld.copy(tipOffset).multiplyScalar(leanScale).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotY);
    tipWorld.add(new THREE.Vector3(p.x, p.y, p.z));

    const crownScale = clamp(p.scaleH / 5.8, 0.78, 1.22);
    for (let f = 0; f < frondsPerPalm; f++) {
      const fAng = p.rotY + (f / frondsPerPalm) * Math.PI * 2 + (rand() - 0.5) * 0.25;
      const pitch = (f % 2 === 0 ? -0.18 : 0.14) + (rand() - 0.5) * 0.14;
      dummy.position.copy(tipWorld);
      dummy.rotation.set(pitch, fAng, (rand() - 0.5) * 0.16, 'YXZ');
      const fs = crownScale * (0.88 + rand() * 0.24);
      dummy.scale.set(fs, fs, fs);
      dummy.updateMatrix();
      frondInst.setMatrixAt(frondIdx, dummy.matrix);

      const shade = 0.82 + rand() * 0.34;
      frondTint.setRGB(shade, shade * (0.96 + rand() * 0.08), shade * 0.9);
      frondInst.setColorAt(frondIdx, frondTint);
      frondIdx++;
    }
  });

  trunkInst.instanceMatrix.needsUpdate = true;
  frondInst.instanceMatrix.needsUpdate = true;
  if (frondInst.instanceColor) frondInst.instanceColor.needsUpdate = true;

  group.add(trunkInst);
  group.add(frondInst);

  // 2. Tropical Coastal Shrubs / Low Foliage Tufts
  const shrubGeo = new THREE.IcosahedronGeometry(0.75, 1);
  const sPos = shrubGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const vx = sPos.getX(i);
    const vy = sPos.getY(i);
    const vz = sPos.getZ(i);
    const bump = 0.8 + 0.32 * Math.sin(vx * 4.5 + vz * 3.7);
    sPos.setXYZ(i, vx * bump, vy * bump * 0.68, vz * bump);
  }
  shrubGeo.computeVertexNormals();

  const shrubMat = new THREE.MeshStandardMaterial({
    color: 0x3b682e,
    roughness: 0.88,
    metalness: 0.02,
    flatShading: true,
  });
  attachWindShader(shrubMat, windTimeUniform, 0.07, false);

  const shrubs = [];
  for (let i = 0; i < 60; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 3.0 + rand() * 14.5;
    const sx = Math.cos(ang) * dist + 1.5;
    const sz = Math.sin(ang) * dist + 0.5;
    const sy = getIslandHeight(sx, sz);
    if (sy < 1.5 || sy > 10.5) continue;
    const n = getIslandNormal(sx, sz);
    if (n.y < 0.72) continue;
    if (Math.hypot(sx - LIGHTHOUSE_POS.x, sz - LIGHTHOUSE_POS.z) < 4.5) continue;
    shrubs.push({
      x: sx,
      y: sy + 0.12,
      z: sz,
      s: 0.55 + rand() * 0.95,
      rotY: rand() * Math.PI * 2,
    });
  }

  const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubs.length);
  const shrubTint = new THREE.Color();
  shrubs.forEach((sh, idx) => {
    dummy.position.set(sh.x, sh.y, sh.z);
    dummy.rotation.set(0, sh.rotY, 0);
    dummy.scale.set(sh.s * 1.15, sh.s * 0.85, sh.s);
    dummy.updateMatrix();
    shrubInst.setMatrixAt(idx, dummy.matrix);
    const g = 0.75 + rand() * 0.4;
    shrubTint.setRGB(0.8 * g, g, 0.72 * g);
    shrubInst.setColorAt(idx, shrubTint);
  });
  shrubInst.instanceMatrix.needsUpdate = true;
  if (shrubInst.instanceColor) shrubInst.instanceColor.needsUpdate = true;
  group.add(shrubInst);

  // 3. Deterministic Gliding Seabirds (gulls circling the cliffs during afternoon & sunset)
  const birdCount = 8;
  const birdGroup = new THREE.Group();
  const birdMat = new THREE.MeshStandardMaterial({
    color: 0xf5f0e6,
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  // Simple graceful V-wing geometry
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0.16,
        0.52, 0.06, -0.05,
        0.18, 0.02, -0.14,
        0, 0, 0.16,
        0.18, 0.02, -0.14,
        0, 0, -0.1,
      ],
      3
    )
  );
  wingGeo.computeVertexNormals();

  const birds = [];
  for (let i = 0; i < birdCount; i++) {
    const b = new THREE.Group();
    const leftWing = new THREE.Mesh(wingGeo, birdMat);
    const rightWing = new THREE.Mesh(wingGeo, birdMat);
    rightWing.scale.x = -1;
    b.add(leftWing, rightWing);
    const scale = 0.75 + rand() * 0.45;
    b.scale.setScalar(scale);
    birdGroup.add(b);

    birds.push({
      mesh: b,
      leftWing,
      rightWing,
      radius: 14 + rand() * 14,
      baseY: 16 + rand() * 9,
      speed: 0.16 + rand() * 0.1,
      phase: rand() * Math.PI * 2,
      flapSpeed: 4.5 + rand() * 2.0,
    });
  }
  group.add(birdGroup);

  function update(t) {
    windTimeUniform.value = t;

    // Seabirds glide smoothly in late afternoon & golden hour, roosting as dusk deepens
    const birdVis = 1.0 - smoothstep(28.0, 34.0, t);
    birdGroup.visible = birdVis > 0.01;
    if (birdGroup.visible) {
      for (const b of birds) {
        const ang = b.phase + t * b.speed;
        const x = -3.0 + Math.cos(ang) * b.radius;
        const z = -2.0 + Math.sin(ang) * (b.radius * 0.78);
        const y = b.baseY + Math.sin(t * 0.6 + b.phase) * 1.4 - (1.0 - birdVis) * 8.0;
        b.mesh.position.set(x, y, z);

        // Tangent heading
        const dx = -Math.sin(ang) * b.radius;
        const dz = Math.cos(ang) * (b.radius * 0.78);
        b.mesh.rotation.y = Math.atan2(dx, dz);
        b.mesh.rotation.z = -0.18; // gentle banking into turn

        // Occasional glide vs gentle flap
        const flapEnv = Math.max(0, Math.sin(t * 0.55 + b.phase * 2.0));
        const flap = Math.sin(t * b.flapSpeed + b.phase) * 0.48 * flapEnv + 0.12;
        b.leftWing.rotation.z = flap;
        b.rightWing.rotation.z = -flap;
      }
    }
  }

  return { group, update };
}
