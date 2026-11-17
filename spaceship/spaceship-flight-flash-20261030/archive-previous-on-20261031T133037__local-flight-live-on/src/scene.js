import * as THREE from 'three';

/**
 * Creates the well-lit daytime spaceport environment:
 * - Natural daytime lighting (Sun directional light + Hemisphere + Soft Fill)
 * - Atmospheric sky dome with clouds
 * - Detailed landing pad with hazard stripes, perimeter runway lights, and blast shields
 * - Spaceport scenery: Control tower with rotating radar dish, hangars, fuel tanks, low-poly pine trees and rocks
 */
export class WorldScene {
  constructor(scene) {
    this.scene = scene;

    this.runwayLights = [];
    this.lightPulseTime = 0;
    this.radarDish = null;
    this.cloudGroup = new THREE.Group();

    this.setupLighting();
    this.setupSky();
    this.setupTerrain();
    this.setupLandingPad();
    this.setupSpaceport();
  }

  setupLighting() {
    // 1. Hemisphere Light: Natural skylight + ground bounce
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x475569, 1.1);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // 2. Main Sun Directional Light (bright warm daytime sun)
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.6);
    sunLight.position.set(45, 60, 35);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 160;

    // Shadow frustum coverage for spaceport and pad
    const d = 55;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.radius = 2.5; // Soft shadow edges
    this.scene.add(sunLight);

    // 3. Directional Fill Light (softens harsh back-side shadows)
    const fillLight = new THREE.DirectionalLight(0xb0d8ff, 0.75);
    fillLight.position.set(-35, 25, -35);
    this.scene.add(fillLight);
  }

  setupSky() {
    // 1. Daytime Sky Dome with vertical gradient
    const skyGeo = new THREE.SphereGeometry(220, 32, 24);

    // Custom gradient shader for sky
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x1e6bb8) }, // Rich daytime sky blue
        midColor: { value: new THREE.Color(0x60a5fa) }, // Cerulean
        bottomColor: { value: new THREE.Color(0xe0f2fe) }, // Warm horizon haze
        offset: { value: 15 },
        exponent: { value: 0.6 }
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
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          vec3 col;
          if (h > 0.25) {
            float t = (h - 0.25) / 0.75;
            col = mix(midColor, topColor, pow(t, exponent));
          } else {
            float t = max(0.0, h / 0.25);
            col = mix(bottomColor, midColor, t);
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });

    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyDome);

    // 2. Stylized Daytime Cumulus Clouds
    this.scene.add(this.cloudGroup);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
      flatShading: true
    });

    const cloudClusterPositions = [
      [35, 45, -45, 1.2],
      [-50, 48, -30, 1.4],
      [-30, 52, 50, 1.1],
      [55, 46, 35, 1.3],
      [0, 55, -60, 1.5],
      [-65, 42, 10, 1.0],
      [70, 50, -10, 1.3]
    ];

    cloudClusterPositions.forEach(([cx, cy, cz, scale]) => {
      const cluster = new THREE.Group();
      cluster.position.set(cx, cy, cz);

      // Combine 4-6 overlapping spheres for fluffy cloud shape
      const puffs = [
        [0, 0, 0, 6],
        [-4, -0.8, 1, 4.5],
        [4.2, -0.6, -1, 4.8],
        [1.5, 2.2, 0.5, 4.2],
        [-2.5, 1.5, -0.8, 3.8]
      ];

      puffs.forEach(([px, py, pz, r]) => {
        const puffGeo = new THREE.DodecahedronGeometry(r, 1);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(px, py, pz);
        cluster.add(puff);
      });

      cluster.scale.setScalar(scale);
      this.cloudGroup.add(cluster);
    });
  }

  setupTerrain() {
    // 1. Central Ground Plane (Spaceport field)
    const groundGeo = new THREE.PlaneGeometry(300, 300, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);

    // Displace vertices gently at outer edges to form scenic perimeter hills
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const distFromCenter = Math.sqrt(x * x + z * z);

      // Keep central area (r < 40) completely flat for the landing pad & spaceport
      if (distFromCenter > 45) {
        const hillFactor = Math.min(1.0, (distFromCenter - 45) / 50);
        const elevation = (Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5 +
                           Math.sin(x * 0.1) * 2.5 +
                           Math.cos(z * 0.08) * 3) * hillFactor;
        pos.setY(i, Math.max(0, elevation));
      } else {
        pos.setY(i, 0);
      }
    }
    groundGeo.computeVertexNormals();

    // Canvas procedural ground texture (dry grassland / spaceport plateau)
    let groundTex = null;
    if (typeof document !== 'undefined') {
      const groundCanvas = document.createElement('canvas');
      groundCanvas.width = 1024;
      groundCanvas.height = 1024;
      const ctx = groundCanvas.getContext('2d');

      // Sandy-olive base
      ctx.fillStyle = '#6b7a5a';
      ctx.fillRect(0, 0, 1024, 1024);

      // Subtle noise and terrain mottling
      for (let i = 0; i < 4000; i++) {
        const rx = Math.random() * 1024;
        const ry = Math.random() * 1024;
        const r = 2 + Math.random() * 8;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(85,99,70,0.4)' : 'rgba(125,138,105,0.4)';
        ctx.beginPath();
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Service access road circle around spaceport
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(512, 512, 280, 0, Math.PI * 2);
      ctx.stroke();

      groundTex = new THREE.CanvasTexture(groundCanvas);
      groundTex.wrapS = THREE.RepeatWrapping;
      groundTex.wrapT = THREE.RepeatWrapping;
      groundTex.repeat.set(6, 6);
    }

    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.85,
      metalness: 0.1
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // 2. Concrete service aprons
    const apronGeo = new THREE.CylinderGeometry(28, 28, 0.04, 32);
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.7,
      metalness: 0.2
    });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.position.set(0, 0.02, 0);
    apron.receiveShadow = true;
    this.scene.add(apron);
  }

  setupLandingPad() {
    const padGroup = new THREE.Group();
    padGroup.position.set(0, 0, 0);

    // 1. Concrete foundation cylinder (elevation = 0.4m)
    const padRadius = 7.5;
    const baseGeo = new THREE.CylinderGeometry(padRadius, padRadius + 0.6, 0.4, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.6,
      metalness: 0.3
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.2;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    padGroup.add(baseMesh);

    // 2. Landing Surface Canvas Texture (High-contrast markings, target rings, hazard border)
    let padTex = null;
    if (typeof document !== 'undefined') {
      const padCanvas = document.createElement('canvas');
      padCanvas.width = 1024;
      padCanvas.height = 1024;
      const ctx = padCanvas.getContext('2d');

      // Base concrete dark slate
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 1024, 1024);

      // Blast deflection / heat discoloration in center
      const heatGrad = ctx.createRadialGradient(512, 512, 0, 512, 512, 420);
      heatGrad.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
      heatGrad.addColorStop(0.5, 'rgba(30, 41, 59, 0.7)');
      heatGrad.addColorStop(1, 'rgba(51, 65, 85, 0.4)');
      ctx.fillStyle = heatGrad;
      ctx.beginPath();
      ctx.arc(512, 512, 420, 0, Math.PI * 2);
      ctx.fill();

      // Outer hazard chevron ring (Yellow & Black stripes)
      const cx = 512, cy = 512, outerR = 480, innerR = 430;
      const numStripes = 36;
      for (let i = 0; i < numStripes; i++) {
        const a1 = (i / numStripes) * Math.PI * 2;
        const a2 = ((i + 1) / numStripes) * Math.PI * 2;
        ctx.fillStyle = i % 2 === 0 ? '#eab308' : '#111827';
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, a1, a2);
        ctx.arc(cx, cy, innerR, a2, a1, true);
        ctx.closePath();
        ctx.fill();
      }

      // Outer guide circle (Cyan glow border)
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(512, 512, 380, 0, Math.PI * 2);
      ctx.stroke();

      // Secondary dashed circle
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.setLineDash([25, 25]);
      ctx.beginPath();
      ctx.arc(512, 512, 280, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Inner Target Circle
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(512, 512, 170, 0, Math.PI * 2);
      ctx.stroke();

      // Center Crosshair
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      // Horizontal crosshair lines
      ctx.beginPath();
      ctx.moveTo(312, 512);
      ctx.lineTo(432, 512);
      ctx.moveTo(592, 512);
      ctx.lineTo(712, 512);
      // Vertical crosshair lines
      ctx.moveTo(512, 312);
      ctx.lineTo(512, 432);
      ctx.moveTo(512, 592);
      ctx.lineTo(712, 512);
      ctx.stroke();

      // Center "LP-01" Landing Pad insignia
      ctx.fillStyle = '#0ea5e9';
      ctx.font = 'bold 54px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LP-01', 512, 512);

      // Orientation directional chevron (points North / Flight takeoff direction)
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(512, 140);
      ctx.lineTo(540, 180);
      ctx.lineTo(520, 180);
      ctx.lineTo(520, 210);
      ctx.lineTo(504, 210);
      ctx.lineTo(504, 180);
      ctx.lineTo(484, 180);
      ctx.closePath();
      ctx.fill();

      padTex = new THREE.CanvasTexture(padCanvas);
    }
    const padTopGeo = new THREE.CircleGeometry(padRadius, 48);
    padTopGeo.rotateX(-Math.PI / 2);
    const padTopMat = new THREE.MeshStandardMaterial({
      map: padTex,
      roughness: 0.5,
      metalness: 0.3
    });
    const padTopMesh = new THREE.Mesh(padTopGeo, padTopMat);
    padTopMesh.position.y = 0.405; // Slightly above base cylinder
    padTopMesh.receiveShadow = true;
    padGroup.add(padTopMesh);

    // 3. Perimeter Runway Guide Lights (8 pulsing LED beacon fixtures)
    const lightBulbGeo = new THREE.SphereGeometry(0.12, 12, 8);
    const lightHousingGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.25, 8);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const lx = Math.cos(angle) * (padRadius + 0.3);
      const lz = Math.sin(angle) * (padRadius + 0.3);

      const pylon = new THREE.Mesh(lightHousingGeo, baseMat);
      pylon.position.set(lx, 0.3, lz);
      padGroup.add(pylon);

      const bulbMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const bulb = new THREE.Mesh(lightBulbGeo, bulbMat);
      bulb.position.set(lx, 0.48, lz);
      padGroup.add(bulb);

      this.runwayLights.push(bulb);
    }

    // 4. Pad Blast Deflector Barriers (4 angled protective steel shields)
    const barrierGeo = new THREE.BoxGeometry(3.6, 0.7, 0.25);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.7,
      roughness: 0.3
    });

    const barrierAngles = [Math.PI * 0.75, Math.PI * 1.25, -Math.PI * 0.25, -Math.PI * 0.75];
    barrierAngles.forEach(ang => {
      const bx = Math.cos(ang) * (padRadius + 1.2);
      const bz = Math.sin(ang) * (padRadius + 1.2);
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(bx, 0.55, bz);
      barrier.rotation.y = -ang + Math.PI / 2;
      barrier.castShadow = true;
      barrier.receiveShadow = true;
      padGroup.add(barrier);
    });

    // 5. Pad Floodlight Poles (2 tall floodlight towers)
    const poleConfigs = [
      { x: -padRadius - 2.5, z: padRadius + 2.5, rot: 0.6 },
      { x: padRadius + 2.5, z: padRadius + 2.5, rot: -0.6 }
    ];

    poleConfigs.forEach(cfg => {
      const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 5.0, 8);
      const pole = new THREE.Mesh(poleGeo, baseMat);
      pole.position.set(cfg.x, 2.5, cfg.z);
      pole.castShadow = true;
      padGroup.add(pole);

      // Light head
      const headGeo = new THREE.BoxGeometry(0.6, 0.3, 0.4);
      const headMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(cfg.x, 5.0, cfg.z);
      head.rotation.y = cfg.rot;
      head.rotation.x = 0.4; // Tilt down towards pad
      padGroup.add(head);

      // Glowing lens
      const lensMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), lensMat);
      lens.position.set(cfg.x, 4.95, cfg.z - 0.2);
      lens.rotation.y = cfg.rot;
      lens.rotation.x = 0.4;
      padGroup.add(lens);
    });

    this.scene.add(padGroup);
  }

  setupSpaceport() {
    const spaceport = new THREE.Group();

    // 1. Control Tower (Observation deck with glass + rotating radar dish)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-28, 0, -22);

    // Tower base stem
    const stemGeo = new THREE.CylinderGeometry(2.0, 2.6, 12, 12);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.3,
      roughness: 0.4
    });
    const stem = new THREE.Mesh(stemGeo, towerMat);
    stem.position.y = 6;
    stem.castShadow = true;
    stem.receiveShadow = true;
    towerGroup.add(stem);

    // Observation cab (flared glass room)
    const cabGeo = new THREE.CylinderGeometry(3.6, 2.6, 2.8, 12);
    const cabGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      metalness: 0.2,
      roughness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.9
    });
    const cab = new THREE.Mesh(cabGeo, cabGlassMat);
    cab.position.y = 12.8;
    cab.castShadow = true;
    towerGroup.add(cab);

    // Tower roof
    const roofGeo = new THREE.ConeGeometry(3.8, 1.2, 12);
    const roof = new THREE.Mesh(roofGeo, towerMat);
    roof.position.y = 14.8;
    towerGroup.add(roof);

    // Rotating Radar Dish Assembly
    const dishAssembly = new THREE.Group();
    dishAssembly.position.set(0, 15.6, 0);

    const dishGeo = new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.4);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      metalness: 0.8,
      roughness: 0.2,
      side: THREE.DoubleSide
    });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI / 4; // Tilted upward
    dishAssembly.add(dish);

    // Radar receiver feed horn
    const hornGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2);
    const horn = new THREE.Mesh(hornGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    horn.position.set(0, 0.5, 0.6);
    dishAssembly.add(horn);

    towerGroup.add(dishAssembly);
    this.radarDish = dishAssembly;

    // Antenna mast with red blinking beacon
    const mastGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.5);
    const mast = new THREE.Mesh(mastGeo, new THREE.MeshStandardMaterial({ color: 0x475569 }));
    mast.position.set(1.8, 16.5, 0);
    towerGroup.add(mast);

    const towerBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    towerBeacon.position.set(1.8, 18.3, 0);
    towerGroup.add(towerBeacon);
    this.runwayLights.push(towerBeacon);

    spaceport.add(towerGroup);

    // 2. Spacecraft Hangars (Two arched hangars for visual backdrop)
    const hangarMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.4,
      roughness: 0.4
    });

    const createHangar = (x, z, rotY) => {
      const hangar = new THREE.Group();
      hangar.position.set(x, 0, z);
      hangar.rotation.y = rotY;

      // Arched roof / body
      const archGeo = new THREE.CylinderGeometry(5.5, 5.5, 14, 16, 1, false, 0, Math.PI);
      archGeo.rotateZ(Math.PI / 2);
      const archMesh = new THREE.Mesh(archGeo, hangarMat);
      archMesh.position.y = 0;
      archMesh.castShadow = true;
      archMesh.receiveShadow = true;
      hangar.add(archMesh);

      // Bay door (yellow-lit interior entrance)
      const doorGeo = new THREE.PlaneGeometry(8, 4.5);
      const doorMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.15
      });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 2.25, 7.02);
      hangar.add(door);

      return hangar;
    };

    spaceport.add(createHangar(32, -26, -0.4));
    spaceport.add(createHangar(44, -12, -0.4));

    // 3. Fuel Storage Tanks (Three white/cyan cylindrical tanks)
    const tankGeo = new THREE.CylinderGeometry(2.4, 2.4, 6.0, 16);
    const tankCapGeo = new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.3,
      roughness: 0.3
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.5,
      roughness: 0.3
    });

    const tankPositions = [
      [32, 18],
      [38, 24],
      [27, 26]
    ];

    tankPositions.forEach(([tx, tz]) => {
      const tankGroup = new THREE.Group();
      tankGroup.position.set(tx, 0, tz);

      const tank = new THREE.Mesh(tankGeo, tankMat);
      tank.position.y = 3.0;
      tank.castShadow = true;
      tank.receiveShadow = true;
      tankGroup.add(tank);

      const cap = new THREE.Mesh(tankCapGeo, tankMat);
      cap.position.y = 6.0;
      cap.castShadow = true;
      tankGroup.add(cap);

      // Accent ring
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.42, 2.42, 0.4, 16), stripeMat);
      ring.position.y = 4.2;
      tankGroup.add(ring);

      spaceport.add(tankGroup);
    });

    // 4. Low-Poly Stylized Pine Trees scattered on the perimeter
    const treeMatTrunk = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const treeMatFoliage = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8, flatShading: true });

    const treePositions = [
      [-42, 20], [-46, 26], [-38, 35], [-24, 42], [-14, 46],
      [12, 45], [22, 48], [-48, -12], [-52, 2], [-45, -28],
      [-12, -45], [15, -46], [22, -42]
    ];

    treePositions.forEach(([x, z]) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.8, 6), treeMatTrunk);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      tree.add(trunk);

      // 3 tiered foliage cones
      const foliage1 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.4, 6), treeMatFoliage);
      foliage1.position.y = 2.4;
      foliage1.castShadow = true;
      tree.add(foliage1);

      const foliage2 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.0, 6), treeMatFoliage);
      foliage2.position.y = 3.6;
      foliage2.castShadow = true;
      tree.add(foliage2);

      const foliage3 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 6), treeMatFoliage);
      foliage3.position.y = 4.6;
      foliage3.castShadow = true;
      tree.add(foliage3);

      const scale = 0.8 + Math.random() * 0.5;
      tree.scale.setScalar(scale);
      spaceport.add(tree);
    });

    // 5. Stylized natural rocks
    const rockGeo = new THREE.DodecahedronGeometry(1.2, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9, flatShading: true });

    const rockPositions = [
      [-18, 22], [18, 16], [-12, -24], [16, -20], [-35, -8], [42, 8]
    ];

    rockPositions.forEach(([x, z]) => {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, 0.6, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.set(1.0 + Math.random() * 0.5, 0.7 + Math.random() * 0.4, 1.0 + Math.random() * 0.5);
      rock.castShadow = true;
      rock.receiveShadow = true;
      spaceport.add(rock);
    });

    this.scene.add(spaceport);
  }

  update(delta) {
    // Rotate radar dish smoothly
    if (this.radarDish) {
      this.radarDish.rotation.y += delta * 0.75;
    }

    // Drift sky clouds slowly
    this.cloudGroup.rotation.y += delta * 0.004;

    // Pulse runway edge lights (strobe rhythm)
    this.lightPulseTime += delta;
    const pulse = 0.5 + 0.5 * Math.sin(this.lightPulseTime * 5.0);
    this.runwayLights.forEach((bulb, i) => {
      if (bulb.material && bulb.material.color) {
        // Cyan runway lights alternating with amber
        if (i % 2 === 0) {
          bulb.material.color.setRGB(0.1 + pulse * 0.2, 0.7 + pulse * 0.3, 0.95);
        } else {
          bulb.material.color.setRGB(0.95, 0.6 + pulse * 0.3, 0.1);
        }
      }
    });
  }
}
