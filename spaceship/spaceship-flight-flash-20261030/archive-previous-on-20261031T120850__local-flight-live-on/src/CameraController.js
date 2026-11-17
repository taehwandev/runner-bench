import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const CAMERA_MODE = {
  ORBIT: 'ORBIT',
  CHASE: 'CHASE',
  TOWER: 'TOWER',
  COCKPIT: 'COCKPIT'
};

export class CameraController {
  constructor(camera, domElement, spaceship, landingPad) {
    this.camera = camera;
    this.domElement = domElement;
    this.ship = spaceship;
    this.pad = landingPad;

    this.mode = CAMERA_MODE.ORBIT;

    // Default hero framing
    this.defaultPos = new THREE.Vector3(24, 16, 26);
    this.defaultTarget = new THREE.Vector3(0, 3.5, 0);

    // Orbit Controls Setup
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 140;
    this.controls.maxPolarAngle = Math.PI * 0.49; // don't go below ground
    this.controls.target.copy(this.defaultTarget);

    this.camera.position.copy(this.defaultPos);
    this.camera.lookAt(this.defaultTarget);

    // Dynamic smoothing targets
    this.currentCamTarget = new THREE.Vector3().copy(this.defaultTarget);
    this.camTargetVelocity = new THREE.Vector3();

    // Tower spectator position (atop the control tower)
    this.towerPos = new THREE.Vector3(-24, 18.5, -18);

    // Reset animation state
    this.isResetting = false;
    this.resetProgress = 0;
    this.resetStartPos = new THREE.Vector3();
    this.resetStartTarget = new THREE.Vector3();

    // Callback on mode change
    this.onModeChange = null;
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;

    if (mode === CAMERA_MODE.ORBIT) {
      this.controls.enabled = true;
    } else {
      this.controls.enabled = false;
    }

    if (this.onModeChange) this.onModeChange(this.mode);
  }

  resetCamera() {
    this.isResetting = true;
    this.resetProgress = 0;
    this.resetStartPos.copy(this.camera.position);
    this.resetStartTarget.copy(this.controls.target);
    this.setMode(CAMERA_MODE.ORBIT);
  }

  zoomIn(amount = 0.2) {
    if (this.mode === CAMERA_MODE.ORBIT) {
      const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
      const currentDist = dir.length();
      const targetDist = Math.max(this.controls.minDistance, currentDist * (1 - amount));
      dir.setLength(targetDist);
      this.camera.position.copy(this.controls.target).add(dir);
    }
  }

  zoomOut(amount = 0.2) {
    if (this.mode === CAMERA_MODE.ORBIT) {
      const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
      const currentDist = dir.length();
      const targetDist = Math.min(this.controls.maxDistance, currentDist * (1 + amount));
      dir.setLength(targetDist);
      this.camera.position.copy(this.controls.target).add(dir);
    }
  }

  update(delta, time) {
    const dt = Math.min(delta, 0.1);
    const shipPos = this.ship.group.position;
    const shipQuat = this.ship.group.quaternion;

    // Handle Reset Animation
    if (this.isResetting) {
      this.resetProgress += dt * 2.2;
      const ease = THREE.MathUtils.smoothstep(this.resetProgress, 0, 1);

      this.camera.position.lerpVectors(this.resetStartPos, this.defaultPos, ease);
      this.controls.target.lerpVectors(this.resetStartTarget, this.defaultTarget, ease);

      if (this.resetProgress >= 1.0) {
        this.isResetting = false;
        this.camera.position.copy(this.defaultPos);
        this.controls.target.copy(this.defaultTarget);
      }
      this.controls.update();
      return;
    }

    // Handle Active Camera Mode
    switch (this.mode) {
      case CAMERA_MODE.ORBIT:
        // When ship is in air during flight, smoothly bias orbit target towards ship to keep it centered
        if (shipPos.y > 3.0) {
          this.currentCamTarget.lerp(shipPos, dt * 2.5);
          this.controls.target.copy(this.currentCamTarget);
        } else {
          this.currentCamTarget.lerp(this.defaultTarget, dt * 2.5);
          this.controls.target.copy(this.currentCamTarget);
        }
        this.controls.update();
        break;

      case CAMERA_MODE.CHASE: {
        // Behind and slightly above the ship, aligned with ship direction
        const offset = new THREE.Vector3(0, 3.8, -11.5);
        offset.applyQuaternion(shipQuat);
        const targetCamPos = new THREE.Vector3().copy(shipPos).add(offset);

        // Smooth camera follow
        this.camera.position.lerp(targetCamPos, dt * 5.0);

        // Look at a point slightly ahead of the ship
        const lookAhead = new THREE.Vector3(0, 0.8, 6.0).applyQuaternion(shipQuat).add(shipPos);
        this.currentCamTarget.lerp(lookAhead, dt * 8.0);
        this.camera.lookAt(this.currentCamTarget);
        break;
      }

      case CAMERA_MODE.TOWER: {
        // Tower spectator position looking down at spaceship
        this.camera.position.lerp(this.towerPos, dt * 4.0);
        // Look at ship with slight anticipation
        this.currentCamTarget.lerp(shipPos, dt * 6.0);
        this.camera.lookAt(this.currentCamTarget);
        break;
      }

      case CAMERA_MODE.COCKPIT: {
        // Inside cockpit looking forward
        const cockpitPos = new THREE.Vector3(0, 0.95, 0.9).applyQuaternion(shipQuat).add(shipPos);
        const forwardView = new THREE.Vector3(0, 0.95, 12.0).applyQuaternion(shipQuat).add(shipPos);

        this.camera.position.copy(cockpitPos);
        this.camera.lookAt(forwardView);
        break;
      }
    }
  }
}
