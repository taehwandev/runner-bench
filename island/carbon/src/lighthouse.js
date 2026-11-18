import * as THREE from 'three';
import { TAU } from './math.js';
import { LIGHTHOUSE_POS, COTTAGE_POS, sampleTerrainHeight } from './terrain-data.js';

const BEAM_VERT = /* glsl */ `
varying float vRadial;
varying vec3 vNormalWorld;
varying vec3 vWorldPos;

void main() {
  // Cone built along +Z from z=0 (apex) to z=1 (far end); uv.y = axial progress
  vRadial = uv.y;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const BEAM_FRAG = /* glsl */ `
uniform float uVisibility;
uniform float uTime;
uniform vec3 uBeamColor;

varying float vRadial;
varying vec3 vNormalWorld;
varying vec3 vWorldPos;

void main() {
  if (uVisibility <= 0.005) discard;

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  // Soften silhouette edges via view-normal angle (1 at center of cone, 0 at grazing rim)
  float edgeSoft = pow(abs(dot(normalize(vNormalWorld), viewDir)), 1.75);

  // Smooth entry near lantern + exponential atmospheric decay along 85m beam
  float nearRamp = smoothstep(0.0, 0.055, vRadial);
  float farFade = pow(1.0 - vRadial, 1.85) * exp(-vRadial * 1.65);

  // Subtle sea-mist shimmer along beam
  float mist = 0.86 + 0.14 * sin(vRadial * 26.0 - uTime * 1.4 + vWorldPos.y * 0.4);

  float alpha = edgeSoft * nearRamp * farFade * mist * uVisibility * 0.34;
  if (alpha <= 0.002) discard;

  gl_FragColor = vec4(uBeamColor, alpha);
}
`;

const HALO_VERT = /* glsl */ `
uniform float uScale;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mvCenter.xy += position.xy * uScale;
  gl_Position = projectionMatrix * mvCenter;
}
`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  if (uIntensity <= 0.004) discard;
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  if (r > 1.0) discard;

  float core = exp(-r * r * 7.5);
  float glow = pow(max(0.0, 1.0 - r), 2.6) * 0.48;
  // Subtle anamorphic horizontal cinema streak when beam flashes camera
  float streak = exp(-abs(p.y) * 16.0) * exp(-abs(p.x) * 2.6) * 0.42;

  float a = (core + glow + streak) * uIntensity;
  gl_FragColor = vec4(uColor, a);
}
`;

function createVolumetricBeamCone(length = 86.0, endRadius = 9.2) {
  // CylinderGeometry(radiusTop=0.22, radiusBottom=endRadius, height=length, radialSegs=32, heightSegs=1, openEnded=true)
  const geo = new THREE.CylinderGeometry(0.24, endRadius, length, 32, 1, true);
  // Orient apex at origin extending along +Z, uv.y from 0 (apex) to 1 (far end)
  geo.translate(0, -length * 0.5, 0);
  geo.rotateX(-Math.PI / 2);

  // Remap uv.y so 0 is at apex (z=0) and 1 is at far end (z=length)
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    uv.setY(i, Math.max(0, Math.min(1, pos.getZ(i) / length)));
  }

  return geo;
}

function buildTowerGroup(materials) {
  const tower = new THREE.Group();

  // 1. Octagonal weathered granite base plinth
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.62, 1.96, 1.45, 10),
    materials.stone
  );
  plinth.position.y = 0.65;
  tower.add(plinth);

  // 2. Tapered lower whitewashed masonry section
  const lowerWhite = new THREE.Mesh(
    new THREE.CylinderGeometry(1.28, 1.54, 2.85, 20),
    materials.whitewash
  );
  lowerWhite.position.y = 2.80;
  tower.add(lowerWhite);

  // 3. Classic red maritime daymark band
  const midRed = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.28, 1.85, 20),
    materials.redPaint
  );
  midRed.position.y = 5.15;
  tower.add(midRed);

  // 4. Upper whitewashed section
  const upperWhite = new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 1.15, 2.05, 20),
    materials.whitewash
  );
  upperWhite.position.y = 7.10;
  tower.add(upperWhite);

  // Small slit stairwell windows set flush into tapered tower masonry
  const slitGeo = new THREE.BoxGeometry(0.24, 0.44, 0.14);
  const slitHeights = [2.9, 4.9, 6.8];
  slitHeights.forEach((hy, idx) => {
    const towerR = 1.54 - ((hy - 1.38) / 6.75) * 0.52;
    const r = towerR - 0.03;
    const ang = idx * 0.85 - 0.45;
    const slit = new THREE.Mesh(slitGeo, materials.windowWarm);
    slit.position.set(Math.sin(ang) * r, hy, Math.cos(ang) * r);
    slit.rotation.y = ang;
    tower.add(slit);
  });

  // 5. Corbelled gallery deck & wrought-iron railing
  const cornice = new THREE.Mesh(
    new THREE.CylinderGeometry(1.44, 1.04, 0.36, 20),
    materials.stone
  );
  cornice.position.y = 8.28;
  tower.add(cornice);

  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.44, 0.16, 20),
    materials.darkIron
  );
  deck.position.y = 8.52;
  tower.add(deck);

  const railTop = new THREE.Mesh(
    new THREE.TorusGeometry(1.40, 0.035, 8, 24),
    materials.darkIron
  );
  railTop.rotation.x = Math.PI / 2;
  railTop.position.y = 9.05;
  tower.add(railTop);

  const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.52, 6);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const post = new THREE.Mesh(postGeo, materials.darkIron);
    post.position.set(Math.cos(a) * 1.40, 8.80, Math.sin(a) * 1.40);
    tower.add(post);
  }

  // 6. Lantern room base + glazed cupola + astragal bars + red copper dome
  const lanternBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 0.96, 0.34, 16),
    materials.darkIron
  );
  lanternBase.position.y = 8.76;
  tower.add(lanternBase);

  const glassCupola = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 0.88, 1.38, 16, 1, true),
    materials.lanternGlass
  );
  glassCupola.position.y = 9.62;
  tower.add(glassCupola);

  const barGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.40, 6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const bar = new THREE.Mesh(barGeo, materials.darkIron);
    bar.position.set(Math.cos(a) * 0.89, 9.62, Math.sin(a) * 0.89);
    tower.add(bar);
  }

  const domeRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.98, 0.94, 0.14, 18),
    materials.darkIron
  );
  domeRim.position.y = 10.36;
  tower.add(domeRim);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.92, 18, 12, 0, TAU, 0, Math.PI * 0.52),
    materials.redPaint
  );
  dome.position.y = 10.36;
  tower.add(dome);

  const spireBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    materials.brass
  );
  spireBall.position.y = 11.35;
  tower.add(spireBall);

  const lightningRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.03, 0.65, 6),
    materials.darkIron
  );
  lightningRod.position.y = 11.72;
  tower.add(lightningRod);

  return tower;
}

function buildKeeperCottage(materials) {
  const cottage = new THREE.Group();

  // Stone foundation
  const found = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, 0.65, 2.2),
    materials.stone
  );
  found.position.y = 0.25;
  cottage.add(found);

  // Whitewashed walls
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(2.65, 1.55, 1.95),
    materials.whitewash
  );
  walls.position.y = 1.32;
  cottage.add(walls);

  // Pitched red roof (extruded triangular prism via 4-sided cone/prism or twin sloped roof slabs)
  const roofGroup = new THREE.Group();
  roofGroup.position.y = 2.10;
  const slabGeo = new THREE.BoxGeometry(2.92, 0.12, 1.36);
  const roofFront = new THREE.Mesh(slabGeo, materials.redPaint);
  roofFront.position.set(0, 0.36, 0.54);
  roofFront.rotation.x = 0.54;
  const roofBack = new THREE.Mesh(slabGeo, materials.redPaint);
  roofBack.position.set(0, 0.36, -0.54);
  roofBack.rotation.x = -0.54;
  roofGroup.add(roofFront, roofBack);

  // Gable end triangles
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-0.98, 0);
  gableShape.lineTo(0.98, 0);
  gableShape.lineTo(0, 0.68);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 2.65, bevelEnabled: false });
  gableGeo.rotateY(Math.PI / 2);
  gableGeo.translate(-1.325, 0, 0);
  const gables = new THREE.Mesh(gableGeo, materials.whitewash);
  roofGroup.add(gables);
  cottage.add(roofGroup);

  // Stone chimney
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 1.05, 0.38),
    materials.stone
  );
  chimney.position.set(-0.85, 2.65, -0.35);
  cottage.add(chimney);

  // Warm glowing cottage windows on front, back, and sea-facing sides
  const winGeo = new THREE.PlaneGeometry(0.42, 0.48);
  const winConfigs = [
    { pos: [-0.62, 1.38, 0.985], rotY: 0 },
    { pos: [0.62, 1.38, 0.985], rotY: 0 },
    { pos: [-0.62, 1.38, -0.985], rotY: Math.PI },
    { pos: [0.62, 1.38, -0.985], rotY: Math.PI },
    { pos: [-1.335, 1.38, 0.0], rotY: -Math.PI / 2 },
  ];
  winConfigs.forEach((cfg) => {
    const w = new THREE.Mesh(winGeo, materials.windowWarm);
    w.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    w.rotation.y = cfg.rotY;
    cottage.add(w);
  });

  // Timber door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.95, 0.06),
    materials.woodDoor
  );
  door.position.set(0.0, 1.05, 0.98);
  cottage.add(door);

  return cottage;
}

export function createLighthouseSystem() {
  const group = new THREE.Group();

  const materials = {
    stone: new THREE.MeshStandardMaterial({ color: 0x6b645c, roughness: 0.90, metalness: 0.03 }),
    whitewash: new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.76, metalness: 0.02 }),
    redPaint: new THREE.MeshStandardMaterial({ color: 0xb8382c, roughness: 0.62, metalness: 0.06 }),
    darkIron: new THREE.MeshStandardMaterial({ color: 0x20252c, roughness: 0.48, metalness: 0.65 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd4a44a, roughness: 0.32, metalness: 0.82 }),
    woodDoor: new THREE.MeshStandardMaterial({ color: 0x4f3624, roughness: 0.82 }),
    lanternGlass: new THREE.MeshStandardMaterial({
      color: 0xdbeeff,
      roughness: 0.12,
      metalness: 0.1,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
    }),
    windowWarm: new THREE.MeshStandardMaterial({
      color: 0x2c3440,
      emissive: new THREE.Color(0xffa844),
      emissiveIntensity: 0.0,
      roughness: 0.25,
    }),
    lampCore: new THREE.MeshBasicMaterial({
      color: 0xfff4d2,
      transparent: true,
      opacity: 0.15,
    }),
  };

  const baseH = sampleTerrainHeight(LIGHTHOUSE_POS.x, LIGHTHOUSE_POS.z) - 0.22;
  const tower = buildTowerGroup(materials);
  tower.position.set(LIGHTHOUSE_POS.x, baseH, LIGHTHOUSE_POS.z);
  group.add(tower);

  const cottageH = sampleTerrainHeight(COTTAGE_POS.x, COTTAGE_POS.z) - 0.18;
  const cottage = buildKeeperCottage(materials);
  cottage.position.set(COTTAGE_POS.x, cottageH, COTTAGE_POS.z);
  cottage.rotation.y = 0.38;
  group.add(cottage);

  // Lantern optic origin in world coordinates
  const lanternY = baseH + 9.62;
  const opticPivot = new THREE.Group();
  opticPivot.position.set(LIGHTHOUSE_POS.x, lanternY, LIGHTHOUSE_POS.z);
  group.add(opticPivot);

  // Central glowing lamp bulb + rotating twin Fresnel bullseye lenses
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), materials.lampCore);
  opticPivot.add(lampBulb);

  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 16), materials.brass);
  lensRing.rotation.x = Math.PI / 2;
  opticPivot.add(lensRing);

  // Volumetric twin opposing light cones (oriented along +X and -X when beamAngle = 0)
  const coneGeo = createVolumetricBeamCone(88.0, 9.6);
  const beamMat = new THREE.ShaderMaterial({
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uVisibility: { value: 0 },
      uTime: { value: 0 },
      uBeamColor: { value: new THREE.Color(0xffd78c) },
    },
  });

  // Tilt beams slightly downward (-0.065 rad) toward surrounding ocean horizon
  const beamA = new THREE.Mesh(coneGeo, beamMat);
  beamA.rotation.order = 'YXZ';
  beamA.rotation.set(0.065, Math.PI / 2, 0); // points along +X
  beamA.frustumCulled = false;
  beamA.renderOrder = 6;

  const beamB = new THREE.Mesh(coneGeo, beamMat);
  beamB.rotation.order = 'YXZ';
  beamB.rotation.set(0.065, -Math.PI / 2, 0); // points along -X
  beamB.frustumCulled = false;
  beamB.renderOrder = 6;

  opticPivot.add(beamA, beamB);

  // Camera-facing lantern halo + directional flash when beam sweeps across viewer
  const haloMat = new THREE.ShaderMaterial({
    vertexShader: HALO_VERT,
    fragmentShader: HALO_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uScale: { value: 5.5 },
      uColor: { value: new THREE.Color(0xffdf9e) },
      uIntensity: { value: 0 },
    },
  });
  const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat);
  haloMesh.position.set(LIGHTHOUSE_POS.x, lanternY, LIGHTHOUSE_POS.z);
  haloMesh.frustumCulled = false;
  haloMesh.renderOrder = 7;
  group.add(haloMesh);

  // Warm point light illuminating gallery, dome, cottage roof, and cliff top
  const lanternLight = new THREE.PointLight(0xffbe6b, 0, 28, 1.6);
  lanternLight.position.set(LIGHTHOUSE_POS.x, lanternY, LIGHTHOUSE_POS.z);
  group.add(lanternLight);

  const cottageLight = new THREE.PointLight(0xff9d47, 0, 11, 1.8);
  cottageLight.position.set(COTTAGE_POS.x, cottageH + 1.6, COTTAGE_POS.z + 1.3);
  group.add(cottageLight);

  return {
    group,
    lanternWorldPos: new THREE.Vector3(LIGHTHOUSE_POS.x, lanternY, LIGHTHOUSE_POS.z),
    update(t, atmo, cameraPos) {
      // Rotate optic so local +X aligns with (cos(beamAngle), sin(beamAngle)) in XZ!
      // In Three.js rotation.y = -beamAngle maps (+1, 0, 0) -> (cos(beamAngle), 0, sin(beamAngle))!
      opticPivot.rotation.y = -atmo.beamAngle;

      materials.windowWarm.emissiveIntensity = atmo.cottageGlow * 2.2;
      cottageLight.intensity = atmo.cottageGlow * 3.2;

      const power = atmo.lighthousePower;
      materials.lampCore.opacity = 0.15 + 0.85 * power;
      materials.lampCore.color.setHex(power > 0.1 ? 0xfff6dc : 0x9ab0c4);
      lanternLight.intensity = power * 14.0;

      beamMat.uniforms.uVisibility.value = atmo.beamVisibility * power;
      beamMat.uniforms.uTime.value = t;

      // Compute directional lighthouse eye-flash when either beam points toward camera
      const dx = cameraPos.x - LIGHTHOUSE_POS.x;
      const dz = cameraPos.z - LIGHTHOUSE_POS.z;
      const distXZ = Math.hypot(dx, dz) || 1;
      const toCamX = dx / distXZ;
      const toCamZ = dz / distXZ;
      const beamX = Math.cos(atmo.beamAngle);
      const beamZ = Math.sin(atmo.beamAngle);
      const eyeAlign = Math.abs(toCamX * beamX + toCamZ * beamZ);
      const eyeFlash = Math.pow(Math.max(0, eyeAlign), 14.0);

      haloMat.uniforms.uIntensity.value = power * (0.32 + 0.95 * eyeFlash * (0.35 + 0.65 * atmo.beamVisibility));
      haloMat.uniforms.uScale.value = 3.8 + 5.2 * eyeFlash;
    },
  };
}
