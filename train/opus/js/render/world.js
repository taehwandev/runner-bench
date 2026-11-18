// Scene assembly and the single per-frame entry point renderAt(t).
// Everything visible is derived from t, so any frame can be rendered on demand.

import * as THREE from 'three';
import { WORLD_SEED, QUALITY, DURATION } from '../config.js';
import { cameraAt } from '../core/shots.js';
import { atmosphereAt } from '../core/atmosphere.js';
import { trainDistance, trainSpeed } from '../core/kinematics.js';
import { track, TUNNEL } from '../core/landmarks.js';
import { computeSightlines } from '../core/sightlines.js';
import { generateCity } from '../core/cityLayout.js';
import { updateAtmosUniforms } from './atmosShader.js';
import { createMaterials } from './materials.js';
import { createSky, createEnvironment } from './sky.js';
import { createCity } from './city.js';
import { createTerrain } from './terrain.js';
import { createViaduct, RAIL_TOP } from './viaduct.js';
import { createStation } from './station.js';
import { createTunnel } from './tunnel.js';
import { createBridge } from './bridge.js';
import { createTrain } from './train.js';
import { createSnow, createSteam } from './particles.js';
import { createPost } from './post.js';

const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

function stackEmitter(tb) {
  const d = trainDistance(tb);
  const v = trainSpeed(tb);
  const h = track.pointAt(d).h;
  const pulse = Math.pow(0.5 + 0.5 * Math.cos((d / 3.4) * Math.PI * 2), 3);
  let strength = v > 0.3 ? 0.55 + 0.45 * pulse : 0.45;
  strength *= 1 + 0.5 * smooth(33.6, 34.5, tb) * (1 - smooth(39, 42, tb));
  return {
    pos: track.offsetPoint(d - 6.8, 0, RAIL_TOP + 5.25),
    vel: [Math.cos(h) * v, 4.5, Math.sin(h) * v],
    strength,
  };
}

function ventEmitter(tb) {
  const d = trainDistance(tb);
  const h = track.pointAt(d).h;
  const side = Math.floor(tb * 30) % 2 ? 1 : -1;
  const env = smooth(28.6, 29.8, tb) * (1 - smooth(35.2, 37, tb)) * (1 + 0.6 * smooth(33.4, 34, tb));
  return {
    pos: track.offsetPoint(d - 4.5, side * 1.7, RAIL_TOP + 0.7),
    vel: [-Math.sin(h) * side * 6, 0.6, Math.cos(h) * side * 6],
    strength: env,
  };
}

function tunnelVolume() {
  const mid = track.pointAt((TUNNEL.start + TUNNEL.end) / 2);
  return {
    center: [mid.x, mid.y, mid.z],
    axis: [Math.cos(mid.h), 0, Math.sin(mid.h)],
    size: [(TUNNEL.end - TUNNEL.start) / 2, TUNNEL.halfWidth, TUNNEL.height],
  };
}

function fadeAt(t) {
  return smooth(0, 1.4, t) * (1 - smooth(DURATION - 1.8, DURATION, t));
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.4, 9000);

  const mats = createMaterials();
  const layout = generateCity(WORLD_SEED, computeSightlines());
  const sky = createSky();
  const city = createCity(layout);
  const terrain = createTerrain();
  const viaduct = createViaduct(mats);
  const station = createStation(mats);
  const tunnel = createTunnel(mats);
  const bridge = createBridge(mats);
  const train = createTrain(mats);
  const snowNear = createSnow({ count: QUALITY.snowNear, box: 46, size: 0.075, fall: 1.3, seed: 7, tunnel: tunnelVolume() });
  const snowFar = createSnow({ count: QUALITY.snowFar, box: 220, size: 0.24, fall: 1.9, seed: 9, tunnel: tunnelVolume() });
  const stack = createSteam({ rate: 26, life: 5.5, emitter: stackEmitter, rise: 3.2, growth: 1.7, size0: 1.3, seed: 3 });
  const vents = createSteam({ rate: 30, life: 2.4, emitter: ventEmitter, rise: 1.1, growth: 1.5, size0: 0.7, seed: 5, dragK: 2.5, opacity: 0.45 });

  scene.environment = createEnvironment(renderer);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, Math.PI);
  // soft key that rides with the camera so the train's flanks always read
  const kicker = new THREE.DirectionalLight(0xb8c8ff, 0.9);
  scene.add(kicker, kicker.target);
  const sun = new THREE.DirectionalLight(0xffffff, Math.PI * 0.6);
  scene.add(hemi, sun, sun.target);
  const parts = { sky, city, terrain, viaduct, station, tunnel, bridge, train, snowNear, snowFar, stack, vents };
  for (const [name, part] of Object.entries(parts)) {
    part.object.name = name;
    scene.add(part.object);
  }
  const pixelScaled = [...city.glow, ...station.glow, ...tunnel.glow, ...bridge.glow, snowNear, snowFar, stack, vents];
  const post = createPost(renderer, scene, camera, QUALITY.bloom);
  const bufferSize = new THREE.Vector2();

  function applyCamera(rig) {
    camera.position.set(...rig.pos);
    camera.fov = rig.fov;
    camera.up.set(0, 1, 0);
    camera.lookAt(...rig.look);
    camera.rotateZ(rig.roll);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function renderAt(t) {
    const rig = cameraAt(t);
    applyCamera(rig);
    const atm = atmosphereAt(t);
    updateAtmosUniforms(atm, t);
    sky.update(atm, camera);
    city.update(atm);
    terrain.update(atm);
    hemi.color.setRGB(...atm.ambSky);
    hemi.groundColor.setRGB(...atm.ambGround);
    sun.color.setRGB(...atm.sunLight);
    sun.intensity = Math.PI * 0.7 * atm.sunGlowAmt;
    sun.position.set(atm.sunDir[0] * 100, 18, atm.sunDir[2] * 100).add(camera.position);
    sun.target.position.copy(camera.position);
    renderer.toneMappingExposure = atm.exposure;
    scene.environmentIntensity = 0.45 + 0.4 * atm.sunGlowAmt;
    camera.localToWorld(kicker.position.set(-14, 10, 4));
    camera.localToWorld(kicker.target.position.set(0, 0, -30));

    train.update(t, camera);
    const head = train.headlight();
    snowNear.update(atm, head);
    snowFar.update(atm, head);
    stack.update(t, atm);
    vents.update(t, atm);

    renderer.getDrawingBufferSize(bufferSize);
    const pxScale = bufferSize.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const p of pixelScaled) p.setPixelScale(pxScale);
    post.render(t, fadeAt(t));
    return rig;
  }

  function resize(w, h, dpr) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(w, h, dpr);
  }

  function dispose() {
    post.dispose();
    mats.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
    renderer.dispose();
  }

  return { renderAt, resize, dispose };
}
