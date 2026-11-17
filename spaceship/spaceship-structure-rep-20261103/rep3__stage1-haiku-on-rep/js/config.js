import * as THREE from 'three';

// Units are metres and seconds.

export const PAD_RADIUS = 6;
export const PAD_TOP = 0.4;          // pad surface height
export const HOVER_HEIGHT = 2.4;     // ship origin above the pad origin
export const FOOT_OFFSET = 1.5;      // ship origin to the bottom of the footpads
export const LAP_RADIUS = 9;
export const LAP_HEIGHT = 3.6;
export const LAP_TIME = 18;          // one slow lap
export const RAMP_TIME = 3;          // ease from hover into the lap
export const DEPART_TIME = 14;       // accelerate away from the lap
export const AWAY_SPEED = 40;        // cruising speed once clear of the pad
export const FOLLOW_AFTER_DEPART = 8; // camera stops tracking this long into flight

// Departure curve: starts at the end of the lap and heads out and away
export const DEPART_C1_OFFSET = new THREE.Vector3(14, 6, -6);
export const DEPART_C2 = new THREE.Vector3(150, 70, -150);
export const DEPART_END = new THREE.Vector3(300, 115, -260);

export const TREE_COUNT = 260;

export const DEFAULT_TARGET = new THREE.Vector3(0, 2.2, 0);
export const DEFAULT_DIR = new THREE.Vector3(-0.2, 0.25, 0.95).normalize();
export const DEFAULT_DIST = 17;

export const ZOOM_TAP = 0.85;        // distance factor per tap or key press
export const ZOOM_HOLD = 0.97;       // distance factor per tick while held

export const PHASE_LABEL = { hover: 'Hovering', lap: 'Slow lap', depart: 'Departing', away: 'Departed' };
export const LAUNCH_LABEL = { hover: 'Launch', lap: 'Orbiting…', depart: 'Departing…', away: 'Start over' };
