import * as THREE from 'three';

/**
 * Creates a beautiful gradient daytime sky dome and drifting 3D cumulus clouds.
 */
export function createSkyAndClouds() {
  const group = new THREE.Group();
  group.name = 'SkyAndClouds';

  // --- Sky Dome with custom daytime gradient shader ---
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
    uniform vec3 horizonColor;
    uniform vec3 groundColor;
    uniform vec3 sunPosition;
    varying vec3 vWorldPosition;

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float h = dir.y;
      
      // Zenith to horizon gradient
      vec3 skyColor = mix(horizonColor, topColor, max(pow(max(h, 0.0), 0.55), 0.0));
      // Below horizon gradient to ground color
      if (h < 0.0) {
        skyColor = mix(horizonColor, groundColor, min(-h * 4.0, 1.0));
      }

      // Subtle solar glow near sun direction
      vec3 sunDir = normalize(sunPosition);
      float sunDot = max(dot(dir, sunDir), 0.0);
      float sunGlow = pow(sunDot, 128.0) * 0.8 + pow(sunDot, 8.0) * 0.25;
      vec3 sunColor = vec3(1.0, 0.95, 0.8);
      skyColor += sunColor * sunGlow * step(0.0, h);

      gl_FragColor = vec4(skyColor, 1.0);
    }
  `;

  const skyUniforms = {
    topColor: { value: new THREE.Color(0x1a78c2) },      // Deep vibrant daytime sky blue
    horizonColor: { value: new THREE.Color(0xd2eaff) },  // Soft hazy bright horizon
    groundColor: { value: new THREE.Color(0x43523f) },   // Earthy ground tone
    sunPosition: { value: new THREE.Vector3(50, 70, 40) }
  };

  const skyGeo = new THREE.SphereGeometry(350, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyMesh);

  // --- Sun Disk ---
  const sunDiskGeo = new THREE.PlaneGeometry(28, 28);
  const sunDiskMat = new THREE.MeshBasicMaterial({
    color: 0xfffbe8,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });
  const sunDisk = new THREE.Mesh(sunDiskGeo, sunDiskMat);
  // Position sun disk along sun direction
  const sunDir = skyUniforms.sunPosition.value.clone().normalize();
  sunDisk.position.copy(sunDir.clone().multiplyScalar(300));
  sunDisk.lookAt(0, 0, 0);
  group.add(sunDisk);

  // --- 3D Procedural Cumulus Clouds ---
  const cloudGroup = new THREE.Group();
  group.add(cloudGroup);

  const cloudPuffMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
    transparent: true,
    opacity: 0.88
  });

  // Create several cloud clusters at varying altitudes (65 to 110)
  const clouds = [];
  const numCloudClusters = 14;

  for (let i = 0; i < numCloudClusters; i++) {
    const cluster = new THREE.Group();
    // Random position across the sky
    const radius = 60 + Math.random() * 180;
    const angle = Math.random() * Math.PI * 2;
    const altitude = 65 + Math.random() * 35;

    cluster.position.set(
      Math.cos(angle) * radius,
      altitude,
      Math.sin(angle) * radius
    );

    // Each cluster made of 5-8 overlapping spheres
    const numPuffs = 5 + Math.floor(Math.random() * 4);
    for (let p = 0; p < numPuffs; p++) {
      const puffRadius = 6 + Math.random() * 8;
      const puffGeo = new THREE.DodecahedronGeometry(puffRadius, 1);
      const puff = new THREE.Mesh(puffGeo, cloudPuffMat);
      puff.position.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 14
      );
      puff.scale.set(1.2, 0.65, 1.0);
      puff.castShadow = true;
      cluster.add(puff);
    }

    cloudGroup.add(cluster);
    clouds.push({
      group: cluster,
      driftSpeed: 0.8 + Math.random() * 0.6
    });
  }

  // Animation update
  group.update = function (deltaSec) {
    // Clouds drift slowly along +X / -Z
    clouds.forEach((c) => {
      c.group.position.x += deltaSec * c.driftSpeed;
      c.group.position.z -= deltaSec * c.driftSpeed * 0.3;

      // Wrap around when too far
      if (c.group.position.x > 240) {
        c.group.position.x = -240;
      }
      if (c.group.position.z < -240) {
        c.group.position.z = 240;
      }
    });
  };

  return group;
}
