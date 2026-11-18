// Analytic track path: straight + circular arc segments, parameterised by exact
// arc length. Pure math, no renderer access.

const DEG = Math.PI / 180;

export function buildTrack(layout) {
  const segs = [];
  let x = layout.start.x;
  let z = layout.start.z;
  let h = layout.heading * DEG;
  let s = 0;
  for (const seg of layout.segments) {
    if (seg.type === 'straight') {
      segs.push({ kind: 'line', s0: s, len: seg.length, x, z, h });
      x += Math.cos(h) * seg.length;
      z += Math.sin(h) * seg.length;
      s += seg.length;
    } else {
      const a = seg.angle * DEG;
      const sign = Math.sign(a);
      const len = seg.radius * Math.abs(a);
      const cx = x + sign * seg.radius * -Math.sin(h);
      const cz = z + sign * seg.radius * Math.cos(h);
      segs.push({ kind: 'arc', s0: s, len, cx, cz, h0: h, r: seg.radius, sign });
      h += a;
      x = cx - sign * seg.radius * -Math.sin(h);
      z = cz - sign * seg.radius * Math.cos(h);
      s += len;
    }
  }
  const end = { x, z, h, s };
  const y = layout.deckY;

  // Returns {x, y, z, h} for a distance; extrapolates straight beyond both ends.
  function pointAt(d) {
    if (d <= 0) {
      const f = segs[0];
      return { x: f.x + Math.cos(f.h) * d, y, z: f.z + Math.sin(f.h) * d, h: f.h };
    }
    if (d >= end.s) {
      const e = d - end.s;
      return { x: end.x + Math.cos(end.h) * e, y, z: end.z + Math.sin(end.h) * e, h: end.h };
    }
    let seg = segs[0];
    for (let i = segs.length - 1; i >= 0; i--) {
      if (d >= segs[i].s0) { seg = segs[i]; break; }
    }
    const l = d - seg.s0;
    if (seg.kind === 'line') {
      return { x: seg.x + Math.cos(seg.h) * l, y, z: seg.z + Math.sin(seg.h) * l, h: seg.h };
    }
    const hh = seg.h0 + seg.sign * l / seg.r;
    return {
      x: seg.cx - seg.sign * seg.r * -Math.sin(hh),
      y,
      z: seg.cz - seg.sign * seg.r * Math.cos(hh),
      h: hh,
    };
  }

  // World point at distance d, offset `lateral` to the right of travel and `up` above the deck.
  function offsetPoint(d, lateral = 0, up = 0) {
    const p = pointAt(d);
    return [p.x - Math.sin(p.h) * lateral, p.y + up, p.z + Math.cos(p.h) * lateral];
  }

  // Coarse polyline for proximity queries (city layout, exclusion zones).
  const samples = [];
  for (let d = layout.drawFrom; d <= layout.drawTo; d += 4) {
    const p = pointAt(d);
    samples.push({ d, x: p.x, z: p.z });
  }

  // Nearest track sample to (x, z): {d, dist, lateral}
  function project(x, z) {
    let best = samples[0];
    let bd = Infinity;
    for (const s of samples) {
      const dx = s.x - x;
      const dz = s.z - z;
      const q = dx * dx + dz * dz;
      if (q < bd) { bd = q; best = s; }
    }
    const p = pointAt(best.d);
    const rx = -Math.sin(p.h);
    const rz = Math.cos(p.h);
    return { d: best.d, dist: Math.sqrt(bd), lateral: (x - p.x) * rx + (z - p.z) * rz };
  }

  return { pointAt, offsetPoint, project, length: end.s, deckY: y, samples };
}

// Yaw (radians, about +y) that turns a model's +z axis onto the travel direction.
export function yawForHeading(h) {
  return Math.atan2(Math.cos(h), Math.sin(h));
}
