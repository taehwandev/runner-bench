// Camera modes: manual orbit (owned by OrbitControls), follow-the-ship, zoom and reset.
// Only one mode moves the camera at a time: a reset tween, or otherwise follow and zoom.
import * as THREE from 'three';
import { easeInOut } from './util.js';
import { distanceFromPad } from './flight.js';

const FOLLOW_RATE = 6;      // how quickly the orbit target chases the ship (per second)
const ZOOM_RATE = 3;        // how quickly the camera distance eases toward its goal
const TWEEN_SECONDS = 1.2;  // length of the reset animation
const LOOKAHEAD = 0.2;      // seconds of ship motion to aim ahead of

// Camera distance while following the departing ship. It grows so the ship stays readable
// as the scenery recedes.
const departDistance = (fromPad) => 14 + 0.14 * fromPad;

export function createCameraRig({ camera, controls, home }) {
  const state = { followOn: false, autoZoom: false, goalDistance: null, tween: null };
  const prev = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const offset = new THREE.Vector3();

  // Moves the camera along its current view direction until it is `goal` away from the target.
  function setDistance(goal, dt) {
    offset.copy(camera.position).sub(controls.target);
    const current = offset.length();
    if (current < 1e-4) return true;
    const next = current + (goal - current) * (1 - Math.exp(-ZOOM_RATE * dt));
    camera.position.copy(controls.target).addScaledVector(offset, next / current);
    return Math.abs(next - goal) < 0.05;
  }

  // Moves the orbit target toward the ship and carries the camera by the same amount,
  // so the user's current orbit angle and distance are kept.
  function follow(ship, dt) {
    prev.copy(controls.target);
    aim.copy(ship.position).addScaledVector(ship.velocity, LOOKAHEAD);
    controls.target.lerp(aim, 1 - Math.exp(-FOLLOW_RATE * dt));
    aim.copy(controls.target).sub(prev);
    camera.position.add(aim);
  }

  function runTween(dt) {
    const tw = state.tween;
    tw.t = Math.min(tw.t + dt / TWEEN_SECONDS, 1);
    const k = easeInOut(tw.t);
    camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
    controls.target.lerpVectors(tw.fromTarget, tw.toTarget, k);
    if (tw.t >= 1) state.tween = null;
  }

  return {
    get followOn() {
      return state.followOn;
    },

    setFollow(on) {
      state.followOn = on;
    },

    // Called when the departure starts: follow the ship and zoom out as it leaves.
    startLaunchCamera() {
      state.followOn = true;
      state.autoZoom = true;
      state.goalDistance = null;
    },

    // Any user orbit or zoom gesture takes manual control back from the automatic zoom.
    cancelAuto() {
      state.autoZoom = false;
      state.goalDistance = null;
    },

    zoom(factor) {
      const base = state.goalDistance ?? camera.position.distanceTo(controls.target);
      state.goalDistance = THREE.MathUtils.clamp(base * factor, controls.minDistance, controls.maxDistance);
      state.autoZoom = false;
    },

    reset() {
      state.followOn = false;
      state.autoZoom = false;
      state.goalDistance = null;
      state.tween = {
        t: 0,
        fromPos: camera.position.clone(),
        toPos: home.pos.clone(),
        fromTarget: controls.target.clone(),
        toTarget: home.target.clone(),
      };
    },

    update(dt, ship) {
      if (ship.phase === 'gone') state.followOn = false;
      if (state.tween) {
        runTween(dt);
        return;
      }
      if (state.followOn) follow(ship, dt);
      if (ship.phase === 'depart' && state.autoZoom) {
        setDistance(departDistance(distanceFromPad(ship.position)), dt);
      } else if (state.goalDistance !== null && setDistance(state.goalDistance, dt)) {
        state.goalDistance = null;
      }
    },
  };
}
