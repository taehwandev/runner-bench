import * as THREE from "three";
import { createRng } from "./rng.js";

const WHEEL_RADIUS = 0.52;
const MAIN_PUFF_COUNT = 135;
const SIDE_PUFF_COUNT = 54;
const MAIN_PUFF_LIFE = 3.6;
const SIDE_PUFF_LIFE = 1.8;

function createMaterials(textures) {
  const armorTex = textures.armorMap.clone();
  armorTex.repeat.set(2, 1);
  armorTex.needsUpdate = true;

  const bumpTex = textures.armorBump.clone();
  bumpTex.repeat.set(2, 1);
  bumpTex.needsUpdate = true;

  return {
    hullDark: new THREE.MeshStandardMaterial({
      color: 0x3b4d63,
      map: armorTex,
      bumpMap: bumpTex,
      bumpScale: 0.05,
      roughness: 0.36,
      metalness: 0.68,
    }),
    hullAccent: new THREE.MeshStandardMaterial({
      color: 0x526884,
      map: armorTex,
      bumpMap: bumpTex,
      bumpScale: 0.04,
      roughness: 0.32,
      metalness: 0.62,
    }),
    frostTrim: new THREE.MeshStandardMaterial({
      color: 0x9ab2cc,
      roughness: 0.28,
      metalness: 0.74,
    }),
    snowCap: new THREE.MeshStandardMaterial({
      color: 0xe2eefb,
      map: textures.snowMap,
      roughness: 0.72,
      metalness: 0.06,
    }),
    undercarriage: new THREE.MeshStandardMaterial({
      color: 0x222d3d,
      roughness: 0.52,
      metalness: 0.75,
    }),
    wheelSteel: new THREE.MeshStandardMaterial({
      color: 0xc2d4ea,
      roughness: 0.2,
      metalness: 0.92,
    }),
    warmWindow: new THREE.MeshStandardMaterial({
      color: 0xfff0cc,
      emissive: 0xffb85c,
      emissiveIntensity: 3.8,
      roughness: 0.12,
      metalness: 0.08,
    }),
    cabWindow: new THREE.MeshStandardMaterial({
      color: 0xe0f6ff,
      emissive: 0x7dd8ff,
      emissiveIntensity: 3.1,
      roughness: 0.1,
    }),
    reactorGlow: new THREE.MeshStandardMaterial({
      color: 0xa6ecff,
      emissive: 0x52ccff,
      emissiveIntensity: 3.4,
      roughness: 0.18,
    }),
    amberTrim: new THREE.MeshBasicMaterial({ color: 0xf4a259 }),
    headlightBulb: new THREE.MeshBasicMaterial({ color: 0xfff9ec }),
    tailLamp: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
    brakePad: new THREE.MeshStandardMaterial({
      color: 0x3b231b,
      emissive: 0xff5e24,
      emissiveIntensity: 0.0,
      roughness: 0.5,
    }),
    bellows: new THREE.MeshStandardMaterial({
      color: 0x1a2330,
      roughness: 0.82,
      metalness: 0.28,
    }),
  };
}

function buildBogie(mats) {
  const bogie = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.38, 0.42, 3.1),
    mats.undercarriage
  );
  frame.position.y = 0.62;
  bogie.add(frame);

  const brakeBar = new THREE.Mesh(
    new THREE.BoxGeometry(2.46, 0.13, 2.55),
    mats.brakePad
  );
  brakeBar.position.y = 0.44;
  bogie.add(brakeBar);

  const wheelGeo = new THREE.CylinderGeometry(
    WHEEL_RADIUS,
    WHEEL_RADIUS,
    0.2,
    16
  );
  wheelGeo.rotateZ(Math.PI / 2);
  const axles = [];

  for (const zOff of [-1.05, 0.0, 1.05]) {
    const axleGroup = new THREE.Group();
    axleGroup.position.set(0, WHEEL_RADIUS + 0.12, zOff);
    const leftW = new THREE.Mesh(wheelGeo, mats.wheelSteel);
    leftW.position.x = 0.82;
    const rightW = new THREE.Mesh(wheelGeo, mats.wheelSteel);
    rightW.position.x = -0.82;
    axleGroup.add(leftW, rightW);
    bogie.add(axleGroup);
    axles.push(axleGroup);
  }

  return { group: bogie, axles };
}

function createVolumetricBeam(textures) {
  const group = new THREE.Group();

  const coneGeo = new THREE.ConeGeometry(6.2, 46.0, 28, 1, true);
  coneGeo.translate(0, -23.0, 0);
  coneGeo.rotateX(-Math.PI / 2);

  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0xfff1d6) },
      uIntensity: { value: 0.48 },
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
        float distFade = pow(clamp(vUv.y, 0.0, 1.0), 1.5);
        float tipSoft = smoothstep(1.0, 0.86, vUv.y);
        vec3 viewDir = normalize(vViewPos);
        float fresnel = pow(abs(dot(vNormalView, viewDir)), 1.45);
        float alpha = distFade * tipSoft * fresnel * uIntensity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  const cone = new THREE.Mesh(coneGeo, beamMat);
  cone.rotation.x = 0.045;
  group.add(cone);

  const flareMat = new THREE.SpriteMaterial({
    map: textures.softGlow,
    color: 0xfff4dc,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.95,
  });
  const flare = new THREE.Sprite(flareMat);
  flare.scale.set(3.8, 3.8, 1.0);
  flare.position.z = 0.25;
  group.add(flare);

  return { group, beamMat, flareMat };
}

function buildLocomotiveBody(mats, textures) {
  const body = new THREE.Group();

  const lowerHull = new THREE.Mesh(
    new THREE.BoxGeometry(3.68, 1.82, 13.2),
    mats.hullDark
  );
  lowerHull.position.set(0, 1.95, -0.3);
  body.add(lowerHull);

  // Brushed steel horizontal beltline rib along both flanks
  const beltRib = new THREE.Mesh(
    new THREE.BoxGeometry(3.78, 0.16, 13.0),
    mats.frostTrim
  );
  beltRib.position.set(0, 2.78, -0.3);
  body.add(beltRib);

  const upperCasemate = new THREE.Mesh(
    new THREE.BoxGeometry(3.18, 1.46, 11.5),
    mats.hullAccent
  );
  upperCasemate.position.set(0, 3.36, -0.7);
  body.add(upperCasemate);

  const roofFrost = new THREE.Mesh(
    new THREE.BoxGeometry(2.68, 0.24, 10.7),
    mats.snowCap
  );
  roofFrost.position.set(0, 4.16, -0.8);
  body.add(roofFrost);

  // Sloped armored prow + V-shaped snowplow cowcatcher with amber hazard bar
  const prow = new THREE.Mesh(
    new THREE.ConeGeometry(2.38, 3.7, 4),
    mats.hullAccent
  );
  prow.rotation.y = Math.PI / 4;
  prow.rotation.x = Math.PI / 2;
  prow.scale.set(1.05, 0.86, 1.0);
  prow.position.set(0, 2.26, 6.22);
  body.add(prow);

  for (const side of [-1, 1]) {
    const plowBlade = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 1.28, 0.36),
      mats.frostTrim
    );
    plowBlade.position.set(side * 0.82, 0.98, 6.76);
    plowBlade.rotation.y = -side * 0.44;
    body.add(plowBlade);

    const hazard = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.11, 0.4),
      mats.amberTrim
    );
    hazard.position.set(side * 0.82, 1.48, 6.78);
    hazard.rotation.y = -side * 0.44;
    body.add(hazard);
  }

  // Raised armored bridge cab + glowing slit windows
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(3.32, 0.94, 3.25),
    mats.hullDark
  );
  cab.position.set(0, 4.2, 2.3);
  body.add(cab);

  const cabFrontSlit = new THREE.Mesh(
    new THREE.BoxGeometry(2.48, 0.36, 0.16),
    mats.cabWindow
  );
  cabFrontSlit.position.set(0, 4.25, 3.88);
  body.add(cabFrontSlit);

  for (const side of [-1, 1]) {
    const cabSideSlit = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.36, 1.95),
      mats.cabWindow
    );
    cabSideSlit.position.set(side * 1.65, 4.25, 2.25);
    body.add(cabSideSlit);

    for (let k = 0; k < 4; k++) {
      const port = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.34, 0.9),
        mats.warmWindow
      );
      port.position.set(side * 1.61, 3.26, -0.4 - k * 1.45);
      body.add(port);
    }
  }

  const stack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.58, 0.92, 12),
    mats.undercarriage
  );
  stack.position.set(0, 4.54, -1.2);
  body.add(stack);

  const mainLamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.24, 16),
    mats.headlightBulb
  );
  mainLamp.rotation.x = Math.PI / 2;
  mainLamp.position.set(0, 2.86, 7.08);
  body.add(mainLamp);

  for (const side of [-1, 1]) {
    const ditch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.2, 12),
      mats.headlightBulb
    );
    ditch.rotation.x = Math.PI / 2;
    ditch.position.set(side * 1.15, 1.56, 6.74);
    body.add(ditch);
  }

  const beam = createVolumetricBeam(textures);
  beam.group.position.set(0, 2.86, 7.14);
  body.add(beam.group);

  const spotLight = new THREE.SpotLight(0xfff1d6, 175, 105, 0.46, 0.55, 1.3);
  spotLight.position.set(0, 2.9, 7.0);
  spotLight.target.position.set(0, 0.1, 48.0);
  body.add(spotLight, spotLight.target);

  const noseFill = new THREE.PointLight(0xffdfb0, 20, 26, 1.5);
  noseFill.position.set(0, 2.9, 8.2);
  body.add(noseFill);

  return { body, beam, spotLight };
}

function buildArmoredCarBody(carIndex, totalCars, mats, textures) {
  const body = new THREE.Group();
  const isTail = carIndex === totalCars - 1;
  const isDome = carIndex === 1 || carIndex === 5;
  const isReactor = carIndex === 3;

  const lowerSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(3.54, 1.66, 10.65),
    mats.hullDark
  );
  lowerSkirt.position.y = 1.85;
  body.add(lowerSkirt);

  const beltRib = new THREE.Mesh(
    new THREE.BoxGeometry(3.64, 0.14, 10.58),
    mats.frostTrim
  );
  beltRib.position.y = 2.66;
  body.add(beltRib);

  const upperHull = new THREE.Mesh(
    new THREE.BoxGeometry(3.18, 1.48, 10.45),
    mats.hullAccent
  );
  upperHull.position.y = 3.24;
  body.add(upperHull);

  const snowRoof = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.22, 10.1),
    mats.snowCap
  );
  snowRoof.position.y = 4.05;
  body.add(snowRoof);

  const bellows = new THREE.Mesh(
    new THREE.BoxGeometry(2.38, 2.45, 1.35),
    mats.bellows
  );
  bellows.position.set(0, 2.55, 5.75);
  body.add(bellows);

  const winCount = 6;
  const winMat = isReactor ? mats.reactorGlow : mats.warmWindow;
  for (const side of [-1, 1]) {
    for (let w = 0; w < winCount; w++) {
      const zPos = -3.85 + w * 1.54;
      const mainWin = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.44, 0.96),
        winMat
      );
      mainWin.position.set(side * 1.6, 3.26, zPos);
      body.add(mainWin);

      const lowerPort = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.19, 0.62),
        mats.warmWindow
      );
      lowerPort.position.set(side * 1.78, 2.28, zPos);
      body.add(lowerPort);
    }
  }

  if (isDome) {
    const cupola = new THREE.Mesh(
      new THREE.BoxGeometry(2.48, 0.68, 4.8),
      mats.hullDark
    );
    cupola.position.y = 4.34;
    body.add(cupola);
    const domeGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.54, 0.34, 4.1),
      mats.warmWindow
    );
    domeGlass.position.y = 4.38;
    body.add(domeGlass);
  }

  if (isTail) {
    for (const side of [-1, 1]) {
      const tailLight = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.18, 12),
        mats.tailLamp
      );
      tailLight.rotation.x = Math.PI / 2;
      tailLight.position.set(side * 1.12, 2.35, -5.36);
      body.add(tailLight);

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textures.softGlow,
          color: 0xff3b30,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.85,
        })
      );
      halo.scale.set(1.9, 1.9, 1.0);
      halo.position.set(side * 1.12, 2.35, -5.52);
      body.add(halo);
    }
  }

  return body;
}

function createSteamPlumeSystem(scene, textures) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mainMat = new THREE.MeshBasicMaterial({
    map: textures.steam,
    color: 0xdce8f8,
    transparent: true,
    depthWrite: false,
    opacity: 0.54,
  });
  const sideMat = new THREE.MeshBasicMaterial({
    map: textures.steam,
    color: 0xeef5ff,
    transparent: true,
    depthWrite: false,
    opacity: 0.46,
  });

  const mainMesh = new THREE.InstancedMesh(geo, mainMat, MAIN_PUFF_COUNT);
  const sideMesh = new THREE.InstancedMesh(geo, sideMat, SIDE_PUFF_COUNT);
  mainMesh.frustumCulled = false;
  sideMesh.frustumCulled = false;
  scene.add(mainMesh, sideMesh);

  return { mainMesh, sideMesh, mainMat, sideMat };
}

function updateSteamPlumes(
  steam,
  rng,
  timeline,
  track,
  cameraQuat,
  currentTime
) {
  const dummy = new THREE.Object3D();
  const pose = {};
  const tunnelStart = timeline.landmarks.tunnelStart;
  const tunnelEnd = timeline.landmarks.tunnelEnd;

  for (let i = 0; i < MAIN_PUFF_COUNT; i++) {
    const phase = (i / MAIN_PUFF_COUNT) * MAIN_PUFF_LIFE;
    const cycle = Math.floor((currentTime + phase + 100.0) / MAIN_PUFF_LIFE);
    const age =
      (((currentTime + phase) % MAIN_PUFF_LIFE) + MAIN_PUFF_LIFE) %
      MAIN_PUFF_LIFE;
    const birthT = currentTime - age;
    const birthState = timeline.getStateAtTime(Math.max(0, birthT));
    const stackS =
      birthT < 0
        ? birthState.exactDistance + birthT * 28.0 - 8.3
        : birthState.exactDistance - 8.3;

    track.getPoseAtDistance(stackS, pose);

    const h1 = rng.hashSigned(i, cycle * 17 + 3);
    const h2 = rng.hashSigned(i, cycle * 31 + 9);
    const h3 = rng.hash(i, cycle * 47 + 5);

    const speedFactor = birthState.exactSpeed / 36.0;
    let rise = 4.9 + Math.pow(age, 0.82) * (3.1 + (1.0 - speedFactor) * 1.9);
    if (stackS >= tunnelStart && stackS <= tunnelEnd) {
      rise = Math.min(rise, 8.1);
    }

    const crossWind = age * (1.35 + h1 * 0.9);
    const trailBack = -age * (1.1 + speedFactor * 1.4) + h2 * 0.6;

    dummy.position
      .copy(pose.position)
      .addScaledVector(pose.up, rise)
      .addScaledVector(pose.left, crossWind)
      .addScaledVector(pose.tangent, trailBack);

    const fade = Math.sin(Math.min(1.0, age / MAIN_PUFF_LIFE) * Math.PI);
    const baseScale = 1.55 + age * (2.6 + h3 * 1.1);
    const s = Math.max(0.01, baseScale * (0.35 + 0.65 * fade));
    dummy.quaternion.copy(cameraQuat);
    dummy.rotateZ(age * 0.45 * h1 + i * 0.5);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    steam.mainMesh.setMatrixAt(i, dummy.matrix);
  }
  steam.mainMesh.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < SIDE_PUFF_COUNT; i++) {
    const phase = (i / SIDE_PUFF_COUNT) * SIDE_PUFF_LIFE;
    const cycle = Math.floor((currentTime + phase + 100.0) / SIDE_PUFF_LIFE);
    const age =
      (((currentTime + phase) % SIDE_PUFF_LIFE) + SIDE_PUFF_LIFE) %
      SIDE_PUFF_LIFE;
    const birthT = Math.max(0, currentTime - age);
    const birthState = timeline.getStateAtTime(birthT);
    const valveS = birthState.exactDistance - 4.2 - (i % 3) * 2.1;
    track.getPoseAtDistance(valveS, pose);

    const sideSign = i % 2 === 0 ? 1 : -1;
    const h1 = rng.hashSigned(i + 300, cycle * 23);
    const stationBoost = birthT >= 24.0 && birthT <= 38.5 ? 1.0 : 0.35;

    const lateralJet =
      sideSign * (1.95 + Math.pow(age, 0.7) * (3.6 * stationBoost + 1.2));
    const rise = 0.75 + age * (1.35 + Math.abs(h1) * 0.6);

    dummy.position
      .copy(pose.position)
      .addScaledVector(pose.left, lateralJet)
      .addScaledVector(pose.up, rise)
      .addScaledVector(pose.tangent, h1 * 0.6);

    const lifeNorm = age / SIDE_PUFF_LIFE;
    const env = Math.sin(lifeNorm * Math.PI) * stationBoost;
    const s = Math.max(0.01, (0.9 + age * 2.1) * env);
    dummy.quaternion.copy(cameraQuat);
    dummy.rotateZ(h1 * 2.0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    steam.sideMesh.setMatrixAt(i, dummy.matrix);
  }
  steam.sideMesh.instanceMatrix.needsUpdate = true;
}

export function createTrainSystem(scene, track, timeline, textures) {
  const rng = createRng(904112);
  const mats = createMaterials(textures);
  const root = new THREE.Group();
  root.name = "ArmoredTrainConsist";
  scene.add(root);

  const units = [];
  const locoBuilt = buildLocomotiveBody(mats, textures);
  const locoFrontBogie = buildBogie(mats);
  const locoRearBogie = buildBogie(mats);
  root.add(locoBuilt.body, locoFrontBogie.group, locoRearBogie.group);
  units.push({
    offsetFromNose: 7.1,
    bogieSpan: 4.1,
    body: locoBuilt.body,
    frontBogie: locoFrontBogie,
    rearBogie: locoRearBogie,
  });

  const carCount = timeline.carCount;
  for (let i = 0; i < carCount; i++) {
    const carBody = buildArmoredCarBody(i, carCount, mats, textures);
    const frontBogie = buildBogie(mats);
    const rearBogie = buildBogie(mats);
    if (i === 1 || i === 4 || i === 7) {
      const warmSpill = new THREE.PointLight(0xffb866, 18, 22, 1.6);
      warmSpill.position.set(0, 3.2, 0);
      carBody.add(warmSpill);
    }
    root.add(carBody, frontBogie.group, rearBogie.group);
    units.push({
      offsetFromNose: 20.4 + i * 11.75,
      bogieSpan: 3.65,
      body: carBody,
      frontBogie,
      rearBogie,
    });
  }

  const steam = createSteamPlumeSystem(scene, textures);
  const poseFront = {};
  const poseRear = {};
  const midPos = new THREE.Vector3();
  const dirVec = new THREE.Vector3();
  const upVec = new THREE.Vector3();
  const leftVec = new THREE.Vector3();
  const basisMat = new THREE.Matrix4();

  function update(state, camera) {
    const noseS = state.exactDistance;
    const wheelAngle = noseS / WHEEL_RADIUS;
    mats.brakePad.emissiveIntensity = state.braking * 3.4;

    const nightFactor = Math.min(1.0, Math.max(0.0, (state.time - 18.0) / 32.0));
    locoBuilt.beam.beamMat.uniforms.uIntensity.value = state.train.inTunnel
      ? 0.62
      : 0.42 + nightFactor * 0.24;
    locoBuilt.spotLight.intensity = state.train.inTunnel
      ? 220
      : 165 + nightFactor * 60;

    for (const u of units) {
      const centerS = noseS - u.offsetFromNose;
      track.getPoseAtDistance(centerS + u.bogieSpan, poseFront);
      track.getPoseAtDistance(centerS - u.bogieSpan, poseRear);

      u.frontBogie.group.position.copy(poseFront.position);
      u.frontBogie.group.quaternion.copy(poseFront.quaternion);
      u.rearBogie.group.position.copy(poseRear.position);
      u.rearBogie.group.quaternion.copy(poseRear.quaternion);

      for (const axle of u.frontBogie.axles) axle.rotation.x = wheelAngle;
      for (const axle of u.rearBogie.axles) axle.rotation.x = wheelAngle;

      midPos.addVectors(poseFront.position, poseRear.position).multiplyScalar(0.5);
      dirVec.subVectors(poseFront.position, poseRear.position).normalize();
      upVec.addVectors(poseFront.up, poseRear.up).normalize();
      leftVec.crossVectors(upVec, dirVec).normalize();
      upVec.crossVectors(dirVec, leftVec).normalize();

      basisMat.makeBasis(leftVec, upVec, dirVec);
      u.body.position.copy(midPos);
      u.body.quaternion.setFromRotationMatrix(basisMat);
    }

    updateSteamPlumes(steam, rng, timeline, track, camera.quaternion, state.time);
  }

  return {
    update,
    getLocomotivePose(noseS, out = {}) {
      return track.getPoseAtDistance(noseS - 7.1, out);
    },
  };
}
