// Camera owner: orbit/zoom/pan via OrbitControls, plus follow, smooth reset and button zoom.
// Only this module moves the camera; main.js just tells it when to follow.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from './config.js';

const { home, follow, zoom: zoomCfg, resetDuration } = CONFIG;
const smooth = (t) => t * t * (3 - 2 * t);

function homePose(aspect) {
  const distance = aspect < 1 ? home.distancePortrait : home.distanceLandscape;
  const target = new THREE.Vector3(home.target.x, home.target.y, home.target.z);
  const position = target.clone().addScaledVector(new THREE.Vector3(home.dir.x, home.dir.y, home.dir.z), distance);
  return { position, target };
}

export function createCameraRig(camera, canvas) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.8;
  controls.minDistance = zoomCfg.min;
  controls.maxDistance = zoomCfg.max;
  controls.maxPolarAngle = Math.PI * 0.49; // stay above the ground plane

  let following = false;
  let tween = null; // { t, from, to } while a reset is animating
  let zoomGoal = null; // target distance while a button zoom is easing

  // A drag cancels any in-flight button zoom or reset animation
  controls.addEventListener('start', () => {
    zoomGoal = null;
    tween = null;
    controls.enabled = true;
  });

  function setAspect(aspect) {
    camera.aspect = aspect;
    camera.fov = aspect < 1 ? 62 : 50; // narrow screens need a wider vertical view
    camera.updateProjectionMatrix();
  }

  // Positions the camera at home without animation (startup)
  function snapHome() {
    const pose = homePose(camera.aspect);
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    controls.update();
  }

  function reset() {
    tween = {
      t: 0,
      from: { position: camera.position.clone(), target: controls.target.clone() },
      to: homePose(camera.aspect),
    };
    following = false;
    zoomGoal = null;
    controls.enabled = false;
  }

  function zoomBy(factor) {
    const distance = camera.position.distanceTo(controls.target);
    zoomGoal = THREE.MathUtils.clamp(distance * factor, controls.minDistance, controls.maxDistance);
  }

  function setFollowing(on) {
    following = on;
  }

  // Moves the orbit target toward `subject` and carries the camera along by the same
  // amount, so the user's current angle and distance are kept while tracking.
  function trackSubject(dt, subject) {
    const before = controls.target.clone();
    controls.target.lerp(subject, 1 - Math.exp(-follow.smoothing * dt));
    camera.position.add(controls.target.clone().sub(before));
  }

  function easeDistance(dt) {
    const offset = camera.position.clone().sub(controls.target);
    const current = offset.length();
    const next = current + (zoomGoal - current) * (1 - Math.exp(-zoomCfg.smoothing * dt));
    if (Math.abs(zoomGoal - next) < 0.05) zoomGoal = null;
    camera.position.copy(controls.target).addScaledVector(offset.normalize(), next);
  }

  function update(dt, subject) {
    if (tween) {
      tween.t = Math.min(tween.t + dt, resetDuration);
      const k = smooth(tween.t / resetDuration);
      camera.position.lerpVectors(tween.from.position, tween.to.position, k);
      controls.target.lerpVectors(tween.from.target, tween.to.target, k);
      if (tween.t >= resetDuration) {
        tween = null;
        controls.enabled = true;
      }
    } else {
      if (following) trackSubject(dt, subject);
      if (zoomGoal !== null) easeDistance(dt);
    }
    controls.update();
  }

  return { controls, setAspect, snapHome, reset, zoomBy, setFollowing, update };
}
