import * as THREE from 'three';

export function createSpaceship() {
  const shipGroup = new THREE.Group();
  shipGroup.name = 'Spaceship';

  // --- Materials ---
  const hullWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf5f7fa,
    metalness: 0.25,
    roughness: 0.35,
    name: 'HullWhite'
  });

  const hullOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xff6600,
    metalness: 0.3,
    roughness: 0.3,
    name: 'HullOrange'
  });

  const hullSlateMat = new THREE.MeshStandardMaterial({
    color: 0x1f242d,
    metalness: 0.6,
    roughness: 0.45,
    name: 'HullSlate'
  });

  const metalTrimMat = new THREE.MeshStandardMaterial({
    color: 0x8892a0,
    metalness: 0.85,
    roughness: 0.2,
    name: 'MetalTrim'
  });

  const chromeNozzleMat = new THREE.MeshStandardMaterial({
    color: 0x333b45,
    metalness: 0.9,
    roughness: 0.2,
    name: 'NozzleMetal'
  });

  const glassCanopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x00d4ff,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.75,
    thickness: 0.4,
    ior: 1.52,
    transparent: true,
    opacity: 0.85,
    name: 'CanopyGlass'
  });

  // Emissive materials for thrusters & lights
  const mainEngineGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.0,
    name: 'MainEngineGlow'
  });

  const vtolGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.0,
    name: 'VtolEngineGlow'
  });

  const navRedMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const navGreenMat = new THREE.MeshBasicMaterial({ color: 0x22ff55 });
  const strobeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // --- Main Fuselage ---
  const fuselageGroup = new THREE.Group();
  shipGroup.add(fuselageGroup);

  // Central streamlined body (Forward is -Z, Up is +Y)
  // Nose cone & forward fuselage
  const noseGeo = new THREE.ConeGeometry(0.7, 1.8, 8);
  noseGeo.rotateX(-Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeo, hullWhiteMat);
  noseMesh.position.set(0, 0, -2.1);
  noseMesh.castShadow = true;
  noseMesh.receiveShadow = true;
  fuselageGroup.add(noseMesh);

  // Main cabin hull
  const cabinGeo = new THREE.CylinderGeometry(0.7, 0.95, 2.6, 8);
  cabinGeo.rotateX(Math.PI / 2);
  const cabinMesh = new THREE.Mesh(cabinGeo, hullWhiteMat);
  cabinMesh.position.set(0, 0, -0.1);
  cabinMesh.scale.set(1.2, 0.75, 1.0);
  cabinMesh.castShadow = true;
  cabinMesh.receiveShadow = true;
  fuselageGroup.add(cabinMesh);

  // Belly heat shield plate (dark slate)
  const bellyGeo = new THREE.BoxGeometry(1.6, 0.18, 3.2);
  const bellyMesh = new THREE.Mesh(bellyGeo, hullSlateMat);
  bellyMesh.position.set(0, -0.32, -0.2);
  bellyMesh.castShadow = true;
  bellyMesh.receiveShadow = true;
  fuselageGroup.add(bellyMesh);

  // Orange dorsal racing/warning stripe along the top
  const stripeGeo = new THREE.BoxGeometry(0.35, 0.1, 2.5);
  const stripeMesh = new THREE.Mesh(stripeGeo, hullOrangeMat);
  stripeMesh.position.set(0, 0.42, -0.2);
  stripeMesh.castShadow = true;
  fuselageGroup.add(stripeMesh);

  // Cockpit interior & Canopy
  const cockpitInteriorGeo = new THREE.BoxGeometry(0.5, 0.35, 0.8);
  const cockpitInteriorMat = new THREE.MeshStandardMaterial({ color: 0x111620, roughness: 0.8 });
  const cockpitInteriorMesh = new THREE.Mesh(cockpitInteriorGeo, cockpitInteriorMat);
  cockpitInteriorMesh.position.set(0, 0.15, -1.0);
  fuselageGroup.add(cockpitInteriorMesh);

  // Cockpit instrument glow
  const dashGlowGeo = new THREE.PlaneGeometry(0.35, 0.15);
  const dashGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
  const dashGlowMesh = new THREE.Mesh(dashGlowGeo, dashGlowMat);
  dashGlowMesh.position.set(0, 0.28, -1.35);
  dashGlowMesh.rotateX(-Math.PI / 4);
  fuselageGroup.add(dashGlowMesh);

  // Cockpit tinted glass canopy
  const canopyGeo = new THREE.CylinderGeometry(0.45, 0.6, 1.3, 8);
  canopyGeo.rotateX(Math.PI / 2);
  const canopyMesh = new THREE.Mesh(canopyGeo, glassCanopyMat);
  canopyMesh.position.set(0, 0.3, -1.0);
  canopyMesh.scale.set(0.9, 0.8, 1.0);
  canopyMesh.castShadow = true;
  fuselageGroup.add(canopyMesh);

  // Cockpit canopy frame ring
  const canopyFrameGeo = new THREE.TorusGeometry(0.55, 0.04, 6, 12);
  canopyFrameGeo.rotateY(Math.PI / 2);
  const canopyFrameMesh = new THREE.Mesh(canopyFrameGeo, metalTrimMat);
  canopyFrameMesh.position.set(0, 0.28, -0.5);
  fuselageGroup.add(canopyFrameMesh);

  // --- Swept Delta Wings ---
  const wingsGroup = new THREE.Group();
  shipGroup.add(wingsGroup);

  // Wing shape (procedural custom extruded shape for sleek aero lines)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(2.8, -0.6);   // wing tip forward
  wingShape.lineTo(2.7, -1.8);   // wing tip trailing edge
  wingShape.lineTo(0.3, -1.4);   // root trailing edge
  wingShape.closePath();

  const extrudeSettings = {
    depth: 0.12,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.03
  };

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
  wingGeo.rotateX(Math.PI / 2);

  // Right wing (Starboard: +X)
  const rightWingMesh = new THREE.Mesh(wingGeo, hullWhiteMat);
  rightWingMesh.position.set(0.65, 0, 0.5);
  rightWingMesh.castShadow = true;
  rightWingMesh.receiveShadow = true;
  wingsGroup.add(rightWingMesh);

  // Left wing (Port: -X)
  const leftWingGeo = wingGeo.clone();
  leftWingGeo.scale(-1, 1, 1);
  const leftWingMesh = new THREE.Mesh(leftWingGeo, hullWhiteMat);
  leftWingMesh.position.set(-0.65, 0, 0.5);
  leftWingMesh.castShadow = true;
  leftWingMesh.receiveShadow = true;
  wingsGroup.add(leftWingMesh);

  // Orange wing accent stripes
  const wingStripeGeo = new THREE.BoxGeometry(0.35, 0.16, 1.1);
  const rightWingStripe = new THREE.Mesh(wingStripeGeo, hullOrangeMat);
  rightWingStripe.position.set(1.9, 0.02, 0.0);
  rightWingStripe.rotateY(-0.15);
  rightWingStripe.castShadow = true;
  wingsGroup.add(rightWingStripe);

  const leftWingStripe = rightWingStripe.clone();
  leftWingStripe.position.set(-1.9, 0.02, 0.0);
  leftWingStripe.rotateY(0.15);
  leftWingStripe.castShadow = true;
  wingsGroup.add(leftWingStripe);

  // Canted Wingtip Winglets
  const wingletGeo = new THREE.BoxGeometry(0.08, 0.6, 0.9);
  
  const rightWinglet = new THREE.Mesh(wingletGeo, hullSlateMat);
  rightWinglet.position.set(3.4, 0.28, -0.1);
  rightWinglet.rotateZ(0.2); // Canted outward
  rightWinglet.castShadow = true;
  wingsGroup.add(rightWinglet);

  const leftWinglet = new THREE.Mesh(wingletGeo, hullSlateMat);
  leftWinglet.position.set(-3.4, 0.28, -0.1);
  leftWinglet.rotateZ(-0.2); // Canted outward
  leftWinglet.castShadow = true;
  wingsGroup.add(leftWinglet);

  // Twin Vertical Stabilizer Fins at the rear
  const finGeo = new THREE.BoxGeometry(0.1, 0.85, 0.9);
  const rightFin = new THREE.Mesh(finGeo, hullOrangeMat);
  rightFin.position.set(0.65, 0.5, 0.7);
  rightFin.rotateZ(-0.22); // Canted outwards
  rightFin.rotateX(-0.15); // Swept back
  rightFin.castShadow = true;
  fuselageGroup.add(rightFin);

  const leftFin = new THREE.Mesh(finGeo, hullOrangeMat);
  leftFin.position.set(-0.65, 0.5, 0.7);
  leftFin.rotateZ(0.22);
  leftFin.rotateX(-0.15);
  leftFin.castShadow = true;
  fuselageGroup.add(leftFin);

  // --- Navigation & Strobe Lights ---
  // Port = Red on Left (-X)
  const portNavGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const portNavMesh = new THREE.Mesh(portNavGeo, navRedMat);
  portNavMesh.position.set(-3.45, 0.55, -0.1);
  wingsGroup.add(portNavMesh);

  // Starboard = Green on Right (+X)
  const starboardNavGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const starboardNavMesh = new THREE.Mesh(starboardNavGeo, navGreenMat);
  starboardNavMesh.position.set(3.45, 0.55, -0.1);
  wingsGroup.add(starboardNavMesh);

  // White strobe lights on wingtips and tail
  const strobeGeo = new THREE.SphereGeometry(0.04, 6, 6);
  const rightStrobe = new THREE.Mesh(strobeGeo, strobeWhiteMat);
  rightStrobe.position.set(3.4, 0.55, 0.35);
  wingsGroup.add(rightStrobe);

  const leftStrobe = new THREE.Mesh(strobeGeo, strobeWhiteMat);
  leftStrobe.position.set(-3.4, 0.55, 0.35);
  wingsGroup.add(leftStrobe);

  const tailStrobe = new THREE.Mesh(strobeGeo, strobeWhiteMat);
  tailStrobe.position.set(0, 0.5, 1.3);
  fuselageGroup.add(tailStrobe);

  // --- Main Rear Propulsion Thrusters ---
  const thrustersGroup = new THREE.Group();
  shipGroup.add(thrustersGroup);

  const nozzleGeo = new THREE.CylinderGeometry(0.3, 0.38, 0.7, 16, 1, true);
  nozzleGeo.rotateX(Math.PI / 2);

  const leftNozzle = new THREE.Mesh(nozzleGeo, chromeNozzleMat);
  leftNozzle.position.set(-0.45, 0.05, 1.4);
  leftNozzle.castShadow = true;
  thrustersGroup.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(nozzleGeo, chromeNozzleMat);
  rightNozzle.position.set(0.45, 0.05, 1.4);
  rightNozzle.castShadow = true;
  thrustersGroup.add(rightNozzle);

  // Main engine glowing plasma flame cones
  const flameGeo = new THREE.ConeGeometry(0.28, 1.4, 16);
  flameGeo.rotateX(-Math.PI / 2);

  const leftFlame = new THREE.Mesh(flameGeo, mainEngineGlowMat);
  leftFlame.position.set(-0.45, 0.05, 2.1);
  thrustersGroup.add(leftFlame);

  const rightFlame = new THREE.Mesh(flameGeo, mainEngineGlowMat);
  rightFlame.position.set(0.45, 0.05, 2.1);
  thrustersGroup.add(rightFlame);

  // Thruster light point
  const engineLight = new THREE.PointLight(0x00e1ff, 0, 12, 1.5);
  engineLight.position.set(0, 0.05, 1.8);
  thrustersGroup.add(engineLight);

  // --- 4x Ventral VTOL Thrusters (Underbelly for liftoff/hover) ---
  const vtolGroup = new THREE.Group();
  shipGroup.add(vtolGroup);

  const vtolPorts = [
    new THREE.Vector3(-0.75, -0.32, -0.6), // Front left
    new THREE.Vector3(0.75, -0.32, -0.6),  // Front right
    new THREE.Vector3(-0.9, -0.32, 0.6),   // Rear left
    new THREE.Vector3(0.9, -0.32, 0.6)     // Rear right
  ];

  const vtolPortGeo = new THREE.TorusGeometry(0.18, 0.04, 6, 12);
  vtolPortGeo.rotateX(Math.PI / 2);

  const vtolFlameGeo = new THREE.ConeGeometry(0.16, 0.9, 12);
  // Cone points downwards: default cone apex is +Y, so rotate Math.PI around X
  vtolFlameGeo.rotateX(Math.PI);

  const vtolFlames = [];

  vtolPorts.forEach((pos) => {
    const rim = new THREE.Mesh(vtolPortGeo, metalTrimMat);
    rim.position.copy(pos);
    rim.castShadow = true;
    vtolGroup.add(rim);

    const flame = new THREE.Mesh(vtolFlameGeo, vtolGlowMat);
    flame.position.set(pos.x, pos.y - 0.45, pos.z);
    vtolGroup.add(flame);
    vtolFlames.push(flame);
  });

  const vtolLight = new THREE.PointLight(0xff9900, 0, 10, 1.5);
  vtolLight.position.set(0, -0.4, 0);
  vtolGroup.add(vtolLight);

  // --- Articulated Retractable Landing Gear ---
  // Nose gear + Left main gear + Right main gear
  const landingGearGroup = new THREE.Group();
  shipGroup.add(landingGearGroup);

  // Helper to create a gear assembly with strut, scissor link, and footpad
  function createGearAssembly(isNose = false) {
    const assembly = new THREE.Group();

    // Main strut piston
    const strutLength = isNose ? 0.7 : 0.65;
    const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, strutLength, 8);
    strutGeo.translate(0, -strutLength / 2, 0);
    const strutMesh = new THREE.Mesh(strutGeo, metalTrimMat);
    strutMesh.castShadow = true;
    assembly.add(strutMesh);

    // Shock collar
    const collarGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 8);
    collarGeo.translate(0, -strutLength * 0.4, 0);
    const collarMesh = new THREE.Mesh(collarGeo, hullSlateMat);
    assembly.add(collarMesh);

    // Articulated footpad
    const footpadGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.06, 8);
    const footpadMesh = new THREE.Mesh(footpadGeo, hullSlateMat);
    footpadMesh.position.set(0, -strutLength, 0);
    footpadMesh.castShadow = true;
    assembly.add(footpadMesh);

    return { assembly, strutLength };
  }

  // Front nose gear
  const noseGear = createGearAssembly(true);
  noseGear.assembly.position.set(0, -0.25, -1.4);
  landingGearGroup.add(noseGear.assembly);

  // Left main gear
  const leftGear = createGearAssembly(false);
  leftGear.assembly.position.set(-1.1, -0.25, 0.5);
  landingGearGroup.add(leftGear.assembly);

  // Right main gear
  const rightGear = createGearAssembly(false);
  rightGear.assembly.position.set(1.1, -0.25, 0.5);
  landingGearGroup.add(rightGear.assembly);

  // Forward dual headlights / searchlights
  const headlightL = new THREE.SpotLight(0xffffff, 1.2, 35, Math.PI / 6, 0.4, 1.0);
  headlightL.position.set(-0.35, -0.05, -1.8);
  headlightL.target.position.set(-0.35, -1.5, -18);
  shipGroup.add(headlightL);
  shipGroup.add(headlightL.target);

  const headlightR = new THREE.SpotLight(0xffffff, 1.2, 35, Math.PI / 6, 0.4, 1.0);
  headlightR.position.set(0.35, -0.05, -1.8);
  headlightR.target.position.set(0.35, -1.5, -18);
  shipGroup.add(headlightR);
  shipGroup.add(headlightR.target);

  // Navigation strobe timer
  let strobeTimer = 0;

  // --- Dynamic methods ---
  shipGroup.setGearExtension = function (extension) {
    // extension: 1 = fully deployed (down), 0 = fully retracted (tucked into bay)
    const ext = THREE.MathUtils.clamp(extension, 0, 1);

    // Retract by rotating backward into fuselage
    const retractAngle = (1 - ext) * (Math.PI * 0.45);
    noseGear.assembly.rotation.x = retractAngle;
    noseGear.assembly.scale.set(1, ext * 0.7 + 0.3, 1);

    leftGear.assembly.rotation.z = -(1 - ext) * (Math.PI * 0.45);
    leftGear.assembly.scale.set(1, ext * 0.7 + 0.3, 1);

    rightGear.assembly.rotation.z = (1 - ext) * (Math.PI * 0.45);
    rightGear.assembly.scale.set(1, ext * 0.7 + 0.3, 1);
  };

  shipGroup.setThrottle = function (mainThrottle, vtolThr) {
    const mainPwr = THREE.MathUtils.clamp(mainThrottle, 0, 1);
    const vtolPwr = THREE.MathUtils.clamp(vtolThr, 0, 1);

    // Main engines
    leftFlame.scale.set(1 + mainPwr * 0.5, 0.2 + mainPwr * 1.6, 1 + mainPwr * 0.5);
    rightFlame.scale.set(1 + mainPwr * 0.5, 0.2 + mainPwr * 1.6, 1 + mainPwr * 0.5);
    mainEngineGlowMat.opacity = mainPwr * 0.95;
    engineLight.intensity = mainPwr * 3.5;

    // VTOL engines
    vtolFlames.forEach((f) => {
      f.scale.set(0.5 + vtolPwr * 0.8, 0.1 + vtolPwr * 1.2, 0.5 + vtolPwr * 0.8);
    });
    vtolGlowMat.opacity = vtolPwr * 0.9;
    vtolLight.intensity = vtolPwr * 2.8;
  };

  shipGroup.updateBeacons = function (deltaSec) {
    strobeTimer += deltaSec;
    // Strobe flashes every 1.0s for 0.08s
    const isStrobeOn = (strobeTimer % 1.0) < 0.08;
    const strobeBrightness = isStrobeOn ? 1.0 : 0.15;
    strobeWhiteMat.color.setRGB(strobeBrightness, strobeBrightness, strobeBrightness);
  };

  // Initial gear fully extended on pad
  shipGroup.setGearExtension(1.0);
  shipGroup.setThrottle(0, 0);

  return shipGroup;
}
