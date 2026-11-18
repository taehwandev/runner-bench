import * as THREE from "three";

function smooth01(x) {
  const u = Math.min(1.0, Math.max(0.0, x));
  return u * u * (3.0 - 2.0 * u);
}

export function createCameraDirector(camera, track) {
  const camPose = {};
  const lookPose = {};
  const camPos = new THREE.Vector3();
  const lookPos = new THREE.Vector3();

  function placeTrackRelative(
    sCam,
    latCam,
    upCam,
    sLook,
    latLook,
    upLook,
    fov
  ) {
    track.getPoseAtDistance(sCam, camPose);
    track.getPoseAtDistance(sLook, lookPose);

    camPos
      .copy(camPose.position)
      .addScaledVector(camPose.left, latCam)
      .addScaledVector(camPose.up, upCam);

    lookPos
      .copy(lookPose.position)
      .addScaledVector(lookPose.left, latLook)
      .addScaledVector(lookPose.up, upLook);

    camera.position.copy(camPos);
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(lookPos);
  }

  function updateShot1(state) {
    // 0-9s: Wide establishing crane above the frozen skyscraper canyon
    const u = smooth01(state.time / 9.0);
    const noseS = state.exactDistance;
    placeTrackRelative(
      noseS + 34.0 - u * 12.0,
      13.8 - u * 2.2,
      16.5 - u * 4.5,
      noseS - 18.0 - u * 6.0,
      -1.2,
      2.4,
      50.0
    );
  }

  function updateShot2(state) {
    // 9-17s: Dynamic tracking alongside the armored cars forward toward the locomotive
    const u = smooth01((state.time - 9.0) / 8.0);
    const noseS = state.exactDistance;
    const carFocusS = noseS - 56.0 + u * 44.0;
    placeTrackRelative(
      carFocusS - 7.0,
      10.8 - u * 1.2,
      3.4 + Math.sin(u * Math.PI) * 0.8,
      carFocusS + 10.0,
      0.2,
      2.6,
      47.0
    );
  }

  function updateShot3(state) {
    // 17-24s: Heroic low-angle viaduct pass from below & beside the T-girder piers
    // as the locomotive and 9 lit cars thunder diagonally overhead.
    const u = (state.time - 17.0) / 7.0;
    const noseS = state.exactDistance;
    const sCam = 502.0 + u * 60.0;
    const sLook = Math.min(noseS - 3.0, sCam + 22.0 - u * 28.0);
    placeTrackRelative(sCam, -14.8, -3.4, sLook, 0.0, 3.3, 52.0);
  }

  function updateShot4(state) {
    // 24-34s: Elevated Sector 04 station platform — locomotive glides in under
    // the warm canopy, brakes to speed === 0 at s=756m, and vents white steam.
    const tLocal = state.time - 24.0;
    const uArrive = smooth01(Math.min(1.0, tLocal / 6.0));
    const uDwell = smooth01(Math.max(0.0, (tLocal - 6.0) / 4.0));
    const noseS = state.exactDistance;

    const sCam = 724.0 + uArrive * 45.0 + uDwell * 2.5;
    const sLook = noseS - 11.5 - uArrive * 4.5;
    placeTrackRelative(
      sCam,
      7.3 + uDwell * 0.45,
      3.35,
      sLook,
      0.2,
      2.65,
      47.0
    );
  }

  function updateShot5(state) {
    // 34-40s: Elevated chase behind-left of the accelerating consist as the
    // locomotive + front cars charge straight into the brutalist Monolith Portal.
    const u = smooth01((state.time - 34.0) / 6.0);
    const noseS = state.exactDistance;
    placeTrackRelative(
      noseS - 32.0 + u * 8.0,
      8.8 - u * 1.6,
      6.4 + u * 0.8,
      noseS + 16.0 + u * 18.0,
      -0.8,
      3.2,
      51.0
    );
  }

  function updateShot6(state) {
    // 40-43s: Pacing ahead of the locomotive inside the illuminated concrete
    // tunnel bore as amber & cyan ribs flash across the armored hull.
    const u = smooth01((state.time - 40.0) / 3.0);
    const noseS = state.exactDistance;
    const sCam = Math.min(957.0, noseS + 18.5 - u * 2.5);
    placeTrackRelative(sCam, 3.95, 2.75, noseS - 7.5, 0.0, 2.55, 52.0);
  }

  function updateShot7(state) {
    // 43-46s: Outside over the frozen chasm looking back at the floodlit
    // Monolith Exit Portal as the locomotive & all 9 cars burst onto the bridge.
    const u = smooth01((state.time - 43.0) / 3.0);
    const noseS = state.exactDistance;
    placeTrackRelative(
      noseS + 20.0 - u * 4.0,
      -14.5 - u * 3.5,
      5.8 + u * 2.2,
      Math.max(962.0, noseS - 28.0),
      0.0,
      3.2,
      50.0
    );
  }

  function updateShot8(state) {
    // 46-60s: Grand aerial tracking crane over the frozen bay framing the
    // locomotive headlight cone, trailing lit cars, cable-stayed pylons, and night sky.
    const u = smooth01((state.time - 46.0) / 14.0);
    const noseS = state.exactDistance;
    placeTrackRelative(
      noseS + 44.0 - u * 10.0,
      -30.0 - u * 8.0,
      14.0 + u * 9.0,
      noseS - 11.0 - u * 5.0,
      0.0,
      4.8,
      53.0
    );
  }

  return {
    update(state) {
      switch (state.shot) {
        case 1:
          updateShot1(state);
          break;
        case 2:
          updateShot2(state);
          break;
        case 3:
          updateShot3(state);
          break;
        case 4:
          updateShot4(state);
          break;
        case 5:
          updateShot5(state);
          break;
        case 6:
          updateShot6(state);
          break;
        case 7:
          updateShot7(state);
          break;
        default:
          updateShot8(state);
          break;
      }
    },
  };
}
