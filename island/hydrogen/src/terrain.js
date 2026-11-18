import * as THREE from 'three';
import { clamp, fbm2D, lerp, mulberry32, ridgedFbm2D, smoothstep } from './prng.js';

export const ISLAND_MAP_HALF_SIZE = 64;

// Key landmark coordinates (X, Z); Y is sampled from getIslandHeight
export const LIGHTHOUSE_XZ = { x: -13.5, z: -5.5 };
export const COTTAGE_XZ = { x: -4.5, z: 2.0 };
export const PIER_XZ = { x: 20.5, z: 11.5 };

/**
 * Deterministic heightfield for the tropical island.
 * Water level is y = 0.0.
 */
export function getIslandHeight(x, z) {
  // Subtle organic coastline warp
  const warpX = x + (fbm2D(x * 0.06 + 11.3, z * 0.06 - 5.7, 3, 101) - 0.5) * 8.5;
  const warpZ = z + (fbm2D(x * 0.06 - 7.1, z * 0.06 + 13.9, 3, 202) - 0.5) * 8.5;

  // Main island silhouette (elongated slightly WNW to ESE)
  const rx = warpX / 29.0;
  const rz = warpZ / 24.5;
  const distMain = Math.sqrt(rx * rx + rz * rz);

  // Sheltered crescent cove carved out on the SE side
  const coveDx = (x - 21.0) / 15.0;
  const coveDz = (z - 12.0) / 14.0;
  const coveDist = Math.sqrt(coveDx * coveDx + coveDz * coveDz);
  const coveCut = (1.0 - smoothstep(0.25, 1.15, coveDist)) * 0.42;

  const baseMask = clamp(1.0 - smoothstep(0.45, 1.08, distMain + coveCut), 0, 1);

  // Seafloor outside island drops well below wave troughs (-0.7) so seafloor never pokes through ocean
  let h = lerp(-6.5, -2.6, smoothstep(1.25, 0.75, distMain + coveCut * 0.45));

  // Gentle sandy beach & central tropical hill with clean drop-off below waterline
  const hillNoise = fbm2D(x * 0.075 + 3.1, z * 0.075 + 9.4, 4, 303);
  const centralHill = baseMask * (5.2 + hillNoise * 7.8) - 2.6;
  h = Math.max(h, centralHill);

  // Dramatic rocky cliff promontory on the WNW side (lighthouse headland)
  const cliffDx = (x - LIGHTHOUSE_XZ.x) / 13.5;
  const cliffDz = (z - LIGHTHOUSE_XZ.z) / 12.5;
  const cliffDist = Math.sqrt(cliffDx * cliffDx + cliffDz * cliffDz);
  const cliffPlateau = 1.0 - smoothstep(0.22, 0.92, cliffDist);
  const cliffRidge = ridgedFbm2D(x * 0.09, z * 0.09, 3, 404);

  // Flatten top slightly around lighthouse pad so it sits cleanly
  const padDist = Math.hypot(x - LIGHTHOUSE_XZ.x, z - LIGHTHOUSE_XZ.z);
  const padFlat = 1.0 - smoothstep(2.2, 5.2, padDist);

  if (cliffPlateau > 0.001) {
    const cliffHeight = cliffPlateau * (14.5 + cliffRidge * 3.8 * (1.0 - padFlat * 0.85)) - 1.2;
    h = Math.max(h, cliffHeight);
  }

  // Secondary rocky outcrop on the northern shoulder
  const northDx = (x + 2.0) / 10.5;
  const northDz = (z + 15.0) / 9.5;
  const northDist = Math.sqrt(northDx * northDx + northDz * northDz);
  const northPlateau = 1.0 - smoothstep(0.18, 0.88, northDist);
  if (northPlateau > 0.001) {
    const northOutcrop = northPlateau * (8.5 + cliffRidge * 3.5) - 1.2;
    h = Math.max(h, northOutcrop);
  }

  // Gently flatten cottage clearing
  const cotDist = Math.hypot(x - COTTAGE_XZ.x, z - COTTAGE_XZ.z);
  const cotFlat = 1.0 - smoothstep(2.0, 5.5, cotDist);
  if (cotFlat > 0) {
    h = lerp(h, 5.4, cotFlat * 0.85);
  }

  // Soften beach slope on the SE cove above waterline so waves wash up smoothly
  const beachZone = 1.0 - smoothstep(0.35, 1.05, coveDist);
  if (beachZone > 0 && h > 0.05 && h < 3.2) {
    const smoothBeach = smoothstep(0.0, 2.8, h) * 2.1;
    h = lerp(h, smoothBeach, beachZone * 0.45);
  }

  return h;
}

function computeTerrainColor(x, y, z, slopeY) {
  const n = fbm2D(x * 0.22, z * 0.22, 3, 707);
  const sand = new THREE.Color('#e6cfa3');
  const wetSand = new THREE.Color('#9c835c');
  const grass = new THREE.Color('#396933');
  const lushGrass = new THREE.Color('#274f28');
  const rock = new THREE.Color('#5a5452');
  const darkRock = new THREE.Color('#383436');

  const col = new THREE.Color();

  // Base sand vs grass by elevation
  if (y < 0.55) {
    col.copy(wetSand).lerp(sand, smoothstep(-0.2, 0.55, y));
  } else if (y < 2.2) {
    col.copy(sand).lerp(grass, smoothstep(1.1, 2.2, y));
  } else {
    col.copy(grass).lerp(lushGrass, clamp(n * 1.1, 0, 1));
  }

  // Steep slopes or high rocky cliffs -> stratified rock
  const rockBySlope = 1.0 - smoothstep(0.62, 0.84, slopeY);
  const rockByHeight = smoothstep(8.2, 12.2, y) * 0.72;
  const rockFactor = clamp(Math.max(rockBySlope, rockByHeight), 0, 1);

  const strata = Math.sin(y * 2.4 + n * 4.0) * 0.5 + 0.5;
  const rockCol = darkRock.clone().lerp(rock, strata * 0.75 + 0.15);

  col.lerp(rockCol, rockFactor);
  return col;
}

function buildHeightTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const minH = -8.0;
  const maxH = 18.0;

  for (let iz = 0; iz < size; iz++) {
    const z = ((iz / (size - 1)) * 2 - 1) * ISLAND_MAP_HALF_SIZE;
    for (let ix = 0; ix < size; ix++) {
      const x = ((ix / (size - 1)) * 2 - 1) * ISLAND_MAP_HALF_SIZE;
      const h = getIslandHeight(x, z);
      const norm = clamp((h - minH) / (maxH - minH), 0, 1);
      const val = Math.round(norm * 255);
      const idx = (iz * size + ix) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function createBoulders(rng) {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#4f4a48',
    roughness: 0.92,
    metalness: 0.04,
    flatShading: true
  });

  const baseGeo = new THREE.IcosahedronGeometry(1, 1);
  // Perturb vertices slightly once
  const posAttr = baseGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const s = 0.84 + 0.32 * fbm2D(vx * 2.1 + 1.5, vz * 2.1 - 0.9, 2, 919);
    posAttr.setXYZ(i, vx * s, vy * s * 0.78, vz * s);
  }
  baseGeo.computeVertexNormals();

  for (let i = 0; i < 42; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 16 + rng() * 19;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = getIslandHeight(x, z);

    // Place boulders mostly along rocky shores & cliff bases, avoid sandy cove center
    if (y < -1.4 || y > 10.0) continue;
    if (x > 10 && z > 2 && y < 1.8) continue;

    const mesh = new THREE.Mesh(baseGeo, rockMat);
    const scale = 0.55 + rng() * 1.45;
    mesh.scale.set(scale * (0.9 + rng() * 0.4), scale * (0.65 + rng() * 0.45), scale * (0.9 + rng() * 0.4));
    mesh.position.set(x, y - scale * 0.2, z);
    mesh.rotation.set(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

function createCottage() {
  const group = new THREE.Group();
  const y = getIslandHeight(COTTAGE_XZ.x, COTTAGE_XZ.z);
  group.position.set(COTTAGE_XZ.x, y, COTTAGE_XZ.z);
  group.rotation.y = 0.65;

  const wallMat = new THREE.MeshStandardMaterial({
    color: '#ede6d8',
    roughness: 0.88
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: '#8c3c2f',
    roughness: 0.82
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: '#222b38',
    emissive: new THREE.Color('#ffaa44'),
    emissiveIntensity: 0.0,
    roughness: 0.3
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.1), wallMat);
  body.position.y = 0.9;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.15, 1.25, 4), roofMat);
  roof.position.y = 2.4;
  roof.rotation.y = Math.PI * 0.25;
  roof.castShadow = true;
  group.add(roof);

  const win1 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), windowMat);
  win1.position.set(0.55, 0.95, 1.06);
  group.add(win1);

  const win2 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), windowMat);
  win2.position.set(-0.55, 0.95, 1.06);
  group.add(win2);

  const winSide = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), windowMat);
  winSide.position.set(1.31, 0.95, 0.0);
  winSide.rotation.y = Math.PI * 0.5;
  group.add(winSide);

  return { group, windowMat };
}

function createPier() {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    color: '#6b4d35',
    roughness: 0.92
  });

  group.position.set(PIER_XZ.x, 0.45, PIER_XZ.z);
  group.rotation.y = -0.45;

  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 7.2), woodMat);
  deck.position.set(0, 0.2, 2.2);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  for (let i = 0; i < 4; i++) {
    const z = -0.5 + i * 1.9;
    for (const sx of [-0.55, 0.55]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.8, 6), woodMat);
      post.position.set(sx, -0.35, z);
      post.castShadow = true;
      group.add(post);
    }
  }

  return group;
}

export function createIsland(seed = 2026) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();

  // Terrain mesh
  const segs = 136;
  const size = 96;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, getIslandHeight(x, z));
  }
  geo.computeVertexNormals();

  const norm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const slopeY = norm.getY(i);
    const c = computeTerrainColor(x, y, z, slopeY);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02
  });

  const terrainMesh = new THREE.Mesh(geo, terrainMat);
  terrainMesh.castShadow = true;
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  group.add(createBoulders(rng));

  const cottage = createCottage();
  group.add(cottage.group);
  group.add(createPier());

  const heightTexture = buildHeightTexture();

  return {
    group,
    heightTexture,
    mapHalfSize: ISLAND_MAP_HALF_SIZE,
    cottageWindowMat: cottage.windowMat
  };
}
