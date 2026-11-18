import * as THREE from 'three';
import { HEIGHTMAP_BOUNDS } from './terrain.js';

export function createOcean(heightmapTexture) {
  // Radial-biased grid: dense vertices near the island & shoreline, smoothly stretched to horizon
  const segs = 160;
  const geo = new THREE.PlaneGeometry(2.0, 2.0, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i); // [-1, 1]
    const nz = pos.getZ(i); // [-1, 1]
    // Non-linear stretch so center has ~0.5m resolution and edges reach 380m
    const sx = Math.sign(nx) * (Math.abs(nx) * 32.0 + Math.pow(Math.abs(nx), 2.7) * 348.0);
    const sz = Math.sign(nz) * (Math.abs(nz) * 32.0 + Math.pow(Math.abs(nz), 2.7) * 348.0);
    pos.setX(i, sx);
    pos.setZ(i, sz);
  }
  geo.computeBoundingSphere();

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uHeightmap: { value: heightmapTexture },
      uHeightBounds: { value: HEIGHTMAP_BOUNDS },
      uSunDir: { value: new THREE.Vector3(-0.7, 0.3, -0.5).normalize() },
      uMoonDir: { value: new THREE.Vector3(0.5, 0.4, 0.5).normalize() },
      uSunColor: { value: new THREE.Color(0xfff0d0) },
      uSkyZenith: { value: new THREE.Color(0x1a5da8) },
      uSkyMid: { value: new THREE.Color(0x4f98cf) },
      uSkyHorizon: { value: new THREE.Color(0xf4d4a6) },
      uOceanDeep: { value: new THREE.Color(0x083452) },
      uOceanShallow: { value: new THREE.Color(0x1aa8a2) },
      uFogColor: { value: new THREE.Color(0xdcc7ab) },
      uFogDensity: { value: 0.002 },
      uNightFactor: { value: 0 },
      uSunsetFactor: { value: 0 },
      uMoonAlpha: { value: 0 },
      uBeamPos: { value: new THREE.Vector3(-5.2, 24.4, -4.2) },
      uBeamDir: { value: new THREE.Vector3(1, 0, 0) },
      uBeamPower: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uHeightmap;
      uniform float uHeightBounds;

      varying vec3 vWorldPos;
      varying float vWaveHeight;
      varying float vCrest;

      float sampleBed(vec2 xz) {
        vec2 uv = xz / (uHeightBounds * 2.0) + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -10.0;
        float hNorm = texture2D(uHeightmap, uv).r;
        return mix(-10.0, 18.0, hNorm);
      }

      void main() {
        vec3 p = position;
        float bedH = sampleBed(p.xz);
        // Dampen vertical swell amplitude right at very shallow shore
        float shoreDamp = smoothstep(0.4, -2.8, bedH);
        float ampScale = mix(0.28, 1.0, shoreDamp);

        // 4 deterministic directional wave swells
        float w1 = sin(dot(p.xz, vec2(0.16, 0.22)) - uTime * 1.45) * 0.34;
        float w2 = sin(dot(p.xz, vec2(-0.24, 0.14)) - uTime * 1.15 + 1.3) * 0.22;
        float w3 = sin(dot(p.xz, vec2(0.09, -0.31)) - uTime * 1.85 + 2.7) * 0.12;
        float w4 = cos(dot(p.xz, vec2(0.42, 0.35)) - uTime * 2.35) * 0.06;

        float h = (w1 + w2 + w3 + w4) * ampScale;
        p.y += h;

        vWaveHeight = h;
        vCrest = clamp((w1 + w2) * 1.3, 0.0, 1.0) * shoreDamp;

        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uHeightmap;
      uniform float uHeightBounds;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyMid;
      uniform vec3 uSkyHorizon;
      uniform vec3 uOceanDeep;
      uniform vec3 uOceanShallow;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uNightFactor;
      uniform float uSunsetFactor;
      uniform float uMoonAlpha;
      uniform vec3 uBeamPos;
      uniform vec3 uBeamDir;
      uniform float uBeamPower;

      varying vec3 vWorldPos;
      varying float vWaveHeight;
      varying float vCrest;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.5);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float sampleBed(vec2 xz) {
        vec2 uv = xz / (uHeightBounds * 2.0) + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -10.0;
        float hNorm = texture2D(uHeightmap, uv).r;
        return mix(-10.0, 18.0, hNorm);
      }

      // Procedural multi-scale wave height for crisp analytical normals
      float waveField(vec2 p, float t) {
        float h = 0.0;
        h += sin(dot(p, vec2(0.16, 0.22)) - t * 1.45) * 0.34;
        h += sin(dot(p, vec2(-0.24, 0.14)) - t * 1.15 + 1.3) * 0.22;
        h += sin(dot(p, vec2(0.09, -0.31)) - t * 1.85 + 2.7) * 0.12;
        h += sin(dot(p, vec2(0.55, 0.48)) - t * 2.4) * 0.055;
        h += sin(dot(p, vec2(-0.82, 0.61)) - t * 2.9 + 0.8) * 0.032;
        h += (noise2(p * 0.65 + vec2(t * 0.42, -t * 0.31)) - 0.5) * 0.09;
        h += (noise2(p * 1.85 + vec2(-t * 0.55, t * 0.62)) - 0.5) * 0.04;
        return h;
      }

      void main() {
        vec2 xz = vWorldPos.xz;
        float distCam = length(cameraPosition - vWorldPos);
        vec3 V = normalize(cameraPosition - vWorldPos);

        // Analytical seabed depth
        float bedH = sampleBed(xz);
        float depth = vWorldPos.y - bedH;

        // Compute detailed surface normal via finite differences (attenuated in far distance to prevent shimmer aliasing)
        float eps = mix(0.18, 0.85, clamp(distCam / 180.0, 0.0, 1.0));
        float hC = waveField(xz, uTime);
        float hX = waveField(xz + vec2(eps, 0.0), uTime);
        float hZ = waveField(xz + vec2(0.0, eps), uTime);
        float detailFade = mix(1.0, 0.42, clamp(distCam / 170.0, 0.0, 1.0));
        vec3 N = normalize(vec3((hC - hX) / eps * detailFade, 1.0, (hC - hZ) / eps * detailFade));

        // Base water absorption color: vivid turquoise shallows -> deep indigo ocean
        float shallowMask = exp(-max(depth, 0.0) * 0.48);
        vec3 waterCol = mix(uOceanDeep, uOceanShallow, shallowMask);

        // Subtle subsurface turquoise glow on backlit wave crests
        float sss = pow(max(dot(V, -normalize(uSunDir)), 0.0), 3.0) * vCrest * (1.0 - uNightFactor);
        waterCol += uOceanShallow * sss * 0.45;

        // Sky reflection via Schlick Fresnel
        float cosTheta = max(dot(N, V), 0.0);
        float fresnel = 0.04 + 0.96 * pow(1.0 - cosTheta, 4.2);

        vec3 R = reflect(-V, N);
        float ry = clamp(R.y, 0.0, 1.0);
        vec3 skyRefl = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.25, ry));
        skyRefl = mix(skyRefl, uSkyZenith, smoothstep(0.2, 0.8, ry));

        vec3 col = mix(waterCol, skyRefl, clamp(fresnel * 0.92, 0.0, 0.94));

        // Sun specular glitter path (dual lobe: tight sparkle + broad molten sheen)
        vec3 sunD = normalize(uSunDir);
        float sunAbove = smoothstep(-0.06, 0.05, sunD.y);
        if (sunAbove > 0.001) {
          vec3 H = normalize(sunD + V);
          float ndh = max(dot(N, H), 0.0);
          float specTight = pow(ndh, 240.0) * 2.6;
          float specBroad = pow(ndh, 26.0) * (0.28 + 0.42 * uSunsetFactor);
          col += uSunColor * (specTight + specBroad) * sunAbove * (1.0 - uNightFactor * 0.9);
        }

        // Silver moonlight reflection path at night
        if (uMoonAlpha > 0.001) {
          vec3 moonD = normalize(uMoonDir);
          vec3 Hm = normalize(moonD + V);
          float ndhm = max(dot(N, Hm), 0.0);
          float mSpec = pow(ndhm, 180.0) * 1.15 + pow(ndhm, 24.0) * 0.16;
          col += vec3(0.72, 0.84, 1.0) * mSpec * uMoonAlpha;
        }

        // Lighthouse sweeping golden beam reflection on the water
        if (uBeamPower > 0.001) {
          vec2 toFrag = xz - uBeamPos.xz;
          float fragDist = length(toFrag);
          if (fragDist > 3.0 && fragDist < 130.0) {
            vec2 dir2D = toFrag / fragDist;
            vec2 bDir2D = normalize(uBeamDir.xz);
            // Both opposite beams of the Fresnel lens
            float align = abs(dot(dir2D, bDir2D));
            float cone = smoothstep(0.955, 0.997, align);
            float distFade = exp(-fragDist * 0.018) * smoothstep(3.0, 12.0, fragDist);
            float waveSparkle = 0.65 + 0.55 * max(dot(N, normalize(vec3(-dir2D.x, 0.35, -dir2D.y))), 0.0);
            col += vec3(1.0, 0.82, 0.48) * cone * distFade * waveSparkle * uBeamPower * 0.85;
          }
        }

        // Animated breaking shore foam hugging the exact coastline & boulders
        float foamNoise = noise2(xz * 0.95 + vec2(uTime * 0.28, -uTime * 0.22));
        float foamNoise2 = noise2(xz * 2.4 - vec2(uTime * 0.4, uTime * 0.32));
        float fPattern = foamNoise * 0.6 + foamNoise2 * 0.4;

        // Edge foam right where water meets sand/rock
        float edgeFoam = (1.0 - smoothstep(-0.05, 0.55, depth)) * smoothstep(0.28, 0.62, fPattern + 0.25);

        // Surging concentric wave-runup foam bands in shallow water
        float surgeWave = sin(depth * 6.8 - uTime * 2.6 + foamNoise * 3.2);
        float bandMask = smoothstep(0.15, 0.55, depth) * (1.0 - smoothstep(1.1, 2.35, depth));
        float surgeFoam = smoothstep(0.42, 0.88, surgeWave) * bandMask * smoothstep(0.32, 0.72, fPattern);

        // Subtle open-ocean whitecaps on wave crests
        float crestFoam = smoothstep(0.58, 0.92, vCrest * fPattern * 1.45) * 0.45;

        float totalFoam = clamp(edgeFoam * 0.95 + surgeFoam * 0.78 + crestFoam, 0.0, 1.0);
        // Foam tint adapts to lighting (warm sunlit cream -> rosy sunset -> cool moonlit silver)
        vec3 foamCol = mix(vec3(0.96, 0.97, 0.98), uSkyHorizon * 1.15, 0.35);
        foamCol = mix(foamCol, vec3(0.48, 0.58, 0.74), uNightFactor * 0.72);
        col = mix(col, foamCol, totalFoam);

        // Exponential distance fog blending ocean seamlessly into sky horizon
        float fogFactor = 1.0 - exp(-pow(uFogDensity * distCam, 2.0));
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

        // Soft shoreline alpha feathering so wet sand meets water cleanly without harsh seams
        float alpha = smoothstep(-0.12, 0.22, depth);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;

  function update(t, atmo, beamState) {
    mat.uniforms.uTime.value = t;
    mat.uniforms.uSunDir.value.copy(atmo.sunDir);
    mat.uniforms.uMoonDir.value.copy(atmo.moonDir);
    mat.uniforms.uSunColor.value.copy(atmo.sunLight);
    mat.uniforms.uSkyZenith.value.copy(atmo.skyZenith);
    mat.uniforms.uSkyMid.value.copy(atmo.skyMid);
    mat.uniforms.uSkyHorizon.value.copy(atmo.skyHorizon);
    mat.uniforms.uOceanDeep.value.copy(atmo.oceanDeep);
    mat.uniforms.uOceanShallow.value.copy(atmo.oceanShallow);
    mat.uniforms.uFogColor.value.copy(atmo.fogColor);
    mat.uniforms.uFogDensity.value = atmo.fogDensity;
    mat.uniforms.uNightFactor.value = atmo.nightFactor;
    mat.uniforms.uSunsetFactor.value = atmo.sunsetFactor;
    mat.uniforms.uMoonAlpha.value = atmo.moonAlpha;

    if (beamState) {
      mat.uniforms.uBeamPos.value.copy(beamState.origin);
      mat.uniforms.uBeamDir.value.copy(beamState.direction);
      mat.uniforms.uBeamPower.value = beamState.power;
    }
  }

  return { mesh, update };
}
