import * as THREE from 'three';

/**
 * Creates high-detail procedural canvas textures
 */
export function createPadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Base background (dark technical composite)
  ctx.fillStyle = '#1e242c';
  ctx.fillRect(0, 0, 1024, 1024);

  // Concentric concrete pad circles
  ctx.beginPath();
  ctx.arc(512, 512, 490, 0, Math.PI * 2);
  ctx.fillStyle = '#262f3a';
  ctx.fill();

  // Subtle radial seams
  ctx.strokeStyle = '#181e26';
  ctx.lineWidth = 4;
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16;
    ctx.beginPath();
    ctx.moveTo(512, 512);
    ctx.lineTo(512 + Math.cos(angle) * 490, 512 + Math.sin(angle) * 490);
    ctx.stroke();
  }

  // Inner ring
  ctx.beginPath();
  ctx.arc(512, 512, 380, 0, Math.PI * 2);
  ctx.fillStyle = '#2d3744';
  ctx.fill();
  ctx.strokeStyle = '#3d4d60';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Outer hazard border ring (yellow & black stripes)
  ctx.save();
  ctx.translate(512, 512);
  const outerR = 470;
  const innerR = 430;
  const numStripes = 48;
  for (let i = 0; i < numStripes; i++) {
    const a1 = (i * Math.PI * 2) / numStripes;
    const a2 = ((i + 1) * Math.PI * 2) / numStripes;
    ctx.beginPath();
    ctx.arc(0, 0, outerR, a1, a2);
    ctx.arc(0, 0, innerR, a2, a1, true);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#ffb703' : '#14181f';
    ctx.fill();
  }
  ctx.restore();

  // Guidance concentric rings
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(512, 512, 320, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.setLineDash([20, 15]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(512, 512, 240, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crosshair brackets
  ctx.strokeStyle = '#ffb703';
  ctx.lineWidth = 10;
  const len = 70;
  const d = 160;
  // Top-left
  ctx.strokeRect(512 - d - len, 512 - d - 5, len, 10);
  ctx.strokeRect(512 - d - 5, 512 - d - len, 10, len);
  // Top-right
  ctx.strokeRect(512 + d, 512 - d - 5, len, 10);
  ctx.strokeRect(512 + d - 5, 512 - d - len, 10, len);
  // Bottom-left
  ctx.strokeRect(512 - d - len, 512 + d - 5, len, 10);
  ctx.strokeRect(512 - d - 5, 512 + d, 10, len);
  // Bottom-right
  ctx.strokeRect(512 + d, 512 + d - 5, len, 10);
  ctx.strokeRect(512 + d - 5, 512 + d, 10, len);

  // Center Landing "H" & "PAD 04" designation
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 96px "Rajdhani", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('04', 512, 450);

  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 36px "Rajdhani", "Segoe UI", sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText('LAUNCH PAD ALPHA', 512, 570);

  // Center target pip
  ctx.beginPath();
  ctx.arc(512, 512, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#00f0ff';
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Procedural solar panel texture
 */
export function createSolarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f2038';
  ctx.fillRect(0, 0, 512, 512);

  // Cell grid
  const cols = 8;
  const rows = 8;
  const pad = 3;
  const cw = (512 - (cols + 1) * pad) / cols;
  const ch = (512 - (rows + 1) * pad) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * (cw + pad);
      const y = pad + r * (ch + pad);
      const grad = ctx.createLinearGradient(x, y, x + cw, y + ch);
      grad.addColorStop(0, '#13355a');
      grad.addColorStop(0.5, '#1e528a');
      grad.addColorStop(1, '#0e2b4c');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cw, ch);

      // Fine cell busbars
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + cw * 0.33, y);
      ctx.lineTo(x + cw * 0.33, y + ch);
      ctx.moveTo(x + cw * 0.66, y);
      ctx.lineTo(x + cw * 0.66, y + ch);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Creates hazard stripes texture
 */
export function createHazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1c1f26';
  ctx.fillRect(0, 0, 256, 64);

  const stripeW = 24;
  ctx.fillStyle = '#ffbe0b';
  for (let x = -64; x < 256 + 64; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - 32, 64);
    ctx.lineTo(x - 32, 64);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
