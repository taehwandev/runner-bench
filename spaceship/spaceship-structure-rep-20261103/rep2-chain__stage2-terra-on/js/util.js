// Pure helpers shared by the flight logic, camera rig and scene builders.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function smoothstep(x, edge0, edge1) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Small seeded PRNG so the scenery layout is identical on every load.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Releases GPU resources (geometries, materials and their textures) under an object.
export function disposeTree(root) {
  root.traverse((node) => {
    node.geometry?.dispose();
    for (const material of [].concat(node.material ?? [])) {
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}
