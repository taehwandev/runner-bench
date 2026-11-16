import * as THREE from 'three';

export const LANE_WIDTH = 2.3;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];

export const DISTRICTS = [
  {
    name: 'SHIBUYA NEON CORE',
    fog: 0x050819,
    skyHorizon: 0x162d66,
    lamp: 0x7ce8ff,
    accent: 0xff1e8a,
    hemiSky: 0x264899,
    hemiGround: 0x140824
  },
  {
    name: 'HARBOR CONSTRUCTION',
    fog: 0x110c16,
    skyHorizon: 0x4d2a12,
    lamp: 0xffbe55,
    accent: 0x00f0ff,
    hemiSky: 0x6e431c,
    hemiGround: 0x0c1624
  },
  {
    name: 'CRIMSON TRANSIT LINE',
    fog: 0x140617,
    skyHorizon: 0x521038,
    lamp: 0xff4d88,
    accent: 0xffc400,
    hemiSky: 0x6e194b,
    hemiGround: 0x120824
  },
  {
    name: 'HYPERION CYBER PLAZA',
    fog: 0x051316,
    skyHorizon: 0x104d3e,
    lamp: 0x4dffb8,
    accent: 0xb65cff,
    hemiSky: 0x186b56,
    hemiGround: 0x140929
  }
];

export class ParticlePool {
  constructor(scene, maxCount = 240) {
    this.maxCount = maxCount;
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < maxCount; i++) {
      this.mesh.setColorAt(i, white);
    }
    scene.add(this.mesh);

    this.items = Array.from({ length: maxCount }, () => ({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      life: 0,
      maxLife: 1,
      scale: 1,
      gravity: -18
    }));
    this.cursor = 0;
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
  }

  emit(x, y, z, count, opts = {}) {
    const {
      color = 0x00f0ff,
      altColor = null,
      speed = 6,
      upBias = 3.5,
      spreadZ = 1,
      scale = 1,
      life = 0.55,
      gravity = -20
    } = opts;

    let colorDirty = false;
    for (let n = 0; n < count; n++) {
      const p = this.items[this.cursor];
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.maxCount;

      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.85);
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.35;
      p.y = Math.max(0.08, y + (Math.random() - 0.5) * 0.35);
      p.z = z + (Math.random() - 0.5) * 0.35;
      p.vx = Math.cos(angle) * spd;
      p.vy = upBias * (0.4 + Math.random() * 0.9) + Math.abs(Math.sin(angle)) * spd * 0.35;
      p.vz = (Math.random() - 0.3) * spd * spreadZ;
      p.rx = Math.random() * 6;
      p.ry = Math.random() * 6;
      p.maxLife = life * (0.7 + Math.random() * 0.5);
      p.life = p.maxLife;
      p.scale = scale * (0.65 + Math.random() * 0.7);
      p.gravity = gravity;

      const chosen = altColor && Math.random() < 0.42 ? altColor : color;
      this._color.setHex(chosen);
      this.mesh.setColorAt(idx, this._color);
      colorDirty = true;
    }

    if (colorDirty && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  update(dt, worldSpeed) {
    const dummy = this._dummy;
    for (let i = 0; i < this.maxCount; i++) {
      const p = this.items[i];
      if (!p.active) {
        dummy.position.set(0, -200, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        dummy.position.set(0, -200, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += (p.vz + worldSpeed * 0.45) * dt;

      if (p.y < 0.06) {
        p.y = 0.06;
        p.vy = Math.abs(p.vy) * 0.42;
        p.vx *= 0.85;
      }

      p.rx += dt * 9;
      p.ry += dt * 11;
      const t = p.life / p.maxLife;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, 0);
      dummy.scale.setScalar(Math.max(0.01, p.scale * t));
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const p of this.items) p.active = false;
  }
}

export class CityWorld {
  constructor(scene, factory, textures, sound) {
    this.scene = scene;
    this.factory = factory;
    this.tex = textures;
    this.sound = sound;

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    this.obstacles = [];
    this.shards = [];
    this.powerups = [];
    this.setPieces = [];

    this.roadScroll = 0;
    this.spawnCursorZ = -26;
    this.chunkCounter = 0;
    this.powerupTypes = ['shield', 'magnet', 'dash', 'chrono'];
    this.nextPowerupIndex = 0;
    this.lastSafeLane = 0;

    this.currentDistrictIdx = 0;
    this.inTunnel = false;

    this._buildLightingAndAtmosphere();
    this._buildRoadAndSidewalks();
    this._buildSkylineBackdrop();
    this._buildSceneryPools();
    this._buildRainParticles();

    this.particles = new ParticlePool(this.scene, 240);
  }

  _buildLightingAndAtmosphere() {
    const d = DISTRICTS[0];
    this.scene.background = new THREE.Color(d.fog);
    this.scene.fog = new THREE.FogExp2(d.fog, 0.0115);

    this.hemiLight = new THREE.HemisphereLight(d.hemiSky, d.hemiGround, 1.15);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xaad8ff, 0.95);
    this.dirLight.position.set(12, 26, 18);
    this.scene.add(this.dirLight);

    // Subtle neon bounce light hovering ahead of the runner
    this.streetBounceLight = new THREE.PointLight(0x00f0ff, 2.2, 28, 1.5);
    this.streetBounceLight.position.set(0, 4.2, -8);
    this.scene.add(this.streetBounceLight);

    this._fogTarget = new THREE.Color(d.fog);
    this._horizonTarget = new THREE.Color(d.skyHorizon);
    this._lampTarget = new THREE.Color(d.lamp);
    this._hemiSkyTarget = new THREE.Color(d.hemiSky);
  }

  _buildRoadAndSidewalks() {
    const roadLen = 240;
    this.tex.road.map.repeat.set(1, 14);
    this.tex.road.roughnessMap.repeat.set(1, 14);
    this.tex.road.bumpMap.repeat.set(1, 14);

    this.roadMat = new THREE.MeshStandardMaterial({
      map: this.tex.road.map,
      roughnessMap: this.tex.road.roughnessMap,
      bumpMap: this.tex.road.bumpMap,
      bumpScale: 0.016,
      roughness: 0.85,
      metalness: 0.35,
      envMapIntensity: 1.55
    });

    const roadGeo = new THREE.PlaneGeometry(8.6, roadLen);
    roadGeo.rotateX(-Math.PI / 2);
    this.roadMesh = new THREE.Mesh(roadGeo, this.roadMat);
    this.roadMesh.position.set(0, 0, -95);
    this.worldGroup.add(this.roadMesh);

    // Left & Right Raised Wet Sidewalks
    this.tex.sidewalk.repeat.set(2, 26);
    this.sidewalkMat = new THREE.MeshStandardMaterial({
      map: this.tex.sidewalk,
      roughness: 0.32,
      metalness: 0.28,
      envMapIntensity: 1.1
    });

    const swGeo = new THREE.BoxGeometry(6.5, 0.24, roadLen);
    const swLeft = new THREE.Mesh(swGeo, this.sidewalkMat);
    swLeft.position.set(-7.55, 0.12, -95);

    const swRight = new THREE.Mesh(swGeo, this.sidewalkMat);
    swRight.rotation.y = Math.PI;
    swRight.position.set(7.55, 0.12, -95);

    this.worldGroup.add(swLeft, swRight);

    // Outer dark groundskirt so there is never an empty void beyond buildings
    const groundSkirt = new THREE.Mesh(
      new THREE.PlaneGeometry(120, roadLen),
      new THREE.MeshBasicMaterial({ color: 0x040610 })
    );
    groundSkirt.rotation.x = -Math.PI / 2;
    groundSkirt.position.set(0, -0.05, -95);
    this.worldGroup.add(groundSkirt);
  }

  _buildSkylineBackdrop() {
    this.skylineGroup = new THREE.Group();
    this.skylineGroup.position.set(0, 0, -192);
    this.scene.add(this.skylineGroup);

    // Glowing horizon aura disc
    this.horizonGlowMat = new THREE.SpriteMaterial({
      map: this.tex.glowSprite,
      color: DISTRICTS[0].skyHorizon,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const horizonSprite = new THREE.Sprite(this.horizonGlowMat);
    horizonSprite.scale.set(175, 78, 1);
    horizonSprite.position.set(0, 18, -8);
    this.skylineGroup.add(horizonSprite);

    // Giant Cyber-Moon / Synth Sun high over downtown skyline
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(13, 32),
      new THREE.MeshBasicMaterial({ color: 0xff2e93, transparent: true, opacity: 0.42, fog: false })
    );
    moon.position.set(0, 36, -6);
    this.skylineGroup.add(moon);

    const moonRing = new THREE.Mesh(
      new THREE.RingGeometry(14.5, 15.2, 40),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.55, fog: false })
    );
    moonRing.position.set(0, 36, -5.8);
    this.skylineGroup.add(moonRing);

    // Distant Megatower Silhouettes
    const towerMat = new THREE.MeshBasicMaterial({ color: 0x070c1f, fog: false });
    const crestColors = [0x00f0ff, 0xff1e8a, 0xffc400, 0xb65cff];
    for (let i = -8; i <= 8; i++) {
      if (Math.abs(i) <= 1) continue; // Keep road vanishing point framed!
      const h = 24 + ((Math.abs(i) * 13) % 34);
      const w = 5.5 + (Math.abs(i) % 3) * 2.2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), towerMat);
      m.position.set(i * 6.8, h * 0.5, (Math.abs(i) % 2) * -4);
      this.skylineGroup.add(m);

      const crest = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.86, 0.45, 4.1),
        new THREE.MeshBasicMaterial({ color: crestColors[Math.abs(i) % crestColors.length], fog: false })
      );
      crest.position.set(i * 6.8, h - 0.6, m.position.z);
      this.skylineGroup.add(crest);
    }
  }

  _buildSceneryPools() {
    this.buildings = [];
    this.buildingSpacing = 15.5;
    this.numBuildingsPerSide = 13;
    const totalSpan = this.buildingSpacing * this.numBuildingsPerSide;

    for (let side of [-1, 1]) {
      for (let i = 0; i < this.numBuildingsPerSide; i++) {
        const b = this.factory.createBuildingSlot(i + (side > 0 ? 3 : 0), side);
        const z = 20 - i * this.buildingSpacing;
        b.baseX = side * 9.35;
        b.group.position.set(b.baseX, 0, z);
        this.worldGroup.add(b.group);
        this.buildings.push({ ...b, side, totalSpan });
      }
    }

    this.lamps = [];
    this.lampSpacing = 18;
    this.numLampsPerSide = 11;
    const lampSpan = this.lampSpacing * this.numLampsPerSide;

    for (let side of [-1, 1]) {
      for (let i = 0; i < this.numLampsPerSide; i++) {
        const l = this.factory.createStreetLamp(side);
        const z = 18 - i * this.lampSpacing - (side > 0 ? 9 : 0);
        l.baseX = side * 4.65;
        l.group.position.set(l.baseX, 0, z);
        this.worldGroup.add(l.group);
        this.lamps.push({ ...l, side, totalSpan: lampSpan });
      }
    }
  }

  _buildRainParticles() {
    const count = 130;
    const positions = new Float32Array(count * 6);
    this.rainSeeds = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 20;
      const y = Math.random() * 14;
      const z = 10 - Math.random() * 95;
      this.rainSeeds.push({ x, y, z });
      const idx = i * 6;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      positions[idx + 3] = x - 0.08;
      positions[idx + 4] = y - 0.85;
      positions[idx + 5] = z + 0.35;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x7fd8ff,
      transparent: true,
      opacity: 0.24
    });
    this.rainLines = new THREE.LineSegments(geo, mat);
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);
  }

  // ================= RESET & STREAMING DIRECTOR =================
  reset() {
    for (const o of this.obstacles) this.worldGroup.remove(o.mesh);
    for (const s of this.shards) this.worldGroup.remove(s.group);
    for (const p of this.powerups) this.worldGroup.remove(p.group);
    for (const sp of this.setPieces) this.worldGroup.remove(sp.group);

    this.obstacles.length = 0;
    this.shards.length = 0;
    this.powerups.length = 0;
    this.setPieces.length = 0;
    this.particles.clear();

    this.spawnCursorZ = -26;
    this.chunkCounter = 0;
    this.lastSafeLane = 0;
    this.inTunnel = false;
    this.setDistrict(0, true);

    // Pre-fill initial horizon out to z = -195
    while (this.spawnCursorZ > -195) {
      this._spawnNextChunk(0);
    }
  }

  setDistrict(idx, immediate = false) {
    const wrapped = idx % DISTRICTS.length;
    this.currentDistrictIdx = wrapped;
    const d = DISTRICTS[wrapped];
    this._fogTarget.setHex(d.fog);
    this._horizonTarget.setHex(d.skyHorizon);
    this._lampTarget.setHex(d.lamp);
    this._hemiSkyTarget.setHex(d.hemiSky);
    this.streetBounceLight.color.setHex(d.accent);

    if (immediate) {
      this.scene.background.copy(this._fogTarget);
      this.scene.fog.color.copy(this._fogTarget);
      this.horizonGlowMat.color.copy(this._horizonTarget);
      this.hemiLight.color.copy(this._hemiSkyTarget);
      for (const l of this.lamps) {
        l.bulbMat.color.copy(this._lampTarget);
        l.glow.material.color.copy(this._lampTarget);
        l.streak.material.color.copy(this._lampTarget);
      }
    }
    return d.name;
  }

  // ---- Obstacle / Collectible Helpers ----
  _addVehicle(laneIdx, z, variant = 'taxi', mode = 'static', extraOpts = {}) {
    const oncoming = mode === 'oncoming';
    const built = this.factory.createVehicle(variant, oncoming);
    const x = LANES[laneIdx + 1];
    built.root.position.set(x, 0, z);
    this.worldGroup.add(built.root);

    this.obstacles.push({
      kind: 'full',
      subType: variant,
      mesh: built.root,
      lane: laneIdx,
      targetLane: extraOpts.targetLane !== undefined ? extraOpts.targetLane : laneIdx,
      x,
      z,
      width: built.width * 0.78, // Fair forgiving hitbox
      nearWidth: built.width * 1.38,
      height: built.height,
      bottomY: 0,
      length: built.length * 0.86,
      relSpeedZ: mode === 'oncoming' ? (extraOpts.speed || 9.0) : mode === 'weaver' ? -5.5 : 0,
      isWeaver: mode === 'weaver',
      blinkers: built.blinkers,
      hornPlayed: false,
      nearMissed: false,
      smashed: false
    });
  }

  _addLowBarrier(laneIdx, z, style = 'jersey') {
    const built = this.factory.createLowBarrier(style);
    const x = LANES[laneIdx + 1];
    built.root.position.set(x, 0, z);
    this.worldGroup.add(built.root);

    this.obstacles.push({
      kind: 'low',
      subType: 'barrier',
      mesh: built.root,
      lane: laneIdx,
      targetLane: laneIdx,
      x,
      z,
      width: 1.54,
      nearWidth: 2.1,
      height: 0.72, // Generous jump clearance at high speed!
      bottomY: 0,
      length: 0.65,
      relSpeedZ: 0,
      isWeaver: false,
      nearMissed: false,
      smashed: false
    });
  }

  _addHighGate(laneIdx, z) {
    const built = this.factory.createHighSlideGate();
    const x = LANES[laneIdx + 1];
    built.root.position.set(x, 0, z);
    this.worldGroup.add(built.root);

    this.obstacles.push({
      kind: 'high',
      subType: 'slideGate',
      mesh: built.root,
      lane: laneIdx,
      targetLane: laneIdx,
      x,
      z,
      width: 1.62,
      nearWidth: 2.1,
      height: built.topY,
      bottomY: 1.02, // Sliding (runner top ~0.72m) clears easily; standing (1.70m) hits!
      length: 0.55,
      relSpeedZ: 0,
      isWeaver: false,
      nearMissed: false,
      smashed: false
    });
  }

  _addMetroCar(laneIdx, z) {
    const built = this.factory.createMetroTrainCar();
    const x = LANES[laneIdx + 1];
    built.root.position.set(x, 0, z);
    this.worldGroup.add(built.root);

    this.obstacles.push({
      kind: 'full',
      subType: 'train',
      mesh: built.root,
      lane: laneIdx,
      targetLane: laneIdx,
      x,
      z,
      width: 1.72,
      nearWidth: 2.35,
      height: built.height,
      bottomY: 0,
      length: built.length * 0.85,
      relSpeedZ: 0,
      isWeaver: false,
      nearMissed: false,
      smashed: false
    });
  }

  _addShardLine(laneIdx, zStart, count, spacing = 3.2, mode = 'flat', isRisk = false) {
    const x = LANES[laneIdx + 1];
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      let y = 0.88;
      if (mode === 'arc') {
        y = 0.88 + Math.sin(t * Math.PI) * 1.55;
      } else if (mode === 'low') {
        y = 0.48;
      }
      const riskHere = isRisk || (mode === 'arc' && i === Math.floor(count / 2) && count >= 5);
      const s = this.factory.createShard(riskHere);
      const sz = zStart - i * spacing;
      s.group.position.set(x, y, sz);
      this.worldGroup.add(s.group);
      this.shards.push({
        group: s.group,
        crystal: s.crystal,
        isRisk: riskHere,
        x,
        y,
        baseY: y,
        z: sz,
        phase: i * 0.55,
        collected: false
      });
    }
  }

  _addSingleRiskCore(laneIdx, z, y = 0.95) {
    const x = LANES[laneIdx + 1];
    const s = this.factory.createShard(true);
    s.group.position.set(x, y, z);
    this.worldGroup.add(s.group);
    this.shards.push({
      group: s.group,
      crystal: s.crystal,
      isRisk: true,
      x,
      y,
      baseY: y,
      z,
      phase: Math.random() * 4,
      collected: false
    });
  }

  _addPowerUp(laneIdx, z, y = 1.05, forcedType = null) {
    const type = forcedType || this.powerupTypes[this.nextPowerupIndex % this.powerupTypes.length];
    this.nextPowerupIndex++;
    const p = this.factory.createPowerUp(type);
    const x = LANES[laneIdx + 1];
    p.group.position.set(x, y, z);
    this.worldGroup.add(p.group);
    this.powerups.push({
      ...p,
      x,
      y,
      baseY: y,
      z,
      collected: false
    });
  }

  // ================= GUARANTEED-FAIR PATTERN DIRECTOR =================
  _spawnNextChunk(distance) {
    const idx = this.chunkCounter++;
    const z0 = this.spawnCursorZ;
    const difficulty = Math.min(1, distance / 1500);

    // Choose next guaranteed safe spine lane (-1, 0, or +1) within 1 step of lastSafeLane
    const candidates = [-1, 0, 1].filter((l) => Math.abs(l - this.lastSafeLane) <= 1);
    const safeLane = candidates[Math.floor(Math.random() * candidates.length)];
    const otherLanes = [-1, 0, 1].filter((l) => l !== safeLane);

    // ---- CHUNK 0: Immediate Dopamine Launch Runway (0 - 2.5s) ----
    if (idx === 0) {
      this._addShardLine(0, z0 - 2, 6, 3.4, 'flat');
      this._addLowBarrier(-1, z0 - 12, 'jersey');
      this._addShardLine(-1, z0 - 7, 5, 2.5, 'arc');
      this._addVehicle(1, z0 - 14, 'taxi', 'static');
      this._addSingleRiskCore(1, z0 - 8.5, 0.95); // Risk core right before parked taxi!
      this.spawnCursorZ = z0 - 28;
      this.lastSafeLane = 0;
      return;
    }

    // ---- CHUNK 1: Bustling Side Traffic + Center Jump Intro (~2.5 - 5.2s) ----
    if (idx === 1) {
      // Side action from z = -54..-80 while center lane stays clear until ~z = -96 (~4.4s)
      this._addHighGate(1, z0 - 10);
      this._addShardLine(1, z0 - 6, 4, 2.5, 'low'); // Slide under laser gate!
      this._addVehicle(-1, z0 - 14, 'taxi', 'oncoming', { speed: 7.5 });
      this._addShardLine(0, z0 - 10, 4, 3.2, 'flat');

      // First mandatory center-lane action at z = -96 (~4.45s): Jump barrier + Shard Arc!
      this._addLowBarrier(0, z0 - 42, 'jersey');
      this._addShardLine(0, z0 - 36, 5, 2.8, 'arc');
      this._addVehicle(-1, z0 - 43, 'bus', 'static');
      this._addSingleRiskCore(-1, z0 - 37.5, 0.95);
      this.spawnCursorZ = z0 - 52;
      this.lastSafeLane = 1;
      return;
    }

    // ---- CHUNK 2: Highway Overpass + First Guaranteed Power-Up + Oncoming Taxi (5.5 - 9s) ----
    if (idx === 2) {
      const op = this.factory.createOverpassProp();
      op.group.position.set(0, 0, z0 - 16);
      this.worldGroup.add(op.group);
      this.setPieces.push({ kind: 'overpass', group: op.group, upperCar: op.upperCar, z: z0 - 16, length: 10 });

      // Spawn first Power-Up prominently in center/safe lane, flanked by traffic!
      this._addPowerUp(0, z0 - 12, 1.05, 'magnet');
      this._addVehicle(-1, z0 - 24, 'taxi', 'oncoming', { speed: 8.0 });
      this._addLowBarrier(1, z0 - 14, 'bollard');
      this._addShardLine(1, z0 - 22, 4, 2.8, 'flat');
      this.spawnCursorZ = z0 - 34;
      this.lastSafeLane = 0;
      return;
    }

    // ---- CHUNK 3: Construction Gauntlet + Lane-Weaving Sports Coupe (9 - 14s) ----
    if (idx === 3) {
      // Weaver coupe signals blinker from lane 0 -> lane -1, leaving lane +1 & post-merge lane 0 open!
      this._addVehicle(0, z0 - 26, 'coupe', 'weaver', { targetLane: -1 });
      this._addSingleRiskCore(-1, z0 - 16, 0.95);
      this._addHighGate(1, z0 - 10);
      this._addShardLine(1, z0 - 6, 4, 2.6, 'low');
      this._addLowBarrier(1, z0 - 26, 'jersey');
      this._addShardLine(1, z0 - 21, 5, 2.5, 'arc');
      this.spawnCursorZ = z0 - 48;
      this.lastSafeLane = 1;
      return;
    }

    // ---- CHUNK 4: Metro Rail Crossing Set-Piece (14 - 19s) ----
    if (idx === 4) {
      this._spawnRailCrossingChunk(z0, 0, true);
      return;
    }

    // ---- CHUNK 5: Subterranean Neon Tunnel + Second Power-Up (19 - 26s) ----
    if (idx === 5) {
      this._spawnTunnelChunk(z0, safeLane, true);
      return;
    }

    // ---- PROCEDURAL VARIETY DIRECTOR (Beyond 25s, scaling smoothly with distance) ----
    const spawnPowerupNow = idx % 4 === 2;
    const roll = Math.random();

    if (roll < 0.16) {
      this._spawnTunnelChunk(z0, safeLane, spawnPowerupNow);
    } else if (roll < 0.32) {
      this._spawnRailCrossingChunk(z0, safeLane, spawnPowerupNow);
    } else if (roll < 0.52) {
      this._spawnConstructionChunk(z0, safeLane, otherLanes, difficulty, spawnPowerupNow);
    } else if (roll < 0.72) {
      this._spawnOverpassTrafficChunk(z0, safeLane, otherLanes, difficulty, spawnPowerupNow);
    } else {
      this._spawnExpresswayWeaveChunk(z0, safeLane, otherLanes, difficulty, spawnPowerupNow);
    }

    // Scale inter-chunk breathing room slightly at top highway speeds so jump arcs always land cleanly
    this.spawnCursorZ -= Math.round(difficulty * 10);
  }

  _spawnRailCrossingChunk(z0, safeLane, withPowerup) {
    const crossZ = z0 - 28;
    const rc = this.factory.createRailCrossingProp(safeLane);
    rc.group.position.set(0, 0, crossZ);
    this.worldGroup.add(rc.group);
    this.setPieces.push({
      kind: 'rail',
      group: rc.group,
      redLamps: rc.redLamps,
      safePad: rc.safePad,
      z: crossZ,
      length: 8
    });

    // Place Cyber-Metro Train Cars on the 2 blocked lanes; keep safeLane open with Risk Core / Powerup!
    for (let l of [-1, 0, 1]) {
      if (l === safeLane) {
        this._addShardLine(l, z0 - 8, 5, 3.2, 'flat');
        if (withPowerup) {
          this._addPowerUp(l, crossZ, 1.08);
        } else {
          this._addSingleRiskCore(l, crossZ, 0.98);
        }
      } else {
        this._addMetroCar(l, crossZ);
        // Place daring Risk Core right in front of the stopped/crossing train car!
        if (Math.random() < 0.65) {
          this._addSingleRiskCore(l, crossZ + 6.2, 0.95);
        }
      }
    }

    // Exit obstacle requiring jump after clearing the tracks, with generous landing runway
    this._addLowBarrier(safeLane, z0 - 43, 'bollard');
    this._addShardLine(safeLane, z0 - 38, 4, 2.6, 'arc');

    this.spawnCursorZ = z0 - 64;
    this.lastSafeLane = safeLane;
  }

  _spawnTunnelChunk(z0, safeLane, withPowerup) {
    const tunnelLen = 48;
    const centerZ = z0 - tunnelLen * 0.5 - 4;
    const tun = this.factory.createTunnelProp(tunnelLen);
    tun.group.position.set(0, 0, centerZ);
    this.worldGroup.add(tun.group);
    this.setPieces.push({
      kind: 'tunnel',
      group: tun.group,
      z: centerZ,
      length: tunnelLen
    });

    const other = [-1, 0, 1].filter((l) => l !== safeLane);
    const adjLane = other.find((l) => Math.abs(l - safeLane) === 1) ?? other[0];
    const farLane = other.find((l) => l !== adjLane) ?? other[1];

    // Wave A inside tunnel entrance
    this._addVehicle(farLane, z0 - 14, 'bus', 'static');
    this._addHighGate(safeLane, z0 - 14);
    this._addShardLine(safeLane, z0 - 10, 4, 2.6, 'low');

    // Mid-tunnel weave (1-lane adjacent shift with 22m reaction & landing spacing!)
    const midSafe = adjLane;
    this._addVehicle(safeLane, z0 - 36, 'truck', 'static');
    this._addSingleRiskCore(safeLane, z0 - 29.5, 0.95);
    this._addLowBarrier(midSafe, z0 - 36, 'bollard');
    this._addShardLine(midSafe, z0 - 31, 5, 2.6, 'arc');

    if (withPowerup) {
      this._addPowerUp(farLane, z0 - 36, 1.08);
    }

    // Tunnel exit oncoming taxi in 3rd lane (leaving midSafe 100% open for landing!)
    this._addVehicle(farLane, z0 - 50, 'taxi', 'oncoming', { speed: 8.5 });

    this.spawnCursorZ = z0 - 62;
    this.lastSafeLane = midSafe;
  }

  _spawnConstructionChunk(z0, safeLane, otherLanes, difficulty, withPowerup) {
    const adjLane = otherLanes.find((l) => Math.abs(l - safeLane) === 1) ?? otherLanes[0];
    const farLane = otherLanes.find((l) => l !== adjLane) ?? otherLanes[1];

    // Wave 1: Overhead Slide Gate in safeLane (keeps runner grounded!) + Jump Barrier in adjLane + Truck in farLane
    this._addVehicle(farLane, z0 - 14, 'truck', 'static');
    this._addSingleRiskCore(farLane, z0 - 8.0, 0.95);

    this._addHighGate(safeLane, z0 - 13);
    this._addShardLine(safeLane, z0 - 9, 4, 2.5, 'low');

    this._addLowBarrier(adjLane, z0 - 13, 'jersey');
    if (withPowerup) {
      this._addPowerUp(adjLane, z0 - 13, 2.1); // Jump barrier to snag Power-Up!
    } else {
      this._addShardLine(adjLane, z0 - 8, 5, 2.5, 'arc');
    }

    // Wave 2 (24m later — plenty of landing room regardless of Wave 1 choice!): 1-lane shift to adjLane
    const nextSafe = adjLane;
    this._addVehicle(safeLane, z0 - 37, 'bus', 'static');
    this._addSingleRiskCore(safeLane, z0 - 31, 0.95);
    this._addHighGate(nextSafe, z0 - 37);
    this._addShardLine(nextSafe, z0 - 33, 4, 2.5, 'low');
    if (difficulty > 0.25) {
      this._addLowBarrier(farLane, z0 - 37, 'bollard');
    }

    this.spawnCursorZ = z0 - 54;
    this.lastSafeLane = nextSafe;
  }

  _spawnOverpassTrafficChunk(z0, safeLane, otherLanes, difficulty, withPowerup) {
    const op = this.factory.createOverpassProp();
    op.group.position.set(0, 0, z0 - 18);
    this.worldGroup.add(op.group);
    this.setPieces.push({
      kind: 'overpass',
      group: op.group,
      upperCar: op.upperCar,
      z: z0 - 18,
      length: 10
    });

    // Lane-weaving sports coupe shifts strictly 1 lane while openCorridor remains unobstructed by full-blocks!
    const weaverStart = safeLane === 0 ? otherLanes[0] : 0;
    const weaverTarget = safeLane === 0 ? 0 : otherLanes.find((l) => l !== 0) ?? otherLanes[0];
    const openCorridor = [-1, 0, 1].find((l) => l !== weaverStart && l !== weaverTarget) ?? safeLane;

    this._addVehicle(weaverStart, z0 - 22, 'coupe', 'weaver', { targetLane: weaverTarget });
    this._addSingleRiskCore(weaverTarget, z0 - 14, 0.95);

    this._addShardLine(openCorridor, z0 - 8, 5, 3.0, 'flat');
    if (withPowerup) {
      this._addPowerUp(openCorridor, z0 - 22, 1.08);
    }

    const oncomingSpd = 8.0 + difficulty * 4.5;
    this._addVehicle(weaverStart, z0 - 40, 'taxi', 'oncoming', { speed: oncomingSpd });
    this._addLowBarrier(openCorridor, z0 - 36, 'jersey');
    this._addShardLine(openCorridor, z0 - 31, 5, 2.5, 'arc');

    this.spawnCursorZ = z0 - 58;
    this.lastSafeLane = openCorridor;
  }

  _spawnExpresswayWeaveChunk(z0, safeLane, otherLanes, difficulty, withPowerup) {
    const oncomingSpd = 8.5 + difficulty * 5.0;

    // Wave 1: Two vehicles leaving safeLane open
    this._addVehicle(otherLanes[0], z0 - 13, 'bus', 'static');
    this._addVehicle(otherLanes[1], z0 - 16, 'sedan', 'oncoming', { speed: oncomingSpd });
    this._addShardLine(safeLane, z0 - 6, 4, 2.8, 'flat');
    this._addSingleRiskCore(otherLanes[1], z0 - 8.5, 0.95);

    // Wave 2: Shift safe corridor by 1 lane with 23m reaction spacing
    const nextSafe = Math.abs(otherLanes[0] - safeLane) <= 1 ? otherLanes[0] : 0;
    const blocked = [-1, 0, 1].filter((l) => l !== nextSafe);

    this._addVehicle(blocked[0], z0 - 36, 'truck', 'static');
    this._addHighGate(nextSafe, z0 - 35);
    this._addShardLine(nextSafe, z0 - 31, 4, 2.5, 'low');

    if (difficulty > 0.2) {
      this._addLowBarrier(blocked[1], z0 - 36, 'bollard');
    }
    if (withPowerup) {
      this._addPowerUp(blocked[1], z0 - 36, 2.05); // High jump over bollard grabs Power-Up!
    }

    this.spawnCursorZ = z0 - 54;
    this.lastSafeLane = nextSafe;
  }

  // ================= PER-FRAME UPDATE =================
  update(dt, worldSpeed, distance, elapsedTime, runnerPos, magnetActive) {
    // 1. Scroll wet asphalt & sidewalk textures smoothly
    this.roadScroll += worldSpeed * dt * 0.058;
    this.tex.road.map.offset.y = -this.roadScroll;
    this.tex.road.roughnessMap.offset.y = -this.roadScroll;
    this.tex.road.bumpMap.offset.y = -this.roadScroll;
    this.tex.sidewalk.offset.y -= worldSpeed * dt * 0.095;

    // Smoothly interpolate District lighting & fog palette
    const lerpRate = Math.min(1, dt * 1.8);
    this.scene.background.lerp(this._fogTarget, lerpRate);
    this.scene.fog.color.lerp(this._fogTarget, lerpRate);
    this.horizonGlowMat.color.lerp(this._horizonTarget, lerpRate);
    this.hemiLight.color.lerp(this._hemiSkyTarget, lerpRate);
    for (const l of this.lamps) {
      l.bulbMat.color.lerp(this._lampTarget, lerpRate);
      l.glow.material.color.lerp(this._lampTarget, lerpRate);
      l.streak.material.color.lerp(this._lampTarget, lerpRate);
    }

    // 2. Advance Set-Pieces & check Tunnel / Rail Crossing states
    let insideTunnelNow = false;
    for (let i = this.setPieces.length - 1; i >= 0; i--) {
      const sp = this.setPieces[i];
      sp.z += worldSpeed * dt;
      sp.group.position.z = sp.z;

      if (sp.kind === 'tunnel') {
        if (sp.z - sp.length * 0.5 <= 2 && sp.z + sp.length * 0.5 >= -2) {
          insideTunnelNow = true;
        }
      } else if (sp.kind === 'overpass' && sp.upperCar) {
        sp.upperCar.position.x = ((elapsedTime * 16) % 32) - 16;
      } else if (sp.kind === 'rail') {
        // Flash alternating red crossing lights & ring bell as runner approaches!
        const flash = Math.floor(elapsedTime * 7) % 2 === 0;
        sp.redLamps.forEach((lamp, idx) => {
          lamp.visible = (idx % 2 === 0) ? flash : !flash;
        });
        if (sp.z > -48 && sp.z < 4) {
          this.sound.playRailBell();
        }
      }

      if (sp.z - sp.length * 0.5 > 28) {
        this.worldGroup.remove(sp.group);
        this.setPieces.splice(i, 1);
      }
    }
    this.inTunnel = insideTunnelNow;

    // 3. Recycle Roadside Buildings & Streetlamps (hide lamps inside tunnels/rail crossings cleanly)
    for (const b of this.buildings) {
      b.group.position.z += worldSpeed * dt;
      if (b.group.position.z > 24) {
        b.group.position.z -= b.totalSpan;
      }
      // Push buildings slightly wider if overlapping a tunnel wall
      let overlapsTunnel = false;
      for (const sp of this.setPieces) {
        if (sp.kind === 'tunnel' && Math.abs(b.group.position.z - sp.z) < sp.length * 0.5 + 4) {
          overlapsTunnel = true;
          break;
        }
      }
      b.group.visible = !overlapsTunnel;
    }

    for (const l of this.lamps) {
      l.group.position.z += worldSpeed * dt;
      if (l.group.position.z > 22) {
        l.group.position.z -= l.totalSpan;
      }
      let hideLamp = false;
      for (const sp of this.setPieces) {
        if (
          (sp.kind === 'tunnel' && Math.abs(l.group.position.z - sp.z) < sp.length * 0.5 + 3) ||
          (sp.kind === 'rail' && Math.abs(l.group.position.z - sp.z) < 4.5)
        ) {
          hideLamp = true;
          break;
        }
      }
      l.group.visible = !hideLamp;
    }

    // 4. Advance Obstacles (including Oncoming Traffic, Blinker Weavers & Dynamic Safety Guard!)
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.smashed) {
        this.worldGroup.remove(o.mesh);
        this.obstacles.splice(i, 1);
        continue;
      }

      // Activate relative vehicle motion once entering the visible street sightline (z > -82m)
      let effRelSpeed = o.z > -82 ? o.relSpeedZ : 0;

      // Dynamic Safety Guard: prevent moving cars from colliding with same-lane hazards or pinching all 3 lanes shut
      if (effRelSpeed !== 0 && o.z > -82 && o.z < 5) {
        const occupiedOtherLanes = new Set();
        let blockedAheadInSameLane = false;
        for (const other of this.obstacles) {
          if (other === o || other.smashed) continue;
          const dz = other.z - o.z;
          if (other.lane === o.lane && Math.abs(dz) < (o.length + other.length) * 0.6 + 4.5) {
            blockedAheadInSameLane = true;
          }
          if (other.lane !== o.lane && Math.abs(dz) < 13.5) {
            occupiedOtherLanes.add(other.lane);
          }
        }
        if (blockedAheadInSameLane || (occupiedOtherLanes.size >= 2 && !occupiedOtherLanes.has(o.lane))) {
          effRelSpeed = 0; // Cruise smoothly at road pace so corridor stays 100% fair
        }
      }

      o.z += (worldSpeed + effRelSpeed) * dt;
      o.mesh.position.z = o.z;

      // Weaver Coupe Turn-Signal Blinker & Smooth Lane Shift
      if (o.isWeaver && o.targetLane !== o.lane) {
        if (o.z > -58 && o.z < -16) {
          const dir = Math.sign(o.targetLane - o.lane);
          if (o.blinkers) {
            const blinkOn = Math.floor(elapsedTime * 9) % 2 === 0;
            // Remember forward vehicle is rotated Math.PI on Y, so world -X/+X maps to local +X/-X
            if (dir < 0) o.blinkers.right.visible = blinkOn;
            else o.blinkers.left.visible = blinkOn;
          }
          if (o.z > -40) {
            const targetX = LANES[o.targetLane + 1];
            o.x = THREE.MathUtils.lerp(o.x, targetX, Math.min(1, dt * 5.2));
            o.mesh.position.x = o.x;
            o.mesh.rotation.z = -dir * 0.05;
            if (Math.abs(o.x - targetX) < 0.08) {
              o.x = targetX;
              o.lane = o.targetLane;
              o.mesh.rotation.z = 0;
              if (o.blinkers) {
                o.blinkers.left.visible = false;
                o.blinkers.right.visible = false;
              }
            }
          }
        }
      }

      // Play passing Doppler horn occasionally for oncoming traffic
      if (o.relSpeedZ > 0 && !o.hornPlayed && o.z > -16 && o.z < -4 && Math.abs(o.x - runnerPos.x) < 3.0) {
        o.hornPlayed = true;
        if (Math.random() < 0.45) this.sound.playHorn();
      }

      if (o.z - o.length > 18) {
        this.worldGroup.remove(o.mesh);
        this.obstacles.splice(i, 1);
      }
    }

    // 5. Advance Collectibles & Apply Pulse Magnet Pull!
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      if (s.collected) {
        this.worldGroup.remove(s.group);
        this.shards.splice(i, 1);
        continue;
      }

      s.z += worldSpeed * dt;
      s.crystal.rotation.y += dt * 3.4;
      s.y = s.baseY + Math.sin(elapsedTime * 4.5 + s.phase) * 0.1;

      // Magnet pulls shards across ALL 3 lanes smoothly into runner!
      if (magnetActive && s.z > -22 && s.z < 3.5) {
        const pull = Math.min(1, dt * 11.5);
        s.x = THREE.MathUtils.lerp(s.x, runnerPos.x, pull);
        s.y = THREE.MathUtils.lerp(s.y, runnerPos.y + 0.9, pull);
        s.baseY = s.y;
        s.z = THREE.MathUtils.lerp(s.z, 0, pull * 0.55);
      }

      s.group.position.set(s.x, s.y, s.z);

      if (s.z > 12) {
        this.worldGroup.remove(s.group);
        this.shards.splice(i, 1);
      }
    }

    // 6. Advance Power-Ups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      if (p.collected) {
        this.worldGroup.remove(p.group);
        this.powerups.splice(i, 1);
        continue;
      }
      p.z += worldSpeed * dt;
      p.y = p.baseY + Math.sin(elapsedTime * 3.8) * 0.14;
      p.core.rotation.y += dt * 2.6;
      p.gyro1.rotation.x += dt * 3.1;
      p.gyro2.rotation.z += dt * 2.8;
      p.group.position.set(p.x, p.y, p.z);

      if (p.z > 12) {
        this.worldGroup.remove(p.group);
        this.powerups.splice(i, 1);
      }
    }

    // 7. Advance Spawn Cursor & Generate Upcoming Chunks
    this.spawnCursorZ += worldSpeed * dt;
    while (this.spawnCursorZ > -195) {
      this._spawnNextChunk(distance);
    }

    // 8. Animate Rain Streaks & 3D Burst Particles
    const posAttr = this.rainLines.geometry.attributes.position;
    const arr = posAttr.array;
    for (let i = 0; i < this.rainSeeds.length; i++) {
      const r = this.rainSeeds[i];
      r.y -= dt * 20;
      r.z += worldSpeed * dt * 0.85;
      if (r.y < 0) r.y += 14;
      if (r.z > 10) r.z -= 95;
      const idx = i * 6;
      arr[idx] = r.x;
      arr[idx + 1] = r.y;
      arr[idx + 2] = r.z;
      arr[idx + 3] = r.x - 0.06;
      arr[idx + 4] = r.y - 0.85;
      arr[idx + 5] = r.z + 0.35 + worldSpeed * 0.012;
    }
    posAttr.needsUpdate = true;
    this.rainLines.visible = !this.inTunnel;

    this.particles.update(dt, worldSpeed);
  }
}
