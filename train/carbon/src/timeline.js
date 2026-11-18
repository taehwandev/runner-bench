// Fixed 60-second timetable, analytical train kinematics, and 8-shot schedule.
// Speed v(t) is integrated analytically into distance s(t) so ds/dt === v(t).

const DURATION = 60.0;
const CRUISE_SPEED = 28.0; // m/s during 0..24s -> 672m at 24s
const EXPRESS_SPEED = 36.0; // m/s after 40s -> covers 216m during 40..46s
const CAR_COUNT = 9; // 1 armored locomotive + 9 armored cars (>= 8 cars)
const TRAIN_LENGTH = 120.0; // Front nose at s, tail bumper at s - 120m

const STATION_START_S = 626.0;
const STATION_END_S = 768.0;
const STATION_STOP_S = 756.0;
const TUNNEL_START_S = 863.9;
const TUNNEL_END_S = 959.9;
const BRIDGE_START_S = 960.0;
const BRIDGE_END_S = 1760.0;

const SHOTS = [
  { id: 1, start: 0.0, end: 9.0, title: "Canyon Dusk" },
  { id: 2, start: 9.0, end: 17.0, title: "Armored Flank" },
  { id: 3, start: 17.0, end: 24.0, title: "Viaduct Overhead" },
  { id: 4, start: 24.0, end: 34.0, title: "Sector 04 Station" },
  { id: 5, start: 34.0, end: 40.0, title: "Monolith Approach" },
  { id: 6, start: 40.0, end: 43.0, title: "Tunnel Bore" },
  { id: 7, start: 43.0, end: 46.0, title: "Portal Emergence" },
  { id: 8, start: 46.0, end: 60.0, title: "Night Bridge" },
];

function clampTime(rawT) {
  const n = Number(rawT);
  if (!Number.isFinite(n)) return 0;
  return Math.min(DURATION, Math.max(0, n));
}

function evalKinematics(t) {
  if (t <= 24.0) {
    return { distance: CRUISE_SPEED * t, speed: CRUISE_SPEED, braking: 0 };
  }
  if (t < 30.0) {
    const u = (t - 24.0) / 6.0;
    const u2 = u * u;
    const u3 = u2 * u;
    const speed = CRUISE_SPEED * (1 - 3 * u2 + 2 * u3);
    const distance = 672.0 + 6.0 * CRUISE_SPEED * (u - u3 + 0.5 * u2 * u2);
    const braking = Math.sin(Math.PI * u);
    return { distance, speed, braking };
  }
  if (t <= 34.0) {
    return { distance: STATION_STOP_S, speed: 0, braking: 0 };
  }
  if (t < 40.0) {
    const u = (t - 34.0) / 6.0;
    const u2 = u * u;
    const u3 = u2 * u;
    const speed = EXPRESS_SPEED * (3 * u2 - 2 * u3);
    const distance = STATION_STOP_S + 6.0 * EXPRESS_SPEED * (u3 - 0.5 * u2 * u2);
    return { distance, speed, braking: 0 };
  }
  const distance = 864.0 + EXPRESS_SPEED * (t - 40.0);
  return { distance, speed: EXPRESS_SPEED, braking: 0 };
}

function findShot(t) {
  for (let i = SHOTS.length - 1; i >= 0; i--) {
    if (t >= SHOTS[i].start) return SHOTS[i];
  }
  return SHOTS[0];
}

function describePhase(t, atStation, inTunnel) {
  if (t < 24.0) return "Viaduct";
  if (t < 30.0) return "Braking";
  if (atStation || t <= 34.0) return "At Station";
  if (t < 40.0) return "Departing";
  if (inTunnel) return "In Tunnel";
  return "Night Bridge";
}

export function createTimeline() {
  return {
    duration: DURATION,
    carCount: CAR_COUNT,
    trainLength: TRAIN_LENGTH,
    shots: SHOTS,
    landmarks: {
      stationStart: STATION_START_S,
      stationEnd: STATION_END_S,
      stationStop: STATION_STOP_S,
      tunnelStart: TUNNEL_START_S,
      tunnelEnd: TUNNEL_END_S,
      bridgeStart: BRIDGE_START_S,
      bridgeEnd: BRIDGE_END_S,
    },
    clampTime,
    getStateAtTime(rawT) {
      const time = clampTime(rawT);
      const { distance, speed, braking } = evalKinematics(time);
      const tailDistance = distance - TRAIN_LENGTH;
      const atStation =
        Math.abs(distance - STATION_STOP_S) <= 0.6 && time >= 29.3 && time <= 34.7;
      const inTunnel =
        distance >= TUNNEL_START_S && tailDistance < TUNNEL_END_S;
      const shotObj = findShot(time);

      return {
        time,
        shot: shotObj.id,
        shotInfo: shotObj,
        phaseLabel: describePhase(time, atStation, inTunnel),
        braking,
        train: {
          distance: Number(distance.toFixed(4)),
          speed: speed === 0 ? 0 : Number(speed.toFixed(4)),
          cars: CAR_COUNT,
          atStation,
          inTunnel,
        },
        exactDistance: distance,
        exactSpeed: speed,
      };
    },
    getNextShotTime(rawT) {
      const time = clampTime(rawT);
      const current = findShot(time);
      const nextIndex = current.id % SHOTS.length;
      return SHOTS[nextIndex].start;
    },
    getPrevShotTime(rawT) {
      const time = clampTime(rawT);
      const current = findShot(time);
      if (time - current.start > 1.2) return current.start;
      const prevIndex = (current.id - 2 + SHOTS.length) % SHOTS.length;
      return SHOTS[prevIndex].start;
    },
  };
}
