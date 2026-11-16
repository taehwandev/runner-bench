import * as THREE from 'three';
import { DISTRICTS } from './config.js';

const CHUNK_LEN = 24;
const CHUNK_COUNT = 8;

function buildSkyscraperSide(sideSign, winTex, signTex, mats, idx) {
  const group = new THREE.Group();
  const h1 = 16 + ((idx * 7 + (sideSign > 0 ? 3 : 0)) % 14);
  const w1 = 5.4;
  const d1 = 9.6;

  const towerMat = new THREE.MeshStandardMaterial({
    map: winTex,
    roughness: 0.45,
    metalness: 0.3,
    emissive: 0xffffff,
    emissiveMap: winTex,
    emissiveIntensity: 0.55,
  });

  const mainTower = new THREE.Mesh(new THREE.BoxGeometry(w1, h1, d1), towerMat);
  mainTower.position.set(sideSign * 8.6, h1 * 0.5, -5);
  group.add(mainTower);

  // Setback upper tier + spire
  const h2 = 5 + (idx % 5);
  const upperTier = new THREE.Mesh(new THREE.BoxGeometry(w1 * 0.68, h2, d1 * 0.68), towerMat);
  upperTier.position.set(sideSign * 8.6, h1 + h2 * 0.5, -5);
  group.add(upperTier);

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 4.2, 6), mats.darkMetal);
  spire.position.set(sideSign * 8.6, h1 + h2 + 2.1, -5);
  group.add(spire);

  // Second adjacent building per 24u chunk
  const hB = 11 + ((idx * 11 + (sideSign < 0 ? 5 : 1)) % 10);
  const secTower = new THREE.Mesh(new THREE.BoxGeometry(5.0, hB, 9.2), towerMat);
  secTower.position.set(sideSign * 8.4, hB * 0.5, 6.5);
  group.add(secTower);

  // Neon vertical edge trim + storefront canopy
  const trimMat = sideSign < 0 ? mats.neonCyan : mats.neonPink;
  const trimStrip = new THREE.Mesh(new THREE.BoxGeometry(0.14, h1, 0.14), trimMat);
  trimStrip.position.set(sideSign * 5.88, h1 * 0.5, -0.2);
  group.add(trimStrip);

  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 7.6), trimMat);
  awning.position.set(sideSign * 5.65, 3.1, 6.5);
  group.add(awning);

  // Projecting Neon Sign Billboard
  const signBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 1.55),
    new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
  );
  signBoard.position.set(sideSign * 5.35, 5.6 + (idx % 3) * 1.4, -4.5);
  signBoard.rotation.y = sideSign < 0 ? Math.PI * 0.12 : -Math.PI * 0.12;
  group.add(signBoard);

  return group;
}

function buildDowntownVariant(textures, mats, idx) {
  const group = new THREE.Group();
  const winL = textures.windows[idx % textures.windows.length];
  const winR = textures.windows[(idx + 1) % textures.windows.length];
  const signL = textures.signs[(idx * 2) % textures.signs.length];
  const signR = textures.signs[(idx * 2 + 1) % textures.signs.length];
  group.add(buildSkyscraperSide(-1, winL, signL, mats, idx));
  group.add(buildSkyscraperSide(1, winR, signR, mats, idx));
  return group;
}

function buildOverpassVariant(textures, mats, idx) {
  const group = new THREE.Group();
  // Outer industrial structures
  const win = textures.windows[(idx + 2) % textures.windows.length];
  const lowMat = new THREE.MeshStandardMaterial({
    map: win,
    roughness: 0.55,
    emissive: 0xffaa44,
    emissiveMap: win,
    emissiveIntensity: 0.32,
  });
  for (const s of [-1, 1]) {
    const bldg = new THREE.Mesh(new THREE.BoxGeometry(5.5, 9.5, 18), lowMat);
    bldg.position.set(s * 9.2, 4.75, 0);
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.3, 8.2, 1.8), mats.concrete);
    pier.position.set(s * 5.6, 4.1, 0);
    group.add(bldg, pier);
  }

  // Overhead elevated highway bridge deck every chunk (with open sky gap)
  if (idx % 2 === 0) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(14.5, 1.05, 9.5), mats.concrete);
    deck.position.set(0, 8.1, 0);
    const railStrip = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.22, 0.22), mats.neonAmber);
    railStrip.position.set(0, 7.62, 4.78);
    const underLight = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.12, 0.4), mats.neonCyan);
    underLight.position.set(0, 7.52, 0);
    group.add(deck, railStrip, underLight);
  }
  return group;
}

function buildTunnelVariant(mats) {
  const group = new THREE.Group();
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.6, CHUNK_LEN), mats.concrete);
    wall.position.set(s * 5.85, 3.8, 0);
    const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, CHUNK_LEN), mats.neonLime);
    conduit.position.set(s * 5.1, 2.2, 0);
    group.add(wall, conduit);
  }
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(13.2, 1.2, CHUNK_LEN), mats.concrete);
  ceiling.position.set(0, 7.6, 0);
  group.add(ceiling);

  // Ribbed arches + overhead neon light strips
  for (const zOff of [-8, 0, 8]) {
    const ribTop = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.45, 0.7), mats.darkMetal);
    ribTop.position.set(0, 6.85, zOff);
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 0.36), mats.neonLime);
    lightBar.position.set(0, 6.58, zOff);
    group.add(ribTop, lightBar);
  }
  return group;
}

function buildRailyardVariant(textures, mats, idx) {
  const group = new THREE.Group();
  for (const s of [-1, 1]) {
    const depot = new THREE.Mesh(new THREE.BoxGeometry(5.6, 8.2, 19), mats.darkMetal);
    depot.position.set(s * 9.0, 4.1, 0);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.4, 8), mats.darkMetal);
    post.position.set(s * 5.3, 3.2, 2);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), mats.neonRed);
    beacon.position.set(s * 5.05, 4.2, 2);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.16, 0.16),
      new THREE.MeshBasicMaterial({ map: textures.hazard })
    );
    arm.position.set(s * 4.2, 5.4, 2);
    arm.rotation.z = s * -0.35;
    group.add(depot, post, beacon, arm);
  }

  // Embedded cross-street steel rail tracks
  for (const zRail of [-4.5, 4.5]) {
    const railA = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.06, 0.14), mats.steelRail);
    railA.position.set(0, 0.03, zRail - 0.5);
    const railB = railA.clone();
    railB.position.set(0, 0.03, zRail + 0.5);
    group.add(railA, railB);
  }

  if (idx % 2 === 1) {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.65, 1.45), mats.darkMetal);
    truss.position.set(0, 6.9, 2);
    const warnStrip = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.2, 0.2), mats.neonRed);
    warnStrip.position.set(0, 6.5, 2.75);
    const crossTrain = new THREE.Group();
    const coach = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.35, 1.15), mats.concrete);
    const winBand = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.34, 1.2), mats.neonAmber);
    winBand.position.y = 0.12;
    crossTrain.add(coach, winBand);
    crossTrain.position.set(-10, 7.9, 2);
    group.userData.crossTrain = crossTrain;
    group.add(truss, warnStrip, crossTrain);
  }
  return group;
}

function buildHorizonBackdrop(mats, glowTex) {
  const horizon = new THREE.Group();
  horizon.position.set(0, 0, -148);
  const silhouetteMat = new THREE.MeshBasicMaterial({ color: 0x070a18 });

  const layout = [
    [-26, 36, 7.5],
    [-18, 48, 8.2],
    [-10, 32, 6.4],
    [10, 35, 6.6],
    [18, 52, 8.5],
    [27, 38, 7.2],
  ];
  for (let i = 0; i < layout.length; i++) {
    const [x, h, w] = layout[i];
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), silhouetteMat);
    tower.position.set(x, h * 0.5, 0);
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.85, 0.45, 4.2),
      i % 2 === 0 ? mats.neonCyan : mats.neonPink
    );
    crown.position.set(x, h - 1.2, 0);
    horizon.add(tower, crown);
  }

  // Cyber-noir synth moon halo high above the avenue
  const moonHalo = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xff2a9d,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  moonHalo.position.set(0, 29, -4);
  const moonRing = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.2, 36), mats.neonCyan);
  moonRing.position.set(0, 29, -3);
  horizon.add(moonHalo, moonRing);
  return horizon;
}

function buildBaseChunk(textures, mats, idx) {
  const chunk = new THREE.Group();

  // Wet Asphalt Road Deck
  const road = new THREE.Mesh(new THREE.PlaneGeometry(8.4, CHUNK_LEN), mats.road);
  road.rotation.x = -Math.PI / 2;
  chunk.add(road);

  // Sidewalks + Glowing Curb Strips + Streetlamps + Wet-road light reflections
  const lampHeads = [];
  const roadReflections = [];

  for (const s of [-1, 1]) {
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, CHUNK_LEN), mats.concrete);
    sidewalk.position.set(s * 5.3, 0.14, 0);
    const curbNeon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, CHUNK_LEN), mats.curbNeon);
    curbNeon.position.set(s * 4.22, 0.22, 0);
    chunk.add(sidewalk, curbNeon);

    // Streetlamp
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.2, 6), mats.darkMetal);
    pole.position.set(s * 4.65, 2.6, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.09, 0.09), mats.darkMetal);
    arm.position.set(s * 4.15, 5.15, 0);
    const headMat = mats.lampHead.clone();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.24), headMat);
    head.position.set(s * 3.7, 5.08, 0);
    lampHeads.push(headMat);

    // Wet road reflection streak directly beneath streetlamp & neon signs
    const reflMat = new THREE.MeshBasicMaterial({
      map: textures.glow,
      color: s < 0 ? 0x00f0ff : 0xff2a9d,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 7.5), reflMat);
    refl.rotation.x = -Math.PI / 2;
    refl.position.set(s * 2.85, 0.02, 0);
    roadReflections.push(reflMat);

    chunk.add(pole, arm, head, refl);
  }

  const variants = {
    downtown: buildDowntownVariant(textures, mats, idx),
    overpass: buildOverpassVariant(textures, mats, idx),
    tunnel: buildTunnelVariant(mats),
    railyard: buildRailyardVariant(textures, mats, idx),
  };

  for (const key of Object.keys(variants)) {
    variants[key].visible = key === 'downtown';
    chunk.add(variants[key]);
  }

  return { group: chunk, variants, lampHeads, roadReflections };
}

export class CityWorld {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.mats = {
      road: new THREE.MeshStandardMaterial({
        map: textures.road.map,
        roughnessMap: textures.road.roughnessMap,
        roughness: 0.72,
        metalness: 0.38,
      }),
      concrete: new THREE.MeshStandardMaterial({ color: 0x171c2c, roughness: 0.78, metalness: 0.15 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x101524, roughness: 0.42, metalness: 0.68 }),
      steelRail: new THREE.MeshStandardMaterial({ color: 0x8ea0b8, roughness: 0.25, metalness: 0.85 }),
      curbNeon: new THREE.MeshBasicMaterial({ color: 0x00e5ff }),
      lampHead: new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
      neonCyan: new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
      neonPink: new THREE.MeshBasicMaterial({ color: 0xff2a9d }),
      neonAmber: new THREE.MeshBasicMaterial({ color: 0xffb703 }),
      neonLime: new THREE.MeshBasicMaterial({ color: 0x39ff88 }),
      neonRed: new THREE.MeshBasicMaterial({ color: 0xff2a55 }),
    };

    this.horizon = buildHorizonBackdrop(this.mats, textures.glow);
    this.root.add(this.horizon);

    this.chunks = [];
    for (let i = 0; i < CHUNK_COUNT; i++) {
      const c = buildBaseChunk(textures, this.mats, i);
      c.group.position.z = 12 - i * CHUNK_LEN;
      this.applyDistrictToChunk(c, 0);
      this.root.add(c.group);
      this.chunks.push(c);
    }

    this.fogColorCurrent = new THREE.Color(DISTRICTS[0].fogColor);
    this.skyColorCurrent = new THREE.Color(DISTRICTS[0].skyColor);
    this.ambientColorCurrent = new THREE.Color(DISTRICTS[0].ambientColor);
    this.pulseTimer = 0;
  }

  applyDistrictToChunk(chunk, districtIndex) {
    const d = DISTRICTS[districtIndex];
    for (const [id, grp] of Object.entries(chunk.variants)) {
      grp.visible = id === d.id;
    }
    chunk.lampHeads.forEach((m) => m.color.setHex(d.lampColor));
    chunk.roadReflections[0].color.setHex(d.accentPrimary);
    chunk.roadReflections[1].color.setHex(d.accentSecondary);
  }

  resetToStart() {
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i].group.position.z = 12 - i * CHUNK_LEN;
      this.applyDistrictToChunk(this.chunks[i], 0);
    }
  }

  update(dt, speed, districtIndex, scene, ambientLight) {
    this.pulseTimer += dt;
    const dz = speed * dt;

    let minZ = Infinity;
    for (const c of this.chunks) {
      c.group.position.z += dz;
      if (c.group.position.z < minZ) minZ = c.group.position.z;
    }

    for (const c of this.chunks) {
      if (c.group.position.z > 26) {
        c.group.position.z = minZ - CHUNK_LEN;
        minZ = c.group.position.z;
        this.applyDistrictToChunk(c, districtIndex);
      }
    }

    // Alternating flash on rail crossing red beacons & animate overhead crossing train
    const flash = Math.sin(this.pulseTimer * 10) > 0 ? 0xff2a55 : 0x550818;
    this.mats.neonRed.color.setHex(flash);
    for (const c of this.chunks) {
      const ct = c.variants.railyard.userData.crossTrain;
      if (ct && c.variants.railyard.visible) {
        ct.position.x = ((this.pulseTimer * 18) % 34) - 17;
      }
    }

    const targetDistrict = DISTRICTS[districtIndex];
    this.horizon.visible = targetDistrict.id !== 'tunnel';
    this.mats.curbNeon.color.lerp(new THREE.Color(targetDistrict.accentPrimary), Math.min(1, dt * 2.5));

    this.fogColorCurrent.lerp(new THREE.Color(targetDistrict.fogColor), Math.min(1, dt * 1.8));
    this.skyColorCurrent.lerp(new THREE.Color(targetDistrict.skyColor), Math.min(1, dt * 1.8));
    this.ambientColorCurrent.lerp(new THREE.Color(targetDistrict.ambientColor), Math.min(1, dt * 1.8));

    if (scene.fog) {
      scene.fog.color.copy(this.fogColorCurrent);
      scene.fog.density += (targetDistrict.fogDensity - scene.fog.density) * Math.min(1, dt * 1.8);
    }
    scene.background.copy(this.skyColorCurrent);
    if (ambientLight) {
      ambientLight.color.copy(this.ambientColorCurrent);
    }
  }
}
