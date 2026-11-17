import * as THREE from 'three';
import { makeRadialTexture } from './util.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);

// Builds the Vela-9 shuttle. Nose points along +X.
// Returns handles the renderer updates each frame.
export function buildShip() {
  const root = new THREE.Group();     // position and heading
  const banker = new THREE.Group();   // roll into turns
  const model = new THREE.Group();    // hull parts, cast shadows
  const fx = new THREE.Group();       // flames and glows, no shadows
  root.add(banker);
  banker.add(model, fx);

  const hull = new THREE.MeshPhysicalMaterial({ color: '#f2f5f9', metalness: 0.3, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const trim = new THREE.MeshStandardMaterial({ color: '#ff6a2a', roughness: 0.45, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b3442', roughness: 0.55, metalness: 0.5 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#16406e', roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#0b2344', emissiveIntensity: 0.4 });

  // Fuselage: lathe profile with the nose at +Y, flattened, then laid along +X
  const smooth3 = (t) => t * t * (3 - 2 * t);
  const profile = [new THREE.Vector2(0, -2.2)];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const r = u < 0.6
      ? 0.45 + 0.5 * smooth3(u / 0.6)
      : 0.95 * Math.sqrt(Math.max(0, 1 - ((u - 0.6) / 0.4) ** 2));
    profile.push(new THREE.Vector2(r, -2.2 + 4.4 * u));
  }
  const body = new THREE.LatheGeometry(profile, 48);
  body.scale(0.78, 1, 1);
  body.rotateZ(-Math.PI / 2);
  model.add(new THREE.Mesh(body, hull));

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(1.5, 0.8, 1.05);
  canopy.position.set(0.7, 0.5, 0);
  model.add(canopy);

  // Delta wings, mirrored
  const wingShape = new THREE.Shape([new THREE.Vector2(0.7, 0), new THREE.Vector2(-1.8, 2.4), new THREE.Vector2(-2.3, 2.4), new THREE.Vector2(-1.6, 0)]);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: false });
  wingGeo.translate(0, 0, -0.04).rotateX(Math.PI / 2);
  const wingL = new THREE.Mesh(wingGeo, hull);
  wingL.position.y = -0.15;
  const wingR = wingL.clone();
  wingR.scale.z = -1;
  model.add(wingL, wingR);

  const finShape = new THREE.Shape([new THREE.Vector2(0.3, 0.35), new THREE.Vector2(-1.5, 0.35), new THREE.Vector2(-2.0, 1.35), new THREE.Vector2(-1.3, 1.35)]);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.07, bevelEnabled: false }).translate(0, 0, -0.035);
  model.add(new THREE.Mesh(finGeo, trim));

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.04, 10, 56), trim);
  ring.rotation.y = Math.PI / 2;
  ring.position.x = 1.45;
  ring.scale.set(1, 0.75, 1);
  model.add(ring);

  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
  const footGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.08, 16);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, dark);
    leg.position.set(0.5, -1.05, s * 0.75);
    const foot = new THREE.Mesh(footGeo, dark);
    foot.position.set(0.5, -1.5, s * 0.8);
    model.add(leg, foot);
  }

  const navRed = new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff3b3b', emissiveIntensity: 1.5 });
  const navGreen = new THREE.MeshStandardMaterial({ color: '#3bff7a', emissive: '#3bff7a', emissiveIntensity: 1.5 });
  const navGeo = new THREE.SphereGeometry(0.1, 12, 8);
  const navL = new THREE.Mesh(navGeo, navRed);
  navL.position.set(-2.2, -0.15, -2.45);
  const navR = new THREE.Mesh(navGeo, navGreen);
  navR.position.set(-2.2, -0.15, 2.45);
  model.add(navL, navR);

  model.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // Thrusters: nozzle, flame cones and an exhaust glow per nozzle
  const nozzleGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.5, 20).rotateZ(Math.PI / 2);
  const outerGeo = new THREE.ConeGeometry(0.26, 1.7, 16, 1, true).translate(0, 0.85, 0).rotateZ(Math.PI / 2);
  const coreGeo = new THREE.ConeGeometry(0.13, 1.1, 12, 1, true).translate(0, 0.55, 0).rotateZ(Math.PI / 2);
  const outerMat = new THREE.MeshBasicMaterial({ color: '#ff8a3d', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const exhaustTex = makeRadialTexture([[0, 'rgba(255,240,200,1)'], [0.25, 'rgba(255,170,90,0.85)'], [1, 'rgba(255,90,20,0)']]);
  const hoverTex = makeRadialTexture([[0, 'rgba(180,240,255,0.9)'], [0.35, 'rgba(90,200,255,0.35)'], [1, 'rgba(60,160,255,0)']]);

  const flames = [];
  const glows = [];
  for (const z of [-0.3, 0.3]) {
    const nozzle = new THREE.Mesh(nozzleGeo, dark);
    nozzle.position.set(-2.4, -0.05, z);
    model.add(nozzle);

    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.position.set(-2.65, -0.05, z);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(-2.65, -0.05, z);
    fx.add(outer, core);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: exhaustTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(-2.8, -0.05, z);
    fx.add(glow);

    flames.push({ outer, core });
    glows.push(glow);
  }

  // Soft cyan glow under the hull while hovering
  const hoverGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: hoverTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
  hoverGlow.scale.setScalar(3.6);
  hoverGlow.position.set(0.2, -1.0, 0);
  fx.add(hoverGlow);

  return { root, banker, flames, glows, hoverGlow, navRed, navGreen, flameLevel: 0.3, glowLevel: 0 };
}

// Applies flight state to the ship's pose and visual effects
export function updateShip(ship, flight, dt) {
  const { phase, progress: s, elapsed: e } = flight;
  const lerpK = 1 - Math.exp(-dt * 5);

  ship.root.position.copy(flight.position);
  ship.root.quaternion.setFromUnitVectors(X_AXIS, flight.heading);
  ship.banker.rotation.x = flight.bank;

  // Thrust rises with departure
  const flameTarget = phase === 'hover' ? 0.3 : phase === 'lap' ? 0.55 : phase === 'depart' ? 1 + 0.6 * s : 1.2;
  ship.flameLevel += (flameTarget - ship.flameLevel) * lerpK;
  ship.flames.forEach(({ outer, core }, i) => {
    const flick = 0.9 + 0.15 * Math.sin(e * 31 + i * 1.7);
    const len = Math.max(0.05, ship.flameLevel * flick);
    outer.scale.set(len, 0.7 + 0.3 * ship.flameLevel, 0.7 + 0.3 * ship.flameLevel);
    core.scale.set(len * 0.7, 0.8, 0.8);
    outer.material.opacity = 0.45 + 0.35 * ship.flameLevel;
  });
  for (const g of ship.glows) {
    g.scale.setScalar(1.2 + 1.2 * ship.flameLevel);
    g.material.opacity = Math.min(1, 0.5 + 0.3 * ship.flameLevel);
  }

  // Hover glow fades out as the ship leaves
  const glowTarget = phase === 'hover' ? 0.5 : phase === 'lap' ? 0.3 : phase === 'depart' ? 0.3 * (1 - s) : 0;
  ship.glowLevel += (glowTarget - ship.glowLevel) * lerpK;
  ship.hoverGlow.material.opacity = ship.glowLevel;

  const blink = Math.sin(e * 3.2) > 0.2 ? 2.5 : 0.3;
  ship.navRed.emissiveIntensity = blink;
  ship.navGreen.emissiveIntensity = blink;
}
