import * as THREE from 'three';
import { LIGHTHOUSE_POS, COTTAGE_POS } from './terrain.js';

// Procedural crisp maritime stripe texture for the lighthouse tower
function createTowerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Warm whitewashed stone base
  ctx.fillStyle = '#efe9dd';
  ctx.fillRect(0, 0, 256, 512);

  // Subtle horizontal masonry seams
  ctx.fillStyle = 'rgba(70, 62, 54, 0.07)';
  for (let y = 0; y < 512; y += 16) {
    ctx.fillRect(0, y, 256, 1.5);
  }

  // Two classic maritime crimson bands
  ctx.fillStyle = '#b4352c';
  ctx.fillRect(0, 96, 256, 98);
  ctx.fillRect(0, 290, 256, 102);

  // Subtle weathering gradient near base
  const grad = ctx.createLinearGradient(0, 420, 0, 512);
  grad.addColorStop(0, 'rgba(55, 48, 42, 0)');
  grad.addColorStop(1, 'rgba(55, 48, 42, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 420, 256, 92);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// Create a soft volumetric light beam cone with smooth Fresnel edge falloff & axial fade
function createVolumetricBeam(length = 80, radius = 10.5) {
  const geo = new THREE.ConeGeometry(radius, length, 48, 1, true);
  // Tip at origin, cone extending along +Z
  geo.translate(0, -length * 0.5, 0);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uPower: { value: 0 },
      uColor: { value: new THREE.Color(0xffdfa0) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      varying float vAlong;

      void main() {
        vAlong = clamp(position.z / ${length.toFixed(1)}, 0.0, 1.0);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      varying float vAlong;
      uniform float uPower;
      uniform vec3 uColor;
      uniform float uTime;

      void main() {
        vec3 V = normalize(vViewPos);
        vec3 N = normalize(vNormalView);
        // Ultra-smooth cylindrical edge falloff so beam reads as soft volumetric sea mist
        float ndv = abs(dot(N, V));
        float edge = pow(smoothstep(0.05, 0.98, ndv), 2.3);
        // Smooth fade in near lens and graceful exponential falloff toward far tip
        float axial = smoothstep(0.0, 0.05, vAlong) * pow(1.0 - vAlong, 2.0);
        float mist = 0.94 + 0.06 * sin(vAlong * 16.0 - uTime * 1.1);
        float alpha = edge * axial * mist * uPower * 0.44;
        gl_FragColor = vec4(uColor * (1.28 - vAlong * 0.32), alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  return { mesh, mat };
}

export function createLighthouseSystem() {
  const group = new THREE.Group();

  // --- 1. Lighthouse Tower ---
  const towerGroup = new THREE.Group();
  towerGroup.position.copy(LIGHTHOUSE_POS);
  group.add(towerGroup);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x625c56, roughness: 0.94 });
  const darkIronMat = new THREE.MeshStandardMaterial({ color: 0x1d2128, roughness: 0.45, metalness: 0.72 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8d2b25, roughness: 0.55, metalness: 0.25 });

  // Stone foundation plinth
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.45, 1.4, 16), stoneMat);
  plinth.position.y = 0.2;
  towerGroup.add(plinth);

  // Main tapered striped tower
  const towerTex = createTowerTexture();
  const towerMat = new THREE.MeshStandardMaterial({
    map: towerTex,
    roughness: 0.85,
    metalness: 0.04,
  });
  const towerHeight = 9.0;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.68, towerHeight, 20), towerMat);
  tower.position.y = 0.9 + towerHeight * 0.5;
  tower.castShadow = true;
  tower.receiveShadow = true;
  towerGroup.add(tower);

  // Gallery deck
  const galleryY = 0.9 + towerHeight;
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.28, 0.38, 20), darkIronMat);
  gallery.position.y = galleryY;
  towerGroup.add(gallery);

  // Gallery railing ring + vertical stanchions
  const railRing = new THREE.Mesh(new THREE.TorusGeometry(1.44, 0.045, 6, 20), darkIronMat);
  railRing.rotation.x = Math.PI / 2;
  railRing.position.y = galleryY + 0.75;
  towerGroup.add(railRing);

  const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.65, 5);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const post = new THREE.Mesh(postGeo, darkIronMat);
    post.position.set(Math.cos(a) * 1.44, galleryY + 0.45, Math.sin(a) * 1.44);
    towerGroup.add(post);
  }

  // Glass lantern room
  const lanternY = galleryY + 1.05;
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xd8ecff,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.36,
  });
  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 1.55, 16), glassMat);
  lanternGlass.position.y = lanternY;
  towerGroup.add(lanternGlass);

  // Lantern vertical iron mullions
  const mullionGeo = new THREE.BoxGeometry(0.055, 1.58, 0.055);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m = new THREE.Mesh(mullionGeo, darkIronMat);
    m.position.set(Math.cos(a) * 0.9, lanternY, Math.sin(a) * 0.9);
    towerGroup.add(m);
  }

  // Cupola dome & finial
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.94, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    roofMat
  );
  dome.position.y = lanternY + 0.72;
  towerGroup.add(dome);

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.75, 8), darkIronMat);
  finial.position.y = lanternY + 1.85;
  towerGroup.add(finial);

  // Warm glowing Fresnel beacon core inside lantern
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfff0c2,
    transparent: true,
    opacity: 0.25,
  });
  const beaconCore = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 10), coreMat);
  beaconCore.position.y = lanternY;
  towerGroup.add(beaconCore);

  // Rotating beacon assembly (dual opposite volumetric beams + halo sprite + dynamic lights)
  const rotor = new THREE.Group();
  rotor.position.y = lanternY;
  towerGroup.add(rotor);

  const beamA = createVolumetricBeam(76, 10.5);
  beamA.mesh.rotation.x = 0.09; // gentle downward tilt toward sea
  rotor.add(beamA.mesh);

  const beamB = createVolumetricBeam(76, 10.5);
  beamB.mesh.rotation.y = Math.PI;
  beamB.mesh.rotation.x = -0.09;
  rotor.add(beamB.mesh);

  // Soft additive lantern bloom halo (warm, tight exponential falloff)
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 128;
  haloCanvas.height = 128;
  const hctx = haloCanvas.getContext('2d');
  const hgrad = hctx.createRadialGradient(64, 64, 1, 64, 64, 62);
  hgrad.addColorStop(0.0, 'rgba(255, 246, 212, 0.95)');
  hgrad.addColorStop(0.18, 'rgba(255, 214, 126, 0.52)');
  hgrad.addColorStop(0.45, 'rgba(255, 174, 78, 0.14)');
  hgrad.addColorStop(1.0, 'rgba(255, 140, 50, 0.0)');
  hctx.fillStyle = hgrad;
  hctx.fillRect(0, 0, 128, 128);
  const haloTex = new THREE.CanvasTexture(haloCanvas);
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  const haloSprite = new THREE.Sprite(haloMat);
  haloSprite.position.y = lanternY;
  haloSprite.scale.set(5.4, 5.4, 1);
  towerGroup.add(haloSprite);

  // Local warm point light illuminating the lantern & cliff top
  const beaconPoint = new THREE.PointLight(0xffcf7a, 0, 32, 1.6);
  beaconPoint.position.y = lanternY;
  towerGroup.add(beaconPoint);

  // Rotating directional SpotLight casting real sweep across cliffs and palms
  const spotLight = new THREE.SpotLight(0xffd584, 0, 85, Math.PI * 0.16, 0.75, 1.3);
  spotLight.position.set(0, 0, 0);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -4.5, 36);
  rotor.add(spotLight);
  rotor.add(spotTarget);
  spotLight.target = spotTarget;

  // --- 2. Keeper's Cottage ---
  const cottage = new THREE.Group();
  cottage.position.copy(COTTAGE_POS);
  cottage.rotation.y = 0.42;
  group.add(cottage);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.9, 2.3), wallMat);
  body.position.y = 0.75;
  cottage.add(body);

  // Pitched terracotta roof (4-sided pyramid stretched)
  const roofGeo = new THREE.ConeGeometry(2.35, 1.25, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.scale.set(1.18, 1.0, 0.88);
  roof.position.y = 2.28;
  cottage.add(roof);

  // Chimney
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.42), stoneMat);
  chimney.position.set(-0.95, 2.35, -0.35);
  cottage.add(chimney);

  // Warm glowing cottage windows
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x3b4858,
    emissive: new THREE.Color(0xffaa44),
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  const winGeo = new THREE.PlaneGeometry(0.56, 0.62);
  const win1 = new THREE.Mesh(winGeo, winMat);
  win1.position.set(-0.65, 0.92, 1.16);
  const win2 = new THREE.Mesh(winGeo, winMat);
  win2.position.set(0.65, 0.92, 1.16);
  const win3 = new THREE.Mesh(winGeo, winMat);
  win3.rotation.y = Math.PI / 2;
  win3.position.set(1.61, 0.92, 0.0);
  cottage.add(win1, win2, win3);

  const cottageLight = new THREE.PointLight(0xffa94d, 0, 12, 1.8);
  cottageLight.position.set(0.4, 1.1, 2.1);
  cottage.add(cottageLight);

  // Shared beam state for ocean water reflection
  const beamState = {
    origin: new THREE.Vector3(LIGHTHOUSE_POS.x, LIGHTHOUSE_POS.y + lanternY, LIGHTHOUSE_POS.z),
    direction: new THREE.Vector3(0, 0, 1),
    power: 0,
  };

  function update(t, atmo) {
    // Deterministic continuous rotation phased so beams sweep dramatically across Shots 3, 4 & 5
    const rotAngle = (t - 32.0) * 0.58 + 1.15;
    rotor.rotation.y = rotAngle;

    const power = atmo.lighthousePower;
    beamA.mat.uniforms.uPower.value = power;
    beamA.mat.uniforms.uTime.value = t;
    beamB.mat.uniforms.uPower.value = power;
    beamB.mat.uniforms.uTime.value = t;
    beamA.mesh.visible = power > 0.002;
    beamB.mesh.visible = power > 0.002;

    coreMat.opacity = 0.2 + power * 0.8;
    haloMat.opacity = power * 0.82;
    const pulse = 1.0 + Math.sin(t * 2.2) * 0.04;
    haloSprite.scale.set(5.4 * pulse, 5.4 * pulse, 1);

    beaconPoint.intensity = power * 18.0;
    spotLight.intensity = power * 65.0;

    // Cottage warm glow at dusk & night
    winMat.emissiveIntensity = atmo.cottageGlow * 2.6;
    cottageLight.intensity = atmo.cottageGlow * 4.5;

    // Update world beam direction for ocean shader reflection
    beamState.direction.set(Math.sin(rotAngle), 0, Math.cos(rotAngle)).normalize();
    beamState.power = power;
  }

  return { group, beamState, update };
}
