import * as THREE from "three";

function buildElevatedStation(group, track, landmarks, textures) {
  const sStart = landmarks.stationStart;
  const sEnd = landmarks.stationEnd;
  const length = sEnd - sStart;
  const sMid = (sStart + sEnd) * 0.5;
  const midPose = track.getPoseAtDistance(sMid);

  const station = new THREE.Group();
  station.position.copy(midPose.position);
  station.quaternion.copy(midPose.quaternion);

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x43536a,
    roughness: 0.74,
    metalness: 0.24,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xdce8f8,
    map: textures.snowMap,
    roughness: 0.8,
    metalness: 0.08,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x2f3e54,
    roughness: 0.42,
    metalness: 0.74,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8bb8de,
    emissive: 0x294b6e,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
  });
  const amberStripMat = new THREE.MeshBasicMaterial({ color: 0xffad42 });
  const warmLampMat = new THREE.MeshBasicMaterial({ color: 0xffe0a8 });
  const cyanTotemMat = new THREE.MeshBasicMaterial({ color: 0x67e4ff });

  const mainDeck = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 1.35, length),
    concreteMat
  );
  mainDeck.position.set(6.35, 0.55, 0);
  station.add(mainDeck);

  const mainSnowEdge = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.14, length),
    snowMat
  );
  mainSnowEdge.position.set(9.2, 1.28, 0);
  station.add(mainSnowEdge);

  const sideDeck = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 1.35, length),
    concreteMat
  );
  sideDeck.position.set(-4.35, 0.55, 0);
  station.add(sideDeck);

  for (const xEdge of [2.42, -2.42]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.06, length - 2.0),
      amberStripMat
    );
    strip.position.set(xEdge, 1.25, 0);
    station.add(strip);
  }

  for (let z = -length * 0.44; z <= length * 0.44; z += 22) {
    for (const xCol of [8.2, -5.2]) {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 20.0, 2.2),
        concreteMat
      );
      pier.position.set(xCol, -9.8, z);
      station.add(pier);
    }
  }

  const ribCount = 11;
  for (let i = 0; i < ribCount; i++) {
    const z = -length * 0.47 + (length * 0.94 * i) / (ribCount - 1);

    const leftPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 8.6, 0.55),
      steelMat
    );
    leftPost.position.set(9.8, 5.4, z);

    const rightPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 8.6, 0.55),
      steelMat
    );
    rightPost.position.set(-6.0, 5.4, z);

    const roofBeam = new THREE.Mesh(
      new THREE.BoxGeometry(16.8, 0.52, 0.62),
      steelMat
    );
    roofBeam.position.set(1.9, 9.65, z);

    const lampBar = new THREE.Mesh(
      new THREE.BoxGeometry(12.2, 0.16, 0.28),
      warmLampMat
    );
    lampBar.position.set(2.0, 9.28, z);

    station.add(leftPost, rightPost, roofBeam, lampBar);

    if (i % 2 === 1) {
      const totem = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 2.5, 0.75),
        steelMat
      );
      totem.position.set(6.8, 2.45, z);
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 1.15, 0.58),
        cyanTotemMat
      );
      screen.position.set(6.8, 2.75, z);
      station.add(totem, screen);
    }
  }

  const canopyGlass = new THREE.Mesh(
    new THREE.BoxGeometry(16.2, 0.14, length * 0.95),
    glassMat
  );
  canopyGlass.position.set(1.9, 9.95, 0);
  station.add(canopyGlass);

  for (const xSnow of [9.3, -5.5]) {
    const eaveSnow = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.35, length * 0.95),
      snowMat
    );
    eaveSnow.position.set(xSnow, 10.12, 0);
    station.add(eaveSnow);
  }

  for (const zLight of [-48, -16, 16, 48]) {
    const light = new THREE.PointLight(0xffbe73, 42, 38, 1.45);
    light.position.set(2.6, 8.6, zLight);
    station.add(light);
  }

  group.add(station);
}

function buildTowerTunnelMonolith(group, track, landmarks, textures) {
  const sStart = landmarks.tunnelStart;
  const sEnd = landmarks.tunnelEnd;
  const length = sEnd - sStart;
  const sMid = (sStart + sEnd) * 0.5;
  const midPose = track.getPoseAtDistance(sMid);

  const monolith = new THREE.Group();
  monolith.position.copy(midPose.position);
  monolith.quaternion.copy(midPose.quaternion);

  const flutedTex = textures.monolithMap.clone();
  flutedTex.repeat.set(6, 14);
  flutedTex.needsUpdate = true;

  const towerAlbedo = textures.towerAlbedo.clone();
  towerAlbedo.repeat.set(2, 5);
  towerAlbedo.needsUpdate = true;

  const towerEmissive = textures.towerEmissive.clone();
  towerEmissive.repeat.set(2, 5);
  towerEmissive.needsUpdate = true;

  const brutalistMat = new THREE.MeshStandardMaterial({
    color: 0x4b5d75,
    map: flutedTex,
    roughness: 0.72,
    metalness: 0.32,
  });

  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x566a84,
    map: towerAlbedo,
    emissive: 0xffcb96,
    emissiveMap: towerEmissive,
    emissiveIntensity: 0.72,
    roughness: 0.7,
    metalness: 0.28,
  });

  const concreteWallMat = new THREE.MeshStandardMaterial({
    color: 0x354357,
    roughness: 0.78,
    metalness: 0.26,
  });

  const ribSteelMat = new THREE.MeshStandardMaterial({
    color: 0x263346,
    roughness: 0.42,
    metalness: 0.74,
  });

  const snowLedgeMat = new THREE.MeshStandardMaterial({
    color: 0xdbe8f8,
    map: textures.snowMap,
    roughness: 0.82,
    metalness: 0.06,
  });

  const amberFixtureMat = new THREE.MeshBasicMaterial({ color: 0xffa44f });
  const cyanFixtureMat = new THREE.MeshBasicMaterial({ color: 0x68deff });
  const portalBeaconMat = new THREE.MeshBasicMaterial({ color: 0xff453a });

  // Left & right colossal tower wings + fluted portal buttresses
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(54.0, 248.0, length),
      wingMat
    );
    wing.position.set(side * 35.5, 102.0, 0);
    monolith.add(wing);

    const buttress = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 48.0, length + 5.5),
      brutalistMat
    );
    buttress.position.set(side * 8.4, 16.0, 0);
    monolith.add(buttress);

    const buttressStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 26.0, 0.35),
      cyanFixtureMat
    );
    buttressStrip.position.set(side * 8.4, 24.0, -(length * 0.5 + 2.9));
    monolith.add(buttressStrip);
  }

  // Central fluted concrete bridge mass rising above the railway tunnel ceiling
  const lintelMass = new THREE.Mesh(
    new THREE.BoxGeometry(18.0, 28.0, length + 4.0),
    brutalistMat
  );
  lintelMass.position.set(0, 24.0, 0);
  monolith.add(lintelMass);

  const lintelSnow = new THREE.Mesh(
    new THREE.BoxGeometry(20.5, 0.75, length + 4.8),
    snowLedgeMat
  );
  lintelSnow.position.set(0, 38.3, 0);
  monolith.add(lintelSnow);

  const upperSpan = new THREE.Mesh(
    new THREE.BoxGeometry(26.0, 188.0, length * 0.92),
    wingMat
  );
  upperSpan.position.set(0, 132.0, 0);
  monolith.add(upperSpan);

  // Tunnel interior lining floor, ceiling & side maintenance walkways
  const tunnelFloor = new THREE.Mesh(
    new THREE.BoxGeometry(13.2, 0.7, length + 2.0),
    concreteWallMat
  );
  tunnelFloor.position.set(0, -0.38, 0);
  monolith.add(tunnelFloor);

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(13.2, 0.8, length),
    concreteWallMat
  );
  ceiling.position.set(0, 9.7, 0);
  monolith.add(ceiling);

  for (const side of [-1, 1]) {
    const walkway = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.85, length),
      concreteWallMat
    );
    walkway.position.set(side * 5.45, 0.35, 0);
    monolith.add(walkway);
  }

  // Armored snow-shed entrance & exit portals with glowing arch bar + floodlights
  for (const endSign of [-1, 1]) {
    const zPortal = endSign * (length * 0.5 + 2.2);
    const hoodTop = new THREE.Mesh(
      new THREE.BoxGeometry(16.8, 2.4, 4.8),
      ribSteelMat
    );
    hoodTop.position.set(0, 10.4, zPortal);

    const archGlow = new THREE.Mesh(
      new THREE.BoxGeometry(12.2, 0.28, 0.32),
      amberFixtureMat
    );
    archGlow.position.set(0, 9.15, zPortal + endSign * 2.35);

    const portalLight = new THREE.PointLight(0xffaa5c, 45, 36, 1.4);
    portalLight.position.set(0, 9.0, zPortal + endSign * 4.0);
    monolith.add(hoodTop, archGlow, portalLight);

    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 11.8, 4.8),
        ribSteelMat
      );
      cheek.position.set(side * 7.25, 4.8, zPortal);

      const beacon = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.95, 0.44),
        portalBeaconMat
      );
      beacon.position.set(side * 6.05, 8.3, zPortal + endSign * 2.45);
      monolith.add(cheek, beacon);
    }
  }

  // 15 rhythmic interior structural ribs + alternating warm/cyan light strips
  const ribCount = 15;
  for (let i = 0; i < ribCount; i++) {
    const z = -length * 0.47 + (length * 0.94 * i) / (ribCount - 1);
    const topRib = new THREE.Mesh(
      new THREE.BoxGeometry(12.8, 0.55, 0.65),
      ribSteelMat
    );
    topRib.position.set(0, 9.15, z);
    monolith.add(topRib);

    const fixtureMat = i % 2 === 0 ? amberFixtureMat : cyanFixtureMat;
    for (const side of [-1, 1]) {
      const wallRib = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 9.4, 0.65),
        ribSteelMat
      );
      wallRib.position.set(side * 6.1, 4.5, z);

      const lightStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 3.8, 0.26),
        fixtureMat
      );
      lightStrip.position.set(side * 5.75, 5.3, z);
      monolith.add(wallRib, lightStrip);
    }
  }

  for (const zLight of [-34, -12, 12, 34]) {
    const pt = new THREE.PointLight(0xffb870, 38, 30, 1.45);
    pt.position.set(0, 8.2, zLight);
    monolith.add(pt);
  }

  group.add(monolith);
}

export function createStructures(scene, track, timeline, textures) {
  const group = new THREE.Group();
  group.name = "StationAndMonolithStructures";

  buildElevatedStation(group, track, timeline.landmarks, textures);
  buildTowerTunnelMonolith(group, track, timeline.landmarks, textures);

  scene.add(group);
  return { group };
}
