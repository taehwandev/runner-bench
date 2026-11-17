import * as THREE from 'three';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.animatedObjects = [];

    this.buildSky();
    this.buildLighting();
    this.buildTerrain();
    this.buildLandingPad();
    this.buildOutpost();
    this.buildWaypointMarkers();
  }

  buildSky() {
    // Beautiful atmospheric sky dome with custom gradient shader
    const skyGeom = new THREE.SphereGeometry(600, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x1960ba) },    // Deep daylight blue zenith
        midColor: { value: new THREE.Color(0x69b3f7) },    // Azure mid-sky
        bottomColor: { value: new THREE.Color(0xe0eeff) }, // Horizon atmospheric haze
        offset: { value: 20 },
        exponent: { value: 0.65 },
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
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          h = max(h, 0.0);
          vec3 sky = mix(bottomColor, midColor, pow(h, exponent * 0.7));
          sky = mix(sky, topColor, pow(h, exponent * 2.2));
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });

    const sky = new THREE.Mesh(skyGeom, skyMat);
    this.scene.add(sky);

    // Distant mountain horizon rings for scale and depth
    const mountainGeom = new THREE.CylinderGeometry(450, 480, 80, 48, 4, true);
    // Perturb vertices for jagged silhouette
    const pos = mountainGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) {
        const angle = Math.atan2(pos.getZ(i), pos.getX(i));
        const noise = Math.sin(angle * 9) * 18 + Math.cos(angle * 17) * 12 + Math.sin(angle * 31) * 6;
        pos.setY(i, y + noise);
      }
    }
    mountainGeom.computeVertexNormals();

    const mountainMat = new THREE.MeshBasicMaterial({
      color: 0x7da4cf,
      side: THREE.BackSide,
      fog: true,
    });
    const mountains = new THREE.Mesh(mountainGeom, mountainMat);
    mountains.position.y = 15;
    this.scene.add(mountains);

    // Procedural cumulus cloud puffs
    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
    });

    for (let i = 0; i < 18; i++) {
      const cloudCluster = new THREE.Group();
      const puffCount = 5 + Math.floor(Math.random() * 4);
      for (let j = 0; j < puffCount; j++) {
        const radius = 10 + Math.random() * 12;
        const puffGeom = new THREE.SphereGeometry(radius, 8, 8);
        const puff = new THREE.Mesh(puffGeom, cloudMat);
        puff.position.set(
          (Math.random() - 0.5) * 28,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 28
        );
        puff.scale.set(1.2, 0.65, 1.2);
        cloudCluster.add(puff);
      }

      const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const dist = 140 + Math.random() * 160;
      cloudCluster.position.set(Math.cos(angle) * dist, 70 + Math.random() * 45, Math.sin(angle) * dist);
      this.clouds.add(cloudCluster);
    }
    this.scene.add(this.clouds);
  }

  buildLighting() {
    // Natural daytime Hemisphere light (sky blue from above, warm earth from ground)
    const hemiLight = new THREE.HemisphereLight(0x76b2f0, 0x8a7258, 1.1);
    hemiLight.position.set(0, 100, 0);
    this.scene.add(hemiLight);

    // Main Sun Directional Light
    this.sunLight = new THREE.DirectionalLight(0xfffaea, 2.2);
    this.sunLight.position.set(90, 140, 70);
    this.sunLight.castShadow = true;

    // High quality shadow configuration covering the pad and flight area
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 400;
    const d = 110;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.02;

    this.scene.add(this.sunLight);

    // Subtle sun flare glow billboard
    const sunGlowGeom = new THREE.PlaneGeometry(35, 35);
    const sunGlowMat = new THREE.MeshBasicMaterial({
      color: 0xfff4d0,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sunGlow = new THREE.Mesh(sunGlowGeom, sunGlowMat);
    sunGlow.position.copy(this.sunLight.position).multiplyScalar(2.2);
    sunGlow.lookAt(0, 0, 0);
    this.scene.add(sunGlow);

    // Soft distance fog
    this.scene.fog = new THREE.FogExp2(0xcde0f7, 0.0022);
  }

  buildTerrain() {
    // Large ground mesh with elevation variations
    const size = 500;
    const segments = 90;
    const terrainGeom = new THREE.PlaneGeometry(size, size, segments, segments);
    terrainGeom.rotateX(-Math.PI / 2);

    const pos = terrainGeom.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const colPad = new THREE.Color(0xb0a89a);     // Flat dusty basin around pad
    const colGrass = new THREE.Color(0x738d58);   // Green-sage vegetation patches
    const colRock = new THREE.Color(0x9d7a5b);    // Terracotta mesa rock
    const colRidge = new THREE.Color(0xbaa082);   // Sunlit ridge highlights

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const distFromCenter = Math.hypot(x, z);

      let y = 0;
      if (distFromCenter > 22) {
        // Keep central 22m radius flat for landing pad & outpost
        const factor = Math.min(1.0, (distFromCenter - 22) / 40);
        // Multi-frequency hills
        const h1 = Math.sin(x * 0.025) * Math.cos(z * 0.025) * 8;
        const h2 = Math.sin(x * 0.05 + 1.2) * Math.sin(z * 0.05 + 0.8) * 4;
        const h3 = Math.cos(x * 0.012 - z * 0.015) * 14;
        y = (h1 + h2 + h3) * factor;

        // Flatten canyon depression on north side
        if (z < -40 && Math.abs(x) < 50) {
          y *= 0.4;
        }
      }

      pos.setY(i, y);

      // Vertex color blending based on height and noise
      let vertexColor = colPad.clone();
      if (y > 6) {
        vertexColor.lerp(colRidge, Math.min(1.0, (y - 6) / 8));
      } else if (y > 1.5) {
        vertexColor.lerp(colRock, 0.7);
      } else if (distFromCenter > 25) {
        const patchNoise = Math.sin(x * 0.1) * Math.cos(z * 0.1);
        if (patchNoise > 0.1) {
          vertexColor.lerp(colGrass, 0.6);
        }
      }

      colors[i * 3] = vertexColor.r;
      colors[i * 3 + 1] = vertexColor.g;
      colors[i * 3 + 2] = vertexColor.b;
    }

    terrainGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeom.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.08,
      flatShading: true,
    });

    const terrain = new THREE.Mesh(terrainGeom, terrainMat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // Scatter low-poly boulders / rock clusters for terrain interest
    this.buildRocks();
  }

  buildRocks() {
    const rockGeom = new THREE.DodecahedronGeometry(1.2, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x82705e,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });

    const rockCount = 45;
    for (let i = 0; i < rockCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * 120;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const scale = 0.8 + Math.random() * 2.2;

      const rock = new THREE.Mesh(rockGeom, rockMat);
      rock.position.set(x, scale * 0.5, z);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      rock.scale.set(scale, scale * (0.6 + Math.random() * 0.6), scale);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }
  }

  buildLandingPad() {
    this.padGroup = new THREE.Group();
    this.padGroup.name = 'LandingPad';
    this.scene.add(this.padGroup);

    const padRadius = 8.5;
    const padHeight = 0.5;

    // Octagonal base platform
    const baseGeom = new THREE.CylinderGeometry(padRadius + 0.6, padRadius + 1.2, padHeight, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f47,
      roughness: 0.7,
      metalness: 0.4,
    });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = padHeight * 0.5;
    baseMesh.receiveShadow = true;
    this.padGroup.add(baseMesh);

    // Upper landing surface
    const surfaceGeom = new THREE.CylinderGeometry(padRadius, padRadius + 0.2, 0.15, 32);
    const surfaceMat = new THREE.MeshStandardMaterial({
      color: 0x484e58,
      roughness: 0.45,
      metalness: 0.5,
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeom, surfaceMat);
    surfaceMesh.position.y = padHeight + 0.075;
    surfaceMesh.receiveShadow = true;
    this.padGroup.add(surfaceMesh);

    // Procedural Landing Pad Markings on Canvas Texture
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Dark graphite background
    ctx.fillStyle = '#2c3038';
    ctx.fillRect(0, 0, 1024, 1024);

    // Hazard border stripes (yellow & black angled stripes)
    const cx = 512;
    const cy = 512;
    const rOuter = 490;
    const rInner = 430;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    const stripeWidth = 40;
    for (let x = -500; x < 1600; x += stripeWidth * 2) {
      ctx.fillStyle = '#f5b000'; // Aerospace warning yellow
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth - 400, 1024);
      ctx.lineTo(x - 400, 1024);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#1a1c22'; // Hazard dark
      ctx.beginPath();
      ctx.moveTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth * 2, 0);
      ctx.lineTo(x + stripeWidth * 2 - 400, 1024);
      ctx.lineTo(x + stripeWidth - 400, 1024);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Concentric guidance circles
    ctx.strokeStyle = '#f5b000';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 380, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#00e5ff'; // Cyan inner target ring
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 260, 0, Math.PI * 2);
    ctx.stroke();

    // Bold Central 'H' / Landing cross
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 240px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', cx, cy + 10);

    // Pad ID & Orientation indicators
    ctx.fillStyle = '#f5b000';
    ctx.font = 'bold 42px monospace';
    ctx.fillText('PAD 01 - NORTH', cx, cy - 310);
    ctx.fillText('MAX 12T', cx, cy + 325);

    // Crosshairs
    ctx.strokeStyle = '#f5b000';
    ctx.lineWidth = 6;
    ctx.beginPath();
    // North tick
    ctx.moveTo(cx, cy - 380); ctx.lineTo(cx, cy - 260);
    // South tick
    ctx.moveTo(cx, cy + 380); ctx.lineTo(cx, cy + 260);
    // East tick
    ctx.moveTo(cx - 380, cy); ctx.lineTo(cx - 260, cy);
    // West tick
    ctx.moveTo(cx + 380, cy); ctx.lineTo(cx + 260, cy);
    ctx.stroke();

    const padTexture = new THREE.CanvasTexture(canvas);
    padTexture.anisotropy = 8;

    const markingGeom = new THREE.CircleGeometry(padRadius - 0.1, 48);
    markingGeom.rotateX(-Math.PI / 2);
    const markingMat = new THREE.MeshStandardMaterial({
      map: padTexture,
      roughness: 0.5,
      metalness: 0.35,
    });
    const markingMesh = new THREE.Mesh(markingGeom, markingMat);
    markingMesh.position.y = padHeight + 0.16;
    markingMesh.receiveShadow = true;
    this.padGroup.add(markingMesh);

    // Pad perimeter beacon lights (8 lights around rim)
    this.padLights = [];
    const lightGeom = new THREE.CylinderGeometry(0.12, 0.16, 0.25, 12);
    const postGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffb700 });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const lx = Math.cos(angle) * (padRadius + 0.2);
      const lz = Math.sin(angle) * (padRadius + 0.2);

      const post = new THREE.Mesh(postGeom, postMat);
      post.position.set(lx, padHeight + 0.18, lz);
      this.padGroup.add(post);

      const beacon = new THREE.Mesh(lightGeom, beaconMat.clone());
      beacon.position.set(lx, padHeight + 0.4, lz);
      this.padGroup.add(beacon);
      this.padLights.push(beacon);
    }

    // Approach Light Bar array in front of the pad (Z = 12 to 24)
    for (let z = 12; z <= 24; z += 3) {
      const barGeom = new THREE.BoxGeometry(2.4, 0.15, 0.2);
      const barMesh = new THREE.Mesh(barGeom, postMat);
      barMesh.position.set(0, 0.2, z);
      this.padGroup.add(barMesh);

      const lightDotGeom = new THREE.SphereGeometry(0.1, 8, 8);
      const greenDotMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
      [-0.9, 0, 0.9].forEach((ox) => {
        const dot = new THREE.Mesh(lightDotGeom, greenDotMat);
        dot.position.set(ox, 0.32, z);
        this.padGroup.add(dot);
      });
    }

    // Access Ramp from ground to pad
    const rampGeom = new THREE.BoxGeometry(3.0, 0.4, 3.5);
    rampGeom.rotateX(0.15);
    const rampMesh = new THREE.Mesh(rampGeom, baseMat);
    rampMesh.position.set(-padRadius - 1.2, 0.2, 0);
    rampMesh.rotation.y = Math.PI / 2;
    rampMesh.receiveShadow = true;
    this.padGroup.add(rampMesh);
  }

  buildOutpost() {
    this.outpostGroup = new THREE.Group();
    this.outpostGroup.position.set(-26, 0, -18);
    this.scene.add(this.outpostGroup);

    const matBuilding = new THREE.MeshStandardMaterial({
      color: 0xd8dde4,
      roughness: 0.35,
      metalness: 0.25,
    });
    const matDarkFrame = new THREE.MeshStandardMaterial({
      color: 0x2b303c,
      roughness: 0.6,
      metalness: 0.7,
    });
    const matGlass = new THREE.MeshPhysicalMaterial({
      color: 0x1a4566,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.6,
      transparent: true,
      opacity: 0.85,
    });

    // 1. Control Tower
    const towerBaseGeom = new THREE.CylinderGeometry(2.5, 3.2, 12, 16);
    const towerBase = new THREE.Mesh(towerBaseGeom, matBuilding);
    towerBase.position.y = 6;
    towerBase.castShadow = true;
    towerBase.receiveShadow = true;
    this.outpostGroup.add(towerBase);

    // Observation deck (wider top cylinder)
    const deckGeom = new THREE.CylinderGeometry(4.2, 3.4, 2.5, 16);
    const deckMesh = new THREE.Mesh(deckGeom, matDarkFrame);
    deckMesh.position.y = 12.8;
    deckMesh.castShadow = true;
    this.outpostGroup.add(deckMesh);

    // Panoramic glass strip
    const glassGeom = new THREE.CylinderGeometry(4.05, 4.05, 1.4, 16, 1, true);
    const glassMesh = new THREE.Mesh(glassGeom, matGlass);
    glassMesh.position.y = 13;
    this.outpostGroup.add(glassMesh);

    // Tower roof & antenna mast
    const mastGeom = new THREE.CylinderGeometry(0.12, 0.2, 7, 8);
    const mastMesh = new THREE.Mesh(mastGeom, matDarkFrame);
    mastMesh.position.y = 17.5;
    mastMesh.castShadow = true;
    this.outpostGroup.add(mastMesh);

    // Rotating Radar Dish on Tower
    const dishGroup = new THREE.Group();
    dishGroup.position.set(0, 16.5, 0);

    const dishGeom = new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.8);
    const dishMesh = new THREE.Mesh(dishGeom, matBuilding);
    dishMesh.rotation.x = Math.PI / 4;
    dishGroup.add(dishMesh);

    const hornGeom = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
    hornGeom.rotateX(Math.PI / 4);
    hornGeom.translate(0, 0.5, 0.5);
    const horn = new THREE.Mesh(hornGeom, matDarkFrame);
    dishGroup.add(horn);

    this.outpostGroup.add(dishGroup);
    this.animatedObjects.push({
      update: (delta) => {
        dishGroup.rotation.y += delta * 0.8;
      }
    });

    // Blinking beacon on top of tower mast
    const beaconLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0033 })
    );
    beaconLight.position.set(0, 21.2, 0);
    this.outpostGroup.add(beaconLight);
    this.animatedObjects.push({
      update: (delta, clock) => {
        const blink = Math.sin(clock * 6) > 0.3;
        beaconLight.material.color.setHex(blink ? 0xff0022 : 0x440008);
      }
    });

    // 2. Storage Hangar Building
    const hangarGeom = new THREE.CylinderGeometry(5.5, 5.5, 16, 16, 1, false, 0, Math.PI);
    hangarGeom.rotateZ(Math.PI / 2);
    const hangarMesh = new THREE.Mesh(hangarGeom, matBuilding);
    hangarMesh.position.set(16, 0, 4);
    hangarMesh.castShadow = true;
    hangarMesh.receiveShadow = true;
    this.outpostGroup.add(hangarMesh);

    // 3. Solar Panel Array (3 angled panels)
    const panelGeom = new THREE.BoxGeometry(4.5, 0.1, 2.5);
    const matPanel = new THREE.MeshStandardMaterial({
      color: 0x102542,
      roughness: 0.2,
      metalness: 0.9,
    });

    [-6, 0, 6].forEach((offsetZ, idx) => {
      const panelStandGeom = new THREE.CylinderGeometry(0.1, 0.1, 1.4, 8);
      const stand = new THREE.Mesh(panelStandGeom, matDarkFrame);
      stand.position.set(22, 0.7, offsetZ - 8);
      this.outpostGroup.add(stand);

      const panel = new THREE.Mesh(panelGeom, matPanel);
      panel.position.set(22, 1.4, offsetZ - 8);
      panel.rotation.x = 0.45; // Angled toward sun
      panel.castShadow = true;
      this.outpostGroup.add(panel);
    });

    // 4. Wind Turbine / Anemometer nearby
    const turbineGroup = new THREE.Group();
    turbineGroup.position.set(-14, 0, 25);
    this.scene.add(turbineGroup);

    const poleGeom = new THREE.CylinderGeometry(0.2, 0.35, 14, 12);
    const poleMesh = new THREE.Mesh(poleGeom, matBuilding);
    poleMesh.position.y = 7;
    poleMesh.castShadow = true;
    turbineGroup.add(poleMesh);

    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(0, 14, 0);
    turbineGroup.add(rotorGroup);

    // 3 rotor blades
    const bladeGeom = new THREE.BoxGeometry(0.3, 4.5, 0.05);
    bladeGeom.translate(0, 2.2, 0);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeom, matBuilding);
      blade.rotation.z = (i / 3) * Math.PI * 2;
      rotorGroup.add(blade);
    }

    this.animatedObjects.push({
      update: (delta) => {
        rotorGroup.rotation.z += delta * 2.2;
      }
    });

    // 5. Windsock
    const windsockGroup = new THREE.Group();
    windsockGroup.position.set(16, 0, -12);
    this.scene.add(windsockGroup);

    const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 8), matDarkFrame);
    sockPole.position.y = 2.5;
    windsockGroup.add(sockPole);

    const sockConeGeom = new THREE.ConeGeometry(0.35, 1.8, 12, 1, true);
    sockConeGeom.rotateZ(Math.PI / 2);
    const matSock = new THREE.MeshStandardMaterial({ color: 0xff5500, side: THREE.DoubleSide });
    const sockCone = new THREE.Mesh(sockConeGeom, matSock);
    sockCone.position.set(0.9, 4.8, 0);
    sockCone.rotation.y = 0.3;
    windsockGroup.add(sockCone);
  }

  buildWaypointMarkers() {
    // Holographic aerial rings marking the test flight circuit
    // Points correspond to the flight circuit trajectory
    this.waypoints = [
      { pos: new THREE.Vector3(0, 18, 20), label: 'WP1: CLIMB' },
      { pos: new THREE.Vector3(38, 28, 55), label: 'WP2: VALLEY TURN' },
      { pos: new THREE.Vector3(75, 34, 15), label: 'WP3: CANYON RIDGE' },
      { pos: new THREE.Vector3(50, 32, -45), label: 'WP4: DOWNWIND' },
      { pos: new THREE.Vector3(-25, 26, -55), label: 'WP5: BASE TURN' },
      { pos: new THREE.Vector3(-35, 22, -10), label: 'WP6: APPROACH' },
    ];

    this.waypointRings = [];

    const ringGeom = new THREE.TorusGeometry(3.6, 0.16, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });

    this.waypoints.forEach((wp, idx) => {
      const ring = new THREE.Mesh(ringGeom, ringMat.clone());
      ring.position.copy(wp.pos);

      // Orient ring approximately tangent to path
      const nextWp = this.waypoints[(idx + 1) % this.waypoints.length];
      const dir = new THREE.Vector3().subVectors(nextWp.pos, wp.pos).normalize();
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

      this.scene.add(ring);
      this.waypointRings.push(ring);
    });

    this.animatedObjects.push({
      update: (delta, clock) => {
        this.waypointRings.forEach((ring, idx) => {
          // Gentle pulsing glow
          const pulse = 0.45 + Math.sin(clock * 3 + idx) * 0.2;
          ring.material.opacity = pulse;
        });
      }
    });
  }

  update(delta, clock) {
    this.animatedObjects.forEach((obj) => obj.update(delta, clock));

    // Pad perimeter beacon pulsing
    const padPulse = (Math.sin(clock * 4) + 1) * 0.5;
    this.padLights.forEach((beacon) => {
      beacon.material.color.setRGB(1.0, 0.7 + padPulse * 0.25, 0.1);
    });

    // Slow drifting clouds
    if (this.clouds) {
      this.clouds.rotation.y += delta * 0.008;
    }
  }
}
