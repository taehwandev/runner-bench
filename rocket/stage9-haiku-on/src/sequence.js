// Launch sequence: countdown, ignition, a scripted ascent, then an orbital mission.
// The upper stage reaches Earth orbit, flies one lap, fires a trans-lunar burn, coasts to the Moon and flies one lap there.
// Pure logic with no DOM or renderer access, so timing and trajectory can be checked on their own.

import { createBoosterSimulation, TOUCHDOWN_TIME, LZ1_COORDS } from './booster.js';

export { TOUCHDOWN_TIME, LZ1_COORDS };
export const UNITS_TO_METERS = 5; // one scene _unit is about 5 m; used only for telemetry labels

const COUNTDOWN_SECONDS = 5;
const IGNITION_SECONDS = 2;
const PITCH_DELAY = 1.5; // seconds of straight climb before the pitch-over starts
const PITCH_TIME = 4.5; // time constant of the pitch-over
const MAX_PITCH = (55 * Math.PI) / 180; // below 90 degrees, so the vertical component never goes negative
export const SEPARATION = 12; // seconds after liftoff, after the tower is cleared
const BURNOUT = 55; // engine cutoff, seconds after liftoff
const FLIGHT_END = 62; // ascent ends here; the upper stage takes over for the mission
const SPEED_0 = 2; // scene units per second at liftoff
const SPEED_GAIN = 0.7; // speed gained per second of flight
const HEADING = { x: -0.6, z: -0.8 }; // horizontal direction of travel, _unit length
const STEP = 1 / 120; // fixed integration step, so the path does not depend on frame rate

// Mission _scale. Bodies are sized to read well in the view, not to real proportions.
export const EARTH_RADIUS = 400;
export const MOON_RADIUS = 110;
const MOON_DISTANCE = 1900; // Earth centre to Moon centre
const ORBIT_ALTITUDE = 120; // Earth orbit sits this far above the surface
const MOON_ORBIT_ALTITUDE = 40;
const ORBIT_RADIUS = EARTH_RADIUS + ORBIT_ALTITUDE;
const MOON_ORBIT_RADIUS = MOON_RADIUS + MOON_ORBIT_ALTITUDE;
const INSERTION_SECONDS = 6; // upper stage speeds up from ascent speed to orbital speed
const EARTH_LAP_SECONDS = 36;
const MOON_LAP_SECONDS = 24;
const EARTH_OMEGA = (2 * Math.PI) / EARTH_LAP_SECONDS;
const MOON_OMEGA = (2 * Math.PI) / MOON_LAP_SECONDS;
const ORBIT_SPEED = ORBIT_RADIUS * EARTH_OMEGA;
const MOON_SPEED = MOON_ORBIT_RADIUS * MOON_OMEGA;
const TLI_BOOST = 1.45; // speed just after trans-lunar injection, relative to orbital speed
const BURN_SECONDS = 3; // length of the TLI and LOI burns, at either end of the transfer
const TRANSFER_SAMPLES = 400;
const TAU = Math.PI * 2;
const UP = { x: 0, y: 1, z: 0 };

// Capsule return: it falls from REENTRY_TOP to the canopy altitude, which defaults to DEFAULT_CHUTE_ALTITUDE.
// A canopy opened higher takes longer to bring the capsule down, so CHUTE_SECONDS scales with its altitude.
const REENTRY_TOP = 80;
const REENTRY_SECONDS = 8;
const DEFAULT_CHUTE_ALTITUDE = 24;
const CHUTE_END = 1.5; // altitude at splashdown
const CHUTE_SECONDS = 12; // descent time from DEFAULT_CHUTE_ALTITUDE

const _smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const _clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Small vector helpers on plain {x, y, z} objects.
const _vec = (x, y, z) => ({ x, y, z });
const _add = (a, b) => _vec(a.x + b.x, a.y + b.y, a.z + b.z);
const _sub = (a, b) => _vec(a.x - b.x, a.y - b.y, a.z - b.z);
const _scale = (a, k) => _vec(a.x * k, a.y * k, a.z * k);
const _dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const _len = (a) => Math.hypot(a.x, a.y, a.z);
const _unit = (a) => _scale(a, 1 / _len(a));
const _assign = (target, v) => {
  target.x = v.x;
  target.y = v.y;
  target.z = v.z;
};

// Circular orbit: centre c, radius r, _unit vectors u (radial, at angle 0) and w (tangent, at angle 0).
const _ringPoint = (c, r, u, w, theta) => _add(c, _add(_scale(u, r * Math.cos(theta)), _scale(w, r * Math.sin(theta))));
const _ringTangent = (u, w, theta) => _add(_scale(u, -Math.sin(theta)), _scale(w, Math.cos(theta)));

// Cubic Hermite curve from p0 to p1 with end tangents t0 and t1, sampled so it can be walked by arc length.
function _hermite(p0, p1, t0, t1, s) {
  const s2 = s * s;
  const s3 = s2 * s;
  return _add(
    _add(_scale(p0, 2 * s3 - 3 * s2 + 1), _scale(t0, s3 - 2 * s2 + s)),
    _add(_scale(p1, -2 * s3 + 3 * s2), _scale(t1, s3 - s2)),
  );
}

function _hermiteTangent(p0, p1, t0, t1, s) {
  const s2 = s * s;
  return _add(
    _add(_scale(p0, 6 * s2 - 6 * s), _scale(t0, 3 * s2 - 4 * s + 1)),
    _add(_scale(p1, -6 * s2 + 6 * s), _scale(t1, 3 * s2 - 2 * s)),
  );
}

function _buildTransfer(p0, p1, tangent, endTangent = tangent) {
  const k = _len(_sub(p1, p0)) * 0.5;
  const t0 = _scale(tangent, k);
  const t1 = _scale(endTangent, k);
  const points = [p0];
  const cum = [0];
  for (let i = 1; i <= TRANSFER_SAMPLES; i++) {
    const p = _hermite(p0, p1, t0, t1, i / TRANSFER_SAMPLES);
    cum.push(cum[i - 1] + _len(_sub(p, points[i - 1])));
    points.push(p);
  }
  return { p0, p1, t0, t1, points, cum, length: cum[TRANSFER_SAMPLES] };
}

// Point and heading after travelling `distance` along the transfer, found by binary search over the arc-length table.
function _sampleTransfer(path, distance) {
  const d = _clamp(distance, 0, path.length);
  let lo = 0;
  let hi = TRANSFER_SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path.cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const f = (d - path.cum[lo]) / (path.cum[hi] - path.cum[lo]);
  const s = (lo + f) / TRANSFER_SAMPLES;
  return {
    position: _hermite(path.p0, path.p1, path.t0, path.t1, s),
    direction: _unit(_hermiteTangent(path.p0, path.p1, path.t0, path.t1, s)),
  };
}

export function createSequence() {
  const booster = createBoosterSimulation();
  let reuseCount = 0;
  let phase = 'ready';
  let countdown = COUNTDOWN_SECONDS;
  let ignition = 0;
  let flight = 0;
  let phaseTime = 0; // seconds since the current mission phase began
  let throttle = 0;
  let speed = 0;
  let acc = 0;
  let theta = 0; // angle along the current circular orbit
  let omega0 = 0; // angular speed when the upper stage takes over
  let travelled = 0; // distance flown along the trans-lunar transfer
  let transfer = null; // { path, duration }
  let transferV0 = TLI_BOOST * ORBIT_SPEED; // speed at the start of the trans-lunar transfer
  let chuteFrom = DEFAULT_CHUTE_ALTITUDE; // altitude the canopy opened at
  let chuteSeconds = CHUTE_SECONDS;
  let mission = null; // fixed geometry, built once the upper stage takes over
  let plan = {}; // choices made in mission mode; empty means the scripted flight
  const position = _vec(0, 0, 0); // y is altitude above the launch mount
  const direction = _vec(0, 1, 0);

  function reset() {
    phase = 'ready';
    countdown = COUNTDOWN_SECONDS;
    ignition = 0;
    flight = 0;
    phaseTime = 0;
    throttle = 0;
    speed = 0;
    acc = 0;
    theta = 0;
    omega0 = 0;
    travelled = 0;
    transfer = null;
    transferV0 = TLI_BOOST * ORBIT_SPEED;
    chuteFrom = DEFAULT_CHUTE_ALTITUDE;
    chuteSeconds = CHUTE_SECONDS;
    mission = null;
    plan = {};
    _assign(position, _vec(0, 0, 0));
    _assign(direction, UP);
    booster.reset();
    booster.setPlan(plan);
    booster.setReuseCount(reuseCount);
  }

  // Merge choices made since the last call. Only the fields the sequence reads matter: drift, legsStart,
  // tliBoost, chuteAltitude and boosterFailed.
  function setPlan(next) {
    plan = { ...plan, ...next };
    booster.setPlan(plan);
  }

  // A recovered booster counts toward the next flight; a booster lost on landing does not.
  function countsAsRecovered(boosterSnap) {
    return boosterSnap.landed && plan.boosterFailed !== true;
  }

  function placeOnEarthOrbit() {
    const { center, orbitRadius, u, w } = mission.earth;
    _assign(position, _ringPoint(center, orbitRadius, u, w, theta));
    _assign(direction, _unit(_ringTangent(u, w, theta)));
  }

  function placeOnMoonOrbit() {
    const { center, orbitRadius, n, a } = mission.moon;
    _assign(position, _ringPoint(center, orbitRadius, n, a, theta));
    _assign(direction, _unit(_ringTangent(n, a, theta)));
  }

  function placeOnTransfer() {
    const sample = _sampleTransfer(transfer.path, travelled);
    _assign(position, sample.position);
    _assign(direction, sample.direction);
  }

  // Upper stage takes over at the end of the ascent. The mission geometry is fixed here so every later
  // phase joins its predecessor in position, heading and (apart from the burns) speed.
  function beginMission() {
    const p0 = _vec(position.x, position.y, position.z);
    const axis = _vec(direction.x, direction.y, direction.z); // heading at the end of the ascent
    // Radial direction perpendicular to the heading, so the Earth orbit is tangent to the flight path.
    const u = _unit(_sub(UP, _scale(axis, _dot(UP, axis))));
    const earthCenter = _sub(p0, _scale(u, ORBIT_RADIUS));
    // Moon lies ahead along the heading. Its lunar orbit is spanned by the Earth-Moon axis and an up-facing
    // normal, and the transfer arrives at the top of that orbit moving along the axis, so the lap joins smoothly.
    const moonCenter = _add(earthCenter, _scale(axis, MOON_DISTANCE));
    const moonUp = _unit(_sub(UP, _scale(axis, _dot(UP, axis))));
    const arrival = _add(moonCenter, _scale(moonUp, MOON_ORBIT_RADIUS));
    const path = _buildTransfer(p0, arrival, axis);
    mission = {
      earth: { center: earthCenter, radius: EARTH_RADIUS, orbitRadius: ORBIT_RADIUS, u, w: axis },
      moon: { center: moonCenter, radius: MOON_RADIUS, orbitRadius: MOON_ORBIT_RADIUS, n: moonUp, a: axis },
      transferPoints: path.points,
    };
    transfer = { path, duration: 0 };
    omega0 = speed / ORBIT_RADIUS;
    theta = 0;
    phase = 'insertion';
    phaseTime = 0;
  }

  // `carry` is distance already flown past the join in the previous phase, so no step is lost there.
  function startTransfer(carry) {
    const { path } = transfer;
    const v0 = (plan.tliBoost ?? TLI_BOOST) * ORBIT_SPEED;
    transferV0 = v0;
    const v1 = MOON_SPEED;
    // Integral of L / v(x) over the path, with v linear from v0 to v1.
    transfer.duration = (path.length / (v1 - v0)) * Math.log(v1 / v0);
    travelled = carry;
    phase = 'transfer';
    phaseTime = 0;
  }

  function startLunarOrbit(carry) {
    theta = carry / MOON_ORBIT_RADIUS;
    phase = 'lunar';
    phaseTime = 0;
  }

  function tick(dt) {
    if (phase === 'countdown') {
      countdown -= dt;
      if (countdown <= 0) {
        phase = 'ignition';
        ignition = -countdown;
        countdown = 0;
      }
      return;
    }

    if (phase === 'ignition') {
      // Thrust builds while the rocket is still held on the mount.
      ignition += dt;
      throttle = _smoothstep(0, IGNITION_SECONDS, ignition);
      if (ignition >= IGNITION_SECONDS) {
        phase = 'ascent';
        flight = 0;
        throttle = 1;
      }
      return;
    }

    if (phase === 'ready' || phase === 'departed') return;

    flight += dt;
    phaseTime += dt;
    booster.update(flight);

    if (phase === 'ascent') {
      // Straight climb, then a gravity-turn style pitch-over. The pitch never reaches 90 degrees,
      // so the rocket keeps gaining altitude for the whole flight.
      const pitch = MAX_PITCH * (1 - Math.exp(-Math.max(0, flight - PITCH_DELAY) / PITCH_TIME));
      speed = SPEED_0 + SPEED_GAIN * flight;
      throttle = flight < SEPARATION
        ? 1 - _smoothstep(SEPARATION - 1, SEPARATION, flight)
        : _smoothstep(SEPARATION, SEPARATION + 1, flight) * (1 - _smoothstep(BURNOUT, BURNOUT + 4, flight));
      const sin = Math.sin(pitch);
      _assign(direction, _vec(HEADING.x * sin, Math.cos(pitch), HEADING.z * sin));
      position.x += direction.x * speed * dt;
      position.y += direction.y * speed * dt;
      position.z += direction.z * speed * dt;
      if (flight >= FLIGHT_END) beginMission();
      return;
    }

    if (phase === 'insertion') {
      // Upper stage burns to speed up to orbital speed, still on the same circle.
      const k = _smoothstep(0, INSERTION_SECONDS, phaseTime);
      const omega = omega0 + (EARTH_OMEGA - omega0) * k;
      theta += omega * dt;
      speed = ORBIT_RADIUS * omega;
      throttle = 0.8;
      placeOnEarthOrbit();
      if (phaseTime >= INSERTION_SECONDS) phase = 'orbit';
      return;
    }

    if (phase === 'orbit') {
      // One full lap of Earth. The lap ends back at the insertion point, where the trans-lunar burn starts.
      theta += EARTH_OMEGA * dt;
      speed = ORBIT_SPEED;
      throttle = 0;
      placeOnEarthOrbit();
      if (theta >= TAU) startTransfer((theta - TAU) * ORBIT_RADIUS);
      return;
    }

    if (phase === 'transfer') {
      // Speed falls linearly from the trans-lunar boost to lunar orbital speed. The engine fires at both ends.
      const { duration, path } = transfer;
      const v0 = transferV0;
      const v1 = MOON_SPEED;
      const f = _clamp(travelled / path.length, 0, 1);
      speed = v0 + (v1 - v0) * f;
      throttle = phaseTime < BURN_SECONDS || phaseTime > duration - BURN_SECONDS ? 1 : 0;
      travelled += speed * dt;
      if (travelled >= path.length) {
        startLunarOrbit(travelled - path.length);
        placeOnMoonOrbit();
        return;
      }
      placeOnTransfer();
      return;
    }

    if (phase === 'lunar') {
      // Complete one lap before firing for Earth.
      theta += MOON_OMEGA * dt;
      speed = MOON_SPEED;
      throttle = 0;
      if (theta >= TAU) {
        placeOnMoonOrbit();
        const radial = mission.earth.u;
        const destination = _add(mission.earth.center, _scale(radial, EARTH_RADIUS + 80));
        const path = _buildTransfer({ ...position }, destination, { ...direction }, _scale(radial, -1));
        transfer = { path, duration: path.length / 105 };
        travelled = 0;
        phase = 'return';
        phaseTime = 0;
        return;
      }
      placeOnMoonOrbit();
      return;
    }

    if (phase === 'return') {
      speed = 105;
      throttle = phaseTime < BURN_SECONDS ? 1 : 0;
      travelled = Math.min(transfer.path.length, travelled + speed * dt);
      placeOnTransfer();
      if (travelled >= transfer.path.length) {
        phase = 'reentry';
        phaseTime = 0;
      }
      return;
    }

    if (phase === 'reentry') {
      // The canopy opens as the falling capsule reaches the chosen altitude.
      const deployAt = plan.chuteAltitude ?? DEFAULT_CHUTE_ALTITUDE;
      const t = _clamp(phaseTime / REENTRY_SECONDS, 0, 1);
      const altitude = REENTRY_TOP + (DEFAULT_CHUTE_ALTITUDE - REENTRY_TOP) * t;
      _assign(position, _add(mission.earth.center, _scale(mission.earth.u, EARTH_RADIUS + altitude)));
      _assign(direction, mission.earth.u);
      speed = (REENTRY_TOP - DEFAULT_CHUTE_ALTITUDE) / REENTRY_SECONDS;
      throttle = 0;
      if (altitude <= deployAt) {
        phase = 'parachute';
        phaseTime = 0;
        chuteFrom = altitude;
        chuteSeconds = CHUTE_SECONDS * (altitude - CHUTE_END) / (DEFAULT_CHUTE_ALTITUDE - CHUTE_END);
      }
      return;
    }

    if (phase === 'parachute') {
      const t = _clamp(phaseTime / chuteSeconds, 0, 1);
      const altitude = chuteFrom + (CHUTE_END - chuteFrom) * t;
      _assign(position, _add(mission.earth.center, _scale(mission.earth.u, EARTH_RADIUS + altitude)));
      _assign(direction, mission.earth.u);
      speed = (chuteFrom - CHUTE_END) / chuteSeconds;
      throttle = 0;
      if (t >= 1) {
        phase = 'departed';
        phaseTime = 0;
        speed = 0;
      }
    }
  }

  function start() {
    const boosterSnap = booster.snapshot();
    const canStart = phase === 'ready' || phase === 'departed' || boosterSnap.landed;
    if (!canStart) return;
    if (countsAsRecovered(boosterSnap)) reuseCount += 1;
    reset();
    phase = 'countdown';
  }

  function relaunch() {
    const boosterSnap = booster.snapshot();
    if (countsAsRecovered(boosterSnap)) reuseCount += 1;
    reset();
    phase = 'countdown';
  }

  function update(frameDt) {
    acc += Math.min(frameDt, 0.25);
    while (acc >= STEP) {
      tick(STEP);
      acc -= STEP;
    }
  }

  function snapshot() {
    return {
      phase,
      countdown,
      flight,
      separated: flight >= SEPARATION,
      throttle,
      capsule: phase === 'reentry' || phase === 'parachute' || phase === 'departed',
      phaseTime,
      speed,
      position: { ...position },
      direction: { ...direction },
      earth: mission ? mission.earth : null,
      moon: mission ? mission.moon : null,
      transferPoints: mission ? mission.transferPoints : null,
      booster: booster.snapshot(),
      reuseCount,
    };
  }

  return { start, relaunch, reset, update, snapshot, setPlan };
}
