import * as THREE from 'three';

export class Spaceship {
  constructor() {
    this.group = new THREE.Group();
    this.name = 'Spaceship';

    // State
    this.gearProgress = 1; // 1 = fully deployed, 0 = fully retracted
    this.throttle = 0;     // 0 to 1
    this.engineLights = [];
    this.plumeMeshes = [];
    this.strobeLight = null;
    this.strobeTimer = 0;
    this.landingSpotlight = null;
    this.particleSystem = null;
    this.particlePositions = null;
    this.particleVelocities = null;
    this.particleLifetimes = null;
    this.particleCount = 70;

    // Build the ship
    this.buildShip();
    this.buildLandingGear();
    this.buildThrustersAndPlume();
    this.buildParticles();
    this.buildLights();
  }

  buildShip() {
    // Reusable Materials
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.28,
      metalness: 0.35,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xff6b35, // Safety aerospace orange
      roughness: 0.35,
      metalness: 0.2,
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x18202a,
      roughness: 0.45,
      metalness: 0.7,
    });

    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a1f33,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.75,
      thickness: 0.5,
      transparent: true,
      opacity: 0.88,
      reflectivity: 0.9,
    });

    // --- Main Fuselage ---
    // Aerodynamic tapered body
    const bodyGeo = new THREE.ConeGeometry(1.15, 4.4, 8);
    bodyGeo.rotateX(Math.PI / 2);
    bodyGeo.scale(1, 0.48, 1);
    const bodyMesh = new THREE.Mesh(bodyGeo, hullMat);
    bodyMesh.position.set(0, 0.4, 0.2);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.group.add(bodyMesh);

    // Fuselage Top Spine
    const spineGeo = new THREE.BoxGeometry(0.55, 0.3, 3.2);
    const spineMesh = new THREE.Mesh(spineGeo, accentMat);
    spineMesh.position.set(0, 0.65, -0.2);
    spineMesh.castShadow = true;
    this.group.add(spineMesh);

    // Nose Cone Tip (Radar Dome)
    const noseGeo = new THREE.SphereGeometry(0.35, 16, 12);
    noseGeo.scale(1, 0.6, 1.8);
    const noseMesh = new THREE.Mesh(noseGeo, darkMat);
    noseMesh.position.set(0, 0.4, 2.3);
    noseMesh.castShadow = true;
    this.group.add(noseMesh);

    // --- Cockpit Canopy ---
    const canopyGeo = new THREE.SphereGeometry(0.55, 24, 16);
    canopyGeo.scale(0.85, 0.65, 1.9);
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(0, 0.66, 0.8);
    this.group.add(canopyMesh);

    // Pilot seat silhouette inside canopy
    const seatGeo = new THREE.BoxGeometry(0.35, 0.4, 0.35);
    const seatMesh = new THREE.Mesh(seatGeo, darkMat);
    seatMesh.position.set(0, 0.52, 0.7);
    this.group.add(seatMesh);

    // Interior HUD dash glow
    const hudDashGeo = new THREE.PlaneGeometry(0.3, 0.12);
    const hudDashMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const hudDash = new THREE.Mesh(hudDashGeo, hudDashMat);
    hudDash.position.set(0, 0.58, 1.1);
    hudDash.rotateX(-Math.PI / 4);
    this.group.add(hudDash);

    // --- Delta Wings ---
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.4, -1.4);
    wingShape.lineTo(2.35, -2.1);
    wingShape.lineTo(0.5, -2.0);
    wingShape.lineTo(0, -1.8);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.1, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.03, bevelThickness: 0.03 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.rotateX(Math.PI / 2);

    // Right Wing
    const rightWing = new THREE.Mesh(wingGeo, hullMat);
    rightWing.position.set(0.4, 0.35, 0.4);
    rightWing.castShadow = true;
    rightWing.receiveShadow = true;
    this.group.add(rightWing);

    // Left Wing (mirrored)
    const leftWingGeo = wingGeo.clone();
    leftWingGeo.scale(-1, 1, 1);
    const leftWing = new THREE.Mesh(leftWingGeo, hullMat);
    leftWing.position.set(-0.4, 0.35, 0.4);
    leftWing.castShadow = true;
    leftWing.receiveShadow = true;
    this.group.add(leftWing);

    // Wing Accent Stripes
    const wingStripeGeo = new THREE.BoxGeometry(0.35, 0.12, 1.4);
    const rightStripe = new THREE.Mesh(wingStripeGeo, accentMat);
    rightStripe.position.set(1.4, 0.37, -0.6);
    rightStripe.rotation.y = -0.3;
    this.group.add(rightStripe);

    const leftStripe = new THREE.Mesh(wingStripeGeo, accentMat);
    leftStripe.position.set(-1.4, 0.37, -0.6);
    leftStripe.rotation.y = 0.3;
    this.group.add(leftStripe);

    // Wingtip Vertical Stabilizers (Winglets)
    const wingletGeo = new THREE.BoxGeometry(0.08, 0.85, 0.7);
    const rightWinglet = new THREE.Mesh(wingletGeo, darkMat);
    rightWinglet.position.set(2.4, 0.65, -1.35);
    rightWinglet.rotation.z = -0.15;
    rightWinglet.castShadow = true;
    this.group.add(rightWinglet);

    const leftWinglet = new THREE.Mesh(wingletGeo, darkMat);
    leftWinglet.position.set(-2.4, 0.65, -1.35);
    leftWinglet.rotation.z = 0.15;
    leftWinglet.castShadow = true;
    this.group.add(leftWinglet);

    // Twin Dorsal Tail Fins (Angled V-tail)
    const vFinGeo = new THREE.BoxGeometry(0.09, 0.9, 0.8);
    const rightVFin = new THREE.Mesh(vFinGeo, hullMat);
    rightVFin.position.set(0.48, 0.8, -1.4);
    rightVFin.rotation.z = -0.35;
    rightVFin.rotation.x = -0.2;
    rightVFin.castShadow = true;
    this.group.add(rightVFin);

    const leftVFin = new THREE.Mesh(vFinGeo, hullMat);
    leftVFin.position.set(-0.48, 0.8, -1.4);
    leftVFin.rotation.z = 0.35;
    leftVFin.rotation.x = -0.2;
    leftVFin.castShadow = true;
    this.group.add(leftVFin);
  }

  buildLandingGear() {
    this.gearGroup = new THREE.Group();
    const gearMetal = new THREE.MeshStandardMaterial({ color: 0x444d56, roughness: 0.3, metalness: 0.8 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1f2429, roughness: 0.6, metalness: 0.5 });

    // 1. Front Nose Gear Leg
    this.noseGear = new THREE.Group();
    this.noseGear.position.set(0, 0.25, 1.4);

    const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.65, 8), gearMetal);
    noseStrut.position.set(0, -0.3, 0);
    this.noseGear.add(noseStrut);

    const noseFootpad = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12), padMat);
    noseFootpad.position.set(0, -0.62, 0);
    this.noseGear.add(noseFootpad);

    this.gearGroup.add(this.noseGear);

    // 2. Left Main Gear Leg
    this.leftGear = new THREE.Group();
    this.leftGear.position.set(-0.75, 0.25, -0.7);

    const leftStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.65, 8), gearMetal);
    leftStrut.position.set(0, -0.3, 0);
    leftStrut.rotation.z = 0.15;
    this.leftGear.add(leftStrut);

    const leftFootpad = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12), padMat);
    leftFootpad.position.set(-0.06, -0.62, 0);
    this.leftGear.add(leftFootpad);

    this.gearGroup.add(this.leftGear);

    // 3. Right Main Gear Leg
    this.rightGear = new THREE.Group();
    this.rightGear.position.set(0.75, 0.25, -0.7);

    const rightStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.65, 8), gearMetal);
    rightStrut.position.set(0, -0.3, 0);
    rightStrut.rotation.z = -0.15;
    this.rightGear.add(rightStrut);

    const rightFootpad = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12), padMat);
    rightFootpad.position.set(0.06, -0.62, 0);
    this.rightGear.add(rightFootpad);

    this.gearGroup.add(this.rightGear);

    this.group.add(this.gearGroup);
  }

  buildThrustersAndPlume() {
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x1f232b,
      metalness: 0.9,
      roughness: 0.25,
    });

    const glowCoreMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    });

    const thrusterPositions = [-0.48, 0.48];

    thrusterPositions.forEach((xPos) => {
      // Nacelle housing
      const nacelleGeo = new THREE.CylinderGeometry(0.24, 0.28, 1.2, 16);
      nacelleGeo.rotateX(Math.PI / 2);
      const nacelle = new THREE.Mesh(nacelleGeo, nozzleMat);
      nacelle.position.set(xPos, 0.4, -1.5);
      nacelle.castShadow = true;
      this.group.add(nacelle);

      // Nozzle bell
      const bellGeo = new THREE.CylinderGeometry(0.26, 0.18, 0.35, 16, 1, true);
      bellGeo.rotateX(Math.PI / 2);
      const bell = new THREE.Mesh(bellGeo, nozzleMat);
      bell.position.set(xPos, 0.4, -2.15);
      this.group.add(bell);

      // Inner glowing core
      const coreGeo = new THREE.CircleGeometry(0.18, 16);
      const core = new THREE.Mesh(coreGeo, glowCoreMat);
      core.position.set(xPos, 0.4, -2.1);
      core.rotateY(Math.PI);
      this.group.add(core);

      // Plume Cone (inner cyan high-intensity)
      const innerPlumeGeo = new THREE.ConeGeometry(0.22, 1.8, 16, 1, true);
      innerPlumeGeo.rotateX(-Math.PI / 2);
      const innerPlumeMat = new THREE.MeshBasicMaterial({
        color: 0x66ffff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const innerPlume = new THREE.Mesh(innerPlumeGeo, innerPlumeMat);
      innerPlume.position.set(xPos, 0.4, -3.0);
      this.group.add(innerPlume);

      // Plume Cone (outer orange/plasma flame)
      const outerPlumeGeo = new THREE.ConeGeometry(0.38, 2.4, 16, 1, true);
      outerPlumeGeo.rotateX(-Math.PI / 2);
      const outerPlumeMat = new THREE.MeshBasicMaterial({
        color: 0xff7700,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const outerPlume = new THREE.Mesh(outerPlumeGeo, outerPlumeMat);
      outerPlume.position.set(xPos, 0.4, -3.3);
      this.group.add(outerPlume);

      this.plumeMeshes.push({ inner: innerPlume, outer: outerPlume });

      // Engine point light for ground glow
      const engLight = new THREE.PointLight(0x00e1ff, 0.5, 8);
      engLight.position.set(xPos, 0.4, -2.4);
      this.group.add(engLight);
      this.engineLights.push(engLight);
    });
  }

  buildParticles() {
    const geo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = new Float32Array(this.particleCount * 3);
    this.particleLifetimes = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      // Default to inactive behind ship
      this.particlePositions[i * 3] = (Math.random() - 0.5) * 0.4;
      this.particlePositions[i * 3 + 1] = 0.4 + (Math.random() - 0.5) * 0.2;
      this.particlePositions[i * 3 + 2] = -2.2;
      this.particleLifetimes[i] = Math.random();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    // Particle sprite
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(0, 240, 255, 0.8)');
    grad.addColorStop(0.8, 'rgba(255, 120, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const pTex = new THREE.CanvasTexture(canvas);
    const pMat = new THREE.PointsMaterial({
      size: 0.45,
      map: pTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particleSystem = new THREE.Points(geo, pMat);
    this.group.add(this.particleSystem);
  }

  buildLights() {
    // Port wing light (Red)
    const redLightGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const redMesh = new THREE.Mesh(redLightGeo, redMat);
    redMesh.position.set(-2.4, 0.38, -1.35);
    this.group.add(redMesh);

    // Starboard wing light (Green)
    const greenLightGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const greenMesh = new THREE.Mesh(greenLightGeo, greenMat);
    greenMesh.position.set(2.4, 0.38, -1.35);
    this.group.add(greenMesh);

    // Dorsal fin strobe (Flashing white)
    const strobeGeo = new THREE.SphereGeometry(0.07, 8, 8);
    this.strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const strobeMesh = new THREE.Mesh(strobeGeo, this.strobeMat);
    strobeMesh.position.set(0, 1.1, -1.3);
    this.group.add(strobeMesh);

    this.strobePointLight = new THREE.PointLight(0xffffff, 0, 6);
    this.strobePointLight.position.set(0, 1.1, -1.3);
    this.group.add(this.strobePointLight);

    // Downward Landing Spotlight
    this.landingSpotlight = new THREE.SpotLight(0xaae8ff, 3.5, 35, Math.PI / 5, 0.4, 1.2);
    this.landingSpotlight.position.set(0, 0.1, 0.8);
    const targetObj = new THREE.Object3D();
    targetObj.position.set(0, -20, 0.8);
    this.group.add(targetObj);
    this.landingSpotlight.target = targetObj;
    this.group.add(this.landingSpotlight);
  }

  setGearProgress(progress) {
    // 0 = retracted, 1 = deployed
    this.gearProgress = Math.max(0, Math.min(1, progress));

    // Animate nose gear (pivots back)
    const noseAngle = (1 - this.gearProgress) * (Math.PI * 0.48);
    this.noseGear.rotation.x = -noseAngle;
    this.noseGear.scale.set(1, Math.max(0.01, this.gearProgress), 1);

    // Animate main gear (folds inward)
    const mainAngle = (1 - this.gearProgress) * (Math.PI * 0.45);
    this.leftGear.rotation.z = -mainAngle;
    this.leftGear.scale.set(Math.max(0.01, this.gearProgress), Math.max(0.01, this.gearProgress), 1);

    this.rightGear.rotation.z = mainAngle;
    this.rightGear.scale.set(Math.max(0.01, this.gearProgress), Math.max(0.01, this.gearProgress), 1);
  }

  setThrottle(val) {
    this.throttle = Math.max(0, Math.min(1, val));
  }

  update(delta, altitude = 0) {
    // Strobe light flashing (double pulse every 1.2 seconds)
    this.strobeTimer = (this.strobeTimer + delta) % 1.2;
    const isFlashing = (this.strobeTimer > 0.05 && this.strobeTimer < 0.12) ||
                       (this.strobeTimer > 0.22 && this.strobeTimer < 0.29);

    if (isFlashing) {
      this.strobeMat.color.setHex(0xffffff);
      this.strobePointLight.intensity = 1.8;
    } else {
      this.strobeMat.color.setHex(0x333333);
      this.strobePointLight.intensity = 0;
    }

    // Dynamic thruster plumes based on throttle
    const flicker = 0.9 + Math.random() * 0.2;
    const currentThrottle = this.throttle;

    this.plumeMeshes.forEach((plumes) => {
      if (currentThrottle > 0.02) {
        plumes.inner.visible = true;
        plumes.outer.visible = true;

        const scaleZ = (0.3 + currentThrottle * 1.8) * flicker;
        const scaleXY = (0.4 + currentThrottle * 0.8) * flicker;

        plumes.inner.scale.set(scaleXY, scaleXY, scaleZ);
        plumes.inner.material.opacity = (0.35 + currentThrottle * 0.6) * flicker;

        plumes.outer.scale.set(scaleXY * 1.3, scaleXY * 1.3, scaleZ * 1.25);
        plumes.outer.material.opacity = (0.2 + currentThrottle * 0.5) * flicker;
      } else {
        // Subtle idle glow
        plumes.inner.visible = true;
        plumes.outer.visible = false;
        plumes.inner.scale.set(0.2, 0.2, 0.2);
        plumes.inner.material.opacity = 0.15;
      }
    });

    this.engineLights.forEach((light) => {
      light.intensity = (0.1 + currentThrottle * 3.5) * flicker;
    });

    // Landing spotlight adjusts intensity when near ground/pad
    if (this.landingSpotlight) {
      if (altitude < 18) {
        this.landingSpotlight.intensity = THREE.MathUtils.lerp(4.0, 1.2, altitude / 18);
      } else {
        this.landingSpotlight.intensity = 0.6;
      }
    }

    // Update exhaust particles
    if (this.particleSystem && this.particlePositions) {
      const positions = this.particlePositions;
      const lifetimes = this.particleLifetimes;
      const count = this.particleCount;

      for (let i = 0; i < count; i++) {
        lifetimes[i] += delta * (1.5 + currentThrottle * 2.5);

        if (lifetimes[i] >= 1.0) {
          // Reset particle to nozzle
          lifetimes[i] = 0;
          const nozzleX = Math.random() > 0.5 ? -0.48 : 0.48;
          positions[i * 3] = nozzleX + (Math.random() - 0.5) * 0.15;
          positions[i * 3 + 1] = 0.4 + (Math.random() - 0.5) * 0.15;
          positions[i * 3 + 2] = -2.2;
        } else {
          // Stream backward with spread
          const speed = (2.0 + currentThrottle * 9.0) * delta;
          positions[i * 3] += (Math.random() - 0.5) * 0.05;
          positions[i * 3 + 1] += (Math.random() - 0.5) * 0.05;
          positions[i * 3 + 2] -= speed;
        }
      }
      this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }
  }
}
