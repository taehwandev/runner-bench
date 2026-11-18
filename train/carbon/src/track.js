import * as THREE from "three";

const TRACK_Y = 18.0;
const RAW_Z_START = -260.0;
const RAW_Z_END = 1860.0;
const SAMPLE_COUNT = 4240;
const RAIL_HALF_GAUGE = 0.78;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function evalRawCurve(z, out) {
  let x = 0;
  if (z < 590.0) {
    const w = Math.min(1.0, Math.max(0.0, (590.0 - z) / 360.0));
    const env = w * w * w * (w * (w * 6 - 15) + 10);
    x =
      env *
      (28.0 * Math.sin(z * 0.0092 + 0.35) +
        11.0 * Math.cos(z * 0.0185 - 0.6));
  }
  out.set(x, TRACK_Y, z);
  return out;
}

function buildArcLengthTable() {
  const points = new Array(SAMPLE_COUNT);
  const tangents = new Array(SAMPLE_COUNT);
  const arcS = new Float64Array(SAMPLE_COUNT);

  let accum = 0;
  const prev = new THREE.Vector3();
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const u = i / (SAMPLE_COUNT - 1);
    const z = RAW_Z_START + (RAW_Z_END - RAW_Z_START) * u;
    const p = evalRawCurve(z, new THREE.Vector3());
    points[i] = p;
    if (i > 0) accum += p.distanceTo(prev);
    arcS[i] = accum;
    prev.copy(p);
  }

  let zeroIdx = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    if (points[i].z >= -20.0) {
      zeroIdx = i;
      break;
    }
  }
  const sOrigin = arcS[zeroIdx];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    arcS[i] -= sOrigin;
  }

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(SAMPLE_COUNT - 1, i + 1)];
    tangents[i] = new THREE.Vector3().subVectors(b, a).normalize();
  }

  return { points, tangents, arcS };
}

function createSampler(table) {
  const { points, tangents, arcS } = table;
  const minS = arcS[0];
  const maxS = arcS[SAMPLE_COUNT - 1];
  const tmpMat = new THREE.Matrix4();

  return function getPoseAtDistance(s, target = {}) {
    const clamped = Math.min(maxS, Math.max(minS, s));
    let lo = 0;
    let hi = SAMPLE_COUNT - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arcS[mid] <= clamped) lo = mid;
      else hi = mid;
    }
    const span = Math.max(1e-6, arcS[hi] - arcS[lo]);
    const alpha = (clamped - arcS[lo]) / span;

    const pos = (target.position || new THREE.Vector3()).lerpVectors(
      points[lo],
      points[hi],
      alpha
    );
    const tan = (target.tangent || new THREE.Vector3())
      .lerpVectors(tangents[lo], tangents[hi], alpha)
      .normalize();
    const left = (target.left || new THREE.Vector3())
      .crossVectors(WORLD_UP, tan)
      .normalize();
    const up = (target.up || new THREE.Vector3()).crossVectors(tan, left).normalize();

    tmpMat.makeBasis(left, up, tan);
    const quat = (target.quaternion || new THREE.Quaternion()).setFromRotationMatrix(
      tmpMat
    );

    target.position = pos;
    target.tangent = tan;
    target.left = left;
    target.up = up;
    target.quaternion = quat;
    return target;
  };
}

function buildTrackRibbonGeometry(getPose, sStart, sEnd, step, profilePts) {
  const steps = Math.max(2, Math.round((sEnd - sStart) / step));
  const ringLen = profilePts.length;
  const positions = new Float32Array((steps + 1) * ringLen * 3);
  const uvs = new Float32Array((steps + 1) * ringLen * 2);
  const indices = [];
  const pose = {};

  for (let i = 0; i <= steps; i++) {
    const s = sStart + ((sEnd - sStart) * i) / steps;
    getPose(s, pose);
    for (let j = 0; j < ringLen; j++) {
      const [lx, ly] = profilePts[j];
      const idx = (i * ringLen + j) * 3;
      positions[idx] = pose.position.x + pose.left.x * lx + pose.up.x * ly;
      positions[idx + 1] = pose.position.y + pose.left.y * lx + pose.up.y * ly;
      positions[idx + 2] = pose.position.z + pose.left.z * lx + pose.up.z * ly;

      const uvIdx = (i * ringLen + j) * 2;
      uvs[uvIdx] = j / (ringLen - 1);
      uvs[uvIdx + 1] = s * 0.08;
    }
  }

  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ringLen - 1; j++) {
      const a = i * ringLen + j;
      const b = a + 1;
      const c = (i + 1) * ringLen + j;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addRailsAndDeck(group, getPose, minS, maxS, textures) {
  const snowTex = textures.snowMap.clone();
  snowTex.repeat.set(2, 160);
  snowTex.needsUpdate = true;

  // Sleek T-girder viaduct profile so low-angle shots keep bogies/hull visible
  const viaductProfile = [
    [-1.65, -2.35],
    [-2.1, -0.65],
    [-3.15, -0.45],
    [-3.15, 0.08],
    [-2.85, 0.08],
    [-2.75, -0.04],
    [-1.4, 0.04],
    [0.0, 0.07],
    [1.4, 0.04],
    [2.75, -0.04],
    [2.85, 0.08],
    [3.15, 0.08],
    [3.15, -0.45],
    [2.1, -0.65],
    [1.65, -2.35],
    [-1.65, -2.35],
  ];
  const deckGeo = buildTrackRibbonGeometry(getPose, minS, 962.0, 2.0, viaductProfile);
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x8ea2bc,
    map: snowTex,
    roughness: 0.78,
    metalness: 0.18,
  });
  group.add(new THREE.Mesh(deckGeo, deckMat));

  const railMat = new THREE.MeshStandardMaterial({
    color: 0xd8e6f8,
    roughness: 0.18,
    metalness: 0.92,
  });
  for (const side of [-1, 1]) {
    const cx = side * RAIL_HALF_GAUGE;
    const railProfile = [
      [cx - 0.09, 0.0],
      [cx - 0.07, 0.22],
      [cx + 0.07, 0.22],
      [cx + 0.09, 0.0],
    ];
    const railGeo = buildTrackRibbonGeometry(getPose, minS, maxS, 2.5, railProfile);
    group.add(new THREE.Mesh(railGeo, railMat));
  }
}

function addSleepersAndPiers(group, getPose, minS, maxS) {
  const sleeperStep = 0.95;
  const sleeperCount = Math.floor((maxS - minS) / sleeperStep);
  const sleeperGeo = new THREE.BoxGeometry(2.45, 0.14, 0.28);
  const sleeperMat = new THREE.MeshStandardMaterial({
    color: 0x2c384a,
    roughness: 0.74,
    metalness: 0.28,
  });
  const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleeperCount);

  const ribStep = 8.0;
  const ribCount = Math.floor((960.0 - minS) / ribStep);
  const ribGeo = new THREE.BoxGeometry(6.1, 0.65, 0.55);
  const pierMat = new THREE.MeshStandardMaterial({
    color: 0x2d3a4e,
    roughness: 0.78,
    metalness: 0.26,
  });
  const underRibs = new THREE.InstancedMesh(ribGeo, pierMat, ribCount);

  const dummy = new THREE.Object3D();
  const pose = {};

  for (let i = 0; i < sleeperCount; i++) {
    const s = minS + i * sleeperStep;
    getPose(s, pose);
    dummy.position.copy(pose.position).addScaledVector(pose.up, 0.04);
    dummy.quaternion.copy(pose.quaternion);
    dummy.updateMatrix();
    sleepers.setMatrixAt(i, dummy.matrix);
  }
  sleepers.instanceMatrix.needsUpdate = true;
  group.add(sleepers);

  for (let i = 0; i < ribCount; i++) {
    const s = minS + i * ribStep;
    getPose(s, pose);
    dummy.position.copy(pose.position).addScaledVector(pose.up, -0.78);
    dummy.quaternion.copy(pose.quaternion);
    dummy.updateMatrix();
    underRibs.setMatrixAt(i, dummy.matrix);
  }
  underRibs.instanceMatrix.needsUpdate = true;
  group.add(underRibs);

  const pierPositions = [];
  for (let s = -220; s <= 852; s += 28) {
    pierPositions.push(s);
  }
  const pierGeo = new THREE.BoxGeometry(3.8, 22.0, 2.8);
  const piers = new THREE.InstancedMesh(pierGeo, pierMat, pierPositions.length);
  for (let i = 0; i < pierPositions.length; i++) {
    getPose(pierPositions[i], pose);
    dummy.position.copy(pose.position).addScaledVector(pose.up, -12.8);
    dummy.quaternion.copy(pose.quaternion);
    dummy.updateMatrix();
    piers.setMatrixAt(i, dummy.matrix);
  }
  piers.instanceMatrix.needsUpdate = true;
  group.add(piers);
}

function addCatenaryGantries(group, getPose) {
  // Gantries frame the open canyon run (s <= 605) while leaving the station-to-tunnel
  // throat unobstructed for clean monumental sightlines.
  const gantryStops = [];
  for (let s = -190; s <= 605; s += 46) gantryStops.push(s);

  const mastGeo = new THREE.BoxGeometry(0.32, 7.6, 0.32);
  const beamGeo = new THREE.BoxGeometry(7.6, 0.3, 0.34);
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x3b4d66,
    roughness: 0.44,
    metalness: 0.72,
  });
  const sigGeo = new THREE.BoxGeometry(0.24, 0.5, 0.24);
  const sigAmberMat = new THREE.MeshBasicMaterial({ color: 0xffa64d });
  const sigCyanMat = new THREE.MeshBasicMaterial({ color: 0x6ce5ff });

  const leftMasts = new THREE.InstancedMesh(mastGeo, steelMat, gantryStops.length);
  const rightMasts = new THREE.InstancedMesh(mastGeo, steelMat, gantryStops.length);
  const beams = new THREE.InstancedMesh(beamGeo, steelMat, gantryStops.length);
  const sigs = new THREE.InstancedMesh(sigGeo, sigCyanMat, gantryStops.length);
  const amberSigs = new THREE.InstancedMesh(sigGeo, sigAmberMat, gantryStops.length);

  const dummy = new THREE.Object3D();
  const pose = {};

  gantryStops.forEach((s, i) => {
    getPose(s, pose);
    dummy.quaternion.copy(pose.quaternion);

    dummy.position
      .copy(pose.position)
      .addScaledVector(pose.left, 3.55)
      .addScaledVector(pose.up, 3.6);
    dummy.updateMatrix();
    leftMasts.setMatrixAt(i, dummy.matrix);

    dummy.position
      .copy(pose.position)
      .addScaledVector(pose.left, -3.55)
      .addScaledVector(pose.up, 3.6);
    dummy.updateMatrix();
    rightMasts.setMatrixAt(i, dummy.matrix);

    dummy.position.copy(pose.position).addScaledVector(pose.up, 7.25);
    dummy.updateMatrix();
    beams.setMatrixAt(i, dummy.matrix);

    dummy.position
      .copy(pose.position)
      .addScaledVector(pose.left, 2.35)
      .addScaledVector(pose.up, 6.8);
    dummy.updateMatrix();
    sigs.setMatrixAt(i, dummy.matrix);

    dummy.position
      .copy(pose.position)
      .addScaledVector(pose.left, -2.35)
      .addScaledVector(pose.up, 6.8);
    dummy.updateMatrix();
    amberSigs.setMatrixAt(i, dummy.matrix);
  });

  for (const m of [leftMasts, rightMasts, beams, sigs, amberSigs]) {
    m.instanceMatrix.needsUpdate = true;
    group.add(m);
  }
}

export function createTrackSystem(scene, textures) {
  const table = buildArcLengthTable();
  const getPoseAtDistance = createSampler(table);
  const minS = table.arcS[0];
  const maxS = table.arcS[table.arcS.length - 1];

  const group = new THREE.Group();
  group.name = "ElevatedTrackSystem";
  addRailsAndDeck(group, getPoseAtDistance, minS, maxS, textures);
  addSleepersAndPiers(group, getPoseAtDistance, minS, maxS);
  addCatenaryGantries(group, getPoseAtDistance);
  scene.add(group);

  return {
    trackY: TRACK_Y,
    minS,
    maxS,
    getPoseAtDistance,
  };
}
