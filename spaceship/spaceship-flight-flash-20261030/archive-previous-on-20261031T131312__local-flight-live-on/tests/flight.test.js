import test from 'node:test';
import assert from 'node:assert/strict';
import { FlightController, FlightPhase, PAD_POSITION, evaluateCircuit } from '../src/flight/state.js';

test('FlightController initializes on pad in READY phase', () => {
  const fc = new FlightController();
  const telemetry = fc.getTelemetry();

  assert.equal(telemetry.phase, FlightPhase.READY);
  assert.equal(telemetry.gearExtension, 1.0);
  assert.equal(telemetry.distanceToPadMeters, 0);
  assert.ok(Math.abs(telemetry.position.y - PAD_POSITION.y) < 0.01);
});

test('Takeoff initiates and transitions into hover and circuit', () => {
  const fc = new FlightController();
  const started = fc.initiateTakeoff();
  assert.equal(started, true);
  assert.equal(fc.phase, FlightPhase.TAKEOFF);

  // Advance partway through takeoff (2 seconds)
  fc.update(2.0);
  const midTakeoff = fc.getTelemetry();
  assert.ok(midTakeoff.position.y > PAD_POSITION.y);
  assert.ok(midTakeoff.altitudeMeters > 0);

  // Complete takeoff duration
  fc.update(2.5);
  const endTakeoff = fc.getTelemetry();
  assert.equal(endTakeoff.phase, FlightPhase.CIRCUIT);
  assert.equal(endTakeoff.gearExtension, 0.0);
});

test('Circuit evaluation returns smooth continuous 3D coordinates', () => {
  const pStart = evaluateCircuit(0.0);
  const pMid = evaluateCircuit(0.5);
  const pEnd = evaluateCircuit(1.0);

  assert.ok(typeof pStart.x === 'number' && !isNaN(pStart.x));
  assert.ok(typeof pMid.y === 'number' && !isNaN(pMid.y));
  assert.ok(typeof pEnd.z === 'number' && !isNaN(pEnd.z));

  // Trajectory stays within test circuit boundary
  assert.ok(Math.abs(pMid.x) < 80);
  assert.ok(Math.abs(pMid.z) < 80);
  assert.ok(pMid.y > 5 && pMid.y < 50);
});

test('Full flight loop completes and lands smoothly on pad', () => {
  const fc = new FlightController();
  fc.initiateTakeoff();

  // Step through entire flight
  const totalDuration = fc.takeoffDuration + fc.circuitDuration + fc.approachDuration + fc.landingDuration + 1.0;
  const step = 0.5;
  for (let t = 0; t < totalDuration; t += step) {
    fc.update(step);
  }

  const finalState = fc.getTelemetry();
  assert.equal(finalState.phase, FlightPhase.READY);
  assert.equal(finalState.gearExtension, 1.0);
  assert.ok(Math.abs(finalState.position.x - PAD_POSITION.x) < 0.1);
  assert.ok(Math.abs(finalState.position.z - PAD_POSITION.z) < 0.1);
  assert.ok(Math.abs(finalState.position.y - PAD_POSITION.y) < 0.1);
});
