import * as THREE from "three";
import { createRng } from "./rng.js";

const SNOW_COUNT = 7800;

function createSkyDome() {
  const geo = new THREE.SphereGeometry(1650, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uZenithColor: { value: new THREE.Color(0x0b1528) },
      uMidColor: { value: new THREE.Color(0x283254) },
      uHorizonColor: { value: new THREE.Color(0xd67854) },
      uNightFactor: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uZenithColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform float uNightFactor;
      varying vec3 vWorldDir;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        float h = clamp(vWorldDir.y, -0.15, 1.0);
        float horizonBand = smoothstep(-0.08, 0.24, h);
        float zenithBand = smoothstep(0.18, 0.78, h);

        float duskGlow = pow(max(0.0, 1.0 - abs(h - 0.03) * 4.0), 2.0)
          * (0.55 + 0.45 * clamp(vWorldDir.z * 0.6 + 0.4, 0.0, 1.0));

        vec3 col = mix(uHorizonColor, uMidColor, horizonBand);
        col = mix(col, uZenithColor, zenithBand);
        col += uHorizonColor * duskGlow * (0.42 * (1.0 - uNightFactor * 0.75));

        float cloudWave = sin(vWorldDir.x * 9.0 + uTime * 0.025)
          * cos(vWorldDir.z * 7.0 - uTime * 0.018);
        float cloudMask = smoothstep(0.04, 0.45, h) * (1.0 - smoothstep(0.45, 0.85, h));
        col += vec3(0.05, 0.06, 0.09) * cloudWave * cloudMask;

        if (h > 0.10 && uNightFactor > 0.12) {
          vec3 starCell = floor(vWorldDir * 300.0);
          float r = hash31(starCell);
          if (r > 0.9935) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 3.1 + r * 90.0);
            float starAlpha = smoothstep(0.10, 0.46, h) * uNightFactor * twinkle;
            col += vec3(0.82, 0.90, 1.0) * starAlpha * 0.92;
          }
        }

        vec3 moonDir = normalize(vec3(-0.34, 0.42, 0.84));
        float moonDot = dot(vWorldDir, moonDir);
        float moonHalo = pow(max(0.0, moonDot), 42.0) * (0.20 + 0.38 * uNightFactor);
        float moonDisc = smoothstep(0.9993, 0.99962, moonDot) * (0.4 + 0.6 * uNightFactor);
        col += vec3(0.75, 0.86, 1.0) * (moonHalo + moonDisc);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

function createSnowField(track, timeline, textures) {
  const rng = createRng(602214);
  const geo = new THREE.BufferGeometry();

  const offsets = new Float32Array(SNOW_COUNT * 3);
  const params = new Float32Array(SNOW_COUNT * 3);

  const boxW = 92.0;
  const boxH = 74.0;
  const boxD = 92.0;

  for (let i = 0; i < SNOW_COUNT; i++) {
    offsets[i * 3] = rng.range(0, boxW);
    offsets[i * 3 + 1] = rng.range(0, boxH);
    offsets[i * 3 + 2] = rng.range(0, boxD);

    params[i * 3] = rng.range(5.4, 10.6); // fall speed
    params[i * 3 + 1] = rng.chance(0.18)
      ? rng.range(1.6, 2.6)
      : rng.range(0.75, 1.5); // multi-scale flake size
    params[i * 3 + 2] = rng.range(0, Math.PI * 2); // flutter phase
  }

  geo.setAttribute("position", new THREE.BufferAttribute(offsets, 3));
  geo.setAttribute("aParam", new THREE.BufferAttribute(params, 3));

  const tStartPose = track.getPoseAtDistance(timeline.landmarks.tunnelStart);
  const tEndPose = track.getPoseAtDistance(timeline.landmarks.tunnelEnd);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uAnchor: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(boxW, boxH, boxD) },
      uPixelRatio: { value: 1.5 },
      uSprite: { value: textures.softGlow },
      uTint: { value: new THREE.Color(0xeef5ff) },
      uTunnelZ: {
        value: new THREE.Vector2(
          tStartPose.position.z - 1.5,
          tEndPose.position.z + 1.5
        ),
      },
    },
    vertexShader: `
      attribute vec3 aParam;
      uniform float uTime;
      uniform vec3 uAnchor;
      uniform vec3 uBox;
      uniform float uPixelRatio;
      uniform vec2 uTunnelZ;
      varying float vAlpha;

      void main() {
        float fallSpeed = aParam.x;
        float sizeScale = aParam.y;
        float phase = aParam.z;

        vec3 wind = vec3(3.1, -fallSpeed, -3.6) * uTime;
        vec3 rawPos = position + wind;
        vec3 halfBox = uBox * 0.5;
        vec3 worldPos = uAnchor - halfBox + mod(rawPos - uAnchor + halfBox, uBox);

        worldPos.x += sin(uTime * 2.2 + phase) * 0.72;
        worldPos.z += cos(uTime * 1.8 + phase * 1.3) * 0.72;

        bool insideMonolith = worldPos.z > uTunnelZ.x
          && worldPos.z < uTunnelZ.y
          && abs(worldPos.x) < 62.0
          && worldPos.y < 245.0;

        vec4 mvPos = viewMatrix * vec4(worldPos, 1.0);
        float dist = length(mvPos.xyz);
        float edgeFade = 1.0 - smoothstep(34.0, 46.0, dist);
        float nearFade = smoothstep(1.1, 3.6, dist);

        vAlpha = insideMonolith ? 0.0 : (edgeFade * nearFade * 0.88);
        gl_PointSize = insideMonolith
          ? 0.0
          : clamp((78.0 * sizeScale * uPixelRatio) / max(1.6, -mvPos.z), 2.2, 18.0);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uSprite;
      uniform vec3 uTint;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.005) discard;
        vec4 tex = texture2D(uSprite, gl_PointCoord);
        gl_FragColor = vec4(uTint, tex.a * vAlpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat };
}

export function createAtmosphereSystem(scene, track, timeline, textures) {
  const fog = new THREE.FogExp2(0x25324c, 0.0042);
  scene.fog = fog;

  const sky = createSkyDome();
  scene.add(sky.mesh);

  const hemiLight = new THREE.HemisphereLight(0x96bcf0, 0x2e394e, 1.45);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffb17a, 1.95);
  keyLight.position.set(-85, 72, 120);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x86b4f4, 1.35);
  rimLight.position.set(95, 110, -80);
  scene.add(rimLight);

  const snow = createSnowField(track, timeline, textures);
  scene.add(snow.points);

  const cZenithDusk = new THREE.Color(0x0b1528);
  const cZenithNight = new THREE.Color(0x040813);
  const cMidDusk = new THREE.Color(0x2a3558);
  const cMidNight = new THREE.Color(0x0b1830);
  const cHorizDusk = new THREE.Color(0xd67854);
  const cHorizTwilight = new THREE.Color(0x563954);
  const cHorizNight = new THREE.Color(0x112544);
  const cFogDusk = new THREE.Color(0x283552);
  const cFogNight = new THREE.Color(0x0a162a);
  const cKeyDusk = new THREE.Color(0xffad78);
  const cKeyNight = new THREE.Color(0x8ebaff);

  return {
    setPixelRatio(dpr) {
      snow.mat.uniforms.uPixelRatio.value = dpr;
    },
    update(state, camera) {
      const t = state.time;
      const pNight = Math.min(1.0, Math.max(0.0, (t - 8.0) / 42.0));
      const pLate = Math.min(1.0, Math.max(0.0, (t - 34.0) / 20.0));

      sky.mesh.position.copy(camera.position);
      sky.mat.uniforms.uTime.value = t;
      sky.mat.uniforms.uNightFactor.value = pNight;
      sky.mat.uniforms.uZenithColor.value.lerpColors(
        cZenithDusk,
        cZenithNight,
        pNight
      );
      sky.mat.uniforms.uMidColor.value.lerpColors(cMidDusk, cMidNight, pNight);

      if (t < 32.0) {
        sky.mat.uniforms.uHorizonColor.value.lerpColors(
          cHorizDusk,
          cHorizTwilight,
          Math.min(1.0, t / 32.0)
        );
      } else {
        sky.mat.uniforms.uHorizonColor.value.lerpColors(
          cHorizTwilight,
          cHorizNight,
          pLate
        );
      }

      fog.color.lerpColors(cFogDusk, cFogNight, pNight);
      fog.density = state.train.inTunnel
        ? 0.0046
        : 0.0042 - pLate * 0.0012;

      keyLight.color.lerpColors(cKeyDusk, cKeyNight, pNight);
      keyLight.intensity = state.train.inTunnel
        ? 0.55
        : 1.95 - pNight * 0.42;
      hemiLight.intensity = state.train.inTunnel
        ? 0.78
        : 1.45 - pNight * 0.25;

      snow.mat.uniforms.uTime.value = t;
      snow.mat.uniforms.uAnchor.value.copy(camera.position);
    },
  };
}
