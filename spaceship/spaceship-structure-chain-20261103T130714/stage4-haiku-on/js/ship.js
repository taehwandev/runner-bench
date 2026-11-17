// The spaceship: a saucer hull with cockpit, nav lights, and three engine flames.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.colors;
const ENGINE_Y = -0.82; // flame base, just under the hull
const ENGINE_RING = 2.1;

// Bottom of the hull, in the ship's local space; used as the exhaust origin
const ENGINE_LOCAL = new THREE.Vector3(0, -0.9, 0);

function buildHull() {
  // Flattened half-ellipsoid profile, revolved for a smooth saucer
  const profile = [];
  for (let i = 0; i <= 28; i++) {
    const a = -Math.PI / 2 + (i / 28) * Math.PI;
    profile.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * 3.4), Math.sin(a) * 0.9));
  }
  return new THREE.Mesh(
    new THREE.LatheGeometry(profile, 48),
    new THREE.MeshStandardMaterial({ color: C.hull, metalness: 0.45, roughness: 0.35 }),
  );
}

// Flame geometry: base at y = 0, tip pointing down to y = -2
function flameGeometry() {
  const geo = new THREE.ConeGeometry(0.42, 2, 12, 1, true);
  geo.rotateX(Math.PI);
  geo.translate(0, -1, 0);
  return geo;
}

export function createShip() {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ'; // yaw in world, then bank, then pitch in the body frame

  const accent = new THREE.MeshStandardMaterial({ color: C.accent, metalness: 0.3, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({
    color: C.glass,
    metalness: 0.9,
    roughness: 0.05,
    transparent: true,
    opacity: 0.6,
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: C.exhaust,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const hull = buildHull();
  hull.castShadow = true;

  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.09, 10, 64), accent);
  ring.rotation.x = Math.PI / 2;

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  cockpit.position.set(0.6, 0.25, 0);

  // Nose cone along +X: this is the facing cue
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.2, 12),
    new THREE.MeshStandardMaterial({ color: C.hull, metalness: 0.45, roughness: 0.35 }),
  );
  nose.geometry.rotateZ(-Math.PI / 2);
  nose.position.set(3.5, 0, 0);
  nose.castShadow = true;

  // Nav lights: green on the starboard side, red on port; blinking in applyFlight
  const navGeo = new THREE.SphereGeometry(0.22, 10, 8);
  const navGreen = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0x5dff8a }));
  navGreen.position.set(0, 0, 3.4);
  const navRed = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: 0xff4d4d }));
  navRed.position.set(0, 0, -3.4);

  // Engines: three nozzles with flames that grow with thrust
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.6, roughness: 0.4 });
  const nozzleGeo = new THREE.CylinderGeometry(0.35, 0.5, 0.5, 12);
  const flameGeo = flameGeometry();
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const x = Math.cos(a) * ENGINE_RING;
    const z = Math.sin(a) * ENGINE_RING;

    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.set(x, ENGINE_Y + 0.15, z);
    root.add(nozzle);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(x, ENGINE_Y, z);
    root.add(flame);
    flames.push(flame);
  }

  const engineLight = new THREE.PointLight(C.exhaust, 0, 12, 2);
  engineLight.position.set(0, ENGINE_Y - 0.5, 0);

  root.add(hull, ring, cockpit, nose, navGreen, navRed, engineLight);

  return {
    object: root,

    // Sets position, orientation, and engine/nav visuals from the flight state.
    applyFlight(flight) {
      const { x, y, z } = flight.pos;
      const d = flight.dir;
      root.position.set(x, y, z);
      root.rotation.set(flight.bank, Math.atan2(-d.z, d.x), Math.asin(Math.max(-1, Math.min(1, d.y))), 'YXZ');

      const flicker = 0.92 + 0.08 * Math.sin(flight.time * 40);
      const length = (0.25 + 1.2 * flight.thrust) * flicker;
      for (const flame of flames) {
        flame.scale.set(1, length, 1);
        flame.visible = flight.thrust > 0.1;
      }
      flameMat.opacity = 0.4 + 0.45 * flight.thrust;
      engineLight.intensity = 8 * flight.thrust;

      const blink = Math.sin(flight.time * 5) > 0 ? 1.4 : 0.9;
      navGreen.scale.setScalar(blink);
      navRed.scale.setScalar(blink);
    },

    // World-space point under the hull, where exhaust is emitted
    engineOrigin(target) {
      root.updateMatrixWorld(true);
      return target.copy(ENGINE_LOCAL).applyMatrix4(root.matrixWorld);
    },
  };
}
