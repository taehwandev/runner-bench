// Assembles every scene unit and owns the one per-frame update: given a time,
// pose the camera, the train, the lights and the effects. No state survives
// between calls, so update(t) twice gives the same frame twice.

import * as THREE from 'three';
import { RENDER } from '../config.js';
import { trainAt, shotIndexAt } from '../core/timeline.js';
import { VEHICLES, vehiclePose } from '../core/consist.js';
import { cameraAt, gradeAt } from '../camera/shots.js';
import { installAtmosphere, atmoUniforms, createSky, createLights } from './atmosphere.js';
import { GlowList } from './glows.js';
import { createCity } from './city.js';
import { createTrackworks } from './trackworks.js';
import { createStation } from './station.js';
import { createTunnel } from './tunnel.js';
import { createTrain } from './train.js';
import { createSnow } from './snow.js';
import { createSteam } from './steam.js';

const SHUTTER = 1 / 50; // seconds of motion each snow streak covers

const _target = new THREE.Vector3();
const _lamp = new THREE.Vector3();
const _lampColor = new THREE.Vector3();
const _pose = {};

function applyPose(camera, p) {
  camera.position.set(p.cam.x, p.cam.y, p.cam.z);
  camera.fov = p.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(_target.set(p.target.x, p.target.y, p.target.z));
  camera.updateMatrixWorld(true);
}

/** Distance from the camera to the nearest vehicle, for the sound mix. */
function nearestVehicle(camera, distance) {
  let best = Infinity;
  for (const v of VEHICLES) {
    vehiclePose(distance, v, _pose);
    const d = Math.hypot(_pose.x - camera.position.x, _pose.y + 2 - camera.position.y, _pose.z - camera.position.z);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Build the world. Returns { scene, camera, update(t, width, height) } where
 * update returns { state, shot, grade, listenerDistance } for that time.
 */
export function createWorld() {
  installAtmosphere();
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0); // switches the shared atmosphere on for built-in materials
  const camera = new THREE.PerspectiveCamera(45, RENDER.aspect, 0.5, 9000);
  const ghost = camera.clone(); // the same camera one shutter interval earlier
  const prevViewProj = new THREE.Matrix4();

  const glows = new GlowList();
  const sky = createSky();
  const lights = createLights();
  const train = createTrain();
  const city = createCity(glows);
  const trackworks = createTrackworks(glows);
  const station = createStation(glows);
  const tunnel = createTunnel(glows, { headPos: train.headPos, headDir: train.headDir });
  const snow = createSnow(train.headPos, train.headDir);
  const steam = createSteam();
  scene.add(sky.mesh, lights.group, city.group, trackworks.group, station.group, tunnel.group, train.group, glows.build(), steam.mesh, snow.group);

  function update(t, width, height) {
    const state = trainAt(t);
    const shot = shotIndexAt(t);
    const grade = gradeAt(t);
    applyPose(ghost, cameraAt(t - SHUTTER, shot));
    prevViewProj.multiplyMatrices(ghost.projectionMatrix, ghost.matrixWorldInverse);
    applyPose(camera, cameraAt(t, shot));

    atmoUniforms.uTime.value = t;
    atmoUniforms.uHaze.value = grade.haze;
    lights.set(grade.night);
    const lamp = grade.lamp;
    _lamp.set(lamp.pos.x, lamp.pos.y, lamp.pos.z);
    lights.practical.position.copy(_lamp);
    lights.practical.color.setRGB(lamp.color[0], lamp.color[1], lamp.color[2]);
    lights.practical.intensity = lamp.intensity;
    _lampColor.fromArray(lamp.color).multiplyScalar(lamp.intensity * 0.12);

    sky.update(camera);
    train.update(t, state, camera);
    station.update(t);
    steam.update(t, camera, grade.night);
    snow.update({
      prevTime: t - SHUTTER, prevViewProj, width, height, fovDeg: camera.fov, lampPos: _lamp, lampColor: _lampColor,
    });
    return { state, shot, grade, listenerDistance: nearestVehicle(camera, state.distance) };
  }

  return { scene, camera, update };
}
