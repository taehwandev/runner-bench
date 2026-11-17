import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.dustParticles = [];

    // Shared geometry for sparks/exhaust
    this.sparkGeo = new THREE.BufferGeometry();
    const sparkCount = 200;
    this.sparkPositions = new Float32Array(sparkCount * 3);
    this.sparkColors = new Float32Array(sparkCount * 3);
    this.sparkSizes = new Float32Array(sparkCount);
    
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));
    this.sparkGeo.setAttribute('size', new THREE.BufferAttribute(this.sparkSizes, 1));

    // Create soft round particle texture procedurally
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(100, 220, 255, 0.8)');
    grad.addColorStop(0.7, 'rgba(30, 140, 255, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const particleTexture = new THREE.CanvasTexture(canvas);

    this.sparkMaterial = new THREE.PointsMaterial({
      size: 0.6,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    this.sparkMesh = new THREE.Points(this.sparkGeo, this.sparkMaterial);
    this.sparkMesh.frustumCulled = false;
    this.scene.add(this.sparkMesh);

    // Dust shockwave texture (sand/dust)
    const dustCanvas = document.createElement('canvas');
    dustCanvas.width = 64;
    dustCanvas.height = 64;
    const dCtx = dustCanvas.getContext('2d');
    const dGrad = dCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    dGrad.addColorStop(0, 'rgba(220, 205, 180, 0.8)');
    dGrad.addColorStop(0.4, 'rgba(180, 160, 140, 0.4)');
    dGrad.addColorStop(1, 'rgba(150, 130, 110, 0)');
    dCtx.fillStyle = dGrad;
    dCtx.fillRect(0, 0, 64, 64);
    const dustTexture = new THREE.CanvasTexture(dustCanvas);

    this.dustGeo = new THREE.BufferGeometry();
    const dustCount = 120;
    this.dustPositions = new Float32Array(dustCount * 3);
    this.dustColors = new Float32Array(dustCount * 3);
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    this.dustGeo.setAttribute('color', new THREE.BufferAttribute(this.dustColors, 3));

    this.dustMaterial = new THREE.PointsMaterial({
      size: 1.8,
      map: dustTexture,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      vertexColors: true
    });

    this.dustMesh = new THREE.Points(this.dustGeo, this.dustMaterial);
    this.dustMesh.frustumCulled = false;
    this.scene.add(this.dustMesh);

    // Pool setup
    for (let i = 0; i < sparkCount; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(0, -999, 0),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        color: new THREE.Color(0.2, 0.7, 1.0)
      });
    }

    for (let i = 0; i < dustCount; i++) {
      this.dustParticles.push({
        active: false,
        pos: new THREE.Vector3(0, -999, 0),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        opacity: 0
      });
    }
  }

  emitEngineSpark(position, direction, speed = 4, spread = 0.5, color = new THREE.Color(0.3, 0.8, 1.0)) {
    const p = this.particles.find(pt => !pt.active);
    if (!p) return;

    p.active = true;
    p.pos.copy(position);
    p.vel.copy(direction).multiplyScalar(-speed);
    p.vel.x += (Math.random() - 0.5) * spread;
    p.vel.y += (Math.random() - 0.5) * spread;
    p.vel.z += (Math.random() - 0.5) * spread;
    p.life = 0;
    p.maxLife = 0.25 + Math.random() * 0.35;
    p.color.copy(color);
  }

  emitLandingDust(padCenter, shipY, intensity = 1.0) {
    if (shipY > 8.0) return;
    const count = Math.floor(intensity * 4);
    for (let c = 0; c < count; c++) {
      const p = this.dustParticles.find(pt => !pt.active);
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const radius = 1.0 + Math.random() * 3.5;
      p.active = true;
      p.pos.set(
        padCenter.x + Math.cos(angle) * radius,
        padCenter.y + 0.1 + Math.random() * 0.2,
        padCenter.z + Math.sin(angle) * radius
      );
      const speed = 2.0 + Math.random() * 4.0;
      p.vel.set(
        Math.cos(angle) * speed,
        0.3 + Math.random() * 0.8,
        Math.sin(angle) * speed
      );
      p.life = 0;
      p.maxLife = 0.6 + Math.random() * 0.6;
      p.opacity = 0.5 + Math.random() * 0.3;
    }
  }

  update(delta) {
    // Update sparks
    const posArr = this.sparkPositions;
    const colArr = this.sparkColors;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.pos.set(0, -999, 0);
        } else {
          p.pos.addScaledVector(p.vel, delta);
          const ratio = 1 - p.life / p.maxLife;
          colArr[i * 3] = p.color.r * ratio;
          colArr[i * 3 + 1] = p.color.g * ratio;
          colArr[i * 3 + 2] = p.color.b * ratio;
        }
      } else {
        colArr[i * 3] = 0;
        colArr[i * 3 + 1] = 0;
        colArr[i * 3 + 2] = 0;
      }
      posArr[i * 3] = p.pos.x;
      posArr[i * 3 + 1] = p.pos.y;
      posArr[i * 3 + 2] = p.pos.z;
    }
    this.sparkGeo.attributes.position.needsUpdate = true;
    this.sparkGeo.attributes.color.needsUpdate = true;

    // Update dust
    const dPosArr = this.dustPositions;
    const dColArr = this.dustColors;

    for (let i = 0; i < this.dustParticles.length; i++) {
      const p = this.dustParticles[i];
      if (p.active) {
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.pos.set(0, -999, 0);
        } else {
          p.pos.addScaledVector(p.vel, delta);
          p.vel.multiplyScalar(0.96); // drag
          const alpha = (1 - p.life / p.maxLife) * p.opacity;
          dColArr[i * 3] = 0.85 * alpha;
          dColArr[i * 3 + 1] = 0.78 * alpha;
          dColArr[i * 3 + 2] = 0.68 * alpha;
        }
      } else {
        dColArr[i * 3] = 0;
        dColArr[i * 3 + 1] = 0;
        dColArr[i * 3 + 2] = 0;
      }
      dPosArr[i * 3] = p.pos.x;
      dPosArr[i * 3 + 1] = p.pos.y;
      dPosArr[i * 3 + 2] = p.pos.z;
    }
    this.dustGeo.attributes.position.needsUpdate = true;
    this.dustGeo.attributes.color.needsUpdate = true;
  }
}
