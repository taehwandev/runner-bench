// World layout derived from the timetable landmarks. Pure data: scene builders,
// cameras and effects all read positions from here, never from each other.

import { TRACK, STATION, TUNNEL, BRIDGE } from '../config.js';
import { LANDMARKS } from './timeline.js';

const stop = LANDMARKS.stationStop;
const tunnelFrom = LANDMARKS.tunnelStart;
const tunnelTo = LANDMARKS.tunnelEnd;

export const LAYOUT = {
  railY: TRACK.railY,
  deckY: TRACK.railY - 0.25,
  station: {
    stopS: stop,
    fromS: stop - STATION.platformBack,
    toS: stop + STATION.platformAhead,
    side: STATION.side, // -1: platform on the left of travel (world -X)
    floorY: TRACK.railY + STATION.floorY,
  },
  tunnel: {
    fromS: tunnelFrom,
    toS: tunnelTo,
    halfWidth: TUNNEL.halfWidth,
    floorY: TRACK.railY - 0.25,
    ceilY: TRACK.railY + TUNNEL.height,
  },
  // The tower block the tunnel runs through (axis-aligned, straight track).
  block: {
    zNear: -tunnelFrom,
    zFar: -tunnelTo,
    halfWidth: TUNNEL.blockHalfWidth,
    coreHalfWidth: TUNNEL.coreHalfWidth,
    coreTopY: TRACK.railY + 19,
    height: TUNNEL.blockHeight,
  },
  viaduct: { fromS: TRACK.from, toS: tunnelFrom },
  bridge: {
    fromS: tunnelTo,
    toS: tunnelTo + BRIDGE.length,
    firstPylonS: tunnelTo + 150,
  },
  river: { zNear: -(tunnelTo + 4), zFar: -(tunnelTo + BRIDGE.length - 40) },
};

/** True when a world-space z lies inside the tower block's footprint depth. */
export function insideBlockZ(z) {
  return z < LAYOUT.block.zNear && z > LAYOUT.block.zFar;
}
