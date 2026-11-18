import * as THREE from 'three';
import { getIslandHeight, LIGHTHOUSE_XZ } from './terrain.js';

function createBeamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uPower: { value: 0.0 },
      uColor: { value: new THREE.Color('#ffe8a8') }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPower;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;

      void main() {
        if (uPower <= 0.001) discard;
        // vUv.y = 1.0 at apex (lantern), 0.0 at far end of cone
        float distFade = pow(clamp(vUv.y, 0.0, 1.0), 1.65);
        // Soften edges using view-angle normal dot
        vec3 V = normalize(vViewPos);
        float edge = abs(dot(normalize(vNormalView), V));
        float edgeFade = pow(edge, 2.2);
        float alpha = distFade * edgeFade * uPower * 0.30;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
}

export function createLighthouse() {
  const group = new THREE.Group();
  const baseY = getIslandHeight(LIGHTHOUSE_XZ.x, LIGHTHOUSE_XZ.z);
  group.position.set(LIGHTHOUSE_XZ.x, baseY - 0.35, LIGHTHOUSE_XZ.z);

  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#6e6a66',
    roughness: 0.92
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: '#f2ece1',
    roughness: 0.78
  });
  const redMat = new THREE.MeshStandardMaterial({
    color: '#b53d2e',
    roughness: 0.76
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: '#222831',
    roughness: 0.5,
    metalness: 0.45
  });
  const lanternCoreMat = new THREE.MeshStandardMaterial({
    color: '#fff6dc',
    emissive: new THREE.Color('#ffcf75'),
    emissiveIntensity: 0.0,
    roughness: 0.2
  });

  // Stone foundation plinth
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.35, 1.2, 12), stoneMat);
  plinth.position.y = 0.6;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Tapered tower in 4 bands (white, red, white, red)
  const bands = [
    { y0: 1.2, h: 2.3, r0: 1.65, r1: 1.44, mat: whiteMat },
    { y0: 3.5, h: 2.1, r0: 1.44, r1: 1.25, mat: redMat },
    { y0: 5.6, h: 2.1, r0: 1.25, r1: 1.07, mat: whiteMat },
    { y0: 7.7, h: 1.5, r0: 1.07, r1: 0.95, mat: redMat }
  ];
  for (const b of bands) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(b.r1, b.r0, b.h, 16), b.mat);
    seg.position.y = b.y0 + b.h * 0.5;
    seg.castShadow = true;
    seg.receiveShadow = true;
    group.add(seg);
  }

  // Gallery deck
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.15, 0.32, 16), darkMetalMat);
  deck.position.y = 9.36;
  deck.castShadow = true;
  group.add(deck);

  // Railing ring
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.04, 6, 20), darkMetalMat);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 9.88;
  group.add(rail);

  // Lantern room glass & glowing lens core
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#b8d4e8',
    transparent: true,
    opacity: 0.42,
    roughness: 0.15,
    metalness: 0.1
  });
  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 1.25, 12), glassMat);
  lanternGlass.position.y = 10.12;
  group.add(lanternGlass);

  const lanternCore = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), lanternCoreMat);
  lanternCore.position.y = 10.15;
  group.add(lanternCore);

  // Roof dome + finial
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.02, 0.95, 16), darkMetalMat);
  roof.position.y = 11.2;
  roof.castShadow = true;
  group.add(roof);

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.65, 6), darkMetalMat);
  spire.position.y = 11.95;
  group.add(spire);

  // Rotating beam rig at lantern height
  const beamRig = new THREE.Group();
  beamRig.position.y = 10.15;
  group.add(beamRig);

  const beamMat = createBeamMaterial();
  const beamLength = 82;
  const beamGeo = new THREE.ConeGeometry(11.0, beamLength, 48, 1, true);
  // Shift cone so apex is at origin and opens along +Z
  beamGeo.translate(0, -beamLength * 0.5, 0);
  beamGeo.rotateX(-Math.PI / 2);

  const primaryBeam = new THREE.Mesh(beamGeo, beamMat);
  beamRig.add(primaryBeam);

  const secondaryBeam = new THREE.Mesh(beamGeo, beamMat);
  secondaryBeam.rotation.y = Math.PI;
  secondaryBeam.scale.set(0.7, 0.7, 0.72);
  beamRig.add(secondaryBeam);

  // Local point light for warm glow on lantern deck & nearby cliff
  const lanternLight = new THREE.PointLight('#ffd27d', 0, 26, 1.6);
  lanternLight.position.set(0, 10.2, 0);
  group.add(lanternLight);

  // Sweeping SpotLight illuminating cliffs & trees
  const spotLight = new THREE.SpotLight('#ffe29a', 0, 120, Math.PI * 0.14, 0.65, 1.2);
  spotLight.position.set(0, 0, 0);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -4, 40);
  beamRig.add(spotLight);
  beamRig.add(spotTarget);
  spotLight.target = spotTarget;

  const worldPos = new THREE.Vector3();
  const beamDir = new THREE.Vector3();

  function update(t, power) {
    // Smooth deterministic sweep (~0.52 rad/s, starting toward ocean at dusk)
    const angle = t * 0.52 + 0.4;
    beamRig.rotation.y = angle;

    beamMat.uniforms.uPower.value = power;
    lanternCoreMat.emissiveIntensity = power * 4.5;
    lanternLight.intensity = power * 5.5;
    spotLight.intensity = power * 28.0;

    lanternCore.getWorldPosition(worldPos);
    beamDir.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
  }

  return {
    group,
    update,
    getBeamWorldPos: () => worldPos,
    getBeamDir: () => beamDir
  };
}
