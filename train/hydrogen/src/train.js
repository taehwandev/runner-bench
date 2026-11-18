import * as THREE from 'three';
import { createRng, hash1D, clamp } from './prng.js';
import { TRAIN_SPEC, getTrainState, trackPath, TRACK_Y } from './timeline.js';

function makeVolumetricBeamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0xffeed0) },
      uIntensity: { value: 0.42 },
    },
    vertexShader: `
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
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vec3 V = normalize(vViewPos);
        float edge = pow(abs(dot(normalize(vNormalView), V)), 1.65);
        // Cylinder UV.y goes 1 at apex (narrow) to 0 at far base, or vice versa
        float axial = smoothstep(0.0, 0.78, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        float alpha = edge * axial * uIntensity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

function makeSteamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uPixelRatio: { value: 1.0 },
      uDuskFactor: { value: 0.0 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aSeed;
      varying float vAlpha;
      varying float vSeed;
      uniform float uPixelRatio;
      void main() {
        vAlpha = aAlpha;
        vSeed = aSeed;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (340.0 / max(1.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vSeed;
      uniform float uDuskFactor;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        // Soft turbulent puff edge
        float angle = atan(p.y, p.x);
        float lobe = 0.88 + 0.12 * sin(angle * 3.0 + vSeed * 6.283) * cos(angle * 2.0 - vSeed * 4.0);
        float soft = smoothstep(1.0, 0.08, r2 / lobe);
        vec3 daySteam = vec3(0.78, 0.84, 0.92);
        vec3 nightSteam = vec3(0.45, 0.54, 0.68);
        vec3 col = mix(daySteam, nightSteam, uDuskFactor);
        gl_FragColor = vec4(col, soft * vAlpha);
      }
    `,
  });
}

export function createTrainSystem(scene, textures) {
  const root = new THREE.Group();
  scene.add(root);

  const armorMat = new THREE.MeshStandardMaterial({
    map: textures.armor.map,
    bumpMap: textures.armor.bumpMap,
    bumpScale: 0.04,
    color: 0xd0dceb,
    metalness: 0.42,
    roughness: 0.46,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x2c3645,
    metalness: 0.6,
    roughness: 0.48,
  });

  const plowMat = new THREE.MeshStandardMaterial({
    color: 0x4c5869,
    metalness: 0.48,
    roughness: 0.5,
  });

  const hazardStripeMat = new THREE.MeshStandardMaterial({
    color: 0xa65f24,
    metalness: 0.3,
    roughness: 0.6,
  });

  const snowRimMat = new THREE.MeshStandardMaterial({
    color: 0xd4e2f2,
    roughness: 0.85,
    metalness: 0.05,
  });

  const warmWindowMat = new THREE.MeshStandardMaterial({
    color: 0xffd79c,
    emissive: 0xffa43c,
    emissiveIntensity: 2.4,
    roughness: 0.25,
  });

  const coolWindowMat = new THREE.MeshStandardMaterial({
    color: 0xbfeaff,
    emissive: 0x5cc4ff,
    emissiveIntensity: 1.9,
    roughness: 0.25,
  });

  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff6b2b,
    emissive: 0xff4500,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });

  const redMarkerMat = new THREE.MeshStandardMaterial({
    color: 0xff3b3b,
    emissive: 0xff1c1c,
    emissiveIntensity: 3.4,
    roughness: 0.2,
  });

  const headlightBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff1d0,
    emissiveIntensity: 4.5,
    roughness: 0.1,
  });

  const allWheels = [];

  function buildBogie(axleCount = 2) {
    const g = new THREE.Group();
    const frameLen = axleCount === 3 ? 3.5 : 2.3;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.42, frameLen), darkSteelMat);
    frame.position.y = 0.66;
    g.add(frame);

    const wheelGeo = new THREE.CylinderGeometry(
      TRAIN_SPEC.wheelRadius,
      TRAIN_SPEC.wheelRadius,
      0.16,
      18
    );
    wheelGeo.rotateZ(Math.PI / 2);

    const flangeGeo = new THREE.CylinderGeometry(
      TRAIN_SPEC.wheelRadius + 0.06,
      TRAIN_SPEC.wheelRadius + 0.06,
      0.04,
      18
    );
    flangeGeo.rotateZ(Math.PI / 2);

    const zOffsets = axleCount === 3 ? [-1.25, 0, 1.25] : [-0.75, 0.75];
    for (const zOff of zOffsets) {
      for (const side of [-1.05, 1.05]) {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(side, TRAIN_SPEC.wheelRadius, zOff);
        const wheel = new THREE.Mesh(wheelGeo, darkSteelMat);
        const flange = new THREE.Mesh(flangeGeo, armorMat);
        flange.position.x = side > 0 ? -0.07 : 0.07;
        wheelGroup.add(wheel, flange);
        g.add(wheelGroup);
        allWheels.push(wheelGroup);
      }
      // Axle bar
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.1, 8), darkSteelMat);
      axle.rotation.z = Math.PI / 2;
      axle.position.set(0, TRAIN_SPEC.wheelRadius, zOff);
      g.add(axle);
    }
    return g;
  }

  // --- 1. LOCOMOTIVE (16.0m long, local Z in [-8.0, +8.0], -Z is forward) ---
  const locoGroup = new THREE.Group();
  root.add(locoGroup);

  // Underframe chassis
  const locoFrame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.62, 15.2), darkSteelMat);
  locoFrame.position.set(0, 1.25, 0.2);
  locoFrame.castShadow = true;
  locoGroup.add(locoFrame);

  // Heavy bogies (front & rear)
  const locoBogieF = buildBogie(3);
  locoBogieF.position.set(0, 0, -4.3);
  const locoBogieR = buildBogie(3);
  locoBogieR.position.set(0, 0, 4.7);
  locoGroup.add(locoBogieF, locoBogieR);

  // Main armored hull
  const locoHull = new THREE.Mesh(new THREE.BoxGeometry(3.32, 2.55, 11.4), armorMat);
  locoHull.position.set(0, 2.8, 1.6);
  locoHull.castShadow = true;
  locoHull.receiveShadow = true;
  locoGroup.add(locoHull);

  // Beveled armored upper roof cowling
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.55, 11.2), darkSteelMat);
  roofCap.position.set(0, 4.25, 1.6);
  locoGroup.add(roofCap);

  // Snow accumulation strips on locomotive roof
  const locoSnow = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.12, 10.6), snowRimMat);
  locoSnow.position.set(0, 4.55, 1.65);
  locoGroup.add(locoSnow);

  // Sloped armored nose / cab
  const noseBody = new THREE.Mesh(new THREE.BoxGeometry(3.18, 2.15, 4.1), armorMat);
  noseBody.position.set(0, 2.52, -5.2);
  noseBody.rotation.x = 0.22;
  noseBody.castShadow = true;
  locoGroup.add(noseBody);

  // Cab visor overhang
  const visor = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.45, 2.2), darkSteelMat);
  visor.position.set(0, 3.78, -4.45);
  visor.rotation.x = 0.08;
  locoGroup.add(visor);

  // Glowing armored bridge windshield slit
  const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.34, 0.32), warmWindowMat);
  cabGlass.position.set(0, 3.38, -7.08);
  cabGlass.rotation.x = 0.22;
  locoGroup.add(cabGlass);

  // Front armored radiator grille & amber marker strip
  const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.25), darkSteelMat);
  frontGrille.position.set(0, 2.25, -7.2);
  locoGroup.add(frontGrille);

  // Snowplow wedge at the very front (-Z = -8.0)
  const plowLeft = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.45, 0.35), plowMat);
  plowLeft.position.set(-0.78, 0.92, -7.35);
  plowLeft.rotation.y = 0.52;
  plowLeft.rotation.x = 0.25;
  const plowRight = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.45, 0.35), plowMat);
  plowRight.position.set(0.78, 0.92, -7.35);
  plowRight.rotation.y = -0.52;
  plowRight.rotation.x = 0.25;
  const plowBar = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.24, 0.35), hazardStripeMat);
  plowBar.position.set(0, 1.56, -7.12);
  locoGroup.add(plowLeft, plowRight, plowBar);

  // Side armored skirts & intake vents
  for (const side of [-1.68, 1.68]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 12.8), darkSteelMat);
    skirt.position.set(side, 1.45, 0.8);
    locoGroup.add(skirt);

    // Side glowing engine vents
    for (let v = 0; v < 4; v++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 1.15), emberMat);
      vent.position.set(side * 1.01, 2.75, -1.2 + v * 2.1);
      locoGroup.add(vent);
    }

    // Cab side windows
    const sideCabWin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 1.25), warmWindowMat);
    sideCabWin.position.set(side * 1.0, 3.25, -4.1);
    locoGroup.add(sideCabWin);
  }

  // Twin armored exhaust stacks on locomotive roof
  for (const stackZ of [-1.3, 2.2]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.85, 12), darkSteelMat);
    stack.position.set(0, 4.72, stackZ);
    locoGroup.add(stack);
  }

  // Headlight bulbs + volumetric beam + SpotLight
  const upperLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.32, 16), headlightBulbMat);
  upperLamp.rotation.x = Math.PI / 2;
  upperLamp.position.set(0, 3.92, -5.82);
  locoGroup.add(upperLamp);

  for (const lx of [-0.96, 0.96]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 14), headlightBulbMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(lx, 2.18, -7.28);
    locoGroup.add(lamp);
  }

  // Volumetric beam cone pointing along -Z
  const beamGeo = new THREE.CylinderGeometry(0.38, 7.2, 68, 24, 1, true);
  beamGeo.translate(0, -34, 0);
  beamGeo.rotateX(Math.PI / 2); // narrow apex at origin, flares forward toward -Z
  const beamMat = makeVolumetricBeamMaterial();
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.set(0, 2.45, -7.3);
  beamMesh.rotation.x = -0.045; // slight downward tilt onto rails
  locoGroup.add(beamMesh);

  // Real SpotLight illuminating track, sleepers, and tunnel walls
  const headSpot = new THREE.SpotLight(0xffe8c2, 180, 155, 0.36, 0.58, 1.3);
  headSpot.position.set(0, 2.65, -6.8);
  const headTarget = new THREE.Object3D();
  headTarget.position.set(0, 0.2, -52.0);
  locoGroup.add(headSpot, headTarget);
  headSpot.target = headTarget;

  // --- 2. NINE ARMORED CARS (each 10.2 m long, pitch 11.1 m) ---
  const cars = [];
  const carBaseGeo = new THREE.BoxGeometry(3.22, 2.45, TRAIN_SPEC.carLength);
  const carRoofGeo = new THREE.BoxGeometry(2.72, 0.42, TRAIN_SPEC.carLength - 0.3);
  const carSnowGeo = new THREE.BoxGeometry(2.2, 0.11, TRAIN_SPEC.carLength - 0.8);
  const carFrameGeo = new THREE.BoxGeometry(2.96, 0.54, TRAIN_SPEC.carLength - 0.3);
  const bellowsGeo = new THREE.BoxGeometry(2.25, 2.35, TRAIN_SPEC.gap + 0.18);
  const windowGeo = new THREE.BoxGeometry(0.08, 0.42, 0.78);

  const rng = createRng(99013);

  for (let i = 0; i < TRAIN_SPEC.carCount; i++) {
    const carGroup = new THREE.Group();
    root.add(carGroup);

    const frame = new THREE.Mesh(carFrameGeo, darkSteelMat);
    frame.position.y = 1.22;
    frame.castShadow = true;
    carGroup.add(frame);

    const bogieF = buildBogie(2);
    bogieF.position.set(0, 0, -3.2);
    const bogieR = buildBogie(2);
    bogieR.position.set(0, 0, 3.2);
    carGroup.add(bogieF, bogieR);

    const body = new THREE.Mesh(carBaseGeo, armorMat);
    body.position.y = 2.68;
    body.castShadow = true;
    body.receiveShadow = true;
    carGroup.add(body);

    const roof = new THREE.Mesh(carRoofGeo, darkSteelMat);
    roof.position.y = 4.08;
    carGroup.add(roof);

    const roofSnow = new THREE.Mesh(carSnowGeo, snowRimMat);
    roofSnow.position.y = 4.32;
    carGroup.add(roofSnow);

    // Accordion gangway bellows connecting forward to previous unit
    const bellows = new THREE.Mesh(bellowsGeo, darkSteelMat);
    bellows.position.set(0, 2.55, -(TRAIN_SPEC.carLength * 0.5 + TRAIN_SPEC.gap * 0.5));
    carGroup.add(bellows);

    // Side structural ribs & lit windows
    for (const side of [-1.62, 1.62]) {
      const skirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.72, TRAIN_SPEC.carLength - 0.6),
        darkSteelMat
      );
      skirt.position.set(side, 1.4, 0);
      carGroup.add(skirt);

      if (i === 0) {
        // Generator / Reactor car: vertical glowing louvers
        for (let k = -3; k <= 3; k++) {
          const louver = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 1.25, 0.42),
            k % 2 === 0 ? coolWindowMat : emberMat
          );
          louver.position.set(side, 2.7, k * 1.18);
          carGroup.add(louver);
        }
      } else {
        // Lit armored slit windows (mostly warm, occasional cyan ops bay)
        for (let k = -3; k <= 3; k++) {
          if (rng() < 0.14) continue; // realistic darkened cabin here and there
          const isCool = i === 4 || rng() < 0.16;
          const win = new THREE.Mesh(windowGeo, isCool ? coolWindowMat : warmWindowMat);
          win.position.set(side, 2.86, k * 1.22);
          carGroup.add(win);
        }
      }
    }

    // Command/Radar car (#4) roof cupola & dish
    if (i === 4) {
      const cupola = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 3.2), darkSteelMat);
      cupola.position.set(0, 4.55, 0);
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.15, 0.35, 14), armorMat);
      dish.position.set(0, 5.1, -0.5);
      dish.rotation.x = 0.55;
      carGroup.add(cupola, dish);
    }

    // Last car (#8): Twin red tail lamps + trailing red PointLight
    if (i === TRAIN_SPEC.carCount - 1) {
      for (const tx of [-1.05, 1.05]) {
        const tailLamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), redMarkerMat);
        tailLamp.position.set(tx, 2.55, TRAIN_SPEC.carLength * 0.5 + 0.05);
        carGroup.add(tailLamp);
      }
      const tailRearWin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.14), warmWindowMat);
      tailRearWin.position.set(0, 3.1, TRAIN_SPEC.carLength * 0.5 + 0.02);
      carGroup.add(tailRearWin);

      const tailLight = new THREE.PointLight(0xff2a2a, 14, 24, 1.8);
      tailLight.position.set(0, 2.5, TRAIN_SPEC.carLength * 0.5 + 1.2);
      carGroup.add(tailLight);
    }

    cars.push({ group: carGroup, index: i });
  }

  // --- 3. DETERMINISTIC GPU STEAM / EXHAUST PLUME ---
  const STEAM_COUNT = 260;
  const steamPositions = new Float32Array(STEAM_COUNT * 3);
  const steamSizes = new Float32Array(STEAM_COUNT);
  const steamAlphas = new Float32Array(STEAM_COUNT);
  const steamSeeds = new Float32Array(STEAM_COUNT);
  const steamPhases = new Float32Array(STEAM_COUNT);
  const steamLives = new Float32Array(STEAM_COUNT);
  const steamStackSelect = new Float32Array(STEAM_COUNT);

  for (let i = 0; i < STEAM_COUNT; i++) {
    steamSeeds[i] = hash1D(i * 31 + 7);
    steamPhases[i] = hash1D(i * 53 + 19);
    steamLives[i] = 2.6 + hash1D(i * 97 + 3) * 1.4;
    steamStackSelect[i] = i % 2 === 0 ? 6.7 : 10.2; // distance behind loco nose for each stack
  }

  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3));
  steamGeo.setAttribute('aSize', new THREE.BufferAttribute(steamSizes, 1));
  steamGeo.setAttribute('aAlpha', new THREE.BufferAttribute(steamAlphas, 1));
  steamGeo.setAttribute('aSeed', new THREE.BufferAttribute(steamSeeds, 1));
  const steamMat = makeSteamMaterial();
  const steamPoints = new THREE.Points(steamGeo, steamMat);
  steamPoints.frustumCulled = false;
  scene.add(steamPoints);

  // Scratch vectors to avoid per-frame allocations
  const vFront = new THREE.Vector3();
  const vRear = new THREE.Vector3();
  const vCenter = new THREE.Vector3();
  const vDir = new THREE.Vector3();
  const vEmitPos = new THREE.Vector3();
  const vEmitFwd = new THREE.Vector3();
  const vEmitRight = new THREE.Vector3();
  const mRot = new THREE.Matrix4();
  const vUp = new THREE.Vector3(0, 1, 0);
  const vRight = new THREE.Vector3();
  const vZAxis = new THREE.Vector3();

  function placeUnitOnTrack(group, sFront, sRear) {
    trackPath.sample(sFront, vFront);
    trackPath.sample(sRear, vRear);
    vCenter.addVectors(vFront, vRear).multiplyScalar(0.5);
    vDir.subVectors(vFront, vRear).normalize(); // unit vector pointing forward (-Z in local space)

    // Local -Z = vDir => Local +Z = -vDir
    vZAxis.copy(vDir).negate();
    vRight.crossVectors(vUp, vZAxis).normalize();
    mRot.makeBasis(vRight, vUp, vZAxis);

    group.position.copy(vCenter);
    group.quaternion.setFromRotationMatrix(mRot);
  }

  function update(timeSec, state, pixelRatio) {
    const sHead = state.distance;

    // Place locomotive: nose is at sHead, center at sHead - 8.0, bogies at sHead - 3.7 and sHead - 12.7
    placeUnitOnTrack(locoGroup, sHead - 2.2, sHead - 13.8);

    // Place 9 cars cleanly coupled behind locomotive
    for (let i = 0; i < cars.length; i++) {
      const carFront = sHead - TRAIN_SPEC.locoLength - TRAIN_SPEC.gap - i * TRAIN_SPEC.carPitch;
      const carRear = carFront - TRAIN_SPEC.carLength;
      placeUnitOnTrack(cars[i].group, carFront - 1.6, carRear + 1.6);
    }

    // Deterministic wheel rotation from track distance
    const wheelAngle = -sHead / TRAIN_SPEC.wheelRadius;
    for (let i = 0; i < allWheels.length; i++) {
      allWheels[i].rotation.x = wheelAngle;
    }

    // Headlight beam intensity boost slightly inside tunnel & dusk-to-night
    const nightBoost = 1.0 + 0.35 * clamp((timeSec - 35) / 25, 0, 1);
    beamMat.uniforms.uIntensity.value = (state.inTunnel ? 0.52 : 0.38) * nightBoost;

    // Deterministic GPU steam plume
    steamMat.uniforms.uPixelRatio.value = pixelRatio;
    steamMat.uniforms.uDuskFactor.value = clamp(timeSec / 60.0, 0, 1);

    for (let i = 0; i < STEAM_COUNT; i++) {
      const life = steamLives[i];
      const seed = steamSeeds[i];
      const rawAge = (timeSec + steamPhases[i] * life) % life;
      const age = rawAge < 0 ? rawAge + life : rawAge;
      const u = age / life;
      const tEmit = Math.max(0, timeSec - age);

      const emitState = getTrainState(tEmit);
      const emitS = emitState.distance - steamStackSelect[i];
      trackPath.sample(emitS, vEmitPos, vEmitFwd, vEmitRight);

      // Buoyant rise: higher column when stopped, sheared backward when moving fast
      const riseRate = emitState.speed < 2.0 ? 4.4 : 2.8;
      const rise = riseRate * Math.pow(age, 0.85) * (0.85 + 0.3 * seed);
      // Momentum carry fades quickly into ambient arctic crosswind (-X away from bridge camera)
      const carry = emitState.speed * 0.32 * (1.0 - Math.exp(-age * 2.4));
      const windX = (-2.2 - 0.8 * Math.sin(seed * 21.0)) * age;
      const turbX = Math.sin(age * 4.5 + seed * 30.0) * 0.65 * u;
      const turbZ = Math.cos(age * 3.8 + seed * 17.0) * 0.55 * u;

      const px = vEmitPos.x + vEmitFwd.x * carry + windX + turbX;
      const py = TRACK_Y + 5.15 + rise;
      const pz = vEmitPos.z + vEmitFwd.z * carry + turbZ;

      steamPositions[i * 3] = px;
      steamPositions[i * 3 + 1] = py;
      steamPositions[i * 3 + 2] = pz;

      steamSizes[i] = 2.2 + u * (6.2 + seed * 2.8);
      // Fade in fast from stack, fade out smoothly
      const fadeIn = clamp(u / 0.08, 0, 1);
      const fadeOut = 1.0 - clamp((u - 0.15) / 0.85, 0, 1);
      // Keep steam out of ceiling clipping if emitted inside tunnel
      const tunnelDamp = emitState.inTunnel ? 0.45 : 1.0;
      steamAlphas[i] = fadeIn * fadeOut * fadeOut * 0.22 * tunnelDamp;
    }

    steamGeo.attributes.position.needsUpdate = true;
    steamGeo.attributes.aSize.needsUpdate = true;
    steamGeo.attributes.aAlpha.needsUpdate = true;
  }

  return {
    root,
    locoGroup,
    cars,
    update,
  };
}
