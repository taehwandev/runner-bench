import * as THREE from 'three';

/**
 * Well-lit daytime environment featuring:
 * - Elevated octagonal landing pad with runway approach markings and perimeter LEDs
 * - Surrounding spaceport facility (control tower, hangar, radar dish, rovers)
 * - Navigation beacon towers along the flight circuit path
 * - Rolling terrain, coastal water, mountains, and stylized clouds
 * - Procedural holographic flight trajectory ribbon
 */
export class Environment {
  constructor(scene, circuitPoints) {
    this.scene = scene;
    this.circuitPoints = circuitPoints;
    this.animatedObjects = [];
    this.beaconLights = [];
    this.radarDish = null;
    this.pathRibbon = null;

    this.createSkyAndLighting();
    this.createLandingPad();
    this.createSpaceportBuildings();
    this.createTerrainAndNature();
    this.createWaypointBeacons();
    this.createFlightPathVisualizer();
  }

  createSkyAndLighting() {
    // 1. Hemisphere Ambient Sky Fill (avoids harsh pitch-black shadows)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x86efac, 0.75);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // 2. Direct Bright Daytime Sun
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.45);
    this.sunLight.position.set(65, 95, 45);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 300;
    
    const d = 55;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);

    // 3. Sun Disc & Atmospheric Sky Dome
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x1e60b8) },     // Deep vibrant daytime blue
        midColor: { value: new THREE.Color(0x60a5fa) },     // Sky cyan
        bottomColor: { value: new THREE.Color(0xdbeafe) },  // Soft horizon haze
        sunPosition: { value: this.sunLight.position.clone().normalize() }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        uniform vec3 sunPosition;
        varying vec3 vWorldPosition;

        void main() {
          vec3 nPos = normalize(vWorldPosition);
          float h = clamp(nPos.y * 1.5, 0.0, 1.0);
          vec3 skyGrad = mix(bottomColor, mix(midColor, topColor, pow(h, 0.7)), h);

          // Soft sun disc & glow
          float sunDot = max(dot(nPos, sunPosition), 0.0);
          float sunGlow = pow(sunDot, 64.0) * 1.2 + pow(sunDot, 6.0) * 0.25;
          vec3 finalColor = skyGrad + vec3(1.0, 0.95, 0.8) * sunGlow;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyDome);

    // 4. Stylized Low-Poly Cumulus Clouds
    this.cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true
    });

    for (let c = 0; c < 24; c++) {
      const cloud = new THREE.Group();
      const numPuffs = 4 + Math.floor(Math.random() * 4);
      for (let p = 0; p < numPuffs; p++) {
        const puffRadius = 5 + Math.random() * 6;
        const puffGeo = new THREE.DodecahedronGeometry(puffRadius, 1);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 12
        );
        cloud.add(puff);
      }
      
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 180;
      const height = 48 + Math.random() * 35;
      cloud.position.set(Math.cos(angle) * dist, height, Math.sin(angle) * dist);
      this.cloudsGroup.add(cloud);
    }
    this.scene.add(this.cloudsGroup);
  }

  createLandingPad() {
    this.padGroup = new THREE.Group();
    this.padGroup.name = 'LandingPad';
    this.padHeight = 1.0;

    // 1. Reinforced Octagonal Base Plinth
    const padRadius = 9.5;
    const baseGeo = new THREE.CylinderGeometry(padRadius, padRadius + 0.8, this.padHeight, 8);
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      metalness: 0.25
    });
    const baseMesh = new THREE.Mesh(baseGeo, concreteMat);
    baseMesh.position.y = this.padHeight / 2;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    this.padGroup.add(baseMesh);

    // 2. Beveled Metallic Rim Deck
    const deckGeo = new THREE.CylinderGeometry(padRadius - 0.1, padRadius - 0.1, 0.15, 8);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.6
    });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.y = this.padHeight + 0.08;
    deckMesh.receiveShadow = true;
    this.padGroup.add(deckMesh);

    // 3. High-Contrast Approach Markings via Procedural Canvas Texture
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Background dark non-slip carbon coating
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1024, 1024);

    // Outer hazard chevron ring (Yellow & Black stripes)
    const cx = 512, cy = 512;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 460, 0, Math.PI * 2);
    ctx.lineWidth = 36;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    // Inner landing circle
    ctx.beginPath();
    ctx.arc(cx, cy, 340, 0, Math.PI * 2);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Target crosshair guides
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.moveTo(cx - 380, cy); ctx.lineTo(cx - 240, cy);
    ctx.moveTo(cx + 240, cy); ctx.lineTo(cx + 380, cy);
    ctx.moveTo(cx, cy - 380); ctx.lineTo(cx, cy - 240);
    ctx.moveTo(cx, cy + 240); ctx.lineTo(cx, cy + 380);
    ctx.stroke();

    // Central Bold "H" Landing Mark
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 220px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 240, 255, 0.7)';
    ctx.shadowBlur = 24;
    ctx.fillText('H', cx, cy - 8);

    // Pad ID Text
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('PAD-01 // APEX-VII', cx, cy + 180);
    ctx.restore();

    const padTex = new THREE.CanvasTexture(canvas);
    padTex.anisotropy = 8;
    const decalMat = new THREE.MeshStandardMaterial({
      map: padTex,
      roughness: 0.5,
      metalness: 0.4
    });
    const markGeo = new THREE.PlaneGeometry(padRadius * 1.8, padRadius * 1.8);
    markGeo.rotateX(-Math.PI / 2);
    const markMesh = new THREE.Mesh(markGeo, decalMat);
    markMesh.position.y = this.padHeight + 0.17;
    markMesh.receiveShadow = true;
    this.padGroup.add(markMesh);

    // 4. Perimeter Runway LED Beacon Lights
    this.padLeds = [];
    const ledMatOn = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const ledMatAlt = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const ledGeo = new THREE.SphereGeometry(0.12, 8, 8);

    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const lx = Math.cos(angle) * (padRadius - 0.35);
      const lz = Math.sin(angle) * (padRadius - 0.35);
      
      const led = new THREE.Mesh(ledGeo, i % 2 === 0 ? ledMatOn : ledMatAlt);
      led.position.set(lx, this.padHeight + 0.22, lz);
      this.padGroup.add(led);
      this.padLeds.push(led);

      // Mini mounting base
      const mountGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.18, 6);
      const mount = new THREE.Mesh(mountGeo, concreteMat);
      mount.position.set(lx, this.padHeight + 0.1, lz);
      this.padGroup.add(mount);
    }

    // 5. Blast Deflector Grills around the pad rim
    for (let g = 0; g < 8; g++) {
      const angle = (g / 8) * Math.PI * 2;
      const gx = Math.cos(angle) * (padRadius + 0.4);
      const gz = Math.sin(angle) * (padRadius + 0.4);

      const grillGeo = new THREE.BoxGeometry(2.4, 0.5, 0.4);
      const grillMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.6,
        metalness: 0.8
      });
      const grill = new THREE.Mesh(grillGeo, grillMat);
      grill.position.set(gx, 0.35, gz);
      grill.rotation.y = angle + Math.PI / 2;
      grill.castShadow = true;
      this.padGroup.add(grill);
    }

    // 6. Fuel & Power Conduit Lines to Pad
    const conduitGeo = new THREE.CylinderGeometry(0.1, 0.1, 8.0, 8);
    conduitGeo.rotateZ(Math.PI / 2);
    const conduitMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
    const conduit = new THREE.Mesh(conduitGeo, conduitMat);
    conduit.position.set(padRadius + 3.8, 0.2, 0);
    this.padGroup.add(conduit);

    this.scene.add(this.padGroup);
  }

  createSpaceportBuildings() {
    this.baseGroup = new THREE.Group();

    // 1. Control & Observation Tower (Overlooking the pad)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(18, 0, -14);

    // Tower Column
    const colGeo = new THREE.CylinderGeometry(1.6, 2.4, 16, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.2 });
    const col = new THREE.Mesh(colGeo, towerMat);
    col.position.y = 8;
    col.castShadow = true;
    col.receiveShadow = true;
    towerGroup.add(col);

    // Observation Deck Glass Ring
    const obsGeo = new THREE.CylinderGeometry(3.6, 3.2, 3.2, 12);
    const obsMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.3,
      transmission: 0.6,
      transparent: true,
      opacity: 0.85
    });
    const obsDeck = new THREE.Mesh(obsGeo, obsMat);
    obsDeck.position.y = 16.5;
    obsDeck.castShadow = true;
    towerGroup.add(obsDeck);

    // Tower Roof & Antenna Mast
    const roofGeo = new THREE.ConeGeometry(3.8, 1.2, 12);
    const roof = new THREE.Mesh(roofGeo, towerMat);
    roof.position.y = 18.7;
    towerGroup.add(roof);

    // Mast
    const mastGeo = new THREE.CylinderGeometry(0.1, 0.18, 8, 8);
    const mast = new THREE.Mesh(mastGeo, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 }));
    mast.position.y = 23;
    towerGroup.add(mast);

    // Mast Beacon Light (pulsing red)
    const mastBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0044 })
    );
    mastBeacon.position.y = 27.2;
    towerGroup.add(mastBeacon);
    this.beaconLights.push(mastBeacon);

    // Rotating Radar Dish atop Tower
    const radarGroup = new THREE.Group();
    radarGroup.position.set(0, 19.5, 1.5);
    const dishGeo = new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 3);
    dishGeo.rotateX(Math.PI / 2);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide });
    this.radarDish = new THREE.Mesh(dishGeo, dishMat);
    this.radarDish.rotation.x = -0.3;
    radarGroup.add(this.radarDish);
    towerGroup.add(radarGroup);

    this.baseGroup.add(towerGroup);

    // 2. Flight Hangar Building
    const hangarGroup = new THREE.Group();
    hangarGroup.position.set(-24, 0, -18);

    // Curved Barrel Arch Hangar
    const archShape = new THREE.Shape();
    archShape.absarc(0, 0, 8, 0, Math.PI, false);
    archShape.lineTo(-8, 0);

    const hangarGeo = new THREE.CylinderGeometry(8, 8, 22, 24, 1, false, 0, Math.PI);
    hangarGeo.rotateZ(Math.PI / 2);
    const hangarMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.5,
      metalness: 0.65
    });
    const hangar = new THREE.Mesh(hangarGeo, hangarMat);
    hangar.position.set(0, 0, 0);
    hangar.castShadow = true;
    hangar.receiveShadow = true;
    hangarGroup.add(hangar);

    // Hangar Door Frame
    const doorFrameGeo = new THREE.BoxGeometry(0.8, 7.5, 15);
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const doorFrame = new THREE.Mesh(doorFrameGeo, doorFrameMat);
    doorFrame.position.set(11, 3.75, 0);
    doorFrame.castShadow = true;
    hangarGroup.add(doorFrame);

    this.baseGroup.add(hangarGroup);

    // 3. Solar Panel Tracking Arrays
    for (let s = 0; s < 4; s++) {
      const solarGroup = new THREE.Group();
      solarGroup.position.set(26 + s * 5, 0, 8 + s * 4);

      const standGeo = new THREE.CylinderGeometry(0.12, 0.16, 2.2, 8);
      const stand = new THREE.Mesh(standGeo, towerMat);
      stand.position.y = 1.1;
      stand.castShadow = true;
      solarGroup.add(stand);

      const panelGeo = new THREE.BoxGeometry(3.6, 0.1, 2.2);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x1e3a8a,
        roughness: 0.15,
        metalness: 0.8
      });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.y = 2.2;
      panel.rotation.x = 0.5; // Angled toward sun
      panel.rotation.y = -0.4;
      panel.castShadow = true;
      solarGroup.add(panel);

      this.baseGroup.add(solarGroup);
    }

    // 4. Ground Service Rovers parked near the pad
    const roverGroup = new THREE.Group();
    roverGroup.position.set(12, 0, 10);
    roverGroup.rotation.y = -0.7;

    const roverBodyGeo = new THREE.BoxGeometry(1.6, 0.8, 2.6);
    const roverMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
    const roverBody = new THREE.Mesh(roverBodyGeo, roverMat);
    roverBody.position.y = 0.8;
    roverBody.castShadow = true;
    roverGroup.add(roverBody);

    // Rover Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const wheelPositions = [
      [-0.95, 0.4, 0.9],
      [0.95, 0.4, 0.9],
      [-0.95, 0.4, -0.9],
      [0.95, 0.4, -0.9]
    ];
    wheelPositions.forEach(wp => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wp[0], wp[1], wp[2]);
      roverGroup.add(wheel);
    });

    this.baseGroup.add(roverGroup);
    this.scene.add(this.baseGroup);
  }

  createTerrainAndNature() {
    this.terrainGroup = new THREE.Group();

    // 1. Main Base Ground Plane
    const groundGeo = new THREE.PlaneGeometry(360, 360, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);

    // Add gentle elevation undulations
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const distFromPad = Math.sqrt(vx * vx + vz * vz);

      // Keep pad and spaceport flat (within radius 30)
      if (distFromPad > 32) {
        const falloff = Math.min((distFromPad - 32) / 40, 1.0);
        const wave = Math.sin(vx * 0.04) * Math.cos(vz * 0.04) * 3.5 +
                     Math.sin(vx * 0.08 + 1.2) * 1.8;
        
        // Mountain ridge along north-west
        let ridge = 0;
        if (vx < -40 && vz < -20) {
          ridge = Math.min((-vx - 40) * 0.45, 26);
        }

        // Coastal dip to the East
        let coast = 0;
        if (vx > 65) {
          coast = -(vx - 65) * 0.15;
        }

        pos.setY(i, (wave + ridge + coast) * falloff);
      } else {
        pos.setY(i, 0);
      }
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3d6647, // Natural aerospace field green/grass
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.terrainGroup.add(ground);

    // 2. Coastal Ocean Water to East
    const waterGeo = new THREE.PlaneGeometry(240, 360);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.65,
      transparent: true,
      opacity: 0.82
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(160, -2.5, 0);
    this.terrainGroup.add(water);

    // 3. Service Asphalt Roads & Perimeter Apron
    const roadGeo = new THREE.PlaneGeometry(12, 120);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(0, 0.02, 60);
    road.receiveShadow = true;
    this.terrainGroup.add(road);

    // 4. Stylized Low-Poly Pine Trees
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.8, 6);
    const foliageGeo = new THREE.ConeGeometry(1.6, 4.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1e4620, roughness: 0.8, flatShading: true });

    for (let t = 0; t < 65; t++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 36 + Math.random() * 85;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;

      // Don't place on asphalt road
      if (Math.abs(tx) < 14 && tz > 0 && tz < 110) continue;

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      tree.add(trunk);

      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = 3.2;
      foliage.castShadow = true;
      tree.add(foliage);

      const scale = 0.7 + Math.random() * 0.7;
      tree.scale.set(scale, scale, scale);
      tree.position.set(tx, 0, tz);
      this.terrainGroup.add(tree);
    }

    this.scene.add(this.terrainGroup);
  }

  createWaypointBeacons() {
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.name = 'WaypointBeacons';

    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.3,
      roughness: 0.3
    });

    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.9
    });

    // Place a navigational beacon pillar near each flight waypoint on the ground
    this.circuitPoints.forEach((pt, idx) => {
      // Don't place on center pad itself
      if (Math.abs(pt.x) < 5 && Math.abs(pt.z) < 5) return;

      const pylon = new THREE.Group();
      pylon.position.set(pt.x, 0, pt.z);

      // Pylon Lattice Tower
      const towerHeight = 12;
      const towerGeo = new THREE.CylinderGeometry(0.4, 1.4, towerHeight, 6);
      const tower = new THREE.Mesh(towerGeo, pylonMat);
      tower.position.y = towerHeight / 2;
      tower.castShadow = true;
      pylon.add(tower);

      // Flashing Navigation Beacon Beacon Light
      const beaconOrbGeo = new THREE.SphereGeometry(0.85, 12, 12);
      const beaconOrb = new THREE.Mesh(beaconOrbGeo, glowMat);
      beaconOrb.position.y = towerHeight + 0.6;
      pylon.add(beaconOrb);

      // Waypoint Guidance Rings in the Sky
      const ringGeo = new THREE.TorusGeometry(3.2, 0.12, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, glowMat);
      ring.position.y = pt.y; // At the actual flight altitude!
      pylon.add(ring);

      this.beaconLights.push(beaconOrb);
      this.beaconGroup.add(pylon);
    });

    this.scene.add(this.beaconGroup);
  }

  createFlightPathVisualizer() {
    // 3D Smooth CatmullRom Curve through circuit points
    this.curve = new THREE.CatmullRomCurve3(this.circuitPoints, false, 'centripetal', 0.5);
    
    // Glowing tube mesh representing the flight path
    const tubeGeo = new THREE.TubeGeometry(this.curve, 180, 0.18, 8, false);
    this.pathMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    this.pathRibbon = new THREE.Mesh(tubeGeo, this.pathMaterial);
    this.pathRibbon.frustumCulled = false;
    this.scene.add(this.pathRibbon);
  }

  toggleFlightPath(visible) {
    if (this.pathRibbon) {
      this.pathRibbon.visible = visible;
    }
    if (this.beaconGroup) {
      this.beaconGroup.visible = visible;
    }
  }

  update(delta, time) {
    // 1. Rotate Radar Scanner
    if (this.radarDish) {
      this.radarDish.rotation.y += delta * 1.4;
    }

    // 2. Pulse Perimeter Pad LEDs
    if (this.padLeds && this.padLeds.length > 0) {
      const pulse = 0.6 + Math.sin(time * 4) * 0.4;
      const altPulse = 0.6 + Math.cos(time * 4) * 0.4;
      this.padLeds.forEach((led, i) => {
        const val = i % 2 === 0 ? pulse : altPulse;
        led.scale.set(val, val, val);
      });
    }

    // 3. Pulse Navigation Beacon Rings
    if (this.beaconLights) {
      const bPulse = 0.8 + Math.sin(time * 6) * 0.25;
      this.beaconLights.forEach(b => {
        b.scale.set(bPulse, bPulse, bPulse);
      });
    }

    // 4. Drift Clouds Slowly
    if (this.cloudsGroup) {
      this.cloudsGroup.rotation.y += delta * 0.008;
    }
  }
}
