import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;

    // --- Main Thruster Plasma Particles ---
    this.mainMax = 120;
    this.mainGeo = new THREE.BufferGeometry();
    this.mainPositions = new Float32Array(this.mainMax * 3);
    this.mainColors = new Float32Array(this.mainMax * 3);
    this.mainSizes = new Float32Array(this.mainMax);
    this.mainAlphas = new Float32Array(this.mainMax);

    this.mainParticles = [];
    for (let i = 0; i < this.mainMax; i++) {
      this.mainParticles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.45,
        size: 0.3
      });
    }

    this.mainGeo.setAttribute('position', new THREE.BufferAttribute(this.mainPositions, 3));
    this.mainGeo.setAttribute('color', new THREE.BufferAttribute(this.mainColors, 3));

    // Custom canvas texture for round soft particle
    const particleTex = this.createSoftCircleTexture();

    const mainMat = new THREE.PointsMaterial({
      size: 0.6,
      map: particleTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });
    this.mainPoints = new THREE.Points(this.mainGeo, mainMat);
    this.scene.add(this.mainPoints);

    // --- VTOL Ground Dust Particles ---
    this.dustMax = 180;
    this.dustGeo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.dustMax * 3);
    this.dustColors = new Float32Array(this.dustMax * 3);
    this.dustParticles = [];

    for (let i = 0; i < this.dustMax; i++) {
      this.dustParticles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.2,
        size: 0.8
      });
    }

    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    this.dustGeo.setAttribute('color', new THREE.BufferAttribute(this.dustColors, 3));

    const dustMat = new THREE.PointsMaterial({
      size: 1.8,
      map: particleTex,
      transparent: true,
      opacity: 0.45,
      blending: THREE.NormalBlending,
      depthWrite: false,
      vertexColors: true
    });
    this.dustPoints = new THREE.Points(this.dustGeo, dustMat);
    this.scene.add(this.dustPoints);

    this.emitMainTimer = 0;
    this.emitDustTimer = 0;
  }

  createSoftCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  emitMain(pos, dir, throttle) {
    if (throttle <= 0.05) return;

    // Find inactive particle
    for (let i = 0; i < this.mainParticles.length; i++) {
      const p = this.mainParticles[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.25 + Math.random() * 0.2;
        p.pos.copy(pos);
        // Jitter origin slightly
        p.pos.x += (Math.random() - 0.5) * 0.2;
        p.pos.y += (Math.random() - 0.5) * 0.2;
        
        // Shoot backwards relative to ship direction
        const speed = 12.0 * throttle + Math.random() * 6.0;
        p.vel.copy(dir).multiplyScalar(-speed);
        p.vel.x += (Math.random() - 0.5) * 2.0;
        p.vel.y += (Math.random() - 0.5) * 2.0;
        p.vel.z += (Math.random() - 0.5) * 2.0;
        break;
      }
    }
  }

  emitDust(groundPos, intensity) {
    if (intensity <= 0.05) return;

    // Emit radial puff on ground
    for (let i = 0; i < this.dustParticles.length; i++) {
      const p = this.dustParticles[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.8 + Math.random() * 0.6;
        
        // Spawn around pad center
        const angle = Math.random() * Math.PI * 2;
        const rad = 1.0 + Math.random() * 3.5;
        p.pos.set(
          groundPos.x + Math.cos(angle) * rad,
          groundPos.y + 0.2,
          groundPos.z + Math.sin(angle) * rad
        );

        // Expand radially outward and gently float up
        const speed = (3.0 + Math.random() * 6.0) * intensity;
        p.vel.set(
          Math.cos(angle) * speed,
          0.8 + Math.random() * 1.5,
          Math.sin(angle) * speed
        );
        break;
      }
    }
  }

  update(deltaSec, shipTransform, flightState) {
    if (deltaSec > 0.1) deltaSec = 0.1;

    const { position, quaternion, throttle, vtolThrottle, altitude } = flightState;

    // 1. Emit main thruster particles from rear nozzles
    if (throttle > 0.05) {
      this.emitMainTimer += deltaSec;
      const emitRate = 0.015 / Math.max(0.1, throttle);
      while (this.emitMainTimer >= emitRate) {
        this.emitMainTimer -= emitRate;

        // Nozzle offsets in ship local space
        const leftNozzleLocal = new THREE.Vector3(-0.45, 0.05, 1.6);
        const rightNozzleLocal = new THREE.Vector3(0.45, 0.05, 1.6);
        
        leftNozzleLocal.applyQuaternion(quaternion).add(position);
        rightNozzleLocal.applyQuaternion(quaternion).add(position);

        const shipForward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);

        this.emitMain(leftNozzleLocal, shipForward, throttle);
        this.emitMain(rightNozzleLocal, shipForward, throttle);
      }
    }

    // 2. Emit ground dust if low altitude and VTOL or main thrusters active
    if (altitude < 12.0 && vtolThrottle > 0.1) {
      this.emitDustTimer += deltaSec;
      const proximity = 1.0 - altitude / 12.0;
      const intensity = vtolThrottle * proximity;
      const dustRate = 0.03 / Math.max(0.1, intensity);

      while (this.emitDustTimer >= dustRate) {
        this.emitDustTimer -= dustRate;
        const padGround = new THREE.Vector3(position.x, 0.45, position.z);
        this.emitDust(padGround, intensity);
      }
    }

    // 3. Update main engine particles
    const mainPos = this.mainGeo.attributes.position.array;
    const mainCol = this.mainGeo.attributes.color.array;

    for (let i = 0; i < this.mainParticles.length; i++) {
      const p = this.mainParticles[i];
      const idx = i * 3;

      if (p.active) {
        p.life += deltaSec;
        if (p.life >= p.maxLife) {
          p.active = false;
          mainPos[idx + 1] = -9999;
          continue;
        }

        p.pos.addScaledVector(p.vel, deltaSec);
        p.vel.multiplyScalar(0.92); // Drag

        mainPos[idx] = p.pos.x;
        mainPos[idx + 1] = p.pos.y;
        mainPos[idx + 2] = p.pos.z;

        const progress = p.life / p.maxLife;
        // Cyan fading to dark blue
        const r = (1 - progress) * 0.2;
        const g = (1 - progress) * 0.9;
        const b = 1.0;
        const alpha = (1 - progress);

        mainCol[idx] = r * alpha;
        mainCol[idx + 1] = g * alpha;
        mainCol[idx + 2] = b * alpha;
      } else {
        mainPos[idx + 1] = -9999;
      }
    }

    this.mainGeo.attributes.position.needsUpdate = true;
    this.mainGeo.attributes.color.needsUpdate = true;

    // 4. Update dust particles
    const dustPos = this.dustGeo.attributes.position.array;
    const dustCol = this.dustGeo.attributes.color.array;

    for (let i = 0; i < this.dustParticles.length; i++) {
      const p = this.dustParticles[i];
      const idx = i * 3;

      if (p.active) {
        p.life += deltaSec;
        if (p.life >= p.maxLife) {
          p.active = false;
          dustPos[idx + 1] = -9999;
          continue;
        }

        p.pos.addScaledVector(p.vel, deltaSec);
        p.vel.multiplyScalar(0.95);
        p.vel.y += deltaSec * 0.3; // subtle thermal updraft

        dustPos[idx] = p.pos.x;
        dustPos[idx + 1] = p.pos.y;
        dustPos[idx + 2] = p.pos.z;

        const progress = p.life / p.maxLife;
        const alpha = Math.sin(progress * Math.PI) * 0.35;
        // Warm dust tone
        dustCol[idx] = 0.85 * alpha;
        dustCol[idx + 1] = 0.82 * alpha;
        dustCol[idx + 2] = 0.75 * alpha;
      } else {
        dustPos[idx + 1] = -9999;
      }
    }

    this.dustGeo.attributes.position.needsUpdate = true;
    this.dustGeo.attributes.color.needsUpdate = true;
  }
}
