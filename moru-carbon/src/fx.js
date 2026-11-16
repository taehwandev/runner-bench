import * as THREE from 'three';

const MAX_SPARKS = 140;
const RAIN_COUNT = 220;

export class FxController {
  constructor(scene, speedCanvas) {
    this.scene = scene;
    this.speedCanvas = speedCanvas;
    this.sCtx = speedCanvas ? speedCanvas.getContext('2d') : null;
    this.shakeTrauma = 0;
    this.shakeClock = 0;
    this.camX = 0;
    this.camY = 4.6;
    this.camRoll = 0;

    // Pooled instanced sparks for pickups, near-misses, slide friction, and smashes
    const sparkGeo = new THREE.BoxGeometry(0.11, 0.11, 0.34);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    this.sparkInst = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
    this.sparkInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkInst.frustumCulled = false;
    scene.add(this.sparkInst);

    this.sparks = Array.from({ length: MAX_SPARKS }, () => ({
      active: false,
      x: 0,
      y: -999,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      color: new THREE.Color(0x00f0ff),
    }));
    this.dummy = new THREE.Object3D();
    for (let i = 0; i < MAX_SPARKS; i++) {
      this.dummy.position.set(0, -999, 0);
      this.dummy.updateMatrix();
      this.sparkInst.setMatrixAt(i, this.dummy.matrix);
      this.sparkInst.setColorAt(i, this.sparks[i].color);
    }

    // Atmospheric neon city rain streaks
    const rainPos = new Float32Array(RAIN_COUNT * 6);
    this.rainDrops = [];
    for (let i = 0; i < RAIN_COUNT; i++) {
      const rx = (Math.random() - 0.5) * 22;
      const ry = Math.random() * 18;
      const rz = 8 - Math.random() * 110;
      this.rainDrops.push({ x: rx, y: ry, z: rz });
      this.writeRainSegment(rainPos, i, rx, ry, rz);
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0x6ecbff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });
    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.rainLines.frustumCulled = false;
    scene.add(this.rainLines);

    this.speedLines = Array.from({ length: 28 }, (_, i) => ({
      angle: (i / 28) * Math.PI * 2 + Math.random() * 0.2,
      offset: Math.random(),
      len: 0.14 + Math.random() * 0.18,
    }));
  }

  writeRainSegment(arr, i, x, y, z) {
    const base = i * 6;
    arr[base] = x;
    arr[base + 1] = y;
    arr[base + 2] = z;
    arr[base + 3] = x - 0.08;
    arr[base + 4] = y - 0.95;
    arr[base + 5] = z + 0.55;
  }

  addShake(amount) {
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + amount);
  }

  burst({ x, y, z, colorHex = 0x00f0ff, count = 16, speed = 8.5 }) {
    let spawned = 0;
    for (const s of this.sparks) {
      if (s.active) continue;
      s.active = true;
      s.x = x;
      s.y = y;
      s.z = z;
      const theta = Math.random() * Math.PI * 2;
      const up = 0.25 + Math.random() * 0.95;
      s.vx = Math.cos(theta) * speed * (0.4 + Math.random() * 0.7);
      s.vy = up * speed;
      s.vz = Math.sin(theta) * speed * 0.6 + 4.0;
      s.maxLife = 0.28 + Math.random() * 0.28;
      s.life = s.maxLife;
      s.color.setHex(colorHex);
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  update(dt, state, camera, viewportW, viewportH) {
    this.shakeClock += dt;
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.1);

    // Emit slide sparks under runner's boots
    if (state.mode === 'playing' && state.alive && state.runner.isSliding && Math.random() < 0.75) {
      this.burst({
        x: state.runner.x + (Math.random() - 0.5) * 0.4,
        y: 0.12,
        z: 0.2,
        colorHex: 0xffbe0b,
        count: 2,
        speed: 4.2,
      });
    }

    // Update instanced sparks
    let dirtyColors = false;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = this.sparks[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.sparkInst.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += (s.vz + state.currentSpeed * 0.35) * dt;
      s.vy -= 22 * dt;
      const ratio = s.life / s.maxLife;
      this.dummy.position.set(s.x, Math.max(0.04, s.y), s.z);
      this.dummy.scale.set(ratio, ratio, ratio * 1.6);
      this.dummy.updateMatrix();
      this.sparkInst.setMatrixAt(i, this.dummy.matrix);
      this.sparkInst.setColorAt(i, s.color);
      dirtyColors = true;
    }
    this.sparkInst.instanceMatrix.needsUpdate = true;
    if (dirtyColors && this.sparkInst.instanceColor) {
      this.sparkInst.instanceColor.needsUpdate = true;
    }

    // Update falling neon rain
    const rainAttr = this.rainLines.geometry.attributes.position;
    const arr = rainAttr.array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const d = this.rainDrops[i];
      d.y -= 26 * dt;
      d.z += state.currentSpeed * 0.85 * dt;
      if (d.y < 0 || d.z > 12) {
        d.x = (Math.random() - 0.5) * 22;
        d.y = 14 + Math.random() * 6;
        d.z = -95 + Math.random() * 85;
      }
      this.writeRainSegment(arr, i, d.x, d.y, d.z);
    }
    rainAttr.needsUpdate = true;

    this.updateCamera(dt, state, camera, viewportW, viewportH);
    this.renderSpeedLines(dt, state, viewportW, viewportH);
  }

  updateCamera(dt, state, camera, viewportW, viewportH) {
    const aspect = viewportW / Math.max(1, viewportH);
    const portraitScale = aspect < 0.68 ? Math.min(1.42, 0.62 / Math.max(0.38, aspect)) : 1.0;

    if (state.mode === 'start') {
      const sway = Math.sin(this.shakeClock * 0.7) * 1.1;
      camera.position.set(sway, 4.9 * portraitScale, 10.2 * portraitScale);
      camera.lookAt(sway * 0.25, 2.0, -24);
      const demoFov = aspect < 0.68 ? 68 : 62;
      if (Math.abs(camera.fov - demoFov) > 0.1) {
        camera.fov = demoFov;
        camera.updateProjectionMatrix();
      }
      return;
    }

    const r = state.runner;
    const speedNorm = Math.min(1, (state.currentSpeed - 25) / 30);
    const nitro = state.powerups.nitro > 0 ? 1 : 0;

    const targetX = r.x * 0.56;
    const crouchOffset = r.isSliding ? -0.65 : 0;
    const targetY = (4.35 + r.y * 0.42 + crouchOffset) * portraitScale;
    const baseZ = (8.9 - nitro * 0.6) * portraitScale;

    this.camX += (targetX - this.camX) * Math.min(1, dt * 8.5);
    this.camY += (targetY - this.camY) * Math.min(1, dt * 8.5);

    const shakeMag = this.shakeTrauma * this.shakeTrauma * 0.55;
    const sx = Math.sin(this.shakeClock * 53) * shakeMag;
    const sy = Math.cos(this.shakeClock * 61) * shakeMag;

    camera.position.set(this.camX + sx, this.camY + sy, baseZ);
    camera.lookAt(r.x * 0.34 + sx * 0.5, 1.45 + r.y * 0.22, -16);

    const bankTarget = (this.camX - r.x * 0.56) * 0.09;
    this.camRoll += (bankTarget - this.camRoll) * Math.min(1, dt * 10);
    camera.rotation.z += this.camRoll;

    const targetFov = (aspect < 0.68 ? 68 : 62) + speedNorm * 6.5 + nitro * 7.5;
    if (Math.abs(camera.fov - targetFov) > 0.08) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6);
      camera.updateProjectionMatrix();
    }
  }

  renderSpeedLines(dt, state, w, h) {
    if (!this.sCtx || !w || !h) return;
    this.sCtx.clearRect(0, 0, w, h);
    if (state.mode !== 'playing') return;

    const nitro = state.powerups.nitro > 0;
    const intensity = nitro ? 0.85 : Math.max(0, (state.currentSpeed - 29) / 26) * 0.5;
    if (intensity <= 0.03) return;

    const cx = w * 0.5;
    const cy = h * 0.44;
    const maxR = Math.hypot(cx, cy);
    this.sCtx.save();
    this.sCtx.strokeStyle = nitro ? `rgba(255, 198, 40, ${intensity * 0.55})` : `rgba(0, 240, 255, ${intensity * 0.42})`;
    this.sCtx.lineWidth = nitro ? 2.4 : 1.5;

    for (const line of this.speedLines) {
      line.offset = (line.offset + dt * (nitro ? 3.8 : 2.1)) % 1;
      const r0 = maxR * (0.42 + line.offset * 0.45);
      const r1 = r0 + maxR * line.len * (0.6 + intensity);
      this.sCtx.beginPath();
      this.sCtx.moveTo(cx + Math.cos(line.angle) * r0, cy + Math.sin(line.angle) * r0);
      this.sCtx.lineTo(cx + Math.cos(line.angle) * r1, cy + Math.sin(line.angle) * r1);
      this.sCtx.stroke();
    }
    this.sCtx.restore();
  }
}
