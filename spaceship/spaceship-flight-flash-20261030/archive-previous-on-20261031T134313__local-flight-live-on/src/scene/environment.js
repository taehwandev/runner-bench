import * as THREE from 'three';
import { createLandingPad } from '../models/landingPad.js';
import { createSkyAndClouds } from './skyAndClouds.js';

export function createEnvironment(scene) {
  const envGroup = new THREE.Group();
  envGroup.name = 'Environment';
  scene.add(envGroup);

  // --- Atmospheric Fog ---
  // Soft daytime haze matching horizon color
  scene.fog = new THREE.FogExp2(0xd2eaff, 0.0032);

  // --- Lighting Setup (Daytime Sun & Sky Fill) ---
  // Hemispheric sky / ground bounce light
  const hemiLight = new THREE.HemisphereLight(0x7dc3f5, 0x485a3e, 1.1);
  hemiLight.position.set(0, 80, 0);
  envGroup.add(hemiLight);

  // Directional Sun Light
  const sunLight = new THREE.DirectionalLight(0xfffaec, 1.8);
  sunLight.position.set(50, 75, 45);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 260;
  
  // Shadow frustum coverage for the base and local flight area
  const d = 65;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;
  envGroup.add(sunLight);

  // Ambient fill
  const ambientLight = new THREE.AmbientLight(0x3e4a5b, 0.4);
  envGroup.add(ambientLight);

  // --- Sky and Clouds ---
  const skyAndClouds = createSkyAndClouds();
  envGroup.add(skyAndClouds);

  // --- Landing Pad & Spaceport Facilities ---
  const landingPad = createLandingPad();
  envGroup.add(landingPad);

  // --- Terrain & Landscape ---
  const terrainMaterials = {
    tarmac: new THREE.MeshStandardMaterial({
      color: 0x323842,
      roughness: 0.9,
      metalness: 0.1
    }),
    grass: new THREE.MeshStandardMaterial({
      color: 0x4c6b45,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true
    }),
    rock: new THREE.MeshStandardMaterial({
      color: 0x6e685f,
      roughness: 0.9,
      metalness: 0.15,
      flatShading: true
    }),
    water: new THREE.MeshStandardMaterial({
      color: 0x1d587a,
      roughness: 0.15,
      metalness: 0.6,
      transparent: true,
      opacity: 0.88
    })
  };

  // Base Apron / Tarmac surrounding pad
  const apronGeo = new THREE.CylinderGeometry(28, 30, 0.2, 32);
  const apronMesh = new THREE.Mesh(apronGeo, terrainMaterials.tarmac);
  apronMesh.position.set(0, 0.05, 0);
  apronMesh.receiveShadow = true;
  envGroup.add(apronMesh);

  // Main ground terrain mesh with procedurally elevated hills & mountains
  const terrainWidth = 380;
  const terrainSegments = 70;
  const terrainGeo = new THREE.PlaneGeometry(terrainWidth, terrainWidth, terrainSegments, terrainSegments);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    const distFromCenter = Math.sqrt(v.x * v.x + v.z * v.z);

    let height = 0;

    // Keep the center landing base flat (radius < 32)
    if (distFromCenter > 32) {
      const blend = Math.min(1.0, (distFromCenter - 32) / 30.0);
      
      // Gentle rolling landscape
      const rolling = (Math.sin(v.x * 0.035) + Math.cos(v.z * 0.04)) * 3.5;
      
      // Ridge mountains in distance (especially North and East)
      const ridgeEast = Math.max(0, (v.x - 40) * 0.28) * (Math.sin(v.z * 0.05) * 0.5 + 0.8);
      const ridgeNorth = Math.max(0, (-v.z - 45) * 0.3) * (Math.cos(v.x * 0.04) * 0.5 + 0.8);
      
      // Depress West side into a coastal bay
      let bayDepth = 0;
      if (v.x < -60) {
        bayDepth = Math.min(12, (-v.x - 60) * 0.35);
      }

      height = (rolling + ridgeEast + ridgeNorth - bayDepth) * blend;
    }

    posAttr.setY(i, height);
  }

  terrainGeo.computeVertexNormals();
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMaterials.grass);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  envGroup.add(terrainMesh);

  // Coastal Bay Water Plane
  const waterGeo = new THREE.PlaneGeometry(160, 220);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, terrainMaterials.water);
  waterMesh.position.set(-110, -0.6, 0);
  waterMesh.receiveShadow = true;
  envGroup.add(waterMesh);

  // --- Circuit Guide Waypoint Visual Beacons ---
  // Slender navigation pylons along the flight circuit with pulsing lights
  const circuitMarkers = [
    { x: 30, z: -45, height: 16, label: 'WP1-NORTH' },
    { x: 62, z: 25, height: 20, label: 'WP2-EAST' },
    { x: -25, z: 50, height: 16, label: 'WP3-SOUTH' },
    { x: -48, z: 15, height: 14, label: 'WP4-WEST' }
  ];

  const markerPoleMat = new THREE.MeshStandardMaterial({
    color: 0x485260,
    metalness: 0.7,
    roughness: 0.3
  });
  const markerLightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  circuitMarkers.forEach((m) => {
    const pylon = new THREE.Group();
    pylon.position.set(m.x, 0, m.z);

    // Mast
    const mastGeo = new THREE.CylinderGeometry(0.18, 0.4, m.height, 8);
    const mast = new THREE.Mesh(mastGeo, markerPoleMat);
    mast.position.set(0, m.height / 2, 0);
    mast.castShadow = true;
    pylon.add(mast);

    // Beacon ring on top
    const ringGeo = new THREE.TorusGeometry(0.8, 0.12, 6, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, markerLightMat);
    ring.position.set(0, m.height, 0);
    pylon.add(ring);

    // Top strobe
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), markerLightMat);
    strobe.position.set(0, m.height + 0.3, 0);
    pylon.add(strobe);

    envGroup.add(pylon);
  });

  // --- Low-Poly Stylized Pine Trees / Vegetation Clusters ---
  const foliageGroup = new THREE.Group();
  envGroup.add(foliageGroup);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x422f20, roughness: 0.9 });
  const needleMat1 = new THREE.MeshStandardMaterial({ color: 0x2d4f29, roughness: 0.85, flatShading: true });
  const needleMat2 = new THREE.MeshStandardMaterial({ color: 0x3d6637, roughness: 0.85, flatShading: true });

  const treePositions = [
    // Surrounding spaceport outskirts (outside pad clear zone)
    { x: -22, z: 28 }, { x: -26, z: 32 }, { x: -18, z: 34 },
    { x: 18, z: 28 }, { x: 24, z: 32 }, { x: 28, z: 22 },
    { x: -38, z: -5 }, { x: -42, z: -12 }, { x: -35, z: 12 },
    { x: 38, z: -5 }, { x: 42, z: 8 }, { x: 35, z: -32 },
    { x: 5, z: 42 }, { x: -8, z: 46 }, { x: 12, z: 48 },
    { x: -5, z: -42 }, { x: 14, z: -45 }, { x: -18, z: -48 }
  ];

  treePositions.forEach((pos, idx) => {
    const tree = new THREE.Group();
    const scale = 0.8 + Math.random() * 0.5;
    tree.position.set(pos.x, 0, pos.z);
    tree.scale.set(scale, scale, scale);

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.8, 6);
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
    trunkMesh.position.set(0, 0.9, 0);
    trunkMesh.castShadow = true;
    tree.add(trunkMesh);

    // Foliage tiers (3 cones stacked)
    const mat = idx % 2 === 0 ? needleMat1 : needleMat2;
    for (let t = 0; t < 3; t++) {
      const coneGeo = new THREE.ConeGeometry(1.6 - t * 0.35, 1.8, 6);
      const coneMesh = new THREE.Mesh(coneGeo, mat);
      coneMesh.position.set(0, 1.8 + t * 1.1, 0);
      coneMesh.castShadow = true;
      tree.add(coneMesh);
    }

    foliageGroup.add(tree);
  });

  // Overall update method
  let animTime = 0;
  envGroup.update = function (deltaSec) {
    animTime += deltaSec;
    skyAndClouds.update(deltaSec);
    landingPad.update(deltaSec);

    // Pulsate circuit waypoint pylons
    const pulse = 0.5 + 0.5 * Math.sin(animTime * 4.0);
    markerLightMat.color.setRGB(0.1 + pulse * 0.2, 0.7 + pulse * 0.3, 1.0);

    // Gentle water shimmer
    waterMesh.position.y = -0.6 + Math.sin(animTime * 1.5) * 0.05;
  };

  return {
    group: envGroup,
    landingPad,
    sunLight
  };
}
