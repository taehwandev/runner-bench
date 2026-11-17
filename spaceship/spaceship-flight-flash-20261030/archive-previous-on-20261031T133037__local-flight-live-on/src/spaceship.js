import * as THREE from 'three';

/**
 * Creates a detailed, polished sci-fi spaceship for local circuit flight.
 * Features:
 * - Aerodynamic lifting body with tapered nose
 * - Tinted glass cockpit canopy with interior glow
 * - Swept wings with vertical winglet stabilizers
 * - Dual rear rocket/ion engine nozzles with inner glow
 * - RCS maneuvering thrusters
 * - 3 Retractable shock-absorbing landing gear legs with pads
 * - Port (red) & Starboard (green) navigation lights and pulsing beacon
 * - Dynamic thruster exhaust plumes and point light
 */
export class Spaceship {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Spaceship';

    // Materials
    this.materials = this.createMaterials();

    // Components
    this.hull = new THREE.Group();
    this.group.add(this.hull);

    this.landingGear = [];
    this.navLights = [];
    this.beaconLight = null;
    this.beaconTimer = 0;

    this.thrusterPlumes = [];
    this.thrusterLight = null;

    // Landing gear state (0 = retracted, 1 = deployed)
    this.gearExtension = 1.0;
    this.targetGearExtension = 1.0;

    // Thruster state
    this.currentThrottle = 0.1;

    // Build the ship
    this.buildFuselage();
    this.buildWings();
    this.buildCockpit();
    this.buildEngines();
    this.buildLandingGear();
    this.buildLights();
    this.buildThrusterFX();

    // Set initial position (resting height on landing pad)
    this.baseHeight = 0.46; // Pad height + gear clearance
    this.group.position.set(0, this.baseHeight, 0);

    // Enable shadows on all ship meshes
    this.group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  createMaterials() {
    let hullTexture = null;

    if (typeof document !== 'undefined') {
      // Canvas texture for panel details
      const panelCanvas = document.createElement('canvas');
      panelCanvas.width = 512;
      panelCanvas.height = 512;
      const ctx = panelCanvas.getContext('2d');

      // Base light gray
      ctx.fillStyle = '#e8ecf2';
      ctx.fillRect(0, 0, 512, 512);

      // Subtle panel seams
      ctx.strokeStyle = '#c5ccd6';
      ctx.lineWidth = 3;
      for (let x = 64; x < 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      for (let y = 64; y < 512; y += 128) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }

      // Racing/insignia stripes
      ctx.fillStyle = '#0ea5e9'; // Cyan accent
      ctx.fillRect(220, 0, 72, 512);
      ctx.fillStyle = '#f97316'; // Orange accent
      ctx.fillRect(200, 0, 15, 512);
      ctx.fillRect(297, 0, 15, 512);

      hullTexture = new THREE.CanvasTexture(panelCanvas);
      hullTexture.wrapS = THREE.RepeatWrapping;
      hullTexture.wrapT = THREE.RepeatWrapping;
    }

    return {
      hull: new THREE.MeshStandardMaterial({
        map: hullTexture,
        color: 0xffffff,
        metalness: 0.35,
        roughness: 0.3,
      }),
      darkTrim: new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        metalness: 0.8,
        roughness: 0.35,
      }),
      cyanAccent: new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        metalness: 0.5,
        roughness: 0.25,
        emissive: 0x0891b2,
        emissiveIntensity: 0.2,
      }),
      orangeAccent: new THREE.MeshStandardMaterial({
        color: 0xf97316,
        metalness: 0.4,
        roughness: 0.4,
      }),
      canopyGlass: new THREE.MeshPhysicalMaterial({
        color: 0x0f172a,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.7,
        transparent: true,
        opacity: 0.85,
        ior: 1.52,
        reflectivity: 0.9,
      }),
      engineMetal: new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.85,
        roughness: 0.25,
      }),
      engineCore: new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
      }),
      strutMetal: new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.9,
        roughness: 0.2,
      }),
      rubberFoot: new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.8,
      }),
      plumeFlame: new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      plumeInner: new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    };
  }

  buildFuselage() {
    // Main body: tapered streamlined lifting-body hull
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.75, 3.4, 8);
    // Orient cylinder along Z axis (nose points towards +Z)
    bodyGeo.rotateX(Math.PI / 2);
    // Flatten vertically for aerodynamic lifting body
    bodyGeo.scale(1.2, 0.65, 1.0);

    const bodyMesh = new THREE.Mesh(bodyGeo, this.materials.hull);
    bodyMesh.position.set(0, 0.45, 0);
    this.hull.add(bodyMesh);

    // Nose cone
    const noseGeo = new THREE.ConeGeometry(0.42, 1.1, 8);
    noseGeo.rotateX(Math.PI / 2);
    noseGeo.scale(1.0, 0.55, 1.0);
    const noseMesh = new THREE.Mesh(noseGeo, this.materials.hull);
    noseMesh.position.set(0, 0.45, 2.2);
    this.hull.add(noseMesh);

    // Nose sensor tip
    const tipGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.4, 8);
    tipGeo.rotateX(Math.PI / 2);
    const tipMesh = new THREE.Mesh(tipGeo, this.materials.darkTrim);
    tipMesh.position.set(0, 0.45, 2.85);
    this.hull.add(tipMesh);

    // Upper spine / avionics bay
    const spineGeo = new THREE.BoxGeometry(0.3, 0.22, 2.2);
    const spineMesh = new THREE.Mesh(spineGeo, this.materials.darkTrim);
    spineMesh.position.set(0, 0.72, -0.2);
    this.hull.add(spineMesh);

    // Air intake / radiator vents on sides
    const ventGeo = new THREE.BoxGeometry(0.2, 0.18, 0.8);
    const leftVent = new THREE.Mesh(ventGeo, this.materials.darkTrim);
    leftVent.position.set(-0.7, 0.42, 0.3);
    leftVent.rotation.y = 0.2;
    this.hull.add(leftVent);

    const rightVent = leftVent.clone();
    rightVent.position.x = 0.7;
    rightVent.rotation.y = -0.2;
    this.hull.add(rightVent);
  }

  buildCockpit() {
    // Sleek cockpit canopy
    const canopyGeo = new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    canopyGeo.scale(0.85, 0.7, 1.8);
    const canopyMesh = new THREE.Mesh(canopyGeo, this.materials.canopyGlass);
    canopyMesh.position.set(0, 0.58, 0.85);
    this.hull.add(canopyMesh);

    // Pilot interior dashboard console glow
    const dashGeo = new THREE.BoxGeometry(0.3, 0.1, 0.4);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const dashMesh = new THREE.Mesh(dashGeo, dashMat);
    dashMesh.position.set(0, 0.52, 0.95);
    this.hull.add(dashMesh);

    // Pilot headrest silhouette
    const seatGeo = new THREE.BoxGeometry(0.22, 0.3, 0.15);
    const seatMesh = new THREE.Mesh(seatGeo, this.materials.darkTrim);
    seatMesh.position.set(0, 0.65, 0.65);
    this.hull.add(seatMesh);
  }

  buildWings() {
    // Swept delta wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.4, -0.9); // Wing tip
    wingShape.lineTo(2.3, -1.5); // Wing trailing edge outer
    wingShape.lineTo(0.5, -1.4); // Wing root trailing
    wingShape.lineTo(0, 0.5);   // Front root
    wingShape.closePath();

    const extrudeSettings = {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    };

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.rotateX(-Math.PI / 2); // Place horizontally in X-Z plane

    // Left wing
    const leftWing = new THREE.Mesh(wingGeo, this.materials.hull);
    leftWing.position.set(0.2, 0.42, 0.2);
    this.hull.add(leftWing);

    // Right wing (mirrored)
    const rightWingGeo = wingGeo.clone();
    rightWingGeo.scale(-1, 1, 1);
    const rightWing = new THREE.Mesh(rightWingGeo, this.materials.hull);
    rightWing.position.set(-0.2, 0.42, 0.2);
    this.hull.add(rightWing);

    // Winglet stabilizers (vertical fins at wing tips)
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.6, 0.7);
    finShape.lineTo(0.2, 0.7);
    finShape.lineTo(-0.3, 0);
    finShape.closePath();

    const finGeo = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelSize: 0.01,
      bevelThickness: 0.01,
      bevelSegments: 1,
    });
    // Orient fin vertically
    finGeo.rotateY(Math.PI / 2);

    const rightFin = new THREE.Mesh(finGeo, this.materials.cyanAccent);
    rightFin.position.set(2.55, 0.44, -1.0);
    rightFin.rotation.z = -0.15; // Slight outward cant
    this.hull.add(rightFin);

    const leftFin = new THREE.Mesh(finGeo, this.materials.cyanAccent);
    leftFin.position.set(-2.55, 0.44, -1.0);
    leftFin.rotation.z = 0.15;
    this.hull.add(leftFin);

    // Central dorsal stabilizer fin
    const dorsalFinGeo = finGeo.clone();
    dorsalFinGeo.scale(1.2, 1.4, 1.2);
    const dorsalFin = new THREE.Mesh(dorsalFinGeo, this.materials.orangeAccent);
    dorsalFin.position.set(0, 0.8, -1.1);
    this.hull.add(dorsalFin);
  }

  buildEngines() {
    // Twin rear rocket/ion engine housings
    const nozzleOuterGeo = new THREE.CylinderGeometry(0.26, 0.34, 0.7, 16);
    nozzleOuterGeo.rotateX(Math.PI / 2);

    const nozzleInnerGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.72, 16);
    nozzleInnerGeo.rotateX(Math.PI / 2);

    // Left engine
    const leftHousing = new THREE.Mesh(nozzleOuterGeo, this.materials.engineMetal);
    leftHousing.position.set(-0.45, 0.44, -1.7);
    this.hull.add(leftHousing);

    const leftCore = new THREE.Mesh(nozzleInnerGeo, this.materials.engineCore);
    leftCore.position.set(-0.45, 0.44, -1.72);
    this.hull.add(leftCore);

    // Right engine
    const rightHousing = new THREE.Mesh(nozzleOuterGeo, this.materials.engineMetal);
    rightHousing.position.set(0.45, 0.44, -1.7);
    this.hull.add(rightHousing);

    const rightCore = new THREE.Mesh(nozzleInnerGeo, this.materials.engineCore);
    rightCore.position.set(0.45, 0.44, -1.72);
    this.hull.add(rightCore);

    // RCS maneuvering thruster blocks
    const rcsGeo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
    const rcsPositions = [
      [0.65, 0.45, 1.5],
      [-0.65, 0.45, 1.5],
      [2.2, 0.44, -0.6],
      [-2.2, 0.44, -0.6]
    ];
    rcsPositions.forEach(([x, y, z]) => {
      const rcs = new THREE.Mesh(rcsGeo, this.materials.darkTrim);
      rcs.position.set(x, y, z);
      this.hull.add(rcs);
    });
  }

  buildLandingGear() {
    // 3 landing gear assemblies: Nose gear + Left main gear + Right main gear
    const gearConfigs = [
      { name: 'nose', x: 0, z: 1.2, height: 0.46 },
      { name: 'left', x: -0.9, z: -0.6, height: 0.46 },
      { name: 'right', x: 0.9, z: -0.6, height: 0.46 },
    ];

    gearConfigs.forEach(cfg => {
      const gearGroup = new THREE.Group();
      gearGroup.position.set(cfg.x, 0.42, cfg.z);

      // Upper strut
      const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
      strutGeo.translate(0, -0.175, 0);
      const strut = new THREE.Mesh(strutGeo, this.materials.strutMetal);
      gearGroup.add(strut);

      // Hydraulic piston / lower leg
      const pistonGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 8);
      pistonGeo.translate(0, -0.3, 0);
      const piston = new THREE.Mesh(pistonGeo, this.materials.strutMetal);
      gearGroup.add(piston);

      // Footpad
      const padGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.05, 8);
      padGeo.translate(0, -0.42, 0);
      const pad = new THREE.Mesh(padGeo, this.materials.rubberFoot);
      gearGroup.add(pad);

      this.hull.add(gearGroup);
      this.landingGear.push({
        group: gearGroup,
        config: cfg,
        initialY: 0.42
      });
    });
  }

  buildLights() {
    // Starboard wingtip nav light (Green)
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const greenBulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), greenMat);
    greenBulb.position.set(2.55, 0.45, -0.9);
    this.hull.add(greenBulb);
    this.navLights.push(greenBulb);

    // Port wingtip nav light (Red)
    const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const redBulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), redMat);
    redBulb.position.set(-2.55, 0.45, -0.9);
    this.hull.add(redBulb);
    this.navLights.push(redBulb);

    // Dorsal anti-collision beacon (Flashing Amber/White)
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const beaconBulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), beaconMat);
    beaconBulb.position.set(0, 1.45, -1.3);
    this.hull.add(beaconBulb);
    this.beaconLight = beaconBulb;
  }

  buildThrusterFX() {
    // Outer flame cones for left and right engines
    const plumeGeo = new THREE.ConeGeometry(0.24, 1.6, 16, 1, true);
    plumeGeo.rotateX(-Math.PI / 2); // Point backward (-Z)
    plumeGeo.translate(0, 0, -0.8);

    const innerGeo = new THREE.ConeGeometry(0.14, 1.2, 16, 1, true);
    innerGeo.rotateX(-Math.PI / 2);
    innerGeo.translate(0, 0, -0.6);

    const engines = [-0.45, 0.45];
    engines.forEach(x => {
      const plumeGroup = new THREE.Group();
      plumeGroup.position.set(x, 0.44, -2.05);

      const outerFlame = new THREE.Mesh(plumeGeo, this.materials.plumeFlame.clone());
      const innerFlame = new THREE.Mesh(innerGeo, this.materials.plumeInner.clone());

      plumeGroup.add(outerFlame);
      plumeGroup.add(innerFlame);
      this.hull.add(plumeGroup);

      this.thrusterPlumes.push({
        group: plumeGroup,
        outer: outerFlame,
        inner: innerFlame
      });
    });

    // Dynamic point light for engine exhaust lighting
    this.thrusterLight = new THREE.PointLight(0x38bdf8, 1.5, 12, 1.5);
    this.thrusterLight.position.set(0, 0.44, -2.5);
    this.hull.add(this.thrusterLight);
  }

  setLandingGear(ratio) {
    this.targetGearExtension = THREE.MathUtils.clamp(ratio, 0, 1);
  }

  update(delta, throttle = 0.1, isFlying = false) {
    // Smooth throttle transition
    this.currentThrottle = THREE.MathUtils.lerp(this.currentThrottle, throttle, delta * 6);

    // Beacon light blinking (1.2 Hz)
    this.beaconTimer += delta;
    if (this.beaconLight) {
      const blink = Math.sin(this.beaconTimer * 7) > 0.4 ? 1.0 : 0.15;
      this.beaconLight.material.color.setRGB(1.0 * blink, 0.85 * blink, 0.5 * blink);
    }

    // Landing gear animation (smooth retraction / deployment)
    this.gearExtension = THREE.MathUtils.lerp(this.gearExtension, this.targetGearExtension, delta * 4);
    this.landingGear.forEach(gear => {
      // Retract upwards into wheel well and tilt slightly
      const retractProgress = 1.0 - this.gearExtension;
      gear.group.position.y = gear.initialY + retractProgress * 0.35;
      gear.group.scale.set(1.0, this.gearExtension, 1.0);
      gear.group.rotation.x = retractProgress * (gear.config.name === 'nose' ? 0.4 : -0.3);
    });

    // Animate engine exhaust plume
    const flicker = 0.9 + Math.random() * 0.2;
    const plumeScaleZ = Math.max(0.05, this.currentThrottle * flicker);
    const plumeScaleXY = Math.max(0.2, (0.5 + this.currentThrottle * 0.5) * flicker);

    this.thrusterPlumes.forEach(p => {
      p.group.scale.set(plumeScaleXY, plumeScaleXY, plumeScaleZ * 1.8);
      p.outer.material.opacity = Math.min(0.9, 0.2 + this.currentThrottle * 0.7);

      // Color shift: idle cyan -> active high throttle electric blue/white
      if (this.currentThrottle > 0.7) {
        p.outer.material.color.setHex(0x60a5fa);
      } else {
        p.outer.material.color.setHex(0x38bdf8);
      }
    });

    // Dynamic thruster point light
    if (this.thrusterLight) {
      this.thrusterLight.intensity = this.currentThrottle * 3.5;
      this.thrusterLight.distance = 6 + this.currentThrottle * 10;
    }
  }

  getMesh() {
    return this.group;
  }

  getThrusterWorldPosition(index = 0) {
    const x = index === 0 ? -0.45 : 0.45;
    const v = new THREE.Vector3(x, 0.44, -2.1);
    return v.applyMatrix4(this.hull.matrixWorld);
  }
}
