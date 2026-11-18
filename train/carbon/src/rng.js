// Deterministic seeded PRNG (Mulberry32) and pure hash helpers.
// Ensures the exact same time t always produces the exact same frame.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashUint(n) {
  let x = (n >>> 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function createRng(seed = 20261118) {
  const next = mulberry32(seed);

  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, maxInclusive) {
      return Math.floor(min + (maxInclusive - min + 1) * next());
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(probability) {
      return next() < probability;
    },
    signed() {
      return next() * 2 - 1;
    },
    hash(index, salt = 0) {
      return hashUint(Math.imul(index | 0, 73856093) ^ Math.imul(salt | 0, 19349663));
    },
    hashSigned(index, salt = 0) {
      return hashUint(Math.imul(index | 0, 73856093) ^ Math.imul(salt | 0, 19349663)) * 2 - 1;
    },
  };
}
