// Train motion as closed-form functions of time. Same t -> same answer, always.

import { TIMETABLE as TT, CONSIST, COUPLING_GAP } from '../config.js';

const ease = (u) => u * u * (3 - 2 * u);          // smoothstep
const easeInt = (u) => u * u * u - 0.5 * u * u * u * u; // ∫0^u smoothstep

export const TRAIN_LENGTH = CONSIST.reduce((a, c) => a + c.length, 0) + COUPLING_GAP * (CONSIST.length - 1);
export const CAR_COUNT = CONSIST.length - 1;

const D_BRAKE = TT.startDistance + TT.cruiseSpeed * TT.brakeStart;
const D_STOP = D_BRAKE + TT.cruiseSpeed * (TT.stopAt - TT.brakeStart) * 0.5;
const D_TOP = D_STOP + TT.topSpeed * (TT.departEnd - TT.departAt) * 0.5;

// Nose distance along the track (m). Extrapolates as cruise before t = 0.
export function trainDistance(t) {
  if (t <= TT.brakeStart) return TT.startDistance + TT.cruiseSpeed * t;
  if (t < TT.stopAt) {
    const T = TT.stopAt - TT.brakeStart;
    const u = (t - TT.brakeStart) / T;
    return D_BRAKE + TT.cruiseSpeed * T * (u - easeInt(u));
  }
  if (t <= TT.departAt) return D_STOP;
  if (t < TT.departEnd) {
    const T = TT.departEnd - TT.departAt;
    const u = (t - TT.departAt) / T;
    return D_STOP + TT.topSpeed * T * easeInt(u);
  }
  return D_TOP + TT.topSpeed * (t - TT.departEnd);
}

// Speed in m/s; exactly 0 while standing at the platform.
export function trainSpeed(t) {
  if (t <= TT.brakeStart) return TT.cruiseSpeed;
  if (t < TT.stopAt) return TT.cruiseSpeed * (1 - ease((t - TT.brakeStart) / (TT.stopAt - TT.brakeStart)));
  if (t <= TT.departAt) return 0;
  if (t < TT.departEnd) return TT.topSpeed * ease((t - TT.departAt) / (TT.departEnd - TT.departAt));
  return TT.topSpeed;
}

export const STOP_DISTANCE = D_STOP;
export const TUNNEL_START = trainDistance(TT.tunnelEnter);
export const TUNNEL_END = trainDistance(TT.tunnelExit) - TRAIN_LENGTH;

const EPS = 1e-6;

export function trainState(t) {
  const distance = trainDistance(t);
  const speed = trainSpeed(t);
  const rear = distance - TRAIN_LENGTH;
  return {
    distance,
    speed,
    rear,
    cars: CAR_COUNT,
    atStation: speed === 0 && Math.abs(distance - D_STOP) < EPS,
    inTunnel: distance >= TUNNEL_START - EPS && rear <= TUNNEL_END + EPS,
  };
}

// Offsets (from the nose, metres back) of each unit's front and rear.
export const UNIT_OFFSETS = (() => {
  let off = 0;
  return CONSIST.map((c) => {
    const o = { type: c.type, length: c.length, front: off, rear: off + c.length };
    off += c.length + COUPLING_GAP;
    return o;
  });
})();
