import * as THREE from 'three';
import { createPadTexture, createSolarTexture, createHazardTexture } from './textures.js';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.radarMesh = null;
    this.perimeterLights = [];
    this.pathLine = null;
    this.pathDashOffset = 0;

    this.setupLighting();
    this.setupSky();
    this.buildGround();
    this.buildLandingPad();
    this.buildControlTower();
    this.buildFuelDepot();
    this.buildSolarFarm();
    this.buildLandscapeFeatures();
  }

  setupLighting() {
    // Ambient / Skylight fill
    const hemiLight = new THREE.HemisphereLight(0xbadfff, 0x828b80, 1.1);
    hemiLight.position.set(0, 100, 0);
    this.scene.add(hemiLight);

    // Warm Sun Directional Light
    this.sunLight = new THREE.DirectionalLight(0xfff7e6, 2.3);
    this.sunLight.position.set(70, 110, 60);
    this.sunLight.castShadow = true;

    // High fidelity shadow settings covering the flight circuit
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 300;
    const d = 95;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.02;

    this.scene.add(this.sunLight);

    // Soft atmospheric distance fog
    this.scene.fog = new THREE.FogExp2(0xd6e8f7, 0.0035);
  }

  setupSky() {
    // Large hemisphere sky dome with procedural daytime sky gradient
    const skyGeo = new THREE.SphereGeometry(600, 32, 24);
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#1c62a8'); // Zenith deep sky
    grad.addColorStop(0.45, '#4f9ee8'); // Mid sky
    grad.addColorStop(0.72, '#9bd0fa'); // Near horizon
    grad.addColorStop(0.85, '#d8eefc'); // Warm haze horizon
    grad.addColorStop(1.0, '#a5b2a0'); // Ground blend
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 512);

    const skyTex = new THREE.CanvasTexture(canvas);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
    });

    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyMesh);

    // Distant soft cumulus clouds floating in the sky
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });

    const cloudGroup = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.2;
      const dist = 320 + Math.random() * 80;
      const alt = 80 + Math.random() * 50;

      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(25 + Math.random() * 20, 1), cloudMat);
      puff.position.set(Math.cos(angle) * dist, alt, Math.sin(angle) * dist);
      puff.scale.set(1.8 + Math.random(), 0.45, 1.2 + Math.random());
      cloudGroup.add(puff);
    }
    this.scene.add(cloudGroup);
  }

  buildGround() {
    // Expansive base ground
    const groundGeo = new THREE.PlaneGeometry(1200, 1200, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x5a6858, // Warm grass/semi-arid terrain
      roughness: 0.95,
      metalness: 0.05,
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Spaceport Concrete Apron & Tarmac (Center circular pad base)
    const tarmacGeo = new THREE.RingGeometry(0, 75, 48);
    const tarmacMat = new THREE.MeshStandardMaterial({
      color: 0x2d343c,
      roughness: 0.85,
      metalness: 0.1,
    });
    const tarmac = new THREE.Mesh(tarmacGeo, tarmacMat);
    tarmac.rotation.x = -Math.PI / 2;
    tarmac.position.y = 0.02;
    tarmac.receiveShadow = true;
    this.scene.add(tarmac);

    // Perimeter Access Roads / Taxiways
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x222830, roughness: 0.9 });
    const roadGeo1 = new THREE.PlaneGeometry(16, 220);
    const road1 = new THREE.Mesh(roadGeo1, roadMat);
    road1.rotation.x = -Math.PI / 2;
    road1.position.set(0, 0.03, -110);
    road1.receiveShadow = true;
    this.scene.add(road1);

    const roadGeo2 = new THREE.PlaneGeometry(140, 14);
    const road2 = new THREE.Mesh(roadGeo2, roadMat);
    road2.rotation.x = -Math.PI / 2;
    road2.position.set(70, 0.03, 30);
    road2.receiveShadow = true;
    this.scene.add(road2);
  }

  buildLandingPad() {
    this.padGroup = new THREE.Group();

    // Raised Octagonal Platform (Radius 10m, Height 0.65m)
    const baseGeo = new THREE.CylinderGeometry(10.2, 10.8, 0.65, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e242c,
      roughness: 0.5,
      metalness: 0.6,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.325;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    this.padGroup.add(baseMesh);

    // Pad Top Surface with High-Resolution Procedural Markings
    const topGeo = new THREE.CircleGeometry(10.15, 64);
    const padTex = createPadTexture();
    const topMat = new THREE.MeshStandardMaterial({
      map: padTex,
      roughness: 0.6,
      metalness: 0.3,
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.rotation.x = -Math.PI / 2;
    topMesh.position.y = 0.655;
    topMesh.receiveShadow = true;
    this.padGroup.add(topMesh);

    // Pad Outer Perimeter Glowing Inset Lights (24 fixtures)
    const lightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.12, 8);
    const lightMatGreen = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const lightMatAmber = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const r = 9.85;
      const isAmber = i % 3 === 0;
      const lightMesh = new THREE.Mesh(lightGeo, isAmber ? lightMatAmber : lightMatGreen);
      lightMesh.position.set(Math.cos(angle) * r, 0.68, Math.sin(angle) * r);
      this.padGroup.add(lightMesh);
      this.perimeterLights.push(lightMesh);
    }

    // 4 Heavy-Duty Floodlight Towers around the pad
    const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
    angles.forEach((ang) => {
      const dist = 14.5;
      const fx = Math.cos(ang) * dist;
      const fz = Math.sin(ang) * dist;

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.35, 7.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x333b45, metalness: 0.8, roughness: 0.3 })
      );
      pole.position.set(fx, 3.75, fz);
      pole.castShadow = true;
      this.padGroup.add(pole);

      // Light head
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.5, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xffb703 })
      );
      head.position.set(fx, 7.5, fz);
      head.lookAt(0, 1.5, 0);
      this.padGroup.add(head);

      // Pad spotlight
      const spot = new THREE.SpotLight(0xfffaed, 2.5, 28, Math.PI / 4, 0.5, 1.2);
      spot.position.set(fx, 7.5, fz);
      const target = new THREE.Object3D();
      target.position.set(0, 0.7, 0);
      this.scene.add(target);
      spot.target = target;
      this.scene.add(spot);
    });

    // Service Umbilical Gantry / Fuel Arm Station
    const gantry = new THREE.Group();
    gantry.position.set(-11.5, 0, 0);

    const mastGeo = new THREE.BoxGeometry(1.2, 9, 1.2);
    const gantryMat = new THREE.MeshStandardMaterial({ color: 0xcc4422, roughness: 0.4 });
    const mast = new THREE.Mesh(mastGeo, gantryMat);
    mast.position.y = 4.5;
    mast.castShadow = true;
    gantry.add(mast);

    const armGeo = new THREE.BoxGeometry(5.2, 0.45, 0.6);
    const arm = new THREE.Mesh(armGeo, gantryMat);
    arm.position.set(2.4, 7.0, 0);
    gantry.add(arm);

    // Gantry warning beacon
    const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 9.2, 0);
    gantry.add(beacon);

    this.padGroup.add(gantry);
    this.scene.add(this.padGroup);
  }

  buildControlTower() {
    this.towerGroup = new THREE.Group();
    this.towerGroup.position.set(38, 0, 36);

    const towerMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.35, metalness: 0.2 });
    const darkTowerMat = new THREE.MeshStandardMaterial({ color: 0x222a35, roughness: 0.5, metalness: 0.5 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f2d4a,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8,
      transparent: true,
      opacity: 0.85,
    });

    // Tower base shaft
    const shaftGeo = new THREE.CylinderGeometry(3.2, 4.2, 20, 16);
    const shaft = new THREE.Mesh(shaftGeo, towerMat);
    shaft.position.y = 10;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    this.towerGroup.add(shaft);

    // Support buttresses
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(1.0, 14, 2.5), darkTowerMat);
      buttress.position.set(Math.cos(angle) * 3.6, 7, Math.sin(angle) * 3.6);
      buttress.rotation.y = angle;
      buttress.castShadow = true;
      this.towerGroup.add(buttress);
    }

    // Observation deck cupola (panoramic viewing room)
    const cupolaFloor = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 3.8, 1.2, 16), darkTowerMat);
    cupolaFloor.position.y = 20.6;
    this.towerGroup.add(cupolaFloor);

    const glassGeo = new THREE.CylinderGeometry(5.6, 5.4, 2.8, 16, 1, true);
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.y = 22.4;
    this.towerGroup.add(glass);

    const roofGeo = new THREE.ConeGeometry(6.2, 1.6, 16);
    const roof = new THREE.Mesh(roofGeo, darkTowerMat);
    roof.position.y = 24.6;
    this.towerGroup.add(roof);

    // Rotating Radar Dish on roof
    this.radarGroup = new THREE.Group();
    this.radarGroup.position.set(0, 25.6, 0);

    const dishPole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 8), darkTowerMat);
    dishPole.position.y = 0.7;
    this.radarGroup.add(dishPole);

    const dishGeo = new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.35);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4, side: THREE.DoubleSide });
    this.radarMesh = new THREE.Mesh(dishGeo, dishMat);
    this.radarMesh.position.set(0, 1.8, 0);
    this.radarMesh.rotation.x = Math.PI * 0.35;
    this.radarGroup.add(this.radarMesh);

    this.towerGroup.add(this.radarGroup);
    this.scene.add(this.towerGroup);
  }

  buildFuelDepot() {
    this.fuelGroup = new THREE.Group();
    this.fuelGroup.position.set(-38, 0, -42);

    const whiteTankMat = new THREE.MeshStandardMaterial({ color: 0xf0f3f6, roughness: 0.25, metalness: 0.2 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x48525e, roughness: 0.4, metalness: 0.8 });

    // 2 Cryogenic Spherical Fuel Tanks
    [-7, 7].forEach((xOffset) => {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(4.8, 24, 20), whiteTankMat);
      sphere.position.set(xOffset, 5.8, 0);
      sphere.castShadow = true;
      this.fuelGroup.add(sphere);

      // Support legs
      for (let j = 0; j < 4; j++) {
        const a = (j * Math.PI) / 2 + Math.PI / 4;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 4.5, 8), metalMat);
        leg.position.set(xOffset + Math.cos(a) * 3.4, 2.2, Math.sin(a) * 3.4);
        leg.rotation.z = -Math.cos(a) * 0.15;
        leg.rotation.x = Math.sin(a) * 0.15;
        this.fuelGroup.add(leg);
      }
    });

    // Connecting pipes and manifold
    const pipeGeo = new THREE.CylinderGeometry(0.35, 0.35, 14, 12);
    pipeGeo.rotateZ(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, metalMat);
    pipe.position.set(0, 5.8, 0);
    this.fuelGroup.add(pipe);

    this.scene.add(this.fuelGroup);
  }

  buildSolarFarm() {
    this.solarGroup = new THREE.Group();
    this.solarGroup.position.set(48, 0, -28);

    const solarTex = createSolarTexture();
    const solarMat = new THREE.MeshStandardMaterial({
      map: solarTex,
      roughness: 0.2,
      metalness: 0.7,
    });
    const standMat = new THREE.MeshStandardMaterial({ color: 0x3d4652, roughness: 0.6, metalness: 0.5 });

    // Grid of solar arrays (3 rows x 4 columns)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const panelGroup = new THREE.Group();
        panelGroup.position.set((c - 1.5) * 8.5, 0, (r - 1) * 9.5);

        // Panel stand
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.0, 8), standMat);
        post.position.y = 1.0;
        panelGroup.add(post);

        // Solar surface tilted 35 degrees toward the sun
        const panel = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.15, 4.2), solarMat);
        panel.position.y = 2.0;
        panel.rotation.x = -0.45;
        panel.rotation.y = 0.3;
        panel.castShadow = true;
        panelGroup.add(panel);

        this.solarGroup.add(panelGroup);
      }
    }

    this.scene.add(this.solarGroup);
  }

  buildLandscapeFeatures() {
    // Distant scenic hills / mountain mesas around the perimeter for depth perception
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x51604f,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });

    const hillGroup = new THREE.Group();
    const hills = [
      { x: -140, z: -160, r: 55, h: 48 },
      { x: 160, z: -150, r: 65, h: 56 },
      { x: 190, z: 120, r: 75, h: 62 },
      { x: -180, z: 90, r: 60, h: 52 },
      { x: 0, z: 230, r: 85, h: 58 },
      { x: 230, z: 0, r: 70, h: 64 },
    ];

    hills.forEach((h) => {
      const geo = new THREE.ConeGeometry(h.r, h.h, 7);
      const mesh = new THREE.Mesh(geo, hillMat);
      mesh.position.set(h.x, h.h * 0.45, h.z);
      mesh.scale.set(1 + Math.random() * 0.3, 1, 0.9 + Math.random() * 0.4);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      hillGroup.add(mesh);
    });
    this.scene.add(hillGroup);

    // Weather Anemometer / Telemetry Mast near pad
    const mast = new THREE.Group();
    mast.position.set(-24, 0, 22);
    const mastPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.2, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7 })
    );
    mastPole.position.y = 6;
    mast.add(mastPole);

    const mastLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3300 })
    );
    mastLight.position.y = 12.1;
    mast.add(mastLight);
    this.scene.add(mast);
  }

  createFlightPathVisualizer(points) {
    if (this.pathLine) {
      this.scene.remove(this.pathLine);
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const divisions = 250;
    const pathPoints = curve.getPoints(divisions);
    const geo = new THREE.BufferGeometry().setFromPoints(pathPoints);

    // Glowing cyan dotted/dashed trajectory line
    const mat = new THREE.LineDashedMaterial({
      color: 0x00f0ff,
      dashSize: 2.2,
      gapSize: 1.2,
      linewidth: 3,
      transparent: true,
      opacity: 0.8,
    });

    this.pathLine = new THREE.Line(geo, mat);
    this.pathLine.computeLineDistances();
    this.scene.add(this.pathLine);
    return this.pathLine;
  }

  setPathVisible(visible) {
    if (this.pathLine) {
      this.pathLine.visible = visible;
    }
  }

  update(delta) {
    // Rotate tower radar dish
    if (this.radarMesh) {
      this.radarMesh.rotation.y += delta * 1.6;
    }

    // Pulse perimeter lights
    const time = Date.now() * 0.003;
    const pulseFactor = 0.7 + 0.3 * Math.sin(time);
    this.perimeterLights.forEach((light, i) => {
      const phase = (time + i * 0.2) % (Math.PI * 2);
      const isLit = Math.sin(phase) > 0;
      light.visible = isLit;
    });
  }
}
