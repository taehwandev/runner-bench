// SpaceX-style Falcon booster reuse simulation.
// Pure math and logic with no DOM or Three.js dependencies, so it can be tested in Node.

export const PAD_TOP = 2.2;
export const SEPARATION = 12.0;
export const RETURN_DURATION = 24.0;
export const TOUCHDOWN_TIME = SEPARATION + RETURN_DURATION; // 36.0 seconds
export const LEG_LOCK_SECONDS = 3.2; // legs take this long to lock once deployment starts
const DEFAULT_LEGS_START = 31.0;

// Landing Zone 1 coordinates in scene space.
export const LZ1_COORDS = { x: 24.0, y: 0.6, z: 18.0, radius: 9.0 };

const _clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const _smoothstep = (a, b, x) => {
  const t = _clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Spline keyframes from stage separation (flight = 12s) to touchdown on LZ-1 (flight = 36s).
const _KEYFRAMES = [
  { t: 12.0, p: [-25.5, 60.5, -34.1], v: [-4.64, 6.96, -6.18] },
  { t: 16.0, p: [-32.0, 80.2, -42.0], v: [-1.0, 2.0, -1.5] },
  { t: 23.0, p: [-2.0, 50.2, -5.0],   v: [4.2, -5.5, 3.2] },
  { t: 28.0, p: [17.0, 22.2, 12.5],   v: [2.5, -4.0, 1.8] },
  { t: 36.0, p: [24.0, 0.6, 18.0],    v: [0.0, 0.0, 0.0] },
];

function _interpolateTrajectory(flight) {
  if (flight <= _KEYFRAMES[0].t) {
    const k0 = _KEYFRAMES[0];
    return {
      position: { x: k0.p[0], y: k0.p[1], z: k0.p[2] },
      velocity: { x: k0.v[0], y: k0.v[1], z: k0.v[2] },
    };
  }
  if (flight >= _KEYFRAMES[_KEYFRAMES.length - 1].t) {
    const kEnd = _KEYFRAMES[_KEYFRAMES.length - 1];
    return {
      position: { x: kEnd.p[0], y: kEnd.p[1], z: kEnd.p[2] },
      velocity: { x: 0, y: 0, z: 0 },
    };
  }

  let idx = 0;
  for (let i = 0; i < _KEYFRAMES.length - 1; i++) {
    if (flight >= _KEYFRAMES[i].t && flight <= _KEYFRAMES[i + 1].t) {
      idx = i;
      break;
    }
  }
  const k0 = _KEYFRAMES[idx];
  const k1 = _KEYFRAMES[idx + 1];
  const dt = k1.t - k0.t;
  const s = (flight - k0.t) / dt;
  const s2 = s * s;
  const s3 = s2 * s;

  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;

  const pos = [0, 1, 2].map(
    (dim) => h00 * k0.p[dim] + h10 * dt * k0.v[dim] + h01 * k1.p[dim] + h11 * dt * k1.v[dim]
  );

  const dh00 = (6 * s2 - 6 * s) / dt;
  const dh10 = 3 * s2 - 4 * s + 1;
  const dh01 = (-6 * s2 + 6 * s) / dt;
  const dh11 = 3 * s2 - 2 * s;

  const vel = [0, 1, 2].map(
    (dim) => dh00 * k0.p[dim] + dh10 * k0.v[dim] + dh01 * k1.p[dim] + dh11 * k1.v[dim]
  );

  return {
    position: { x: pos[0], y: pos[1], z: pos[2] },
    velocity: { x: vel[0], y: vel[1], z: vel[2] },
  };
}

// Lateral offsets decided in mission mode: each drift ramps in from its time and is complete at touchdown,
// so the landing point is the nominal pad plus the sum of every drift.
function _drifted(position, flight, drift) {
  let { x, z } = position;
  for (const d of drift) {
    const k = _smoothstep(d.t, TOUCHDOWN_TIME, flight);
    x += d.dx * k;
    z += d.dz * k;
  }
  return { x, y: position.y, z };
}

function _calcPhaseAndThrottle(flight) {
  if (flight >= TOUCHDOWN_TIME) {
    return { phase: 'landed', throttle: 0, rcsActive: false };
  }
  if (flight >= 28.0) {
    let throttle = 0.85;
    if (flight < 29.0) throttle = 0.85 * _smoothstep(28.0, 29.0, flight);
    else if (flight >= 35.0) throttle = 0.85 * (1 - _smoothstep(35.0, 36.0, flight));
    return { phase: 'landing', throttle, rcsActive: flight >= 33.0 && flight <= 35.5 };
  }
  if (flight >= 23.0) {
    return { phase: 'glide', throttle: 0, rcsActive: false };
  }
  if (flight >= 16.0) {
    let throttle = 1.0;
    if (flight < 17.0) throttle = _smoothstep(16.0, 17.0, flight);
    else if (flight >= 22.0) throttle = 1.0 - _smoothstep(22.0, 23.0, flight);
    return { phase: 'braking', throttle, rcsActive: false };
  }
  return { phase: 'flip', throttle: 0, rcsActive: flight >= 12.2 && flight <= 15.6 };
}

function _calcDirection(flight, flipProgress) {
  let dirX = 0, dirY = 1, dirZ = 0;
  if (flight >= TOUCHDOWN_TIME) {
    dirX = 0; dirY = 1; dirZ = 0;
  } else if (flight >= 28.0) {
    const k = _smoothstep(28.0, 35.5, flight);
    dirX = (1 - k) * 0.12;
    dirY = (1 - k) * 0.98 + k * 1.0;
    dirZ = (1 - k) * 0.08;
  } else if (flight >= 23.0) {
    const k = _smoothstep(23.0, 28.0, flight);
    dirX = 0.25 * (1 - k) + 0.12 * k;
    dirY = 0.95 * (1 - k) + 0.98 * k;
    dirZ = 0.18 * (1 - k) + 0.08 * k;
  } else if (flight >= 16.0) {
    dirX = 0.45; dirY = 0.82; dirZ = 0.35;
  } else {
    const f = flipProgress;
    dirX = -0.45 * (1 - f) + 0.45 * f;
    dirY = 0.67 * (1 - f) + 0.82 * f;
    dirZ = -0.60 * (1 - f) + 0.35 * f;
  }
  const l = Math.hypot(dirX, dirY, dirZ);
  return { x: dirX / l, y: dirY / l, z: dirZ / l };
}

export function createBoosterSimulation() {
  let reuseCount = 0;
  let flight = 0;
  let separated = false;
  let plan = {}; // { drift: [{ t, dx, dz }], legsStart } chosen in mission mode; empty means the scripted flight

  function reset() {
    flight = 0;
    separated = false;
  }

  function setPlan(next) {
    plan = next;
  }

  function setReuseCount(count) {
    reuseCount = Math.max(0, count);
  }

  function update(flightTime) {
    flight = Math.max(0, flightTime);
    separated = flight >= SEPARATION;
  }

  function snapshot() {
    if (!separated) {
      return {
        phase: 'attached',
        separated: false,
        landed: false,
        recovered: reuseCount > 0,
        reuseCount,
        throttle: 0,
        flipProgress: 0,
        gridFinsProgress: 0,
        legsProgress: 0,
        rcsActive: false,
        position: { x: 0, y: PAD_TOP, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 1, z: 0 },
        altitudeMeters: 0,
        speedMps: 0,
        landingPad: LZ1_COORDS,
      };
    }

    const { position: nominal, velocity } = _interpolateTrajectory(flight);
    const position = _drifted(nominal, flight, plan.drift || []);
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const speedMps = Math.round(speed * 5);
    const altitudeMeters = Math.max(0, Math.round((position.y - LZ1_COORDS.y) * 5));

    const { phase, throttle, rcsActive } = _calcPhaseAndThrottle(flight);
    const flipProgress = _smoothstep(12.0, 15.8, flight);
    const gridFinsProgress = _smoothstep(13.0, 15.0, flight);
    const legsStart = plan.legsStart ?? DEFAULT_LEGS_START;
    const legsProgress = _smoothstep(legsStart, legsStart + LEG_LOCK_SECONDS, flight);
    const direction = _calcDirection(flight, flipProgress);

    return {
      phase,
      separated: true,
      landed: flight >= TOUCHDOWN_TIME,
      recovered: flight >= TOUCHDOWN_TIME || reuseCount > 0,
      reuseCount,
      throttle,
      flipProgress,
      gridFinsProgress,
      legsProgress,
      rcsActive,
      position,
      velocity,
      direction,
      altitudeMeters,
      speedMps,
      landingPad: LZ1_COORDS,
    };
  }

  return { reset, update, snapshot, setReuseCount, setPlan };
}
