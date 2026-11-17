import * as THREE from 'three';

/**
 * High-visibility APEX-VII Lightweight Research Spaceship
 * Designed with bold silhouette, navigation strobes, and dynamic plasma thrusters.
 */
export class Spaceship {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Spaceship';
    
    // Thruster & Particle state
    this.thrustLevel = 0.15; // 0 to 1
    this.particles = [];
    this.vtolParticles = [];
    this.strobeTimer = 0;
    
    this.createModel();
    this.createThrusters();
    this.createParticleSystems();
  }

  createModel() {
    // Aerospace Materials
    this.materials = {
      hullWhite: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.28,
        metalness: 0.45,
        envMapIntensity: 1.2
      }),
      hullDark: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.35,
        metalness: 0.6
      }),
      accentOrange: new THREE.MeshStandardMaterial({
        color: 0xff6b00,
        roughness: 0.3,
        metalness: 0.2,
        emissive: 0xff3d00,
        emissiveIntensity: 0.25
      }),
      accentCyan: new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        roughness: 0.2,
        metalness: 0.1,
        emissive: 0x00d4ff,
        emissiveIntensity: 0.4
      }),
      cockpitGlass: new THREE.MeshPhysicalMaterial({
        color: 0x0a192f,
        roughness: 0.08,
        metalness: 0.1,
        transmission: 0.75,
        transparent: true,
        opacity: 0.88,
        ior: 1.52,
        reflectivity: 0.9,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
      }),
      engineMetal: new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.4,
        metalness: 0.85
      }),
      engineInterior: new THREE.MeshBasicMaterial({
        color: 0x38bdf8
      }),
      strobeRed: new THREE.MeshBasicMaterial({ color: 0xff0033 }),
      strobeGreen: new THREE.MeshBasicMaterial({ color: 0x00ff66 }),
      strobeWhite: new THREE.MeshBasicMaterial({ color: 0xffffff })
    };

    // 1. Fuselage Body
    const bodyGroup = new THREE.Group();
    
    // Main fuselage: streamlined faceted body
    const bodyGeo = new THREE.CylinderGeometry(0.55, 0.95, 3.4, 8, 1);
    bodyGeo.rotateX(Math.PI / 2);
    bodyGeo.scale(1.2, 0.65, 1.0);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.materials.hullWhite);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    bodyMesh.position.set(0, 0.55, 0);
    bodyGroup.add(bodyMesh);

    // Aerodynamic Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.66, 1.8, 8);
    noseGeo.rotateX(Math.PI / 2);
    noseGeo.scale(1.1, 0.55, 1.0);
    const noseMesh = new THREE.Mesh(noseGeo, this.materials.hullWhite);
    noseMesh.castShadow = true;
    noseMesh.position.set(0, 0.55, 2.5);
    bodyGroup.add(noseMesh);

    // Nose Sensor Probe & Striping
    const probeGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.6, 6);
    probeGeo.rotateX(Math.PI / 2);
    const probeMesh = new THREE.Mesh(probeGeo, this.materials.engineMetal);
    probeMesh.position.set(0, 0.55, 3.5);
    bodyGroup.add(probeMesh);

    // Top Spine Ridge
    const spineGeo = new THREE.BoxGeometry(0.35, 0.25, 2.8);
    const spineMesh = new THREE.Mesh(spineGeo, this.materials.hullDark);
    spineMesh.position.set(0, 0.9, -0.2);
    spineMesh.castShadow = true;
    bodyGroup.add(spineMesh);

    // High-visibility Racing / Mission Stripe
    const stripeGeo = new THREE.BoxGeometry(0.12, 0.05, 3.2);
    const stripeMesh = new THREE.Mesh(stripeGeo, this.materials.accentOrange);
    stripeMesh.position.set(0, 1.03, -0.2);
    bodyGroup.add(stripeMesh);

    // 2. Cockpit Canopy & Interior Glow
    const canopyGeo = new THREE.SphereGeometry(0.65, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    canopyGeo.scale(0.85, 0.7, 1.7);
    canopyGeo.rotateX(0.08);
    const canopyMesh = new THREE.Mesh(canopyGeo, this.materials.cockpitGlass);
    canopyMesh.position.set(0, 0.8, 0.7);
    bodyGroup.add(canopyMesh);

    // Cockpit interior console dash
    const consoleGeo = new THREE.BoxGeometry(0.5, 0.2, 0.4);
    const consoleMesh = new THREE.Mesh(consoleGeo, this.materials.accentCyan);
    consoleMesh.position.set(0, 0.7, 1.0);
    bodyGroup.add(consoleMesh);

    // 3. Main Wings & Winglets
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.4, -0.9);
    wingShape.lineTo(2.3, -1.6);
    wingShape.lineTo(0.3, -1.2);
    wingShape.lineTo(0, -0.8);
    wingShape.closePath();

    const wingExtrudeSettings = {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.03
    };

    const rightWingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
    rightWingGeo.rotateX(Math.PI / 2);
    rightWingGeo.rotateZ(Math.PI / 2);
    
    // Right Wing
    const rightWingMesh = new THREE.Mesh(rightWingGeo, this.materials.hullWhite);
    rightWingMesh.castShadow = true;
    rightWingMesh.receiveShadow = true;
    rightWingMesh.position.set(0.65, 0.52, 0.4);
    bodyGroup.add(rightWingMesh);

    // Left Wing (Mirrored)
    const leftWingGeo = rightWingGeo.clone();
    leftWingGeo.scale(-1, 1, 1);
    const leftWingMesh = new THREE.Mesh(leftWingGeo, this.materials.hullWhite);
    leftWingMesh.castShadow = true;
    leftWingMesh.receiveShadow = true;
    leftWingMesh.position.set(-0.65, 0.52, 0.4);
    bodyGroup.add(leftWingMesh);

    // Wing Leading Edge Trim (High Contrast Orange)
    const trimGeo = new THREE.BoxGeometry(0.12, 0.08, 1.8);
    trimGeo.rotateY(0.48);
    const rightTrim = new THREE.Mesh(trimGeo, this.materials.accentOrange);
    rightTrim.position.set(1.6, 0.54, -0.15);
    bodyGroup.add(rightTrim);

    const leftTrim = rightTrim.clone();
    leftTrim.rotation.y = -0.48;
    leftTrim.position.x = -1.6;
    bodyGroup.add(leftTrim);

    // Vertical Stabilizers / Winglets at wing tips
    const wingletGeo = new THREE.BoxGeometry(0.08, 0.75, 0.9);
    wingletGeo.rotateX(0.2);
    const rightWinglet = new THREE.Mesh(wingletGeo, this.materials.hullDark);
    rightWinglet.castShadow = true;
    rightWinglet.position.set(2.4, 0.78, -0.6);
    rightWinglet.rotation.z = -0.15; // canted
    bodyGroup.add(rightWinglet);

    const leftWinglet = rightWinglet.clone();
    leftWinglet.position.x = -2.4;
    leftWinglet.rotation.z = 0.15;
    bodyGroup.add(leftWinglet);

    // Central Dorsal Fin / Rudder
    const finGeo = new THREE.BoxGeometry(0.1, 1.1, 1.1);
    finGeo.rotateX(0.35);
    const finMesh = new THREE.Mesh(finGeo, this.materials.hullWhite);
    finMesh.castShadow = true;
    finMesh.position.set(0, 1.25, -1.1);
    bodyGroup.add(finMesh);

    // Fin Accent Cap
    const finCapGeo = new THREE.BoxGeometry(0.12, 0.16, 0.9);
    finCapGeo.rotateX(0.35);
    const finCapMesh = new THREE.Mesh(finCapGeo, this.materials.accentOrange);
    finCapMesh.position.set(0, 1.7, -1.25);
    bodyGroup.add(finCapMesh);

    // 4. Navigation Lights & Strobes
    // Red Light on Left Wingtip
    this.navRedLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), this.materials.strobeRed);
    this.navRedLight.position.set(-2.45, 1.1, -0.55);
    bodyGroup.add(this.navRedLight);

    // Green Light on Right Wingtip
    this.navGreenLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), this.materials.strobeGreen);
    this.navGreenLight.position.set(2.45, 1.1, -0.55);
    bodyGroup.add(this.navGreenLight);

    // White Anti-Collision Strobe on Dorsal Fin
    this.strobeWhiteLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), this.materials.strobeWhite);
    this.strobeWhiteLight.position.set(0, 1.82, -1.55);
    bodyGroup.add(this.strobeWhiteLight);

    // 5. Landing Gear Skids & Suspension Struts
    this.landingGearGroup = new THREE.Group();
    
    const skidGeo = new THREE.BoxGeometry(0.14, 0.08, 1.2);
    const strutGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.65, 8);
    
    // Front Nose Skid
    const frontGear = new THREE.Group();
    const frontSkid = new THREE.Mesh(skidGeo, this.materials.engineMetal);
    frontSkid.castShadow = true;
    frontSkid.position.set(0, 0.04, 0);
    const frontStrut = new THREE.Mesh(strutGeo, this.materials.engineMetal);
    frontStrut.position.set(0, 0.35, 0);
    frontStrut.castShadow = true;
    frontGear.add(frontSkid, frontStrut);
    frontGear.position.set(0, 0, 1.6);
    this.landingGearGroup.add(frontGear);

    // Rear Left Skid
    const leftGear = new THREE.Group();
    const leftSkid = frontSkid.clone();
    const leftStrut = frontStrut.clone();
    leftStrut.rotation.z = -0.25;
    leftGear.add(leftSkid, leftStrut);
    leftGear.position.set(-0.95, 0, -0.9);
    this.landingGearGroup.add(leftGear);

    // Rear Right Skid
    const rightGear = new THREE.Group();
    const rightSkid = frontSkid.clone();
    const rightStrut = frontStrut.clone();
    rightStrut.rotation.z = 0.25;
    rightGear.add(rightSkid, rightStrut);
    rightGear.position.set(0.95, 0, -0.9);
    this.landingGearGroup.add(rightGear);

    bodyGroup.add(this.landingGearGroup);

    // 6. VTOL Underside Thruster Nozzles (4 corner hover ports)
    const vtolPositions = [
      [-0.6, 0.25, 0.8],
      [0.6, 0.25, 0.8],
      [-0.7, 0.25, -0.7],
      [0.7, 0.25, -0.7]
    ];
    const vtolGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.12, 12);
    vtolPositions.forEach(pos => {
      const nozzle = new THREE.Mesh(vtolGeo, this.materials.engineMetal);
      nozzle.position.set(pos[0], pos[1], pos[2]);
      bodyGroup.add(nozzle);
    });

    this.group.add(bodyGroup);
  }

  createThrusters() {
    // Twin Main Rocket Engines
    this.engineGroup = new THREE.Group();
    this.engineGroup.position.set(0, 0.55, -1.7);

    const bellGeo = new THREE.CylinderGeometry(0.32, 0.22, 0.7, 16);
    bellGeo.rotateX(Math.PI / 2);

    // Left Engine Bell
    const leftBell = new THREE.Mesh(bellGeo, this.materials.engineMetal);
    leftBell.position.set(-0.46, 0, 0);
    leftBell.castShadow = true;
    this.engineGroup.add(leftBell);

    // Right Engine Bell
    const rightBell = leftBell.clone();
    rightBell.position.x = 0.46;
    this.engineGroup.add(rightBell);

    // Dual Plasma Flame Cones (Glowing layered meshes)
    const flameGeo = new THREE.ConeGeometry(0.28, 1.8, 16, 1, true);
    flameGeo.rotateX(-Math.PI / 2);
    flameGeo.translate(0, 0, -0.9);

    this.flameMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.innerFlameMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });

    // Left Flame
    this.leftFlame = new THREE.Mesh(flameGeo, this.flameMaterial);
    this.leftFlame.position.set(-0.46, 0, -0.35);
    this.engineGroup.add(this.leftFlame);

    // Right Flame
    this.rightFlame = new THREE.Mesh(flameGeo, this.flameMaterial);
    this.rightFlame.position.set(0.46, 0, -0.35);
    this.engineGroup.add(this.rightFlame);

    // Inner Core Flame Left & Right
    const innerCoreGeo = new THREE.ConeGeometry(0.14, 1.3, 12, 1, true);
    innerCoreGeo.rotateX(-Math.PI / 2);
    innerCoreGeo.translate(0, 0, -0.65);
    
    this.leftCore = new THREE.Mesh(innerCoreGeo, this.innerFlameMaterial);
    this.leftCore.position.set(-0.46, 0, -0.35);
    this.engineGroup.add(this.leftCore);

    this.rightCore = new THREE.Mesh(innerCoreGeo, this.innerFlameMaterial);
    this.rightCore.position.set(0.46, 0, -0.35);
    this.engineGroup.add(this.rightCore);

    // Dynamic Engine Light (casts blue glow on ship & pad)
    this.engineLight = new THREE.PointLight(0x00d4ff, 1.5, 12, 1.5);
    this.engineLight.position.set(0, 0, -1.2);
    this.engineGroup.add(this.engineLight);

    // VTOL Underside Hover Lights (casts down onto pad)
    this.vtolLight = new THREE.PointLight(0x38bdf8, 0.8, 14, 1.6);
    this.vtolLight.position.set(0, -0.2, 0);
    this.group.add(this.vtolLight);

    this.group.add(this.engineGroup);
  }

  createParticleSystems() {
    // 1. Trail Exhaust Particles
    this.maxParticles = 60;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(this.maxParticles * 3);
    const pColors = new Float32Array(this.maxParticles * 3);
    const pSizes = new Float32Array(this.maxParticles);

    for (let i = 0; i < this.maxParticles; i++) {
      pPositions[i * 3 + 0] = 0;
      pPositions[i * 3 + 1] = -1000;
      pPositions[i * 3 + 2] = 0;

      pColors[i * 3 + 0] = 0.0;
      pColors[i * 3 + 1] = 0.8;
      pColors[i * 3 + 2] = 1.0;

      pSizes[i] = 1.0;

      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        size: 1.0
      });
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
    pGeo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));

    // Custom point texture via canvas for nice soft glowing plume
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(0,240,255,0.8)');
    grad.addColorStop(0.7, 'rgba(0,100,255,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const pTex = new THREE.CanvasTexture(canvas);

    const pMat = new THREE.PointsMaterial({
      size: 0.6,
      map: pTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    this.particleMesh = new THREE.Points(pGeo, pMat);
    this.particleMesh.frustumCulled = false;
  }

  setThrust(norm, delta = 0.016) {
    this.thrustLevel = THREE.MathUtils.lerp(this.thrustLevel, norm, 0.15);

    // Scale engine flames
    const flameScale = 0.2 + this.thrustLevel * 1.6;
    const flameFlicker = 1.0 + (Math.random() - 0.5) * 0.15;
    
    this.leftFlame.scale.set(1.0, 1.0, flameScale * flameFlicker);
    this.rightFlame.scale.set(1.0, 1.0, flameScale * flameFlicker);
    this.leftCore.scale.set(1.0, 1.0, flameScale * 0.9 * flameFlicker);
    this.rightCore.scale.set(1.0, 1.0, flameScale * 0.9 * flameFlicker);

    // Adjust lighting
    this.engineLight.intensity = this.thrustLevel * 2.8;
    this.vtolLight.intensity = this.thrustLevel * 1.8;

    // Color shift based on throttle (deep cyan -> bright plasma orange at full thrust)
    if (this.thrustLevel > 0.8) {
      this.flameMaterial.color.setHex(0xff9900);
      this.engineLight.color.setHex(0xffaa22);
    } else {
      this.flameMaterial.color.setHex(0x00f0ff);
      this.engineLight.color.setHex(0x00d4ff);
    }
  }

  update(delta, worldPos, worldQuat, isFlying) {
    // 1. Navigation Lights Strobe Cycle
    this.strobeTimer += delta;
    if (this.strobeTimer > 1.2) this.strobeTimer = 0;
    
    // Quick double flash for white tail strobe
    const strobeActive = (this.strobeTimer < 0.08) || (this.strobeTimer > 0.16 && this.strobeTimer < 0.24);
    this.strobeWhiteLight.visible = strobeActive;

    // 2. Spawn Exhaust Particles when thrusting
    if (this.thrustLevel > 0.15 && Math.random() < this.thrustLevel * 0.9) {
      this.spawnParticle(worldPos, worldQuat);
    }

    // 3. Update Existing Particles
    const posAttr = this.particleMesh.geometry.attributes.position;
    const colorAttr = this.particleMesh.geometry.attributes.color;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        posAttr.setXYZ(i, 0, -1000, 0);
        continue;
      }

      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        posAttr.setXYZ(i, 0, -1000, 0);
        continue;
      }

      // Physics update
      p.pos.addScaledVector(p.vel, delta);
      p.vel.y += delta * 0.4; // slight thermal updraft
      posAttr.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);

      const lifeRatio = 1.0 - (p.life / p.maxLife);
      colorAttr.setXYZ(i, 0.1 * lifeRatio, 0.7 * lifeRatio, 1.0 * lifeRatio);
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  spawnParticle(worldPos, worldQuat) {
    const p = this.particles.find(pt => !pt.active);
    if (!p) return;

    p.active = true;
    p.life = 0;
    p.maxLife = 0.5 + Math.random() * 0.4;

    // Emitter offset behind twin engines
    const side = Math.random() > 0.5 ? 0.46 : -0.46;
    const localOffset = new THREE.Vector3(side, 0.55, -2.1);
    localOffset.applyQuaternion(worldQuat);

    p.pos.copy(worldPos).add(localOffset);

    // Velocity back along ship's reverse direction with random plume spread
    const backward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
    const spread = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8
    );

    p.vel.copy(backward).multiplyScalar(8 + this.thrustLevel * 14).add(spread);
  }

  // Camera Mount Points
  getCockpitWorldPosition(targetVec) {
    const local = new THREE.Vector3(0, 0.95, 0.9);
    this.group.localToWorld(local);
    targetVec.copy(local);
  }

  getChaseCameraMount(targetVec, distance = 8.5, height = 2.8) {
    const local = new THREE.Vector3(0, height, -distance);
    this.group.localToWorld(local);
    targetVec.copy(local);
  }
}
