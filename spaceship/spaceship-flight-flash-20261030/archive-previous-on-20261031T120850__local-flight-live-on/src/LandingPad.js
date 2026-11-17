import * as THREE from 'three';

export class LandingPad {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.runwayLights = [];
    this.padLights = [];
    this.padHeight = 1.2;
    this.radius = 12.0;

    this.buildPad();
    this.scene.add(this.group);
  }

  buildPad() {
    // 1. Foundation Base (Octagonal concrete / composite base)
    const baseGeo = new THREE.CylinderGeometry(this.radius, this.radius + 1.2, this.padHeight, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x2b333a,
      roughness: 0.85,
      metalness: 0.2
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = this.padHeight / 2;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    this.group.add(baseMesh);

    // 2. Beveled Top Rim with Hazard Stripes (Procedural Canvas Texture)
    const rimGeo = new THREE.RingGeometry(this.radius - 1.2, this.radius + 0.1, 8);
    const hazardCanvas = document.createElement('canvas');
    hazardCanvas.width = 512;
    hazardCanvas.height = 64;
    const hCtx = hazardCanvas.getContext('2d');
    hCtx.fillStyle = '#1e2022';
    hCtx.fillRect(0, 0, 512, 64);
    // Draw yellow hazard chevrons
    hCtx.fillStyle = '#ffb300';
    for (let x = -64; x < 512; x += 48) {
      hCtx.beginPath();
      hCtx.moveTo(x, 0);
      hCtx.lineTo(x + 24, 0);
      hCtx.lineTo(x + 48, 64);
      hCtx.lineTo(x + 24, 64);
      hCtx.closePath();
      hCtx.fill();
    }
    const hazardTex = new THREE.CanvasTexture(hazardCanvas);
    hazardTex.wrapS = THREE.RepeatWrapping;
    hazardTex.wrapT = THREE.RepeatWrapping;
    hazardTex.repeat.set(8, 1);

    const rimMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.6,
      metalness: 0.3
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = -Math.PI / 2;
    rimMesh.position.y = this.padHeight + 0.01;
    rimMesh.receiveShadow = true;
    this.group.add(rimMesh);

    // 3. Central Deck (Dark heat-resistant composite tiles)
    const deckGeo = new THREE.CircleGeometry(this.radius - 1.2, 32);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x1b2026,
      roughness: 0.7,
      metalness: 0.4
    });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.rotation.x = -Math.PI / 2;
    deckMesh.position.y = this.padHeight + 0.015;
    deckMesh.receiveShadow = true;
    this.group.add(deckMesh);

    // 4. Central Target Rings & Decals
    this.buildLandingTarget();

    // 5. Perimeter Floodlight Towers
    this.buildFloodlights();

    // 6. Perimeter Runway Alignment Lights (Recessed LED strips)
    this.buildRunwayLEDs();

    // 7. Blast Vent Grates
    this.buildBlastVents();
  }

  buildLandingTarget() {
    // Outer Target Ring (Glowing Cyan)
    const ringGeo1 = new THREE.RingGeometry(6.5, 6.8, 48);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = this.padHeight + 0.02;
    this.group.add(ring1);
    this.targetRingOuter = ring1;

    // Segmented Middle Ring
    const ringGeo2 = new THREE.RingGeometry(4.0, 4.3, 32);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = this.padHeight + 0.02;
    this.group.add(ring2);
    this.targetRingMid = ring2;

    // Center Crosshair / H Pad Mark
    const crossCanvas = document.createElement('canvas');
    crossCanvas.width = 256;
    crossCanvas.height = 256;
    const cCtx = crossCanvas.getContext('2d');
    cCtx.clearRect(0, 0, 256, 256);

    // Glowing target circle
    cCtx.strokeStyle = '#00e5ff';
    cCtx.lineWidth = 10;
    cCtx.beginPath();
    cCtx.arc(128, 128, 90, 0, Math.PI * 2);
    cCtx.stroke();

    // Bold "H" Mark
    cCtx.fillStyle = '#ffffff';
    cCtx.fillRect(72, 58, 24, 140);
    cCtx.fillRect(160, 58, 24, 140);
    cCtx.fillRect(96, 116, 64, 24);

    // Pad ID Text "PAD 01"
    cCtx.font = 'bold 24px monospace';
    cCtx.fillStyle = '#00e5ff';
    cCtx.textAlign = 'center';
    cCtx.fillText('PAD 01', 128, 225);

    const crossTex = new THREE.CanvasTexture(crossCanvas);
    const crossGeo = new THREE.PlaneGeometry(5.0, 5.0);
    const crossMat = new THREE.MeshBasicMaterial({
      map: crossTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const crossMesh = new THREE.Mesh(crossGeo, crossMat);
    crossMesh.rotation.x = -Math.PI / 2;
    crossMesh.position.y = this.padHeight + 0.025;
    this.group.add(crossMesh);
    this.targetCenter = crossMesh;
  }

  buildFloodlights() {
    const towerAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
    const towerRadius = this.radius + 0.4;

    towerAngles.forEach((angle) => {
      const pX = Math.cos(angle) * towerRadius;
      const pZ = Math.sin(angle) * towerRadius;

      // Pylon Post
      const postGeo = new THREE.CylinderGeometry(0.12, 0.18, 4.2, 8);
      const postMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.8,
        roughness: 0.3
      });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pX, 2.1, pZ);
      post.castShadow = true;
      this.group.add(post);

      // Light Head Fixture
      const headGeo = new THREE.BoxGeometry(0.7, 0.3, 0.4);
      const headMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.9,
        roughness: 0.2
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(pX, 4.2, pZ);
      head.lookAt(0, this.padHeight, 0);
      this.group.add(head);

      // Emissive bulb lens
      const lensGeo = new THREE.PlaneGeometry(0.6, 0.24);
      const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6 });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(0, 0, 0.21);
      head.add(lens);

      // Point Light angled onto pad
      const spot = new THREE.PointLight(0xfff1cf, 35, 18, 1.2);
      spot.position.set(pX * 0.9, 4.0, pZ * 0.9);
      this.group.add(spot);
      this.padLights.push(spot);
    });
  }

  buildRunwayLEDs() {
    const count = 16;
    const r = this.radius - 0.7;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const lx = Math.cos(angle) * r;
      const lz = Math.sin(angle) * r;

      const ledGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12);
      const ledMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8
      });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(lx, this.padHeight + 0.03, lz);
      this.group.add(led);

      this.runwayLights.push({
        mesh: led,
        material: ledMat,
        phase: (i / count) * Math.PI * 2
      });
    }
  }

  buildBlastVents() {
    // 4 circular vent grates near inner deck
    const ventOffsets = [
      { x: 3.5, z: 3.5 },
      { x: -3.5, z: 3.5 },
      { x: 3.5, z: -3.5 },
      { x: -3.5, z: -3.5 }
    ];

    ventOffsets.forEach(pos => {
      const ventGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.05, 16);
      const ventMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.9,
        metalness: 0.1
      });
      const vent = new THREE.Mesh(ventGeo, ventMat);
      vent.position.set(pos.x, this.padHeight + 0.018, pos.z);
      this.group.add(vent);

      // Inner grill ring
      const ringGeo = new THREE.TorusGeometry(0.75, 0.04, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(pos.x, this.padHeight + 0.02, pos.z);
      this.group.add(ring);
    });
  }

  update(time, flightState) {
    // Pulse target rings
    if (this.targetRingOuter && this.targetRingMid) {
      const pulse = 0.7 + Math.sin(time * 3.0) * 0.3;
      if (flightState === 'STANDBY' || flightState === 'TOUCHDOWN') {
        this.targetRingOuter.material.color.setHex(0x00e5ff);
      } else if (flightState === 'LIFTOFF' || flightState === 'CIRCUIT') {
        this.targetRingOuter.material.color.setHex(0x0284c7);
      } else if (flightState === 'APPROACH') {
        // Fast amber pulse during approach for landing clearance
        const alertPulse = Math.sin(time * 8.0) > 0 ? 0xffb703 : 0x00e5ff;
        this.targetRingOuter.material.color.setHex(alertPulse);
      }
      this.targetRingOuter.scale.setScalar(1 + (pulse - 0.7) * 0.03);
    }

    // Runway chase lights
    this.runwayLights.forEach(light => {
      const intensity = 0.35 + 0.65 * Math.sin(time * 4.0 - light.phase);
      if (flightState === 'APPROACH') {
        light.material.color.setRGB(intensity * 1.0, intensity * 0.7, 0.1);
      } else {
        light.material.color.setRGB(0.1 * intensity, 0.7 * intensity, 1.0 * intensity);
      }
    });
  }
}
