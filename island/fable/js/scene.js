// Scene assembly and the single deterministic entry point: renderAt(t).
import * as THREE from 'three';
import { U, makeNoiseTexture } from './common.js';
import { buildHeightField, finalizeHeightTexture, buildTerrain } from './terrain.js';
import { buildOcean } from './ocean.js';
import { buildSkyDome, buildStars, buildGulls } from './sky.js';
import { buildFlora } from './flora.js';
import { buildStructures } from './structures.js';
import { initTimeline, applyEnvironment, applyCamera } from './timeline.js';

const REFLECT_LAYER = 1;
const MAX_PIXEL_RATIO = 2, MAX_RENDER_HEIGHT = 1920;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // shaders tone-map and encode themselves
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.4, 9000);
  const mirror = new THREE.PerspectiveCamera(50, 9 / 16, 0.4, 9000);
  mirror.layers.set(REFLECT_LAYER);

  U.uNoise.value = makeNoiseTexture();
  buildHeightField();
  const reflected = [buildTerrain(), ...buildFlora()];
  const structures = buildStructures();
  reflected.push(...structures.meshes);
  finalizeHeightTexture();           // after flora has splatted its canopy shade
  U.uLampPos.value.copy(structures.lamp);
  initTimeline(structures.lamp);

  const rt = new THREE.WebGLRenderTarget(432, 768, {
    type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  const ocean = buildOcean(rt.texture);
  const dome = buildSkyDome(), stars = buildStars(), gulls = buildGulls();
  for (const m of reflected) { m.layers.enable(REFLECT_LAYER); scene.add(m); }
  scene.add(dome, stars, gulls, ocean);

  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const _look = new THREE.Vector3(), _black = new THREE.Color(0, 0, 0);

  function renderReflection() {
    mirror.fov = camera.fov; mirror.updateProjectionMatrix();
    mirror.position.set(camera.position.x, -camera.position.y, camera.position.z);
    camera.getWorldDirection(_look);
    _look.y = -_look.y;
    mirror.up.set(0, 1, 0).applyQuaternion(camera.quaternion); mirror.up.y = -mirror.up.y;
    _look.add(mirror.position);
    mirror.lookAt(_look);
    mirror.updateMatrixWorld(true);
    ocean.material.uniforms.uReflM.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    U.uClip.value = 1; U.uLinearOut.value = 1;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(_black, 0);
    renderer.clear();
    renderer.render(scene, mirror);
    renderer.setRenderTarget(null);
    renderer.setClearColor(_black, 1);
    U.uClip.value = 0; U.uLinearOut.value = 0;
  }

  let baseRatio = 1, scale = 1, cssW = 0, cssH = 0;
  function applySize() {
    const ratio = baseRatio * scale;
    renderer.setPixelRatio(ratio);
    renderer.setSize(cssW, cssH, false);
    U.uPx.value = (cssH * ratio) / 1100;
  }
  function resize(w, h) {
    cssW = w; cssH = h;
    baseRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO, MAX_RENDER_HEIGHT / h);
    applySize();
  }
  // Resolution steps down if the device cannot hold the frame rate.
  function lowerResolution() {
    if (scale <= 0.6 || baseRatio * scale * cssH < 900) return false;
    scale *= 0.85; applySize();
    return true;
  }

  function renderAt(t) {
    applyCamera(t, camera);
    const beam = applyEnvironment(t, U, camera.position);
    structures.update(t, beam);
    ocean.position.set(camera.position.x, 0, camera.position.z);
    ocean.updateMatrixWorld();
    renderReflection();
    renderer.render(scene, camera);
  }

  return { renderAt, resize, lowerResolution, renderer };
}
