import * as THREE from 'three';
import { mulberry32 } from './prng.js';

function createSkyDome() {
  const geo = new THREE.SphereGeometry(260, 32, 24);
  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 0.5, -1) },
    uMoonDir: { value: new THREE.Vector3(0, 0.3, 1) },
    uSkyZenith: { value: new THREE.Color('#1d65a8') },
    uSkyMid: { value: new THREE.Color('#5da9de') },
    uSkyHorizon: { value: new THREE.Color('#f4dab0') },
    uSunColor: { value: new THREE.Color('#fff0cc') },
    uSunIntensity: { value: 1.0 },
    uStarOpacity: { value: 0.0 },
    uMoonOpacity: { value: 0.0 }
  };

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyMid;
      uniform vec3 uSkyHorizon;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform float uStarOpacity;
      uniform float uMoonOpacity;

      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);

        // 3-stop sky gradient
        vec3 col = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uSkyZenith, smoothstep(0.22, 0.85, h));

        // Atmospheric horizon glow toward the sun azimuth
        float sunCos = max(dot(dir, normalize(uSunDir)), 0.0);
        float horizonMask = 1.0 - smoothstep(0.0, 0.55, h);
        float sunGlow = pow(sunCos, 5.0) * horizonMask * clamp(uSunIntensity * 0.45, 0.0, 0.85);
        col += uSunColor * sunGlow * 0.65;

        // Sun disc & corona (fades below horizon)
        float sunAbove = smoothstep(-0.04, 0.03, uSunDir.y);
        if (sunAbove > 0.001) {
          float sunDisc = smoothstep(0.9986, 0.9994, sunCos);
          float sunHalo = pow(sunCos, 96.0) * 0.95 + pow(sunCos, 16.0) * 0.28;
          col += uSunColor * (sunDisc * 3.2 + sunHalo) * sunAbove * clamp(uSunIntensity * 0.5, 0.2, 1.2);
        }

        // Subtle Milky Way band at night
        if (uStarOpacity > 0.01) {
          float bandCoord = dot(dir, normalize(vec3(0.45, 0.52, -0.72)));
          float milky = exp(-bandCoord * bandCoord * 14.0) * smoothstep(0.03, 0.42, h);
          col += vec3(0.11, 0.16, 0.28) * milky * uStarOpacity * 0.85;
        }

        // Moon disc + silver halo
        if (uMoonOpacity > 0.01 && uMoonDir.y > -0.05) {
          float moonCos = max(dot(dir, normalize(uMoonDir)), 0.0);
          float moonDisc = smoothstep(0.99925, 0.99955, moonCos);
          float moonHalo = pow(moonCos, 140.0) * 0.45 + pow(moonCos, 24.0) * 0.12;
          float moonAbove = smoothstep(-0.02, 0.05, uMoonDir.y);
          col += vec3(0.86, 0.92, 1.0) * (moonDisc * 1.9 + moonHalo) * uMoonOpacity * moonAbove;
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, uniforms };
}

function createStarfield(seed = 5150) {
  const rng = mulberry32(seed);
  const count = 1750;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const starPalette = [
    new THREE.Color('#ffffff'),
    new THREE.Color('#dbe8ff'),
    new THREE.Color('#fff0d4'),
    new THREE.Color('#c8dcff')
  ];

  for (let i = 0; i < count; i++) {
    // Bias slightly toward upper hemisphere
    const u = rng();
    const v = rng();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(1 - v * 0.96); // down to just above horizon
    const r = 235;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    sizes[i] = 2.4 + Math.pow(rng(), 2.0) * 5.2;
    phases[i] = rng() * Math.PI * 2;

    const c = starPalette[Math.floor(rng() * starPalette.length)];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uPixelRatio: { value: 1 }
  };

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms,
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vElev;

      void main() {
        vColor = aColor;
        vElev = normalize(position).y;
        vTwinkle = 0.68 + 0.32 * sin(uTime * 2.4 + aPhase);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (260.0 / max(-mvPos.z, 1.0));
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vTwinkle;
      varying float vElev;

      void main() {
        if (uOpacity <= 0.005) discard;
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float soft = smoothstep(0.5, 0.06, d);
        float horizonFade = smoothstep(0.02, 0.20, vElev);
        gl_FragColor = vec4(vColor * 1.25, soft * vTwinkle * uOpacity * horizonFade);
      }
    `
  });

  const points = new THREE.Points(geo, mat);
  return { points, uniforms };
}

function createClouds(seed = 9090) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const clouds = [];

  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#fff9ef',
    emissive: new THREE.Color('#8fa9c7'),
    emissiveIntensity: 0.38,
    roughness: 0.96,
    metalness: 0.0,
    transparent: true,
    opacity: 0.88,
    flatShading: true
  });

  for (let i = 0; i < 16; i++) {
    const cluster = new THREE.Group();
    const angle = (i / 16) * Math.PI * 2 + rng() * 0.3;
    const dist = 75 + rng() * 85;
    const baseY = 26 + rng() * 24;

    const puffs = 4 + Math.floor(rng() * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      const sx = 4.5 + rng() * 5.5;
      const sy = 1.6 + rng() * 2.1;
      const sz = 3.2 + rng() * 4.0;
      puff.scale.set(sx, sy, sz);
      puff.position.set(
        (rng() - 0.5) * 9.5,
        (rng() - 0.5) * 1.4,
        (rng() - 0.5) * 4.5
      );
      cluster.add(puff);
    }

    cluster.position.set(Math.cos(angle) * dist, baseY, Math.sin(angle) * dist);
    cluster.rotation.y = -angle + Math.PI * 0.5;
    group.add(cluster);

    clouds.push({
      cluster,
      baseAngle: angle,
      dist,
      baseY,
      angularSpeed: 0.008 + rng() * 0.008,
      bobPhase: rng() * Math.PI * 2
    });
  }

  function update(t, atmo) {
    cloudMat.color.copy(atmo.cloudLit);
    cloudMat.emissive.copy(atmo.cloudShade);
    cloudMat.opacity = 0.88 - atmo.starOpacity * 0.32;

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const a = c.baseAngle + t * c.angularSpeed;
      c.cluster.position.set(
        Math.cos(a) * c.dist,
        c.baseY + Math.sin(t * 0.25 + c.bobPhase) * 0.6,
        Math.sin(a) * c.dist
      );
      c.cluster.rotation.y = -a + Math.PI * 0.5;
    }
  }

  return { group, update };
}

export function createSky(pixelRatio = 1) {
  const group = new THREE.Group();
  const dome = createSkyDome();
  const stars = createStarfield();
  const clouds = createClouds();

  stars.uniforms.uPixelRatio.value = pixelRatio;

  group.add(dome.mesh);
  group.add(stars.points);
  group.add(clouds.group);

  function update(t, atmo, cameraPos) {
    // Center sky dome & starfield around camera so horizon is always infinitely distant
    dome.mesh.position.copy(cameraPos);
    stars.points.position.copy(cameraPos);
    // Subtle celestial rotation over the 60s time-lapse
    stars.points.rotation.y = t * 0.004;

    dome.uniforms.uTime.value = t;
    dome.uniforms.uSunDir.value.copy(atmo.sunDir);
    dome.uniforms.uMoonDir.value.copy(atmo.moonDir);
    dome.uniforms.uSkyZenith.value.copy(atmo.skyZenith);
    dome.uniforms.uSkyMid.value.copy(atmo.skyMid);
    dome.uniforms.uSkyHorizon.value.copy(atmo.skyHorizon);
    dome.uniforms.uSunColor.value.copy(atmo.sunColor);
    dome.uniforms.uSunIntensity.value = atmo.sunIntensity;
    dome.uniforms.uStarOpacity.value = atmo.starOpacity;
    dome.uniforms.uMoonOpacity.value = atmo.moonOpacity;

    stars.uniforms.uTime.value = t;
    stars.uniforms.uOpacity.value = atmo.starOpacity;

    clouds.update(t, atmo);
  }

  return { group, update };
}
