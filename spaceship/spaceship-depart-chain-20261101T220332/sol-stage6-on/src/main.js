import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createIcons, Info, Sun, Orbit, Plus, Minus, RotateCcw, Rocket, ArrowUpRight,
  MousePointer2, X, ArrowRight, Check, Navigation, Pause, Play } from 'lucide';
import { createWorld, updateWorld } from './world.js';
import { flightAt, FlightPlayback } from './flight.js';
import './style.css';

const icons = { Info, Sun, Orbit, Plus, Minus, RotateCcw, Rocket, ArrowUpRight,
  MousePointer2, X, ArrowRight, Check, Navigation, Pause, Play };
const refreshIcons = () => createIcons({ icons });
refreshIcons();
const $ = (id) => document.getElementById(id);
const container = $('scene');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
let renderer, camera, controls, ship;
const playback = new FlightPlayback();
let flightDestination = $('destination').selectedOptions[0];
let currentPhase = 'hover';
let currentStage = '';
let automaticOrbit = false;
let lastTime = performance.now();
const previousTarget = new THREE.Vector3(0, 3.2, 0);
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
function setPhase(phase, force = false, stage = '') {
  if (phase === currentPhase && stage === currentStage && !force) return;
  currentPhase = phase;
  currentStage = stage;
  $('destination').disabled = phase !== 'cruise';
  let copy;
  if (phase === 'lap') {
    copy = ['Taking the scenic route.', 'One gentle circuit around the outpost.', 'On our way', 'Circling the outpost'];
  } else if (phase === 'depart') {
    if (stage === 'climb') {
      copy = ['Leaving the atmosphere.', 'Climbing steeply out of Kepler Coast.', 'Ascending', 'Climbing out of atmosphere'];
    } else if (stage === 'space') {
      copy = ['Entering deep space.', 'Atmosphere cleared. The sky turns to space.', 'Into space', 'Climbing into open space'];
    } else if (stage === 'warp-spool') {
      copy = ['Spooling hyperdrive.', 'Navigation aligned. Hyperdrive charging.', 'Warp charging', 'Hyperdrive spooling'];
    } else if (stage === 'jump') {
      copy = ['Hyperspace jump!', 'Folding spacetime to distant waypoint coordinates.', 'Teleporting', 'Hyperspace jump'];
    } else if (stage === 'arrival') {
      copy = [`Arriving at ${flightDestination.label.split(' · ')[0]}.`, flightDestination.dataset.arrival, 'Arrived', 'Arrival at destination'];
    } else {
      copy = ['Onward, little explorer.', 'The camera is following the journey.', 'Departing', 'Heading for new horizons'];
    }
  } else {
    // cruise
    copy = ['A new chapter begins.', `Arrived at ${flightDestination.label.split(' · ')[0]}. Choose a route to replay.`, 'Replay departure', 'Arrival complete'];
  }
  $('launch-title').textContent = copy[0];
  $('launch-description').textContent = copy[1];
  $('launch').innerHTML = `${copy[2]} <i data-lucide="${phase === 'cruise' ? 'rotate-ccw' : 'navigation'}"></i>`;
  $('flight-status').textContent = copy[3];
  $('launch').setAttribute('aria-label', copy[2]);
  $('launch').disabled = phase !== 'cruise';

  $('step-lap')?.classList.toggle('active', true);
  $('step-depart')?.classList.toggle('active', phase !== 'lap');
  $('step-jump')?.classList.toggle('active', stage === 'jump' || stage === 'arrival' || phase === 'cruise');
  $('step-dest')?.classList.toggle('active', stage === 'arrival' || phase === 'cruise');

  const envText = $('env-text');
  if (envText) {
    if (phase === 'lap' || stage === 'climb') {
      envText.innerHTML = 'Clear skies<span>KEPLER COAST · DAYTIME</span>';
    } else if (stage === 'space' || stage === 'warp-spool' || stage === 'jump') {
      envText.innerHTML = 'Deep space<span>ORBITAL EXOSPHERE</span>';
    } else {
      envText.textContent = flightDestination.label.split(' · ')[0];
      const detail = document.createElement('span');
      detail.textContent = flightDestination.dataset.region;
      envText.append(detail);
    }
  }
  refreshIcons();
}
function updateFlight(now) {
  let state;
  if (!playback.started) {
    ship.position.set(0, 3.2 + (reducedMotion ? 0 : Math.sin(now * .0014) * .11), 0);
    ship.rotation.set(0, .2, 0, 'YXZ');
  } else {
    state = flightAt(playback.elapsed(now));
    ship.position.set(...state.position);
    ship.rotation.set(-(state.pitch || 0), state.heading, state.bank, 'YXZ');
    setPhase(state.phase, false, state.stage);
  }
  nextTarget.copy(ship.position);
  currentTarget.copy(nextTarget);
  shift.copy(currentTarget).sub(previousTarget);
  camera.position.add(shift);
  controls.target.add(shift);
  previousTarget.copy(currentTarget);

  updateWorld(scene, state, now, camera, flightDestination.value);

  if (!playback.started) return;
  // Distance is bounded independently of flight distance so the ship remains readable.
  $('altitude').innerHTML = `${number.format(ship.position.y)} <small>m</small>`;
  $('velocity').innerHTML = `${number.format(state.speed)} <small>m/s</small>`;

  const elapsed = playback.elapsed(now);
  const outbound = Math.max(0, elapsed - 24);

  $('progress-lap').style.width = `${state.phase === 'lap' ? state.progress * 100 : 100}%`;
  const progDepart = $('progress-depart');
  if (progDepart) {
    const p = state.phase === 'lap' ? 0 : Math.min(outbound / 14, 1) * 100;
    progDepart.style.width = `${p}%`;
  }
  const progJump = $('progress-jump');
  if (progJump) {
    const p = outbound < 14 ? 0 : Math.min((outbound - 14) / 3.5, 1) * 100;
    progJump.style.width = `${p}%`;
  }
  const progDest = $('progress-dest');
  if (progDest) {
    const p = outbound < 17.5 ? 0 : Math.min((outbound - 17.5) / 4.5, 1) * 100;
    progDest.style.width = `${p}%`;
  }

  $('camera-hint').textContent = playback.paused ? 'Flight paused' : 'Following ship';
  container.dataset.phase = state.phase;
  if (state.stage) container.dataset.stage = state.stage;
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, .1);
  lastTime = now;
  updateFlight(now);
  controls.autoRotate = automaticOrbit;
  controls.autoRotateSpeed = .45;
  controls.update(dt);
  const projected = ship.position.clone().project(camera);
  $('ship-tag').style.left = `${(projected.x * .5 + .5) * container.clientWidth + 75}px`;
  $('ship-tag').style.top = `${(-projected.y * .5 + .5) * container.clientHeight - 28}px`;
  scene.getObjectByName('sky').position.copy(camera.position);
  renderer.render(scene, camera);
}
function updatePauseControl() {
  const label = playback.paused ? 'Resume' : 'Pause';
  $('pause-flight').innerHTML = `<i data-lucide="${playback.paused ? 'play' : 'pause'}"></i>${label}`;
  $('pause-flight').setAttribute('aria-label', `${label} flight`);
  $('pause-flight').setAttribute('aria-pressed', String(playback.paused));
  refreshIcons();
}
function wireControls() {
  $('launch').addEventListener('click', () => {
    if (playback.started && currentPhase !== 'cruise') return;
    const replay = playback.started;
    flightDestination = $('destination').selectedOptions[0];
    container.dataset.destination = flightDestination.value;
    const now = performance.now();
    playback.start(now);
    automaticOrbit = false;
    $('orbit').setAttribute('aria-pressed', 'false');
    setPhase('lap', true);
    updateFlight(now);
    if (replay) resetCamera();
    $('pause-flight').hidden = false;
    updatePauseControl();
    $('pause-flight').focus({ preventScroll: true });
  });
  $('pause-flight').addEventListener('click', () => {
    const now = performance.now();
    if (playback.paused) playback.resume(now);
    else playback.pause(now);
    updateFlight(now);
    setPhase(currentPhase, true, currentStage);
    if (playback.paused) {
      $('flight-status').textContent = 'Flight paused';
      $('launch-description').textContent = 'Take your time. Your camera is still free to explore.';
    }
    updatePauseControl();
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
