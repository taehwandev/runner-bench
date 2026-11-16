import * as THREE from 'three';

export class ModelFactory {
  constructor(textures) {
    this.tex = textures;

    // Shared basic geometries to keep GPU draw & memory footprint lean
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
    this.wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14);
    this.wheelGeo.rotateZ(Math.PI / 2);
    this.rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.26, 10);
    this.rimGeo.rotateZ(Math.PI / 2);
    this.planeGeo = new THREE.PlaneGeometry(1, 1);
    this.octaGeo = new THREE.OctahedronGeometry(0.38, 0);
    this.torusGeo = new THREE.TorusGeometry(0.52, 0.06, 8, 24);

    // Shared materials
    this.darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x151b2b,
      roughness: 0.42,
      metalness: 0.75
    });
    this.concreteMat = new THREE.MeshStandardMaterial({
      color: 0x1d2336,
      roughness: 0.85,
      metalness: 0.1
    });
    this.tireMat = new THREE.MeshStandardMaterial({
      color: 0x0c0e14,
      roughness: 0.82,
      metalness: 0.15
    });
    this.cabinGlassMat = new THREE.MeshStandardMaterial({
      color: 0x091326,
      emissive: 0x0e2748,
      emissiveIntensity: 0.55,
      roughness: 0.08,
      metalness: 0.9
    });
    this.litBusWindowMat = new THREE.MeshBasicMaterial({
      color: 0x9beeff
    });
    this.headlightMat = new THREE.MeshBasicMaterial({
      color: 0xe8fbff
    });
    this.taillightMat = new THREE.MeshBasicMaterial({
      color: 0xff1947
    });
    this.amberLightMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00
    });
    this.rimNeonMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff
    });
    this.hazardMat = new THREE.MeshStandardMaterial({
      map: this.tex.hazard,
      emissiveMap: this.tex.hazard,
      emissive: 0xff9900,
      emissiveIntensity: 0.38,
      roughness: 0.45
    });
    this.slideCurtainMat = new THREE.MeshBasicMaterial({
      map: this.tex.slideGate,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.railGateMat = new THREE.MeshStandardMaterial({
      map: this.tex.railGate,
      emissiveMap: this.tex.railGate,
      emissive: 0xff3355,
      emissiveIntensity: 0.45,
      roughness: 0.4
    });

    // Car body paint palette (glossy wet night reflection via scene.environment)
    this.carPaints = {
      taxi: new THREE.MeshStandardMaterial({ color: 0xffb800, roughness: 0.18, metalness: 0.55 }),
      cyan: new THREE.MeshStandardMaterial({ color: 0x0b789c, roughness: 0.16, metalness: 0.72 }),
      crimson: new THREE.MeshStandardMaterial({ color: 0x9e1146, roughness: 0.15, metalness: 0.74 }),
      midnight: new THREE.MeshStandardMaterial({ color: 0x1a2648, roughness: 0.18, metalness: 0.78 }),
      silver: new THREE.MeshStandardMaterial({ color: 0x627394, roughness: 0.2, metalness: 0.82 }),
      violet: new THREE.MeshStandardMaterial({ color: 0x4b1d7a, roughness: 0.16, metalness: 0.74 }),
      busBody: new THREE.MeshStandardMaterial({ color: 0x18294a, roughness: 0.26, metalness: 0.62 }),
      truckCab: new THREE.MeshStandardMaterial({ color: 0xd94e1f, roughness: 0.28, metalness: 0.55 }),
      truckBox: new THREE.MeshStandardMaterial({ color: 0x26334d, roughness: 0.35, metalness: 0.62 }),
      trainBody: new THREE.MeshStandardMaterial({ color: 0x1b2744, roughness: 0.18, metalness: 0.8 })
    };
  }

  createWetStreak(colorHex, width, length, opacity = 0.42) {
    const mat = new THREE.MeshBasicMaterial({
      map: this.tex.wetStreak,
      color: colorHex,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(this.planeGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(width, length, 1);
    mesh.position.y = 0.02;
    return mesh;
  }

  // ================= RUNNER CHARACTER RIG =================
  createRunner() {
    const group = new THREE.Group();
    const bodyPivot = new THREE.Group();
    group.add(bodyPivot);

    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x10172b,
      roughness: 0.32,
      metalness: 0.65
    });
    const jacketMat = new THREE.MeshStandardMaterial({
      color: 0x1b284d,
      emissive: 0x07122b,
      roughness: 0.26,
      metalness: 0.55
    });
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const accentPinkMat = new THREE.MeshBasicMaterial({ color: 0xff1e8a });
    const soleMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // Ground shadow / neon hover footprint for crisp jump height readability
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.tex.glowSprite,
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.36,
      depthWrite: false
    });
    const shadow = new THREE.Mesh(this.planeGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.025;
    shadow.scale.set(1.25, 1.25, 1);
    group.add(shadow);

    // Pelvis / Hips
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.26), suitMat);
    hips.position.y = 0.88;
    bodyPivot.add(hips);

    // Torso group (tilts forward during sprint & reclines during slide)
    const torsoPivot = new THREE.Group();
    torsoPivot.position.set(0, 0.95, 0);
    bodyPivot.add(torsoPivot);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.52, 0.3), jacketMat);
    chest.position.y = 0.26;
    torsoPivot.add(chest);

    // Glowing cyber-spine & collar trim
    const spineStrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.05), visorMat);
    spineStrip.position.set(0, 0.27, 0.16);
    torsoPivot.add(spineStrip);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 16), accentPinkMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.53, 0);
    torsoPivot.add(collar);

    // Backpack thruster module
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.14), this.darkMetalMat);
    pack.position.set(0, 0.28, 0.19);
    torsoPivot.add(pack);

    // Sculpted Helmet + Glowing Visor
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.62, 0);
    torsoPivot.add(headPivot);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), suitMat);
    helmet.scale.set(0.95, 1.05, 1.12);
    helmet.position.y = 0.12;
    headPivot.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.18), visorMat);
    visor.position.set(0, 0.13, -0.13);
    headPivot.add(visor);

    // Twin Flowing Holographic Light-Scarf Ribbons trailing in +Z
    const scarfSegments = [];
    const scarfMat = new THREE.MeshBasicMaterial({
      color: 0xff1e8a,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });
    for (let side of [-1, 1]) {
      const segs = [];
      let parent = torsoPivot;
      for (let i = 0; i < 4; i++) {
        const segPivot = new THREE.Group();
        if (i === 0) {
          segPivot.position.set(side * 0.12, 0.5, 0.14);
        } else {
          segPivot.position.set(0, 0, 0.24);
        }
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.11 - i * 0.018, 0.26), scarfMat);
        blade.rotation.x = Math.PI / 2;
        blade.position.z = 0.13;
        segPivot.add(blade);
        parent.add(segPivot);
        parent = segPivot;
        segs.push(segPivot);
      }
      scarfSegments.push(segs);
    }

    // Articulated Arms
    const makeArm = (side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.31, 0.46, 0);
      torsoPivot.add(shoulder);

      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.18), jacketMat);
      shoulder.add(pauldron);

      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.28, 0.11), jacketMat);
      upper.position.y = -0.15;
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.28;
      shoulder.add(elbow);

      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.26, 0.095), suitMat);
      fore.position.y = -0.13;
      elbow.add(fore);

      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.11), visorMat);
      cuff.position.y = -0.22;
      elbow.add(cuff);

      return { shoulder, elbow };
    };
    const leftArm = makeArm(-1);
    const rightArm = makeArm(1);

    // Articulated Legs
    const makeLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.14, 0.86, 0);
      bodyPivot.add(hip);

      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.16), suitMat);
      thigh.position.y = -0.2;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -0.4;
      hip.add(knee);

      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.06), accentPinkMat);
      kneePad.position.set(0, 0, -0.08);
      knee.add(kneePad);

      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.38, 0.13), suitMat);
      shin.position.y = -0.19;
      knee.add(shin);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.26), jacketMat);
      shoe.position.set(0, -0.4, -0.05);
      knee.add(shoe);

      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.28), soleMat);
      sole.position.set(0, -0.445, -0.05);
      knee.add(sole);

      return { hip, knee };
    };
    const leftLeg = makeLeg(-1);
    const rightLeg = makeLeg(1);

    // ---- Power-Up Visual Attachments ----
    // 1. Aegis Shield Dome
    const shieldGroup = new THREE.Group();
    shieldGroup.position.y = 0.95;
    const shieldGeo = new THREE.IcosahedronGeometry(1.18, 1);
    const shieldWire = new THREE.Mesh(
      shieldGeo,
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.52
      })
    );
    const shieldCore = new THREE.Mesh(
      shieldGeo,
      new THREE.MeshBasicMaterial({
        color: 0x00c8ff,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    shieldGroup.add(shieldWire, shieldCore);
    shieldGroup.visible = false;
    group.add(shieldGroup);

    // 2. Pulse Magnet Halos
    const magnetGroup = new THREE.Group();
    magnetGroup.position.y = 0.95;
    const magRingMat1 = new THREE.MeshBasicMaterial({ color: 0xffc400, transparent: true, opacity: 0.85 });
    const magRingMat2 = new THREE.MeshBasicMaterial({ color: 0xff1e8a, transparent: true, opacity: 0.75 });
    const magRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.035, 8, 32), magRingMat1);
    const magRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.025, 8, 32), magRingMat2);
    magRing1.rotation.x = Math.PI / 2;
    magRing2.rotation.x = Math.PI / 2.4;
    magnetGroup.add(magRing1, magRing2);
    magnetGroup.visible = false;
    group.add(magnetGroup);

    // 3. Nitro Dash Plasma Thrusters
    const dashGroup = new THREE.Group();
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const coneGeo = new THREE.ConeGeometry(0.14, 1.45, 10);
    coneGeo.rotateX(Math.PI / 2);
    const jetL = new THREE.Mesh(coneGeo, flameMat);
    const jetR = new THREE.Mesh(coneGeo, flameMat);
    jetL.position.set(-0.11, 0.28, 0.95);
    jetR.position.set(0.11, 0.28, 0.95);
    dashGroup.add(jetL, jetR);
    dashGroup.visible = false;
    torsoPivot.add(dashGroup);

    // 4. Chrono Slow-Time Halo
    const chronoRing = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.84, 24),
      new THREE.MeshBasicMaterial({
        color: 0xb65cff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78
      })
    );
    chronoRing.position.set(0, 1.28, 0.28);
    chronoRing.visible = false;
    group.add(chronoRing);

    return {
      group,
      bodyPivot,
      torsoPivot,
      headPivot,
      hips,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      scarfSegments,
      shadow,
      shieldGroup,
      magnetGroup,
      magRing1,
      magRing2,
      dashGroup,
      chronoRing
    };
  }

  // ================= DETAILED VEHICLES =================
  createVehicle(variant = 'taxi', oncoming = true) {
    const root = new THREE.Group();
    const model = new THREE.Group();
    root.add(model);

    // Built facing +Z by default (front at +Z, rear at -Z).
    // If oncoming === true, front (+Z) faces the camera/runner directly!
    // If oncoming === false (driving forward toward -Z), rotate 180 deg so taillights face camera!
    if (!oncoming) {
      model.rotation.y = Math.PI;
    }

    let width = 1.72;
    let height = 1.48;
    let length = 4.2;
    let blinkers = null;

    if (variant === 'taxi' || variant === 'sedan' || variant === 'coupe') {
      const isCoupe = variant === 'coupe';
      const isTaxi = variant === 'taxi';
      length = isCoupe ? 4.35 : 4.15;
      width = isCoupe ? 1.82 : 1.72;
      height = isCoupe ? 1.28 : 1.46;

      const paintKeys = ['cyan', 'crimson', 'midnight', 'silver', 'violet'];
      const bodyMat = isTaxi
        ? this.carPaints.taxi
        : isCoupe
          ? this.carPaints.crimson
          : this.carPaints[paintKeys[Math.floor(Math.random() * paintKeys.length)]];

      // Lower sculpted chassis
      const chassis = new THREE.Mesh(this.boxGeo, bodyMat);
      chassis.scale.set(width, isCoupe ? 0.48 : 0.56, length);
      chassis.position.y = isCoupe ? 0.48 : 0.54;
      model.add(chassis);

      // Lower front splitter & side skirts
      const skirt = new THREE.Mesh(this.boxGeo, this.darkMetalMat);
      skirt.scale.set(width + 0.05, 0.14, length + 0.08);
      skirt.position.y = 0.24;
      model.add(skirt);

      // Cabin greenhouse
      const cabin = new THREE.Mesh(this.boxGeo, this.cabinGlassMat);
      cabin.scale.set(width * 0.84, isCoupe ? 0.44 : 0.52, length * 0.5);
      cabin.position.set(0, isCoupe ? 0.92 : 1.04, -0.18);
      model.add(cabin);

      // Roof cap
      const roof = new THREE.Mesh(this.boxGeo, bodyMat);
      roof.scale.set(width * 0.8, 0.07, length * 0.44);
      roof.position.set(0, isCoupe ? 1.15 : 1.31, -0.18);
      model.add(roof);

      if (isTaxi) {
        // Illuminated rooftop TAXI lantern
        const taxiSign = new THREE.Mesh(
          this.boxGeo,
          new THREE.MeshBasicMaterial({ color: 0xffe066 })
        );
        taxiSign.scale.set(0.56, 0.18, 0.24);
        taxiSign.position.set(0, 1.43, -0.1);
        model.add(taxiSign);
      }

      if (isCoupe) {
        // Aerodynamic rear wing spoiler + neon underglow
        const wing = new THREE.Mesh(this.boxGeo, bodyMat);
        wing.scale.set(width * 0.96, 0.06, 0.28);
        wing.position.set(0, 0.92, -length * 0.45);
        model.add(wing);

        const underglow = this.createWetStreak(0xff1e8a, width * 1.35, length * 1.15, 0.35);
        model.add(underglow);
      }

      // Twin Headlights (+Z front)
      for (let s of [-1, 1]) {
        const hl = new THREE.Mesh(this.boxGeo, this.headlightMat);
        hl.scale.set(0.36, 0.13, 0.08);
        hl.position.set(s * (width * 0.34), 0.56, length * 0.5 + 0.01);
        model.add(hl);
      }

      // Wide cyber LED Rear Taillight bar (-Z rear)
      const tl = new THREE.Mesh(this.boxGeo, this.taillightMat);
      tl.scale.set(width * 0.86, 0.12, 0.08);
      tl.position.set(0, 0.62, -length * 0.5 - 0.01);
      model.add(tl);

      // Turn-signal blinkers for lane-weaving coupes
      if (isCoupe) {
        const leftMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const rightMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const blL = new THREE.Mesh(this.boxGeo, leftMat);
        const blR = new THREE.Mesh(this.boxGeo, rightMat);
        blL.scale.set(0.22, 0.12, length + 0.12);
        blR.scale.set(0.22, 0.12, length + 0.12);
        blL.position.set(-width * 0.44, 0.52, 0);
        blR.position.set(width * 0.44, 0.52, 0);
        blL.visible = false;
        blR.visible = false;
        model.add(blL, blR);
        blinkers = { left: blL, right: blR };
      }

      // 4 Wheels + Neon Rim Inserts
      const wheelZ = [length * 0.31, -length * 0.31];
      for (let wz of wheelZ) {
        for (let s of [-1, 1]) {
          const w = new THREE.Mesh(this.wheelGeo, this.tireMat);
          w.position.set(s * (width * 0.48), 0.35, wz);
          const rim = new THREE.Mesh(this.rimGeo, this.rimNeonMat);
          rim.position.copy(w.position);
          model.add(w, rim);
        }
      }

      // Wet-road headlight & taillight reflection streaks
      const frontStreak = this.createWetStreak(0xb8f8ff, 1.5, 6.2, oncoming ? 0.5 : 0.25);
      frontStreak.position.z = length * 0.5 + 3.0;
      model.add(frontStreak);

      const rearStreak = this.createWetStreak(0xff1947, 1.5, 4.4, 0.42);
      rearStreak.position.z = -length * 0.5 - 2.1;
      model.add(rearStreak);
    } else if (variant === 'bus') {
      width = 1.98;
      height = 2.92;
      length = 8.2;

      const body = new THREE.Mesh(this.boxGeo, this.carPaints.busBody);
      body.scale.set(width, 2.52, length);
      body.position.y = 1.56;
      model.add(body);

      const bumper = new THREE.Mesh(this.boxGeo, this.darkMetalMat);
      bumper.scale.set(width + 0.04, 0.36, length + 0.1);
      bumper.position.y = 0.36;
      model.add(bumper);

      // Glowing passenger window bands on sides & front windshield
      const sideWin = new THREE.Mesh(this.boxGeo, this.litBusWindowMat);
      sideWin.scale.set(width + 0.03, 0.78, length * 0.84);
      sideWin.position.y = 2.02;
      model.add(sideWin);

      const windshield = new THREE.Mesh(this.boxGeo, this.cabinGlassMat);
      windshield.scale.set(width * 0.9, 0.95, 0.1);
      windshield.position.set(0, 1.88, length * 0.5 + 0.02);
      model.add(windshield);

      // Destination LED strip
      const destSign = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
      destSign.scale.set(width * 0.72, 0.22, 0.12);
      destSign.position.set(0, 2.55, length * 0.5 + 0.02);
      model.add(destSign);

      // Roof AC pods
      for (let rz of [-1.8, 1.6]) {
        const ac = new THREE.Mesh(this.boxGeo, this.carPaints.silver);
        ac.scale.set(1.2, 0.22, 1.6);
        ac.position.set(0, 2.92, rz);
        model.add(ac);
      }

      // Headlights & Taillights
      for (let s of [-1, 1]) {
        const hl = new THREE.Mesh(this.boxGeo, this.headlightMat);
        hl.scale.set(0.38, 0.18, 0.1);
        hl.position.set(s * 0.68, 0.68, length * 0.5 + 0.03);
        const tl = new THREE.Mesh(this.boxGeo, this.taillightMat);
        tl.scale.set(0.34, 0.5, 0.1);
        tl.position.set(s * 0.74, 0.95, -length * 0.5 - 0.03);
        model.add(hl, tl);
      }

      for (let wz of [-2.5, 2.5]) {
        for (let s of [-1, 1]) {
          const w = new THREE.Mesh(this.wheelGeo, this.tireMat);
          w.scale.set(1.2, 1.25, 1.25);
          w.position.set(s * 0.94, 0.44, wz);
          model.add(w);
        }
      }

      const frontStreak = this.createWetStreak(0xd8fbff, 1.8, 6.8, 0.46);
      frontStreak.position.z = length * 0.5 + 3.2;
      const rearStreak = this.createWetStreak(0xff1947, 1.8, 4.8, 0.42);
      rearStreak.position.z = -length * 0.5 - 2.2;
      model.add(frontStreak, rearStreak);
    } else if (variant === 'truck') {
      width = 1.96;
      height = 3.05;
      length = 7.4;

      // Cab (+Z front)
      const cab = new THREE.Mesh(this.boxGeo, this.carPaints.truckCab);
      cab.scale.set(1.88, 2.15, 2.0);
      cab.position.set(0, 1.38, 2.55);
      model.add(cab);

      const cabGlass = new THREE.Mesh(this.boxGeo, this.cabinGlassMat);
      cabGlass.scale.set(1.72, 0.72, 0.12);
      cabGlass.position.set(0, 1.88, 3.55);
      model.add(cabGlass);

      // Cargo Container (-Z rear)
      const cargo = new THREE.Mesh(this.boxGeo, this.carPaints.truckBox);
      cargo.scale.set(width, 2.48, 5.1);
      cargo.position.set(0, 1.76, -1.12);
      model.add(cargo);

      // Neon safety trim along cargo top edge
      const trim = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0xffb800 }));
      trim.scale.set(width + 0.04, 0.08, 5.14);
      trim.position.set(0, 2.96, -1.12);
      model.add(trim);

      const chassis = new THREE.Mesh(this.boxGeo, this.darkMetalMat);
      chassis.scale.set(1.65, 0.34, 7.1);
      chassis.position.y = 0.44;
      model.add(chassis);

      for (let s of [-1, 1]) {
        const hl = new THREE.Mesh(this.boxGeo, this.headlightMat);
        hl.scale.set(0.36, 0.18, 0.1);
        hl.position.set(s * 0.65, 0.72, 3.56);
        const tl = new THREE.Mesh(this.boxGeo, this.taillightMat);
        tl.scale.set(0.38, 0.22, 0.1);
        tl.position.set(s * 0.68, 0.62, -3.68);
        model.add(hl, tl);
      }

      for (let wz of [2.5, -0.8, -2.6]) {
        for (let s of [-1, 1]) {
          const w = new THREE.Mesh(this.wheelGeo, this.tireMat);
          w.scale.set(1.15, 1.2, 1.2);
          w.position.set(s * 0.92, 0.42, wz);
          model.add(w);
        }
      }

      const frontStreak = this.createWetStreak(0xd8fbff, 1.8, 6.2, 0.44);
      frontStreak.position.z = 6.5;
      const rearStreak = this.createWetStreak(0xff1947, 1.8, 4.5, 0.42);
      rearStreak.position.z = -5.8;
      model.add(frontStreak, rearStreak);
    }

    return { root, width, height, length, blinkers };
  }

  // ================= LOW OBSTACLES (JUMP OVER) =================
  createLowBarrier(style = 'jersey') {
    const root = new THREE.Group();
    if (style === 'jersey') {
      // Concrete roadwork base + diagonal hazard board + twin amber strobes
      const base = new THREE.Mesh(this.boxGeo, this.concreteMat);
      base.scale.set(1.92, 0.48, 0.62);
      base.position.y = 0.24;
      root.add(base);

      const board = new THREE.Mesh(this.boxGeo, this.hazardMat);
      board.scale.set(1.88, 0.36, 0.16);
      board.position.y = 0.72;
      root.add(board);

      for (let s of [-0.72, 0.72]) {
        const beacon = new THREE.Mesh(this.cylGeo, this.amberLightMat);
        beacon.scale.set(0.18, 0.16, 0.18);
        beacon.position.set(s, 0.98, 0);
        root.add(beacon);
      }

      const streak = this.createWetStreak(0xff9900, 1.6, 2.2, 0.34);
      root.add(streak);
    } else {
      // Pop-up Cyber Laser Bollards
      for (let x of [-0.72, 0, 0.72]) {
        const post = new THREE.Mesh(this.cylGeo, this.darkMetalMat);
        post.scale.set(0.24, 0.86, 0.24);
        post.position.set(x, 0.43, 0);
        root.add(post);

        const cap = new THREE.Mesh(this.cylGeo, new THREE.MeshBasicMaterial({ color: 0xff1e8a }));
        cap.scale.set(0.26, 0.14, 0.26);
        cap.position.set(x, 0.88, 0);
        root.add(cap);
      }
      const beam = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
      beam.scale.set(1.76, 0.1, 0.1);
      beam.position.y = 0.68;
      root.add(beam);

      const streak = this.createWetStreak(0xff1e8a, 1.6, 2.2, 0.36);
      root.add(streak);
    }

    return { root, width: 1.88, height: 0.94, length: 0.72 };
  }

  // ================= HIGH OBSTACLES (SLIDE UNDER) =================
  createHighSlideGate() {
    const root = new THREE.Group();

    // Side stanchions positioned at outer edges of the lane so sliding down center clears cleanly
    for (let s of [-0.98, 0.98]) {
      const post = new THREE.Mesh(this.boxGeo, this.darkMetalMat);
      post.scale.set(0.14, 2.55, 0.22);
      post.position.set(s, 1.275, 0);
      root.add(post);

      const strip = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
      strip.scale.set(0.05, 1.0, 0.24);
      strip.position.set(s, 0.52, 0);
      root.add(strip);
    }

    // Overhead Hazard Crossbar (bottom clearance = 1.08m -> standing runner hits, sliding runner clears!)
    const topBeam = new THREE.Mesh(this.boxGeo, this.hazardMat);
    topBeam.scale.set(2.1, 0.34, 0.38);
    topBeam.position.y = 2.42;
    root.add(topBeam);

    // Hanging Holographic "SLIDE" Laser Curtain (y = 1.08m to 2.25m)
    const curtain = new THREE.Mesh(this.planeGeo, this.slideCurtainMat);
    curtain.scale.set(1.88, 1.16, 1);
    curtain.position.y = 1.66;
    root.add(curtain);

    // Bottom laser bar at y = 1.10m for crisp spatial clearance feedback
    const bottomLaser = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0xff1e8a }));
    bottomLaser.scale.set(1.9, 0.06, 0.08);
    bottomLaser.position.y = 1.1;
    root.add(bottomLaser);

    return { root, width: 1.86, bottomY: 1.08, topY: 2.58, length: 0.55 };
  }

  // ================= URBAN SET-PIECES =================
  createOverpassProp() {
    const group = new THREE.Group();

    // Massive concrete piers outside road shoulders (-5.1 and +5.1)
    for (let s of [-1, 1]) {
      const pier = new THREE.Mesh(this.boxGeo, this.concreteMat);
      pier.scale.set(1.4, 5.8, 2.8);
      pier.position.set(s * 5.2, 2.9, 0);
      group.add(pier);
    }

    // Spanning Highway Deck overhead
    const deck = new THREE.Mesh(this.boxGeo, this.concreteMat);
    deck.scale.set(24, 0.95, 6.2);
    deck.position.y = 5.95;
    group.add(deck);

    // Parapet neon trim + overhead sign gantry
    const trim = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    trim.scale.set(24, 0.12, 0.14);
    trim.position.set(0, 5.5, 3.12);
    group.add(trim);

    // Underside glowing ceiling light strips illuminating the street below
    for (let lx of [-2.3, 0, 2.3]) {
      const strip = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0xffd27d }));
      strip.scale.set(0.35, 0.08, 5.6);
      strip.position.set(lx, 5.44, 0);
      group.add(strip);

      const pool = this.createWetStreak(0xffd27d, 2.0, 6.5, 0.22);
      pool.position.x = lx;
      group.add(pool);
    }

    // Upper-deck passing car silhouette + headlights (animated in world update!)
    const upperCar = new THREE.Group();
    const cBody = new THREE.Mesh(this.boxGeo, this.darkMetalMat);
    cBody.scale.set(3.4, 0.9, 1.4);
    cBody.position.y = 6.95;
    const cLight = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0xff1e8a }));
    cLight.scale.set(3.6, 0.18, 1.44);
    cLight.position.y = 6.85;
    upperCar.add(cBody, cLight);
    group.add(upperCar);

    return { group, upperCar };
  }

  createTunnelProp(length = 42) {
    const group = new THREE.Group();

    const wallTex = this.tex.tunnelWall;
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.55,
      metalness: 0.25
    });

    // Side tiled walls
    for (let s of [-1, 1]) {
      const wall = new THREE.Mesh(this.boxGeo, wallMat);
      wall.scale.set(1.1, 6.0, length);
      wall.position.set(s * 5.05, 3.0, 0);
      group.add(wall);
    }

    // Dark concrete ceiling slab
    const ceiling = new THREE.Mesh(this.boxGeo, this.concreteMat);
    ceiling.scale.set(11.2, 1.1, length);
    ceiling.position.y = 6.2;
    group.add(ceiling);

    // Entrance & exit portal facades + rhythmic glowing neon arches inside
    const archCount = Math.floor(length / 7);
    const ribColors = [0x00f0ff, 0xff1e8a, 0x00f0ff, 0xffb800];
    for (let i = 0; i <= archCount; i++) {
      const z = -length / 2 + (i / archCount) * length;
      const col = ribColors[i % ribColors.length];
      const ribMat = new THREE.MeshBasicMaterial({ color: col });

      const topRib = new THREE.Mesh(this.boxGeo, ribMat);
      topRib.scale.set(8.9, 0.14, 0.2);
      topRib.position.set(0, 5.58, z);
      group.add(topRib);

      for (let s of [-1, 1]) {
        const sideRib = new THREE.Mesh(this.boxGeo, ribMat);
        sideRib.scale.set(0.14, 5.4, 0.2);
        sideRib.position.set(s * 4.42, 2.75, z);
        group.add(sideRib);

        const wetRef = this.createWetStreak(col, 0.85, 3.6, 0.32);
        wetRef.position.set(s * 3.85, 0.02, z);
        group.add(wetRef);
      }
    }

    return { group, length };
  }

  createRailCrossingProp(safeLane = 0) {
    const group = new THREE.Group();

    // Embedded steel tracks + sleepers across street
    const bed = new THREE.Mesh(this.boxGeo, this.darkMetalMat);
    bed.scale.set(11.5, 0.05, 2.9);
    bed.position.y = 0.015;
    group.add(bed);

    const railMat = new THREE.MeshStandardMaterial({ color: 0x9fb4d4, roughness: 0.18, metalness: 0.92 });
    for (let rz of [-0.75, 0.75]) {
      const rail = new THREE.Mesh(this.boxGeo, railMat);
      rail.scale.set(22, 0.09, 0.1);
      rail.position.set(0, 0.05, rz);
      group.add(rail);
    }

    // Crossing signal masts & striped arms on both curbs
    const redLamps = [];
    for (let s of [-1, 1]) {
      const mast = new THREE.Mesh(this.cylGeo, this.darkMetalMat);
      mast.scale.set(0.18, 3.8, 0.18);
      mast.position.set(s * 4.55, 1.9, 1.65);
      group.add(mast);

      const crossbuck = new THREE.Mesh(this.boxGeo, this.railGateMat);
      crossbuck.scale.set(0.95, 0.18, 0.1);
      crossbuck.rotation.z = Math.PI / 5;
      crossbuck.position.set(s * 4.55, 3.1, 1.62);
      group.add(crossbuck);

      const crossbuck2 = crossbuck.clone();
      crossbuck2.rotation.z = -Math.PI / 5;
      group.add(crossbuck2);

      // Alternating red crossing lights
      for (let lx of [-0.22, 0.22]) {
        const lampMat = new THREE.MeshBasicMaterial({ color: 0xff1438 });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), lampMat);
        lamp.position.set(s * 4.55 + lx, 2.55, 1.62);
        group.add(lamp);
        redLamps.push(lamp);
      }
    }

    // Glowing Green Safe-Crossing Guide Pad on the open lane
    const safeX = safeLane * 2.3;
    const safePad = new THREE.Mesh(
      this.planeGeo,
      new THREE.MeshBasicMaterial({
        map: this.tex.safeChevron,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    safePad.rotation.x = -Math.PI / 2;
    safePad.scale.set(1.85, 5.4, 1);
    safePad.position.set(safeX, 0.04, 2.2);
    group.add(safePad);

    return { group, redLamps, safePad };
  }

  createMetroTrainCar() {
    // Oriented perpendicular across a lane (blocking ~2.2m X width, ~2.3m Z track width, 3.1m tall)
    // Wait: let's build a sleek transit car spanning the blocked lane(s) along X!
    const root = new THREE.Group();
    const carLenX = 2.22;
    const carDepthZ = 2.15;

    const body = new THREE.Mesh(this.boxGeo, this.carPaints.trainBody);
    body.scale.set(carLenX, 2.65, carDepthZ);
    body.position.y = 1.52;
    root.add(body);

    // Bright panoramic passenger window band
    const win = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0x7cf5ff }));
    win.scale.set(carLenX - 0.14, 0.82, carDepthZ + 0.04);
    win.position.y = 1.85;
    root.add(win);

    // Magenta/Cyan cyber livery stripe
    const stripe = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0xff1e8a }));
    stripe.scale.set(carLenX + 0.02, 0.14, carDepthZ + 0.05);
    stripe.position.y = 1.15;
    root.add(stripe);

    const bogie = new THREE.Mesh(this.boxGeo, this.darkMetalMat);
    bogie.scale.set(carLenX * 0.88, 0.36, carDepthZ * 0.86);
    bogie.position.y = 0.22;
    root.add(bogie);

    const streak = this.createWetStreak(0x7cf5ff, 2.1, 4.4, 0.38);
    root.add(streak);

    return { root, width: 2.05, height: 2.9, length: 2.15 };
  }

  // ================= COLLECTIBLES & POWER-UPS =================
  createShard(isRisk = false) {
    const group = new THREE.Group();
    const col = isRisk ? 0xffc400 : 0x00f0ff;

    const crystal = new THREE.Mesh(
      this.octaGeo,
      new THREE.MeshBasicMaterial({ color: col })
    );
    crystal.scale.set(isRisk ? 1.18 : 0.88, isRisk ? 1.55 : 1.25, isRisk ? 1.18 : 0.88);
    group.add(crystal);

    if (isRisk) {
      const ring = new THREE.Mesh(
        this.torusGeo,
        new THREE.MeshBasicMaterial({ color: 0xff1e8a })
      );
      group.add(ring);
    }

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.tex.glowSprite,
        color: isRisk ? 0xff9900 : 0x00f0ff,
        transparent: true,
        opacity: isRisk ? 0.72 : 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    halo.scale.set(isRisk ? 1.65 : 1.15, isRisk ? 1.65 : 1.15, 1);
    group.add(halo);

    return { group, crystal, isRisk };
  }

  createPowerUp(type = 'shield') {
    const colors = {
      shield: 0x00f0ff,
      magnet: 0xffc400,
      dash: 0x39ff14,
      chrono: 0xb65cff
    };
    const col = colors[type] || 0x00f0ff;
    const group = new THREE.Group();

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 0),
      new THREE.MeshBasicMaterial({ color: col })
    );
    group.add(core);

    const gyro1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.055, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const gyro2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.76, 0.045, 8, 24),
      new THREE.MeshBasicMaterial({ color: col })
    );
    gyro2.rotation.x = Math.PI / 2;
    group.add(gyro1, gyro2);

    // Vertical beacon pillar so player spots power-ups from far down the block!
    const beam = new THREE.Mesh(
      this.cylGeo,
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    beam.scale.set(0.95, 5.2, 0.95);
    beam.position.y = 1.9;
    group.add(beam);

    return { group, core, gyro1, gyro2, type, color: col };
  }

  // ================= ROADSIDE BUILDINGS & STREETLAMPS =================
  createBuildingSlot(variantIdx = 0, side = -1) {
    const group = new THREE.Group();
    const bTex = this.tex.buildings[variantIdx % this.tex.buildings.length];

    const w = 6.2 + (variantIdx % 3) * 1.4;
    const d = 7.5 + ((variantIdx * 2) % 3) * 1.6;
    const h = 16 + (variantIdx * 7) % 22;

    const towerMat = new THREE.MeshStandardMaterial({
      map: bTex.map,
      emissiveMap: bTex.emissiveMap,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 0.42,
      metalness: 0.35
    });

    // Ground storefront podium
    const podium = new THREE.Mesh(this.boxGeo, this.darkMetalMat);
    podium.scale.set(w + 0.5, 3.4, d + 0.4);
    podium.position.y = 1.7;
    group.add(podium);

    // Glowing ground shopfront window + neon awning facing the street
    const shopColor = [0x00f0ff, 0xff1e8a, 0xffb800, 0xb65cff][variantIdx % 4];
    const shopWin = new THREE.Mesh(
      this.planeGeo,
      new THREE.MeshBasicMaterial({ color: shopColor, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    shopWin.scale.set(d * 0.78, 2.1, 1);
    shopWin.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    shopWin.position.set(-side * (w * 0.5 + 0.27), 1.45, 0);
    group.add(shopWin);

    // Main multi-story window tower
    const tower = new THREE.Mesh(this.boxGeo, towerMat);
    tower.scale.set(w, h, d);
    tower.position.y = 3.4 + h * 0.5;
    group.add(tower);

    // Crown parapet + rooftop AC + aviation beacon
    const crown = new THREE.Mesh(this.boxGeo, this.darkMetalMat);
    crown.scale.set(w * 0.78, 1.6, d * 0.78);
    crown.position.y = 3.4 + h + 0.8;
    group.add(crown);

    const spire = new THREE.Mesh(this.cylGeo, this.darkMetalMat);
    spire.scale.set(0.12, 4.2, 0.12);
    spire.position.set(0, 3.4 + h + 3.2, 0);
    group.add(spire);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff1e4d })
    );
    beacon.position.set(0, 3.4 + h + 5.3, 0);
    group.add(beacon);

    // Jutting Procedural Neon Sign facing oncoming runner
    const signSpec = this.tex.signs[variantIdx % this.tex.signs.length];
    const signMat = new THREE.MeshBasicMaterial({
      map: signSpec.tex,
      side: THREE.DoubleSide
    });
    const signMesh = new THREE.Mesh(this.planeGeo, signMat);
    if (signSpec.vertical) {
      signMesh.scale.set(1.45, 4.4, 1);
      signMesh.position.set(-side * (w * 0.5 + 0.95), 7.2 + (variantIdx % 3) * 2.2, d * 0.25);
    } else {
      signMesh.scale.set(3.8, 1.45, 1);
      signMesh.position.set(-side * (w * 0.5 + 0.35), 4.4, d * 0.5 + 0.08);
    }
    group.add(signMesh);

    return { group, signColor: signSpec.color };
  }

  createStreetLamp(side = -1) {
    const group = new THREE.Group();

    const pole = new THREE.Mesh(this.cylGeo, this.darkMetalMat);
    pole.scale.set(0.14, 5.4, 0.14);
    pole.position.y = 2.7;
    group.add(pole);

    const arm = new THREE.Mesh(this.boxGeo, this.darkMetalMat);
    arm.scale.set(1.6, 0.1, 0.12);
    arm.position.set(-side * 0.75, 5.35, 0);
    group.add(arm);

    const bulbMat = new THREE.MeshBasicMaterial({ color: 0x9beeff });
    const bulb = new THREE.Mesh(this.boxGeo, bulbMat);
    bulb.scale.set(0.55, 0.09, 0.22);
    bulb.position.set(-side * 1.38, 5.28, 0);
    group.add(bulb);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.tex.glowSprite,
        color: 0x7ce8ff,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    glow.scale.set(2.4, 2.4, 1);
    glow.position.set(-side * 1.38, 5.18, 0);
    group.add(glow);

    // Wet road reflection streak directly below lamp overhang
    const streak = this.createWetStreak(0x7ce8ff, 1.15, 5.2, 0.26);
    streak.position.set(-side * 1.45, 0.02, 0);
    group.add(streak);

    return { group, bulbMat, glow, streak };
  }
}
