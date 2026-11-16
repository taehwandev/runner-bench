// Launch sequence: countdown, ignition and a scripted ascent.
// Pure logic with no DOM or renderer access, so timing and trajectory can be checked on their own.

export const UNITS_TO_METERS = 5; // one scene unit is about 5 m; used only for telemetry labels

const COUNTDOWN_SECONDS = 5;
const IGNITION_SECONDS = 2;
const PITCH_DELAY = 1.5; // seconds of straight climb before the pitch-over starts
const PITCH_TIME = 4.5; // time constant of the pitch-over
const MAX_PITCH = (78 * Math.PI) / 180; // below 90 degrees, so the vertical component never goes negative
const BURNOUT = 28; // engine cutoff, seconds after liftoff
const FLIGHT_END = 34; // after this the rocket coasts away on its last heading
const SPEED_0 = 2; // scene units per second at liftoff
const SPEED_GAIN = 0.7; // speed gained per second of flight
const COAST_DECAY = 0.02; // speed decay per second after burnout
const HEADING = { x: -0.6, z: -0.8 }; // horizontal direction of travel, unit length
const STEP = 1 / 120; // fixed integration step, so the path does not depend on frame rate

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createSequence() {
  let phase = 'ready';
  let countdown = COUNTDOWN_SECONDS;
  let ignition = 0;
  let flight = 0;
  let throttle = 0;
  let speed = 0;
  let acc = 0;
  const position = { x: 0, y: 0, z: 0 }; // y is altitude above the launch mount
  const direction = { x: 0, y: 1, z: 0 };

  function reset() {
    phase = 'ready';
    countdown = COUNTDOWN_SECONDS;
    ignition = 0;
    flight = 0;
    throttle = 0;
    speed = 0;
    acc = 0;
    position.x = position.y = position.z = 0;
    direction.x = direction.z = 0;
    direction.y = 1;
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

    if (phase !== 'ascent' && phase !== 'departed') return;

    flight += dt;
    if (phase === 'ascent') {
      // Straight climb, then a gravity-turn style pitch-over. The pitch never reaches 90 degrees,
      // so the rocket keeps gaining altitude for the whole flight.
      const pitch = MAX_PITCH * (1 - Math.exp(-Math.max(0, flight - PITCH_DELAY) / PITCH_TIME));
      speed = SPEED_0 + SPEED_GAIN * flight;
      throttle = 1 - smoothstep(BURNOUT, BURNOUT + 4, flight);
      const sin = Math.sin(pitch);
      direction.x = HEADING.x * sin;
      direction.y = Math.cos(pitch);
      direction.z = HEADING.z * sin;
      if (flight >= FLIGHT_END) phase = 'departed';
    } else {
      // Engines are off. The rocket keeps its last heading and slowly loses speed, so it moves away
      // instead of falling back.
      speed *= Math.exp(-COAST_DECAY * dt);
      throttle = 0;
    }

    position.x += direction.x * speed * dt;
    position.y += direction.y * speed * dt;
    position.z += direction.z * speed * dt;
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
      throttle,
      speed,
      position: { ...position },
      direction: { ...direction },
    };
  }

  return { start, reset, update, snapshot };
}
