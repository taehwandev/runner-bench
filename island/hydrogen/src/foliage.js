import * as THREE from 'three';
import { mulberry32 } from './prng.js';
import { COTTAGE_XZ, getIslandHeight, LIGHTHOUSE_XZ } from './terrain.js';

function createFrondGeometry() {
  // Tapered, arched palm frond along +Z
  const lengthSegs = 6;
  const widthSegs = 2;
  const geo = new THREE.PlaneGeometry(0.95, 3.6, widthSegs, lengthSegs);
  // Shift so base is at z = 0, tip at z = 3.6
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 1.8);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const u = z / 3.6; // 0 at base, 1 at tip

    // Taper width: narrow stem, wide mid-blade, pointed tip
    const widthProfile = Math.sin(Math.pow(u, 0.72) * Math.PI) * (1.0 - 0.15 * u);
    const nx = x * Math.max(0.06, widthProfile);

    // Arch up then droop down gracefully
    const archY = Math.sin(u * Math.PI * 0.85) * 0.65 - u * u * 1.15;
    // Slight V-fold along center rib
    const vFold = -Math.abs(nx) * 0.25;

    pos.setXYZ(i, nx, archY + vFold, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createTrunkGeometry(curveLean) {
  const segs = 7;
  const radSegs = 6;
  const height = 5.2;
  const geo = new THREE.CylinderGeometry(0.11, 0.25, height, radSegs, segs, false);
  geo.translate(0, height * 0.5, 0);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = y / height;
    const bend = u * u * curveLean;
    // Slight segmented ring ridges
    const ring = 1.0 + Math.sin(u * Math.PI * 14.0) * 0.05;
    pos.setXYZ(i, x * ring + bend, y, z * ring);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createFoliage(seed = 8080) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const swayNodes = [];

  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#6e523c',
    roughness: 0.94
  });

  const frondMat = new THREE.MeshStandardMaterial({
    color: '#2f6e31',
    roughness: 0.72,
    side: THREE.DoubleSide
  });

  const frondAltMat = new THREE.MeshStandardMaterial({
    color: '#3d7d38',
    roughness: 0.74,
    side: THREE.DoubleSide
  });

  const bushMat = new THREE.MeshStandardMaterial({
    color: '#2b5c2b',
    roughness: 0.88,
    flatShading: true
  });

  const frondGeo = createFrondGeometry();
  const trunkGeos = [
    createTrunkGeometry(0.55),
    createTrunkGeometry(0.95),
    createTrunkGeometry(1.3)
  ];

  // Place 34 tropical palm trees in natural groves (avoiding lighthouse pad & cottage)
  let placed = 0;
  let attempts = 0;
  while (placed < 34 && attempts < 400) {
    attempts++;
    const angle = rng() * Math.PI * 2;
    const r = 3.0 + rng() * 23.0;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = getIslandHeight(x, z);

    if (y < 1.15 || y > 9.5) continue;
    if (Math.hypot(x - LIGHTHOUSE_XZ.x, z - LIGHTHOUSE_XZ.z) < 6.8) continue;
    if (Math.hypot(x - COTTAGE_XZ.x, z - COTTAGE_XZ.z) < 4.5) continue;

    // Check slope via finite difference
    const hx = getIslandHeight(x + 0.8, z) - getIslandHeight(x - 0.8, z);
    const hz = getIslandHeight(x, z + 0.8) - getIslandHeight(x, z - 0.8);
    if (Math.hypot(hx, hz) > 1.25) continue;

    const treeRoot = new THREE.Group();
    const scale = 0.78 + rng() * 0.52;
    treeRoot.position.set(x, y - 0.15, z);
    treeRoot.rotation.y = rng() * Math.PI * 2;
    treeRoot.scale.setScalar(scale);

    const leanIdx = Math.floor(rng() * trunkGeos.length);
    const leanAmount = [0.55, 0.95, 1.3][leanIdx];
    const trunk = new THREE.Mesh(trunkGeos[leanIdx], trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeRoot.add(trunk);

    const crown = new THREE.Group();
    crown.position.set(leanAmount, 5.15, 0);
    const frondCount = 7 + Math.floor(rng() * 3);
    const mat = rng() > 0.45 ? frondMat : frondAltMat;

    for (let f = 0; f < frondCount; f++) {
      const frond = new THREE.Mesh(frondGeo, mat);
      frond.rotation.y = (f / frondCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
      frond.rotation.x = -0.18 + (rng() - 0.5) * 0.22;
      frond.scale.setScalar(0.85 + rng() * 0.28);
      frond.castShadow = true;
      crown.add(frond);
    }

    treeRoot.add(crown);
    group.add(treeRoot);

    swayNodes.push({
      treeRoot,
      crown,
      phase: rng() * Math.PI * 2,
      speed: 1.35 + rng() * 0.55,
      amp: 0.038 + rng() * 0.025
    });

    placed++;
  }

  // Add 28 low coastal shrubs
  const bushGeo = new THREE.DodecahedronGeometry(0.8, 1);
  for (let i = 0; i < 60; i++) {
    const angle = rng() * Math.PI * 2;
    const r = 4.0 + rng() * 22.0;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = getIslandHeight(x, z);
    if (y < 1.3 || y > 10.5) continue;
    if (Math.hypot(x - LIGHTHOUSE_XZ.x, z - LIGHTHOUSE_XZ.z) < 5.0) continue;
    if (Math.hypot(x - COTTAGE_XZ.x, z - COTTAGE_XZ.z) < 3.4) continue;

    const bush = new THREE.Mesh(bushGeo, bushMat);
    const s = 0.55 + rng() * 0.85;
    bush.scale.set(s * 1.2, s * 0.72, s * 1.2);
    bush.position.set(x, y + s * 0.25, z);
    bush.rotation.y = rng() * Math.PI * 2;
    bush.castShadow = true;
    bush.receiveShadow = true;
    group.add(bush);
  }

  function update(t) {
    // Deterministic breeze: gentle gust envelope + individual tree phase
    const gust = 0.85 + 0.35 * Math.sin(t * 0.42);
    for (let i = 0; i < swayNodes.length; i++) {
      const node = swayNodes[i];
      const w = Math.sin(t * node.speed + node.phase) * node.amp * gust;
      const w2 = Math.cos(t * node.speed * 1.37 + node.phase) * node.amp * 0.5 * gust;
      node.treeRoot.rotation.z = w;
      node.treeRoot.rotation.x = w2;
      node.crown.rotation.z = w * 1.35;
      node.crown.rotation.x = w2 * 1.2;
    }
  }

  return { group, update };
}
