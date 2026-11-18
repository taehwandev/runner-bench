import * as THREE from 'three';
import { clamp, lerp, smoothstep, smootherstep } from './prng.js';
import { SHOTS, getShotIndexAtTime, trackPath, TRACK_Y } from './timeline.js';

export function createCameraRig() {
  // Always fixed 9:16 portrait aspect ratio; outer viewport letterboxes cleanly
  const camera = new THREE.PerspectiveCamera(52, 9 / 16, 0.4, 2400);

  const vPos = new THREE.Vector3();
  const vFwd = new THREE.Vector3();
  const vRight = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  function update(timeSec, trainState) {
    const t = clamp(timeSec, 0, 60);
    const shotIdx = getShotIndexAtTime(t);
    const shot = SHOTS[shotIdx];
    const u = clamp((t - shot.start) / (shot.end - shot.start), 0, 1);
    const d = trainState.distance;

    let fov = 52;
    let shakeAmp = 0.0;

    if (shot.id === 1) {
      // Shot 1 (0-11s): High dusk canyon crane shot looking down the curving viaduct
      const sCam = d + lerp(44, 28, smoothstep(0, 1, u));
      trackPath.sample(sCam, vPos, vFwd, vRight);
      const lat = lerp(-12.5, -10.5, u);
      camPos.set(
        vPos.x + vRight.x * lat,
        lerp(62, 40, smootherstep(0, 1, u)),
        vPos.z + vRight.z * lat
      );

      const sLook = Math.max(-20, d - lerp(18, 28, u));
      trackPath.sample(sLook, vPos);
      lookTarget.set(vPos.x, TRACK_Y + 2.5, vPos.z);
      fov = lerp(54, 50, u);
      shakeAmp = 0.015;
    } else if (shot.id === 2) {
      // Shot 2 (11-22s): Low-angle viaduct overpass rising into side tracking
      const sCam = lerp(388, 576, smoothstep(0, 1, u));
      trackPath.sample(sCam, vPos, vFwd, vRight);
      const lat = lerp(-15.0, -13.5, u);
      const height = lerp(6.8, 20.5, smootherstep(0.2, 0.9, u));
      camPos.set(vPos.x + vRight.x * lat, height, vPos.z + vRight.z * lat);

      const sLook = lerp(d - 6, d - 28, smoothstep(0.25, 0.85, u));
      trackPath.sample(sLook, vPos);
      lookTarget.set(vPos.x, TRACK_Y + 1.8, vPos.z);
      fov = 54;
      // Subtle rumble as locomotive passes overhead around t = 14s
      const passPeak = Math.exp(-Math.pow((t - 14.3) / 1.4, 2));
      shakeAmp = 0.02 + passPeak * 0.07;
    } else if (shot.id === 3) {
      // Shot 3 (22-34s): Elevated station arrival and full halt
      const sCam = lerp(774, 748, smootherstep(0, 1, u));
      const lat = lerp(-14.2, -16.5, smootherstep(0, 1, u));
      const height = lerp(27.6, 25.8, u);
      camPos.set(lat, height, -sCam);

      const sLook = lerp(Math.min(d - 8, 742), 732, smoothstep(0.2, 0.9, u));
      lookTarget.set(2.2, TRACK_Y + 2.8, -sLook);
      fov = lerp(52, 48, smoothstep(0.55, 1.0, u));
      shakeAmp = trainState.speed > 1 ? 0.012 : 0.0;
    } else if (shot.id === 4) {
      // Shot 4 (34-40s): Dynamic low flank tracking alongside accelerating cars
      const sCam = d - lerp(26, 21, smoothstep(0, 1, u));
      const lat = lerp(6.6, 7.2, u);
      camPos.set(lat, lerp(24.2, 25.0, u), -sCam);
      lookTarget.set(0.0, TRACK_Y + 2.6, -(d + lerp(8, 26, u)));
      fov = lerp(50, 56, smoothstep(0.15, 1.0, u));
      shakeAmp = 0.01 + (trainState.speed / 40.0) * 0.045;
    } else if (shot.id === 5) {
      // Shot 5 (40-46s): Inside the tower block tunnel — headlight approach, rush past, exit
      camPos.set(3.9, 24.7, -982);
      const panU = smootherstep(0.36, 0.66, u);
      const lookZ = lerp(-(d - 2), -1042, panU);
      const lookX = lerp(0.0, 0.6, panU);
      lookTarget.set(lookX, TRACK_Y + 2.6, lookZ);
      fov = lerp(50, 56, panU);
      const locoPass = Math.exp(-Math.pow((t - 42.65) / 0.75, 2));
      shakeAmp = 0.03 + locoPass * 0.11;
    } else {
      // Shot 6 (46-60s): Grand cable-stayed night bridge finale into the dark
      const sCam = lerp(1162, 1465, smoothstep(0, 1, u));
      trackPath.sample(sCam, vPos, vFwd, vRight);
      const lat = lerp(26, 38, smootherstep(0.2, 1.0, u));
      const height = lerp(42, 70, smootherstep(0.15, 1.0, u));
      camPos.set(vPos.x + vRight.x * lat, height, vPos.z + vRight.z * lat);

      const sLook = lerp(d - 24, d - 56, smoothstep(0.35, 1.0, u));
      trackPath.sample(sLook, vPos);
      lookTarget.set(vPos.x, TRACK_Y + 2.2, vPos.z);
      fov = lerp(50, 46, smoothstep(0.4, 1.0, u));
      shakeAmp = 0.015;
    }

    // Deterministic micro-shake (pure function of time t)
    if (shakeAmp > 0) {
      camPos.x += Math.sin(t * 29.3) * shakeAmp;
      camPos.y += Math.cos(t * 37.7) * shakeAmp * 0.75;
    }

    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.position.copy(camPos);
    camera.lookAt(lookTarget);

    return {
      shot: shot.id,
      shotLabel: shot.label,
      focusPos: lookTarget.clone(),
    };
  }

  return {
    camera,
    update,
  };
}
