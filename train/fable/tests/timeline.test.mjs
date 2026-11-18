// Timetable contract, checked without a browser: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { trainAt, speedAt, distanceAt, shotIndexAt, nextShotStart, LANDMARKS, TRAIN_LENGTH } from '../js/core/timeline.js';
import { sampleTrack } from '../js/core/track.js';
import { VEHICLES, vehiclePose } from '../js/core/consist.js';
import { cameraAt } from '../js/camera/shots.js';
import { DURATION, SHOTS, TRACK } from '../js/config.js';

const times = (a, b, step) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => a + i * step);

test('train has a locomotive and at least 8 cars', () => {
  assert.equal(VEHICLES[0].type, 'loco');
  assert.ok(trainAt(0).cars >= 8);
  assert.equal(VEHICLES.length, trainAt(0).cars + 1);
});

test('0-24 s: runs at steady speed', () => {
  for (const t of times(0, 24, 0.5)) assert.equal(speedAt(t), 38);
});

test('24-30 s: slows monotonically to a stop', () => {
  let prev = speedAt(24);
  for (const t of times(24.1, 30, 0.1)) {
    assert.ok(speedAt(t) <= prev + 1e-9, `speed rises at ${t}`);
    prev = speedAt(t);
  }
  assert.equal(speedAt(30), 0);
});

test('30-34 s: stands at the platform with speed exactly 0', () => {
  for (const t of times(30, 34, 0.05)) {
    const s = trainAt(t);
    assert.equal(s.speed, 0);
    assert.equal(s.distance, LANDMARKS.stationStop);
    assert.equal(s.atStation, true);
  }
  assert.equal(trainAt(29.9).atStation, false);
  assert.equal(trainAt(34.1).atStation, false);
});

test('34-40 s: pulls away and speeds up', () => {
  let prev = 0;
  for (const t of times(34.1, 40, 0.1)) {
    assert.ok(speedAt(t) > prev, `no acceleration at ${t}`);
    prev = speedAt(t);
  }
});

test('40-46 s: in the tunnel, and the whole train gets inside it', () => {
  for (const t of times(40, 45.95, 0.05)) assert.equal(trainAt(t).inTunnel, true, `not in tunnel at ${t}`);
  for (const t of [0, 20, 32, 39.95, 46, 47, 55, 60]) assert.equal(trainAt(t).inTunnel, false, `in tunnel at ${t}`);
  assert.ok(LANDMARKS.tunnelEnd - LANDMARKS.tunnelStart > TRAIN_LENGTH);
  assert.ok(times(40, 46, 0.05).some((t) => trainAt(t).fullyInTunnel));
});

test('46-60 s: out on the bridge, still accelerating into the night', () => {
  for (const t of times(46, 60, 0.5)) assert.ok(speedAt(t) >= 54);
  assert.ok(distanceAt(60) < TRACK.to - 300, 'track must outlast the film');
});

test('distance is continuous and never runs backwards', () => {
  let prev = distanceAt(-1);
  for (const t of times(-0.99, DURATION + 1, 0.01)) {
    const d = distanceAt(t);
    assert.ok(d >= prev && d - prev < 0.7, `jump at ${t}`);
    prev = d;
  }
});

test('same time gives the same answer', () => {
  for (const t of [0, 7.31, 29.999, 33, 41.2, 59.99]) {
    assert.deepEqual(trainAt(t), trainAt(t));
    assert.deepEqual(cameraAt(t), cameraAt(t));
  }
});

test('track is straight through station, tunnel and bridge', () => {
  for (const s of [LANDMARKS.stationStop - 200, LANDMARKS.tunnelStart, LANDMARKS.tunnelEnd, LANDMARKS.end]) {
    const p = sampleTrack(s);
    assert.equal(p.x, 0);
    assert.equal(p.z, -s);
  }
});

test('vehicles face the way they travel', () => {
  for (const t of [1, 12, 26, 37, 50]) {
    const a = vehiclePose(distanceAt(t), VEHICLES[0]);
    const b = vehiclePose(distanceAt(t + 0.05), VEHICLES[0]);
    assert.ok((b.x - a.x) * a.fx + (b.z - a.z) * a.fz > 0, `moving backwards at ${t}`);
  }
});

test('at least four shots, cut list is ordered and skippable', () => {
  assert.ok(SHOTS.length >= 4);
  SHOTS.forEach((shot, i) => {
    assert.equal(shotIndexAt(shot.start), i);
    if (i > 0) assert.ok(shot.start > SHOTS[i - 1].start);
  });
  assert.equal(nextShotStart(0), SHOTS[1].start);
  assert.equal(nextShotStart(DURATION - 1), null);
});
