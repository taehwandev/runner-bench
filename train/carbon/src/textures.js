import * as THREE from "three";
import { createRng } from "./rng.js";

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function buildTowerTextures(rng) {
  const w = 512;
  const h = 1024;
  const albedoCanvas = makeCanvas(w, h);
  const emissiveCanvas = makeCanvas(w, h);
  const aCtx = albedoCanvas.getContext("2d");
  const eCtx = emissiveCanvas.getContext("2d");

  // Frosted dark blue-slate concrete base
  aCtx.fillStyle = "#243042";
  aCtx.fillRect(0, 0, w, h);
  eCtx.fillStyle = "#000000";
  eCtx.fillRect(0, 0, w, h);

  // Heavy architectural vertical pilasters
  for (let x = 0; x < w; x += 32) {
    aCtx.fillStyle = "#2d3b50";
    aCtx.fillRect(x, 0, 7, h);
    aCtx.fillStyle = "#1a2332";
    aCtx.fillRect(x + 7, 0, 2, h);
  }

  const cols = 16;
  const rows = 64;
  const cellW = w / cols;
  const cellH = h / rows;

  for (let r = 0; r < rows; r++) {
    // Concrete spandrel slab on every floor + snow lip every 8 floors
    aCtx.fillStyle = r % 8 === 0 ? "#4c5f78" : "#1f2a3a";
    aCtx.fillRect(0, r * cellH, w, 4);

    if (r % 9 === 0) {
      aCtx.fillStyle = "#18212e";
      aCtx.fillRect(0, r * cellH + 4, w, cellH - 4);
      continue;
    }

    // Cohesive office/residential floor occupancy clusters rather than confetti
    const activeFloor = rng.chance(0.55);
    const floorDensity = activeFloor ? rng.range(0.22, 0.48) : rng.range(0.03, 0.1);
    let streakLit = false;

    for (let c = 0; c < cols; c++) {
      const px = c * cellW + 9;
      const py = r * cellH + 5;
      const pw = cellW - 12;
      const ph = cellH - 7;

      // Dark reflective glass pane
      aCtx.fillStyle = "#182436";
      aCtx.fillRect(px, py, pw, ph);

      if (streakLit ? rng.chance(0.62) : rng.chance(floorDensity)) {
        streakLit = true;
        const roll = rng.next();
        if (roll < 0.76) {
          const g = rng.int(178, 214);
          const b = rng.int(118, 160);
          eCtx.fillStyle = `rgb(245, ${g}, ${b})`;
        } else {
          eCtx.fillStyle = `rgb(148, ${rng.int(196, 226)}, 248)`;
        }
        eCtx.globalAlpha = rng.range(0.32, 0.78);
        eCtx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
        eCtx.globalAlpha = 1.0;
      } else {
        streakLit = false;
      }
    }
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  const emissive = new THREE.CanvasTexture(emissiveCanvas);
  for (const tex of [albedo, emissive]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  return { albedo, emissive };
}

function buildMonolithTexture(rng) {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#263244";
  ctx.fillRect(0, 0, size, size);

  // Deep brutalist fluted concrete ribs & subtle frost streaks
  for (let x = 0; x < size; x += 16) {
    const v = rng.int(34, 54);
    ctx.fillStyle = `rgb(${v}, ${v + 10}, ${v + 22})`;
    ctx.fillRect(x, 0, 10, size);
    ctx.fillStyle = "rgba(12, 18, 28, 0.65)";
    ctx.fillRect(x + 10, 0, 3, size);
  }
  for (let y = 0; y < size; y += 64) {
    ctx.fillStyle = "rgba(180, 205, 232, 0.22)";
    ctx.fillRect(0, y, size, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildArmorTextures(rng) {
  const size = 512;
  const albedoCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const aCtx = albedoCanvas.getContext("2d");
  const bCtx = bumpCanvas.getContext("2d");

  aCtx.fillStyle = "#3c4d63";
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = "#808080";
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const y = rng.range(0, size);
    const len = rng.range(30, 180);
    const x = rng.range(-40, size);
    const v = rng.int(52, 88);
    aCtx.fillStyle = `rgba(${v}, ${v + 12}, ${v + 24}, 0.28)`;
    aCtx.fillRect(x, y, len, rng.range(1, 2.5));
  }

  for (let px = 0; px < size; px += 64) {
    bCtx.fillStyle = "#404040";
    bCtx.fillRect(px, 0, 3, size);
    aCtx.fillStyle = "rgba(16, 22, 32, 0.6)";
    aCtx.fillRect(px, 0, 2, size);
    for (let py = 10; py < size; py += 18) {
      bCtx.fillStyle = "#e2e2e2";
      bCtx.fillRect(px + 6, py, 3, 3);
      bCtx.fillRect(px + 55, py, 3, 3);
    }
  }
  for (let py = 0; py < size; py += 128) {
    bCtx.fillStyle = "#424242";
    bCtx.fillRect(0, py, size, 2);
    aCtx.fillStyle = "rgba(210, 228, 248, 0.24)";
    aCtx.fillRect(0, py + 2, size, 5);
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  const bump = new THREE.CanvasTexture(bumpCanvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump };
}

function buildConcreteSnowTexture(rng) {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#cddae9";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4500; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const r = rng.range(1, 6);
    const shade = rng.int(178, 248);
    ctx.fillStyle = `rgba(${shade}, ${Math.min(255, shade + 8)}, 255, 0.28)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSoftGlowTexture() {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.32, "rgba(245, 250, 255, 0.85)");
  grad.addColorStop(0.68, "rgba(215, 232, 255, 0.28)");
  grad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSteamTexture(rng) {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const half = size / 2;

  for (let i = 0; i < 18; i++) {
    const ox = half + rng.signed() * 20;
    const oy = half + rng.signed() * 20;
    const rad = rng.range(24, 44);
    const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, rad);
    grad.addColorStop(0.0, "rgba(238, 245, 255, 0.22)");
    grad.addColorStop(0.55, "rgba(210, 225, 245, 0.09)");
    grad.addColorStop(1.0, "rgba(195, 215, 240, 0.0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ox, oy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createProceduralTextures() {
  const rng = createRng(771209);
  const tower = buildTowerTextures(rng);
  const monolith = buildMonolithTexture(rng);
  const armor = buildArmorTextures(rng);
  const snow = buildConcreteSnowTexture(rng);
  const softGlow = buildSoftGlowTexture();
  const steam = buildSteamTexture(rng);

  return {
    towerAlbedo: tower.albedo,
    towerEmissive: tower.emissive,
    monolithMap: monolith,
    armorMap: armor.map,
    armorBump: armor.bump,
    snowMap: snow,
    softGlow,
    steam,
  };
}
