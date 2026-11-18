import { clamp, lerp, smoothstep, smootherstep, easeInOutSine } from './prng.js';

export const DURATION = 60.0;

// Train physical dimensions (meters)
export const CAR_COUNT = 9; // 9 armored cars + 1 locomotive = 10 rail vehicles
export const LOCO_LENGTH = 17.5;
export const CAR_LENGTH = 12.2;
export const CAR_GAP = 0.7;
export const CAR_PITCH = CAR_LENGTH + CAR_GAP;
export const TRAIN_LENGTH = LOCO_LENGTH + CAR_COUNT * CAR_PITCH; // 133.6 m

// Track & landmark distances (arc-length meters along track)
export const DECK_Y = 24.0;
export const TRACK_MIN_S = -240;
export const TRACK_MAX_S = 2250;

export const V_CRUISE = 32.0; // 0-24 s cruise speed (m/s)
export const V_FAST = 44.0;   // 40-60 s tunnel & bridge speed (m/s)

export const STATION_STOP_S = 864.0;  // Exact analytical stop position at t=30..34
export const STATION_START_S = 716.0;
export const STATION_END_S = 892.0;

export const TUNNEL_START_S = 996.0;  // Exact nose entry at t=40.0
export const TUNNEL_END_S = 1260.0;   // Exact nose exit at t=46.0

export const BRIDGE_START_S = 1260.0;
export const BRIDGE_END_S = 2220.0;
export const BRIDGE_PYLONS_S = [1480.0, 1800.0];

// ---------------------------------------------------------------------------
// Analytical Track Centerline (exact arc-length parameterized lookup)
// Gentle S-curve through the city canyon (s < 670), dead straight through
// the station, monolith tower tunnel, and long suspension bridge (s >= 670).
// ---------------------------------------------------------------------------
function rawCurveX(z) {
  if (z >= 670) return 0;
  const fade = smootherstep(670, 390, z);
  return 20.0 * Math.sin(z * 0.0082) * fade;
}

const LUT_STEP = 1.0; // 1 meter arc-length resolution
const LUT_COUNT = Math.ceil((TRACK_MAX_S - TRACK_MIN_S) / LUT_STEP) + 2;
const trackXArr = new Float32Array(LUT_COUNT);
const trackZArr = new Float32Array(LUT_COUNT);
const trackYawArr = new Float32Array(LUT_COUNT);

(function buildTrackLUT() {
  // First integrate forward from z = 0 to s = TRACK_MAX_S, and backward to TRACK_MIN_S
  // using fine 0.1m steps in z so arc-length s=0 corresponds to z=0.
  const dz = 0.05;
  const zeroIdx = Math.round((0 - TRACK_MIN_S) / LUT_STEP);

  // Fill s >= 0
  let s = 0;
  let z = 0;
  let prevX = rawCurveX(0);
  let targetIdx = zeroIdx;
  trackXArr[zeroIdx] = prevX;
  trackZArr[zeroIdx] = 0;

  while (targetIdx < LUT_COUNT - 1) {
    const nextZ = z + dz;
    const nextX = rawCurveX(nextZ);
    const segLen = Math.hypot(nextX - prevX, dz);
    const nextS = s + segLen;
    while (targetIdx + 1 < LUT_COUNT && nextS >= (targetIdx + 1 - zeroIdx) * LUT_STEP) {
      targetIdx++;
      const wantS = (targetIdx - zeroIdx) * LUT_STEP;
      const frac = segLen > 0 ? (wantS - s) / segLen : 0;
      trackXArr[targetIdx] = lerp(prevX, nextX, frac);
      trackZArr[targetIdx] = lerp(z, nextZ, frac);
    }
    s = nextS;
    z = nextZ;
    prevX = nextX;
  }

  // Fill s < 0
  s = 0;
  z = 0;
  prevX = rawCurveX(0);
  targetIdx = zeroIdx;
  while (targetIdx > 0) {
    const nextZ = z - dz;
    const nextX = rawCurveX(nextZ);
    const segLen = Math.hypot(nextX - prevX, dz);
    const nextS = s - segLen;
    while (targetIdx - 1 >= 0 && nextS <= (targetIdx - 1 - zeroIdx) * LUT_STEP) {
      targetIdx--;
      const wantS = (targetIdx - zeroIdx) * LUT_STEP;
      const frac = segLen > 0 ? (s - wantS) / segLen : 0;
      trackXArr[targetIdx] = lerp(prevX, nextX, frac);
      trackZArr[targetIdx] = lerp(z, nextZ, frac);
    }
    s = nextS;
    z = nextZ;
    prevX = nextX;
  }

  // Compute central-difference tangents (yaw)
  for (let i = 0; i < LUT_COUNT; i++) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(LUT_COUNT - 1, i + 1);
    const dx = trackXArr[i1] - trackXArr[i0];
    const dz2 = trackZArr[i1] - trackZArr[i0];
    trackYawArr[i] = Math.atan2(dx, dz2);
  }
})();

export function getTrackPoint(s, out = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 }) {
  const clamped = clamp(s, TRACK_MIN_S, TRACK_MAX_S);
  const fIdx = (clamped - TRACK_MIN_S) / LUT_STEP;
  const i0 = Math.min(LUT_COUNT - 2, Math.max(0, Math.floor(fIdx)));
  const frac = fIdx - i0;

  const x = lerp(trackXArr[i0], trackXArr[i0 + 1], frac);
  const z = lerp(trackZArr[i0], trackZArr[i0 + 1], frac);
  const yaw = lerp(trackYawArr[i0], trackYawArr[i0 + 1], frac);

  out.x = x;
  out.y = DECK_Y;
  out.z = z;
  out.yaw = yaw;
  out.tx = Math.sin(yaw);
  out.tz = Math.cos(yaw);
  return out;
}

// ---------------------------------------------------------------------------
// Analytical Timetable Kinematics (exact C2 velocity, exact analytical integral)
//   0 - 24 s : runs along elevated track between towers (v = 32 m/s, s: 0 -> 768)
//  24 - 30 s : slows down and stops at elevated station (v: 32 -> 0, s: 768 -> 864)
//  30 - 34 s : stands still at platform (v === 0 exactly, s = 864)
//  34 - 40 s : pulls away and speeds up (v: 0 -> 44, s: 864 -> 996)
//  40 - 46 s : whole train passes through tunnel inside tower block (v = 44, s: 996 -> 1260)
//  46 - 60 s : comes out and crosses long bridge into night (v = 44, s: 1260 -> 1876)
// ---------------------------------------------------------------------------
export function getTrainState(rawTime) {
  const t = clamp(rawTime, 0, DURATION);
  let distance = 0;
  let speed = 0;
  let accel = 0;
  let throttle = 0;
  let braking = 0;

  if (t < 24.0) {
    speed = V_CRUISE;
    distance = V_CRUISE * t;
    accel = 0;
    throttle = 0.65;
  } else if (t < 30.0) {
    const u = (t - 24.0) / 6.0;
    const u2 = u * u;
    const u3 = u2 * u;
    const u4 = u3 * u;
    speed = V_CRUISE * (1 - 3 * u2 + 2 * u3);
    distance = 768.0 + V_CRUISE * 6.0 * (u - u3 + 0.5 * u4);
    accel = (V_CRUISE / 6.0) * (-6 * u + 6 * u2);
    braking = clamp(Math.sin(u * Math.PI), 0, 1);
  } else if (t <= 34.0) {
    speed = 0;
    distance = STATION_STOP_S;
    accel = 0;
  } else if (t < 40.0) {
    const u = (t - 34.0) / 6.0;
    const u2 = u * u;
    const u3 = u2 * u;
    const u4 = u3 * u;
    speed = V_FAST * (3 * u2 - 2 * u3);
    distance = STATION_STOP_S + V_FAST * 6.0 * (u3 - 0.5 * u4);
    accel = (V_FAST / 6.0) * (6 * u - 6 * u2);
    throttle = clamp(0.35 + 0.65 * Math.sin(u * Math.PI * 0.8), 0, 1);
  } else {
    speed = V_FAST;
    distance = TUNNEL_START_S + V_FAST * (t - 40.0);
    accel = 0;
    throttle = 0.92;
  }

  const atStation = t >= 30.0 && t <= 34.0;
  const inTunnel = t >= 40.0 && t < 46.0;

  return {
    distance,
    speed,
    accel,
    cars: CAR_COUNT,
    atStation,
    inTunnel,
    throttle,
    braking
  };
}

// ---------------------------------------------------------------------------
// 8 Deliberate Cinematic Shots (9:16 Portrait Framing)
// ---------------------------------------------------------------------------
export const SHOTS = [
  { id: 'establishing', num: '01', title: 'Frozen Skyline',    start: 0.0,  end: 11.0 },
  { id: 'overhead',     num: '02', title: 'Viaduct Thunder',   start: 11.0, end: 18.5 },
  { id: 'flank',        num: '03', title: 'Armored Flank',     start: 18.5, end: 24.0 },
  { id: 'station',      num: '04', title: 'Frost Terminal',    start: 24.0, end: 34.0 },
  { id: 'departure',    num: '05', title: 'Monolith Approach', start: 34.0, end: 40.0 },
  { id: 'tunnel',       num: '06', title: 'Monolith Tunnel',   start: 40.0, end: 46.0 },
  { id: 'emergence',    num: '07', title: 'Bridge Emergence',  start: 46.0, end: 52.0 },
  { id: 'bridge',       num: '08', title: 'Into the Night',    start: 52.0, end: 60.0 }
];

export function getShotIndexAt(rawTime) {
  const t = clamp(rawTime, 0, DURATION);
  for (let i = 0; i < SHOTS.length; i++) {
    if (t < SHOTS[i].end || i === SHOTS.length - 1) {
      return i;
    }
  }
  return SHOTS.length - 1;
}

function deterministicShake(t, amp) {
  if (amp <= 0) return { x: 0, y: 0 };
  const x = (Math.sin(t * 27.3) * 0.55 + Math.sin(t * 61.7 + 1.4) * 0.45) * amp;
  const y = (Math.cos(t * 33.1 + 0.7) * 0.6 + Math.sin(t * 73.9 + 2.1) * 0.4) * amp;
  return { x, y };
}

export function getCameraState(rawTime) {
  const t = clamp(rawTime, 0, DURATION);
  const train = getTrainState(t);
  const sLoco = train.distance;
  const shotIndex = getShotIndexAt(t);
  const shotDef = SHOTS[shotIndex];
  const u = clamp((t - shotDef.start) / (shotDef.end - shotDef.start), 0, 1);

  const ptC = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };
  const ptL = { x: 0, y: DECK_Y, z: 0, yaw: 0, tx: 0, tz: 1 };

  let px = 0, py = 30, pz = 0;
  let tx = 0, ty = DECK_Y + 2, tz = 0;
  let fov = 54;
  let shakeAmp = 0;

  switch (shotDef.id) {
    case 'establishing': {
      // Wide establishing crane over the frozen dusk skyline canyon
      const sCam = lerp(118, 396, easeInOutSine(u));
      getTrackPoint(sCam, ptC);
      px = ptC.x + lerp(35, 19, u);
      py = lerp(52, 34.5, easeInOutSine(u));
      pz = ptC.z + lerp(16, 12, u);

      const sLook = sLoco - lerp(34, 18, u);
      getTrackPoint(sLook, ptL);
      tx = ptL.x;
      ty = DECK_Y + 2.2;
      tz = ptL.z;
      fov = lerp(56, 53, u);
      shakeAmp = 0.02;
      break;
    }

    case 'overhead': {
      // Dramatic low-angle beneath the elevated viaduct with full unobstructed view of the armored consist
      const sAnchor = 492;
      getTrackPoint(sAnchor, ptC);
      px = ptC.x - lerp(17.5, 19.5, u);
      py = lerp(18.8, 21.2, u);
      pz = ptC.z + lerp(4.0, -4.0, u);

      // Track the approaching locomotive prow, then sweep along the glowing armored cars overhead
      const sLook = lerp(sLoco - 4, sLoco - 52, smoothstep(0.32, 1.0, u));
      getTrackPoint(sLook, ptL);
      tx = ptL.x;
      ty = DECK_Y + lerp(2.2, 3.0, u);
      tz = ptL.z;
      fov = lerp(56, 60, u);

      // Vibrational tremor as the locomotive thunder passes overhead around s = 492
      const distToCam = Math.abs(sLoco - sAnchor);
      const passFactor = clamp(1 - distToCam / 85, 0, 1);
      shakeAmp = 0.03 + passFactor * passFactor * 0.22;
      break;
    }

    case 'flank': {
      // Tight high-speed tracking gliding alongside the armored prow and warm lit cars
      const sCam = sLoco + lerp(15, -24, easeInOutSine(u));
      getTrackPoint(sCam, ptC);
      px = ptC.x + lerp(11.4, 12.6, u);
      py = DECK_Y + 2.5 + Math.sin(u * Math.PI) * 1.4;
      pz = ptC.z;

      const sLook = sLoco - lerp(8, 38, u);
      getTrackPoint(sLook, ptL);
      tx = ptL.x;
      ty = DECK_Y + 2.3;
      tz = ptL.z;
      fov = 52;
      shakeAmp = 0.055;
      break;
    }

    case 'station': {
      // Platform-level shot: train brakes cleanly into Frost Terminal (24-30s) and stops (30-34s)
      const sCam = lerp(891, 881, easeInOutSine(u));
      getTrackPoint(sCam, ptC);
      px = lerp(6.8, 6.2, easeInOutSine(u));
      py = DECK_Y + 2.45;
      pz = ptC.z;

      // Focus glides smoothly with braking locomotive, then frames the stopped prow, sign & warm cars
      const approachU = smoothstep(0.0, 0.65, u);
      const sLook = lerp(804, 855, approachU);
      getTrackPoint(sLook, ptL);
      tx = lerp(0.0, 0.3, approachU);
      ty = DECK_Y + 2.6;
      tz = ptL.z;
      fov = lerp(51, 48, u);
      shakeAmp = train.speed > 0.5 ? 0.025 * (train.speed / V_CRUISE) : 0;
      break;
    }

    case 'departure': {
      // Dynamic ahead-side tracking: catches the armored prow roaring out of Frost Terminal right into the Monolith tunnel mouth
      const sCam = Math.min(sLoco + lerp(26.0, 10.0, u), TUNNEL_START_S - 4.5);
      getTrackPoint(sCam, ptC);
      px = lerp(-12.8, -14.2, Math.sin(u * Math.PI * 0.7));
      py = DECK_Y + lerp(3.1, 5.2, easeInOutSine(u));
      pz = ptC.z;

      const sLook = sLoco - lerp(6.0, 14.0, u);
      getTrackPoint(sLook, ptL);
      tx = 0;
      ty = DECK_Y + 2.6;
      tz = ptL.z;
      fov = lerp(52, 56, u);
      shakeAmp = 0.035 * (train.speed / V_FAST);
      break;
    }

    case 'tunnel': {
      // Inside the ribbed concrete tower-block tunnel ahead of the roaring locomotive
      const sCam = Math.min(sLoco + lerp(20.0, 12.5, u), TUNNEL_END_S - 1.5);
      getTrackPoint(sCam, ptC);
      px = lerp(3.8, 3.1, u);
      py = DECK_Y + 2.35 + Math.sin(u * Math.PI) * 0.4;
      pz = ptC.z;

      const sLook = sLoco - 5.0;
      getTrackPoint(sLook, ptL);
      tx = -0.25;
      ty = DECK_Y + 2.3;
      tz = ptL.z;
      fov = lerp(60, 63, u);
      shakeAmp = 0.13;
      break;
    }

    case 'emergence': {
      // Bursting out of the monolith tunnel portal onto the long snow-swept cable-stayed bridge
      const sCam = lerp(1318, 1515, smoothstep(0.06, 1.0, u));
      getTrackPoint(sCam, ptC);
      px = lerp(22.0, 32.0, easeInOutSine(u));
      py = DECK_Y + lerp(8.5, 17.5, easeInOutSine(u));
      pz = ptC.z;

      const sLook = sLoco - lerp(6.0, 26.0, u);
      getTrackPoint(sLook, ptL);
      tx = 0;
      ty = DECK_Y + 3.4;
      tz = ptL.z;
      fov = lerp(55, 53, u);
      shakeAmp = 0.045;
      break;
    }

    case 'bridge':
    default: {
      // Soaring wide night vista: towering bridge pylons, stay cables, night sky & glowing train crossing into the night
      const sCam = lerp(1690, 1805, easeInOutSine(u));
      getTrackPoint(sCam, ptC);
      px = lerp(-44, -68, easeInOutSine(u));
      py = DECK_Y + lerp(11.0, 22.0, easeInOutSine(u));
      pz = ptC.z;

      const sLook = sLoco - lerp(26, 46, u);
      getTrackPoint(sLook, ptL);
      tx = 0;
      ty = DECK_Y + lerp(9.0, 14.5, u);
      tz = ptL.z;
      fov = lerp(55, 52, u);
      shakeAmp = 0.015;
      break;
    }
  }

  const shake = deterministicShake(t, shakeAmp);

  return {
    shot: shotDef.id,
    shotIndex,
    shotNum: shotDef.num,
    shotTitle: shotDef.title,
    position: { x: px + shake.x, y: py + shake.y, z: pz },
    target: { x: tx, y: ty, z: tz },
    fov
  };
}
