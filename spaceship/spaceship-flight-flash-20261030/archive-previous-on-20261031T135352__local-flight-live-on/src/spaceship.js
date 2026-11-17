import * as THREE from 'three';

export class Spaceship {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Spaceship';

    // State
    this.throttle = 0; // 0 to 1
    this.vtolPower = 0; // 0 to 1
    this.gearExtension = 1; // 1 = fully deployed, 0 = retracted
    this.targetGearExtension = 1;
    this.gearSpeed = 1.8; // per second

    // Animation timers
    this.clock = 0;

    // Materials
    this.initMaterials();

    // Build Model Components
    this.buildHull();
    this.buildWings();
    this.buildEngines();
    this.buildCockpit();
    this.buildLandingGear();
    this.buildNavLights();
    this.buildThrusterEffects();
    this.buildDustParticles();

    // Shadows
    this.group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Resting pad height offset
    // When gear is fully extended, the lowest point of footpads is at Y = 0 relative to group
    // In our model, let footpad contact be at Y = 0, so group position Y is height above pad
    this.padRestY = 0;
  }

  initMaterials() {
    // Primary white aerospace composite
    this.matHullPrimary = new THREE.MeshStandardMaterial({
      color: 0xefefef,
      roughness: 0.28,
      metalness: 0.35,
    });

    // Secondary cobalt blue / vibrant accents
    this.matAccentBlue = new THREE.MeshStandardMaterial({
      color: 0x0077ff,
      roughness: 0.3,
      metalness: 0.6,
    });

    // Warm high-visibility aerospace orange warning stripes
    this.matAccentOrange = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      roughness: 0.35,
      metalness: 0.2,
    });

    // Dark titanium / heat-shield underbelly
    this.matDarkTitanium = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      roughness: 0.5,
      metalness: 0.8,
    });

    // Cockpit canopy glass
    this.matCanopy = new THREE.MeshPhysicalMaterial({
      color: 0x112233,
      metalness: 0.9,
      roughness: 0.1,
      transmission: 0.4,
      transparent: true,
      opacity: 0.92,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });

    // Engine nozzle metal
    this.matNozzle = new THREE.MeshStandardMaterial({
      color: 0x1a1c20,
      roughness: 0.4,
      metalness: 0.9,
    });

    // Engine glowing interior
    this.matEngineGlow = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
    });

    // Thruster plasma flame
    this.matThrusterFlame = new THREE.MeshBasicMaterial({
      color: 0x38b6ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.matThrusterCore = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
  }

  buildHull() {
    this.hullGroup = new THREE.Group();
    this.group.add(this.hullGroup);

    // Main fuselage - streamlined wedge shape
    // Forward direction is +Z (nose points toward +Z)
    const bodyLength = 5.2;
    const bodyGeom = new THREE.ConeGeometry(1.0, bodyLength, 8);
    // Rotate cone so apex points along +Z
    bodyGeom.rotateX(Math.PI / 2);
    bodyGeom.scale(1.2, 0.75, 1.0);
    const bodyMesh = new THREE.Mesh(bodyGeom, this.matHullPrimary);
    bodyMesh.position.set(0, 0.95, 0.2);
    this.hullGroup.add(bodyMesh);

    // Lower titanium belly heat shield
    const bellyGeom = new THREE.BoxGeometry(1.6, 0.35, 3.4);
    const bellyMesh = new THREE.Mesh(bellyGeom, this.matDarkTitanium);
    bellyMesh.position.set(0, 0.62, -0.2);
    this.hullGroup.add(bellyMesh);

    // Upper spine ridge
    const spineGeom = new THREE.BoxGeometry(0.35, 0.3, 3.2);
    const spineMesh = new THREE.Mesh(spineGeom, this.matAccentBlue);
    spineMesh.position.set(0, 1.35, -0.4);
    this.hullGroup.add(spineMesh);

    // Nose pitot / antenna
    const probeGeom = new THREE.CylinderGeometry(0.02, 0.04, 0.8, 8);
    probeGeom.rotateX(Math.PI / 2);
    const probeMesh = new THREE.Mesh(probeGeom, this.matDarkTitanium);
    probeMesh.position.set(0, 0.85, 2.9);
    this.hullGroup.add(probeMesh);

    // Hazard stripes / decals on side
    const stripeGeom = new THREE.BoxGeometry(0.04, 0.2, 1.2);
    const leftStripe = new THREE.Mesh(stripeGeom, this.matAccentOrange);
    leftStripe.position.set(-0.82, 0.9, -0.3);
    const rightStripe = new THREE.Mesh(stripeGeom, this.matAccentOrange);
    rightStripe.position.set(0.82, 0.9, -0.3);
    this.hullGroup.add(leftStripe, rightStripe);
  }

  buildWings() {
    // Left & Right swept wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.4, -1.2); // tip trailing edge
    wingShape.lineTo(2.3, -0.7); // tip leading edge
    wingShape.lineTo(0.5, 0.9);  // root leading edge
    wingShape.closePath();

    const extrudeSettings = {
      depth: 0.1,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    };

    const wingGeom = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeom.rotateX(Math.PI / 2); // lie horizontal in X-Z plane

    // Right Wing
    const rightWing = new THREE.Mesh(wingGeom, this.matHullPrimary);
    rightWing.position.set(0.5, 0.85, -0.3);
    this.hullGroup.add(rightWing);

    // Left Wing (mirrored scale)
    const leftWingGeom = wingGeom.clone();
    leftWingGeom.scale(-1, 1, 1);
    const leftWing = new THREE.Mesh(leftWingGeom, this.matHullPrimary);
    leftWing.position.set(-0.5, 0.85, -0.3);
    this.hullGroup.add(leftWing);

    // Winglets (angled vertical fins at wingtips)
    const wingletGeom = new THREE.BoxGeometry(0.06, 0.65, 0.7);
    const rightWinglet = new THREE.Mesh(wingletGeom, this.matAccentBlue);
    rightWinglet.position.set(2.8, 1.05, -1.2);
    rightWinglet.rotation.z = -0.2; // slight outward cant

    const leftWinglet = new THREE.Mesh(wingletGeom, this.matAccentBlue);
    leftWinglet.position.set(-2.8, 1.05, -1.2);
    leftWinglet.rotation.z = 0.2;
    this.hullGroup.add(rightWinglet, leftWinglet);

    // Twin vertical stabilizers (Tail fins)
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(0.8, 0);
    tailShape.lineTo(0.4, 1.1);
    tailShape.lineTo(0.0, 1.0);
    tailShape.closePath();

    const tailGeom = new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });

    const leftTail = new THREE.Mesh(tailGeom, this.matHullPrimary);
    leftTail.position.set(-0.6, 1.1, -1.6);
    leftTail.rotation.y = -Math.PI / 2;
    leftTail.rotation.z = -0.15; // canted outwards

    const rightTail = new THREE.Mesh(tailGeom, this.matHullPrimary);
    rightTail.position.set(0.6, 1.1, -1.6);
    rightTail.rotation.y = -Math.PI / 2;
    rightTail.rotation.z = 0.15;
    this.hullGroup.add(leftTail, rightTail);
  }

  buildCockpit() {
    // Aerodynamic cockpit canopy bubble
    const canopyGeom = new THREE.SphereGeometry(0.65, 16, 12);
    canopyGeom.scale(0.85, 0.65, 1.6);
    const canopy = new THREE.Mesh(canopyGeom, this.matCanopy);
    canopy.position.set(0, 1.25, 0.7);
    this.hullGroup.add(canopy);

    // Cockpit interior console glow
    const consoleGeom = new THREE.BoxGeometry(0.4, 0.2, 0.3);
    const matConsoleGlow = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const consoleMesh = new THREE.Mesh(consoleGeom, matConsoleGlow);
    consoleMesh.position.set(0, 1.1, 0.9);
    this.hullGroup.add(consoleMesh);

    // Pilot helmet / headrest hint
    const pilotGeom = new THREE.SphereGeometry(0.14, 8, 8);
    const matPilot = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.4 });
    const pilotMesh = new THREE.Mesh(pilotGeom, matPilot);
    pilotMesh.position.set(0, 1.2, 0.5);
    this.hullGroup.add(pilotMesh);
  }

  buildEngines() {
    this.engineGroup = new THREE.Group();
    this.hullGroup.add(this.engineGroup);

    // Twin nacelles
    const nacelleGeom = new THREE.CylinderGeometry(0.42, 0.48, 1.8, 16);
    nacelleGeom.rotateX(Math.PI / 2);

    const leftNacelle = new THREE.Mesh(nacelleGeom, this.matDarkTitanium);
    leftNacelle.position.set(-0.75, 0.9, -1.4);

    const rightNacelle = new THREE.Mesh(nacelleGeom, this.matDarkTitanium);
    rightNacelle.position.set(0.75, 0.9, -1.4);
    this.engineGroup.add(leftNacelle, rightNacelle);

    // Exhaust Nozzle Bells
    const nozzleGeom = new THREE.CylinderGeometry(0.38, 0.44, 0.45, 16, 1, true);
    nozzleGeom.rotateX(Math.PI / 2);

    const leftNozzle = new THREE.Mesh(nozzleGeom, this.matNozzle);
    leftNozzle.position.set(-0.75, 0.9, -2.4);

    const rightNozzle = new THREE.Mesh(nozzleGeom, this.matNozzle);
    rightNozzle.position.set(0.75, 0.9, -2.4);
    this.engineGroup.add(leftNozzle, rightNozzle);

    // Nozzle interior glow disks
    const diskGeom = new THREE.CircleGeometry(0.34, 16);
    const leftDisk = new THREE.Mesh(diskGeom, this.matEngineGlow);
    leftDisk.position.set(-0.75, 0.9, -2.35);

    const rightDisk = new THREE.Mesh(diskGeom, this.matEngineGlow);
    rightDisk.position.set(0.75, 0.9, -2.35);
    this.engineGroup.add(leftDisk, rightDisk);

    // 4 Underbody VTOL lift nozzles
    const vtolGeom = new THREE.CylinderGeometry(0.18, 0.22, 0.12, 12);
    const vtolPositions = [
      [-0.6, 0.48, 0.8],
      [0.6, 0.48, 0.8],
      [-0.6, 0.48, -0.8],
      [0.6, 0.48, -0.8],
    ];

    this.vtolJets = [];
    vtolPositions.forEach(([x, y, z]) => {
      const vtolMesh = new THREE.Mesh(vtolGeom, this.matNozzle);
      vtolMesh.position.set(x, y, z);
      this.hullGroup.add(vtolMesh);

      // Downward VTOL plume cone
      const jetGeom = new THREE.ConeGeometry(0.18, 0.7, 8);
      jetGeom.rotateX(Math.PI); // apex pointing down (-Y)
      jetGeom.translate(0, -0.35, 0);
      const jetMesh = new THREE.Mesh(jetGeom, this.matThrusterFlame.clone());
      jetMesh.position.set(x, y - 0.06, z);
      jetMesh.scale.set(0.001, 0.001, 0.001);
      this.hullGroup.add(jetMesh);
      this.vtolJets.push(jetMesh);
    });
  }

  buildThrusterEffects() {
    this.exhaustGroup = new THREE.Group();
    this.group.add(this.exhaustGroup);

    // Main rear engine flames
    const flameGeom = new THREE.ConeGeometry(0.36, 2.4, 16);
    flameGeom.rotateX(-Math.PI / 2); // points backward along -Z
    flameGeom.translate(0, 0, -1.2);

    this.leftFlame = new THREE.Mesh(flameGeom, this.matThrusterFlame);
    this.leftFlame.position.set(-0.75, 0.9, -2.5);

    this.rightFlame = new THREE.Mesh(flameGeom, this.matThrusterFlame);
    this.rightFlame.position.set(0.75, 0.9, -2.5);

    // Core white-hot inner cones
    const coreGeom = new THREE.ConeGeometry(0.18, 1.4, 12);
    coreGeom.rotateX(-Math.PI / 2);
    coreGeom.translate(0, 0, -0.7);

    this.leftCore = new THREE.Mesh(coreGeom, this.matThrusterCore);
    this.leftFlame.add(this.leftCore);

    this.rightCore = new THREE.Mesh(coreGeom, this.matThrusterCore);
    this.rightFlame.add(this.rightCore);

    this.exhaustGroup.add(this.leftFlame, this.rightFlame);

    // Dynamic thruster point light illuminating behind the ship
    this.thrusterLight = new THREE.PointLight(0x00d4ff, 0, 15, 1.5);
    this.thrusterLight.position.set(0, 0.9, -3.2);
    this.exhaustGroup.add(this.thrusterLight);

    // Set initial scale to tiny idle
    this.setThrusterScale(0);
  }

  buildLandingGear() {
    this.gearGroup = new THREE.Group();
    this.group.add(this.gearGroup);

    // 3 Gear Assemblies: 1 Nose gear, 2 Main gear (left/right)
    this.gearAssemblies = [];

    // Common strut material
    const matStrut = new THREE.MeshStandardMaterial({
      color: 0x8892a0,
      metalness: 0.85,
      roughness: 0.25,
    });
    const matFootpad = new THREE.MeshStandardMaterial({
      color: 0x222226,
      metalness: 0.9,
      roughness: 0.4,
    });

    const createGear = (x, z, isFront = false) => {
      const assembly = new THREE.Group();
      assembly.position.set(x, 0.6, z); // Pivot point at hull belly

      // Upper leg (rotates upward when retracted)
      const legGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
      legGeom.translate(0, -0.3, 0);
      const leg = new THREE.Mesh(legGeom, matStrut);
      assembly.add(leg);

      // Telescoping piston
      const pistonGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8);
      pistonGeom.translate(0, -0.45, 0);
      const piston = new THREE.Mesh(pistonGeom, matStrut);
      assembly.add(piston);

      // Footpad / wheel skid
      const footpadGeom = new THREE.CylinderGeometry(0.2, 0.24, 0.06, 12);
      const footpad = new THREE.Mesh(footpadGeom, matFootpad);
      footpad.position.set(0, -0.6, 0);
      assembly.add(footpad);

      this.gearGroup.add(assembly);
      return {
        pivot: assembly,
        isFront,
        restY: 0.6,
        retractRotX: isFront ? -Math.PI / 2.2 : Math.PI / 2.2,
      };
    };

    // Front Nose Gear at Z = 1.6
    this.gearAssemblies.push(createGear(0, 1.6, true));
    // Main Rear Left Gear at X = -0.9, Z = -0.8
    this.gearAssemblies.push(createGear(-0.9, -0.8, false));
    // Main Rear Right Gear at X = 0.9, Z = -0.8
    this.gearAssemblies.push(createGear(0.9, -0.8, false));
  }

  buildNavLights() {
    this.navLightGroup = new THREE.Group();
    this.group.add(this.navLightGroup);

    // Left Wingtip Red Nav Light
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
    const redLightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), redMat);
    redLightMesh.position.set(-2.82, 1.05, -1.2);

    // Right Wingtip Green Nav Light
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const greenLightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), greenMat);
    greenLightMesh.position.set(2.82, 1.05, -1.2);

    // Tail White Strobe
    this.strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const strobeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), this.strobeMat);
    strobeMesh.position.set(0, 1.45, -2.1);

    this.navLightGroup.add(redLightMesh, greenLightMesh, strobeMesh);
  }

  buildDustParticles() {
    // Ring of dust particles emitted under ship near ground
    const count = 70;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const alphas = new Float32Array(count);

    this.dustData = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      scales[i] = 1.0;
      alphas[i] = 0.0;

      this.dustData.push({
        active: false,
        age: 0,
        maxAge: 0.8 + Math.random() * 0.7,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0.4 + Math.random() * 0.6,
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    // Custom dust particle shader material
    this.dustMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xd9c5a0) }, // warm sandy dust
      },
      vertexShader: `
        attribute float scale;
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = scale * (220.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;
          float soften = smoothstep(0.5, 0.1, dist);
          gl_FragColor = vec4(color, vAlpha * soften * 0.45);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.dustPoints = new THREE.Points(geometry, this.dustMaterial);
    // Dust is added to world/scene root in main, or kept at group position
    this.dustPoints.frustumCulled = false;
  }

  setLandingGear(targetState) {
    // 1 = down, 0 = retracted
    this.targetGearExtension = targetState ? 1 : 0;
  }

  setThrusterScale(throttle) {
    this.throttle = THREE.MathUtils.clamp(throttle, 0, 1);

    // Animate rear flames
    const scaleZ = 0.1 + this.throttle * 1.4;
    const scaleXY = 0.15 + this.throttle * 0.95;

    this.leftFlame.scale.set(scaleXY, scaleXY, scaleZ);
    this.rightFlame.scale.set(scaleXY, scaleXY, scaleZ);

    this.matThrusterFlame.opacity = 0.3 + this.throttle * 0.65;
    this.thrusterLight.intensity = this.throttle * 3.5;
  }

  setVtolPower(power) {
    this.vtolPower = THREE.MathUtils.clamp(power, 0, 1);
    this.vtolJets.forEach((jet) => {
      const s = this.vtolPower;
      jet.scale.set(s, s * 1.8, s);
      jet.material.opacity = s * 0.85;
    });
  }

  update(delta, altitude = 0) {
    this.clock += delta;

    // Smooth landing gear animation
    if (this.gearExtension !== this.targetGearExtension) {
      const step = this.gearSpeed * delta;
      if (this.gearExtension < this.targetGearExtension) {
        this.gearExtension = Math.min(this.targetGearExtension, this.gearExtension + step);
      } else {
        this.gearExtension = Math.max(this.targetGearExtension, this.gearExtension - step);
      }

      // Apply rotation to gear assemblies
      const t = this.gearExtension; // 1 = down (rot=0), 0 = up (rot=retractRotX)
      this.gearAssemblies.forEach((gear) => {
        gear.pivot.rotation.x = gear.retractRotX * (1 - t);
        // Slight scale shrink into wheel bay when retracted
        const bayScale = 0.1 + 0.9 * t;
        gear.pivot.scale.set(1, bayScale, 1);
      });
    }

    // Wingtip strobe blink (every 1.2s, 80ms flash)
    const strobeCycle = this.clock % 1.2;
    this.strobeMat.color.setHex(strobeCycle < 0.08 ? 0xffffff : 0x333333);

    // Thruster flicker effect
    if (this.throttle > 0.05) {
      const flicker = 1.0 + Math.sin(this.clock * 45) * 0.08 + Math.cos(this.clock * 70) * 0.05;
      this.leftFlame.scale.z *= flicker;
      this.rightFlame.scale.z *= flicker;
      this.thrusterLight.intensity = this.throttle * 3.5 * flicker;
    }

    // Update ground dust particles when close to pad/ground
    this.updateDustParticles(delta, altitude);
  }

  updateDustParticles(delta, altitude) {
    const posAttr = this.dustPoints.geometry.attributes.position;
    const scaleAttr = this.dustPoints.geometry.attributes.scale;
    const alphaAttr = this.dustPoints.geometry.attributes.alpha;

    const emitDust = (this.vtolPower > 0.15 || this.throttle > 0.3) && altitude < 14;
    const emitRate = emitDust ? Math.floor(delta * 45 * (1 - altitude / 14)) : 0;
    let spawned = 0;

    for (let i = 0; i < this.dustData.length; i++) {
      const p = this.dustData[i];

      if (!p.active) {
        if (spawned < emitRate) {
          spawned++;
          p.active = true;
          p.age = 0;
          // Spawn at ground level directly under the ship
          const angle = Math.random() * Math.PI * 2;
          const radius = 0.5 + Math.random() * 1.5;
          const shipPos = this.group.position;

          posAttr.setXYZ(i, shipPos.x + Math.cos(angle) * radius, 0.08, shipPos.z + Math.sin(angle) * radius);

          // Velocity radiating outward along ground
          const speed = (2.5 + Math.random() * 4.5) * (1 - altitude / 15);
          p.vx = Math.cos(angle) * speed;
          p.vy = 0.2 + Math.random() * 0.5;
          p.vz = Math.sin(angle) * speed;

          scaleAttr.setX(i, p.size);
          alphaAttr.setX(i, 0.6);
        }
      } else {
        p.age += delta;
        if (p.age >= p.maxAge) {
          p.active = false;
          alphaAttr.setX(i, 0);
        } else {
          const curX = posAttr.getX(i) + p.vx * delta;
          const curY = posAttr.getY(i) + p.vy * delta;
          const curZ = posAttr.getZ(i) + p.vz * delta;

          p.vy *= 0.92;
          p.vx *= 0.95;
          p.vz *= 0.95;

          posAttr.setXYZ(i, curX, curY, curZ);

          const lifeProgress = p.age / p.maxAge;
          scaleAttr.setX(i, p.size * (1 + lifeProgress * 2.5));
          alphaAttr.setX(i, 0.6 * (1 - lifeProgress));
        }
      }
    }

    posAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  }
}
