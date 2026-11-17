import * as THREE from 'three';
import {
  HOVER_HEIGHT, LAP_RADIUS, LAP_HEIGHT, LAP_TIME, RAMP_TIME, DEPART_TIME,
  AWAY_SPEED, DEPART_C1_OFFSET, DEPART_C2, DEPART_END,
} from './config.js';
import { ss, bezier } from './util.js';

// Pure flight logic: no DOM or renderer access.
// Phases: hover → lap → depart → away (away is terminal; the ship never returns).

const tmp = new THREE.Vector3();
const prevHeading = new THREE.Vector3();

export function createFlight() {
  return {
    phase: 'hover',
    t: 0,                                   // seconds into the current phase
    elapsed: 0,                             // total seconds, drives idle motion
    progress: 0,                            // 0..1 through the departure curve
    speed: 0,                               // m/s, measured from motion
    awaySpeed: 0,
    position: new THREE.Vector3(0, HOVER_HEIGHT, 0),
    prevPosition: new THREE.Vector3(0, HOVER_HEIGHT, 0),
    heading: new THREE.Vector3(1, 0, 0),
    bank: 0,                                // roll into turns, radians
    departFrom: new THREE.Vector3(),
    departC1: new THREE.Vector3(),
    awayDir: new THREE.Vector3(0, 0, -1),
  };
}

export function resetFlight(f) {
  f.progress = 0;
  f.speed = 0;
  f.awaySpeed = 0;
  f.bank = 0;
  f.position.set(0, HOVER_HEIGHT, 0);
  f.prevPosition.copy(f.position);
  f.heading.set(1, 0, 0);
  setPhase(f, 'hover');
}

export function startLap(f) {
  if (f.phase === 'hover') setPhase(f, 'lap');
}

function setPhase(f, phase) {
  f.phase = phase;
  f.t = 0;
}

// Advances the ship by dt seconds
export function stepFlight(f, dt) {
  f.elapsed += dt;
  const bob = Math.sin(f.elapsed * 1.6) * 0.1;
  f.prevPosition.copy(f.position);

  if (f.phase === 'hover') {
    f.position.set(0, HOVER_HEIGHT + bob, 0);
  } else if (f.phase === 'lap') {
    f.t += dt;
    // Blend out of the hover point while the orbit starts at (0, -R)
    const k = ss(0, RAMP_TIME, f.t);
    const th = -Math.PI / 2 + (Math.PI * 2 / LAP_TIME) * f.t;
    f.position.set(
      LAP_RADIUS * Math.cos(th) * k,
      THREE.MathUtils.lerp(HOVER_HEIGHT + bob, LAP_HEIGHT + bob, k),
      LAP_RADIUS * Math.sin(th) * k
    );
    if (f.t >= LAP_TIME) {
      f.departFrom.copy(f.position);
      f.departC1.copy(f.departFrom).add(DEPART_C1_OFFSET);
      setPhase(f, 'depart');
    }
  } else if (f.phase === 'depart') {
    f.t += dt;
    const s = Math.min(1, f.t / DEPART_TIME);
    f.progress = s;
    bezier(f.position, f.departFrom, f.departC1, DEPART_C2, DEPART_END, s * s); // accelerates from rest
    if (s >= 1) {
      f.awayDir.copy(DEPART_END).sub(DEPART_C2);
      f.awayDir.y *= 0.5;
      f.awayDir.normalize();
      f.awaySpeed = f.speed;
      setPhase(f, 'away');
    }
  } else {
    f.t += dt;
    f.awaySpeed += (AWAY_SPEED - f.awaySpeed) * (1 - Math.exp(-dt * 0.8));
    f.position.addScaledVector(f.awayDir, f.awaySpeed * dt);
  }

  // Speed and heading come from real motion, so the nose always faces travel
  tmp.subVectors(f.position, f.prevPosition);
  const instSpeed = dt > 0 ? tmp.length() / dt : 0;
  f.speed += (instSpeed - f.speed) * (1 - Math.exp(-dt * 8));

  prevHeading.copy(f.heading);
  if (f.speed > 0.8) {
    tmp.normalize();
    f.heading.lerp(tmp, 1 - Math.exp(-dt * 4)).normalize();
  }
  const turn = dt > 0 ? (prevHeading.z * f.heading.x - prevHeading.x * f.heading.z) / dt : 0;
  const bankTarget = THREE.MathUtils.clamp(-turn * 0.8, -0.45, 0.45);
  f.bank += (bankTarget - f.bank) * (1 - Math.exp(-dt * 4));
}
