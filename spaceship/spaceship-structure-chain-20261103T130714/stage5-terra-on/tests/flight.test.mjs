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

test('climb, jump and arrival keep the camera following the ship', () => {
  const f = createFlight();
  launch(f);
  while (f.phase !== 'spaceflight') step(f, DT);
  const altitude = f.pos.y;
  run(f, 5);
  assert.ok(f.pos.y > altitude + 100);
  assert.ok(f.space > 0.99, 'sky has transitioned to space');
  while (f.stage !== 'jump') step(f, DT);
  run(f, 1);
  assert.ok(f.jump > 0.8, 'jump effect is visible before relocation');
  const before = { ...f.pos };
  run(f, 1);
  assert.equal(f.jumps, 1);
  assert.ok(dist(before, f.pos) > 10000, 'jump reaches a distant destination');
  while (f.phase !== 'gone') step(f, DT);
  assert.equal(f.stage, 'arrival');
  assert.equal(f.jump, 0);
  assert.equal(f.following, true);
  run(f, 10);
  assert.equal(f.following, true);
  assert.equal(launch(f), false);
  assert.equal(createFlight().space, 0, 'replay starts in the atmosphere');
});
