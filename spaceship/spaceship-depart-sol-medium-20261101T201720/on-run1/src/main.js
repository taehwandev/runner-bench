import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createIcons, Info, Sun, Orbit, Plus, Minus, RotateCcw, Rocket, ArrowUpRight,
  MousePointer2, X, ArrowRight, Check, Navigation } from 'lucide';
import { createWorld } from './world.js';
import { flightAt } from './flight.js';
import './style.css';

const icons = { Info, Sun, Orbit, Plus, Minus, RotateCcw, Rocket, ArrowUpRight,
  MousePointer2, X, ArrowRight, Check, Navigation };
const refreshIcons = () => createIcons({ icons });
refreshIcons();
const $ = (id) => document.getElementById(id);
const container = $('scene');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
let renderer, camera, controls, ship;
let launchTime = null;
let currentPhase = 'hover';
let automaticOrbit = false;
let lastTime = performance.now();
const previousTarget = new THREE.Vector3(0, 2, 0);
const currentTarget = previousTarget.clone();
const nextTarget = new THREE.Vector3();
const shift = new THREE.Vector3();
const scene = new THREE.Scene();

function setupScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);
  camera = new THREE.PerspectiveCamera(38, 1, .2, 10000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .08;
  controls.enablePan = false;
  controls.minDistance = 13;
  controls.maxDistance = 85;
  controls.minPolarAngle = .22;
  controls.maxPolarAngle = Math.PI / 2 - .08;
  controls.rotateSpeed = .55;
  controls.zoomSpeed = .65;
  controls.target.copy(currentTarget);
  ship = createWorld(scene);
  resetCamera();
  new ResizeObserver(resize).observe(container);
  resize();
  renderer.render(scene, camera);
  $('loading').style.opacity = '0';
  setTimeout(() => $('loading').remove(), 450);
  requestAnimationFrame(animate);
}
function resize() {
  controls.minDistance = container.clientWidth < 700 ? 23 : 15;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}
function resetCamera() {
  automaticOrbit = false;
  $('orbit').setAttribute('aria-pressed', 'false');
  const mobile = container.clientWidth < 700;
  const offset = mobile ? new THREE.Vector3(31, 13, 38) : new THREE.Vector3(25, 10, 29);
  camera.position.copy(currentTarget).add(offset);
  controls.target.copy(currentTarget);
  controls.update();
}
function zoom(factor) {
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset);
  controls.update();
}
function setPhase(phase) {
  if (phase === currentPhase) return;
  currentPhase = phase;
  const copy = {
    lap: ['Taking the scenic route.', 'One gentle circuit around the outpost.', 'On our way', 'Circling the outpost'],
    depart: ['Onward, little explorer.', 'The camera is following the journey.', 'Departing', 'Heading for new horizons'],
    cruise: ['A new chapter begins.', 'Explorer 01 is on its way. Safe travels.', 'Bon voyage', 'Departure complete'],
  }[phase];
  $('launch-title').textContent = copy[0];
  $('launch-description').textContent = copy[1];
  $('launch').innerHTML = `${copy[2]} <i data-lucide="${phase === 'cruise' ? 'check' : 'navigation'}"></i>`;
  $('flight-status').textContent = copy[3];
  $('launch').setAttribute('aria-label', copy[2]);
  $('step-lap').classList.toggle('active', true);
  $('step-depart').classList.toggle('active', phase !== 'lap');
  refreshIcons();
}
function updateFlight(now, dt) {
  if (launchTime === null) {
    ship.position.y = 3.2 + (reducedMotion ? 0 : Math.sin(now * .0014) * .11);
    ship.rotation.y = .2;
    return;
  }
  const state = flightAt((now - launchTime) / 1000);
  ship.position.set(...state.position);
  ship.rotation.y = state.heading;
  ship.rotation.z = state.bank;
  setPhase(state.phase);
  nextTarget.copy(ship.position).add(new THREE.Vector3(0, -1.2, 0));
  currentTarget.copy(nextTarget);
  shift.copy(currentTarget).sub(previousTarget);
  camera.position.add(shift);
  controls.target.add(shift);
  previousTarget.copy(currentTarget);
  // Distance is bounded independently of flight distance so the ship remains readable.
  $('altitude').innerHTML = `${number.format(ship.position.y)} <small>m</small>`;
  $('velocity').innerHTML = `${number.format(state.speed)} <small>m/s</small>`;
  $('progress-lap').style.width = `${state.phase === 'lap' ? state.progress * 100 : 100}%`;
  $('progress-depart').style.width = `${state.phase === 'lap' ? 0 : state.progress * 100}%`;
  $('camera-hint').textContent = 'Following ship';
  container.dataset.phase = state.phase;
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, .1);
  lastTime = now;
  updateFlight(now, dt);
  controls.autoRotate = automaticOrbit;
  controls.autoRotateSpeed = .45;
  controls.update(dt);
  const projected = ship.position.clone().project(camera);
  $('ship-tag').style.left = `${(projected.x * .5 + .5) * container.clientWidth + 75}px`;
  $('ship-tag').style.top = `${(-projected.y * .5 + .5) * container.clientHeight - 28}px`;
  scene.getObjectByName('sky').position.copy(camera.position);
  renderer.render(scene, camera);
}
function wireControls() {
  $('launch').addEventListener('click', () => {
    if (launchTime !== null) return;
    launchTime = performance.now();
    $('launch').disabled = true;
    $('launch').setAttribute('aria-label', 'Departure in progress');
    automaticOrbit = false;
    $('orbit').setAttribute('aria-pressed', 'false');
    setPhase('lap');
  });
  $('orbit').addEventListener('click', () => {
    automaticOrbit = !automaticOrbit;
    $('orbit').setAttribute('aria-pressed', String(automaticOrbit));
  });
  $('zoom-in').addEventListener('click', () => zoom(.85));
  $('zoom-out').addEventListener('click', () => zoom(1.18));
  $('reset').addEventListener('click', resetCamera);
  container.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) return;
    event.preventDefault();
    if (['+', '=', '-'].includes(event.key)) return zoom(event.key === '-' ? 1.15 : .87);
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === 'ArrowLeft') spherical.theta -= .12;
    if (event.key === 'ArrowRight') spherical.theta += .12;
    if (event.key === 'ArrowUp') spherical.phi -= .1;
    if (event.key === 'ArrowDown') spherical.phi += .1;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
  });
  const about = $('about');
  $('about-open').onclick = () => about.showModal();
  $('about-close').onclick = $('about-done').onclick = () => about.close();
  about.addEventListener('click', (event) => { if (event.target === about) {
    const rect = about.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) about.close();
  } });
  $('flight-status').setAttribute('aria-live', 'polite');
}
try {
  setupScene();
  wireControls();
} catch (error) {
  console.error(error);
  $('loading').style.pointerEvents = 'auto';
  $('loading').innerHTML = '<p>This little world needs WebGL.<br>Enable hardware acceleration, then reload to explore.</p><button onclick="location.reload()">Try again</button>';
  $('launch').disabled = true;
}
