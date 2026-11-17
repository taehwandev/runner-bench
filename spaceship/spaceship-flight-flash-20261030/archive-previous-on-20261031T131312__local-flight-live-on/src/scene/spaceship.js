import * as THREE from 'three';

/**
 * Procedural detailed sci-fi spaceship model with animated landing gear and engine exhaust.
 */
export function createSpaceship() {
  const root = new THREE.Group();
  root.name = 'SpaceshipRoot';

  // Materials
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xf0f3f6,
    roughness: 0.28,
    metalness: 0.45
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.35,
    metalness: 0.6
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xff6b35, // Safety aerospace orange
    roughness: 0.4,
    metalness: 0.2
  });

  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    metalness: 0.1,
    roughness: 0.15,
    transmission: 0.65,
    thickness: 0.4,
    transparent: true,
    opacity: 0.88,
    reflectivity: 0.9
  });

  const metalGearMat = new THREE.MeshStandardMaterial({
    color: 0x8b949e,
    roughness: 0.3,
    metalness: 0.85
  });

  const engineGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff
  });

  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending
  });

  // 1. Fuselage
  const fuselageGeo = new THREE.ConeGeometry(1.2, 4.2, 6);
  fuselageGeo.rotateX(Math.PI / 2);
  fuselageGeo.scale(1.0, 0.55, 1.0);
  const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
  fuselage.position.set(0, 0.45, 0.3);
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  root.add(fuselage);

  // 1b. Cockpit canopy
  const canopyGeo = new THREE.SphereGeometry(0.55, 16, 12);
  canopyGeo.scale(0.85, 0.6, 1.8);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.72, 0.55);
  canopy.rotation.x = -0.15;
  canopy.castShadow = true;
  root.add(canopy);

  // 2. Delta Wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(2.8, -1.2);
  wingShape.lineTo(2.6, -1.8);
  wingShape.lineTo(0.5, -1.6);
  wingShape.lineTo(0, -1.4);
  wingShape.closePath();

  const wingExtrudeSettings = { depth: 0.08, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.04, bevelThickness: 0.03 };
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
  wingGeo.rotateX(Math.PI / 2);

  // Right wing
  const rightWing = new THREE.Mesh(wingGeo, hullMat);
  rightWing.position.set(0.3, 0.4, 0.4);
  rightWing.castShadow = true;
  rightWing.receiveShadow = true;
  root.add(rightWing);

  // Left wing (mirrored)
  const leftWing = new THREE.Mesh(wingGeo, hullMat);
  leftWing.scale.set(-1, 1, 1);
  leftWing.position.set(-0.3, 0.4, 0.4);
  leftWing.castShadow = true;
  leftWing.receiveShadow = true;
  root.add(leftWing);

  // Wingtip winglets
  const wingletGeo = new THREE.BoxGeometry(0.08, 0.45, 0.7);
  const rightWinglet = new THREE.Mesh(wingletGeo, accentMat);
  rightWinglet.position.set(3.0, 0.6, -1.0);
  rightWinglet.rotation.z = -0.25;
  rightWinglet.castShadow = true;
  root.add(rightWinglet);

  const leftWinglet = new THREE.Mesh(wingletGeo, accentMat);
  leftWinglet.position.set(-3.0, 0.6, -1.0);
  leftWinglet.rotation.z = 0.25;
  leftWinglet.castShadow = true;
  root.add(leftWinglet);

  // 3. Dorsal Stabilizer Tail Fin
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0, 1.1);
  finShape.lineTo(-0.7, 0.9);
  finShape.lineTo(-1.2, 0);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 });
  finGeo.rotateY(Math.PI / 2);
  const tailFin = new THREE.Mesh(finGeo, accentMat);
  tailFin.position.set(0.03, 0.65, -0.6);
  tailFin.castShadow = true;
  root.add(tailFin);

  // 4. Engines & Thrusters
  const engineBellGeo = new THREE.CylinderGeometry(0.32, 0.42, 0.9, 16);
  engineBellGeo.rotateX(Math.PI / 2);

  const rightEngine = new THREE.Mesh(engineBellGeo, trimMat);
  rightEngine.position.set(0.65, 0.42, -1.8);
  rightEngine.castShadow = true;
  root.add(rightEngine);

  const leftEngine = new THREE.Mesh(engineBellGeo, trimMat);
  leftEngine.position.set(-0.65, 0.42, -1.8);
  leftEngine.castShadow = true;
  root.add(leftEngine);

  // Engine inner glow disks
  const coreGeo = new THREE.CircleGeometry(0.3, 16);
  const rightCore = new THREE.Mesh(coreGeo, engineGlowMat);
  rightCore.position.set(0.65, 0.42, -2.26);
  rightCore.rotation.y = Math.PI;
  root.add(rightCore);

  const leftCore = new THREE.Mesh(coreGeo, engineGlowMat);
  leftCore.position.set(-0.65, 0.42, -2.26);
  leftCore.rotation.y = Math.PI;
  root.add(leftCore);

  // Exhaust Plumes (animated scaling)
  const plumeGeo = new THREE.ConeGeometry(0.35, 2.4, 16, 1, true);
  plumeGeo.rotateX(-Math.PI / 2);
  plumeGeo.translate(0, 0, -1.2);

  const rightPlume = new THREE.Mesh(plumeGeo, plumeMat);
  rightPlume.position.set(0.65, 0.42, -2.26);
  root.add(rightPlume);

  const leftPlume = new THREE.Mesh(plumeGeo, plumeMat);
  leftPlume.position.set(-0.65, 0.42, -2.26);
  root.add(leftPlume);

  // 5. Landing Gear Assembly (Front + Rear Left + Rear Right)
  const noseGearGroup = createGearLeg(metalGearMat, 0.55);
  noseGearGroup.position.set(0, 0.2, 1.4);
  root.add(noseGearGroup);

  const leftGearGroup = createGearLeg(metalGearMat, 0.6);
  leftGearGroup.position.set(-1.1, 0.25, -0.6);
  root.add(leftGearGroup);

  const rightGearGroup = createGearLeg(metalGearMat, 0.6);
  rightGearGroup.position.set(1.1, 0.25, -0.6);
  root.add(rightGearGroup);

  // 6. Navigation Beacon Lights
  const navLightRed = new THREE.PointLight(0xff2222, 1.5, 4);
  navLightRed.position.set(-3.0, 0.7, -1.0);
  root.add(navLightRed);

  const navLightGreen = new THREE.PointLight(0x22ff55, 1.5, 4);
  navLightGreen.position.set(3.0, 0.7, -1.0);
  root.add(navLightGreen);

  const navLightWhite = new THREE.PointLight(0xffffff, 2.0, 6);
  navLightWhite.position.set(0, 1.8, -1.4);
  root.add(navLightWhite);

  // Thruster light illuminating the ground beneath
  const thrusterLight = new THREE.PointLight(0x38bdf8, 2.5, 12);
  thrusterLight.position.set(0, 0.2, -2.0);
  root.add(thrusterLight);

  return {
    mesh: root,
    updateState: (telemetry, elapsedSec) => {
      // Position and Rotation
      root.position.set(telemetry.position.x, telemetry.position.y, telemetry.position.z);
      root.rotation.set(telemetry.rotation.x, telemetry.rotation.y, telemetry.rotation.z);

      // Landing Gear retraction animation
      const gear = telemetry.gearExtension; // 1 = down, 0 = up
      noseGearGroup.position.y = 0.2 * gear;
      noseGearGroup.rotation.x = (1.0 - gear) * (Math.PI / 2.2);
      noseGearGroup.scale.set(1, gear, 1);

      leftGearGroup.position.y = 0.25 * gear;
      leftGearGroup.rotation.z = -(1.0 - gear) * (Math.PI / 2.2);
      leftGearGroup.scale.set(1, gear, 1);

      rightGearGroup.position.y = 0.25 * gear;
      rightGearGroup.rotation.z = (1.0 - gear) * (Math.PI / 2.2);
      rightGearGroup.scale.set(1, gear, 1);

      // Thruster Plume & Light dynamics
      const flare = telemetry.thrusterFlare;
      const flicker = 1.0 + Math.sin(elapsedSec * 45) * 0.12;
      const plumeScaleZ = Math.max(0.01, flare * 1.6 * flicker);
      const plumeScaleXY = Math.max(0.1, flare * 1.1 * flicker);

      rightPlume.scale.set(plumeScaleXY, plumeScaleXY, plumeScaleZ);
      leftPlume.scale.set(plumeScaleXY, plumeScaleXY, plumeScaleZ);
      rightPlume.visible = flare > 0.05;
      leftPlume.visible = flare > 0.05;

      thrusterLight.intensity = flare * 3.5 * flicker;

      // Beacon blinking
      const blink = Math.floor(elapsedSec * 2) % 2 === 0;
      navLightRed.intensity = blink ? 1.8 : 0.2;
      navLightGreen.intensity = blink ? 1.8 : 0.2;
      navLightWhite.intensity = Math.floor(elapsedSec * 4) % 2 === 0 ? 3.0 : 0.3;
    }
  };
}

function createGearLeg(material, height) {
  const group = new THREE.Group();

  // Vertical strut
  const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, height, 8);
  strutGeo.translate(0, -height / 2, 0);
  const strut = new THREE.Mesh(strutGeo, material);
  strut.castShadow = true;
  group.add(strut);

  // Foot pad
  const padGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.06, 10);
  padGeo.translate(0, -height, 0);
  const pad = new THREE.Mesh(padGeo, material);
  pad.castShadow = true;
  group.add(pad);

  return group;
}
