import * as THREE from 'three';

/**
 * Creates the daytime sky, lighting, high-tech landing pad, and surrounding landscape scenery.
 */
export function createEnvironment(scene) {
  // 1. Atmosphere and Fog
  scene.background = new THREE.Color(0xb9e2fe);
  scene.fog = new THREE.FogExp2(0xcbe5ff, 0.0045);

  // 2. Daytime Lighting
  const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
  sunLight.position.set(45, 65, 35);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -50;
  sunLight.shadow.camera.right = 50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);

  const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0xc2a67e, 1.1);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // 3. Sky Dome & Clouds
  createSkyDome(scene);
  const cloudGroup = createScatteredClouds(scene);

  // 4. Terrain & Ground
  createTerrain(scene);

  // 5. Landing Pad
  const padData = createLandingPad(scene);

  // 6. Surrounding Scenery (Telemetry mast, hangar dome, wind turbines)
  const sceneryData = createSurroundingScenery(scene);

  return {
    update: (elapsedSec) => {
      // Rotate radar dish
      if (sceneryData.radarDish) {
        sceneryData.radarDish.rotation.y = elapsedSec * 0.8;
      }
      // Rotate wind turbines
      if (sceneryData.turbineRotors) {
        sceneryData.turbineRotors.forEach((rotor, i) => {
          rotor.rotation.z = elapsedSec * (1.2 + i * 0.2);
        });
      }
      // Pulse landing pad perimeter lights
      if (padData.padLights) {
        const pulse = 0.5 + Math.sin(elapsedSec * 3) * 0.5;
        padData.padLights.forEach((lightMesh) => {
          lightMesh.material.opacity = 0.4 + pulse * 0.6;
        });
      }
      // Slowly drift clouds
      if (cloudGroup) {
        cloudGroup.rotation.y = elapsedSec * 0.005;
      }
    }
  };
}

function createSkyDome(scene) {
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
    uniform vec3 horizonColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + offset).y;
      vec3 col = mix(horizonColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));
      if (h < 0.0) col = mix(horizonColor, bottomColor, min(-h * 4.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const uniforms = {
    topColor: { value: new THREE.Color(0x38bdf8) },      // Vibrant sky blue
    horizonColor: { value: new THREE.Color(0xdbeafe) },  // Soft light horizon
    bottomColor: { value: new THREE.Color(0xb09572) },   // Warm ground tone
    offset: { value: 20 },
    exponent: { value: 0.65 }
  };

  const skyGeo = new THREE.SphereGeometry(220, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.BackSide
  });

  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
}

function createScatteredClouds(scene) {
  const group = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.8
  });

  const puffGeo = new THREE.DodecahedronGeometry(6, 1);

  // Create 6 cloud clusters high up in sky
  for (let c = 0; c < 7; c++) {
    const angle = (c / 7) * Math.PI * 2 + Math.random() * 0.4;
    const radius = 90 + Math.random() * 50;
    const cy = 48 + Math.random() * 20;

    const cluster = new THREE.Group();
    cluster.position.set(Math.cos(angle) * radius, cy, Math.sin(angle) * radius);

    // 4-5 puffs per cluster
    for (let p = 0; p < 5; p++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 14
      );
      puff.scale.set(1 + Math.random() * 0.5, 0.6 + Math.random() * 0.4, 1 + Math.random() * 0.5);
      cluster.add(puff);
    }
    group.add(cluster);
  }

  scene.add(group);
  return group;
}

function createTerrain(scene) {
  // Main ground plane with subtle stepped terrain
  const groundGeo = new THREE.PlaneGeometry(300, 300, 64, 64);
  groundGeo.rotateX(-Math.PI / 2);

  // Displace vertices to create natural rolling desert mounds
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const distFromCenter = Math.hypot(x, z);

    // Keep center area flat for landing pad & gantry
    if (distFromCenter < 14) {
      pos.setY(i, 0);
    } else {
      const mound1 = Math.sin(x * 0.035) * Math.cos(z * 0.035) * 4.5;
      const mound2 = Math.sin(x * 0.015 + 1.2) * Math.cos(z * 0.018) * 8.0;
      const ridge = Math.max(0, Math.sin(x * 0.04 - z * 0.03) * 6.0);
      const flattenFactor = Math.min(1.0, (distFromCenter - 14) / 20);
      pos.setY(i, (mound1 + mound2 + ridge) * flattenFactor);
    }
  }
  groundGeo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xc4a482,
    roughness: 0.9,
    metalness: 0.08,
    flatShading: true
  });

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // Surrounding rock outcroppings / mesas
  createRockFormations(scene);
}

function createRockFormations(scene) {
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x9c7a5b,
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true
  });

  const rockConfigs = [
    { x: 50, z: -35, sx: 18, sy: 12, sz: 14 },
    { x: -55, z: 25, sx: 16, sy: 9, sz: 16 },
    { x: 35, z: 55, sx: 22, sy: 14, sz: 20 },
    { x: -45, z: -45, sx: 20, sy: 11, sz: 18 }
  ];

  rockConfigs.forEach((cfg) => {
    const geo = new THREE.DodecahedronGeometry(1, 1);
    const rock = new THREE.Mesh(geo, rockMat);
    rock.position.set(cfg.x, cfg.sy * 0.45, cfg.z);
    rock.scale.set(cfg.sx, cfg.sy, cfg.sz);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  });
}

function createLandingPad(scene) {
  const padGroup = new THREE.Group();

  // 1. Pad Foundation Base
  const baseGeo = new THREE.CylinderGeometry(7.2, 7.8, 0.45, 32);
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Dark slate concrete
    roughness: 0.65,
    metalness: 0.35
  });
  const base = new THREE.Mesh(baseGeo, concreteMat);
  base.position.y = 0.225;
  base.castShadow = true;
  base.receiveShadow = true;
  padGroup.add(base);

  // 2. Pad Surface Deck
  const deckGeo = new THREE.CylinderGeometry(7.0, 7.0, 0.06, 32);
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.5
  });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.y = 0.45;
  deck.receiveShadow = true;
  padGroup.add(deck);

  // 3. Markings Canvas Texture (Center 'H' + concentric guidance rings + PAD-01 text)
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 1024, 1024);

  // Yellow hazard border
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 24;
  ctx.strokeRect(32, 32, 960, 960);

  // Outer circle
  ctx.beginPath();
  ctx.arc(512, 512, 460, 0, Math.PI * 2);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Dash ring
  ctx.beginPath();
  ctx.setLineDash([25, 25]);
  ctx.arc(512, 512, 360, 0, Math.PI * 2);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.setLineDash([]);

  // Inner landing target circle
  ctx.beginPath();
  ctx.arc(512, 512, 220, 0, Math.PI * 2);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 16;
  ctx.stroke();

  // Center 'H' emblem
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 220px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', 512, 512);

  // Pad designation
  ctx.font = 'bold 44px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('PAD-07 // LAUNCH-RECOVERY', 512, 850);
  ctx.fillText('AEROSPACE TEST FACILITY', 512, 175);

  const texture = new THREE.CanvasTexture(canvas);
  const markGeo = new THREE.CircleGeometry(6.9, 32);
  markGeo.rotateX(-Math.PI / 2);
  const markMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.5,
    metalness: 0.2
  });
  const markings = new THREE.Mesh(markGeo, markMat);
  markings.position.y = 0.485;
  markings.receiveShadow = true;
  padGroup.add(markings);

  // 4. Perimeter Runway Inset Lights
  const padLights = [];
  const lightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
  const lightCount = 12;

  for (let i = 0; i < lightCount; i++) {
    const angle = (i / lightCount) * Math.PI * 2;
    const x = Math.cos(angle) * 6.5;
    const z = Math.sin(angle) * 6.5;

    const lightMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x00f0ff : 0xf59e0b,
      transparent: true,
      opacity: 0.9
    });
    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
    lightMesh.position.set(x, 0.49, z);
    padGroup.add(lightMesh);
    padLights.push(lightMesh);
  }

  // 5. Blast Deflectors
  const deflectorGeo = new THREE.BoxGeometry(2.4, 0.9, 0.2);
  const deflectorMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dMesh = new THREE.Mesh(deflectorGeo, deflectorMat);
    dMesh.position.set(Math.cos(angle) * 7.8, 0.45, Math.sin(angle) * 7.8);
    dMesh.rotation.y = -angle + Math.PI / 2;
    dMesh.rotation.x = -0.3;
    dMesh.castShadow = true;
    padGroup.add(dMesh);
  }

  // 6. Access Gantry / Ramp
  const rampGeo = new THREE.BoxGeometry(3.0, 0.4, 4.0);
  rampGeo.rotateX(0.1);
  const ramp = new THREE.Mesh(rampGeo, concreteMat);
  ramp.position.set(0, 0.2, 8.8);
  ramp.receiveShadow = true;
  ramp.castShadow = true;
  padGroup.add(ramp);

  scene.add(padGroup);
  return { padGroup, padLights };
}

function createSurroundingScenery(scene) {
  const sceneryGroup = new THREE.Group();

  // 1. Operations Geodesic Dome
  const domeGeo = new THREE.SphereGeometry(6.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.3,
    roughness: 0.25
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.set(-26, 0, -22);
  dome.castShadow = true;
  dome.receiveShadow = true;
  sceneryGroup.add(dome);

  // Dome foundation ring
  const ringGeo = new THREE.CylinderGeometry(6.7, 6.7, 1.2, 24);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(-26, 0.6, -22);
  sceneryGroup.add(ring);

  // 2. Telemetry & Radar Mast
  const mastGroup = new THREE.Group();
  mastGroup.position.set(30, 0, -26);

  const mastGeo = new THREE.CylinderGeometry(0.3, 0.7, 18, 8);
  mastGeo.translate(0, 9, 0);
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.4 });
  const mast = new THREE.Mesh(mastGeo, mastMat);
  mast.castShadow = true;
  mastGroup.add(mast);

  // Rotating Radar Dish
  const dishGeo = new THREE.CylinderGeometry(2.4, 0.2, 0.5, 16);
  dishGeo.rotateX(Math.PI / 3);
  const dishMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.5, roughness: 0.3 });
  const radarDish = new THREE.Mesh(dishGeo, dishMat);
  radarDish.position.set(0, 18.2, 0);
  radarDish.castShadow = true;
  mastGroup.add(radarDish);

  // Mast Beacon
  const beaconLight = new THREE.PointLight(0xef4444, 1.5, 15);
  beaconLight.position.set(0, 19.5, 0);
  mastGroup.add(beaconLight);

  sceneryGroup.add(mastGroup);

  // 3. Futuristic Wind Turbines on the distant ridge
  const turbineRotors = [];
  const turbinePositions = [
    { x: 55, y: 3.5, z: 30 },
    { x: 68, y: 5.0, z: -12 }
  ];

  turbinePositions.forEach((pos) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(pos.x, pos.y, pos.z);

    // Tower
    const towerGeo = new THREE.CylinderGeometry(0.3, 0.7, 16, 8);
    towerGeo.translate(0, 8, 0);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.castShadow = true;
    tGroup.add(tower);

    // Nacelle
    const nacelleGeo = new THREE.BoxGeometry(0.9, 0.9, 2.2);
    const nacelle = new THREE.Mesh(nacelleGeo, towerMat);
    nacelle.position.set(0, 16, 0);
    tGroup.add(nacelle);

    // Rotor with 3 blades
    const rotorHub = new THREE.Group();
    rotorHub.position.set(0, 16, 1.1);

    const bladeGeo = new THREE.BoxGeometry(0.2, 6.5, 0.08);
    bladeGeo.translate(0, 3.25, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.z = (b / 3) * Math.PI * 2;
      rotorHub.add(blade);
    }

    tGroup.add(rotorHub);
    turbineRotors.push(rotorHub);
    sceneryGroup.add(tGroup);
  });

  scene.add(sceneryGroup);
  return { radarDish, turbineRotors };
}
