// Sweeps a 2D cross-section (lateral, up) along the track to build deck, rails,
// parapets and tunnel linings. Each edge gets flat normals and a material group.

import * as THREE from 'three';

// edges: [{ a: [lat, up], b: [lat, up], mat: index, uScale?: metres per U }]
// Outward normal of an edge is (-(b.up - a.up), b.lat - a.lat) normalised.
export function sweepGeometry(track, d0, d1, step, edges, vScale = 8) {
  const pos = [];
  const nor = [];
  const uv = [];
  const groups = new Map();
  const indices = [];
  const ds = [];
  for (let d = d0; d < d1; d += step) ds.push(d);
  ds.push(d1);
  const frames = ds.map((d) => {
    const p = track.pointAt(d);
    return { d, x: p.x, y: p.y, z: p.z, rx: -Math.sin(p.h), rz: Math.cos(p.h) };
  });
  const world = (f, lat, up) => [f.x + f.rx * lat, f.y + up, f.z + f.rz * lat];

  for (const e of edges) {
    const dl = e.b[0] - e.a[0];
    const du = e.b[1] - e.a[1];
    const len = Math.hypot(dl, du);
    const nl = -du / len, nu = dl / len;
    const base = pos.length / 3;
    frames.forEach((f) => {
      pos.push(...world(f, e.a[0], e.a[1]), ...world(f, e.b[0], e.b[1]));
      const n = [f.rx * nl, nu, f.rz * nl];
      nor.push(...n, ...n);
      const us = e.uScale || len;
      uv.push(0, f.d / vScale, len / us, f.d / vScale);
    });
    // winding check against the intended normal on the first quad
    const p0 = world(frames[0], e.a[0], e.a[1]);
    const p1 = world(frames[0], e.b[0], e.b[1]);
    const p2 = world(frames[1], e.a[0], e.a[1]);
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const n0 = [frames[0].rx * nl, nu, frames[0].rz * nl];
    const flip = cr[0] * n0[0] + cr[1] * n0[1] + cr[2] * n0[2] < 0;
    const list = groups.get(e.mat) || [];
    for (let i = 0; i < frames.length - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      if (flip) list.push(a, c, b, b, c, d);
      else list.push(a, b, c, b, d, c);
    }
    groups.set(e.mat, list);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  for (const [mat, list] of [...groups.entries()].sort((x, y) => x[0] - y[0])) {
    geo.addGroup(indices.length, list.length, mat);
    indices.push(...list);
  }
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}
