// Pure flight timeline: no DOM or three.js, so the timing can be checked in Node.
// Positions and headings are plain {x, y, z} objects.
// Phases: hover -> lap -> depart -> ascent -> jump -> arrival -> gone.
import { smoothstep } from './util.js';

export const HOVER_Y = 3;              // hover altitude above the pad centre
export const LAP_SECONDS = 18;         // length of the single slow lap
export const LAP_RADIUS = 9;           // lap radius around the pad
export const LAP_OMEGA = (Math.PI * 2) / LAP_SECONDS;
export const DEPART_DISTANCE = 280;    // distance from the pad where the ship starts to fade
export const FADE_SECONDS = 1.2;

export function createFlight() {
  return {
    phase: 'hover',
    t: 0,                              // seconds spent in the current phase
    time: 0,                           // total seconds, drives the hover bob
    speed: 0,
    position: { x: 0, y: HOVER_Y, z: 0 },
    heading: { x: 0, y: 0, z: -1 },    // unit vector the nose points along
    velocity: { x: 0, y: 0, z: 0 },
    fade: 0,
    space: 0,
    jump: 0,
    teleported: false,
    scale: 1,
    visible: true,
    thrust: 0,                         // 0 = engines off; drives exhaust and glow
  };
}

// Starts the departure. Returns false if the ship is already leaving.
export function launch(flight) {
  if (flight.phase !== 'hover') return false;
  flight.phase = 'lap';
  flight.t = 0;
  return true;
}

export function distanceFromPad(p) {
  return Math.hypot(p.x, p.y - HOVER_Y, p.z);
}

export function stepFlight(f, dt) {
  f.time += dt;
  switch (f.phase) {
    case 'hover': {
      place(f, 0, HOVER_Y + Math.sin(f.time * 1.6) * 0.15, 0, { x: 0, y: 0, z: -1 });
      setVelocity(f, f.heading, 0);
      f.thrust = 0;
      break;
    }
    case 'lap': {
      f.t += dt;
      const p = Math.min(f.t / LAP_SECONDS, 1);
      const theta = Math.PI + Math.PI * 2 * p;             // one full turn
      const r = LAP_RADIUS * smoothstep(p, 0, 0.12);       // lift off the centre, then widen
      const heading = { x: -Math.sin(theta), y: 0, z: Math.cos(theta) };
      place(f, Math.cos(theta) * r, HOVER_Y + 1.5 * Math.sin(Math.PI * p), Math.sin(theta) * r, heading);
      setVelocity(f, heading, r * LAP_OMEGA);
      f.thrust = 0.6;
      if (p >= 1) {
        f.phase = 'depart';
        f.t = 0;
      }
      break;
    }
    case 'depart': {
      f.t += dt;
      const newSpeed = f.speed + (1.5 + 0.9 * f.t) * dt;   // accelerates steadily
      const pitch = 0.22 * smoothstep(f.t, 0, 4);          // nose eases up into a climb
      setVelocity(f, { x: 0, y: Math.sin(pitch), z: -Math.cos(pitch) }, newSpeed);
      advance(f, dt);
      f.thrust = 1 + 0.8 * Math.min(f.speed / 60, 1);
      if (distanceFromPad(f.position) >= DEPART_DISTANCE) {
        f.phase = 'ascent';
        f.t = 0;
      }
      break;
    }
    case 'ascent': {
      f.t += dt;
      const pitch = 0.22 + 0.7 * smoothstep(f.t, 0, 5);
      setVelocity(f, { x: 0, y: Math.sin(pitch), z: -Math.cos(pitch) }, 65);
      advance(f, dt);
      f.space = smoothstep(f.t, 0, 7);
      f.thrust = 1.5;
      if (f.t >= 9) { f.phase = 'jump'; f.t = 0; }
      break;
    }
    case 'jump': {
      f.t += dt;
      f.jump = Math.sin(Math.PI * Math.min(f.t / 3, 1));
      f.scale = 1 - 0.85 * smoothstep(f.t, 0.7, 1.35) + 0.85 * smoothstep(f.t, 1.65, 2.3);
      f.thrust = 1;
      if (f.t >= 1.5 && !f.teleported) {
        f.position.x += 5000;
        f.position.y += 1500;
        f.position.z -= 5000;
        f.teleported = true;
      }
      if (f.t >= 3) { f.phase = 'arrival'; f.t = 0; f.jump = 0; f.scale = 1; }
      break;
    }
    case 'arrival': {
      f.t += dt;
      setVelocity(f, { x: 0, y: 0, z: -1 }, 14 * (1 - smoothstep(f.t, 0, 5)));
      advance(f, dt);
      f.thrust = 0.4 * (1 - smoothstep(f.t, 0, 5));
      if (f.t >= 5) { f.phase = 'gone'; f.t = 0; }
      break;
    }
    case 'gone':
      f.thrust = 0;
      break;
    default:
      f.thrust = 0;
      f.visible = false;
  }
  return f;
}

function place(f, x, y, z, heading) {
  Object.assign(f.position, { x, y, z });
  Object.assign(f.heading, heading);
}

function setVelocity(f, dir, speed) {
  Object.assign(f.heading, dir);
  f.speed = speed;
  f.velocity.x = dir.x * speed;
  f.velocity.y = dir.y * speed;
  f.velocity.z = dir.z * speed;
}

function advance(f, dt) {
  f.position.x += f.velocity.x * dt;
  f.position.y += f.velocity.y * dt;
  f.position.z += f.velocity.z * dt;
}
