// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { createFlight, launch, step } from '../js/flight.js';

const DT = 1 / 60;

function run(flight, seconds) {
  for (let i = 0; i < seconds / DT; i++) step(flight, DT);
  return flight;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('hover ignores repeated and early input and stays over the pad', () => {
  const f = createFlight();
  run(f, 3);
  assert.equal(f.phase, 'hover');
  assert.ok(Math.abs(f.pos.x) < 1e-9 && Math.abs(f.pos.z) < 1e-9);
  assert.ok(Math.abs(f.pos.y - CONFIG.hoverHeight) <= 0.16);
  assert.equal(launch(f), true);
  assert.equal(launch(f), false, 'second launch is ignored');
});

test('lap keeps the ship on the lap ring after the entry and moves in its direction of travel', () => {
  const f = createFlight();
  launch(f);
  run(f, CONFIG.entryTime + 1);
  assert.equal(f.phase, 'lap');
  const r = Math.hypot(f.pos.x, f.pos.z);
  assert.ok(Math.abs(r - CONFIG.lapRadius) < 0.01, `radius ${r}`);
  // Heading must be tangential: position · direction ≈ 0 on a circle
  const radial = f.pos.x * f.dir.x + f.pos.z * f.dir.z;
  assert.ok(Math.abs(radial) < 0.05, `radial component ${radial}`);
});

test('a full lap is slow and ends back at the start of the ring', () => {
  const f = createFlight();
  launch(f);
  run(f, CONFIG.lapDuration - 0.5);
  assert.equal(f.phase, 'lap');
  assert.ok(f.speed < 4, `lap speed ${f.speed} should be slow`);
  // Step until the phase flips; the ship must be back at the ring's start point then
  while (f.phase === 'lap') step(f, DT);
  assert.equal(f.phase, 'depart');
  assert.equal(f.following, true);
  assert.ok(Math.abs(f.pos.x - CONFIG.lapRadius) < 0.1 && Math.abs(f.pos.z) < 0.1, JSON.stringify(f.pos));
});

test('departure moves away from the pad, climbs, and speeds up', () => {
  const f = createFlight();
  launch(f);
  run(f, CONFIG.lapDuration + 0.05);
  assert.equal(f.phase, 'depart');
  let last = dist(f.pos, { x: 0, y: 0, z: 0 });
  let lastSpeed = 0;
  for (let i = 0; i < CONFIG.departDuration / DT - 2; i++) {
    step(f, DT);
    const d = dist(f.pos, { x: 0, y: 0, z: 0 });
    assert.ok(d >= last - 1e-9, 'distance from pad never decreases while departing');
    assert.ok(f.speed >= lastSpeed - 1e-9, 'speed never decreases while departing');
    last = d;
    lastSpeed = f.speed;
  }
  assert.ok(f.pos.y > CONFIG.hoverHeight + 50, `climbed to ${f.pos.y}`);
  assert.ok(f.thrust === 1);
});

test('home camera target is at the hover point so the ship is centred on screen', () => {
  // Orbit pivots on the home target; a mismatch shows as the ship drifting off-centre when zoomed in
  assert.equal(CONFIG.home.target.x, 0);
  assert.equal(CONFIG.home.target.z, 0);
  assert.equal(CONFIG.home.target.y, CONFIG.hoverHeight);
});

test('gone is final: the ship never returns to hover, lap or departure', () => {
  const f = createFlight();
  launch(f);
  run(f, CONFIG.lapDuration + CONFIG.departDuration + 1);
  assert.equal(f.phase, 'gone');
  assert.equal(f.following, true, 'camera keeps tracking briefly after departure');
  run(f, CONFIG.goneFollowTime + 1);
  assert.equal(f.following, false, 'camera releases the ship afterwards');
  const far = dist(f.pos, { x: 0, y: 0, z: 0 });
  run(f, 60);
  assert.equal(f.phase, 'gone');
  assert.equal(launch(f), false, 'cannot launch again once gone');
  assert.ok(dist(f.pos, { x: 0, y: 0, z: 0 }) > far, 'keeps receding');
});
