import * as THREE from 'three';
import { mulberry32, clamp, lerp, smoothstep, fbm2D, ridged2D } from './prng.js';

// Shared coordinate constants
export const LIGHTHOUSE_POS = new THREE.Vector3(-5.2, 13.9, -4.2);
export const COTTAGE_POS = new THREE.Vector3(-0.9, 11.8, -3.2);
export const HEIGHTMAP_BOUNDS = 64.0; // covers [-64, +64] on X and Z

// Deterministic analytical + noise island heightfield (sea level = 0)
export function getIslandHeight(x, z) {
  // Base elliptical island footprint, slightly organic via domain warp
  const wx = x + (fbm2D(x * 0.055 + 3.1, z * 0.055 - 1.7, 3) - 0.5) * 5.8;
  const wz = z + (fbm2D(x * 0.055 - 7.4, z * 0.055 + 4.2, 3) - 0.5) * 5.8;

  // Main island silhouette radius
  const rx = wx / 23.5;
  const rz = wz / 20.5;
  const r = Math.sqrt(rx * rx + rz * rz);

  // Carve a gentle crescent bay on the South-South-East (+Z, +X)
  const bayDx = (x - 6.5) / 11.5;
  const bayDz = (z - 14.5) / 8.5;
  const bayDist = Math.sqrt(bayDx * bayDx + bayDz * bayDz);
  const bayCarve = Math.max(0, 1.0 - bayDist) * 2.4;

  // Base underwater shelf -> island slope
  let h = lerp(5.2, -7.2, smoothstep(0.15, 1.38, r));

  // Add shallow turquoise sandbar shelf around the cove
  const shelf = Math.exp(-Math.pow((r - 0.95) / 0.35, 2)) * 1.4;
  h += shelf;

  // Dramatic volcanic cliff promontory on North-West (-5.2, -4.2)
  const cliffDx = (x + 5.2) / 12.0;
  const cliffDz = (z + 4.2) / 10.5;
  const cliffR = Math.sqrt(cliffDx * cliffDx + cliffDz * cliffDz);
  const cliffMask = 1.0 - smoothstep(0.28, 1.05, cliffR);
  const cliffRidge = ridged2D(x * 0.09 + 11.2, z * 0.09 - 5.4, 4);
  let cliffH = cliffMask * (10.5 + cliffRidge * 3.8);

  // Terraced cliff ledges for sculptural rock strata
  const terrace = Math.floor(cliffH * 0.45) / 0.45;
  cliffH = lerp(cliffH, terrace, 0.24 * smoothstep(0.15, 0.7, cliffMask));
  h += cliffH;

  // Secondary lush eastern hillock
  const hillDx = (x - 7.0) / 11.0;
  const hillDz = (z - 1.5) / 9.5;
  const hillR = Math.sqrt(hillDx * hillDx + hillDz * hillDz);
  h += (1.0 - smoothstep(0.1, 1.0, hillR)) * 4.4;

  // Natural micro-undulation
  const detail = (fbm2D(x * 0.14 + 21.0, z * 0.14 + 9.0, 4) - 0.5) * 1.5;
  h += detail * smoothstep(-3.0, 2.0, h);

  // Apply crescent beach bay carve
  h -= bayCarve * smoothstep(-2.0, 3.5, h);

  // Flatten the lighthouse summit plateau cleanly around (-5.2, -4.2)
  const lhDist = Math.hypot(x - LIGHTHOUSE_POS.x, z - LIGHTHOUSE_POS.z);
  const lhFlat = 1.0 - smoothstep(2.4, 5.2, lhDist);
  h = lerp(h, LIGHTHOUSE_POS.y, lhFlat);

  // Small flat terrace for keeper's cottage
  const cotDist = Math.hypot(x - COTTAGE_POS.x, z - COTTAGE_POS.z);
  const cotFlat = 1.0 - smoothstep(1.8, 3.8, cotDist);
  h = lerp(h, COTTAGE_POS.y, cotFlat * (1.0 - lhFlat));

  return h;
}

export function getIslandNormal(x, z, eps = 0.35) {
  const hL = getIslandHeight(x - eps, z);
  const hR = getIslandHeight(x + eps, z);
  const hD = getIslandHeight(x, z - eps);
  const hU = getIslandHeight(x, z + eps);
  return new THREE.Vector3(hL - hR, 2.0 * eps, hD - hU).normalize();
}

// Bake deterministic 256x256 heightmap DataTexture for the ocean shader
// Encodes height in [-10, +18] into [0, 255] R channel
export function createHeightmapTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const minH = -10.0;
  const maxH = 18.0;
  for (let iz = 0; iz < size; iz++) {
    const vz = iz / (size - 1);
    const z = lerp(-HEIGHTMAP_BOUNDS, HEIGHTMAP_BOUNDS, vz);
    for (let ix = 0; ix < size; ix++) {
      const vx = ix / (size - 1);
      const x = lerp(-HEIGHTMAP_BOUNDS, HEIGHTMAP_BOUNDS, vx);
      const h = getIslandHeight(x, z);
      const norm = clamp((h - minH) / (maxH - minH), 0, 1);
      const byte = Math.round(norm * 255);
      const idx = (iz * size + ix) * 4;
      data[idx] = byte;
      data[idx + 1] = byte;
      data[idx + 2] = byte;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Create the main island terrain mesh + coastal boulders + rustic wooden jetty
export function createIslandGroup() {
  const group = new THREE.Group();
  const rand = mulberry32(42071);

  // 1. Sculpted terrain mesh
  const segs = 128;
  const span = 82;
  const geo = new THREE.PlaneGeometry(span, span, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const colWetSand = new THREE.Color(0x9b7e57);
  const colDrySand = new THREE.Color(0xe6cca0);
  const colGrassLow = new THREE.Color(0x4c7838);
  const colGrassHigh = new THREE.Color(0x2f592c);
  const colRockDark = new THREE.Color(0x3a373b);
  const colRockWarm = new THREE.Color(0x695a50);
  const colDeepFloor = new THREE.Color(0x1f3d42);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = getIslandHeight(x, z);
    pos.setY(i, h);
  }
  geo.computeVertexNormals();

  const norm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = norm.getY(i);
    const slope = 1.0 - ny; // 0 = flat, 1 = vertical cliff
    const nPatch = fbm2D(x * 0.22 + 5.0, z * 0.22 - 3.0, 3);
    const strata = Math.sin(y * 1.65 + nPatch * 2.5) * 0.5 + 0.5;

    // Base sand -> grass blend by elevation
    if (y < 0.35) {
      tmpCol.copy(colDeepFloor).lerp(colWetSand, smoothstep(-2.8, 0.35, y));
    } else if (y < 2.2) {
      tmpCol.copy(colWetSand).lerp(colDrySand, smoothstep(0.35, 1.45, y));
    } else {
      const grassMix = smoothstep(1.9, 3.6, y);
      const grassCol = colGrassLow.clone().lerp(colGrassHigh, clamp(nPatch * 1.15, 0, 1));
      tmpCol.copy(colDrySand).lerp(grassCol, grassMix);
    }

    // Expose volcanic basalt cliffs on steep slopes and high rocky promontory
    const rockMask = clamp(
      smoothstep(0.18, 0.42, slope) + smoothstep(10.5, 14.2, y) * 0.72,
      0,
      1
    );
    const rockCol = colRockDark.clone().lerp(colRockWarm, strata * 0.65 + nPatch * 0.25);
    tmpCol.lerp(rockCol, rockMask);

    // Subtle dirt path leading from cottage/beach toward lighthouse
    const pathD = Math.hypot(x - COTTAGE_POS.x + 1.5, z - COTTAGE_POS.z - 1.0);
    if (y > 9.0 && pathD < 3.5) {
      tmpCol.lerp(colRockWarm, (1 - pathD / 3.5) * 0.35);
    }

    colors[i * 3] = tmpCol.r;
    colors[i * 3 + 1] = tmpCol.g;
    colors[i * 3 + 2] = tmpCol.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.04,
    flatShading: false,
  });

  const terrainMesh = new THREE.Mesh(geo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  group.add(terrainMesh);

  // 2. Instanced Coastal Boulders & Sea Stacks
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  // Deterministic angular rock perturbation
  const rPos = rockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const n = 0.78 + fbm2D(vx * 1.9 + 4.1, vz * 1.9 + vy * 1.3, 3) * 0.44;
    rPos.setXYZ(i, vx * n, vy * n * 0.78, vz * n);
  }
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x4c4645,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: true,
  });

  const rockTransforms = [];
  // Hand-placed heroic sea stacks near the rocky headland & flanks
  const heroRocks = [
    [-19.5, -1.5, 3.6, 4.5, 3.1],
    [-15.5, 9.5, 2.8, 3.0, 2.5],
    [-13.0, -14.5, 3.4, 3.8, 3.0],
    [19.5, -5.5, 2.9, 2.6, 2.7],
    [16.5, 13.5, 1.9, 1.4, 1.8],
    [-9.5, 13.5, 2.2, 1.8, 2.1],
  ];
  for (const [rx, rz, sx, sy, sz] of heroRocks) {
    const ry = Math.max(getIslandHeight(rx, rz), -0.6) + sy * 0.25;
    rockTransforms.push({ x: rx, y: ry, z: rz, sx, sy, sz, rotY: rand() * Math.PI * 2 });
  }

  // Scattered shoreline & cliff-base boulders
  for (let i = 0; i < 48; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 10 + rand() * 17;
    const rx = Math.cos(ang) * dist;
    const rz = Math.sin(ang) * dist;
    const h = getIslandHeight(rx, rz);
    // Avoid blocking the sandy cove center or lighthouse top
    if (h < -0.5 || h > 11.5) continue;
    if (rx > 1.5 && rx < 13.5 && rz > 8.5 && rz < 17.5) continue;
    const s = 0.55 + rand() * 1.45;
    rockTransforms.push({
      x: rx,
      y: h + s * 0.15,
      z: rz,
      sx: s * (0.9 + rand() * 0.4),
      sy: s * (0.65 + rand() * 0.45),
      sz: s * (0.9 + rand() * 0.4),
      rotY: rand() * Math.PI * 2,
    });
  }

  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockTransforms.length);
  const dummy = new THREE.Object3D();
  const rockTint = new THREE.Color();
  rockTransforms.forEach((rt, idx) => {
    dummy.position.set(rt.x, rt.y, rt.z);
    dummy.rotation.set(rand() * 0.3, rt.rotY, rand() * 0.3);
    dummy.scale.set(rt.sx, rt.sy, rt.sz);
    dummy.updateMatrix();
    rockInst.setMatrixAt(idx, dummy.matrix);
    const shade = 0.72 + rand() * 0.38;
    rockTint.setRGB(0.45 * shade, 0.42 * shade, 0.41 * shade);
    rockInst.setColorAt(idx, rockTint);
  });
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  group.add(rockInst);

  // 3. Small weathered wooden jetty on the sheltered East-South beach
  const jetty = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6e543d,
    roughness: 0.92,
    metalness: 0.02,
  });
  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 2.2, 6);
  const plankGeo = new THREE.BoxGeometry(1.55, 0.08, 0.32);

  for (let i = 0; i < 14; i++) {
    const plank = new THREE.Mesh(plankGeo, woodMat);
    plank.position.set(0, 0.65, i * 0.38);
    plank.rotation.y = (rand() - 0.5) * 0.04;
    jetty.add(plank);
  }
  for (let i = 0; i < 4; i++) {
    const zOff = 0.6 + i * 1.45;
    for (const side of [-0.66, 0.66]) {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(side, 0.05, zOff);
      jetty.add(post);
    }
  }
  jetty.position.set(11.6, 0.0, 10.6);
  jetty.rotation.y = 0.55;
  group.add(jetty);

  return group;
}
