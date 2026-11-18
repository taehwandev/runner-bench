import * as THREE from 'three';

export function createOcean({ heightTexture, mapHalfSize }) {
  const geo = new THREE.PlaneGeometry(340, 340, 150, 150);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uHeightTex: { value: heightTexture },
    uMapHalfSize: { value: mapHalfSize },
    uSunDir: { value: new THREE.Vector3(0, 0.5, -1) },
    uMoonDir: { value: new THREE.Vector3(0, 0.3, 1) },
    uSunIntensity: { value: 1.0 },
    uMoonIntensity: { value: 0.0 },
    uOceanDeep: { value: new THREE.Color('#093859') },
    uOceanShallow: { value: new THREE.Color('#1a9a98') },
    uOceanSpec: { value: new THREE.Color('#ffe8b8') },
    uSkyZenith: { value: new THREE.Color('#1d65a8') },
    uSkyMid: { value: new THREE.Color('#5da9de') },
    uSkyHorizon: { value: new THREE.Color('#f4dab0') },
    uFogColor: { value: new THREE.Color('#d9ccb8') },
    uFogDensity: { value: 0.0021 },
    uBeamPos: { value: new THREE.Vector3(-13.5, 24.0, -5.5) },
    uBeamDir: { value: new THREE.Vector3(0, 0, 1) },
    uBeamPower: { value: 0.0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uHeightTex;
      uniform float uMapHalfSize;

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vCrest;

      float sampleTerrain(vec2 xz) {
        vec2 uv = (xz / uMapHalfSize) * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -6.0;
        float hNorm = texture2D(uHeightTex, uv).r;
        return mix(-8.0, 18.0, hNorm);
      }

      // 4-wave directional sum with analytic derivatives
      void evalWaves(vec2 p, float t, float damp, out float height, out vec3 normal) {
        height = 0.0;
        float dx = 0.0;
        float dz = 0.0;

        // Wave 1: primary open-ocean swell
        {
          vec2 d = normalize(vec2(0.82, 0.57));
          float k = 0.14;
          float a = 0.34 * damp;
          float ph = dot(d, p) * k + t * 1.15;
          height += sin(ph) * a;
          float c = cos(ph) * a * k;
          dx += d.x * c;
          dz += d.y * c;
        }
        // Wave 2: cross swell
        {
          vec2 d = normalize(vec2(-0.48, 0.88));
          float k = 0.23;
          float a = 0.21 * damp;
          float ph = dot(d, p) * k + t * 1.48;
          height += sin(ph) * a;
          float c = cos(ph) * a * k;
          dx += d.x * c;
          dz += d.y * c;
        }
        // Wave 3: medium chop
        {
          vec2 d = normalize(vec2(0.32, -0.95));
          float k = 0.44;
          float a = 0.10 * damp;
          float ph = dot(d, p) * k + t * 2.05;
          height += sin(ph) * a;
          float c = cos(ph) * a * k;
          dx += d.x * c;
          dz += d.y * c;
        }
        // Wave 4: fine ripple
        {
          vec2 d = normalize(vec2(-0.91, -0.41));
          float k = 0.78;
          float a = 0.045 * damp;
          float ph = dot(d, p) * k + t * 2.75;
          height += sin(ph) * a;
          float c = cos(ph) * a * k;
          dx += d.x * c;
          dz += d.y * c;
        }

        normal = normalize(vec3(-dx, 1.0, -dz));
      }

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        float th = sampleTerrain(worldPos.xz);
        // Dampen large swells in very shallow water near the beach
        float damp = smoothstep(-0.2, 2.8, -th);
        damp = mix(0.28, 1.0, damp);

        float wy;
        vec3 wn;
        evalWaves(worldPos.xz, uTime, damp, wy, wn);
        // Prevent deep wave troughs in shallow water from exposing underwater seafloor
        wy = max(wy, mix(-0.12, -0.7, damp));

        worldPos.y += wy;
        vWorldPos = worldPos.xyz;
        vNormal = wn;
        vCrest = clamp((wy + 0.15) * 1.3, 0.0, 1.0);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uHeightTex;
      uniform float uMapHalfSize;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      uniform float uSunIntensity;
      uniform float uMoonIntensity;
      uniform vec3 uOceanDeep;
      uniform vec3 uOceanShallow;
      uniform vec3 uOceanSpec;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyMid;
      uniform vec3 uSkyHorizon;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec3 uBeamPos;
      uniform vec3 uBeamDir;
      uniform float uBeamPower;

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vCrest;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float sampleTerrain(vec2 xz) {
        vec2 uv = (xz / uMapHalfSize) * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -6.0;
        float hNorm = texture2D(uHeightTex, uv).r;
        return mix(-8.0, 18.0, hNorm);
      }

      vec3 sampleSky(vec3 dir) {
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 low = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.28, h));
        return mix(low, uSkyZenith, smoothstep(0.22, 0.85, h));
      }

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);

        // Add subtle high-frequency normal ripple in fragment shader for crisp shimmer
        float n1 = noise(vWorldPos.xz * 0.85 + vec2(uTime * 0.45, -uTime * 0.32));
        float n2 = noise(vWorldPos.xz * 1.9 + vec2(-uTime * 0.52, uTime * 0.41));
        vec3 N = normalize(vNormal + vec3((n1 - 0.5) * 0.14, 0.0, (n2 - 0.5) * 0.14));

        float terrainH = sampleTerrain(vWorldPos.xz);
        float waterDepth = vWorldPos.y - terrainH;

        // Water body color: turquoise shallows transitioning to deep ocean
        float shallowMask = 1.0 - smoothstep(0.2, 4.2, waterDepth);
        vec3 baseWater = mix(uOceanDeep, uOceanShallow, shallowMask);

        // Fresnel sky reflection
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        fresnel = clamp(0.06 + fresnel * 0.88, 0.0, 0.95);

        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec3 skyRefl = sampleSky(R);

        vec3 color = mix(baseWater, skyRefl, fresnel);

        // Sun specular glint path (fades out as sun drops below horizon)
        float sunVis = smoothstep(-0.04, 0.12, uSunDir.y) * clamp(uSunIntensity * 0.45, 0.0, 1.2);
        if (sunVis > 0.001) {
          vec3 H = normalize(uSunDir + V);
          float specTight = pow(max(dot(N, H), 0.0), 190.0);
          float specBroad = pow(max(dot(N, H), 0.0), 22.0);
          color += uOceanSpec * (specTight * 2.2 + specBroad * 0.28) * sunVis;
        }

        // Moon specular glint path at night
        if (uMoonIntensity > 0.001 && uMoonDir.y > 0.0) {
          vec3 Hm = normalize(uMoonDir + V);
          float mTight = pow(max(dot(N, Hm), 0.0), 220.0);
          float mBroad = pow(max(dot(N, Hm), 0.0), 28.0);
          color += vec3(0.75, 0.86, 1.0) * (mTight * 1.1 + mBroad * 0.14) * uMoonIntensity;
        }

        // Lighthouse beam sweeping across the water surface
        if (uBeamPower > 0.001) {
          vec2 toFrag = vWorldPos.xz - uBeamPos.xz;
          float forward = dot(toFrag, uBeamDir.xz);
          if (forward > 4.0 && forward < 110.0) {
            float perp = length(toFrag - uBeamDir.xz * forward);
            float coneRadius = 2.0 + forward * 0.16;
            float beamMask = (1.0 - smoothstep(coneRadius * 0.3, coneRadius, perp))
                           * (1.0 - smoothstep(28.0, 105.0, forward));
            float sparkle = 0.65 + 0.55 * n1;
            color += vec3(1.0, 0.86, 0.52) * beamMask * uBeamPower * 0.45 * sparkle;
          }
        }

        // Shoreline surf & animated foam
        float foamNoise = noise(vWorldPos.xz * 1.45 + vec2(uTime * 0.35, uTime * 0.22));
        float shoreWave = sin(waterDepth * 6.5 - uTime * 2.3 + foamNoise * 3.0) * 0.5 + 0.5;
        float shoreEdge = 1.0 - smoothstep(0.0, 0.72, waterDepth);
        float surfBand = (1.0 - smoothstep(0.15, 1.55, waterDepth)) * smoothstep(0.48, 0.88, shoreWave * foamNoise * 1.45);
        float crestFoam = smoothstep(0.74, 0.96, vCrest * (0.6 + 0.55 * foamNoise)) * 0.32;

        float foam = clamp(shoreEdge * (0.72 + 0.28 * foamNoise) + surfBand * 0.75 + crestFoam, 0.0, 1.0);
        // Foam brightness adapts to day/twilight/night lighting
        vec3 foamColor = mix(uSkyHorizon * 0.65 + vec3(0.18), vec3(0.96, 0.97, 0.98), clamp(uSunIntensity * 0.35, 0.12, 1.0));
        color = mix(color, foamColor, foam * 0.85);

        // Exponential squared fog matching scene.fog
        float dist = length(cameraPosition - vWorldPos);
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        color = mix(color, uFogColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = 0;

  function update(t, atmo, lighthouse) {
    uniforms.uTime.value = t;
    uniforms.uSunDir.value.copy(atmo.sunDir);
    uniforms.uMoonDir.value.copy(atmo.moonDir);
    uniforms.uSunIntensity.value = atmo.sunIntensity;
    uniforms.uMoonIntensity.value = atmo.moonIntensity;
    uniforms.uOceanDeep.value.copy(atmo.oceanDeep);
    uniforms.uOceanShallow.value.copy(atmo.oceanShallow);
    uniforms.uOceanSpec.value.copy(atmo.oceanSpec);
    uniforms.uSkyZenith.value.copy(atmo.skyZenith);
    uniforms.uSkyMid.value.copy(atmo.skyMid);
    uniforms.uSkyHorizon.value.copy(atmo.skyHorizon);
    uniforms.uFogColor.value.copy(atmo.fogColor);
    uniforms.uFogDensity.value = atmo.fogDensity;

    uniforms.uBeamPower.value = atmo.lighthousePower;
    uniforms.uBeamPos.value.copy(lighthouse.getBeamWorldPos());
    uniforms.uBeamDir.value.copy(lighthouse.getBeamDir());
  }

  return { mesh, update };
}
