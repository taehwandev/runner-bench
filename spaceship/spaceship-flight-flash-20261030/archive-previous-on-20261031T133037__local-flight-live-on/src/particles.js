import * as THREE from 'three';

/**
 * High-performance particle manager for spaceship flight effects:
 * - Engine exhaust spark & glow particles
 * - Ground dust & smoke kickup during takeoff & landing near pad
 */
export class ParticleManager {
  constructor(scene) {
    this.scene = scene;

    // Thruster exhaust particles
    this.exhaustMax = 120;
    this.exhaustIndex = 0;
    this.exhaustParticles = [];

    // Ground dust particles
    this.dustMax = 100;
    this.dustIndex = 0;
    this.dustParticles = [];

    this.initExhaustSystem();
    this.initDustSystem();
  }

  initExhaustSystem() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.exhaustMax * 3);
    const colors = new Float32Array(this.exhaustMax * 3);
    const sizes = new Float32Array(this.exhaustMax);

    for (let i = 0; i < this.exhaustMax; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = -100; // Off-screen initially
      positions[i * 3 + 2] = 0;

      colors[i * 3 + 0] = 0.22;
      colors[i * 3 + 1] = 0.74;
      colors[i * 3 + 2] = 0.97; // Cyan/blue
      sizes[i] = 0.0;

      this.exhaustParticles.push({
        position: new THREE.Vector3(0, -100, 0),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.6,
        size: 0.4
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    let pTexture = null;
    if (typeof document !== 'undefined') {
      // Particle texture created on canvas
      const pCanvas = document.createElement('canvas');
      pCanvas.width = 64;
      pCanvas.height = 64;
      const ctx = pCanvas.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.3, 'rgba(56,189,248,0.8)');
      grad.addColorStop(0.8, 'rgba(14,165,233,0.2)');
      grad.addColorStop(1, 'rgba(14,165,233,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      pTexture = new THREE.CanvasTexture(pCanvas);
    }

    const mat = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      map: pTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    this.exhaustMesh = new THREE.Points(geo, mat);
    this.scene.add(this.exhaustMesh);
  }

  initDustSystem() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.dustMax * 3);
    const colors = new Float32Array(this.dustMax * 3);
    const sizes = new Float32Array(this.dustMax);

    for (let i = 0; i < this.dustMax; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = -100;
      positions[i * 3 + 2] = 0;

      // Warm dusty gray-beige
      colors[i * 3 + 0] = 0.85;
      colors[i * 3 + 1] = 0.82;
      colors[i * 3 + 2] = 0.75;
      sizes[i] = 0.0;

      this.dustParticles.push({
        position: new THREE.Vector3(0, -100, 0),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1.2,
        size: 0.8
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    let dTexture = null;
    if (typeof document !== 'undefined') {
      // Dust puff texture
      const dCanvas = document.createElement('canvas');
      dCanvas.width = 64;
      dCanvas.height = 64;
      const ctx = dCanvas.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(230,220,205,0.7)');
      grad.addColorStop(0.5, 'rgba(210,200,185,0.3)');
      grad.addColorStop(1, 'rgba(200,190,175,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      dTexture = new THREE.CanvasTexture(dCanvas);
    }

    const mat = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      map: dTexture,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      sizeAttenuation: true
    });

    this.dustMesh = new THREE.Points(geo, mat);
    this.scene.add(this.dustMesh);
  }

  emitExhaust(pos, backDirection, throttle) {
    if (throttle < 0.15) return;
    const count = Math.ceil(throttle * 3);
    for (let c = 0; c < count; c++) {
      const p = this.exhaustParticles[this.exhaustIndex];
      p.position.copy(pos);
      // Small jitter at nozzle
      p.position.x += (Math.random() - 0.5) * 0.15;
      p.position.y += (Math.random() - 0.5) * 0.15;
      p.position.z += (Math.random() - 0.5) * 0.15;

      const speed = 10 + throttle * 15;
      p.velocity.copy(backDirection).multiplyScalar(speed);
      p.velocity.x += (Math.random() - 0.5) * 2.5;
      p.velocity.y += (Math.random() - 0.5) * 2.5;
      p.velocity.z += (Math.random() - 0.5) * 2.5;

      p.life = 0.5 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.size = 0.3 + throttle * 0.4;

      this.exhaustIndex = (this.exhaustIndex + 1) % this.exhaustMax;
    }
  }

  emitGroundDust(padCenter, throttle) {
    if (throttle < 0.25) return;
    const count = Math.ceil(throttle * 4);
    for (let c = 0; c < count; c++) {
      const p = this.dustParticles[this.dustIndex];
      const angle = Math.random() * Math.PI * 2;
      const dist = 1.0 + Math.random() * 2.2;

      p.position.set(
        padCenter.x + Math.cos(angle) * dist,
        0.42 + Math.random() * 0.2, // Just above pad
        padCenter.z + Math.sin(angle) * dist
      );

      const radialSpeed = 2.5 + throttle * 4.0;
      p.velocity.set(
        Math.cos(angle) * radialSpeed,
        0.4 + Math.random() * 0.8,
        Math.sin(angle) * radialSpeed
      );

      p.life = 0.8 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.size = 0.8 + Math.random() * 0.8;

      this.dustIndex = (this.dustIndex + 1) % this.dustMax;
    }
  }

  update(delta) {
    // Update exhaust particles
    const exPos = this.exhaustMesh.geometry.attributes.position.array;
    const exSizes = this.exhaustMesh.geometry.attributes.size.array;

    for (let i = 0; i < this.exhaustMax; i++) {
      const p = this.exhaustParticles[i];
      if (p.life > 0) {
        p.life -= delta;
        p.position.addScaledVector(p.velocity, delta);
        p.velocity.multiplyScalar(0.92); // Drag

        exPos[i * 3 + 0] = p.position.x;
        exPos[i * 3 + 1] = p.position.y;
        exPos[i * 3 + 2] = p.position.z;

        const lifeRatio = p.life / p.maxLife;
        exSizes[i] = p.size * lifeRatio;
      } else {
        exSizes[i] = 0;
        exPos[i * 3 + 1] = -100;
      }
    }
    this.exhaustMesh.geometry.attributes.position.needsUpdate = true;
    this.exhaustMesh.geometry.attributes.size.needsUpdate = true;

    // Update dust particles
    const dPos = this.dustMesh.geometry.attributes.position.array;
    const dSizes = this.dustMesh.geometry.attributes.size.array;

    for (let i = 0; i < this.dustMax; i++) {
      const p = this.dustParticles[i];
      if (p.life > 0) {
        p.life -= delta;
        p.position.addScaledVector(p.velocity, delta);
        p.velocity.y -= delta * 0.8; // Gravity/settling
        p.velocity.x *= 0.94;
        p.velocity.z *= 0.94;

        dPos[i * 3 + 0] = p.position.x;
        dPos[i * 3 + 1] = Math.max(0.3, p.position.y);
        dPos[i * 3 + 2] = p.position.z;

        const lifeRatio = p.life / p.maxLife;
        dSizes[i] = p.size * (1.0 + (1.0 - lifeRatio) * 1.5);
      } else {
        dSizes[i] = 0;
        dPos[i * 3 + 1] = -100;
      }
    }
    this.dustMesh.geometry.attributes.position.needsUpdate = true;
    this.dustMesh.geometry.attributes.size.needsUpdate = true;
  }
}
