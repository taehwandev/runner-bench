import * as THREE from 'three';
import { POWERUPS } from './config.js';

function createWheels(group, mat, positions) {
  const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10);
  geo.rotateZ(Math.PI / 2);
  for (const [x, y, z] of positions) {
    const w = new THREE.Mesh(geo, mat);
    w.position.set(x, y, z);
    group.add(w);
  }
}

function buildCarMesh(kind, mats, textures) {
  const g = new THREE.Group();
  const bodyColors = [mats.carCyan, mats.carTaxi, mats.carPolice];
  const bodyMat = kind === 'lane_shifter' ? mats.carRacer : bodyColors[Math.floor(Math.random() * 3)];

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.62, 3.35), bodyMat);
  chassis.position.y = 0.56;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.56, 1.75), mats.glass);
  cabin.position.set(0, 1.1, -0.15);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.08, 1.45), bodyMat);
  roof.position.set(0, 1.39, -0.15);
  g.add(chassis, cabin, roof);

  createWheels(g, mats.tire, [
    [-0.78, 0.32, 1.05],
    [0.78, 0.32, 1.05],
    [-0.78, 0.32, -1.05],
    [0.78, 0.32, -1.05],
  ]);

  // Twin bright headlights facing +Z (oncoming toward player) + wet road beam
  for (const sx of [-0.52, 0.52]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), mats.headlight);
    hl.position.set(sx, 0.6, 1.69);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.08), mats.taillight);
    tl.position.set(sx, 0.64, -1.69);
    g.add(hl, tl);
  }

  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 6.2),
    new THREE.MeshBasicMaterial({
      map: textures.glow,
      color: 0xd8fbff,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.03, 4.2);
  g.add(beam);

  const tailGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 3.2),
    new THREE.MeshBasicMaterial({
      map: textures.glow,
      color: 0xff1e42,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  tailGlow.rotation.x = -Math.PI / 2;
  tailGlow.position.set(0, 0.03, -2.9);
  g.add(tailGlow);

  // Roof lightbar / turn signal indicator
  const roofSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.16, 0.28),
    kind === 'lane_shifter' ? mats.amberBlink : mats.neonPink
  );
  roofSign.position.set(0, 1.5, -0.1);
  g.add(roofSign);
  g.userData.blinker = roofSign;
  return g;
}

function buildTruckMesh(mats) {
  const g = new THREE.Group();
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.68, 2.75, 3.3), mats.truckCargo);
  cargo.position.set(0, 1.98, -0.45);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.95, 1.15), mats.carCyan);
  cab.position.set(0, 1.48, 1.72);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.72, 0.1), mats.glass);
  windshield.position.set(0, 1.88, 2.28);

  const sideStripeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 3.1), mats.neonCyan);
  sideStripeL.position.set(-0.85, 2.1, -0.45);
  const sideStripeR = sideStripeL.clone();
  sideStripeR.position.x = 0.85;

  for (const sx of [-0.62, 0.62]) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.1), mats.amberBlink);
    marker.position.set(sx, 3.28, 1.21);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.1), mats.headlight);
    hl.position.set(sx, 0.72, 2.28);
    g.add(marker, hl);
  }

  createWheels(g, mats.tire, [
    [-0.82, 0.36, 1.65],
    [0.82, 0.36, 1.65],
    [-0.82, 0.36, -0.45],
    [0.82, 0.36, -0.45],
    [-0.82, 0.36, -1.55],
    [0.82, 0.36, -1.55],
  ]);

  g.add(cargo, cab, windshield, sideStripeL, sideStripeR);
  return g;
}

function buildTrainMesh(mats, textures) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.74, 3.15, 6.6), mats.trainBody);
  body.position.y = 1.92;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.24, 6.4), mats.darkMetal);
  roof.position.y = 3.58;
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.42, 6.62), mats.darkMetal);
  skirt.position.y = 0.28;

  const winStripL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.68, 5.6), mats.neonCyan);
  winStripL.position.set(-0.86, 2.25, 0);
  const winStripR = winStripL.clone();
  winStripR.position.x = 0.86;

  const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.86, 0.1), mats.glass);
  frontWindow.position.set(0, 2.35, 3.28);
  const destBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.12), mats.neonAmber);
  destBar.position.set(0, 3.05, 3.29);
  const centerLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12), mats.headlight);
  centerLamp.rotation.x = Math.PI / 2;
  centerLamp.position.set(0, 1.25, 3.31);

  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 7.5),
    new THREE.MeshBasicMaterial({
      map: textures.glow,
      color: 0xfff3d1,
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.03, 6.4);

  g.add(body, roof, skirt, winStripL, winStripR, frontWindow, destBar, centerLamp, beam);
  return g;
}

function buildStaticObstacleMesh(kind, mats, textures) {
  const g = new THREE.Group();
  const hazardMat = new THREE.MeshBasicMaterial({ map: textures.hazard });

  if (kind === 'low_barrier') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.68, 0.82), mats.concrete);
    base.position.y = 0.34;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.32, 0.34), hazardMat);
    stripe.position.y = 0.84;
    for (const sx of [-0.62, 0.62]) {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), mats.amberBlink);
      beacon.position.set(sx, 1.08, 0);
      g.add(beacon);
    }
    g.add(base, stripe);
    return g;
  }

  if (kind === 'steam_trench') {
    const pit = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.12, 1.24), mats.neonAmber);
    pit.position.y = 0.06;
    const guardF = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.78, 0.2), hazardMat);
    guardF.position.set(0, 0.39, 0.58);
    const guardB = guardF.clone();
    guardB.position.z = -0.58;
    g.add(pit, guardF, guardB);
    return g;
  }

  if (kind === 'high_gantry') {
    // Tall side posts + overhead hazard bar + glowing slide-under laser line at y=1.2
    for (const sx of [-0.9, 0.9]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.28), mats.darkMetal);
      post.position.set(sx, 1.6, 0);
      g.add(post);
    }
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(1.96, 1.45, 0.52), mats.darkMetal);
    crossBeam.position.set(0, 2.28, 0);
    const hazardBar = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.38, 0.56), hazardMat);
    hazardBar.position.set(0, 1.42, 0);
    const laserBar = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.09, 0.14), mats.neonPink);
    laserBar.position.set(0, 1.2, 0);
    g.add(crossBeam, hazardBar, laserBar);
    return g;
  }

  // full_pillar
  const col = new THREE.Mesh(new THREE.BoxGeometry(1.52, 4.4, 1.56), mats.concrete);
  col.position.y = 2.2;
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.48, 1.62), hazardMat);
  band.position.y = 1.25;
  const neonEdge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.2, 1.6), mats.neonCyan);
  neonEdge.position.y = 2.2;
  g.add(col, band, neonEdge);
  return g;
}

export class EntityMeshSync {
  constructor(scene, textures) {
    this.scene = scene;
    this.textures = textures;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.mats = {
      carCyan: new THREE.MeshStandardMaterial({ color: 0x123252, roughness: 0.25, metalness: 0.65 }),
      carTaxi: new THREE.MeshStandardMaterial({ color: 0xd99b00, roughness: 0.28, metalness: 0.45 }),
      carPolice: new THREE.MeshStandardMaterial({ color: 0x161c33, roughness: 0.22, metalness: 0.7 }),
      carRacer: new THREE.MeshStandardMaterial({ color: 0x7a124c, roughness: 0.2, metalness: 0.75 }),
      truckCargo: new THREE.MeshStandardMaterial({ color: 0x1b243b, roughness: 0.42, metalness: 0.5 }),
      trainBody: new THREE.MeshStandardMaterial({ color: 0x222d46, roughness: 0.3, metalness: 0.72 }),
      concrete: new THREE.MeshStandardMaterial({ color: 0x252c40, roughness: 0.75, metalness: 0.15 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x141a2b, roughness: 0.4, metalness: 0.7 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x08101f, roughness: 0.1, metalness: 0.9 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.85 }),
      headlight: new THREE.MeshBasicMaterial({ color: 0xe8fdff }),
      taillight: new THREE.MeshBasicMaterial({ color: 0xff1e42 }),
      neonCyan: new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
      neonPink: new THREE.MeshBasicMaterial({ color: 0xff2a9d }),
      neonAmber: new THREE.MeshBasicMaterial({ color: 0xffb703 }),
      amberBlink: new THREE.MeshBasicMaterial({ color: 0xffbe0b }),
      shard: new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00d9ff,
        emissiveIntensity: 1.8,
        roughness: 0.15,
        metalness: 0.5,
      }),
    };

    this.obsPools = new Map();
    this.activeObs = new Map();
    this.shardPool = [];
    this.activeShards = new Map();
    this.pickupPools = new Map();
    this.activePickups = new Map();
    this.spinClock = 0;
  }

  acquireObstacle(kind) {
    const pool = this.obsPools.get(kind) || [];
    let mesh = pool.pop();
    if (!mesh) {
      if (kind === 'moving_car' || kind === 'lane_shifter') {
        mesh = buildCarMesh(kind, this.mats, this.textures);
      } else if (kind === 'full_truck') {
        mesh = buildTruckMesh(this.mats);
      } else if (kind === 'rail_train') {
        mesh = buildTrainMesh(this.mats, this.textures);
      } else {
        mesh = buildStaticObstacleMesh(kind, this.mats, this.textures);
      }
      this.root.add(mesh);
    }
    mesh.visible = true;
    return mesh;
  }

  acquireShard() {
    let mesh = this.shardPool.pop();
    if (!mesh) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), this.mats.shard);
      const halo = new THREE.Mesh(
        new THREE.PlaneGeometry(1.15, 1.15),
        new THREE.MeshBasicMaterial({
          map: this.textures.glow,
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      g.add(core, halo);
      g.userData.core = core;
      this.root.add(g);
      mesh = g;
    }
    mesh.visible = true;
    return mesh;
  }

  acquirePickup(kind) {
    const pool = this.pickupPools.get(kind) || [];
    let mesh = pool.pop();
    if (!mesh) {
      const cfg = POWERUPS[kind];
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: cfg.hex,
        emissive: cfg.hex,
        emissiveIntensity: 2.0,
        roughness: 0.2,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.07, 8, 24), mat);
      const innerGeo =
        kind === 'shield'
          ? new THREE.IcosahedronGeometry(0.34, 0)
          : kind === 'magnet'
            ? new THREE.TorusKnotGeometry(0.24, 0.07, 32, 8)
            : new THREE.ConeGeometry(0.3, 0.68, 6);
      const inner = new THREE.Mesh(innerGeo, mat);
      g.add(ring, inner);
      g.userData.ring = ring;
      g.userData.inner = inner;
      this.root.add(g);
      mesh = g;
    }
    mesh.visible = true;
    return mesh;
  }

  sync(state, dt) {
    this.spinClock += dt;
    this.mats.amberBlink.color.setHex(Math.sin(this.spinClock * 13) > 0 ? 0xffbe0b : 0x4a3000);

    // Sync obstacles
    const seenObs = new Set();
    for (const obs of state.obstacles) {
      if (obs.smashed) continue;
      seenObs.add(obs.id);
      let entry = this.activeObs.get(obs.id);
      if (!entry) {
        entry = { kind: obs.kind, mesh: this.acquireObstacle(obs.kind) };
        this.activeObs.set(obs.id, entry);
      }
      entry.mesh.position.set(obs.x, 0, obs.z);
      if (obs.kind === 'lane_shifter') {
        const dir = LANES_SIGN(obs.targetLane - obs.lane);
        entry.mesh.rotation.y = obs.shiftTriggered ? dir * 0.14 : 0;
      } else if (obs.velZ < 0) {
        entry.mesh.rotation.y = Math.PI;
      } else {
        entry.mesh.rotation.y = 0;
      }
    }
    for (const [id, entry] of this.activeObs.entries()) {
      if (!seenObs.has(id)) {
        entry.mesh.visible = false;
        const pool = this.obsPools.get(entry.kind) || [];
        pool.push(entry.mesh);
        this.obsPools.set(entry.kind, pool);
        this.activeObs.delete(id);
      }
    }

    // Sync collectibles
    const seenShards = new Set();
    for (const c of state.collectibles) {
      seenShards.add(c.id);
      let mesh = this.activeShards.get(c.id);
      if (!mesh) {
        mesh = this.acquireShard();
        this.activeShards.set(c.id, mesh);
      }
      mesh.position.set(c.x, c.y + Math.sin(this.spinClock * 5 + c.id) * 0.1, c.z);
      mesh.userData.core.rotation.y = this.spinClock * 3.4 + c.id * 0.5;
    }
    for (const [id, mesh] of this.activeShards.entries()) {
      if (!seenShards.has(id)) {
        mesh.visible = false;
        this.shardPool.push(mesh);
        this.activeShards.delete(id);
      }
    }

    // Sync power-ups
    const seenPickups = new Set();
    for (const p of state.pickups) {
      seenPickups.add(p.id);
      let entry = this.activePickups.get(p.id);
      if (!entry) {
        entry = { kind: p.kind, mesh: this.acquirePickup(p.kind) };
        this.activePickups.set(p.id, entry);
      }
      entry.mesh.position.set(p.x, p.y + Math.sin(this.spinClock * 4) * 0.12, p.z);
      entry.mesh.userData.ring.rotation.y = this.spinClock * 2.5;
      entry.mesh.userData.inner.rotation.x = this.spinClock * 3.2;
    }
    for (const [id, entry] of this.activePickups.entries()) {
      if (!seenPickups.has(id)) {
        entry.mesh.visible = false;
        const pool = this.pickupPools.get(entry.kind) || [];
        pool.push(entry.mesh);
        this.pickupPools.set(entry.kind, pool);
        this.activePickups.delete(id);
      }
    }
  }
}

function LANES_SIGN(delta) {
  return delta > 0 ? 1 : delta < 0 ? -1 : 0;
}
