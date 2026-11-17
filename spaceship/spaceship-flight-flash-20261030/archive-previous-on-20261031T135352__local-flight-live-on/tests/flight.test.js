import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { createCanvas } from 'canvas';
import { readFileSync } from 'fs';

// Setup Mock DOM environment
const htmlContent = readFileSync('./index.html', 'utf8');
const dom = new JSDOM(htmlContent, {
  url: 'http://localhost:5173',
  pretendToBeVisual: true,
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Polyfill Canvas for Three.js in test
global.document.createElementOriginal = global.document.createElement;
global.document.createElement = function(tagName) {
  if (tagName.toLowerCase() === 'canvas') {
    return createCanvas(1024, 1024);
  }
  return dom.window.document.createElement(tagName);
};

// Import modules
const { AudioSystem } = await import('../src/audioSystem.js');
const { Spaceship } = await import('../src/spaceship.js');
const { Environment } = await import('../src/scene.js');
const { FlightController, FlightPhase } = await import('../src/flightController.js');
const { CameraController, CameraMode } = await import('../src/cameraController.js');
const { UIController } = await import('../src/ui.js');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    testsPassed++;
  }
}

async function runTests() {
  console.log('=== Spaceship Flight Simulation: Verification Tests ===\n');

  // Test 1: Spaceship Model & Assembly
  console.log('-- Test Suite 1: Spaceship Model & Mechanisms --');
  const ship = new Spaceship();
  assert(ship.group !== undefined, 'Spaceship has root group');
  assert(ship.group.name === 'Spaceship', 'Spaceship group name is set');
  assert(ship.hullGroup.children.length > 0, 'Hull components assembled');
  assert(ship.gearAssemblies.length === 3, '3-point landing gear assemblies built (1 nose + 2 main)');
  assert(ship.vtolJets.length === 4, '4 ventral VTOL lift nozzles configured');
  assert(ship.dustPoints !== undefined, 'Ground dust particle system created');

  // Landing gear animation check
  ship.setLandingGear(false);
  assert(ship.targetGearExtension === 0, 'Landing gear target set to retract (0)');
  ship.update(0.6, 5.0);
  assert(ship.gearExtension < 1.0, `Landing gear actively retracts: gearExtension=${ship.gearExtension.toFixed(2)}`);
  ship.setLandingGear(true);
  assert(ship.targetGearExtension === 1, 'Landing gear target set to deploy (1)');
  ship.update(1.0, 1.0);
  assert(ship.gearExtension > 0.5, `Landing gear actively deploys: gearExtension=${ship.gearExtension.toFixed(2)}`);

  // Thruster throttle scaling check
  ship.setThrusterScale(0.8);
  assert(ship.throttle === 0.8, 'Throttle set to 0.8');
  assert(ship.leftFlame.scale.z > 1.0, 'Thruster flame scale expanded with throttle');
  assert(ship.thrusterLight.intensity > 1.0, 'Thruster point light illuminated');

  // Test 2: Environment, Landing Pad & Scene
  console.log('\n-- Test Suite 2: Environment, Landing Pad & Sky --');
  const scene = new THREE.Scene();
  const env = new Environment(scene);
  assert(scene.children.length > 4, 'Scene contains sky, lighting, terrain, pad, and outpost');
  assert(env.sunLight.castShadow === true, 'Sun directional light has shadows enabled');
  assert(env.padGroup !== undefined, 'Landing pad group assembled');
  assert(env.padLights.length === 8, '8 landing pad perimeter beacons positioned');
  assert(env.waypointRings.length === 6, '6 flight circuit waypoint rings created');
  assert(env.outpostGroup !== undefined, 'Planetary outpost and control tower created');

  // Test 3: Flight Controller State Machine & Spline Dynamics
  console.log('\n-- Test Suite 3: Flight Controller & Flight Trajectory --');
  const audio = new AudioSystem();
  const flight = new FlightController(ship, audio);

  // Initial Pad state
  assert(flight.phase === FlightPhase.IDLE, 'Initial flight phase is IDLE');
  assert(Math.abs(ship.group.position.y - flight.padRestY) < 0.01, 'Ship sits exactly on pad resting height');
  assert(ship.gearExtension === 1, 'Landing gear is down on pad');

  // Liftoff & Takeoff
  flight.startTakeoff();
  assert(flight.phase === FlightPhase.TAKEOFF, 'Transitioned to TAKEOFF phase');

  // Simulate spool up and vertical climb
  flight.update(1.5); // through spool up
  assert(ship.vtolPower > 0.5, 'VTOL power spooled up for vertical lift');

  flight.update(2.5); // climbing
  assert(ship.group.position.y > 6.0, `Ship climbed vertically: altitude=${ship.group.position.y.toFixed(1)}m`);
  assert(ship.targetGearExtension === 0, 'Landing gear triggered retraction during climb');

  // Complete liftoff and transition to circuit
  flight.update(2.0);
  assert(flight.phase === FlightPhase.CIRCUIT, 'Smoothly transitioned from climb into CIRCUIT flight');

  // Verify Circuit spline navigation
  const initialCircuitY = ship.group.position.y;
  flight.update(5.0); // 5 seconds of circuit flight
  assert(flight.circuitProgress > 0.15, `Circuit progress advancing: ${(flight.circuitProgress * 100).toFixed(1)}%`);
  assert(ship.throttle > 0.5, 'Cruising throttle applied');
  assert(ship.group.position.length() > 5.0, 'Ship flying 3D trajectory across the landscape');

  // Test Pause / Resume
  flight.togglePause();
  assert(flight.isPaused === true, 'Flight pause activated');
  const posPaused = ship.group.position.clone();
  flight.update(2.0);
  assert(ship.group.position.distanceTo(posPaused) === 0, 'Ship position frozen during pause');
  flight.togglePause();
  assert(flight.isPaused === false, 'Flight resumed');

  // Test Land Now / Abort Circuit override
  flight.landNow();
  assert(flight.phase === FlightPhase.APPROACH, 'Land Now immediately commanded APPROACH phase');

  // Simulate Approach alignment
  flight.update(3.0);
  assert(flight.phase === FlightPhase.LANDING, 'Transitioned to LANDING vertical descent');
  assert(ship.targetGearExtension === 1, 'Landing gear deployed for landing');

  // Simulate Descent to Pad
  flight.update(4.5);
  assert(flight.phase === FlightPhase.TOUCHDOWN, 'Touchdown achieved upon pad contact');
  assert(Math.abs(ship.group.position.y - flight.padRestY) < 0.05, 'Ship back at pad elevation');

  // Simulate Settle & Reset to IDLE
  flight.update(2.2);
  assert(flight.phase === FlightPhase.IDLE, 'Flight completed and ship reset to IDLE ready for next flight');

  // Test 4: Camera Controller Modes & Zoom
  console.log('\n-- Test Suite 4: Camera Controller & Views --');
  const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.2, 1000);
  const camController = new CameraController(camera, dom.window.document.body, ship);

  assert(camController.mode === CameraMode.FOLLOW, 'Default camera mode is FOLLOW');
  camController.update(0.1);
  assert(camera.position.z !== 0, 'Camera positioned behind ship');

  camController.setMode(CameraMode.PAD);
  assert(camController.mode === CameraMode.PAD, 'Switched to PAD camera mode');
  camController.update(0.1);
  assert(camera.position.distanceTo(camController.defaultPadPos) < 1.0, 'Camera positioned near pad observer tower');

  camController.setMode(CameraMode.COCKPIT);
  assert(camController.mode === CameraMode.COCKPIT, 'Switched to COCKPIT camera mode');
  camController.update(0.1);
  assert(camera.position.distanceTo(ship.group.position) < 2.0, 'Camera inside ship cockpit');

  // Zoom functions
  camController.setMode(CameraMode.FREE);
  const camDistBefore = camera.position.distanceTo(camController.controls.target);
  camController.zoomIn(5);
  const camDistAfterZoomIn = camera.position.distanceTo(camController.controls.target);
  assert(camDistAfterZoomIn < camDistBefore, 'Zoom-in decreased camera distance');

  camController.zoomOut(5);
  const camDistAfterZoomOut = camera.position.distanceTo(camController.controls.target);
  assert(camDistAfterZoomOut > camDistAfterZoomIn, 'Zoom-out increased camera distance');

  camController.resetView();
  assert(camController.isUserInteracting === false, 'Reset view restored alignment');

  // Test 5: UI Controller, DOM & Keyboard Shortcuts
  console.log('\n-- Test Suite 5: UI Controls & HUD Telemetry --');
  const ui = new UIController(flight, camController, audio);

  assert(!ui.btnTakeoff.disabled, 'Takeoff button enabled initially');
  assert(ui.btnLand.disabled, 'Land button disabled initially');
  assert(ui.hudStatus.textContent.includes('READY ON PAD'), 'HUD status reads READY ON PAD');

  // Test Takeoff button click
  ui.btnTakeoff.click();
  assert(flight.phase === FlightPhase.TAKEOFF, 'Clicking Takeoff starts TAKEOFF phase');
  assert(ui.btnTakeoff.disabled, 'Takeoff button disabled while in flight');
  assert(!ui.btnPause.disabled, 'Pause button enabled in flight');

  // Test Speed Pills
  const pill2x = dom.window.document.querySelector('.btn-pill[data-speed="2.0"]');
  pill2x.click();
  assert(flight.speedMultiplier === 2.0, 'Speed set to 2.0x via pill selector');

  // Test Telemetry broadcast
  flight.broadcastTelemetry();
  assert(ui.hudAlt.textContent.length > 0, 'HUD Altitude rendered');
  assert(ui.hudSpeed.textContent.length > 0, 'HUD Airspeed rendered');
  assert(ui.hudThrottle.textContent.length > 0, 'HUD Throttle rendered');

  // Test Keyboard shortcuts
  // Space key while in flight should toggle pause
  const spaceEvent = new dom.window.KeyboardEvent('keydown', { code: 'Space' });
  dom.window.dispatchEvent(spaceEvent);
  assert(flight.isPaused === true, 'Space key toggles pause');
  dom.window.dispatchEvent(spaceEvent);
  assert(flight.isPaused === false, 'Space key resumes flight');

  // Key '2' switches to PAD camera
  const key2Event = new dom.window.KeyboardEvent('keydown', { code: 'Digit2' });
  dom.window.dispatchEvent(key2Event);
  assert(camController.mode === CameraMode.PAD, 'Digit2 key switched to PAD camera');

  // Key 'L' triggers land now
  flight.phase = FlightPhase.CIRCUIT; // simulate circuit
  const keyLEvent = new dom.window.KeyboardEvent('keydown', { code: 'KeyL' });
  dom.window.dispatchEvent(keyLEvent);
  assert(flight.phase === FlightPhase.APPROACH, 'KeyL triggered land now');

  // Reset to pad
  ui.btnResetShip.click();
  assert(flight.phase === FlightPhase.IDLE, 'Reset Pad button restores IDLE state');

  console.log(`\n========================================`);
  console.log(`Summary: ${testsPassed} passed, ${testsFailed} failed`);
  console.log(`========================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
