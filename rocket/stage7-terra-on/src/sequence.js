// Launch sequence: countdown, ignition, a scripted ascent, then an orbital mission.
// The upper stage reaches Earth orbit, flies one lap, fires a trans-lunar burn, coasts to the Moon and flies one lap there.
// Pure logic with no DOM or renderer access, so timing and trajectory can be checked on their own.

export const UNITS_TO_METERS = 5; // one scene unit is about 5 m; used only for telemetry labels

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
const HEADING = { x: -0.6, z: -0.8 }; // horizontal direction of travel, unit length
const STEP = 1 / 120; // fixed integration step, so the path does not depend on frame rate

// Mission scale. Bodies are sized to read well in the view, not to real proportions.
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

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Small vector helpers on plain {x, y, z} objects.
const vec = (x, y, z) => ({ x, y, z });
const add = (a, b) => vec(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => vec(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a, k) => vec(a.x * k, a.y * k, a.z * k);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const unit = (a) => scale(a, 1 / len(a));
const assign = (target, v) => {
  target.x = v.x;
  target.y = v.y;
  target.z = v.z;
};

// Circular orbit: centre c, radius r, unit vectors u (radial, at angle 0) and w (tangent, at angle 0).
const ringPoint = (c, r, u, w, theta) => add(c, add(scale(u, r * Math.cos(theta)), scale(w, r * Math.sin(theta))));
const ringTangent = (u, w, theta) => add(scale(u, -Math.sin(theta)), scale(w, Math.cos(theta)));

// Cubic Hermite curve from p0 to p1 with end tangents t0 and t1, sampled so it can be walked by arc length.
function hermite(p0, p1, t0, t1, s) {
  const s2 = s * s;
  const s3 = s2 * s;
  return add(
    add(scale(p0, 2 * s3 - 3 * s2 + 1), scale(t0, s3 - 2 * s2 + s)),
    add(scale(p1, -2 * s3 + 3 * s2), scale(t1, s3 - s2)),
  );
}

function hermiteTangent(p0, p1, t0, t1, s) {
  const s2 = s * s;
  return add(
    add(scale(p0, 6 * s2 - 6 * s), scale(t0, 3 * s2 - 4 * s + 1)),
    add(scale(p1, -6 * s2 + 6 * s), scale(t1, 3 * s2 - 2 * s)),
  );
}

function buildTransfer(p0, p1, tangent, endTangent = tangent) {
  const k = len(sub(p1, p0)) * 0.5;
  const t0 = scale(tangent, k);
  const t1 = scale(endTangent, k);
  const points = [p0];
  const cum = [0];
  for (let i = 1; i <= TRANSFER_SAMPLES; i++) {
    const p = hermite(p0, p1, t0, t1, i / TRANSFER_SAMPLES);
    cum.push(cum[i - 1] + len(sub(p, points[i - 1])));
    points.push(p);
  }
  return { p0, p1, t0, t1, points, cum, length: cum[TRANSFER_SAMPLES] };
}

// Point and heading after travelling `distance` along the transfer, found by binary search over the arc-length table.
function sampleTransfer(path, distance) {
  const d = clamp(distance, 0, path.length);
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
    position: hermite(path.p0, path.p1, path.t0, path.t1, s),
    direction: unit(hermiteTangent(path.p0, path.p1, path.t0, path.t1, s)),
  };
}

export function createSequence() {
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
  let mission = null; // fixed geometry, built once the upper stage takes over
  const position = vec(0, 0, 0); // y is altitude above the launch mount
  const direction = vec(0, 1, 0);

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
    mission = null;
    assign(position, vec(0, 0, 0));
    assign(direction, UP);
  }

  function placeOnEarthOrbit() {
    const { center, orbitRadius, u, w } = mission.earth;
    assign(position, ringPoint(center, orbitRadius, u, w, theta));
    assign(direction, unit(ringTangent(u, w, theta)));
  }

  function placeOnMoonOrbit() {
    const { center, orbitRadius, n, a } = mission.moon;
    assign(position, ringPoint(center, orbitRadius, n, a, theta));
    assign(direction, unit(ringTangent(n, a, theta)));
  }

  function placeOnTransfer() {
    const sample = sampleTransfer(transfer.path, travelled);
    assign(position, sample.position);
    assign(direction, sample.direction);
  }

  // Upper stage takes over at the end of the ascent. The mission geometry is fixed here so every later
  // phase joins its predecessor in position, heading and (apart from the burns) speed.
  function beginMission() {
    const p0 = vec(position.x, position.y, position.z);
    const axis = vec(direction.x, direction.y, direction.z); // heading at the end of the ascent
    // Radial direction perpendicular to the heading, so the Earth orbit is tangent to the flight path.
    const u = unit(sub(UP, scale(axis, dot(UP, axis))));
    const earthCenter = sub(p0, scale(u, ORBIT_RADIUS));
    // Moon lies ahead along the heading. Its lunar orbit is spanned by the Earth-Moon axis and an up-facing
    // normal, and the transfer arrives at the top of that orbit moving along the axis, so the lap joins smoothly.
    const moonCenter = add(earthCenter, scale(axis, MOON_DISTANCE));
    const moonUp = unit(sub(UP, scale(axis, dot(UP, axis))));
    const arrival = add(moonCenter, scale(moonUp, MOON_ORBIT_RADIUS));
    const path = buildTransfer(p0, arrival, axis);
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
    const v0 = TLI_BOOST * ORBIT_SPEED;
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
      throttle = smoothstep(0, IGNITION_SECONDS, ignition);
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

    if (phase === 'ascent') {
      // Straight climb, then a gravity-turn style pitch-over. The pitch never reaches 90 degrees,
      // so the rocket keeps gaining altitude for the whole flight.
      const pitch = MAX_PITCH * (1 - Math.exp(-Math.max(0, flight - PITCH_DELAY) / PITCH_TIME));
      speed = SPEED_0 + SPEED_GAIN * flight;
      throttle = flight < SEPARATION
        ? 1 - smoothstep(SEPARATION - 1, SEPARATION, flight)
        : smoothstep(SEPARATION, SEPARATION + 1, flight) * (1 - smoothstep(BURNOUT, BURNOUT + 4, flight));
      const sin = Math.sin(pitch);
      assign(direction, vec(HEADING.x * sin, Math.cos(pitch), HEADING.z * sin));
      position.x += direction.x * speed * dt;
      position.y += direction.y * speed * dt;
      position.z += direction.z * speed * dt;
      if (flight >= FLIGHT_END) beginMission();
      return;
    }

    if (phase === 'insertion') {
      // Upper stage burns to speed up to orbital speed, still on the same circle.
      const k = smoothstep(0, INSERTION_SECONDS, phaseTime);
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
      const v0 = TLI_BOOST * ORBIT_SPEED;
      const v1 = MOON_SPEED;
      const f = clamp(travelled / path.length, 0, 1);
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
        const destination = add(mission.earth.center, scale(radial, EARTH_RADIUS + 80));
        const path = buildTransfer({ ...position }, destination, { ...direction }, scale(radial, -1));
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

    if (phase === 'reentry' || phase === 'parachute') {
      const radial = mission.earth.u;
      const duration = phase === 'reentry' ? 8 : 12;
      const start = phase === 'reentry' ? 80 : 24;
      const end = phase === 'reentry' ? 24 : 1.5;
      const t = clamp(phaseTime / duration, 0, 1);
      const altitude = start + (end - start) * t;
      assign(position, add(mission.earth.center, scale(radial, EARTH_RADIUS + altitude)));
      assign(direction, radial);
      speed = (start - end) / duration;
      throttle = 0;
      if (t >= 1) {
        phase = phase === 'reentry' ? 'parachute' : 'departed';
        phaseTime = 0;
        if (phase === 'departed') speed = 0;
      }
    }
  }

  function start() {
    if (phase !== 'ready' && phase !== 'departed') return;
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
    };
  }

  return { start, reset, update, snapshot };
}
