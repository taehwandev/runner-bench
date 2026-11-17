// Pure flight model: phase transitions and motion. No DOM or three.js,
// so it can be unit-tested with plain Node (see tests/flight.test.mjs).
// Positions and directions are plain { x, y, z } objects.

import { CONFIG } from './config.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, k) => a + (b - a) * k;

function unit({ x, y, z }) {
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function lerpDir(a, b, k) {
  return unit({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) });
}

export function createFlight() {
  const { hoverHeight } = CONFIG;
  return {
    phase: 'hover', // hover -> lap -> depart -> gone (no way back except createFlight)
    t: 0, // seconds in the current phase
    time: 0, // total elapsed seconds (drives the hover bob)
    pos: { x: 0, y: hoverHeight, z: 0 },
    dir: { ...CONFIG.startDir },
    speed: 0,
    bank: 0, // roll into turns, radians
    thrust: 0.08, // 0 = engines off, 1 = full departure thrust
    following: false, // true while the camera should track the ship
  };
}

export function launch(flight) {
  if (flight.phase !== 'hover') return false;
  flight.phase = 'lap';
  flight.t = 0;
  return true;
}

// Advances the flight by dt seconds, mutating and returning it.
export function step(flight, dt) {
  flight.time += dt;
  switch (flight.phase) {
    case 'hover':
      stepHover(flight);
      break;
    case 'lap':
      stepLap(flight, dt);
      break;
    case 'depart':
      stepDepart(flight, dt);
      break;
    case 'gone':
      stepGone(flight, dt);
      break;
  }
  return flight;
}

function bob(flight) {
  return Math.sin(flight.time * 1.6) * 0.15;
}

function stepHover(flight) {
  flight.pos = { x: 0, y: CONFIG.hoverHeight + bob(flight), z: 0 };
  flight.dir = { ...CONFIG.startDir };
  flight.bank = 0;
  flight.speed = 0;
  flight.thrust = 0.08;
}

function stepLap(flight, dt) {
  const { lapRadius, lapDuration, entryTime, hoverHeight } = CONFIG;
  flight.t += dt;

  const angle = clamp01(flight.t / lapDuration) * TAU;
  const radius = lapRadius * smooth(clamp01(flight.t / entryTime));
  flight.pos = {
    x: radius * Math.cos(angle),
    y: hoverHeight + bob(flight),
    z: radius * Math.sin(angle),
  };
  // Tangent of the circle, i.e. the direction of travel
  flight.dir = unit({ x: -Math.sin(angle), y: 0, z: Math.cos(angle) });
  flight.speed = (lapRadius * TAU) / lapDuration;
  flight.bank = -0.2 * smooth(clamp01(flight.t / entryTime));
  flight.thrust = 0.35;

  if (flight.t >= lapDuration) {
    // The lap ends at angle 2π, exactly where it started, heading along +Z
    flight.phase = 'depart';
    flight.t = 0;
    flight.following = true;
  }
}

function stepDepart(flight, dt) {
  const { departTurnTime, departDuration, departDir, startDir, departSpeed } = CONFIG;
  flight.t += dt;

  const turn = smooth(clamp01(flight.t / departTurnTime));
  flight.dir = lerpDir(startDir, departDir, turn);
  flight.speed = departSpeed.base + departSpeed.accel * flight.t * flight.t;
  flight.bank = -0.2 * (1 - turn);
  flight.thrust = 1;
  advance(flight, dt);

  if (flight.t >= departDuration) {
    flight.phase = 'gone';
    flight.t = 0;
  }
}

function stepGone(flight, dt) {
  const { cruiseSpeed, goneFollowTime } = CONFIG;
  flight.t += dt;
  flight.speed += (cruiseSpeed - flight.speed) * (1 - Math.exp(-0.6 * dt));
  flight.bank = 0;
  flight.thrust = 0.45;
  advance(flight, dt);
  // Camera lets go after a few seconds; the ship then recedes into the haze on its own
  if (flight.t >= goneFollowTime) flight.following = false;
}

function advance(flight, dt) {
  const d = flight.dir;
  const s = flight.speed * dt;
  flight.pos = { x: flight.pos.x + d.x * s, y: flight.pos.y + d.y * s, z: flight.pos.z + d.z * s };
}
