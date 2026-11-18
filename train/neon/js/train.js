import * as THREE from 'three';
import { createPRNG, hash2D, clamp, lerp } from './prng.js';
import {
  CAR_COUNT,
  LOCO_LENGTH,
  CAR_LENGTH,
  CAR_PITCH,
  DECK_Y,
  TUNNEL_START_S,
  TUNNEL_END_S,
  getTrackPoint,
  getTrainState
} from './timetable.js';

/**
 * Builds the armored locomotive, 9 armored cars, articulated couplers,
 * glowing windows, volumetric headlight beam + track light pool,
 * and a 100% deterministic GPU-rendered steam/exhaust system.
 */
export function createTrain({ armorMap, glowMap, steamMap }) {
  const root = new THREE.Group();
  root.name = 'ArmoredTrain';

  // Shared materials (kept lean for minimal state switches on mobile GPUs)
  const hullMat = new THREE.MeshStandardMaterial({
    map: armorMap,
    color: 0xaab9ca,
    metalness: 0.62,
    roughness: 0.42
  });

  const darkArmorMat = new THREE.MeshStandardMaterial({
    map: armorMap,
    color: 0x4c5868,
    metalness: 0.72,
    roughness: 0.36
  });

  const roofSnowMat = new THREE.MeshStandardMaterial({
    color: 0xd9e6f4,
    roughness: 0.85,
    metalness: 0.05
  });

  const bogieMat = new THREE.MeshStandardMaterial({
    color: 0x202731,
    metalness: 0.78,
    roughness: 0.45
  });

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x627080,
    metalness: 0.88,
    roughness: 0.25
  });

  const windowAmberMat = new THREE.MeshBasicMaterial({
    color: 0xffc676
  });

  const windowWarmDimMat = new THREE.MeshBasicMaterial({
    color: 0xe39448
  });

  const cabGlassMat = new THREE.MeshBasicMaterial({
    color: 0xffd596
  });

  const furnaceMat = new THREE.MeshBasicMaterial({
    color: 0xff7b2f
  });

  const headlightLensMat = new THREE.MeshBasicMaterial({
    color: 0xfff8e8
  });

  const tailLightMat = new THREE.MeshBasicMaterial({
    color: 0xff2b2b
  });

  const bellowMat = new THREE.MeshStandardMaterial({
    color: 0x191f28,
    roughness: 0.9,
    metalness: 0.15
  });

  const wheelMeshes = [];

  function createBogie(zOffset, axles = 2) {
    const bogie = new THREE.Group();
    bogie.position.set(0, 0.52, zOffset);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.48, axles === 3 ? 3.8 : 2.6),
      bogieMat
    );
    frame.position.y = 0.22;
    bogie.add(frame);

    const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 2.35, 12);
    wheelGeo.rotateZ(Math.PI / 2);

    const spacing = 1.3;
    const startZ = -((axles - 1) * spacing) * 0.5;
    for (let i = 0; i < axles; i++) {
      const axle = new THREE.Mesh(wheelGeo, wheelMat);
      axle.position.set(0, 0, startZ + i * spacing);
      bogie.add(axle);
      wheelMeshes.push(axle);
    }
    return bogie;
  }

  // -------------------------------------------------------------------------
  // 1. HEAVY ARMORED LOCOMOTIVE (local +Z = forward toward prow)
  // -------------------------------------------------------------------------
  const locoGroup = new THREE.Group();
  locoGroup.name = 'Locomotive';
  root.add(locoGroup);

  // Underframe chassis
  const locoChassis = new THREE.Mesh(
    new THREE.BoxGeometry(3.35, 0.72, LOCO_LENGTH - 1.2),
    darkArmorMat
  );
  locoChassis.position.set(0, 1.15, -0.4);
  locoGroup.add(locoChassis);

  // Main faceted armored body
  const locoBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.48, 2.65, LOCO_LENGTH - 3.6),
    hullMat
  );
  locoBody.position.set(0, 2.65, -1.6);
  locoGroup.add(locoBody);

  // Beveled upper armored cowling
  const locoUpper = new THREE.Mesh(
    new THREE.BoxGeometry(2.85, 0.68, LOCO_LENGTH - 4.2),
    darkArmorMat
  );
  locoUpper.position.set(0, 4.18, -1.7);
  locoGroup.add(locoUpper);

  // Snow cap along locomotive spine
  const locoSnow = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 0.16, LOCO_LENGTH - 5.2),
    roofSnowMat
  );
  locoSnow.position.set(0, 4.55, -2.0);
  locoGroup.add(locoSnow);

  // Sloped angular armored prow nose (sculpted hood + radiator grille + beveled brow)
  const noseHood = new THREE.Mesh(
    new THREE.BoxGeometry(3.26, 1.85, 3.3),
    darkArmorMat
  );
  noseHood.position.set(0, 2.05, LOCO_LENGTH * 0.5 - 2.35);
  locoGroup.add(noseHood);

  const noseSlant = new THREE.Mesh(
    new THREE.BoxGeometry(3.16, 0.72, 3.0),
    hullMat
  );
  noseSlant.position.set(0, 3.02, LOCO_LENGTH * 0.5 - 2.55);
  noseSlant.rotation.x = 0.24;
  locoGroup.add(noseSlant);

  // Dark recessed front armored radiator grille with horizontal steel slats
  const grilleBack = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 1.15, 0.25),
    bogieMat
  );
  grilleBack.position.set(0, 2.08, LOCO_LENGTH * 0.5 - 0.72);
  locoGroup.add(grilleBack);

  for (let g = 0; g < 4; g++) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.1, 0.34),
      hullMat
    );
    slat.position.set(0, 1.68 + g * 0.26, LOCO_LENGTH * 0.5 - 0.68);
    locoGroup.add(slat);
  }

  // Heavy V-wedge icebreaker snowplow (twin angled steel blades meeting at sharp prow)
  const plowBase = new THREE.Mesh(
    new THREE.BoxGeometry(3.38, 0.85, 1.1),
    darkArmorMat
  );
  plowBase.position.set(0, 0.96, LOCO_LENGTH * 0.5 - 0.75);
  locoGroup.add(plowBase);

  for (const side of [-1, 1]) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 1.05, 0.28),
      darkArmorMat
    );
    blade.position.set(side * 0.84, 0.92, LOCO_LENGTH * 0.5 - 0.08);
    blade.rotation.y = -side * 0.44;
    blade.rotation.x = 0.18;
    locoGroup.add(blade);

    const bladeFrost = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 0.16, 0.32),
      roofSnowMat
    );
    bladeFrost.position.set(side * 0.84, 0.44, LOCO_LENGTH * 0.5 + 0.02);
    bladeFrost.rotation.y = -side * 0.44;
    locoGroup.add(bladeFrost);
  }

  // Armored command cab windshield (deeply recessed glowing amber visor + center steel pillar)
  const cabFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.16, 1.18, 2.0),
    darkArmorMat
  );
  cabFrame.position.set(0, 3.62, LOCO_LENGTH * 0.5 - 4.1);
  locoGroup.add(cabFrame);

  const cabVisorBrow = new THREE.Mesh(
    new THREE.BoxGeometry(3.26, 0.24, 0.85),
    darkArmorMat
  );
  cabVisorBrow.position.set(0, 4.12, LOCO_LENGTH * 0.5 - 3.05);
  locoGroup.add(cabVisorBrow);

  const cabWindshield = new THREE.Mesh(
    new THREE.BoxGeometry(2.68, 0.54, 0.18),
    cabGlassMat
  );
  cabWindshield.position.set(0, 3.68, LOCO_LENGTH * 0.5 - 3.08);
  cabWindshield.rotation.x = -0.22;
  locoGroup.add(cabWindshield);

  const cabCenterPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.66, 0.26),
    darkArmorMat
  );
  cabCenterPost.position.set(0, 3.68, LOCO_LENGTH * 0.5 - 3.04);
  locoGroup.add(cabCenterPost);

  // Side cab windows
  for (const side of [-1, 1]) {
    const sideCabWin = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.52, 1.45),
      cabGlassMat
    );
    sideCabWin.position.set(side * 1.54, 3.62, LOCO_LENGTH * 0.5 - 4.25);
    locoGroup.add(sideCabWin);

    // Armored side armor rib plates
    for (let r = 0; r < 5; r++) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 2.55, 0.42),
        darkArmorMat
      );
      rib.position.set(side * 1.78, 2.65, -6.8 + r * 2.45);
      locoGroup.add(rib);
    }

    // Glowing furnace / reactor louver slits along the locomotive flanks
    for (let v = 0; v < 4; v++) {
      const slit = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.16, 1.55),
        furnaceMat
      );
      slit.position.set(side * 1.76, 2.35 + (v % 2) * 0.36, -5.6 + v * 2.45);
      locoGroup.add(slit);
    }
  }

  // Twin heavy roof exhaust stacks
  const stackGeo = new THREE.CylinderGeometry(0.36, 0.46, 1.15, 8);
  const stackPosZ = [-2.0, -4.6];
  for (const sz of stackPosZ) {
    const stack = new THREE.Mesh(stackGeo, darkArmorMat);
    stack.position.set(0, 4.78, sz);
    locoGroup.add(stack);

    // Glowing hot rim inside stack mouth
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.08, 8),
      furnaceMat
    );
    rim.position.set(0, 5.34, sz);
    locoGroup.add(rim);
  }

  // Dual front headlights + upper brow searchlight
  const headlightCoords = [
    [-1.24, 2.08, LOCO_LENGTH * 0.5 - 0.68],
    [ 1.24, 2.08, LOCO_LENGTH * 0.5 - 0.68],
    [ 0.0,  4.34, LOCO_LENGTH * 0.5 - 3.02]
  ];

  const headlightSprites = [];
  for (let i = 0; i < headlightCoords.length; i++) {
    const [hx, hy, hz] = headlightCoords[i];
    const radius = i === 2 ? 0.30 : 0.25;
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.25, radius * 1.35, 0.42, 10).rotateX(Math.PI / 2),
      darkArmorMat
    );
    housing.position.set(hx, hy, hz - 0.14);
    locoGroup.add(housing);

    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 12),
      headlightLensMat
    );
    lens.position.set(hx, hy, hz + 0.08);
    locoGroup.add(lens);

    const flareMat = new THREE.SpriteMaterial({
      map: glowMap,
      color: i === 2 ? 0xfff4dd : 0xffe0b2,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const flare = new THREE.Sprite(flareMat);
    flare.position.set(hx, hy, hz + 0.32);
    flare.scale.set(i === 2 ? 4.4 : 3.6, i === 2 ? 4.4 : 3.6, 1);
    locoGroup.add(flare);
    headlightSprites.push(flare);
  }

  // Volumetric soft-edge headlight beam cone (custom GLSL ShaderMaterial)
  const beamLength = 64.0;
  const beamGeo = new THREE.ConeGeometry(8.5, beamLength, 24, 1, true);
  // Translate so apex is at z=0 and base flares toward +Z
  beamGeo.translate(0, -beamLength * 0.5, 0);
  beamGeo.rotateX(-Math.PI / 2);

  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xfff0d4) },
      uIntensity: { value: 0.28 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        // vUv.y = 1 at apex (loco), 0 at far end of beam
        float along = smoothstep(0.0, 0.82, vUv.y) * smoothstep(1.0, 0.90, vUv.y);
        float edge = pow(abs(dot(vNormalV, vViewDir)), 1.65);
        float alpha = along * edge * uIntensity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });

  const mainBeam = new THREE.Mesh(beamGeo, beamMat);
  mainBeam.position.set(0, 2.3, LOCO_LENGTH * 0.5 - 0.8);
  mainBeam.rotation.x = 0.055; // angled gently down onto the snow-dusted rails
  locoGroup.add(mainBeam);

  // Projected light pool on the snowy track directly ahead of the locomotive
  const poolGeo = new THREE.PlaneGeometry(7.2, 54.0);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xffebd0) },
      uIntensity: { value: 0.48 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        float dx = (vUv.x - 0.5) * 2.0;
        float lateral = exp(-dx * dx * 3.8);
        // vUv.y = 1 near prow, 0 far ahead
        float longitudinal = smoothstep(0.0, 0.65, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
        float alpha = lateral * longitudinal * uIntensity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
  const trackLightPool = new THREE.Mesh(poolGeo, poolMat);
  trackLightPool.position.set(0, 0.24, LOCO_LENGTH * 0.5 + 25.0);
  locoGroup.add(trackLightPool);

  // Real dynamic lights carried by the locomotive (calibrated so steel armor never blows out)
  const aheadLight = new THREE.PointLight(0xffebd0, 145, 72, 1.45);
  aheadLight.position.set(0, 3.0, LOCO_LENGTH * 0.5 + 16.0);
  locoGroup.add(aheadLight);

  const prowBounceLight = new THREE.PointLight(0xffc98a, 34, 28, 1.5);
  prowBounceLight.position.set(0, 2.7, LOCO_LENGTH * 0.5 + 2.8);
  locoGroup.add(prowBounceLight);

  // Locomotive articulated 3-axle bogies
  locoGroup.add(createBogie(4.2, 3));
  locoGroup.add(createBogie(-4.8, 3));

  // -------------------------------------------------------------------------
  // 2. NINE ARMORED CARS (Generator Tender + 7 Sleeper/Passenger + Tail Guard)
  // -------------------------------------------------------------------------
  const rand = createPRNG(0xA41099);
  const carGroups = [];
  const couplerGroups = [];

  // Shared car geometries for crisp performance
  const carChassisGeo = new THREE.BoxGeometry(3.18, 0.62, CAR_LENGTH - 0.4);
  const carBodyGeo = new THREE.BoxGeometry(3.32, 2.55, CAR_LENGTH);
  const carRoofGeo = new THREE.BoxGeometry(2.74, 0.46, CAR_LENGTH - 0.35);
  const carSnowGeo = new THREE.BoxGeometry(2.42, 0.14, CAR_LENGTH - 0.8);
  const winPaneGeo = new THREE.BoxGeometry(0.1, 0.72, 1.24);
  const winHoodGeo = new THREE.BoxGeometry(0.22, 0.12, 1.38);
  const ribGeo = new THREE.BoxGeometry(0.14, 2.58, 0.26);
  const bellowGeo = new THREE.BoxGeometry(2.2, 2.35, 1.1);

  for (let c = 0; c < CAR_COUNT; c++) {
    const car = new THREE.Group();
    car.name = `ArmoredCar_${c + 1}`;
    root.add(car);
    carGroups.push(car);

    const isTender = c === 0;
    const isTail = c === CAR_COUNT - 1;

    const chassis = new THREE.Mesh(carChassisGeo, darkArmorMat);
    chassis.position.y = 1.05;
    car.add(chassis);

    const body = new THREE.Mesh(carBodyGeo, hullMat);
    body.position.y = 2.58;
    car.add(body);

    const roof = new THREE.Mesh(carRoofGeo, darkArmorMat);
    roof.position.y = 4.02;
    car.add(roof);

    const roofSnow = new THREE.Mesh(carSnowGeo, roofSnowMat);
    roofSnow.position.y = 4.30;
    car.add(roofSnow);

    // Armored vertical structural ribs + recessed lit passenger windows
    const winCount = isTender ? 3 : 6;
    const winSpan = CAR_LENGTH - 2.1;
    for (const side of [-1, 1]) {
      for (let w = 0; w < winCount; w++) {
        const wz = -winSpan * 0.5 + (w + 0.5) * (winSpan / winCount);
        const lit = rand() > 0.12; // almost all warmly lit, occasional dim cabin for realism
        const winMesh = new THREE.Mesh(
          winPaneGeo,
          lit ? (rand() > 0.22 ? windowAmberMat : windowWarmDimMat) : darkArmorMat
        );
        winMesh.position.set(side * 1.66, 2.86, wz);
        car.add(winMesh);

        // Armored brow hood over each window
        const hood = new THREE.Mesh(winHoodGeo, darkArmorMat);
        hood.position.set(side * 1.72, 3.28, wz);
        car.add(hood);
      }

      // Vertical armor mullions
      for (let r = 0; r <= 4; r++) {
        const rz = -CAR_LENGTH * 0.44 + r * (CAR_LENGTH * 0.22);
        const rib = new THREE.Mesh(ribGeo, darkArmorMat);
        rib.position.set(side * 1.69, 2.58, rz);
        car.add(rib);
      }
    }

    // Tender roof cooling vents & orange reactor glow
    if (isTender) {
      for (let v = -1; v <= 1; v++) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.36, 2.2), darkArmorMat);
        vent.position.set(0, 4.38, v * 3.1);
        car.add(vent);
        const ventGlow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.6), furnaceMat);
        ventGlow.position.set(0, 4.58, v * 3.1);
        car.add(ventGlow);
      }
    } else {
      // Roof HVAC / armored hatch pods
      for (const hz of [-2.8, 2.8]) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 2.1), darkArmorMat);
        pod.position.set(0, 4.34, hz);
        car.add(pod);
      }
    }

    // Tail guard car: sloped rear fairing + glowing red tail marker lights
    if (isTail) {
      for (const side of [-1, 1]) {
        const tailLamp = new THREE.Mesh(
          new THREE.CircleGeometry(0.22, 10).rotateY(Math.PI),
          tailLightMat
        );
        tailLamp.position.set(side * 1.05, 2.75, -CAR_LENGTH * 0.5 - 0.04);
        car.add(tailLamp);

        const tailGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowMap,
            color: 0xff2828,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        tailGlow.position.set(side * 1.05, 2.75, -CAR_LENGTH * 0.5 - 0.25);
        tailGlow.scale.set(3.2, 3.2, 1);
        car.add(tailGlow);
      }
    }

    car.add(createBogie(3.6, 2));
    car.add(createBogie(-3.6, 2));

    // Articulated flexible bellows coupler connecting to previous unit
    const coupler = new THREE.Mesh(bellowGeo, bellowMat);
    root.add(coupler);
    couplerGroups.push(coupler);
  }

  // Subtle warm flank fill light riding mid-train to cast cabin spill onto station & tunnel walls
  const flankGlowLight = new THREE.PointLight(0xffb463, 42, 28, 1.5);
  root.add(flankGlowLight);

  // -------------------------------------------------------------------------
  // 3. DETERMINISTIC VOLUMETRIC STEAM & BRAKE-VENT EXHAUST SYSTEM
  // Single GPU Points draw call; every puff computed analytically from spawnTime!
  // -------------------------------------------------------------------------
  const STACK_PUFFS = 84;
  const BRAKE_PUFFS = 42;
  const TOTAL_PUFFS = STACK_PUFFS + BRAKE_PUFFS;

  const steamPositions = new Float32Array(TOTAL_PUFFS * 3);
  const steamSizes = new Float32Array(TOTAL_PUFFS);
  const steamAlphas = new Float32Array(TOTAL_PUFFS);
  const steamRots = new Float32Array(TOTAL_PUFFS);
  const steamWarmths = new Float32Array(TOTAL_PUFFS);

  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3));
  steamGeo.setAttribute('aSize', new THREE.BufferAttribute(steamSizes, 1));
  steamGeo.setAttribute('aAlpha', new THREE.BufferAttribute(steamAlphas, 1));
  steamGeo.setAttribute('aRot', new THREE.BufferAttribute(steamRots, 1));
  steamGeo.setAttribute('aWarmth', new THREE.BufferAttribute(steamWarmths, 1));

  const steamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: steamMap },
      uScale: { value: 640.0 },
      uCoolColor: { value: new THREE.Color(0x9fb8d4) },
      uWarmColor: { value: new THREE.Color(0xf6be82) }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aRot;
      attribute float aWarmth;
      uniform float uScale;
      varying float vAlpha;
      varying float vRot;
      varying float vWarmth;
      void main() {
        vAlpha = aAlpha;
        vRot = aRot;
        vWarmth = aWarmth;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = clamp(aSize * (uScale / max(1.0, -mvPos.z)), 2.0, 260.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uCoolColor;
      uniform vec3 uWarmColor;
      varying float vAlpha;
      varying float vRot;
      varying float vWarmth;
      void main() {
        if (vAlpha <= 0.004) discard;
        vec2 p = gl_PointCoord - 0.5;
        float c = cos(vRot);
        float s = sin(vRot);
        vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + 0.5;
        vec4 tex = texture2D(uMap, rp);
        float alpha = tex.a * vAlpha;
        if (alpha <= 0.004) discard;
        vec3 col = mix(uCoolColor, uWarmColor, vWarmth);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const steamPoints = new THREE.Points(steamGeo, steamMat);
  steamPoints.frustumCulled = false;
  root.add(steamPoints);

  // Reusable scratch objects to keep update() zero-allocation at 60fps
  const ptFront = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };
  const ptRear = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };
  const ptMid = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };
  const ptSpawn = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };

  function placeArticulatedUnit(obj, centerS, halfWheelbase) {
    getTrackPoint(centerS + halfWheelbase, ptFront);
    getTrackPoint(centerS - halfWheelbase, ptRear);
    const mx = (ptFront.x + ptRear.x) * 0.5;
    const mz = (ptFront.z + ptRear.z) * 0.5;
    const yaw = Math.atan2(ptFront.x - ptRear.x, ptFront.z - ptRear.z);
    obj.position.set(mx, DECK_Y + 0.14, mz);
    obj.rotation.set(0, yaw, 0);
  }

  function update(t, viewportHeight) {
    const state = getTrainState(t);
    const sNose = state.distance;

    // 1. Place locomotive (center is half LOCO_LENGTH behind nose)
    const locoCenterS = sNose - LOCO_LENGTH * 0.5;
    placeArticulatedUnit(locoGroup, locoCenterS, 4.6);

    // 2. Place all 9 cars & articulated couplers behind the locomotive
    let cursorRearS = sNose - LOCO_LENGTH;
    for (let c = 0; c < CAR_COUNT; c++) {
      const couplerS = cursorRearS - 0.35;
      getTrackPoint(couplerS, ptMid);
      couplerGroups[c].position.set(ptMid.x, DECK_Y + 2.45, ptMid.z);
      couplerGroups[c].rotation.set(0, ptMid.yaw, 0);

      const carCenterS = cursorRearS - 0.7 - CAR_LENGTH * 0.5;
      placeArticulatedUnit(carGroups[c], carCenterS, 3.6);
      cursorRearS -= CAR_PITCH;
    }

    // Position warm flank spill light near locomotive/first car
    getTrackPoint(sNose - 16.0, ptMid);
    flankGlowLight.position.set(ptMid.x + 3.2, DECK_Y + 3.1, ptMid.z);

    // Rotate wheels deterministically from distance traveled
    const wheelAngle = sNose / 0.48;
    for (let i = 0; i < wheelMeshes.length; i++) {
      wheelMeshes[i].rotation.x = wheelAngle;
    }

    // Dynamic headlight intensity (brighter in tunnel & night, softer warm pulse at station)
    const nightBoost = clamp((t - 34) / 26, 0, 1);
    const tunnelBoost = state.inTunnel ? 1.25 : 1.0;
    const stationDim = state.atStation ? 0.72 : 1.0;
    beamMat.uniforms.uIntensity.value = (0.24 + nightBoost * 0.14) * tunnelBoost * stationDim;
    poolMat.uniforms.uIntensity.value = (0.42 + nightBoost * 0.22) * (state.inTunnel ? 1.05 : 1.0) * stationDim;
    aheadLight.intensity = (135 + nightBoost * 85) * (state.inTunnel ? 1.15 : 1.0) * stationDim;

    for (let i = 0; i < headlightSprites.length; i++) {
      const baseScale = i === 2 ? 4.4 : 3.6;
      const pulse = 1.0 + Math.sin(t * 7.0 + i) * 0.03;
      headlightSprites[i].scale.setScalar(baseScale * pulse * (state.inTunnel ? 1.1 : 1.0));
    }

    // 3. Update deterministic steam & exhaust puffs
    steamMat.uniforms.uScale.value = (viewportHeight || 960) * 0.62;
    const windX = -3.4; // steady freezing crosswind pushing plumes softly westward

    // A) Roof exhaust stacks
    const stackLife = 2.6;
    for (let i = 0; i < STACK_PUFFS; i++) {
      const phase = (i / STACK_PUFFS) * stackLife;
      const raw = t + phase;
      const cycle = Math.floor(raw / stackLife);
      const age = raw - cycle * stackLife;
      const lifeNorm = age / stackLife; // 0..1
      const spawnTime = t - age;

      if (spawnTime < -3.0) {
        steamAlphas[i] = 0;
        continue;
      }

      const stSpawn = getTrainState(Math.max(0, spawnTime));
      const stackIdx = i & 1;
      const stackOffsetFromNose = LOCO_LENGTH * 0.5 - stackPosZ[stackIdx];
      const sSpawn = stSpawn.distance - stackOffsetFromNose;
      getTrackPoint(sSpawn, ptSpawn);

      const h1 = hash2D(i, cycle) - 0.5;
      const h2 = hash2D(i + 173, cycle * 3 + 7) - 0.5;
      const h3 = hash2D(i + 541, cycle * 5 + 11);

      // Slipstream velocity: when train moves fast, puffs stay slightly dragged along track then billow up
      const slipLag = stSpawn.speed * 0.16 * (1 - Math.exp(-age * 2.2));
      const riseRate = lerp(3.8, 2.2, clamp(stSpawn.speed / 44, 0, 1));
      const upY = age * riseRate + Math.pow(age, 1.35) * 0.85;

      const swirlX = Math.sin(age * 2.8 + h3 * 6.28) * (0.4 + age * 0.65);
      const swirlZ = Math.cos(age * 2.3 + h3 * 6.28) * (0.3 + age * 0.45);

      let px = ptSpawn.x + ptSpawn.tx * slipLag + windX * age * (stSpawn.inTunnel ? 0.12 : 0.72) + swirlX + h1 * 0.7;
      let py = DECK_Y + 5.45 + upY + h2 * 0.4;
      let pz = ptSpawn.z + ptSpawn.tz * slipLag + swirlZ;

      // Clamp steam neatly beneath the concrete tunnel ceiling when inside the monolith block
      if (sSpawn >= TUNNEL_START_S - 4 && sSpawn <= TUNNEL_END_S + 4) {
        const ceilingY = DECK_Y + 8.8;
        if (py > ceilingY) {
          const excess = py - ceilingY;
          py = ceilingY;
          px += (h1 >= 0 ? 1 : -1) * excess * 0.7;
        }
      }

      steamPositions[i * 3] = px;
      steamPositions[i * 3 + 1] = py;
      steamPositions[i * 3 + 2] = pz;

      // Scale grows smoothly as puff expands & dissipates
      const throttleBoost = 0.75 + stSpawn.throttle * 0.55 + (stSpawn.atStation ? 0.15 : 0);
      steamSizes[i] = lerp(1.3, 6.2 * throttleBoost, Math.pow(lifeNorm, 0.72));

      const fadeIn = clamp(lifeNorm * 8.0, 0, 1);
      const fadeOut = Math.pow(1.0 - lifeNorm, 1.45);
      steamAlphas[i] = fadeIn * fadeOut * (stSpawn.inTunnel ? 0.52 : 0.42) * throttleBoost;
      steamRots[i] = h3 * 6.28 + age * (h1 > 0 ? 0.55 : -0.55);
      // Fresh puffs near stack glow subtly warm from furnace & station/tunnel lights
      steamWarmths[i] = clamp((1.0 - lifeNorm * 2.2) * 0.85 + (stSpawn.atStation ? 0.28 : 0), 0, 1);
    }

    // B) Underbody air-brake & station steam-relief valves (prominent during 24-38s)
    const brakeLife = 1.85;
    for (let j = 0; j < BRAKE_PUFFS; j++) {
      const idx = STACK_PUFFS + j;
      const phase = (j / BRAKE_PUFFS) * brakeLife;
      const raw = t + phase;
      const cycle = Math.floor(raw / brakeLife);
      const age = raw - cycle * brakeLife;
      const lifeNorm = age / brakeLife;
      const spawnTime = t - age;

      if (spawnTime < 23.0 || spawnTime > 38.5) {
        steamAlphas[idx] = 0;
        continue;
      }

      const stSpawn = getTrainState(spawnTime);
      // Strongest on heavy braking (25-30s), gentle idle wisps (30-34s), burst on pull-away (34-37s)
      let ventStrength = 0;
      if (spawnTime >= 24.0 && spawnTime < 30.0) {
        ventStrength = 0.45 + stSpawn.braking * 0.85;
      } else if (spawnTime >= 30.0 && spawnTime <= 34.0) {
        ventStrength = 0.55;
      } else if (spawnTime > 34.0 && spawnTime < 37.5) {
        ventStrength = (1.0 - (spawnTime - 34.0) / 3.5) * 1.05;
      }

      const side = (j & 1) === 0 ? 1 : -1;
      const valveDist = 5.5 + (j % 4) * 7.8;
      const sSpawn = stSpawn.distance - valveDist;
      getTrackPoint(sSpawn, ptSpawn);

      const h1 = hash2D(idx, cycle) - 0.5;
      const h2 = hash2D(idx + 311, cycle * 7) - 0.5;
      const jetOut = side * (1.65 + Math.pow(age, 0.72) * 3.2);

      steamPositions[idx * 3] = ptSpawn.x + jetOut + h1 * 0.5;
      steamPositions[idx * 3 + 1] = DECK_Y + 0.85 + age * 1.45 + h2 * 0.25;
      steamPositions[idx * 3 + 2] = ptSpawn.z + h2 * 0.8;

      steamSizes[idx] = lerp(1.0, 4.4, Math.pow(lifeNorm, 0.7));
      const fadeIn = clamp(lifeNorm * 9.0, 0, 1);
      const fadeOut = Math.pow(1.0 - lifeNorm, 1.5);
      steamAlphas[idx] = fadeIn * fadeOut * ventStrength * 0.44;
      steamRots[idx] = h1 * 6.28 + age * side * 0.8;
      steamWarmths[idx] = 0.62; // catches warm sodium station canopy light
    }

    steamGeo.attributes.position.needsUpdate = true;
    steamGeo.attributes.aSize.needsUpdate = true;
    steamGeo.attributes.aAlpha.needsUpdate = true;
    steamGeo.attributes.aRot.needsUpdate = true;
    steamGeo.attributes.aWarmth.needsUpdate = true;
  }

  return {
    root,
    update
  };
}
