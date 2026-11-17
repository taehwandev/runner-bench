import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const CameraMode = Object.freeze({
  ORBIT_PAD: 'ORBIT_PAD',
  CHASE: 'CHASE',
  INSPECT: 'INSPECT',
  TOWER: 'TOWER',
  COCKPIT: 'COCKPIT'
});

export class CameraManager {
  constructor(camera, domElement, ship) {
    this.camera = camera;
    this.domElement = domElement;
    this.ship = ship;

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 3.0;
    this.controls.maxDistance = 220.0;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going beneath ground

    // Default configuration for pad overview
    this.defaultCamPos = new THREE.Vector3(26.0, 16.0, 36.0);
    this.defaultTarget = new THREE.Vector3(0, 4.0, 0);

    // Current Mode
    this.mode = CameraMode.ORBIT_PAD;

    // Smooth transition state
    this.isTransitioning = false;
    this.transitionDuration = 1.0;
    this.transitionTimer = 0;
    this.startCamPos = new THREE.Vector3();
    this.startTarget = new THREE.Vector3();
    this.endCamPos = new THREE.Vector3();
    this.endTarget = new THREE.Vector3();

    // Tower position (observation cab roof)
    this.towerPos = new THREE.Vector3(-28.0, 24.5, -20.0);

    // Chase camera smoothing vectors
    this.currentChasePos = new THREE.Vector3().copy(this.defaultCamPos);
    this.currentChaseTarget = new THREE.Vector3();

    // Callbacks
    this.onModeChange = null;

    this.resetCamera(false);
  }

  setMode(newMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;

    if (this.mode === CameraMode.ORBIT_PAD) {
      this.controls.enabled = true;
      this.controls.target.copy(this.defaultTarget);
    } else if (this.mode === CameraMode.INSPECT) {
      this.controls.enabled = true;
      this.controls.minDistance = 2.5;
      this.controls.maxDistance = 40.0;
    } else if (this.mode === CameraMode.CHASE) {
      this.controls.enabled = false;
    } else if (this.mode === CameraMode.TOWER) {
      this.controls.enabled = false;
      this.camera.position.copy(this.towerPos);
    } else if (this.mode === CameraMode.COCKPIT) {
      this.controls.enabled = false;
    }

    if (this.onModeChange) this.onModeChange(this.mode);
  }

  resetCamera(smooth = true) {
    if (!smooth) {
      this.mode = CameraMode.ORBIT_PAD;
      this.controls.enabled = true;
      this.camera.position.copy(this.defaultCamPos);
      this.controls.target.copy(this.defaultTarget);
      this.controls.update();
      this.isTransitioning = false;
      if (this.onModeChange) this.onModeChange(this.mode);
    } else {
      this.mode = CameraMode.ORBIT_PAD;
      this.controls.enabled = true;
      this.startCamPos.copy(this.camera.position);
      this.startTarget.copy(this.controls.target);
      this.endCamPos.copy(this.defaultCamPos);
      this.endTarget.copy(this.defaultTarget);
      this.transitionTimer = 0;
      this.isTransitioning = true;
      if (this.onModeChange) this.onModeChange(this.mode);
    }
  }

  zoom(factor) {
    // factor > 0: zoom in, factor < 0: zoom out
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const dist = dir.length();
    const newDist = THREE.MathUtils.clamp(dist * (1.0 - factor), this.controls.minDistance, this.controls.maxDistance);
    dir.normalize().multiplyScalar(newDist);
    this.camera.position.copy(this.controls.target).add(dir);
  }

  update(deltaSec, shipState) {
    if (deltaSec > 0.1) deltaSec = 0.1;

    // Handle smooth transition to reset position
    if (this.isTransitioning) {
      this.transitionTimer += deltaSec;
      const t = Math.min(1.0, this.transitionTimer / this.transitionDuration);
      const ease = t * t * (3 - 2 * t);

      this.camera.position.lerpVectors(this.startCamPos, this.endCamPos, ease);
      this.controls.target.lerpVectors(this.startTarget, this.endTarget, ease);
      this.controls.update();

      if (t >= 1.0) {
        this.isTransitioning = false;
      }
      return;
    }

    const { position, quaternion } = shipState;

    switch (this.mode) {
      case CameraMode.ORBIT_PAD: {
        // Orbit centered on pad, user has free orbit/pan/zoom
        this.controls.update();
        break;
      }

      case CameraMode.INSPECT: {
        // Center orbit target on spaceship position so user can orbit 360 around the moving ship
        const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        this.controls.target.copy(position);
        this.camera.position.copy(position).add(offset);
        this.controls.update();
        break;
      }

      case CameraMode.CHASE: {
        // Offset behind and above ship in ship's local coordinates
        const localOffset = new THREE.Vector3(0, 2.8, 8.5);
        localOffset.applyQuaternion(quaternion);
        const desiredPos = position.clone().add(localOffset);

        // Look at point slightly ahead of ship
        const lookAhead = new THREE.Vector3(0, 0.4, -4.0);
        lookAhead.applyQuaternion(quaternion);
        const desiredTarget = position.clone().add(lookAhead);

        // Smooth follow
        this.camera.position.lerp(desiredPos, 8.0 * deltaSec);
        this.currentChaseTarget.lerp(desiredTarget, 10.0 * deltaSec);
        this.camera.lookAt(this.currentChaseTarget);
        break;
      }

      case CameraMode.TOWER: {
        // Fixed at tower, tracking the ship with smooth panning
        this.camera.position.copy(this.towerPos);
        const lookTarget = position.clone().add(new THREE.Vector3(0, 0.5, 0));
        this.camera.lookAt(lookTarget);
        break;
      }

      case CameraMode.COCKPIT: {
        // Inside canopy
        const cockpitPos = new THREE.Vector3(0, 0.38, -0.7).applyQuaternion(quaternion).add(position);
        const lookDir = new THREE.Vector3(0, 0.2, -8.0).applyQuaternion(quaternion).add(position);
        this.camera.position.copy(cockpitPos);
        this.camera.lookAt(lookDir);
        break;
      }
    }
  }
}
