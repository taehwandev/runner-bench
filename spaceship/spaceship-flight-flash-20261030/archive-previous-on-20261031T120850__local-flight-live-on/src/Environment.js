import * as THREE from 'three';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.waypoints = [];
    this.rotatingRadars = [];

    this.setupLighting();
    this.setupSky();
    this.buildTerrain();
    this.buildOutpostStructures();
    this.buildNavigationBeacons();

    this.scene.add(this.group);
  }

  setupLighting() {
    // 1. Directional Sun
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    sunLight.position.set(60, 90, 50);
    sunLight.castShadow = true;

    // High quality shadow configuration
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 280;
    const d = 65;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;

    this.scene.add(sunLight);
    this.sunLight = sunLight;

    // 2. Hemispheric Ambient Light (Sky blue + warm earth bounce)
    const hemiLight = new THREE.HemisphereLight(0xd9efff, 0x6e6858, 0.95);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // 3. Subtle Atmospheric Fog
    this.scene.fog = new THREE.FogExp2(0xcde1ee, 0.0045);
  }

  setupSky() {
    // Daytime Procedural Sky Dome
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      varying vec3 vWorldPosition;

      void main() {
        vec3 p = normalize(vWorldPosition);
        float h = max(p.y, 0.0);
        
        // Atmosphere gradient
        vec3 sky = mix(bottomColor, topColor, pow(h, 0.6));
        
        // Sun glare glow
        float sunDot = dot(p, normalize(sunDirection));
        if (sunDot > 0.0) {
          float sunGlare = pow(sunDot, 64.0) * 0.9 + pow(sunDot, 8.0) * 0.35;
          sky += sunColor * sunGlare;
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `;

    const skyGeo = new THREE.SphereGeometry(380, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        topColor: { value: new THREE.Color(0x3a88db) },     // Crisp azure blue
        bottomColor: { value: new THREE.Color(0xdcebf5) },  // Warm horizon haze
        sunColor: { value: new THREE.Color(0xfff6dc) },
        sunDirection: { value: new THREE.Vector3(60, 90, 50).normalize() }
      },
      side: THREE.BackSide,
      depthWrite: false
    });

    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(skyMesh);

    // Soft daytime cloud puffs
    this.buildCloudLayer();
  }

  buildCloudLayer() {
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });

    const cloudGroup = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const dist = 120 + Math.random() * 80;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = 50 + Math.random() * 25;

      const cluster = new THREE.Group();
      cluster.position.set(x, y, z);

      for (let j = 0; j < 4; j++) {
        const puffGeo = new THREE.SphereGeometry(12 + Math.random() * 8, 8, 8);
        puffGeo.scale(1.8, 0.5, 1.2);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 18
        );
        cluster.add(puff);
      }
      cloudGroup.add(cluster);
    }
    this.group.add(cloudGroup);
  }

  buildTerrain() {
    // Multi-resolution terrain with plateau, hills, and surrounding mountains
    const terrainGeo = new THREE.PlaneGeometry(360, 360, 90, 90);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Distance from center landing pad
      const distFromCenter = Math.sqrt(x * x + z * z);

      // Gentle rolling hills + distant perimeter ridges
      let height = 0;
      if (distFromCenter < 16) {
        // Flattened tarmac clearing around the landing pad
        height = 0.0;
      } else {
        const taper = Math.min(1.0, (distFromCenter - 16) / 25);
        // Multi-frequency Perlin-style sine noise
        const n1 = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 3.5;
        const n2 = Math.sin(x * 0.09 + 1.2) * Math.cos(z * 0.08 + 0.8) * 1.8;
        const n3 = Math.sin(x * 0.02 - 0.5) * Math.cos(z * 0.02 + 0.3) * 6.0;
        
        // Edge mountains
        const edgeFactor = Math.pow(Math.max(0, (distFromCenter - 60) / 100), 1.8) * 28;
        const canyonPass = (x > 15 && x < 55 && z < 10 && z > -50) ? -2.5 : 0; // Local flight corridor dip

        height = (n1 + n2 + n3 + edgeFactor + canyonPass) * taper;
      }
      pos.setY(i, Math.max(-0.5, height));
    }
    terrainGeo.computeVertexNormals();

    // Procedural terrain texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base earth tones
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#b89f82'); // Warm sand/clay
    grad.addColorStop(0.5, '#a48e72');
    grad.addColorStop(1, '#8e795f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle noise specks
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let p = 0; p < 8000; p++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const terrainTex = new THREE.CanvasTexture(canvas);
    terrainTex.wrapS = THREE.RepeatWrapping;
    terrainTex.wrapT = THREE.RepeatWrapping;
    terrainTex.repeat.set(12, 12);

    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTex,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    this.group.add(terrain);

    // Tarmac Apron (Flat composite pad skirt)
    const apronGeo = new THREE.CircleGeometry(16, 32);
    apronGeo.rotateX(-Math.PI / 2);
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x3d444d,
      roughness: 0.8,
      metalness: 0.2
    });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.position.y = 0.02;
    apron.receiveShadow = true;
    this.group.add(apron);

    // Scattered natural desert rocks and boulders
    this.buildRocks();
  }

  buildRocks() {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x6e6357,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });

    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 22 + Math.random() * 85;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      const scale = 0.8 + Math.random() * 2.2;
      const rockGeo = new THREE.DodecahedronGeometry(scale, 1);
      rockGeo.scale(1.0 + Math.random() * 0.5, 0.6 + Math.random() * 0.4, 1.0 + Math.random() * 0.5);

      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, scale * 0.4, z);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
    }
  }

  buildOutpostStructures() {
    // 1. Telemetry & Control Tower (At x = -24, z = -18)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-24, 0, -18);

    // Concrete base
    const baseGeo = new THREE.BoxGeometry(7, 2, 7);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 1;
    base.castShadow = true;
    towerGroup.add(base);

    // Lattice core / column
    const colGeo = new THREE.CylinderGeometry(1.6, 2.2, 14, 8);
    const colMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.y = 9;
    col.castShadow = true;
    towerGroup.add(col);

    // Observation Deck Cab
    const cabGeo = new THREE.CylinderGeometry(3.6, 2.6, 3.2, 10);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.y = 16.5;
    cab.castShadow = true;
    towerGroup.add(cab);

    // Glowing Observation Windows
    const winGeo = new THREE.CylinderGeometry(3.65, 3.65, 1.2, 10, 1, true);
    const winMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.y = 16.8;
    towerGroup.add(win);

    // Rotating Radar Dish atop tower
    const radarPivot = new THREE.Group();
    radarPivot.position.y = 18.5;
    towerGroup.add(radarPivot);

    const dishGeo = new THREE.SphereGeometry(1.6, 12, 8, 0, Math.PI);
    dishGeo.rotateX(Math.PI / 2);
    dishGeo.rotateY(Math.PI * 0.2);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.y = 1.0;
    radarPivot.add(dish);

    // Tower Blinking Red Beacon
    const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 20.8;
    towerGroup.add(beacon);

    this.rotatingRadars.push(radarPivot);
    this.group.add(towerGroup);

    // 2. Cryogenic Fuel Storage Spheres (At x = -18, z = 14)
    const fuelGroup = new THREE.Group();
    fuelGroup.position.set(-18, 0, 14);

    [-3.2, 3.2].forEach(offset => {
      // Pedestal
      const pedGeo = new THREE.CylinderGeometry(2.0, 2.4, 1.2, 12);
      const pedMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
      const ped = new THREE.Mesh(pedGeo, pedMat);
      ped.position.set(offset, 0.6, 0);
      fuelGroup.add(ped);

      // Sphere Tank
      const tankGeo = new THREE.SphereGeometry(2.6, 24, 16);
      const tankMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.85,
        roughness: 0.15
      });
      const tank = new THREE.Mesh(tankGeo, tankMat);
      tank.position.set(offset, 3.4, 0);
      tank.castShadow = true;
      fuelGroup.add(tank);

      // Warning ring
      const ringGeo = new THREE.TorusGeometry(2.65, 0.1, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(offset, 3.4, 0);
      fuelGroup.add(ring);
    });

    // Fuel pipeline connecting toward pad
    const pipeGeo = new THREE.CylinderGeometry(0.18, 0.18, 12, 8);
    pipeGeo.rotateZ(Math.PI / 2);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.position.set(6, 0.4, 0);
    fuelGroup.add(pipe);

    this.group.add(fuelGroup);

    // 3. Solar Collector Array (At x = 22, z = 22)
    const solarGroup = new THREE.Group();
    solarGroup.position.set(22, 0, 22);

    for (let s = 0; s < 3; s++) {
      const pylonGeo = new THREE.CylinderGeometry(0.15, 0.2, 2.5, 8);
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(s * 4.5, 1.25, 0);
      solarGroup.add(pylon);

      const panelGeo = new THREE.BoxGeometry(3.6, 0.1, 2.2);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x0f2d59,
        roughness: 0.2,
        metalness: 0.85
      });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(s * 4.5, 2.6, 0);
      panel.rotation.x = -Math.PI * 0.22; // angled to sun
      panel.castShadow = true;
      solarGroup.add(panel);
    }
    this.group.add(solarGroup);
  }

  buildNavigationBeacons() {
    // 4 Waypoint Navigation Beacons marking the test flight circuit!
    // WP1: Alpha (Ascent out of pad)
    // WP2: Bravo (Canyon Ridge Turn)
    // WP3: Charlie (Scenic Mountain Vista)
    // WP4: Delta (Pad Approach Line)
    const beaconDefs = [
      { name: "ALPHA", pos: new THREE.Vector3(12, 16, -10), color: 0x00e5ff },
      { name: "BRAVO", pos: new THREE.Vector3(36, 20, -32), color: 0x38bdf8 },
      { name: "CHARLIE", pos: new THREE.Vector3(18, 22, 38), color: 0xa855f7 },
      { name: "DELTA", pos: new THREE.Vector3(-15, 18, 24), color: 0x10b981 }
    ];

    beaconDefs.forEach((def, index) => {
      const beaconGroup = new THREE.Group();
      beaconGroup.position.copy(def.pos);

      // Holographic Navigation Ring (Ship flies through/near it)
      const ringGeo = new THREE.TorusGeometry(3.4, 0.15, 12, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.85,
        wireframe: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      beaconGroup.add(ringMesh);

      // Inner pulsating holographic chevron/ring
      const innerRingGeo = new THREE.RingGeometry(2.4, 2.6, 24);
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide
      });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      beaconGroup.add(innerRing);

      // Ground Anchor Pylon with Laser Projector
      const anchorPylonGeo = new THREE.CylinderGeometry(0.2, 0.4, def.pos.y, 8);
      const anchorPylonMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.7,
        roughness: 0.3
      });
      const anchorPylon = new THREE.Mesh(anchorPylonGeo, anchorPylonMat);
      anchorPylon.position.set(0, -def.pos.y / 2, 0);
      beaconGroup.add(anchorPylon);

      // Laser guide beam shooting up into the center of the ring
      const beamGeo = new THREE.CylinderGeometry(0.06, 0.06, def.pos.y, 6);
      const beamMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.35
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, -def.pos.y / 2, 0);
      beaconGroup.add(beam);

      // Beacon Point Light
      const beaconLight = new THREE.PointLight(def.color, 12, 14, 1.5);
      beaconGroup.add(beaconLight);

      this.waypoints.push({
        index,
        name: def.name,
        group: beaconGroup,
        ring: ringMesh,
        innerRing: innerRing,
        light: beaconLight,
        baseColor: def.color,
        pos: def.pos,
        cleared: false
      });

      this.group.add(beaconGroup);
    });
  }

  update(time, delta) {
    // Rotate radar dish on control tower
    this.rotatingRadars.forEach(radar => {
      radar.rotation.y = time * 0.8;
    });

    // Animate navigation waypoint rings (gentle rotation and pulse)
    this.waypoints.forEach((wp, idx) => {
      wp.ring.rotation.z = time * 0.8 + idx;
      wp.innerRing.rotation.z = -time * 0.5 + idx;

      const pulse = 0.75 + Math.sin(time * 3.0 + idx) * 0.25;
      wp.innerRing.scale.setScalar(pulse);

      if (wp.cleared) {
        // Bright victory pulse
        wp.light.intensity = 25.0;
      } else {
        wp.light.intensity = 10.0 + pulse * 4.0;
      }
    });
  }

  triggerWaypointClear(index) {
    if (this.waypoints[index]) {
      this.waypoints[index].cleared = true;
      setTimeout(() => {
        if (this.waypoints[index]) this.waypoints[index].cleared = false;
      }, 2500);
    }
  }

  resetWaypoints() {
    this.waypoints.forEach(wp => {
      wp.cleared = false;
    });
  }
}
