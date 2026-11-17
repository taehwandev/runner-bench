import * as THREE from 'three';

export function createLandingPad() {
  const padGroup = new THREE.Group();
  padGroup.name = 'LandingPadAndBase';

  // --- Materials ---
  const padConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x2b323c,
    roughness: 0.85,
    metalness: 0.15,
    name: 'PadConcrete'
  });

  const padPlatesMat = new THREE.MeshStandardMaterial({
    color: 0x3d4653,
    roughness: 0.6,
    metalness: 0.4,
    name: 'PadPlates'
  });

  const yellowHazardMat = new THREE.MeshStandardMaterial({
    color: 0xf5b000,
    roughness: 0.5,
    metalness: 0.1,
    name: 'YellowHazard'
  });

  const darkHazardMat = new THREE.MeshStandardMaterial({
    color: 0x181a1e,
    roughness: 0.8,
    metalness: 0.2,
    name: 'DarkHazard'
  });

  const padGuidanceGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    name: 'GuidanceGlow'
  });

  const beaconAmberMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    name: 'BeaconAmber'
  });

  const beaconGreenMat = new THREE.MeshBasicMaterial({
    color: 0x00ff66,
    name: 'BeaconGreen'
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x5a6575,
    roughness: 0.4,
    metalness: 0.8,
    name: 'StructuralSteel'
  });

  const tankMat = new THREE.MeshStandardMaterial({
    color: 0xd8e0e8,
    roughness: 0.35,
    metalness: 0.4,
    name: 'StorageTank'
  });

  const towerGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a2030,
    roughness: 0.1,
    metalness: 0.2,
    transmission: 0.8,
    thickness: 0.5,
    transparent: true,
    opacity: 0.9,
    name: 'TowerGlass'
  });

  // --- Main Raised Landing Platform ---
  // Platform radius ~12 units, thickness 0.45 units (top at Y = 0.45)
  const padCylinderGeo = new THREE.CylinderGeometry(12, 13.5, 0.45, 32);
  const padMesh = new THREE.Mesh(padCylinderGeo, padConcreteMat);
  padMesh.position.set(0, 0.225, 0);
  padMesh.receiveShadow = true;
  padMesh.castShadow = true;
  padGroup.add(padMesh);

  // Inner blast tile platform
  const innerTileGeo = new THREE.CylinderGeometry(9.5, 9.5, 0.05, 32);
  const innerTileMesh = new THREE.Mesh(innerTileGeo, padPlatesMat);
  innerTileMesh.position.set(0, 0.455, 0);
  innerTileMesh.receiveShadow = true;
  padGroup.add(innerTileMesh);

  // Concentric glowing guidance target rings
  const outerRingGeo = new THREE.RingGeometry(7.0, 7.3, 48);
  outerRingGeo.rotateX(-Math.PI / 2);
  const outerRingMesh = new THREE.Mesh(outerRingGeo, yellowHazardMat);
  outerRingMesh.position.set(0, 0.485, 0);
  padGroup.add(outerRingMesh);

  const innerRingGeo = new THREE.RingGeometry(3.6, 3.85, 48);
  innerRingGeo.rotateX(-Math.PI / 2);
  const innerRingMesh = new THREE.Mesh(innerRingGeo, padGuidanceGlowMat);
  innerRingMesh.position.set(0, 0.49, 0);
  padGroup.add(innerRingMesh);

  // Center Touchdown Target: Stylized illuminated 'H' and crosshair
  const centerCrossGeoH = new THREE.PlaneGeometry(0.5, 4.5);
  centerCrossGeoH.rotateX(-Math.PI / 2);
  const centerCrossMeshH = new THREE.Mesh(centerCrossGeoH, yellowHazardMat);
  centerCrossMeshH.position.set(0, 0.492, 0);
  padGroup.add(centerCrossMeshH);

  const centerCrossGeoV = new THREE.PlaneGeometry(4.5, 0.5);
  centerCrossGeoV.rotateX(-Math.PI / 2);
  const centerCrossMeshV = new THREE.Mesh(centerCrossGeoV, yellowHazardMat);
  centerCrossMeshV.position.set(0, 0.492, 0);
  padGroup.add(centerCrossMeshV);

  // Center beacon light (upward pad spot)
  const padCenterLight = new THREE.PointLight(0x00f0ff, 1.5, 12, 1.2);
  padCenterLight.position.set(0, 0.7, 0);
  padGroup.add(padCenterLight);

  // Hazard border chevron segments around perimeter
  const numChevrons = 24;
  for (let i = 0; i < numChevrons; i++) {
    const angle = (i / numChevrons) * Math.PI * 2;
    const radius = 10.8;
    const isYellow = i % 2 === 0;
    const chevronGeo = new THREE.BoxGeometry(0.7, 0.08, 1.8);
    const chevronMesh = new THREE.Mesh(chevronGeo, isYellow ? yellowHazardMat : darkHazardMat);
    chevronMesh.position.set(Math.cos(angle) * radius, 0.46, Math.sin(angle) * radius);
    chevronMesh.rotation.y = -angle;
    padGroup.add(chevronMesh);
  }

  // --- Perimeter Approach Lights ---
  // 12 lights around pad edge that alternate green / amber
  const perimeterLights = [];
  const numLights = 12;
  for (let i = 0; i < numLights; i++) {
    const angle = (i / numLights) * Math.PI * 2;
    const radius = 12.2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Small stanchion
    const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8);
    const postMesh = new THREE.Mesh(postGeo, steelMat);
    postMesh.position.set(x, 0.3, z);
    postMesh.castShadow = true;
    padGroup.add(postMesh);

    // Glowing bulb
    const bulbGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const isGreen = i % 2 === 0;
    const bulbMesh = new THREE.Mesh(bulbGeo, isGreen ? beaconGreenMat : beaconAmberMat);
    bulbMesh.position.set(x, 0.65, z);
    padGroup.add(bulbMesh);

    perimeterLights.push({
      mesh: bulbMesh,
      mat: bulbMesh.material,
      isGreen,
      baseColor: isGreen ? 0x00ff66 : 0xffaa00
    });
  }

  // --- Perimeter Floodlights illuminating the pad ---
  const floodlightPositions = [
    { x: 13, z: 13 },
    { x: -13, z: 13 },
    { x: -13, z: -13 },
    { x: 13, z: -13 }
  ];

  floodlightPositions.forEach((pos) => {
    // Mast
    const mastGeo = new THREE.CylinderGeometry(0.12, 0.18, 4.5, 8);
    const mastMesh = new THREE.Mesh(mastGeo, steelMat);
    mastMesh.position.set(pos.x, 2.25, pos.z);
    mastMesh.castShadow = true;
    padGroup.add(mastMesh);

    // Light head fixture
    const headGeo = new THREE.BoxGeometry(0.6, 0.4, 0.4);
    const headMesh = new THREE.Mesh(headGeo, steelMat);
    headMesh.position.set(pos.x, 4.4, pos.z);
    headMesh.lookAt(0, 0.5, 0);
    padGroup.add(headMesh);

    // Spotlight aiming at pad
    const spot = new THREE.SpotLight(0xfff0d0, 1.8, 45, Math.PI / 4, 0.5, 1.2);
    spot.position.set(pos.x, 4.4, pos.z);
    spot.target.position.set(0, 0.45, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.width = 512;
    spot.shadow.mapSize.height = 512;
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = 40;
    padGroup.add(spot);
    padGroup.add(spot.target);
  });

  // --- Flight Control Tower ---
  // Positioned at X = -28, Z = -20
  const towerGroup = new THREE.Group();
  towerGroup.position.set(-28, 0, -20);
  padGroup.add(towerGroup);

  // Tower base foundation
  const towerBaseGeo = new THREE.BoxGeometry(9, 2.5, 9);
  const towerBaseMesh = new THREE.Mesh(towerBaseGeo, padConcreteMat);
  towerBaseMesh.position.set(0, 1.25, 0);
  towerBaseMesh.castShadow = true;
  towerBaseMesh.receiveShadow = true;
  towerGroup.add(towerBaseMesh);

  // Tower column shaft
  const towerShaftGeo = new THREE.CylinderGeometry(2.4, 3.2, 18, 8);
  const towerShaftMesh = new THREE.Mesh(towerShaftGeo, padPlatesMat);
  towerShaftMesh.position.set(0, 11.5, 0);
  towerShaftMesh.castShadow = true;
  towerShaftMesh.receiveShadow = true;
  towerGroup.add(towerShaftMesh);

  // Observation deck cab
  const cabGeo = new THREE.CylinderGeometry(5.2, 3.8, 4.2, 12);
  const cabMesh = new THREE.Mesh(cabGeo, towerGlassMat);
  cabMesh.position.set(0, 22.5, 0);
  cabMesh.castShadow = true;
  towerGroup.add(cabMesh);

  // Cab roof
  const cabRoofGeo = new THREE.ConeGeometry(5.8, 1.4, 12);
  const cabRoofMesh = new THREE.Mesh(cabRoofGeo, steelMat);
  cabRoofMesh.position.set(0, 25.2, 0);
  cabRoofMesh.castShadow = true;
  towerGroup.add(cabRoofMesh);

  // Rotating Radar Array on tower roof
  const radarGroup = new THREE.Group();
  radarGroup.position.set(0, 26.2, 0);
  towerGroup.add(radarGroup);

  const radarMastGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.8, 8);
  const radarMastMesh = new THREE.Mesh(radarMastGeo, steelMat);
  radarMastMesh.position.set(0, 0.9, 0);
  radarGroup.add(radarMastMesh);

  const radarDishGeo = new THREE.BoxGeometry(2.8, 0.8, 0.15);
  const radarDishMesh = new THREE.Mesh(radarDishGeo, yellowHazardMat);
  radarDishMesh.position.set(0, 1.8, 0);
  radarGroup.add(radarDishMesh);

  // Tower red beacon on apex
  const towerBeaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const towerBeaconMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });
  const towerBeaconMesh = new THREE.Mesh(towerBeaconGeo, towerBeaconMat);
  towerBeaconMesh.position.set(0, 2.3, 0);
  radarGroup.add(towerBeaconMesh);

  // --- Cryogenic Fuel Storage Facility ---
  // Positioned at X = 25, Z = -18
  const fuelFacilityGroup = new THREE.Group();
  fuelFacilityGroup.position.set(25, 0, -18);
  padGroup.add(fuelFacilityGroup);

  // Foundation slab
  const fuelSlabGeo = new THREE.BoxGeometry(16, 0.8, 10);
  const fuelSlabMesh = new THREE.Mesh(fuelSlabGeo, padConcreteMat);
  fuelSlabMesh.position.set(0, 0.4, 0);
  fuelSlabMesh.castShadow = true;
  fuelSlabMesh.receiveShadow = true;
  fuelFacilityGroup.add(fuelSlabMesh);

  // Twin Spherical / Cylindrical Tanks
  [-4.5, 4.5].forEach((offsetX) => {
    const tankGeo = new THREE.SphereGeometry(3.2, 18, 18);
    const tankMesh = new THREE.Mesh(tankGeo, tankMat);
    tankMesh.position.set(offsetX, 4.0, 0);
    tankMesh.scale.set(1, 1.25, 1);
    tankMesh.castShadow = true;
    tankMesh.receiveShadow = true;
    fuelFacilityGroup.add(tankMesh);

    // Hazard ring stripe
    const tankStripeGeo = new THREE.TorusGeometry(3.25, 0.08, 6, 24);
    tankStripeGeo.rotateX(Math.PI / 2);
    const tankStripeMesh = new THREE.Mesh(tankStripeGeo, yellowHazardMat);
    tankStripeMesh.position.set(offsetX, 4.0, 0);
    fuelFacilityGroup.add(tankStripeMesh);

    // Leg supports
    const legGeo = new THREE.CylinderGeometry(0.2, 0.25, 3.5, 8);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
      const legMesh = new THREE.Mesh(legGeo, steelMat);
      legMesh.position.set(
        offsetX + Math.cos(angle) * 2.2,
        1.75,
        Math.sin(angle) * 2.2
      );
      legMesh.castShadow = true;
      fuelFacilityGroup.add(legMesh);
    }
  });

  // Connecting pipe gantry toward the pad
  const pipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(20, 1.0, -18),
    new THREE.Vector3(16, 1.0, -12),
    new THREE.Vector3(12, 0.6, -6)
  ]);
  const pipeGeo = new THREE.TubeGeometry(pipeCurve, 16, 0.22, 8, false);
  const pipeMesh = new THREE.Mesh(pipeGeo, steelMat);
  pipeMesh.castShadow = true;
  padGroup.add(pipeMesh);

  // --- Satellite Uplink Dish ---
  // Positioned at X = 32, Z = 16
  const dishGroup = new THREE.Group();
  dishGroup.position.set(32, 0, 16);
  padGroup.add(dishGroup);

  const dishBaseGeo = new THREE.CylinderGeometry(1.6, 2.2, 2.5, 8);
  const dishBaseMesh = new THREE.Mesh(dishBaseGeo, padConcreteMat);
  dishBaseMesh.position.set(0, 1.25, 0);
  dishBaseMesh.castShadow = true;
  dishGroup.add(dishBaseMesh);

  // Dish dish shape
  const dishGeo = new THREE.SphereGeometry(3.0, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.4);
  const dishMesh = new THREE.Mesh(dishGeo, tankMat);
  dishMesh.position.set(0, 4.2, 0);
  dishMesh.rotation.x = -0.7; // Aimed up into sky
  dishMesh.rotation.y = 0.5;
  dishMesh.castShadow = true;
  dishGroup.add(dishMesh);

  // --- Atmospheric Windsock ---
  // Positioned near runway edge: X = -16, Z = 16
  const windsockGroup = new THREE.Group();
  windsockGroup.position.set(-16, 0, 16);
  padGroup.add(windsockGroup);

  const windsockPoleGeo = new THREE.CylinderGeometry(0.08, 0.12, 5.0, 8);
  const windsockPoleMesh = new THREE.Mesh(windsockPoleGeo, steelMat);
  windsockPoleMesh.position.set(0, 2.5, 0);
  windsockPoleMesh.castShadow = true;
  windsockGroup.add(windsockPoleMesh);

  // Orange & white striped windsock cone
  const sockConeGeo = new THREE.ConeGeometry(0.35, 1.8, 12, 1, true);
  sockConeGeo.rotateZ(Math.PI / 2);
  const sockMesh = new THREE.Mesh(sockConeGeo, yellowHazardMat);
  sockMesh.position.set(0.9, 4.8, 0);
  windsockGroup.add(sockMesh);

  // Animation update method
  let animTime = 0;
  padGroup.update = function (deltaSec) {
    animTime += deltaSec;

    // Rotate tower radar
    radarGroup.rotation.y += deltaSec * 1.8;

    // Pulsate perimeter guidance lights
    perimeterLights.forEach((light, idx) => {
      const offset = idx * 0.4;
      const intensity = 0.4 + 0.6 * Math.sin(animTime * 3.5 + offset);
      light.mat.color.setHex(light.baseColor).multiplyScalar(intensity);
    });

    // Gentle windsock flutter
    sockMesh.rotation.z = Math.PI / 2 + Math.sin(animTime * 4.0) * 0.12;
    sockMesh.rotation.y = Math.sin(animTime * 1.5) * 0.25;

    // Center pad light subtle pulse
    padCenterLight.intensity = 1.2 + 0.4 * Math.sin(animTime * 2.0);
  };

  return padGroup;
}
