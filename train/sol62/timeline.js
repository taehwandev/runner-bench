export const DURATION = 60;
export const CARS = 9;
export const TRACK = 40;
export const STRIDE = 21;
export const TRAIN_LENGTH = 213;
export const STATION = 648;
export const PORTAL = 876;
export const EXIT = 1119;
export const SHOTS = [0, 8, 16, 24, 30, 34, 40, 46, 54];
export const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = u => { const p = clamp(u); return p * p * (3 - 2 * p); };
const integral = u => u ** 3 * (1 - u * .5);

export function trainAt(t) {
  let distance, speed;
  if (t < 24) {
    speed = 24;
    distance = speed * t;
  } else if (t < 30) {
    const u = (t - 24) / 6;
    speed = 24 * (1 - smooth(u));
    distance = 576 + 144 * (u - integral(u));
  } else if (t < 34) {
    speed = 0;
    distance = STATION;
  } else if (t < 40) {
    const u = (t - 34) / 6;
    speed = 76 * smooth(u);
    distance = STATION + 456 * integral(u);
  } else if (t < 46) {
    speed = 76;
    distance = PORTAL + speed * (t - 40);
  } else {
    const u = clamp((t - 46) / 5);
    speed = 76 - 37 * smooth(u);
    distance = 1332 + 380 * u - 185 * integral(u) + 39 * Math.max(0, t - 51);
  }
  return { distance, speed, cars: CARS, atStation: t >= 30 && t < 34, inTunnel: t >= 40 && t < 46 && distance - TRAIN_LENGTH <= EXIT };
}

export function shotAt(t) {
  return SHOTS.findLastIndex(start => start <= t);
}

// Offsets are measured from the locomotive nose. The arrival crane uses a fixed world anchor.
export function cameraAt(t, train, shot) {
  const x = train.distance;
  const y = TRACK;
  const u = smooth((t - SHOTS[shot]) / ((SHOTS[shot + 1] ?? DURATION) - SHOTS[shot]));
  switch (shot) {
    case 0: return [[x + lerp(151, 108, u), y + lerp(103, 74, u), lerp(137, 111, u)], [x - lerp(66, 58, u), y + 1, -4], 52];
    case 1: return [[x + lerp(30, 23, u), y + lerp(11, 8, u), lerp(-24, -18, u)], [x - lerp(13, 9.5, u), y + 4, 0], 51];
    case 2: {
      const lift = smooth((t - 16.42) / 1.83);
      return [[x + lerp(34, 7, u), y + lerp(-12.8, 4.8, lift), lerp(18, 22, u)], [x - lerp(16, 5.5, u), y + 4.5, 0], 58];
    }
    case 3: return [[lerp(682, 675, u), y + lerp(24, 16, u), lerp(-49, -40, u)], [x - lerp(14, 13, u), y + 3, 0], 49];
    case 4: return [[x + lerp(22, 17.5, u), y + lerp(5.6, 6.2, u), lerp(-14, -14.5, u)], [x - lerp(10, 8, u), y + 4, 0], 53];
    case 5: return [[x + lerp(24, 42, u), y + lerp(9, 23, u), lerp(22, 44, u)], [x - lerp(10.5, 17, u), y + 3, 0], 52];
    case 6: {
      const exitDolly = smooth((t - 43.1) / 1.15);
      return [[x + lerp(19, 32, exitDolly), y + lerp(5, 15, exitDolly), lerp(7, 18, exitDolly)], [x - 14, y + 3, 0], 52];
    }
    case 7: return [[x + lerp(54, 85, u), y + lerp(22, 43, u), lerp(68, 104, u)], [x - lerp(25, 37, u), y + 2, 0], 53];
    default: return [[x - lerp(332, 405, u), y + lerp(68, 105, u), -lerp(80, 112, u)], [x - lerp(127, 143, u), y + 7, 0], lerp(49, 53, u)];
  }
}
