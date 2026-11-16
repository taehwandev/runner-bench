import * as THREE from 'three';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function createRoadTextures() {
  const w = 512;
  const h = 512;
  const diffCanvas = makeCanvas(w, h);
  const dCtx = diffCanvas.getContext('2d');
  const roughCanvas = makeCanvas(w, h);
  const rCtx = roughCanvas.getContext('2d');

  dCtx.fillStyle = '#0b0e18';
  dCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = 'rgb(115,115,115)';
  rCtx.fillRect(0, 0, w, h);

  // Subtle asphalt grain + tire wear tracks
  for (let i = 0; i < 4200; i++) {
    const x = (i * 73) % w;
    const y = (i * 137) % h;
    const v = 12 + (i % 16);
    dCtx.fillStyle = `rgb(${v},${v + 3},${v + 10})`;
    dCtx.fillRect(x, y, 2, 2);
  }

  // Wet puddles (darker diffuse, ultra-smooth mirror roughness!)
  const puddles = [
    [120, 95, 75, 130],
    [375, 220, 85, 150],
    [245, 390, 95, 110],
    [155, 310, 55, 90],
    [350, 70, 60, 95],
  ];
  for (const [px, py, rx, ry] of puddles) {
    const gradR = rCtx.createRadialGradient(px, py, 6, px, py, Math.max(rx, ry));
    gradR.addColorStop(0, 'rgb(16,16,16)');
    gradR.addColorStop(0.7, 'rgb(34,34,34)');
    gradR.addColorStop(1, 'rgba(115,115,115,0)');
    rCtx.save();
    rCtx.translate(px, py);
    rCtx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    rCtx.fillStyle = gradR;
    rCtx.beginPath();
    rCtx.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2);
    rCtx.fill();
    rCtx.restore();

    dCtx.save();
    dCtx.translate(px, py);
    dCtx.scale(rx / 100, ry / 100);
    dCtx.fillStyle = 'rgba(4, 7, 15, 0.55)';
    dCtx.beginPath();
    dCtx.arc(0, 0, 95, 0, Math.PI * 2);
    dCtx.fill();
    dCtx.restore();
  }

  // Crisp outer shoulder lines & dashed lane dividers
  dCtx.fillStyle = '#00d8ff';
  dCtx.fillRect(22, 0, 6, h);
  dCtx.fillRect(w - 28, 0, 6, h);

  const dividerXs = [Math.round(w * 0.355), Math.round(w * 0.645)];
  dCtx.fillStyle = '#bfefff';
  for (const lx of dividerXs) {
    for (let y = 16; y < h; y += 64) {
      dCtx.fillRect(lx - 3, y, 6, 34);
    }
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 3);
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1, 3);

  return { map, roughnessMap };
}

export function createWindowTextures() {
  const styles = [
    { bg: '#080c1a', lit: ['#00f0ff', '#7ce8ff', '#ff2a9d', '#ffd166'] },
    { bg: '#0c0918', lit: ['#ff2a9d', '#ff9e00', '#00f0ff', '#c77dff'] },
    { bg: '#071118', lit: ['#39ff88', '#00e5ff', '#ffe66d', '#9ef01a'] },
  ];

  return styles.map((cfg, idx) => {
    const canvas = makeCanvas(256, 512);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(0, 0, 256, 512);

    // Structural mullions
    ctx.fillStyle = '#12182b';
    for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 4, 512);
    for (let y = 0; y < 512; y += 24) ctx.fillRect(0, y, 256, 4);

    let seed = (idx + 1) * 9173;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let row = 1; row < 20; row++) {
      const bandLit = rand() < 0.65;
      for (let col = 0; col < 8; col++) {
        const wx = col * 32 + 6;
        const wy = row * 24 + 5;
        if (bandLit && rand() < 0.46) {
          const color = cfg.lit[Math.floor(rand() * cfg.lit.length)];
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.55 + rand() * 0.45;
          ctx.fillRect(wx, wy, 20, 14);
        } else {
          ctx.fillStyle = '#0d1426';
          ctx.globalAlpha = 1;
          ctx.fillRect(wx, wy, 20, 14);
        }
      }
    }
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

export function createNeonSignTextures() {
  const signs = [
    { top: 'CYBER', main: 'PULSE', fg: '#00f0ff', sub: '#ff2a9d' },
    { top: '24H // OPEN', main: 'RAMEN', fg: '#ff2a9d', sub: '#ffbe0b' },
    { top: 'SECTOR 09', main: 'SYNTH', fg: '#39ff88', sub: '#00f0ff' },
    { top: 'NIGHT', main: 'ARCADE', fg: '#ffbe0b', sub: '#ff2a9d' },
    { top: 'EXPRESS', main: 'METRO', fg: '#00f0ff', sub: '#39ff88' },
    { top: 'CORP // AI', main: 'NEXUS', fg: '#c77dff', sub: '#00f0ff' },
  ];

  return signs.map((s) => {
    const canvas = makeCanvas(256, 128);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#060814';
    ctx.fillRect(0, 0, 256, 128);

    ctx.strokeStyle = s.fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 240, 112);

    ctx.strokeStyle = s.sub;
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 224, 96);

    ctx.fillStyle = s.sub;
    ctx.font = '700 20px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(s.top, 128, 44);

    ctx.fillStyle = s.fg;
    ctx.font = '900 46px system-ui, -apple-system, sans-serif';
    ctx.fillText(s.main, 128, 96);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

export function createHazardTexture() {
  const canvas = makeCanvas(256, 64);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14151c';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffb703';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 24, 64);
    ctx.lineTo(x + 52, 0);
    ctx.lineTo(x + 28, 0);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSoftGlowTexture() {
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.48)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
