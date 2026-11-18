import * as THREE from 'three';
import { createPRNG, clamp, lerp, smoothstep } from './prng.js';
import {
  DECK_Y,
  TRACK_MIN_S,
  TRACK_MAX_S,
  STATION_START_S,
  STATION_END_S,
  TUNNEL_START_S,
  TUNNEL_END_S,
  BRIDGE_START_S,
  BRIDGE_END_S,
  BRIDGE_PYLONS_S,
  getTrackPoint
} from './timetable.js';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Builds the entire frozen dusk city, elevated viaduct, Frost Terminal station,
 * colossal Monolith tower-block tunnel, cable-stayed bridge, dusk-to-night sky,
 * and deterministic GPU snowstorm.
 */
export function createWorld(scene, { buildingTex, concreteMap, cityGroundMap, glowMap, stationSignMap }) {
  const worldRoot = new THREE.Group();
  worldRoot.name = 'FrozenCityWorld';
  scene.add(worldRoot);

  // Exact world-Z landmarks from arc-length LUT (track is dead straight along x=0 for s >= 680)
  const zStationStart = getTrackPoint(STATION_START_S).z;
  const zStationEnd = getTrackPoint(STATION_END_S).z;
  const zTunnelStart = getTrackPoint(TUNNEL_START_S).z;
  const zTunnelEnd = getTrackPoint(TUNNEL_END_S).z;
  const zBridgeStart = zTunnelEnd;
  const zBridgeEnd = getTrackPoint(BRIDGE_END_S).z;
  const zPylons = BRIDGE_PYLONS_S.map((s) => getTrackPoint(s).z);

  // Shared materials
  const concreteMat = new THREE.MeshStandardMaterial({
    map: concreteMap,
    color: 0x6f8096,
    roughness: 0.88,
    metalness: 0.12
  });

  const darkConcreteMat = new THREE.MeshStandardMaterial({
    map: concreteMap,
    color: 0x3b4758,
    roughness: 0.9,
    metalness: 0.18
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x455466,
    roughness: 0.45,
    metalness: 0.72
  });

  const railMat = new THREE.MeshStandardMaterial({
    color: 0x9db0c4,
    roughness: 0.22,
    metalness: 0.92
  });

  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xc8daf0,
    roughness: 0.92,
    metalness: 0.04
  });

  const warmLampMat = new THREE.MeshBasicMaterial({ color: 0xffc174 });
  const coolLampMat = new THREE.MeshBasicMaterial({ color: 0xd6ecff });
  const redSignalMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
  const amberSignalMat = new THREE.MeshBasicMaterial({ color: 0xffa842 });

  // -------------------------------------------------------------------------
  // 1. PROCEDURAL DUSK-TO-NIGHT SKY DOME & LIGHTING
  // -------------------------------------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uNight: { value: 0.0 },
      uTime: { value: 0.0 },
      uZenith: { value: new THREE.Color(0x070e1d) },
      uMidSky: { value: new THREE.Color(0x1b304d) },
      uHorizon: { value: new THREE.Color(0x523b56) },
      uDuskGlow: { value: new THREE.Color(0xd27042) }
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uNight;
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uMidSky;
      uniform vec3 uHorizon;
      uniform vec3 uDuskGlow;
      varying vec3 vDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.15, 1.0);
        float hPos = max(0.0, h);

        vec3 col = mix(uHorizon, uMidSky, smoothstep(0.0, 0.34, hPos));
        col = mix(col, uZenith, smoothstep(0.26, 0.88, hPos));

        // Low burnished dusk band concentrated toward the western/forward horizon
        vec3 sunDir = normalize(vec3(-0.48, 0.08, 0.87));
        float sunDot = max(0.0, dot(d, sunDir));
        float horizonBand = exp(-abs(h - 0.03) * 8.5);
        float duskAmt = (1.0 - uNight * 0.88);
        col += uDuskGlow * horizonBand * (0.42 + 0.78 * pow(sunDot, 2.4)) * duskAmt;

        // Subtle wintry stratus cloud ribbons illuminated from below by dusk
        if (hPos > 0.01) {
          vec2 cloudUv = d.xz / (hPos + 0.18) * 1.45 + vec2(uTime * 0.004, -uTime * 0.002);
          float c1 = noise(cloudUv * 2.2);
          float c2 = noise(cloudUv * 4.7 + 3.1);
          float clouds = smoothstep(0.42, 0.78, c1 * 0.65 + c2 * 0.35) * smoothstep(0.01, 0.16, hPos) * (1.0 - smoothstep(0.5, 0.9, hPos));
          vec3 cloudTint = mix(vec3(0.32, 0.25, 0.36), vec3(0.09, 0.15, 0.24), uNight);
          col = mix(col, cloudTint + uDuskGlow * pow(sunDot, 4.0) * 0.32 * duskAmt, clouds * 0.42);
        }

        // Cold winter moon glow high in the forward-right night sky
        vec3 moonDir = normalize(vec3(0.36, 0.44, 0.82));
        float mDot = max(0.0, dot(d, moonDir));
        float moonHalo = pow(mDot, 22.0) * 0.22 + pow(mDot, 420.0) * 1.1;
        col += vec3(0.72, 0.85, 1.0) * moonHalo * (0.45 + 0.55 * uNight);

        // Darken below horizon cleanly into frozen abyss mist
        col = mix(col, uHorizon * 0.42, smoothstep(0.0, -0.14, h));

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1750, 24, 18), skyMat);
  skyDome.frustumCulled = false;
  worldRoot.add(skyDome);

  // Scene Fog (exponential depth so towers dissolve into immense frozen scale)
  const fog = new THREE.FogExp2(0x1f2a3e, 0.0031);
  scene.fog = fog;

  // Atmospheric Light Rig (lean 3-light base for stable 60fps on phone GPU)
  const hemiLight = new THREE.HemisphereLight(0x638ab8, 0x1a2638, 1.05);
  scene.add(hemiLight);

  const duskSunLight = new THREE.DirectionalLight(0xf29e65, 1.55);
  duskSunLight.position.set(-180, 65, 220);
  scene.add(duskSunLight);

  const moonRimLight = new THREE.DirectionalLight(0x7fb4e8, 0.85);
  moonRimLight.position.set(140, 120, -160);
  scene.add(moonRimLight);

  // Station warm local lighting (moody tungsten pools without washing out the platform)
  const stationLight1 = new THREE.PointLight(0xf2a04a, 78, 72, 1.45);
  stationLight1.position.set(0, DECK_Y + 6.8, (zStationStart + zStationEnd) * 0.5 - 32);
  worldRoot.add(stationLight1);

  const stationLight2 = new THREE.PointLight(0xf2a04a, 86, 76, 1.45);
  stationLight2.position.set(0, DECK_Y + 6.8, (zStationStart + zStationEnd) * 0.5 + 34);
  worldRoot.add(stationLight2);

  // -------------------------------------------------------------------------
  // 2. SNOW-BURIED URBAN FLOOR & FROZEN GLACIAL BAY
  // -------------------------------------------------------------------------
  const cityGroundGeo = new THREE.PlaneGeometry(1400, zTunnelEnd + 550);
  cityGroundGeo.rotateX(-Math.PI / 2);
  const cityGround = new THREE.Mesh(
    cityGroundGeo,
    new THREE.MeshStandardMaterial({
      map: cityGroundMap,
      color: 0xa0b6cf,
      roughness: 0.94,
      metalness: 0.05
    })
  );
  cityGround.position.set(0, 0, (zTunnelEnd - 550) * 0.5);
  worldRoot.add(cityGround);

  // Frozen glacial bay/river sheet beneath the long bridge (y = -18m)
  const bayLen = (zBridgeEnd - zTunnelEnd) + 900;
  const bayGeo = new THREE.PlaneGeometry(1800, bayLen);
  bayGeo.rotateX(-Math.PI / 2);
  const bayMat = new THREE.MeshStandardMaterial({
    color: 0x162438,
    roughness: 0.28,
    metalness: 0.55
  });
  const frozenBay = new THREE.Mesh(bayGeo, bayMat);
  frozenBay.position.set(0, -18, zTunnelEnd + bayLen * 0.5 - 30);
  worldRoot.add(frozenBay);

  // Snow-draped shore embankment wall dropping into the frozen bay at zTunnelEnd
  const seawall = new THREE.Mesh(
    new THREE.BoxGeometry(1200, 20, 26),
    darkConcreteMat
  );
  seawall.position.set(0, -9, zTunnelEnd - 8);
  worldRoot.add(seawall);

  // Distant dark snowy mountain ridges across the frozen bay (horizon silhouette for Shot 8)
  const rand = createPRNG(0xF2057C17);
  const ridgeGroup = new THREE.Group();
  const ridgeMat = new THREE.MeshStandardMaterial({
    color: 0x1c2a3e,
    roughness: 0.94,
    metalness: 0.05
  });
  for (let i = 0; i < 18; i++) {
    const rx = -760 + i * 92 + (rand() - 0.5) * 40;
    const rz = zBridgeEnd + 160 + rand() * 260;
    const rh = 75 + rand() * 145;
    const rw = 110 + rand() * 110;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(rw, rh, 5), ridgeMat);
    peak.position.set(rx, -18 + rh * 0.45, rz);
    peak.rotation.y = rand() * Math.PI;
    ridgeGroup.add(peak);
  }
  worldRoot.add(ridgeGroup);

  // -------------------------------------------------------------------------
  // 3. CONTINUOUS STEEL RAILS, ELEVATED VIADUCT, PIERS & SIGNAL GANTRIES
  // -------------------------------------------------------------------------
  function buildContinuousRail(lateralOffset) {
    const step = 4.0;
    const count = Math.floor((TRACK_MAX_S - TRACK_MIN_S) / step) + 1;
    const halfW = 0.085;
    const railY = DECK_Y + 0.14;
    const positions = new Float32Array(count * 2 * 3);
    const normals = new Float32Array(count * 2 * 3);
    const indices = [];
    const pt = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };

    for (let i = 0; i < count; i++) {
      const s = TRACK_MIN_S + i * step;
      getTrackPoint(s, pt);
      // Right vector perpendicular to tangent (tz, -tx)
      const rx = pt.tz;
      const rz = -pt.tx;
      const cx = pt.x + rx * lateralOffset;
      const cz = pt.z + rz * lateralOffset;

      const v0 = i * 2;
      positions[v0 * 3] = cx - rx * halfW;
      positions[v0 * 3 + 1] = railY;
      positions[v0 * 3 + 2] = cz - rz * halfW;

      positions[(v0 + 1) * 3] = cx + rx * halfW;
      positions[(v0 + 1) * 3 + 1] = railY;
      positions[(v0 + 1) * 3 + 2] = cz + rz * halfW;

      normals[v0 * 3 + 1] = 1;
      normals[(v0 + 1) * 3 + 1] = 1;

      if (i < count - 1) {
        const a = v0;
        const b = v0 + 1;
        const c = v0 + 2;
        const d = v0 + 3;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setIndex(indices);
    return new THREE.Mesh(geo, railMat);
  }

  worldRoot.add(buildContinuousRail(-0.98));
  worldRoot.add(buildContinuousRail(0.98));

  // Instanced sleepers / rail ties across the entire track
  {
    const tieStep = 1.8;
    const tieCount = Math.floor((TRACK_MAX_S - TRACK_MIN_S) / tieStep);
    const tieMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.75, 0.14, 0.34),
      darkConcreteMat,
      tieCount
    );
    const pt = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };
    for (let i = 0; i < tieCount; i++) {
      const s = TRACK_MIN_S + i * tieStep;
      getTrackPoint(s, pt);
      _dummy.position.set(pt.x, DECK_Y + 0.03, pt.z);
      _dummy.rotation.set(0, pt.yaw, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      tieMesh.setMatrixAt(i, _dummy.matrix);
    }
    tieMesh.instanceMatrix.needsUpdate = true;
    worldRoot.add(tieMesh);
  }

  // Elevated Concrete Viaduct Box-Girder Segments & Snow Parapets (s = -240 .. TUNNEL_END)
  {
    const segStep = 8.0;
    const segCount = Math.floor((TUNNEL_END_S - TRACK_MIN_S) / segStep) + 1;
    const deckInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(6.2, 2.3, segStep + 0.45),
      concreteMat,
      segCount
    );
    const snowEdgeL = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.75, 0.58, segStep + 0.4),
      snowMat,
      segCount
    );
    const snowEdgeR = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.75, 0.58, segStep + 0.4),
      snowMat,
      segCount
    );
    const parapetL = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.5, 1.05, segStep + 0.4),
      darkConcreteMat,
      segCount
    );
    const parapetR = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.5, 1.05, segStep + 0.4),
      darkConcreteMat,
      segCount
    );

    const pt = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };
    let idx = 0;
    for (let i = 0; i < segCount; i++) {
      const s = TRACK_MIN_S + i * segStep;
      getTrackPoint(s, pt);
      const rx = pt.tz;
      const rz = -pt.tx;

      _dummy.position.set(pt.x, DECK_Y - 1.15, pt.z);
      _dummy.rotation.set(0, pt.yaw, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      deckInst.setMatrixAt(i, _dummy.matrix);

      // Hide outer snow parapets inside station platforms & inside tunnel
      const openTrack = s < STATION_START_S || (s > STATION_END_S && s < TUNNEL_START_S);
      if (openTrack) {
        _dummy.position.set(pt.x - rx * 2.9, DECK_Y + 0.48, pt.z - rz * 2.9);
        _dummy.updateMatrix();
        parapetL.setMatrixAt(idx, _dummy.matrix);

        _dummy.position.set(pt.x + rx * 2.9, DECK_Y + 0.48, pt.z + rz * 2.9);
        _dummy.updateMatrix();
        parapetR.setMatrixAt(idx, _dummy.matrix);

        _dummy.position.set(pt.x - rx * 2.45, DECK_Y + 0.25, pt.z - rz * 2.45);
        _dummy.updateMatrix();
        snowEdgeL.setMatrixAt(idx, _dummy.matrix);

        _dummy.position.set(pt.x + rx * 2.45, DECK_Y + 0.25, pt.z + rz * 2.45);
        _dummy.updateMatrix();
        snowEdgeR.setMatrixAt(idx, _dummy.matrix);
        idx++;
      }
    }
    parapetL.count = idx;
    parapetR.count = idx;
    snowEdgeL.count = idx;
    snowEdgeR.count = idx;
    worldRoot.add(deckInst, parapetL, parapetR, snowEdgeL, snowEdgeR);
  }

  // Towering Concrete Viaduct Support Piers (s = -224 .. 976, spaced every 32m)
  {
    const pierPositions = [];
    for (let s = -224; s <= TUNNEL_START_S - 20; s += 32) {
      // Keep clear of Shot 2 camera right beside s=486 (480 is fine, skip 480 and put 464 & 504)
      pierPositions.push(s);
    }
    const pierShaft = new THREE.InstancedMesh(
      new THREE.BoxGeometry(3.4, DECK_Y - 2.0, 2.4),
      darkConcreteMat,
      pierPositions.length
    );
    const pierCap = new THREE.InstancedMesh(
      new THREE.BoxGeometry(6.8, 1.9, 3.2),
      concreteMat,
      pierPositions.length
    );
    const pierSnowBase = new THREE.InstancedMesh(
      new THREE.BoxGeometry(5.4, 1.8, 4.4),
      snowMat,
      pierPositions.length
    );

    const pt = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };
    for (let i = 0; i < pierPositions.length; i++) {
      getTrackPoint(pierPositions[i], pt);
      _dummy.rotation.set(0, pt.yaw, 0);
      _dummy.scale.set(1, 1, 1);

      _dummy.position.set(pt.x, (DECK_Y - 2.0) * 0.5, pt.z);
      _dummy.updateMatrix();
      pierShaft.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(pt.x, DECK_Y - 2.3, pt.z);
      _dummy.updateMatrix();
      pierCap.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(pt.x, 0.7, pt.z);
      _dummy.updateMatrix();
      pierSnowBase.setMatrixAt(i, _dummy.matrix);
    }
    worldRoot.add(pierShaft, pierCap, pierSnowBase);
  }

  // Overhead Steel Signal Gantries & Glowing Track Lanterns along city viaduct
  {
    const gantryS = [];
    for (let s = -160; s < STATION_START_S - 20; s += 68) gantryS.push(s);
    gantryS.push(930, 968);

    const gantryGroup = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.45, 7.6, 0.45);
    const beamGeo = new THREE.BoxGeometry(7.2, 0.5, 0.48);
    const lampGeo = new THREE.BoxGeometry(0.32, 0.52, 0.25);

    const pt = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };
    for (let i = 0; i < gantryS.length; i++) {
      getTrackPoint(gantryS[i], pt);
      const g = new THREE.Group();
      g.position.set(pt.x, DECK_Y, pt.z);
      g.rotation.y = pt.yaw;

      const pL = new THREE.Mesh(postGeo, steelMat);
      pL.position.set(-3.3, 3.6, 0);
      const pR = new THREE.Mesh(postGeo, steelMat);
      pR.position.set(3.3, 3.6, 0);
      const beam = new THREE.Mesh(beamGeo, steelMat);
      beam.position.set(0, 7.2, 0);
      g.add(pL, pR, beam);

      const isWarn = gantryS[i] > 600;
      const sig = new THREE.Mesh(lampGeo, isWarn ? amberSignalMat : warmLampMat);
      sig.position.set(2.4, 6.65, -0.22);
      g.add(sig);

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowMap,
          color: isWarn ? 0xffaa44 : 0xffd288,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      halo.position.set(2.4, 6.65, -0.35);
      halo.scale.set(4.5, 4.5, 1);
      g.add(halo);

      gantryGroup.add(g);
    }
    worldRoot.add(gantryGroup);
  }

  // -------------------------------------------------------------------------
  // 4. ELEVATED STATION TERMINAL ("FROST TERMINAL", s = 716 .. 892)
  // -------------------------------------------------------------------------
  {
    const stationGroup = new THREE.Group();
    stationGroup.name = 'FrostTerminal';
    const stLen = zStationEnd - zStationStart;
    const stMidZ = (zStationStart + zStationEnd) * 0.5;

    // Dual snow-rimmed brutalist concrete platforms flanking the track (tiled texture)
    const platTex = concreteMap.clone();
    platTex.needsUpdate = true;
    platTex.repeat.set(2, 34);
    const platConcreteMat = new THREE.MeshStandardMaterial({
      map: platTex,
      color: 0x5c6d82,
      roughness: 0.88,
      metalness: 0.14
    });

    const platW = 5.4;
    for (const side of [-1, 1]) {
      const plat = new THREE.Mesh(
        new THREE.BoxGeometry(platW, 2.2, stLen),
        platConcreteMat
      );
      plat.position.set(side * (3.1 + platW * 0.5), DECK_Y - 0.15, stMidZ);
      stationGroup.add(plat);

      // Glowing warm safety line along platform track edge
      const safetyLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.08, stLen - 2),
        amberSignalMat
      );
      safetyLine.position.set(side * 3.35, DECK_Y + 0.98, stMidZ);
      stationGroup.add(safetyLine);

      // Snowdrifts accumulated along outer platform edges
      const drift = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.42, stLen - 4),
        snowMat
      );
      drift.position.set(side * 7.8, DECK_Y + 1.15, stMidZ);
      stationGroup.add(drift);

      // Outer platform glass/steel windbreak balustrade
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 1.5, stLen),
        darkConcreteMat
      );
      wall.position.set(side * 8.45, DECK_Y + 1.65, stMidZ);
      stationGroup.add(wall);

      // Frosted platform benches spaced cleanly along the concourse
      for (let bz = zStationStart + 38; bz <= zStationEnd - 24; bz += 24) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.52, 2.6), darkConcreteMat);
        bench.position.set(side * 7.1, DECK_Y + 1.22, bz);
        stationGroup.add(bench);
        const benchSnow = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.09, 2.5), snowMat);
        benchSnow.position.set(side * 7.1, DECK_Y + 1.52, bz);
        stationGroup.add(benchSnow);
      }

      // Heavy under-platform concrete support columns to street
      for (let z = zStationStart + 14; z <= zStationEnd - 12; z += 28) {
        const col = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, DECK_Y - 1.2, 2.2),
          darkConcreteMat
        );
        col.position.set(side * 6.4, (DECK_Y - 1.2) * 0.5, z);
        stationGroup.add(col);
      }
    }

    // Vaulted arched steel-and-frosted-glass canopy (s = 746 .. 888)
    const canopyStartZ = getTrackPoint(746).z;
    const canopyEndZ = zStationEnd - 3;
    const canopyLen = canopyEndZ - canopyStartZ;
    const canopyMidZ = (canopyStartZ + canopyEndZ) * 0.5;

    // Translucent frost-covered curved/pitched roof panels
    const canopyRoofMat = new THREE.MeshStandardMaterial({
      color: 0x3b4d63,
      roughness: 0.72,
      metalness: 0.35
    });
    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(
        new THREE.BoxGeometry(9.8, 0.35, canopyLen),
        canopyRoofMat
      );
      slope.position.set(side * 4.75, DECK_Y + 9.2, canopyMidZ);
      slope.rotation.z = -side * 0.19;
      stationGroup.add(slope);

      // Snow layer on station roof
      const roofSnow = new THREE.Mesh(
        new THREE.BoxGeometry(9.4, 0.24, canopyLen - 1),
        snowMat
      );
      roofSnow.position.set(side * 4.75, DECK_Y + 9.48, canopyMidZ);
      roofSnow.rotation.z = -side * 0.19;
      stationGroup.add(roofSnow);
    }

    // Steel structural canopy ribs, columns & hanging sodium lamps
    const ribStep = 14;
    for (let z = canopyStartZ; z <= canopyEndZ; z += ribStep) {
      for (const side of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, 8.6, 0.65), steelMat);
        col.position.set(side * 9.2, DECK_Y + 4.4, z);
        stationGroup.add(col);
      }

      const arch = new THREE.Mesh(new THREE.BoxGeometry(18.9, 0.55, 0.55), steelMat);
      arch.position.set(0, DECK_Y + 8.5, z);
      stationGroup.add(arch);

      // Warm sodium-vapor platform lamps on both sides
      for (const side of [-1, 1]) {
        const lampBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.4), warmLampMat);
        lampBar.position.set(side * 5.2, DECK_Y + 7.95, z);
        stationGroup.add(lampBar);

        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowMap,
            color: 0xf4a450,
            transparent: true,
            opacity: 0.46,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        glow.position.set(side * 5.2, DECK_Y + 7.75, z);
        glow.scale.set(6.8, 6.8, 1);
        stationGroup.add(glow);
      }
    }

    // Illuminated hanging station sign ("SECTOR 09 · FROST TERMINAL")
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 1.4, 0.22),
      new THREE.MeshBasicMaterial({ map: stationSignMap })
    );
    signBoard.position.set(4.6, DECK_Y + 6.4, getTrackPoint(856).z);
    stationGroup.add(signBoard);

    worldRoot.add(stationGroup);
  }

  // -------------------------------------------------------------------------
  // 5. COLOSSAL MONOLITH TOWER BLOCK & INTERIOR RIBBED TUNNEL (s = 996..1260)
  // -------------------------------------------------------------------------
  {
    const monolithGroup = new THREE.Group();
    monolithGroup.name = 'MonolithTowerTunnel';

    const tunnelLen = zTunnelEnd - zTunnelStart;
    const tunnelMidZ = (zTunnelStart + zTunnelEnd) * 0.5;
    const halfClearW = 6.5;   // 13m clear width inside tunnel
    const ceilingY = DECK_Y + 10.5; // 34.5m ceiling height
    const blockHalfW = 56.0;  // 112m wide megablock
    const blockTopY = 235.0;  // towering 235m monolithic arcology

    // Properly world-scaled facade textures for the Monolith lower wings vs towering upper block
    const wingMap = buildingTex.map.clone();
    wingMap.needsUpdate = true;
    wingMap.repeat.set(2.2, 1.1);
    const wingEmi = buildingTex.emissiveMap.clone();
    wingEmi.needsUpdate = true;
    wingEmi.repeat.set(2.2, 1.1);
    const megaWingMat = new THREE.MeshStandardMaterial({
      map: wingMap,
      emissiveMap: wingEmi,
      emissive: new THREE.Color(0xffe1b8),
      emissiveIntensity: 0.76,
      color: 0x627387,
      roughness: 0.85,
      metalness: 0.2
    });

    const megaMap = buildingTex.map.clone();
    megaMap.needsUpdate = true;
    megaMap.repeat.set(4.8, 4.2);
    const megaEmi = buildingTex.emissiveMap.clone();
    megaEmi.needsUpdate = true;
    megaEmi.repeat.set(4.8, 4.2);
    const megaFacadeMat = new THREE.MeshStandardMaterial({
      map: megaMap,
      emissiveMap: megaEmi,
      emissive: new THREE.Color(0xffe1b8),
      emissiveIntensity: 0.78,
      color: 0x627387,
      roughness: 0.85,
      metalness: 0.2
    });

    const tunnelTex = concreteMap.clone();
    tunnelTex.needsUpdate = true;
    tunnelTex.repeat.set(3, 28);
    const tunnelInnerMat = new THREE.MeshStandardMaterial({
      map: tunnelTex,
      color: 0x2a3442,
      roughness: 0.88,
      metalness: 0.24
    });

    // Solid full-width tunnel floor slab & raised service walkways (eliminates any floor gap!)
    const tunnelFloor = new THREE.Mesh(
      new THREE.BoxGeometry(halfClearW * 2 + 1.2, 1.4, tunnelLen + 1.0),
      tunnelInnerMat
    );
    tunnelFloor.position.set(0, DECK_Y - 0.72, tunnelMidZ);
    monolithGroup.add(tunnelFloor);

    for (const side of [-1, 1]) {
      const walkway = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.72, tunnelLen + 0.6),
        darkConcreteMat
      );
      walkway.position.set(side * (halfClearW - 1.35), DECK_Y + 0.34, tunnelMidZ);
      monolithGroup.add(walkway);

      const railPipe = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.95, tunnelLen + 0.4),
        steelMat
      );
      railPipe.position.set(side * (halfClearW - 2.55), DECK_Y + 1.05, tunnelMidZ);
      monolithGroup.add(railPipe);
    }

    // Left and right colossal lower wings flanking the tunnel opening
    const wingW = blockHalfW - halfClearW;
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(wingW, ceilingY + 18, tunnelLen),
        megaWingMat
      );
      wing.position.set(side * (halfClearW + wingW * 0.5), (ceilingY - 18) * 0.5, tunnelMidZ);
      monolithGroup.add(wing);

      // Solid inner concrete tunnel sidewall lining (prevents facade z-fighting)
      const innerWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, ceilingY - DECK_Y + 2, tunnelLen + 0.4),
        tunnelInnerMat
      );
      innerWall.position.set(side * (halfClearW - 0.15), DECK_Y + (ceilingY - DECK_Y) * 0.5, tunnelMidZ);
      monolithGroup.add(innerWall);
    }

    // Massive upper tower block soaring straight over the tunnel
    const upperH = blockTopY - ceilingY;
    const upperBlock = new THREE.Mesh(
      new THREE.BoxGeometry(blockHalfW * 2, upperH, tunnelLen),
      megaFacadeMat
    );
    upperBlock.position.set(0, ceilingY + upperH * 0.5, tunnelMidZ);
    monolithGroup.add(upperBlock);

    // Stepped upper crown monoliths + snow terraces
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(74, 58, 170),
      megaFacadeMat
    );
    crown.position.set(0, blockTopY + 29, tunnelMidZ);
    monolithGroup.add(crown);

    const crownSnow = new THREE.Mesh(new THREE.BoxGeometry(76, 2.2, 172), snowMat);
    crownSnow.position.set(0, blockTopY + 59, tunnelMidZ);
    monolithGroup.add(crownSnow);

    // Solid tunnel ceiling slab
    const ceilingSlab = new THREE.Mesh(
      new THREE.BoxGeometry(halfClearW * 2 + 1.0, 1.0, tunnelLen + 0.4),
      tunnelInnerMat
    );
    ceilingSlab.position.set(0, ceilingY + 0.2, tunnelMidZ);
    monolithGroup.add(ceilingSlab);

    // Dramatic concrete portal buttresses & warning beacons at North (entry) and South (exit) mouths
    for (const portalZ of [zTunnelStart, zTunnelEnd]) {
      const dir = portalZ === zTunnelStart ? -1 : 1;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(19.5, 4.4, 4.2), darkConcreteMat);
      lintel.position.set(0, ceilingY + 1.8, portalZ + dir * 1.4);
      monolithGroup.add(lintel);

      const lintelSnow = new THREE.Mesh(new THREE.BoxGeometry(19.8, 0.7, 4.4), snowMat);
      lintelSnow.position.set(0, ceilingY + 4.3, portalZ + dir * 1.4);
      monolithGroup.add(lintelSnow);

      for (const side of [-1, 1]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(3.2, 14.0, 4.2), darkConcreteMat);
        jamb.position.set(side * (halfClearW + 1.5), DECK_Y + 5.8, portalZ + dir * 1.4);
        monolithGroup.add(jamb);

        const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.4), amberSignalMat);
        beacon.position.set(side * (halfClearW + 0.5), ceilingY - 0.6, portalZ + dir * 3.5);
        monolithGroup.add(beacon);

        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowMap,
            color: 0xff9a38,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        halo.position.set(side * (halfClearW + 0.5), ceilingY - 0.6, portalZ + dir * 3.9);
        halo.scale.set(6.5, 6.5, 1);
        monolithGroup.add(halo);
      }
    }

    // Instanced heavy concrete tunnel ribs & rhythmic industrial strip lights inside the 264m tunnel
    const ribStep = 12.0;
    const ribCount = Math.floor(tunnelLen / ribStep) + 1;
    const ribL = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 10.6, 1.05), darkConcreteMat, ribCount);
    const ribR = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 10.6, 1.05), darkConcreteMat, ribCount);
    const ribTop = new THREE.InstancedMesh(new THREE.BoxGeometry(13.2, 0.95, 1.05), darkConcreteMat, ribCount);
    const stripHousing = new THREE.InstancedMesh(new THREE.BoxGeometry(4.4, 0.22, 1.35), steelMat, ribCount);
    const stripCeil = new THREE.InstancedMesh(new THREE.BoxGeometry(3.8, 0.12, 0.65), coolLampMat, ribCount);
    const sideLampL = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.24, 1.2), amberSignalMat, ribCount);
    const sideLampR = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.24, 1.2), amberSignalMat, ribCount);

    for (let i = 0; i < ribCount; i++) {
      const rz = zTunnelStart + 4 + i * ribStep;
      if (rz > zTunnelEnd - 2) break;
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);

      _dummy.position.set(-halfClearW + 0.45, DECK_Y + 5.2, rz);
      _dummy.updateMatrix();
      ribL.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(halfClearW - 0.45, DECK_Y + 5.2, rz);
      _dummy.updateMatrix();
      ribR.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(0, ceilingY - 0.35, rz);
      _dummy.updateMatrix();
      ribTop.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(0, ceilingY - 0.72, rz + ribStep * 0.5);
      _dummy.updateMatrix();
      stripHousing.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(0, ceilingY - 0.85, rz + ribStep * 0.5);
      _dummy.updateMatrix();
      stripCeil.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(-halfClearW + 0.55, DECK_Y + 3.2, rz + ribStep * 0.5);
      _dummy.updateMatrix();
      sideLampL.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(halfClearW - 0.55, DECK_Y + 3.2, rz + ribStep * 0.5);
      _dummy.updateMatrix();
      sideLampR.setMatrixAt(i, _dummy.matrix);
    }
    monolithGroup.add(ribL, ribR, ribTop, stripHousing, stripCeil, sideLampL, sideLampR);

    worldRoot.add(monolithGroup);
  }

  // -------------------------------------------------------------------------
  // 6. MONUMENTAL CABLE-STAYED / TRUSS BRIDGE INTO THE NIGHT (s = 1260..2220)
  // -------------------------------------------------------------------------
  {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'NightBridge';
    const bridgeLen = zBridgeEnd - zBridgeStart;
    const bridgeMidZ = (zBridgeStart + zBridgeEnd) * 0.5;

    // Main steel box-truss bridge deck
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(10.6, 2.2, bridgeLen),
      steelMat
    );
    deck.position.set(0, DECK_Y - 1.1, bridgeMidZ);
    bridgeGroup.add(deck);

    // Snow shoulders along bridge deck edges
    for (const side of [-1, 1]) {
      const snowStrip = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.32, bridgeLen),
        snowMat
      );
      snowStrip.position.set(side * 4.4, DECK_Y + 0.14, bridgeMidZ);
      bridgeGroup.add(snowStrip);

      // Steel deck edge truss chords
      const lowerChord = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.65, bridgeLen),
        steelMat
      );
      lowerChord.position.set(side * 5.0, DECK_Y - 5.4, bridgeMidZ);
      bridgeGroup.add(lowerChord);

      const railBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 1.1, bridgeLen),
        steelMat
      );
      railBar.position.set(side * 5.15, DECK_Y + 0.65, bridgeMidZ);
      bridgeGroup.add(railBar);
    }

    // Instanced vertical/diagonal under-deck truss struts
    const trussStep = 12.0;
    const trussCount = Math.floor(bridgeLen / trussStep);
    const trussPostL = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 5.2, 0.45), steelMat, trussCount);
    const trussPostR = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 5.2, 0.45), steelMat, trussCount);
    const trussDiag = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 7.6, 0.32), steelMat, trussCount * 2);

    for (let i = 0; i < trussCount; i++) {
      const tz = zBridgeStart + i * trussStep + 6;
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);

      _dummy.position.set(-5.0, DECK_Y - 3.2, tz);
      _dummy.updateMatrix();
      trussPostL.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(5.0, DECK_Y - 3.2, tz);
      _dummy.updateMatrix();
      trussPostR.setMatrixAt(i, _dummy.matrix);

      // Diagonal side brace on both sides
      _dummy.position.set(-5.0, DECK_Y - 3.2, tz + trussStep * 0.5);
      _dummy.rotation.set(0.95, 0, 0);
      _dummy.updateMatrix();
      trussDiag.setMatrixAt(i * 2, _dummy.matrix);

      _dummy.position.set(5.0, DECK_Y - 3.2, tz + trussStep * 0.5);
      _dummy.rotation.set(-0.95, 0, 0);
      _dummy.updateMatrix();
      trussDiag.setMatrixAt(i * 2 + 1, _dummy.matrix);
    }
    bridgeGroup.add(trussPostL, trussPostR, trussDiag);

    // Bridge Stanchion Lamps marching into the frozen night (every 28m)
    const lampStep = 28.0;
    for (let lz = zBridgeStart + 18; lz < zBridgeEnd - 20; lz += lampStep) {
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.2, 0.22), steelMat);
        pole.position.set(side * 5.2, DECK_Y + 3.1, lz);
        bridgeGroup.add(pole);

        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.35), warmLampMat);
        bulb.position.set(side * 4.7, DECK_Y + 6.1, lz);
        bridgeGroup.add(bulb);

        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowMap,
            color: 0xffb35c,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        halo.position.set(side * 4.7, DECK_Y + 6.0, lz);
        halo.scale.set(6.8, 6.8, 1);
        bridgeGroup.add(halo);
      }
    }

    // Two Colossal Cable-Stayed Gothic-Brutalist Pylons + Suspension Cables
    const cableGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 6);
    const cableMat = new THREE.MeshStandardMaterial({
      color: 0x95adc6,
      roughness: 0.38,
      metalness: 0.78
    });

    const pylonBeaconSprites = [];
    const cableMatrices = [];
    const upVec = new THREE.Vector3(0, 1, 0);
    const startV = new THREE.Vector3();
    const endV = new THREE.Vector3();
    const dirV = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    for (const pz of zPylons) {
      const pylonTopY = 114.0;
      const pylonBaseY = -18.0;
      const pylonH = pylonTopY - pylonBaseY;

      // Twin towering concrete-and-steel legs flanking the deck (at x = ±7.8m)
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(3.8, pylonH, 5.4),
          darkConcreteMat
        );
        leg.position.set(side * 7.8, pylonBaseY + pylonH * 0.5, pz);
        bridgeGroup.add(leg);

        // Ice-caked concrete foundation caisson rising from the frozen bay
        const caisson = new THREE.Mesh(
          new THREE.BoxGeometry(6.8, 10, 10.5),
          concreteMat
        );
        caisson.position.set(side * 7.8, pylonBaseY + 4.5, pz);
        bridgeGroup.add(caisson);

        // Snow cap on pylon summit
        const capSnow = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.8, 5.7), snowMat);
        capSnow.position.set(side * 7.8, pylonTopY + 0.4, pz);
        bridgeGroup.add(capSnow);

        // Flashing red aviation beacon on summit
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), redSignalMat);
        beacon.position.set(side * 7.8, pylonTopY + 2.2, pz);
        bridgeGroup.add(beacon);

        const beaconGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowMap,
            color: 0xff2a2a,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        beaconGlow.position.set(side * 7.8, pylonTopY + 2.2, pz);
        beaconGlow.scale.set(11.0, 11.0, 1);
        bridgeGroup.add(beaconGlow);
        pylonBeaconSprites.push(beaconGlow);
      }

      // Massive horizontal H-frame crossbeams
      for (const cy of [DECK_Y - 4.2, 62.0, 96.0, 111.0]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(19.6, 3.6, 4.4), darkConcreteMat);
        beam.position.set(0, cy, pz);
        bridgeGroup.add(beam);

        const beamSnow = new THREE.Mesh(new THREE.BoxGeometry(19.6, 0.55, 4.5), snowMat);
        beamSnow.position.set(0, cy + 2.05, pz);
        bridgeGroup.add(beamSnow);
      }

      // Fan array of stay cables (10 per direction per side = 40 cables per pylon)
      for (const side of [-1, 1]) {
        for (const dir of [-1, 1]) {
          for (let k = 1; k <= 10; k++) {
            const anchorY = 66.0 + k * 4.4;
            const deckOffset = k * 14.8;
            startV.set(side * 7.2, anchorY, pz);
            endV.set(side * 5.05, DECK_Y + 0.2, pz + dir * deckOffset);

            dirV.subVectors(endV, startV);
            const len = dirV.length();
            dirV.normalize();
            quat.setFromUnitVectors(upVec, dirV);

            const m = new THREE.Matrix4();
            m.compose(
              startV.clone().lerp(endV, 0.5),
              quat,
              new THREE.Vector3(1, len, 1)
            );
            cableMatrices.push(m);
          }
        }
      }
    }

    const cableInst = new THREE.InstancedMesh(cableGeo, cableMat, cableMatrices.length);
    for (let i = 0; i < cableMatrices.length; i++) {
      cableInst.setMatrixAt(i, cableMatrices[i]);
    }
    cableInst.instanceMatrix.needsUpdate = true;
    bridgeGroup.add(cableInst);

    // Secondary concrete support piers down to frozen bay outside pylon spans
    for (const subZ of [zBridgeStart + 80, zBridgeEnd - 220, zBridgeEnd - 100]) {
      const subPier = new THREE.Mesh(
        new THREE.BoxGeometry(8.5, DECK_Y + 16, 4.2),
        darkConcreteMat
      );
      subPier.position.set(0, (DECK_Y - 18) * 0.5 - 1, subZ);
      bridgeGroup.add(subPier);
    }

    worldRoot.add(bridgeGroup);
    worldRoot.userData.pylonBeaconSprites = pylonBeaconSprites;
  }

  // -------------------------------------------------------------------------
  // 7. LAYERED SNOW-BURIED CITY TOWERS (460+ INSTANCED MONOLITHS + SNOW CAPS)
  // -------------------------------------------------------------------------
  const beaconCoords = [];
  {
    const towerMat = new THREE.MeshStandardMaterial({
      map: buildingTex.map,
      emissiveMap: buildingTex.emissiveMap,
      emissive: new THREE.Color(0xffe4bc),
      emissiveIntensity: 0.92,
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.16
    });

    const towerEntries = [];
    const pt = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };

    function isClearForBuilding(bx, bz, bw, bd, sApprox) {
      // Never place city towers in the frozen bay past the monolith wall
      if (bz + bd * 0.5 > zTunnelEnd - 12) return false;

      getTrackPoint(sApprox, pt);
      const dx = bx - pt.x;
      const absDx = Math.abs(dx);
      const halfW = bw * 0.5;

      // Hard track & viaduct clearance
      if (absDx - halfW < 18.5) return false;

      // Shot 1 (+X wide crane vista): keep camera lane open on +X for s in [50..445]
      if (sApprox >= 50 && sApprox <= 445 && dx > 0 && dx - halfW < 42.0) return false;

      // Shot 2 (-X low-angle overhead): keep camera lane open on -X near s = 492
      if (sApprox >= 420 && sApprox <= 545 && dx < 0 && absDx - halfW < 29.0) return false;

      // Shot 3 (+X parallel flank): keep clear corridor on +X
      if (sApprox >= 540 && sApprox <= 765 && dx > 0 && dx - halfW < 24.0) return false;

      // Frost Terminal station & Shot 5 departure corridor
      if (sApprox >= 695 && sApprox <= 965 && absDx - halfW < 30.0) return false;

      // Monolith Tower Block footprint
      if (sApprox >= 965 && sApprox <= 1280 && absDx - halfW < 64.0) return false;

      return true;
    }

    // Generate 3 distinct depth tiers so the city feels endlessly huge & layered:
    // Tier 0: Canyon foreground towers
    // Tier 1: Mid-ground skyline avenues
    // Tier 2: Colossal distant horizon megastructures
    const tiers = [
      { count: 165, minOff: 22,  maxOff: 72,  minH: 38,  maxH: 132, minW: 15, maxW: 28, minS: -210, maxS: 1180 },
      { count: 190, minOff: 74,  maxOff: 185, minH: 64,  maxH: 195, minW: 22, maxW: 40, minS: -260, maxS: 1210 },
      { count: 145, minOff: 190, maxOff: 390, minH: 118, maxH: 285, minW: 34, maxW: 66, minS: -320, maxS: 1230 }
    ];

    for (let tIdx = 0; tIdx < tiers.length; tIdx++) {
      const cfg = tiers[tIdx];
      let placed = 0;
      let guard = 0;
      while (placed < cfg.count && guard < cfg.count * 5) {
        guard++;
        const sApprox = lerp(cfg.minS, cfg.maxS, rand());
        getTrackPoint(sApprox, pt);
        const side = rand() < 0.5 ? -1 : 1;
        const offset = lerp(cfg.minOff, cfg.maxOff, rand());
        const bw = lerp(cfg.minW, cfg.maxW, rand());
        const bd = lerp(cfg.minW, cfg.maxW, rand());
        const bh = lerp(cfg.minH, cfg.maxH, Math.pow(rand(), 0.85));

        const bx = pt.x + side * offset;
        const bz = pt.z + (rand() - 0.5) * 26;

        if (!isClearForBuilding(bx, bz, bw, bd, sApprox)) continue;

        // Cold steel-blue concrete shade variation per tower
        const shade = lerp(0.56, 0.94, rand());
        const blueShift = lerp(0.95, 1.12, rand());
        towerEntries.push({ bx, bz, bw, bd, bh, shade, blueShift, tier: tIdx, hasSetback: rand() < 0.48 });

        // Tall towers get red rooftop aviation warning beacons
        if (bh > 105 && rand() < 0.52) {
          beaconCoords.push(bx, bh + (rand() < 0.48 ? 16 : 6), bz, rand() * 6.28);
        }
        placed++;
      }
    }

    // Count total boxes (main shafts + upper setbacks)
    let boxCount = 0;
    for (const e of towerEntries) boxCount += e.hasSetback ? 2 : 1;

    const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const towerInst = new THREE.InstancedMesh(unitBoxGeo, towerMat, boxCount);
    const snowCapInst = new THREE.InstancedMesh(unitBoxGeo, snowMat, boxCount);

    let idx = 0;
    for (const e of towerEntries) {
      // Main tower shaft
      _dummy.position.set(e.bx, e.bh * 0.5, e.bz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(e.bw, e.bh, e.bd);
      _dummy.updateMatrix();
      towerInst.setMatrixAt(idx, _dummy.matrix);

      _color.setRGB(e.shade * 0.88, e.shade * 0.96, Math.min(1, e.shade * blueShiftClamp(e.blueShift)));
      towerInst.setColorAt(idx, _color);

      // Thick snow-buried roof cap on top of main shaft
      _dummy.position.set(e.bx, e.bh + 0.65, e.bz);
      _dummy.scale.set(e.bw + 0.5, 1.35, e.bd + 0.5);
      _dummy.updateMatrix();
      snowCapInst.setMatrixAt(idx, _dummy.matrix);
      idx++;

      // Optional brutalist stepped upper setback crown
      if (e.hasSetback) {
        const sw = e.bw * 0.62;
        const sd = e.bd * 0.62;
        const sh = e.bh * 0.24;
        _dummy.position.set(e.bx, e.bh + sh * 0.5, e.bz);
        _dummy.scale.set(sw, sh, sd);
        _dummy.updateMatrix();
        towerInst.setMatrixAt(idx, _dummy.matrix);
        towerInst.setColorAt(idx, _color);

        _dummy.position.set(e.bx, e.bh + sh + 0.55, e.bz);
        _dummy.scale.set(sw + 0.4, 1.15, sd + 0.4);
        _dummy.updateMatrix();
        snowCapInst.setMatrixAt(idx, _dummy.matrix);
        idx++;
      }
    }
    towerInst.instanceMatrix.needsUpdate = true;
    if (towerInst.instanceColor) towerInst.instanceColor.needsUpdate = true;
    snowCapInst.instanceMatrix.needsUpdate = true;
    worldRoot.add(towerInst, snowCapInst);
  }

  function blueShiftClamp(v) {
    return v > 1.15 ? 1.15 : v;
  }

  // Blinking Rooftop Aviation Warning Beacons (single GPU Points draw call!)
  let beaconMat = null;
  if (beaconCoords.length > 0) {
    const bCount = beaconCoords.length / 4;
    const bPos = new Float32Array(bCount * 3);
    const bPhase = new Float32Array(bCount);
    for (let i = 0; i < bCount; i++) {
      bPos[i * 3] = beaconCoords[i * 4];
      bPos[i * 3 + 1] = beaconCoords[i * 4 + 1];
      bPos[i * 3 + 2] = beaconCoords[i * 4 + 2];
      bPhase[i] = beaconCoords[i * 4 + 3];
    }
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute('aPhase', new THREE.BufferAttribute(bPhase, 1));

    beaconMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: glowMap }
      },
      vertexShader: `
        attribute float aPhase;
        uniform float uTime;
        varying float vPulse;
        void main() {
          float s = 0.5 + 0.5 * sin(uTime * 2.2 + aPhase);
          vPulse = 0.25 + 0.75 * pow(s, 4.0);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
          gl_PointSize = clamp(2400.0 / max(10.0, -mvPos.z), 4.0, 26.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying float vPulse;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(1.0, 0.2, 0.16, tex.a * vPulse);
        }
      `
    });
    const beacons = new THREE.Points(bGeo, beaconMat);
    beacons.frustumCulled = false;
    worldRoot.add(beacons);
  }

  // -------------------------------------------------------------------------
  // 8. DETERMINISTIC 6,000-FLAKE GPU SNOWSTORM (TUNNEL-CULLED IN SHADER!)
  // -------------------------------------------------------------------------
  const SNOW_COUNT = 6000;
  const snowSeedPos = new Float32Array(SNOW_COUNT * 3);
  const snowParams = new Float32Array(SNOW_COUNT * 4); // speedY, driftPhase, driftAmp, size
  const snowBox = new THREE.Vector3(96, 72, 118);

  const snowRand = createPRNG(0x5A0DF1A3);
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowSeedPos[i * 3] = snowRand() * snowBox.x;
    snowSeedPos[i * 3 + 1] = snowRand() * snowBox.y;
    snowSeedPos[i * 3 + 2] = snowRand() * snowBox.z;

    snowParams[i * 4] = 4.2 + snowRand() * 5.2;          // fall speed m/s
    snowParams[i * 4 + 1] = snowRand() * Math.PI * 2.0;  // swirl phase
    snowParams[i * 4 + 2] = 0.8 + snowRand() * 2.1;      // swirl amplitude
    snowParams[i * 4 + 3] = 0.32 + Math.pow(snowRand(), 1.6) * 0.85; // delicate wintry flake sizes
  }

  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowSeedPos, 3));
  snowGeo.setAttribute('aParam', new THREE.BufferAttribute(snowParams, 4));

  const snowShaderMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uBox: { value: snowBox },
      uTunnelBounds: { value: new THREE.Vector4(-10.5, 10.5, zTunnelStart - 1.0, zTunnelEnd + 1.0) },
      uTunnelCeiling: { value: DECK_Y + 12.5 },
      uScale: { value: 360.0 },
      uTint: { value: new THREE.Color(0xdbe9f8) }
    },
    vertexShader: `
      attribute vec4 aParam;
      uniform float uTime;
      uniform vec3 uCamPos;
      uniform vec3 uBox;
      uniform vec4 uTunnelBounds;
      uniform float uTunnelCeiling;
      uniform float uScale;
      varying float vAlpha;

      void main() {
        float speedY = aParam.x;
        float phase = aParam.y;
        float amp = aParam.z;
        float sz = aParam.w;

        // Pure deterministic world-wrapped snow volume centered on camera
        vec3 p = position;
        p.x += uTime * -3.6 + sin(uTime * 1.15 + phase) * amp;
        p.y -= uTime * speedY;
        p.z += uTime * -1.1 + cos(uTime * 0.92 + phase) * amp;

        vec3 rel = mod(p - uCamPos + uBox * 0.5, uBox) - uBox * 0.5;
        vec3 worldPos = uCamPos + rel;

        // Cull snow inside the enclosed concrete monolith tunnel
        bool insideTunnel = (
          worldPos.x > uTunnelBounds.x &&
          worldPos.x < uTunnelBounds.y &&
          worldPos.z > uTunnelBounds.z &&
          worldPos.z < uTunnelBounds.w &&
          worldPos.y < uTunnelCeiling
        );

        vec4 mvPos = modelViewMatrix * vec4(worldPos, 1.0);
        float dist = -mvPos.z;

        // Soft fade near camera lens and at volume edge
        float edgeFade = 1.0 - smoothstep(0.65, 1.0, length(rel / (uBox * 0.5)));
        float nearFade = smoothstep(2.2, 6.5, dist);
        vAlpha = insideTunnel ? 0.0 : (0.72 * edgeFade * nearFade);

        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = clamp(sz * (uScale / max(1.5, dist)), 1.0, 7.2);
      }
    `,
    fragmentShader: `
      uniform vec3 uTint;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.01) discard;
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d, d);
        if (r2 > 0.25) discard;
        float soft = smoothstep(0.25, 0.02, r2);
        gl_FragColor = vec4(uTint, soft * vAlpha);
      }
    `
  });

  const snowPoints = new THREE.Points(snowGeo, snowShaderMat);
  snowPoints.frustumCulled = false;
  worldRoot.add(snowPoints);

  // Reusable colors for smooth dusk -> night progression
  const duskZenith = new THREE.Color(0x091326);
  const nightZenith = new THREE.Color(0x03060f);
  const duskMid = new THREE.Color(0x1f3656);
  const nightMid = new THREE.Color(0x0b1629);
  const duskHorizon = new THREE.Color(0x5c405c);
  const nightHorizon = new THREE.Color(0x14243d);
  const duskFog = new THREE.Color(0x283247);
  const nightFog = new THREE.Color(0x0b1424);
  const tunnelFog = new THREE.Color(0x080c14);

  function update(t, cameraPos, inTunnel, viewportHeight) {
    // 0 -> 1 dusk-to-night transition across the 60 seconds (accelerates gracefully on the bridge)
    const night = smoothstep(4.0, 58.0, t);

    // Keep sky dome centered on camera
    skyDome.position.copy(cameraPos);
    skyMat.uniforms.uNight.value = night;
    skyMat.uniforms.uTime.value = t;
    skyMat.uniforms.uZenith.value.copy(duskZenith).lerp(nightZenith, night);
    skyMat.uniforms.uMidSky.value.copy(duskMid).lerp(nightMid, night);
    skyMat.uniforms.uHorizon.value.copy(duskHorizon).lerp(nightHorizon, night);

    // Synchronized exponential fog (shifts darker & slightly denser inside the monolith tunnel)
    if (inTunnel) {
      fog.color.copy(tunnelFog);
      fog.density = 0.0055;
    } else {
      fog.color.copy(duskFog).lerp(nightFog, night);
      fog.density = lerp(0.0029, 0.0025, night);
    }

    // Dusk sun softens and sets as the train emerges into the night
    duskSunLight.intensity = lerp(1.55, 0.25, night) * (inTunnel ? 0.15 : 1.0);
    hemiLight.intensity = lerp(1.08, 0.56, night) * (inTunnel ? 0.45 : 1.0);
    moonRimLight.intensity = lerp(0.75, 1.05, night) * (inTunnel ? 0.25 : 1.0);

    // Blinking rooftop & bridge pylon aviation beacons
    if (beaconMat) beaconMat.uniforms.uTime.value = t;
    const pylonBeacons = worldRoot.userData.pylonBeaconSprites;
    if (pylonBeacons) {
      for (let i = 0; i < pylonBeacons.length; i++) {
        const pulse = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.6 + i * 0.9), 3.0);
        pylonBeacons[i].material.opacity = pulse;
      }
    }

    // Update GPU snowstorm uniforms
    snowShaderMat.uniforms.uTime.value = t;
    snowShaderMat.uniforms.uCamPos.value.copy(cameraPos);
    snowShaderMat.uniforms.uScale.value = (viewportHeight || 960) * 0.42;
  }

  return {
    root: worldRoot,
    update
  };
}
