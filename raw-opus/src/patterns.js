// Hand-authored obstacle chunks. Each row: "OOO:CCC" (lanes 0..2), optional "N|" prefix = gap in beats.
// Obstacles: . free | L barricade (jump) | J jersey barrier (jump) | R rail gate (jump) | H beam (slide)
//            B parked vehicle | X container | T truck (long) | U bus (long) | C oncoming car | S swerving car
// Coins:     . none | c lead-in line | a jump arc | s slide line | n long line | g gem at row | G risky gem just before row | p power-up
export const CHUNKS = [
  // ---- tier 0: learn the three responses
  { t: 0, rows: ['L..:a..', '..L:..a'] },
  { t: 0, rows: ['.L.:.a.', 'B.B:.c.', '.H.:.s.'] },
  { t: 0, rows: ['B..:.c.', '.B.:c..', '..B:.c.'] },
  { t: 0, rows: ['H.H:.c.', '.L.:.a.'] },
  { t: 0, rows: ['LBL:a.a'] },
  { t: 0, rows: ['.X.:c.c', 'J.J:.g.'] },
  { t: 0, rows: ['..H:..s', '.B.:c..', 'H..:s..'] },
  // ---- tier 1: traffic, full-width rows, crossings
  { t: 1, rows: ['.C.:c.c'] },
  { t: 1, rows: ['B.C:..G', '.L.:.a.'] },
  { t: 1, rows: ['HHH:.s.', 'B.B:.c.'] },
  { t: 1, rows: ['JJJ:aaa'] },
  { t: 1, rows: ['S..:..c'] },
  { t: 1, rows: ['RRR:.a.', 'B.B:.c.'] },
  { t: 1, rows: ['R.R:.c.', '.B.:c..'] },
  { t: 1, rows: ['C..:G.c', '..X:.a.', 'L..:a..'] },
  { t: 1, rows: ['X.L:.ca', '.HX:.s.'] },
  // ---- tier 2: combinations
  { t: 2, rows: ['BL.:..c', '.HB:s..', 'L.X:.a.'] },
  { t: 2, rows: ['C.C:.g.', '.L.:.a.'] },
  { t: 2, rows: ['U.B:.c.', '.L.:.a.'] },
  { t: 2, rows: ['L.H:a.s', 'B.L:..a', '.HB:.s.'] },
  { t: 2, rows: ['S..:..c', 'B.L:.ca'] },
  { t: 2, rows: ['XLX:.a.', 'H.H:.c.', '.C.:c.c'] },
  { t: 2, rows: ['TT.:..c', '..H:..s'] },
  { t: 2, rows: ['RRR:aaa', 'B.C:.cG'] },
  { t: 2, rows: ['.C.:G.c', 'X.X:.g.', 'HHH:sss'] },
  // ---- tier 3: hard but fair
  { t: 3, rows: ['C.B:G..', 'B.C:..G', '.X.:c.c'] },
  { t: 3, rows: ['LHL:asa', 'HLH:sas', 'LHL:asa'] },
  { t: 3, rows: ['B.S:...', 'S.B:.c.'] },
  { t: 3, rows: ['U.U:.c.', '.H.:.s.', 'X.X:.c.'] },
  { t: 3, rows: ['C.C:.g.', '.C.:c.c'] },
  { t: 3, rows: ['RRR:aaa', 'BHB:.s.'] },
  { t: 3, rows: ['.CX:c..', 'XL.:.a.', '.HC:.sG'] },
  { t: 3, rows: ['JXJ:a.a', 'S.X:.c.', 'HHH:.s.'] },
];

const BLOCK = new Set(['B', 'X', 'T', 'U', 'C', 'S']);
const LONG = new Set(['T', 'U']);
const MOVING = new Set(['C', 'S']);

export function parseRow(str) {
  let gap = 1, s = str;
  const bar = s.indexOf('|');
  if (bar >= 0) { gap = parseFloat(s.slice(0, bar)); s = s.slice(bar + 1); }
  const [o, c = '...'] = s.split(':');
  return { gap, o: o.split(''), c: c.padEnd(3, '.').split('') };
}

export function mirrorRow(r) { return { gap: r.gap, o: [...r.o].reverse(), c: [...r.c].reverse() }; }

// Reachability check: there must be a passable lane in each row, reachable from the previous row
// without crossing a lane that is blocked by a long vehicle or an arriving car.
export function validateChunk(rows) {
  let reach = new Set([0, 1, 2]);
  let prev = null;
  for (const r of rows) {
    const pass = [0, 1, 2].filter(l => !BLOCK.has(r.o[l]));
    const next = new Set();
    for (const b of pass) {
      for (const a of reach) {
        const lo = Math.min(a, b), hi = Math.max(a, b);
        let ok = true;
        for (let l = lo; l <= hi; l++) {
          if (prev && LONG.has(prev.o[l])) ok = false;
        }
        if (ok || a === b) { next.add(b); break; }
      }
    }
    if (!next.size) return false;
    reach = next; prev = r;
  }
  return true;
}

export function prepareChunks() {
  const out = [];
  for (const ch of CHUNKS) {
    const rows = ch.rows.map(parseRow);
    if (!validateChunk(rows) || !validateChunk(rows.map(mirrorRow))) { console.warn('Invalid chunk skipped', ch.rows); continue; }
    out.push({ t: ch.t, rows });
  }
  return out;
}
