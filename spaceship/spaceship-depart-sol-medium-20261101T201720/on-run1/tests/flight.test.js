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
