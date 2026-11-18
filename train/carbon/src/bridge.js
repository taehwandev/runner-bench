import * as THREE from "three";
import { createRng } from "./rng.js";

function buildFrozenChasmAndShore(group, startPose, rng, textures) {
  const chasmLength = 1500;
  const chasmCenterZ = startPose.position.z + chasmLength * 0.5;

  // Cliff retaining wall where city drops into the frozen bay at s = 960m
  const cliffWall = new THREE.Mesh(
    new THREE.BoxGeometry(1200, 56, 12),
    new THREE.MeshStandardMaterial({
      color: 0x1e2838,
      roughness: 0.88,
      metalness: 0.18,
    })
  );
  cliffWall.position.set(0, -10, startPose.position.z - 5);
  group.add(cliffWall);

  // Specular dark-indigo frozen bay ice sheet at Y = -34m
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x1b2c44,
    roughness: 0.24,
    metalness: 0.58,
  });
  const iceSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, chasmLength),
    iceMat
  );
  iceSheet.rotation.x = -Math.PI / 2;
  iceSheet.position.set(0, -34.0, chasmCenterZ);
  group.add(iceSheet);

  // Snow-dusted fractured ice floes across the frozen river gorge
  const floeCount = 180;
  const floeGeo = new THREE.CylinderGeometry(1, 1.15, 0.7, 6);
  const floeMat = new THREE.MeshStandardMaterial({
    color: 0x9cb4d0,
    map: textures.snowMap,
    roughness: 0.78,
    metalness: 0.1,
  });
  const floes = new THREE.InstancedMesh(floeGeo, floeMat, floeCount);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < floeCount; i++) {
    const x = rng.signed() * 420;
    const z = startPose.position.z + 25 + rng.next() * (chasmLength - 120);
    const sx = rng.range(7, 28);
    const sz = rng.range(7, 26);
    dummy.position.set(x, -33.65, z);
    dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
    dummy.scale.set(sx, 1, sz);
    dummy.updateMatrix();
    floes.setMatrixAt(i, dummy.matrix);
  }
  floes.instanceMatrix.needsUpdate = true;
  group.add(floes);
}

function buildBridgeDeckAndTrusses(group, track, sStart, sEnd) {
  const length = sEnd - sStart;
  const sMid = (sStart + sEnd) * 0.5;
  const midPose = track.getPoseAtDistance(sMid);

  const deckGroup = new THREE.Group();
  deckGroup.position.copy(midPose.position);
  deckGroup.quaternion.copy(midPose.quaternion);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x2a384c,
    roughness: 0.46,
    metalness: 0.74,
  });
  const snowBallastMat = new THREE.MeshStandardMaterial({
    color: 0x7b90ab,
    roughness: 0.8,
    metalness: 0.18,
  });
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffad4d });

  // Main deck plate + under-deck steel box truss spine
  const topSlab = new THREE.Mesh(
    new THREE.BoxGeometry(9.4, 0.55, length),
    snowBallastMat
  );
  topSlab.position.set(0, -0.26, 0);
  deckGroup.add(topSlab);

  const lowerSpine = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 3.4, length),
    steelMat
  );
  lowerSpine.position.set(0, -2.25, 0);
  deckGroup.add(lowerSpine);

  // Low open-rail side parapets (0.58m tall so train hull & wheels read cleanly!)
  for (const side of [-1, 1]) {
    const railTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.2, length),
      steelMat
    );
    railTop.position.set(side * 4.55, 0.55, 0);
    deckGroup.add(railTop);
  }

  // Instanced cross-girders & amber deck edge marker lamps every 16m
  const bayStep = 16.0;
  const bayCount = Math.floor(length / bayStep);
  const crossGeo = new THREE.BoxGeometry(10.4, 1.1, 0.48);
  const postGeo = new THREE.BoxGeometry(0.28, 1.05, 0.28);
  const lampGeo = new THREE.SphereGeometry(0.2, 8, 8);

  const crossMesh = new THREE.InstancedMesh(crossGeo, steelMat, bayCount);
  const postMesh = new THREE.InstancedMesh(postGeo, steelMat, bayCount * 2);
  const lampMesh = new THREE.InstancedMesh(lampGeo, markerMat, bayCount * 2);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < bayCount; i++) {
    const z = -length * 0.5 + (i + 0.5) * bayStep;
    dummy.position.set(0, -0.75, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    crossMesh.setMatrixAt(i, dummy.matrix);

    for (let sIdx = 0; sIdx < 2; sIdx++) {
      const side = sIdx === 0 ? -1 : 1;
      const idx = i * 2 + sIdx;
      dummy.position.set(side * 4.55, 0.45, z);
      dummy.updateMatrix();
      postMesh.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(side * 4.55, 1.08, z);
      dummy.updateMatrix();
      lampMesh.setMatrixAt(idx, dummy.matrix);
    }
  }
  for (const m of [crossMesh, postMesh, lampMesh]) {
    m.instanceMatrix.needsUpdate = true;
    deckGroup.add(m);
  }

  group.add(deckGroup);
}

function addCableSegment(parent, pA, pB, radius, mat) {
  const delta = new THREE.Vector3().subVectors(pB, pA);
  const len = delta.length();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, len, 6),
    mat
  );
  cyl.position.addVectors(pA, pB).multiplyScalar(0.5);
  cyl.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize()
  );
  parent.add(cyl);
}

function buildCableStayedPylons(group, track, pylonDistances) {
  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0x32435a,
    roughness: 0.44,
    metalness: 0.72,
  });
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x89a2c2,
    roughness: 0.32,
    metalness: 0.85,
  });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const beaconMeshes = [];

  for (const sPylon of pylonDistances) {
    const pose = track.getPoseAtDistance(sPylon);
    const pylon = new THREE.Group();
    pylon.position.copy(pose.position);
    pylon.quaternion.copy(pose.quaternion);

    // Concrete foundation caisson in the frozen river (-52m relative to Y=18m)
    const caisson = new THREE.Mesh(
      new THREE.BoxGeometry(22.0, 6.0, 11.0),
      pylonMat
    );
    caisson.position.set(0, -50.0, 0);
    pylon.add(caisson);

    // Twin monumental A-frame legs rising from Y=-48m to +58m above deck
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 108.0, 3.4),
        pylonMat
      );
      leg.position.set(side * 6.4, 4.0, 0);
      leg.rotation.z = side * 0.045;
      pylon.add(leg);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 8, 8),
        beaconMat
      );
      beacon.position.set(side * 3.9, 58.8, 0);
      pylon.add(beacon);
      beaconMeshes.push(beacon);
    }

    // Horizontal portal cross-struts above and below the train clearance envelope
    for (const yBeam of [-6.0, 22.0, 44.0, 56.5]) {
      const spanW = yBeam < 0 ? 16.5 : 14.5 - yBeam * 0.09;
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(spanW, 2.2, 3.0),
        pylonMat
      );
      beam.position.set(0, yBeam, 0);
      pylon.add(beam);
    }

    // Subtle warm pylon architectural uplight
    const uplight = new THREE.PointLight(0x8ab8ff, 28, 55, 1.5);
    uplight.position.set(0, 18.0, 0);
    pylon.add(uplight);

    // Symmetric fan of taut stay cables radiating forward & aft to deck edges
    const anchorOffsets = [22, 42, 62, 82, 102];
    for (const side of [-1, 1]) {
      anchorOffsets.forEach((zDist, k) => {
        const topAnchor = new THREE.Vector3(side * 4.5, 42.0 + k * 3.1, 0);
        for (const dir of [-1, 1]) {
          const deckAnchor = new THREE.Vector3(side * 4.7, 0.35, dir * zDist);
          addCableSegment(pylon, topAnchor, deckAnchor, 0.075, cableMat);
        }
      });
    }

    group.add(pylon);
  }

  return beaconMeshes;
}

export function createBridgeEnvironment(scene, track, timeline, textures) {
  const rng = createRng(518204);
  const group = new THREE.Group();
  group.name = "GrandNightBridge";

  const sStart = timeline.landmarks.bridgeStart;
  const sEnd = 1840.0;
  const startPose = track.getPoseAtDistance(sStart);

  buildFrozenChasmAndShore(group, startPose, rng, textures);
  buildBridgeDeckAndTrusses(group, track, sStart, sEnd);
  const beacons = buildCableStayedPylons(group, track, [1100, 1350, 1600]);

  scene.add(group);

  return {
    update(time) {
      const s = 0.75 + 0.45 * Math.sin(time * 3.2);
      for (const b of beacons) {
        b.scale.setScalar(s);
      }
    },
  };
}
