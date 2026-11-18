// World landmarks derived from the timetable so geometry always agrees with motion.

import { TRACK_LAYOUT } from '../config.js';
import { buildTrack } from './track.js';
import { STOP_DISTANCE, TUNNEL_START, TUNNEL_END, TRAIN_LENGTH } from './kinematics.js';

export const track = buildTrack(TRACK_LAYOUT);

export const STATION = {
  start: STOP_DISTANCE - TRAIN_LENGTH - 14,
  end: STOP_DISTANCE + 36,
  platformHeight: 1.05,
};

export const TUNNEL = {
  start: TUNNEL_START,
  end: TUNNEL_END,
  halfWidth: 4.7,
  height: 8.6,
  tower: { width: 72 },
};

export const SHORE = TUNNEL_END + 34;

export const BRIDGE = {
  start: SHORE,
  end: TRACK_LAYOUT.drawTo,
  pylons: [SHORE + 300, SHORE + 760],
  waterY: -7,
};

export const CITY = {
  block: 58,
  street: 16,
};
