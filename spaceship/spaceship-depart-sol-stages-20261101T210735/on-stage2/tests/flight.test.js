import test from 'node:test';
import assert from 'node:assert/strict';
import { flightAt, LAP_DURATION, DEPARTURE_DURATION } from '../src/flight.js';
test('one complete slow lap returns to its tangent point before departure', () => {
  assert.deepEqual(flightAt(0).position, [0, 3.2, 0]);
  const angles = [];
  for (let t = 0; t <= LAP_DURATION; t += .25) {
    const [x, y, z] = flightAt(t).position;
    assert.ok(Math.abs(Math.hypot(x, z - 8) - 8) < 1e-8);
    assert.ok(y >= 3.2);
    angles.push(Math.atan2(x, 8 - z));
  }
  const end = flightAt(LAP_DURATION).position;
  assert.ok(Math.hypot(end[0], end[2]) < 1e-8);
  assert.equal(flightAt(LAP_DURATION / 2).progress, .5);
});
test('departure is continuous and never loops back, including after the sequence ends', () => {
  const boundary = flightAt(LAP_DURATION + .00001);
  assert.ok(Math.hypot(boundary.position[0], boundary.position[2]) < .001);
  let previousDistance = 0;
  for (let t = LAP_DURATION + 1; t <= 600; t++) {
    const f = flightAt(t);
    assert.ok(f.position[0] > previousDistance);
    previousDistance = f.position[0];
    assert.equal(f.position[2], 0);
  }
  assert.equal(flightAt(LAP_DURATION + DEPARTURE_DURATION).phase, 'cruise');
});

test('pause freezes the path and phase for arbitrarily long intervals; resume excludes paused time', async () => {
  const { FlightPlayback } = await import('../src/flight.js');
  const clock = new FlightPlayback();
  clock.pause(0);
  assert.equal(clock.started, false);
  clock.start(1000);
  clock.pause(13000);
  const paused = flightAt(clock.elapsed(13000));
  assert.deepEqual(flightAt(clock.elapsed(900000)), paused);
  assert.equal(clock.elapsed(900000), 12);
  clock.pause(900000);
  clock.resume(913000);
  assert.deepEqual(flightAt(clock.elapsed(913000)), paused);
  assert.equal(clock.elapsed(914000), 13);
  clock.resume(915000);
  assert.equal(clock.elapsed(915000), 14);
  clock.pause(916000);
  clock.resume(920000);
  assert.equal(clock.elapsed(921000), 16);
});

test('pausing before completion cannot unlock replay; replay restarts timing and clears pause', async () => {
  const { FlightPlayback } = await import('../src/flight.js');
  const clock = new FlightPlayback();
  clock.start(0);
  clock.pause(45000);
  assert.equal(flightAt(clock.elapsed(100000)).phase, 'depart');
  clock.resume(100000);
  assert.equal(flightAt(clock.elapsed(101000)).phase, 'cruise');
  clock.pause(102000);
  clock.start(200000);
  assert.equal(clock.paused, false);
  assert.equal(clock.elapsed(200000), 0);
  assert.deepEqual(flightAt(clock.elapsed(200000)).position, [0, 3.2, 0]);
  assert.equal(flightAt(clock.elapsed(212000)).phase, 'lap');
  assert.equal(flightAt(clock.elapsed(246000)).phase, 'cruise');
});
