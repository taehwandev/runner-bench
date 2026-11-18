// Small geometry toolkit: collect faceted, vertex-coloured parts into one
// BufferGeometry so each scene unit costs a single draw call per material.

import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _v = new THREE.Vector3();
const _nm = new THREE.Matrix3();

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
  }

  /** Flat quad a-b-c-d (counter-clockwise seen from outside). */
  quad(a, b, c, d, color, uv = [0, 0, 1, 1]) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _b.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    _n.crossVectors(_a, _b).normalize();
    const [u0, v0, u1, v1] = uv;
    const verts = [a, b, c, a, c, d];
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 6; i++) {
      this.pos.push(verts[i][0], verts[i][1], verts[i][2]);
      this.nor.push(_n.x, _n.y, _n.z);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(color[0], color[1], color[2]);
    }
    return this;
  }

  /** Axis-aligned box centred at (cx, cy, cz). `top` recolours the lid. */
  box(cx, cy, cz, sx, sy, sz, color, top = color) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const us = sz / 6, ut = sx / 6;
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color, [0, 0, us, 1]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, [0, 0, us, 1]);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, [0, 0, ut, 1]);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, [0, 0, ut, 1]);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top, [0, 0, ut, us]);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, [0, 0, ut, us]);
    return this;
  }

  /**
   * Skin between two closed profiles (arrays of [x, y], counter-clockwise
   * looking down -Z) placed at zA and zB with zA > zB.
   * `colorOf(i)` may recolour individual facets.
   */
  loft(profA, zA, profB, zB, color, colorOf) {
    const n = profA.length;
    const uScale = Math.abs(zA - zB) / 6;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const c = colorOf ? colorOf(i) : color;
      if (!c) continue; // facet left open on purpose
      // v runs 1 (top) to 0 (bottom) by height so plates sit upright
      const va = profA[i][1] / 4.6, vb = profA[j][1] / 4.6;
      this.quadUV(
        [profA[i][0], profA[i][1], zA], [profB[i][0], profB[i][1], zB],
        [profB[j][0], profB[j][1], zB], [profA[j][0], profA[j][1], zA],
        c, [[0, 1 - va], [uScale, 1 - va], [uScale, 1 - vb], [0, 1 - vb]],
      );
    }
    return this;
  }

  quadUV(a, b, c, d, color, uvs) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _b.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    _n.crossVectors(_a, _b).normalize();
    const verts = [a, b, c, a, c, d];
    const uvi = [0, 1, 2, 0, 2, 3];
    for (let i = 0; i < 6; i++) {
      this.pos.push(verts[i][0], verts[i][1], verts[i][2]);
      this.nor.push(_n.x, _n.y, _n.z);
      this.uv.push(uvs[uvi[i]][0], uvs[uvi[i]][1]);
      this.col.push(color[0], color[1], color[2]);
    }
    return this;
  }

  /** Flat cap over a convex profile at z, facing +Z (dir = 1) or -Z (dir = -1). */
  cap(profile, z, dir, color) {
    const p0 = profile[0];
    for (let i = 1; i < profile.length - 1; i++) {
      const p1 = profile[i], p2 = profile[i + 1];
      const tri = dir > 0 ? [p0, p1, p2] : [p0, p2, p1];
      for (const p of tri) {
        this.pos.push(p[0], p[1], z);
        this.nor.push(0, 0, dir);
        this.uv.push(p[0] / 4, p[1] / 4.6);
        this.col.push(color[0], color[1], color[2]);
      }
    }
    return this;
  }

  /** Append any three.js geometry, transformed by `matrix`, in one colour. */
  append(geometry, matrix, color) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    _nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(n, i).applyMatrix3(_nm).normalize();
      this.nor.push(_v.x, _v.y, _v.z);
      this.uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      this.col.push(color[0], color[1], color[2]);
    }
    if (g !== geometry) g.dispose();
    geometry.dispose();
    return this;
  }

  get empty() {
    return this.pos.length === 0;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

/** Matrix from position, Euler rotation and scale. */
export function xform(px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return _m.clone().compose(new THREE.Vector3(px, py, pz), _q, new THREE.Vector3(sx, sy, sz));
}

/** Mirror a right-hand half profile [[x, y]...] (bottom to top) into a closed loop. */
export function mirrorProfile(half) {
  const left = half.map(([x, y]) => [-x, y]).reverse();
  return [...half, ...left];
}
