import * as THREE from 'three';

export class Spaceship {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "SpaceshipRoot";

    // Sub-hierarchies
    this.hullGroup = new THREE.Group();
    this.group.add(this.hullGroup);

    // Dynamic state
    this.gearExtension = 1.0; // 1.0 = fully deployed, 0.0 = fully retracted
    this.throttle = 0.0;      // 0.0 to 1.0
    this.vtolThrottle = 0.0;  // 0.0 to 1.0

    // Component references
    this.landingGears = [];
    this.mainFlames = [];
    this.vtolFlames = [];
    this.engineLights = [];
    this.strobeLight = null;
    this.strobeMesh = null;

    this.buildShip();
    this.scene.add(this.group);
  }

  buildShip() {
    // High-tech spaceship materials
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x222831,
      roughness: 0.35,
      metalness: 0.8
    });

    const hullAccentMat = new THREE.MeshStandardMaterial({
      color: 0x00adb5,
      roughness: 0.25,
      metalness: 0.85
    });

    const hullWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.4,
      metalness: 0.5
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x15191f,
      roughness: 0.7,
      metalness: 0.3
    });

    const cockpitGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x102028,
      metalness: 0.2,
      roughness: 0.1,
      transmission: 0.75,
      ior: 1.5,
      transparent: true,
      opacity: 0.95,
      reflectivity: 0.9
    });

    // 1. Central Fuselage
    const fuselageShape = new THREE.Shape();
    // Profile of fuselage along X-Z plane
    fuselageShape.moveTo(0, 3.8);      // Nose tip forward
    fuselageShape.lineTo(0.5, 2.8);
    fuselageShape.lineTo(0.9, 1.2);
    fuselageShape.lineTo(1.1, -1.0);
    fuselageShape.lineTo(0.95, -2.8);   // Engine mount base
    fuselageShape.lineTo(-0.95, -2.8);
    fuselageShape.lineTo(-1.1, -1.0);
    fuselageShape.lineTo(-0.9, 1.2);
    fuselageShape.lineTo(-0.5, 2.8);
    fuselageShape.closePath();

    const extrudeSettings = {
      depth: 0.9,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 2,
      bevelSize: 0.25,
      bevelThickness: 0.3
    };

    const fuselageGeo = new THREE.ExtrudeGeometry(fuselageShape, extrudeSettings);
    fuselageGeo.center();
    const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.y = 0.45;
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    this.hullGroup.add(fuselage);

    // Fuselage Top Spine
    const spineGeo = new THREE.BoxGeometry(0.7, 0.4, 4.4);
    const spineMesh = new THREE.Mesh(spineGeo, hullWhiteMat);
    spineMesh.position.set(0, 0.85, -0.4);
    spineMesh.castShadow = true;
    this.hullGroup.add(spineMesh);

    // 2. Cockpit Canopy & Interior
    const canopyGeo = new THREE.ConeGeometry(0.55, 2.4, 6);
    canopyGeo.rotateX(Math.PI / 2);
    canopyGeo.scale(1.0, 0.75, 1.0);
    const canopyMesh = new THREE.Mesh(canopyGeo, cockpitGlassMat);
    canopyMesh.position.set(0, 0.92, 1.1);
    canopyMesh.castShadow = true;
    this.hullGroup.add(canopyMesh);

    // Cockpit Glowing HUD Console
    const hudGeo = new THREE.PlaneGeometry(0.35, 0.2);
    const hudMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide
    });
    const hudMesh = new THREE.Mesh(hudGeo, hudMat);
    hudMesh.rotation.x = -Math.PI / 4;
    hudMesh.position.set(0, 0.78, 1.4);
    this.hullGroup.add(hudMesh);

    // 3. Swept Main Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0.8);
    wingShape.lineTo(3.2, -1.6);
    wingShape.lineTo(3.0, -2.4);
    wingShape.lineTo(0, -1.8);
    wingShape.closePath();

    const wingExtrude = {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.05,
      bevelThickness: 0.04
    };

    // Right Wing
    const rightWingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrude);
    rightWingGeo.rotateX(Math.PI / 2);
    const rightWing = new THREE.Mesh(rightWingGeo, hullMat);
    rightWing.position.set(0.9, 0.45, 0);
    rightWing.castShadow = true;
    this.hullGroup.add(rightWing);

    // Left Wing (mirrored)
    const leftWingGeo = rightWingGeo.clone();
    leftWingGeo.scale(-1, 1, 1);
    const leftWing = new THREE.Mesh(leftWingGeo, hullMat);
    leftWing.position.set(-0.9, 0.45, 0);
    leftWing.castShadow = true;
    this.hullGroup.add(leftWing);

    // Wing Accent Stripes
    const stripeGeo = new THREE.BoxGeometry(0.2, 0.14, 2.2);
    const rightStripe = new THREE.Mesh(stripeGeo, hullAccentMat);
    rightStripe.position.set(1.9, 0.48, -0.9);
    rightStripe.rotation.y = -Math.PI * 0.14;
    this.hullGroup.add(rightStripe);

    const leftStripe = rightStripe.clone();
    leftStripe.position.set(-1.9, 0.48, -0.9);
    leftStripe.rotation.y = Math.PI * 0.14;
    this.hullGroup.add(leftStripe);

    // Winglet Vertical Stabilizers (Wing tips)
    const wingletGeo = new THREE.BoxGeometry(0.12, 0.85, 0.9);
    const rightWinglet = new THREE.Mesh(wingletGeo, hullAccentMat);
    rightWinglet.position.set(3.1, 0.8, -1.9);
    rightWinglet.rotation.z = Math.PI * 0.08;
    rightWinglet.castShadow = true;
    this.hullGroup.add(rightWinglet);

    const leftWinglet = new THREE.Mesh(wingletGeo, hullAccentMat);
    leftWinglet.position.set(-3.1, 0.8, -1.9);
    leftWinglet.rotation.z = -Math.PI * 0.08;
    leftWinglet.castShadow = true;
    this.hullGroup.add(leftWinglet);

    // Forward Canards (Agile pitch trim wings)
    const canardShape = new THREE.Shape();
    canardShape.moveTo(0, 0.4);
    canardShape.lineTo(1.2, -0.2);
    canardShape.lineTo(1.0, -0.5);
    canardShape.lineTo(0, -0.4);
    canardShape.closePath();

    const canardExtrude = {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.03,
      bevelThickness: 0.02
    };

    const rightCanardGeo = new THREE.ExtrudeGeometry(canardShape, canardExtrude);
    rightCanardGeo.rotateX(Math.PI / 2);
    const rightCanard = new THREE.Mesh(rightCanardGeo, hullAccentMat);
    rightCanard.position.set(0.6, 0.48, 2.1);
    this.hullGroup.add(rightCanard);

    const leftCanardGeo = rightCanardGeo.clone();
    leftCanardGeo.scale(-1, 1, 1);
    const leftCanard = new THREE.Mesh(leftCanardGeo, hullAccentMat);
    leftCanard.position.set(-0.6, 0.48, 2.1);
    this.hullGroup.add(leftCanard);

    // 4. Rear Twin Engines & Bells
    this.buildEngines(darkTrimMat);

    // 5. Belly VTOL Thrusters
    this.buildVTOLThrusters();

    // 6. Navigation & Strobe Lights
    this.buildNavLights();

    // 7. Retractable Tricycle Landing Gear
    this.buildLandingGear();
  }

  buildEngines(darkMat) {
    const nozzleOffsets = [-0.55, 0.55];

    nozzleOffsets.forEach(x => {
      // Cylindrical engine shroud
      const shroudGeo = new THREE.CylinderGeometry(0.38, 0.44, 1.2, 16);
      shroudGeo.rotateX(Math.PI / 2);
      const shroud = new THREE.Mesh(shroudGeo, darkMat);
      shroud.position.set(x, 0.45, -2.4);
      shroud.castShadow = true;
      this.hullGroup.add(shroud);

      // Nozzle bell (metallic ring)
      const nozzleGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.35, 16, 1, true);
      nozzleGeo.rotateX(Math.PI / 2);
      const nozzleMat = new THREE.MeshStandardMaterial({
        color: 0x272c33,
        metalness: 0.95,
        roughness: 0.15
      });
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.position.set(x, 0.45, -3.0);
      this.hullGroup.add(nozzle);

      // Glowing emitter ring inside nozzle
      const ringGeo = new THREE.TorusGeometry(0.24, 0.04, 8, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(x, 0.45, -2.95);
      this.hullGroup.add(ring);

      // Inner Core Flame Cone (Bright White-Cyan)
      const coreFlameGeo = new THREE.ConeGeometry(0.22, 1.8, 12);
      coreFlameGeo.rotateX(-Math.PI / 2);
      coreFlameGeo.translate(0, 0, -0.9);
      const coreFlameMat = new THREE.MeshBasicMaterial({
        color: 0xdff9ff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      const coreFlame = new THREE.Mesh(coreFlameGeo, coreFlameMat);
      coreFlame.position.set(x, 0.45, -3.0);
      this.hullGroup.add(coreFlame);

      // Outer Plasma Plume Cone (Cyan/Magenta glow)
      const plumeGeo = new THREE.ConeGeometry(0.36, 3.2, 16);
      plumeGeo.rotateX(-Math.PI / 2);
      plumeGeo.translate(0, 0, -1.6);
      const plumeMat = new THREE.MeshBasicMaterial({
        color: 0x00c8ff,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const plume = new THREE.Mesh(plumeGeo, plumeMat);
      plume.position.set(x, 0.45, -3.0);
      this.hullGroup.add(plume);

      // Engine point light
      const engineLight = new THREE.PointLight(0x00e5ff, 5.0, 10, 1.8);
      engineLight.position.set(x, 0.45, -3.2);
      this.hullGroup.add(engineLight);

      this.mainFlames.push({
        core: coreFlame,
        plume: plume,
        light: engineLight,
        baseX: x
      });
    });
  }

  buildVTOLThrusters() {
    // 4 ventral nozzles under the fuselage
    const vtolPositions = [
      { x: -0.65, z: 1.0 },
      { x: 0.65, z: 1.0 },
      { x: -0.65, z: -1.2 },
      { x: 0.65, z: -1.2 }
    ];

    vtolPositions.forEach(pos => {
      const rimGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.1, 12);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.9,
        roughness: 0.3
      });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.set(pos.x, 0.05, pos.z);
      this.hullGroup.add(rim);

      // Downward flame cone
      const vFlameGeo = new THREE.ConeGeometry(0.18, 1.4, 12);
      vFlameGeo.rotateX(Math.PI);
      vFlameGeo.translate(0, -0.7, 0);
      const vFlameMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const vFlame = new THREE.Mesh(vFlameGeo, vFlameMat);
      vFlame.position.set(pos.x, 0.02, pos.z);
      this.hullGroup.add(vFlame);

      this.vtolFlames.push(vFlame);
    });
  }

  buildNavLights() {
    // Port (Left) Nav Light: Red
    const portGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const portMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const portLight = new THREE.Mesh(portGeo, portMat);
    portLight.position.set(-3.12, 1.15, -1.9);
    this.hullGroup.add(portLight);

    // Starboard (Right) Nav Light: Green
    const starGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const starMat = new THREE.MeshBasicMaterial({ color: 0x00e676 });
    const starLight = new THREE.Mesh(starGeo, starMat);
    starLight.position.set(3.12, 1.15, -1.9);
    this.hullGroup.add(starLight);

    // Top Spine Strobe (White Flashing)
    const strobeGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.strobeMesh = new THREE.Mesh(strobeGeo, strobeMat);
    this.strobeMesh.position.set(0, 1.08, -0.5);
    this.hullGroup.add(this.strobeMesh);

    this.strobeLight = new THREE.PointLight(0xffffff, 0, 8);
    this.strobeLight.position.set(0, 1.2, -0.5);
    this.hullGroup.add(this.strobeLight);
  }

  buildLandingGear() {
    // 3 Gear Assemblies: Nose Gear, Left Main, Right Main
    const gearConfig = [
      { name: 'nose', mount: new THREE.Vector3(0, 0.1, 2.2), isNose: true },
      { name: 'left', mount: new THREE.Vector3(-1.2, 0.2, -0.6), isNose: false },
      { name: 'right', mount: new THREE.Vector3(1.2, 0.2, -0.6), isNose: false }
    ];

    const strutMat = new THREE.MeshStandardMaterial({
      color: 0x5a6578,
      metalness: 0.85,
      roughness: 0.25
    });

    const footMat = new THREE.MeshStandardMaterial({
      color: 0x22262b,
      metalness: 0.5,
      roughness: 0.6
    });

    gearConfig.forEach(cfg => {
      const gearPivot = new THREE.Group();
      gearPivot.position.copy(cfg.mount);
      this.hullGroup.add(gearPivot);

      // Hydraulic Strut
      const strutLength = cfg.isNose ? 1.05 : 0.95;
      const strutGeo = new THREE.CylinderGeometry(0.05, 0.05, strutLength, 8);
      const strut = new THREE.Mesh(strutGeo, strutMat);
      strut.position.y = -strutLength / 2;
      strut.castShadow = true;
      gearPivot.add(strut);

      // Piston cylinder
      const pistonGeo = new THREE.CylinderGeometry(0.07, 0.07, strutLength * 0.45, 8);
      const piston = new THREE.Mesh(pistonGeo, strutMat);
      piston.position.y = -strutLength * 0.35;
      gearPivot.add(piston);

      // Foot Pad / Skids
      if (cfg.isNose) {
        // Dual front wheels
        const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelLeft = new THREE.Mesh(wheelGeo, footMat);
        wheelLeft.position.set(-0.1, -strutLength, 0);
        gearPivot.add(wheelLeft);

        const wheelRight = new THREE.Mesh(wheelGeo, footMat);
        wheelRight.position.set(0.1, -strutLength, 0);
        gearPivot.add(wheelRight);
      } else {
        // Broad landing foot pad
        const footGeo = new THREE.BoxGeometry(0.45, 0.08, 0.6);
        const foot = new THREE.Mesh(footGeo, footMat);
        foot.position.y = -strutLength;
        gearPivot.add(foot);
      }

      this.landingGears.push({
        pivot: gearPivot,
        isNose: cfg.isNose,
        mount: cfg.mount
      });
    });
  }

  setGearExtension(progress) {
    // progress: 1.0 = fully deployed, 0.0 = fully retracted inside hull
    this.gearExtension = THREE.MathUtils.clamp(progress, 0, 1);
    
    this.landingGears.forEach(gear => {
      // Rotation angle: 0 when down, ~85° when tucked into hull
      const foldAngle = (1.0 - this.gearExtension) * (Math.PI * 0.48);
      if (gear.isNose) {
        // Nose folds backward
        gear.pivot.rotation.x = -foldAngle;
      } else {
        // Main gear folds inward towards belly centerline
        const dir = gear.mount.x > 0 ? 1 : -1;
        gear.pivot.rotation.z = dir * foldAngle;
      }
      // Gentle scale squash when fully tucked
      gear.pivot.scale.setScalar(0.2 + 0.8 * this.gearExtension);
    });
  }

  setThrottle(throttle) {
    this.throttle = THREE.MathUtils.clamp(throttle, 0, 1.5);
  }

  setVTOLThrottle(vtol) {
    this.vtolThrottle = THREE.MathUtils.clamp(vtol, 0, 1.2);
  }

  update(time, delta) {
    // 1. Update Main Engine Plumes & Lighting
    const t = this.throttle;
    const flutter = Math.sin(time * 35.0) * 0.08 + Math.cos(time * 48.0) * 0.05;

    this.mainFlames.forEach(flame => {
      if (t <= 0.01) {
        // Idle gentle pulse
        const idlePulse = 0.15 + Math.sin(time * 4.0) * 0.05;
        flame.core.scale.set(0.5, 0.5, idlePulse);
        flame.plume.scale.set(0.6, 0.6, idlePulse * 0.8);
        flame.core.material.opacity = 0.4;
        flame.plume.material.opacity = 0.2;
        flame.light.intensity = 1.0;
      } else {
        const length = (0.6 + t * 1.5 + flutter);
        const width = 0.7 + t * 0.6;
        flame.core.scale.set(width, width, length);
        flame.plume.scale.set(width * 1.1, width * 1.1, length * 1.3);
        flame.core.material.opacity = Math.min(1.0, 0.5 + t * 0.6);
        flame.plume.material.opacity = Math.min(0.9, 0.3 + t * 0.5);
        flame.light.intensity = 3.0 + t * 15.0;
      }
    });

    // 2. Update Belly VTOL Flames
    const vt = this.vtolThrottle;
    const vFlutter = Math.sin(time * 40.0) * 0.06;
    this.vtolFlames.forEach(vf => {
      if (vt > 0.05) {
        vf.visible = true;
        const vLen = (0.4 + vt * 1.2 + vFlutter);
        vf.scale.set(0.7 + vt * 0.4, vLen, 0.7 + vt * 0.4);
        vf.material.opacity = 0.4 + vt * 0.5;
      } else {
        vf.visible = false;
        vf.material.opacity = 0;
      }
    });

    // 3. Update Strobe Flash (Quick double flash every 1.5s)
    const cycle = (time % 1.5) / 1.5;
    const isFlashing = (cycle > 0.0 && cycle < 0.05) || (cycle > 0.1 && cycle < 0.15);
    if (this.strobeLight && this.strobeMesh) {
      this.strobeLight.intensity = isFlashing ? 12.0 : 0.0;
      this.strobeMesh.material.color.setHex(isFlashing ? 0xffffff : 0x444444);
    }
  }

  // Position helper
  getWorldPosition(target = new THREE.Vector3()) {
    return this.group.getWorldPosition(target);
  }
}
