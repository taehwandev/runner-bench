import * as THREE from 'three';

// Seeded deterministic PRNG for crisp repeatable procedural textures
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createNeonEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x050818);

  // Horizon atmospheric dome
  const domeGeo = new THREE.SphereGeometry(60, 24, 16);
  const domeCanvas = makeCanvas(64, 128);
  const dctx = domeCanvas.getContext('2d');
  const grad = dctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0.0, '#02040c');
  grad.addColorStop(0.42, '#091230');
  grad.addColorStop(0.5, '#1c3b72');
  grad.addColorStop(0.55, '#3a1458');
  grad.addColorStop(0.65, '#070c1c');
  grad.addColorStop(1.0, '#020308');
  dctx.fillStyle = grad;
  dctx.fillRect(0, 0, 64, 128);

  const domeTex = new THREE.CanvasTexture(domeCanvas);
  domeTex.colorSpace = THREE.SRGBColorSpace;
  const domeMat = new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide });
  envScene.add(new THREE.Mesh(domeGeo, domeMat));

  // Neon light columns around horizon so wet puddles & car bodies catch vivid reflections
  const palette = [0x00f0ff, 0xff1e8a, 0xffb800, 0x00a8ff, 0xb65cff, 0x39ff14];
  const panelGeo = new THREE.PlaneGeometry(5, 22);
  const disposables = [domeGeo, domeMat, domeTex, panelGeo];

  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const mat = new THREE.MeshBasicMaterial({
      color: palette[i % palette.length],
      side: THREE.DoubleSide
    });
    disposables.push(mat);
    const m = new THREE.Mesh(panelGeo, mat);
    m.position.set(Math.cos(angle) * 42, 7 + (i % 3) * 4, Math.sin(angle) * 42);
    m.lookAt(0, 6, 0);
    envScene.add(m);
  }

  const rt = pmrem.fromScene(envScene, 0.035);
  disposables.forEach((d) => d.dispose && d.dispose());
  pmrem.dispose();
  return rt.texture;
}

export function createTextureLibrary(renderer) {
  const envMap = createNeonEnvMap(renderer);
  const road = createWetRoadTextures();
  const sidewalk = createSidewalkTexture();
  const buildings = createBuildingTextures();
  const signs = createNeonSignTextures();
  const hazard = createHazardStripeTexture();
  const slideGate = createSlideGateTexture();
  const railGate = createRailGateTexture();
  const wetStreak = createWetStreakTexture();
  const glowSprite = createGlowSpriteTexture();
  const safeChevron = createSafeChevronTexture();
  const tunnelWall = createTunnelWallTexture();

  return {
    envMap,
    road,
    sidewalk,
    buildings,
    signs,
    hazard,
    slideGate,
    railGate,
    wetStreak,
    glowSprite,
    safeChevron,
    tunnelWall
  };
}

function createWetRoadTextures() {
  const W = 512;
  const H = 1024;
  const rand = mulberry32(90210);

  const diffC = makeCanvas(W, H);
  const dctx = diffC.getContext('2d');

  const roughC = makeCanvas(W, H);
  const rctx = roughC.getContext('2d');

  const bumpC = makeCanvas(W / 2, H / 2);
  const bctx = bumpC.getContext('2d');

  // Base damp asphalt
  dctx.fillStyle = '#0b0e18';
  dctx.fillRect(0, 0, W, H);

  rctx.fillStyle = '#8c8c8c'; // ~0.55 roughness default
  rctx.fillRect(0, 0, W, H);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, W / 2, H / 2);

  // Mineral aggregate noise
  for (let i = 0; i < 16000; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const v = Math.floor(10 + rand() * 22);
    dctx.fillStyle = `rgb(${v},${v + 2},${v + 8})`;
    dctx.fillRect(x, y, 2, 2);

    const bv = Math.floor(105 + rand() * 55);
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(x * 0.5, y * 0.5, 1.5, 1.5);
  }

  // Subtle polished wheel tracks down the 3 lanes (normalized X: ~0.23, 0.50, 0.77)
  const laneCenters = [0.232 * W, 0.5 * W, 0.768 * W];
  laneCenters.forEach((cx) => {
    [-22, 22].forEach((offset) => {
      const g = rctx.createLinearGradient(cx + offset - 16, 0, cx + offset + 16, 0);
      g.addColorStop(0, 'rgba(35,35,35,0)');
      g.addColorStop(0.5, 'rgba(32,32,32,0.55)');
      g.addColorStop(1, 'rgba(35,35,35,0)');
      rctx.fillStyle = g;
      rctx.fillRect(cx + offset - 16, 0, 32, H);
    });
  });

  // Seamless mirror-glossy rainwater puddles (wrap vertically around H!)
  for (let i = 0; i < 28; i++) {
    const px = 40 + rand() * (W - 80);
    const py = rand() * H;
    const rx = 28 + rand() * 68;
    const ry = 45 + rand() * 120;

    const drawPuddle = (yy) => {
      const pg = rctx.createRadialGradient(px, yy, rx * 0.15, px, yy, Math.max(rx, ry));
      pg.addColorStop(0, 'rgba(8, 8, 8, 0.95)');
      pg.addColorStop(0.68, 'rgba(14, 14, 14, 0.82)');
      pg.addColorStop(1, 'rgba(140, 140, 140, 0)');

      rctx.save();
      rctx.translate(px, yy);
      rctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
      rctx.translate(-px, -yy);
      rctx.fillStyle = pg;
      rctx.beginPath();
      rctx.arc(px, yy, Math.max(rx, ry), 0, Math.PI * 2);
      rctx.fill();
      rctx.restore();

      // Darken diffuse slightly inside puddle + flatten bump
      dctx.save();
      dctx.translate(px, yy);
      dctx.scale(rx / 60, ry / 60);
      const dg = dctx.createRadialGradient(0, 0, 5, 0, 0, 60);
      dg.addColorStop(0, 'rgba(4, 7, 16, 0.72)');
      dg.addColorStop(1, 'rgba(4, 7, 16, 0)');
      dctx.fillStyle = dg;
      dctx.beginPath();
      dctx.arc(0, 0, 60, 0, Math.PI * 2);
      dctx.fill();
      dctx.restore();

      bctx.save();
      bctx.translate(px * 0.5, yy * 0.5);
      bctx.scale(rx / 120, ry / 120);
      bctx.fillStyle = 'rgba(128,128,128,0.85)';
      bctx.beginPath();
      bctx.arc(0, 0, 60, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    };

    drawPuddle(py);
    if (py < ry) drawPuddle(py + H);
    if (py > H - ry) drawPuddle(py - H);
  }

  // Outer road shoulder solid neon-cyan & amber edge lines
  dctx.fillStyle = '#00d8f0';
  dctx.fillRect(18, 0, 6, H);
  dctx.fillRect(W - 24, 0, 6, H);

  dctx.fillStyle = 'rgba(255, 190, 40, 0.75)';
  dctx.fillRect(28, 0, 3, H);
  dctx.fillRect(W - 31, 0, 3, H);

  // Storm drain grates along gutter
  dctx.fillStyle = '#192236';
  for (let y = 64; y < H; y += 256) {
    for (let s = 0; s < 5; s++) {
      dctx.fillRect(6, y + s * 7, 9, 4);
      dctx.fillRect(W - 15, y + s * 7, 9, 4);
    }
  }

  // Dashed lane dividers at 1/3 and 2/3 road width
  const divX = [Math.round(W * 0.366), Math.round(W * 0.634)];
  divX.forEach((x) => {
    for (let y = 0; y < H; y += 128) {
      dctx.fillStyle = '#d8f6ff';
      dctx.fillRect(x - 4, y + 18, 8, 68);
      dctx.fillStyle = 'rgba(0, 240, 255, 0.38)';
      dctx.fillRect(x - 7, y + 14, 14, 76);

      rctx.fillStyle = '#484848';
      rctx.fillRect(x - 4, y + 18, 8, 68);
    }
  });

  const map = new THREE.CanvasTexture(diffC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpC);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap, bumpMap };
}

function createSidewalkTexture() {
  const c = makeCanvas(256, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#121728';
  ctx.fillRect(0, 0, 256, 512);

  // Wet paving tiles
  ctx.strokeStyle = '#080b14';
  ctx.lineWidth = 3;
  for (let y = 0; y < 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Glowing curb safety strip on inner edge
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(0, 0, 10, 512);
  ctx.fillStyle = '#1e2742';
  ctx.fillRect(10, 0, 14, 512);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBuildingTextures() {
  const variants = [
    { wall: '#0a1022', frame: '#15203d', cols: 8, rows: 18, palette: ['#84f2ff', '#ffd685', '#ff59b6', '#3caeff'] },
    { wall: '#100d21', frame: '#1f183b', cols: 6, rows: 16, palette: ['#ffb84d', '#ff2e93', '#70f8ff', '#ffe9b3'] },
    { wall: '#09141d', frame: '#132838', cols: 10, rows: 20, palette: ['#59ffd1', '#9beeff', '#ffc857', '#5ea4ff'] },
    { wall: '#141118', frame: '#26202e', cols: 5, rows: 14, palette: ['#ff8826', '#ffd066', '#00f0ff', '#ff3b7f'] }
  ];

  return variants.map((cfg, idx) => {
    const W = 256;
    const H = 512;
    const rand = mulberry32(4100 + idx * 137);

    const diffC = makeCanvas(W, H);
    const dctx = diffC.getContext('2d');
    const emiC = makeCanvas(W, H);
    const ectx = emiC.getContext('2d');

    dctx.fillStyle = cfg.wall;
    dctx.fillRect(0, 0, W, H);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, W, H);

    // Architectural pilasters & floor spandrels
    const cellW = W / cfg.cols;
    const cellH = H / cfg.rows;

    for (let r = 0; r < cfg.rows; r++) {
      dctx.fillStyle = cfg.frame;
      dctx.fillRect(0, r * cellH, W, 4);

      const floorLitBias = 0.28 + rand() * 0.45;
      for (let c = 0; c < cfg.cols; c++) {
        const wx = c * cellW + 5;
        const wy = r * cellH + 6;
        const ww = cellW - 10;
        const wh = cellH - 10;

        const isLit = rand() < floorLitBias;
        if (isLit) {
          const col = cfg.palette[Math.floor(rand() * cfg.palette.length)];
          dctx.fillStyle = col;
          dctx.fillRect(wx, wy, ww, wh);

          ectx.fillStyle = col;
          ectx.globalAlpha = 0.55 + rand() * 0.45;
          ectx.fillRect(wx, wy, ww, wh);
          ectx.globalAlpha = 1.0;

          // Interior blinds / silhouette detail
          if (rand() < 0.45) {
            const blindH = wh * (0.25 + rand() * 0.35);
            dctx.fillStyle = 'rgba(10, 14, 28, 0.55)';
            dctx.fillRect(wx, wy, ww, blindH);
            ectx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ectx.fillRect(wx, wy, ww, blindH);
          }
        } else {
          dctx.fillStyle = '#0d162c';
          dctx.fillRect(wx, wy, ww, wh);
        }
      }
    }

    const map = new THREE.CanvasTexture(diffC);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;

    const emissiveMap = new THREE.CanvasTexture(emiC);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.wrapT = THREE.RepeatWrapping;

    return { map, emissiveMap };
  });
}

function createNeonSignTextures() {
  const specs = [
    { w: 128, h: 384, vertical: true, bg: '#070b1e', fg: '#00f0ff', accent: '#ff1e8a', lines: ['ネ', 'オ', 'ン', '09'] },
    { w: 128, h: 384, vertical: true, bg: '#16061c', fg: '#ff1e8a', accent: '#ffc400', lines: ['電', '脳', '街', '★'] },
    { w: 128, h: 384, vertical: true, bg: '#081518', fg: '#39ff14', accent: '#00f0ff', lines: ['超', '速', '度', '>>'] },
    { w: 128, h: 384, vertical: true, bg: '#1a0f05', fg: '#ffb800', accent: '#ff3b7f', lines: ['夜', '行', '線', '24'] },
    { w: 384, h: 144, vertical: false, bg: '#060c22', fg: '#00f0ff', accent: '#ff1e8a', text: 'NIGHTLINE', sub: 'HYPER EXPRESS // 24H' },
    { w: 384, h: 144, vertical: false, bg: '#190621', fg: '#ff2e93', accent: '#ffd000', text: 'SYNTH CLUB', sub: 'SECTOR 09 ARCADE' },
    { w: 384, h: 144, vertical: false, bg: '#141004', fg: '#ffc400', accent: '#00f0ff', text: 'CYBER RAMEN', sub: 'OPEN ALL NIGHT ★' },
    { w: 384, h: 144, vertical: false, bg: '#0d0724', fg: '#b65cff', accent: '#39ff14', text: 'PULSE CORP', sub: 'NEURAL OPTICS LAB' }
  ];

  return specs.map((s) => {
    const c = makeCanvas(s.w, s.h);
    const ctx = c.getContext('2d');

    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, s.w, s.h);

    // Subtle scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < s.h; y += 6) {
      ctx.fillRect(0, y, s.w, 2);
    }

    // Double neon tube border
    ctx.strokeStyle = s.fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, s.w - 16, s.h - 16);

    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(16, 16, s.w - 32, s.h - 32);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (s.vertical) {
      ctx.font = '900 54px sans-serif';
      const step = (s.h - 64) / s.lines.length;
      s.lines.forEach((ch, i) => {
        ctx.fillStyle = i === s.lines.length - 1 ? s.accent : s.fg;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 14;
        ctx.fillText(ch, s.w / 2, 48 + step * (i + 0.5));
      });
    } else {
      ctx.fillStyle = s.fg;
      ctx.shadowColor = s.fg;
      ctx.shadowBlur = 16;
      ctx.font = 'italic 900 44px sans-serif';
      ctx.fillText(s.text, s.w / 2, s.h * 0.43);

      ctx.fillStyle = s.accent;
      ctx.shadowColor = s.accent;
      ctx.shadowBlur = 10;
      ctx.font = '800 18px monospace';
      ctx.fillText(s.sub, s.w / 2, s.h * 0.75);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { tex, vertical: s.vertical, color: new THREE.Color(s.fg) };
  });
}

function createHazardStripeTexture() {
  const c = makeCanvas(256, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#14161f';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#ff9d00';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 24, 64);
    ctx.lineTo(x + 48, 0);
    ctx.lineTo(x + 24, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(0, 0, 256, 5);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createSlideGateTexture() {
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);

  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(0, 240, 255, 0.92)');
  grad.addColorStop(0.35, 'rgba(0, 195, 255, 0.45)');
  grad.addColorStop(0.85, 'rgba(255, 30, 138, 0.38)');
  grad.addColorStop(1, 'rgba(255, 30, 138, 0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);

  // Scanlines
  ctx.fillStyle = 'rgba(4, 10, 24, 0.38)';
  for (let y = 0; y < 128; y += 8) {
    ctx.fillRect(0, y, 256, 3);
  }

  // Bold downward SLIDE chevrons
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 12;
  ctx.fillText('▼ SLIDE ▼', 128, 52);

  ctx.strokeStyle = '#ffdf4d';
  ctx.lineWidth = 4;
  [52, 128, 204].forEach((cx) => {
    ctx.beginPath();
    ctx.moveTo(cx - 18, 84);
    ctx.lineTo(cx, 104);
    ctx.lineTo(cx + 18, 84);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRailGateTexture() {
  const c = makeCanvas(256, 32);
  const ctx = c.getContext('2d');
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = (x / 32) % 2 === 0 ? '#ff1e42' : '#f4f8ff';
    ctx.fillRect(x, 0, 32, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function createWetStreakTexture() {
  const c = makeCanvas(128, 256);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 256);

  const g = ctx.createRadialGradient(64, 128, 4, 64, 128, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.88)');
  g.addColorStop(0.32, 'rgba(255,255,255,0.38)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.save();
  ctx.scale(1, 2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(64, 64, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Horizontal wet asphalt ripple breakup lines
  ctx.globalCompositeOperation = 'destination-out';
  const rand = mulberry32(77);
  for (let y = 0; y < 256; y += 5) {
    if (rand() < 0.45) {
      ctx.fillStyle = `rgba(0,0,0,${(0.18 + rand() * 0.32).toFixed(2)})`;
      ctx.fillRect(0, y, 128, 2);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGlowSpriteTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSafeChevronTexture() {
  const c = makeCanvas(128, 256);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 256);
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#39ff14';
  ctx.shadowBlur = 12;

  for (let y = 44; y <= 212; y += 72) {
    ctx.beginPath();
    ctx.moveTo(26, y + 24);
    ctx.lineTo(64, y - 12);
    ctx.lineTo(102, y + 24);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTunnelWallTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0d1324';
  ctx.fillRect(0, 0, 256, 256);

  // Ceramic subway/underpass tiles
  ctx.strokeStyle = '#182442';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  for (let x = 0; x < 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  // Horizontal hazard waist band
  ctx.fillStyle = '#ffb800';
  ctx.fillRect(0, 178, 256, 10);
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(0, 62, 256, 6);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
