import * as THREE from 'three';
import { LANES, POWERUPS } from './config.js';

export function createPlayerRig(glowTex) {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x151b30,
    roughness: 0.35,
    metalness: 0.55,
  });
  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x1f2847,
    roughness: 0.28,
    metalness: 0.4,
  });
  const cyanNeon = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0xff2a9d,
    emissive: 0xff2a9d,
    emissiveIntensity: 2.4,
    roughness: 0.15,
  });

  // Torso + Cyber Jacket + Glowing Spine
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.34), jacketMat);
  torso.position.y = 1.12;
  bodyPivot.add(torso);

  const spineGlow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.54, 0.05), cyanNeon);
  spineGlow.position.set(0, 0.02, 0.18);
  torso.add(spineGlow);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 8, 16), cyanNeon);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.34, 0);
  torso.add(collar);

  // Helmet / Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.62, -0.02);
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.4), suitMat);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.28), visorMat);
  visor.position.set(0, 0.02, -0.08);
  headGroup.add(helmet, visor);
  bodyPivot.add(headGroup);

  // Limbs (pivoted at joints)
  const makeLimb = (w, h, d, footColorMat) => {
    const pivot = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), suitMat);
    upper.position.y = -h * 0.5;
    pivot.add(upper);
    if (footColorMat) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.12, d + 0.08), footColorMat);
      trim.position.set(0, -h + 0.06, -0.03);
      pivot.add(trim);
    }
    return pivot;
  };

  const leftArm = makeLimb(0.16, 0.58, 0.16, visorMat);
  leftArm.position.set(-0.38, 1.4, 0);
  const rightArm = makeLimb(0.16, 0.58, 0.16, visorMat);
  rightArm.position.set(0.38, 1.4, 0);

  const leftLeg = makeLimb(0.2, 0.78, 0.22, cyanNeon);
  leftLeg.position.set(-0.16, 0.78, 0);
  const rightLeg = makeLimb(0.2, 0.78, 0.22, cyanNeon);
  rightLeg.position.set(0.16, 0.78, 0);

  bodyPivot.add(leftArm, rightArm, leftLeg, rightLeg);

  // Wet-road runner underglow
  const underGlowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const underGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), underGlowMat);
  underGlow.rotation.x = -Math.PI / 2;
  underGlow.position.y = 0.03;
  root.add(underGlow);

  // Power-up visual attachments
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.18, 1),
    new THREE.MeshBasicMaterial({
      color: POWERUPS.shield.hex,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    })
  );
  shieldMesh.position.y = 1.0;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  const magnetGroup = new THREE.Group();
  const magMat = new THREE.MeshBasicMaterial({
    color: POWERUPS.magnet.hex,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
  });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.04, 8, 28), magMat);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 8, 28), magMat);
  ringA.rotation.x = Math.PI / 2.4;
  ringB.rotation.x = -Math.PI / 2.4;
  magnetGroup.position.y = 1.0;
  magnetGroup.add(ringA, ringB);
  magnetGroup.visible = false;
  root.add(magnetGroup);

  const nitroGroup = new THREE.Group();
  const nitroMat = new THREE.MeshBasicMaterial({
    color: POWERUPS.nitro.hex,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
  const jetConeL = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.35, 10), nitroMat);
  const jetConeR = jetConeL.clone();
  jetConeL.rotation.x = Math.PI / 2;
  jetConeR.rotation.x = Math.PI / 2;
  jetConeL.position.set(-0.18, 1.05, 0.75);
  jetConeR.position.set(0.18, 1.05, 0.75);
  nitroGroup.add(jetConeL, jetConeR);
  nitroGroup.visible = false;
  root.add(nitroGroup);

  return {
    root,
    bodyPivot,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    underGlow,
    underGlowMat,
    shieldMesh,
    magnetGroup,
    nitroGroup,
    runCycle: 0,
  };
}

export function updatePlayerRig(rig, state, dt) {
  const r = state.runner;
  const speed = state.mode === 'playing' ? state.currentSpeed : 18;
  rig.runCycle += dt * speed * 0.62;

  rig.root.position.set(r.x, r.y, 0);
  rig.underGlow.position.y = -r.y + 0.03;
  rig.underGlowMat.opacity = Math.max(0.14, 0.58 - r.y * 0.14);

  const targetX = LANES[r.lane];
  const lateralDelta = targetX - r.x;
  const targetRoll = -lateralDelta * 0.24;
  rig.bodyPivot.rotation.z += (targetRoll - rig.bodyPivot.rotation.z) * Math.min(1, dt * 14);

  if (r.isSliding) {
    rig.bodyPivot.position.y += (-0.52 - rig.bodyPivot.position.y) * Math.min(1, dt * 18);
    rig.bodyPivot.rotation.x += (-0.98 - rig.bodyPivot.rotation.x) * Math.min(1, dt * 18);
    rig.leftLeg.rotation.x = -0.55;
    rig.rightLeg.rotation.x = 0.85;
    rig.leftArm.rotation.x = 0.65;
    rig.rightArm.rotation.x = 0.65;
  } else if (r.isJumping) {
    rig.bodyPivot.position.y += (0 - rig.bodyPivot.position.y) * Math.min(1, dt * 14);
    rig.bodyPivot.rotation.x += (0.24 - rig.bodyPivot.rotation.x) * Math.min(1, dt * 12);
    rig.leftLeg.rotation.x = 0.65;
    rig.rightLeg.rotation.x = -0.35;
    rig.leftArm.rotation.x = -0.85;
    rig.rightArm.rotation.x = 0.45;
  } else {
    const stride = Math.sin(rig.runCycle);
    const bounce = Math.abs(Math.cos(rig.runCycle)) * 0.08;
    rig.bodyPivot.position.y = bounce;
    rig.bodyPivot.rotation.x += (0.14 - rig.bodyPivot.rotation.x) * Math.min(1, dt * 14);
    rig.leftLeg.rotation.x = stride * 0.88;
    rig.rightLeg.rotation.x = -stride * 0.88;
    rig.leftArm.rotation.x = -stride * 0.78;
    rig.rightArm.rotation.x = stride * 0.78;
  }

  // Power-up visuals
  rig.shieldMesh.visible = state.powerups.shield > 0;
  if (rig.shieldMesh.visible) {
    rig.shieldMesh.rotation.y += dt * 2.1;
    rig.shieldMesh.rotation.x += dt * 1.1;
    const blink = state.powerups.shield < 2.0 ? 0.35 + Math.abs(Math.sin(rig.runCycle * 2)) * 0.5 : 0.65;
    rig.shieldMesh.material.opacity = blink;
  }

  rig.magnetGroup.visible = state.powerups.magnet > 0;
  if (rig.magnetGroup.visible) {
    rig.magnetGroup.rotation.y -= dt * 3.4;
    rig.magnetGroup.rotation.z = Math.sin(rig.runCycle * 0.5) * 0.25;
  }

  rig.nitroGroup.visible = state.powerups.nitro > 0;
  if (rig.nitroGroup.visible) {
    const pulse = 0.85 + Math.sin(rig.runCycle * 3.5) * 0.25;
    rig.nitroGroup.scale.set(1, 1, pulse);
    rig.underGlowMat.color.setHex(POWERUPS.nitro.hex);
  } else if (rig.shieldMesh.visible) {
    rig.underGlowMat.color.setHex(POWERUPS.shield.hex);
  } else if (rig.magnetGroup.visible) {
    rig.underGlowMat.color.setHex(POWERUPS.magnet.hex);
  } else {
    rig.underGlowMat.color.setHex(0x00f0ff);
  }
}
