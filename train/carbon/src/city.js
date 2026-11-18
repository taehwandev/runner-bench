import * as THREE from "three";
import { createRng } from "./rng.js";

function buildSnowCanyonFloor(group, cliffZ, textures, rng) {
  const width = 1100;
  const length = cliffZ + 340;
  const geo = new THREE.PlaneGeometry(width, length, 72, 96);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + (cliffZ - 340) * 0.5;
    pos.setZ(i, z);

    const ridge =
      Math.sin(x * 0.028 + z * 0.015) * 2.6 +
      Math.cos(x * 0.07 - z * 0.04) * 1.2 +
      rng.hashSigned(i, 91) * 0.45;
    const canyonDip = Math.min(1.0, Math.abs(x) / 55.0);
    pos.setY(i, -1.6 + ridge * (0.35 + 0.65 * canyonDip));
  }
  geo.computeVertexNormals();

  const snowFloorTex = textures.snowMap.clone();
  snowFloorTex.repeat.set(36, 44);
  snowFloorTex.needsUpdate = true;

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xaabfd9,
    map: snowFloorTex,
    roughness: 0.84,
    metalness: 0.08,
  });
  group.add(new THREE.Mesh(geo, floorMat));
}

function generateTowerSpecs(rng, track, cliffZ) {
  const specs = [];
  const beacons = [];
  const pose = {};

  function getCorridorX(z) {
    track.getPoseAtDistance(Math.min(950, Math.max(-230, z + 26)), pose);
    return pose.position.x;
  }

  // Tier 1: Foreground canyon towers flanking the elevated viaduct
  for (let z = -220; z <= cliffZ - 125; z += 36) {
    const cx = getCorridorX(z);
    for (const side of [-1, 1]) {
      const extraClear = z > 490 && z < 795 ? 20 : 0;
      const lateral = rng.range(25, 48) + extraClear;
      const w = rng.range(18, 30);
      const d = rng.range(18, 30);
      const h = rng.range(62, 178);
      const x = cx + side * (lateral + w * 0.5);

      specs.push({ x, z: z + rng.signed() * 7, w, d, h, tier: 1 });
      if (h > 115 && rng.chance(0.65)) {
        beacons.push({ x, y: h + 5.5, z, phase: rng.range(0, Math.PI * 2) });
      }
    }
  }

  // Tier 2: Midground high-rises receding into winter mist
  for (let i = 0; i < 190; i++) {
    const z = rng.range(-260, cliffZ - 40);
    const cx = getCorridorX(z);
    const side = rng.chance(0.5) ? 1 : -1;
    const lateral = rng.range(66, 180);
    const w = rng.range(22, 44);
    const d = rng.range(22, 44);
    const h = rng.range(80, 245);
    const x = cx + side * lateral;
    if (z > 800 && Math.abs(x) < 92) continue;
    specs.push({ x, z, w, d, h, tier: 2 });
    if (h > 170 && rng.chance(0.45)) {
      beacons.push({ x, y: h + 6.5, z, phase: rng.range(0, Math.PI * 2) });
    }
  }

  // Tier 3: Colossal background silhouette towers for vast depth
  for (let i = 0; i < 165; i++) {
    const z = rng.range(-300, cliffZ + 140);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = side * rng.range(185, 520);
    const w = rng.range(32, 70);
    const d = rng.range(32, 70);
    const h = rng.range(125, 340);
    specs.push({ x, z, w, d, h, tier: 3 });
  }

  return { specs, beacons };
}

function buildInstancedTowers(group, specs, textures, rng) {
  const towerAlbedo = textures.towerAlbedo.clone();
  towerAlbedo.repeat.set(1, 2.5);
  towerAlbedo.needsUpdate = true;

  const towerEmissive = textures.towerEmissive.clone();
  towerEmissive.repeat.set(1, 2.5);
  towerEmissive.needsUpdate = true;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x768ca8,
    map: towerAlbedo,
    emissive: 0xffcda0,
    emissiveMap: towerEmissive,
    emissiveIntensity: 0.72,
    roughness: 0.68,
    metalness: 0.28,
  });

  const crownMat = new THREE.MeshStandardMaterial({
    color: 0x2b394e,
    roughness: 0.58,
    metalness: 0.48,
  });

  const snowRoofMat = new THREE.MeshStandardMaterial({
    color: 0xd9e7f7,
    roughness: 0.82,
    metalness: 0.06,
  });

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const mainMesh = new THREE.InstancedMesh(unitBox, bodyMat, specs.length);
  const setbackMesh = new THREE.InstancedMesh(unitBox, bodyMat, specs.length);
  const snowCapMesh = new THREE.InstancedMesh(unitBox, snowRoofMat, specs.length);
  const spireMesh = new THREE.InstancedMesh(unitBox, crownMat, specs.length);

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  specs.forEach((s, i) => {
    const baseH = s.h * 0.78;
    dummy.position.set(s.x, baseH * 0.5 - 2.0, s.z);
    dummy.scale.set(s.w, baseH, s.d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mainMesh.setMatrixAt(i, dummy.matrix);

    const shade =
      s.tier === 1
        ? rng.range(0.86, 1.05)
        : s.tier === 2
          ? rng.range(0.68, 0.88)
          : rng.range(0.48, 0.68);
    tint.setRGB(shade * 0.84, shade * 0.92, shade * 1.06);
    mainMesh.setColorAt(i, tint);

    const topW = s.w * rng.range(0.58, 0.78);
    const topD = s.d * rng.range(0.58, 0.78);
    const topH = s.h * 0.24;
    dummy.position.set(s.x, baseH + topH * 0.5 - 2.2, s.z);
    dummy.scale.set(topW, topH, topD);
    dummy.updateMatrix();
    setbackMesh.setMatrixAt(i, dummy.matrix);
    setbackMesh.setColorAt(i, tint);

    dummy.position.set(s.x, baseH + topH - 2.0, s.z);
    dummy.scale.set(topW * 0.96, 0.85, topD * 0.96);
    dummy.updateMatrix();
    snowCapMesh.setMatrixAt(i, dummy.matrix);

    const spireH = s.tier < 3 ? rng.range(6, 22) : rng.range(4, 12);
    dummy.position.set(s.x, baseH + topH + spireH * 0.5 - 2.0, s.z);
    dummy.scale.set(0.45, spireH, 0.45);
    dummy.updateMatrix();
    spireMesh.setMatrixAt(i, dummy.matrix);
  });

  for (const m of [mainMesh, setbackMesh, snowCapMesh, spireMesh]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    group.add(m);
  }

  return bodyMat;
}

function buildAviationBeacons(group, beacons) {
  if (!beacons.length) return null;
  const geo = new THREE.SphereGeometry(0.65, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const mesh = new THREE.InstancedMesh(geo, mat, beacons.length);
  const dummy = new THREE.Object3D();

  beacons.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);

  return { mesh, beacons, dummy };
}

export function createCityEnvironment(scene, track, textures) {
  const rng = createRng(314159);
  const group = new THREE.Group();
  group.name = "FrozenDuskCity";

  const cliffPose = track.getPoseAtDistance(960.0);
  const cliffZ = cliffPose.position.z;

  buildSnowCanyonFloor(group, cliffZ, textures, rng);
  const { specs, beacons } = generateTowerSpecs(rng, track, cliffZ);
  const towerBodyMat = buildInstancedTowers(group, specs, textures, rng);
  const beaconRig = buildAviationBeacons(group, beacons);

  scene.add(group);

  return {
    cliffZ,
    update(time) {
      const nightFactor = Math.min(1.0, Math.max(0.0, time / 48.0));
      towerBodyMat.emissiveIntensity = 0.68 + nightFactor * 0.42;

      if (beaconRig) {
        const { mesh, beacons: list, dummy } = beaconRig;
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          const pulse = 0.55 + 0.45 * Math.sin(time * 2.8 + b.phase);
          dummy.position.set(b.x, b.y, b.z);
          dummy.scale.setScalar(0.65 + pulse * 0.75);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
