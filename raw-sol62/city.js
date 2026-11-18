'use strict';

const ROAD_WIDTH = 9;
const LANE = 2.58;
const BLOCK = 48;
const DISTRICTS = [
  { name: 'NEON ROW', accent: '#ff44ae', other: '#52ffe6', wall: '#382747', glass: '#69437c', fog: '#292242' },
  { name: 'EAST VIADUCT', accent: '#ffb06b', other: '#6fd5ff', wall: '#383243', glass: '#5c526b', fog: '#332441' },
  { name: 'METRO TUNNEL', accent: '#57fff3', other: '#cc70ff', wall: '#253d53', glass: '#335b6a', fog: '#193344' },
  { name: 'CARGO CROSSING', accent: '#ff5d83', other: '#a3f98e', wall: '#332f55', glass: '#4b4b81', fog: '#322346' },
  { name: 'RAINLIGHT QUAY', accent: '#6da0ff', other: '#ff69c8', wall: '#2d3459', glass: '#3c4588', fog: '#232752' }
];
const districtIndex = (idx) => Math.floor(Math.max(0, idx) / 4) % DISTRICTS.length;
const districtAt = (distance) => DISTRICTS[districtIndex(Math.floor(distance / BLOCK))];

function seeded(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(1664525, n) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

const box = (b, ...args) => b.shape('box', ...args);
const glow = (b, x, y, z, w, h, color, strength = .5, tilt = 0) =>
  b.shape('glow', x, y, z, w, h, 1, color, strength, tilt);
const reflected = (b, x, z, w, length, color, strength) =>
  glow(b, x, .014, z, w, length, color, strength, -Math.PI / 2);

function sign(b, x, y, z, w, h, label, color, angle = 0) {
  b.shape('sign', x, y, z, w, h, 1, color, CITY_SIGNS.indexOf(label), 0, angle);
}

function board(b, x, y, z, w, h, label, color, angle = 0) {
  const x1 = x + Math.sin(angle) * .143, z1 = z + Math.cos(angle) * .143;
  box(b, x, y, z, w, h, .17, '#342440', .16, 0, angle);
  sign(b, x1, y, z1, w * .93, h * .83, label, color, angle);
  for (const s of [-1, 1]) box(b, x1, y + s * h * .44, z1, w * .97, .050, .053, color, .65, 0, angle);
  if (!angle) glow(b, x, y, z + .195, w * 1.8, h * 2.5, color, .17);
}

function tower(b, x, z, w, depth, h, side, d, r, style) {
  box(b, x, h / 2, z, w, h, depth, d.wall);
  const face = x - side * (w / 2 + .013);
  const front = z + depth / 2 + .014;
  box(b, x, .8, z, w + .16, 1.6, depth + .16, '#1e273d');
  box(b, x, h + .06, z, w + .25, .25, depth + .27, '#75829d');
  box(b, x + side * .3, h + .58, z - depth * .12, w * .62, .95, depth * .56, '#313450');
  if (r() > .3) {
    box(b, x + side, h + 1.75, z, .055, 2.2, .055, '#7484a0');
    box(b, x + side, h + 2.83, z, .12, .11, .12, '#ff5480', .64);
  }
  const bands = style === 2;
  const inside = -side * Math.PI / 2;
  const windows = Math.max(2, Math.floor(depth / 1.28));
  const floors = Math.floor((h - 2) / (bands ? 1.36 : 1.08));
  const windowColors = ['#6fb5d2', '#e0b998', '#d27da8', '#44869d', '#a29dee', d.glass];
  for (let level = 0; level < floors; level++) {
    const y = 2.05 + level * (bands ? 1.36 : 1.08);
    if (bands || level % 3 === 0) {
      box(b, face, y - .43, z, .10, .07, depth + .13, '#5b5678');
      box(b, x, y - .43, front, w, .07, .1, '#5b5678');
    }
    for (let k = 0; k < windows; k++) {
      const wz = z + (k - (windows - 1) / 2) * depth / windows;
      const lit = r() < (bands ? .68 : .44);
      const color = lit ? windowColors[Math.floor(r() * windowColors.length)] : '#20253e';
      b.shape('panel', face - side * .018, y, wz, bands ? .97 : .67, .56, 1, color, lit ? .39 : 0, 0, inside);
      if (!bands && lit && k % 2 === 0) b.shape('panel', face - side * .041, y - .11, wz, .66, .045, 1, '#473952', 0, 0, inside);
    }
    for (let k = 0; k < Math.floor(w); k++) {
      const lit = r() < .48;
      b.shape('panel', x - w * .4 + k * w * .8 / (Math.floor(w) - 1), y, front + .021, .48, .58, 1,
        lit ? windowColors[Math.floor(r() * windowColors.length)] : '#202843', lit ? .33 : 0);
    }
  }
  for (const o of [-.44, -.17, .17, .44]) {
    box(b, face - side * .04, h * .5, z + depth * o, .12, h, .065, '#534c6a');
  }
  if (style === 0 || style === 2) {
    for (const o of [-.42, .42]) {
      box(b, face - side * .08, h / 2, z + depth * o, .09, h - .15, .065, style ? d.other : d.accent, .57);
    }
    box(b, x, h - .13, front, w, .075, .045, d.accent, .52);
  }
  for (const o of [-.34, 0, .34]) {
    box(b, face - side * .05, .95, z + depth * o, .05, 1.14, depth * .235, '#4c6685', .18);
    box(b, face - side * .12, .43, z + depth * o, .06, .06, depth * .24, d.other, .42);
  }
  box(b, face - side * .4, 1.82, z, .88, .16, depth * .86, '#343858');
  box(b, face - side * .86, 1.76, z, .06, .075, depth * .86, d.other, .64);
}

function lamp(b, side, z, d) {
  const x = side * 5.38, arm = side * 4.33;
  box(b, x, .35, z, .32, .70, .33, '#444363');
  box(b, x, 2.34, z, .12, 4.63, .13, '#717795');
  box(b, side * 4.86, 4.57, z, 1.14, .11, .11, '#717795');
  box(b, arm, 4.51, z, .66, .16, .37, '#45435a');
  box(b, arm, 4.41, z, .53, .055, .26, '#ffd7a0', .8);
  glow(b, arm, 4.37, z + .08, 1.65, 1.28, '#ffba8a', .38);
  reflected(b, side * 3.45, z + 3, 1.6, 13, '#ffc396', .22);
  reflected(b, side * 3.68, z + 3, .49, 18, d.other, .14);
  box(b, x, .89, z, .16, .10, .16, d.other, .62);
}

function marquee(b, side, z, d) {
  const x = side * 6.54, y = 4.48;
  box(b, x, y, z, 1.25, 3.62, .30, '#342546', .16);
  box(b, x + side * .35, y, z - .25, 1.7, .22, .40, '#45435d');
  for (const s of [-1, 1]) {
    box(b, x + s * .60, y, z + .17, .065, 3.58, .066, d.accent, .70);
    box(b, x, y + s * 1.77, z + .17, 1.14, .061, .066, d.accent, .70);
  }
  sign(b, x, y + .91, z + .214, .97, 1.14, '夜', '#fff0f9');
  sign(b, x, y - .02, z + .215, 1.04, .66, 'N E O N', d.other);
  for (let i = 0; i < 3; i++) {
    box(b, x, y - .58 - .24 * i, z + .21, .72 - .13 * i, .054, .045, d.accent, .73);
  }
  reflected(b, side * 3.72, z + 4, 1.2, 16, d.accent, .39);
  glow(b, x, y, z + .24, 2.66, 5.1, d.accent, .25);
}

function kiosk(b, side, z, d) {
  const x = side * 6.2;
  box(b, x, 1.12, z, .73, 2, 1.26, '#28364d');
  box(b, x, 2.17, z, .84, .22, 1.39, d.accent, .32);
  box(b, x, 1.39, z + .64, .51, 1.10, .036, '#19263d');
  box(b, x, 1.56, z + .67, .39, .60, .05, d.other, .53);
  for (let i = 0; i < 4; i++) box(b, x - .15 + i * .1, .91, z + .67, .045, .04, .03, '#ffb276', .52);
  box(b, x - side * .37, 1.35, z, .02, 1.18, .98, '#4d8196', .21);
}

function tunnel(b, z, d, portal) {
  for (const side of [-1, 1]) {
    box(b, side * 8.1, 2.9, z, .65, 5.8, 12.1, '#293747');
    box(b, side * 7.72, 1.02, z, .14, .19, 12, '#58b3b5', .22);
    box(b, side * 7.65, 3.47, z, .15, .12, 11.8, d.accent, .62);
    box(b, side * 7.55, 3.02, z + 5.6, .19, 6.0, .39, '#546379');
    box(b, side * 7.75, 2.63, z + 1.48, .08, .11, 11.48, '#435877');
    for (const o of [-1, 1]) {
      box(b, side * 3.34, 5.51, z + o * 3, 1.9, .075, .17, d.accent, .7);
      reflected(b, side * 3.2, z + o * 3, 1.25, 8, d.accent, .24);
      box(b, side * 6.75, 4.95, z + o * 4, .56, .062, .26, d.other, .64);
      box(b, 0, 5.55, z + o * 3.8, 15.35, .13, .18, '#4b4d68');
    }
  }
  box(b, 0, 5.93, z, 17.1, .72, 12.15, '#313851');
  box(b, 0, 5.54, z + 5.6, 16.8, .21, .41, '#596379');
  if (portal) board(b, 0, 5.10, z + 6.08, 3.75, .68, 'TUNNEL', d.accent);
}

function viaduct(b, z, d) {
  for (const s of [-1, 1]) {
    box(b, s * 6.05, 2.7, z, 1.22, 5.4, 2.3, '#50516b');
    box(b, s * 6.05, .36, z, 1.48, .72, 2.56, '#303b50');
    box(b, s * 5.72, 3, z + 1.17, .12, 4.6, .035, d.accent, .36);
    box(b, s * 3.05, 5.03, z, 3.2, .09, .16, d.other, .5);
    reflected(b, s * 3.35, z + 1, 1.21, 9.6, d.other, .23);
  }
  box(b, 0, 5.62, z, 29, .95, 4.3, '#41435c');
  box(b, 0, 6.27, z + 2.11, 29, .55, .29, '#65637b');
  box(b, 0, 6.57, z + 2.26, 29, .06, .08, d.accent, .50);
  for (let x = -13; x <= 13; x++) box(b, x, 6.24, z + 2.28, .31, .28, .025, '#241b39');
  board(b, 0, 5.51, z + 2.24, 3.42, .66, 'HWY 04', '#ffc384');
}

function railway(b, z, d) {
  box(b, 0, .017, z, 16.5, .022, 3.02, '#37415a');
  for (let x = -8; x <= 8; x += .51) box(b, x, .044, z, .24, .04, 2.95, '#5a505d');
  for (const dz of [-1.04, 1.04]) box(b, 0, .067, z + dz, 24.0, .045, .14, '#a3a5aa', .15);
  for (const side of [-1, 1]) {
    box(b, side * 4.5, 1.31, z + 2, .14, 2.62, .17, '#8a8da5');
    for (const x of [4.19, 4.77]) {
      box(b, side * x, 2.13, z + 2.11, .36, .31, .24, '#232434');
      b.shape('cyl', side * x, 2.13, z + 2.26, .22, .055, .22, '#ff4e65', .75, Math.PI / 2);
    }
    board(b, side * 4.52, 2.67, z + 2.12, .92, .48, 'RAIL', '#ffbc86');
    reflected(b, side * 3.98, z + 4, 1.14, 7.3, d.accent, .28);
    for (let i = 0; i < 5; i++) {
      box(b, side * (4.61 + i * .33), .91, z + 1.68, .33, .12, .11, i % 2 ? '#ff4d67' : '#d5dfd8', .16);
    }
  }
}

function freightYard(b, side, d, r) {
  for (const z of [-8, -20, -33, -43]) {
    const stack = z === -20 || z === -43 ? 2 : 1;
    for (let level = 0; level < stack; level++) {
      const x = side * (9.2 + level * .36);
      const y = 1.27 + level * 2.25;
      const paint = ['#894e62', '#466777', '#887051'][Math.floor(r() * 3)];
      box(b, x, y, z, 2.62, 2.25, 8.22, paint);
      for (let i = -8; i <= 8; i++) box(b, x - side * 1.32, y, z + i * .46, .077, 1.91, .088, '#343951');
      for (const s of [-1, 1]) {
        box(b, x, y + s * 1.10, z, 2.68, .077, 8.26, '#7f7290');
        box(b, x + s * .83, y, z + 4.13, .055, 1.86, .06, '#9a93a1');
      }
      board(b, x, y + .39, z + 4.12, 1.29, .36, 'CARGO', d.other);
    }
  }
  for (let z = -3; z > -45; z -= 3.5) {
    box(b, side * 7.25, .92, z, .11, 1.85, .11, '#65718b');
    box(b, side * 7.25, 1.86, z, .14, .12, .14, d.accent, .5);
  }
  for (const y of [.43, 1.52]) box(b, side * 7.25, y, -24, .064, .074, 45, '#665a79');
}

function quay(b, d) {
  box(b, 16, -.23, -24, 18.1, .10, 48, '#1c294a');
  for (let z = -1.6; z > -48; z -= 2.6) {
    box(b, 7.76, .58, z, .13, 1.11, .13, '#4e5976');
    box(b, 7.76, 1.15, z, .17, .10, .17, '#8993aa');
    box(b, 7.82, .32, z - 1.3, .045, .05, 2.39, d.other, .23);
  }
  for (const y of [ .60, 1.12 ]) box(b, 7.74, y, -24, .11, .09, 47.5, '#7184a2');
  for (const z of [-8, -25, -41]) {
    box(b, 14.9, -.067, z, 9.73, .17, 1.51, '#34455f');
    box(b, 18.97, .55, z, .24, 1.44, .24, '#515d7d');
    box(b, 18.97, 1.30, z, .17, .13, .18, d.accent, .60);
    reflected(b, 19.2, z + 2.3, 1.5, 8.2, d.accent, .29);
    board(b, 8.24, 1.70, z + .21, .98, .34, 'QUAY', d.other);
  }
}

class City {
  constructor(renderer) {
    this.renderer = renderer;
    this.blocks = new Map();
    const batch = new Batch(), random = seeded(6504);
    for (let i = 0; i < 42; i++) {
      const x = (i - 20.5) * 4.9, z = -103 - random() * 40;
      if (Math.abs(x) < 5) continue;
      const h = 5 + random() * 30, w = 2.4 + random() * 5;
      box(batch, x, h / 2, z, w, h, 4 + random() * 7, i % 2 ? '#262948' : '#321f3e');
      box(batch, x, h + .24, z, w * .55, .44, 2, '#40324f');
      if (i % 3 === 0) box(batch, x, h + 1.23, z, .09, 2, .09, '#b56497', .58);
    }
    this.skyline = renderer.bake(batch);
  }

  build(index) {
    const b = new Batch(), r = seeded(23921 + index * 631);
    const di = districtIndex(index), d = DISTRICTS[di], inTunnel = di === 2;
    for (const side of [-1, 1]) {
      box(b, side * 6.18, -.03, -24, 3.37, .38, 48.03, '#29334d');
      box(b, side * 4.54, .10, -24, .15, .26, 48.04, '#777794');
      for (let z = -2; z > -47; z -= 2) {
        box(b, side * 5.07, .169, z, .049, .01, 1.3, z % 6 === 0 ? d.other : '#49526b', z % 6 === 0 ? .31 : 0);
        box(b, side * 6.5, .164, z, 2.69, .012, .025, '#192337');
      }
      for (const z of [-6.4, -19.8, -34.5, -46]) {
        if (!inTunnel) lamp(b, side, z + (side > 0 ? -1.8 : 0), d);
        box(b, side * 4.88, .44, z + 4, .14, .72, .14, '#443d57');
        box(b, side * 4.88, .68, z + 4, .16, .11, .16, d.accent, .54);
      }
      if (di === 3 && side === 1) freightYard(b, side, d, r);
      else if (di === 4 && side === 1) quay(b, d);
      else if (!inTunnel) {
        for (const z of [-5.2, -17.0, -28.8, -41.5]) {
          const w = 3.1 + r() * 3.8, depth = 8.0 + r() * 2.8;
          const style = Math.floor(r() * 3);
          const h = (di === 3 ? 5 : 7) + r() * (di === 3 ? 6 : 14);
          tower(b, side * (7.42 + w / 2 + r() * .25), z, w, depth, h, side, d, r, style);
          const back = 12.8 + r() * 3;
          box(b, side * back, h * .7, z - 1.5, 4.9, h * 1.4, 9.6, '#343450');
          box(b, side * back, h * 1.4, z - 1.5, 4.5, .12, 9.6, d.accent, .24);
          const positions = ['N E O N', 'KIOSK', 'RAMEN', '24 / 7', 'PARK'];
          const label = di === 3 ? 'CARGO' : di === 4 ? 'QUAY' : positions[Math.floor(r() * positions.length)];
          const color = r() > .46 ? d.accent : d.other;
          board(b, side * 7.37, 2.68 + r() * 1.1, z + .4, 3.6, .76, label, color, -side * Math.PI / 2);
          board(b, side * 6.59, 4.6 + r() * 2.8, z + 1.15, 1.65, .82, r() > .5 ? '夜' : '24 / 7', color);
          reflected(b, side * 3.35, z + 2.3, 2.9, 12.5, color, .32);
          reflected(b, side * 2.15, z + 3.4, .77, 7.6, color, .115);
        }
        kiosk(b, side, -11 - side * 2, d);
        kiosk(b, side, -37 + side * 2, d);
        if (di === 0 || di === 4) marquee(b, side, side < 0 ? -24.1 : -31.5, d);
        for (let n = 0; n < 7; n++) {
          const z = -2 - r() * 43, x = side * (5.75 + r());
          box(b, x, .34, z, .56, .36, .62, '#41425b');
          box(b, x, .54, z, .61, .09, .66, '#656280');
        }
      }
    }
    if (inTunnel) for (let i = 0; i < 4; i++) tunnel(b, -6 - i * 12, d, i === 0 && index % 4 === 0);
    if (di === 1 || (di === 0 && index % 4 === 3)) viaduct(b, -30, d);
    if (di === 3) railway(b, -23.6, d);
    else for (const x of [-3.45,-2.76,-2.07,-1.38,-.69,0,.69,1.38,2.07,2.76,3.45]) {
      box(b, x, .006, -44.2, .31, .014, 2.03, '#8391a7', .03);
    }
    return this.renderer.bake(b);
  }

  prepare(travel) {
    const current = Math.floor(travel / BLOCK);
    for (const [idx, parts] of this.blocks) {
      if (idx < current - 1 || idx > current + 3) {
        this.renderer.release(parts);
        this.blocks.delete(idx);
      }
    }
    for (let i = current - 1; i <= current + 3; i++) {
      if (!this.blocks.has(i)) this.blocks.set(i, this.build(i));
    }
    return [...this.blocks].filter(([idx]) => travel - idx * BLOCK < 61)
      .map(([idx, parts]) => ({ parts, offset: travel - idx * BLOCK }))
      .concat({ parts: this.skyline, offset: (travel % BLOCK) * .13 });
  }

  ground(b) {
    b.shape('road', 0, -.008, -73, ROAD_WIDTH, 190, 1, '#fff', 0, -Math.PI / 2);
  }
}

function emitModel(batch, model, root) {
  for (const [kind, numbers] of Object.entries(model.parts)) {
    for (let i = 0; i < numbers.length; i += 16) {
      batch.add(kind, transform(root, numbers, i), numbers.slice(i + 12, i + 15), numbers[i + 15]);
    }
  }
}

function buildVehicle(color, isVan = false, oncoming = false) {
  const b = new Batch(), height = isVan ? 2.41 : 1.46, depth = isVan ? 4.43 : 3.48;
  const bumper = depth / 2;
  box(b, 0, .39, 0, 1.85, .29, depth, '#242132');
  box(b, 0, .67, 0, 1.89, .54, depth - .05, color);
  box(b, 0, 1, isVan ? -.17 : -.18, 1.79, .36, depth - .26, color);
  box(b, 0, (height + 1.03) / 2, isVan ? -.15 : -.21, isVan ? 1.73 : 1.50,
    height - 1.03, isVan ? 3.54 : 1.81, isVan ? color : '#304560');
  box(b, 0, height + .012, -.22, isVan ? 1.79 : 1.55, .10, isVan ? 3.58 : 1.8, color);
  const glassZ = isVan ? 1.63 : .704;
  for (const z of [glassZ, isVan ? -1.93 : -1.122]) {
    box(b, 0, isVan ? 1.69 : 1.25, z, isVan ? 1.59 : 1.34, isVan ? .67 : .28, .04, '#4c7795', .16);
    box(b, 0, isVan ? 1.69 : 1.25, z + .029, .047, isVan ? .67 : .28, .042, '#1b2a3e');
  }
  for (const s of [-1, 1]) {
    for (const z of [-depth * .31, depth * .31]) {
      b.shape('cyl', s * .92, .37, z, .7, .23, .7, '#121622', 0, 0, 0, Math.PI / 2);
      b.shape('cyl', s, .37, z, .41, .12, .41, '#63738a', .1, 0, 0, Math.PI / 2);
      b.shape('cyl', s * 1.068, .37, z, .15, .04, .15, '#29374e', .1, 0, 0, Math.PI / 2);
    }
    box(b, s * .95, .82, 0, .035, .10, depth * .75, '#edbb91', .4);
    box(b, s * .88, isVan ? 1.78 : 1.26, -.49, .035, isVan ? .68 : .27, 1.12, '#4b6d88', .18);
    box(b, s * .972, 1.19, .58, .22, .13, .25, color);
    const lampTint = oncoming ? '#fff1bc' : '#ff4274';
    box(b, s * .67, .745, bumper + .008, .42, .17, .07, lampTint, .85);
    box(b, s * .72, .746, -bumper, .35, .16, .08, '#ffb29b', .56);
    glow(b, s * .67, .745, bumper + .07, 1.22, .74, lampTint, .48);
    reflected(b, s * .67, bumper + 2.3, .77, oncoming ? 10 : 6, lampTint, .35);
  }
  box(b, 0, .42, bumper + .035, 1.79, .13, .14, '#75809c');
  box(b, 0, .61, bumper + .047, .52, .22, .09, '#2a2843');
  box(b, 0, .61, bumper + .1, .31, .093, .025, '#a9dcee', .25);
  if (!isVan && !oncoming) {
    box(b, 0, 1.56, -.18, .61, .17, .30, '#ffd05a', .47);
    sign(b, 0, 1.56, -.024, .57, .18, 'TAXI', '#fff2dc');
  }
  if (isVan) {
    sign(b, 0, 2.13, bumper + .015, 1.48, .26, 'CARGO', '#e1ebff');
    for (const s of [-1, 1]) box(b, s * .76, 1.11, bumper + .025, .12, .65, .055, '#8b96a9');
  }
  b.shape('shadow', 0, .019, 0, 2.75, depth + 1.5, 1, '#06111e', .74, -Math.PI / 2);
  return b;
}

function buildLow() {
  const b = new Batch();
  for (const s of [-1, 1]) {
    box(b, s * .79, .11, 0, .39, .22, .92, '#343c50');
    box(b, s * .80, .445, 0, .13, .71, .19, '#aa744e');
    box(b, s * .83, .90, .055, .12, .13, .13, '#ffe0a1', .66);
    b.shape('cone', s * 1.02, .24, .63, .23, .48, .23, '#ff9651', .19);
    box(b, s * .46, .62, .245, .032, .033, .025, '#fff2ac', .55);
  }
  box(b, 0, .62, 0, 1.96, .43, .31, '#b7683e');
  for (let i = -2; i <= 2; i++) {
    box(b, i * .36, .62, .16, .18, .36, .045, i % 2 ? '#a0463e' : '#ffd373', .43, 0, 0, -.29);
  }
  box(b, 0, .835, .152, 1.95, .045, .052, '#ffcc74', .4);
  reflected(b, 0, .85, 1.45, 3.35, '#ffb06a', .26);
  return b;
}

function buildHigh() {
  const b = new Batch();
  for (const s of [-1, 1]) {
    box(b, s * 1.05, .12, 0, .24, .24, .56, '#3c3a58');
    box(b, s * 1.08, 1.19, 0, .125, 2.35, .16, '#80586e');
    box(b, s * 1.07, 2.25, .13, .12, .28, .12, '#ff7c93', .75);
  }
  box(b, 0, 1.86, 0, 2.08, 1.03, .41, '#742d59');
  for (const y of [1.37, 2.34]) box(b, 0, y, .22, 2.04, .08, .055, '#ff5a99', .69);
  sign(b, 0, 1.89, .216, 1.88, .63, '↓ DUCK', '#ffd5e8');
  for (const o of [-.91, .91]) box(b, o, 1.87, .23, .08, .63, .055, '#ff8ba6', .38);
  reflected(b, 0, .94, 1.66, 4.21, '#ff589b', .31);
  return b;
}

function trainModel() {
  const b = new Batch();
  for (const offset of [-8.4, 0, 8.4]) {
    box(b, offset, 1.27, 0, 8.14, 2.43, 2.41, '#596f87');
    box(b, offset, 2.46, 0, 7.92, .32, 2.20, '#524264');
    box(b, offset, .98, 1.217, 8.08, .20, .04, '#ff5c8d', .48);
    box(b, offset, .52, 1.234, 8.10, .13, .06, '#39415a');
    for (let i = -3; i <= 3; i++) {
      box(b, offset + i * 1.07, 1.79, 1.232, .88, .56, .055, '#9ed3ce', .31);
      box(b, offset + i * 1.07, 1.76, 1.265, .75, .05, .018, '#527598');
    }
  }
  return b;
}

const VEHICLES = {
  low: buildLow(), high: buildHigh(),
  taxi: buildVehicle('#d28b45'), van: buildVehicle('#775f9c', true),
  mover: buildVehicle('#387e99', false, true), train: trainModel()
};
