import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const CAMERA_MODES = {
  ORBIT: 'orbit',
  CHASE: 'chase',
  PAD_TOWER: 'pad',
  COCKPIT: 'cockpit'
};

export class CameraManager {
  constructor(camera, domElement, spaceship) {
    this.camera = camera;
    this.domElement = domElement;
    this.ship = spaceship;
    this.mode = CAMERA_MODES.ORBIT;

    // Default Pad Vantage
    this.defaultCamPos = new THREE.Vector3(12.5, 6.8, 14.2);
    this.defaultCamTarget = new THREE.Vector3(0, 2.2, 0);

    // Tower Vantage Position
    this.towerCamPos = new THREE.Vector3(18.0, 16.5, -14.0);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't clip under ground plane
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 180.0;
    this.controls.target.copy(this.defaultCamTarget);

    // Camera Reset Transition State
    this.isResetting = false;
    this.resetStartPos = new THREE.Vector3();
    this.resetStartTarget = new THREE.Vector3();
    this.resetProgress = 0;

    // Smoothed Follow Cam Vectors
    this.currentChasePos = new THREE.Vector3();
    this.currentChaseTarget = new THREE.Vector3();

    // Set initial position
    this.resetCamera(false);
  }

  setMode(newMode) {
    this.mode = newMode;
    if (this.mode === CAMERA_MODES.ORBIT) {
      this.controls.enabled = true;
    } else {
      this.controls.enabled = false;
    }
  }

  resetCamera(animate = true) {
    if (!animate) {
      this.camera.position.copy(this.defaultCamPos);
      this.controls.target.copy(this.defaultCamTarget);
      this.controls.update();
      this.setMode(CAMERA_MODES.ORBIT);
      return;
    }

    this.isResetting = true;
    this.resetProgress = 0;
    this.resetStartPos.copy(this.camera.position);
    this.resetStartTarget.copy(this.controls.target);
    this.setMode(CAMERA_MODES.ORBIT);
  }

  zoomIn() {
    if (this.mode === CAMERA_MODES.ORBIT) {
      const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
      const newDist = Math.max(dir.length() * 0.78, this.controls.minDistance);
      dir.normalize().multiplyScalar(newDist);
      this.camera.position.copy(this.controls.target).add(dir);
      this.controls.update();
    }
  }

  zoomOut() {
    if (this.mode === CAMERA_MODES.ORBIT) {
      const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
      const newDist = Math.min(dir.length() * 1.25, this.controls.maxDistance);
      dir.normalize().multiplyScalar(newDist);
      this.camera.position.copy(this.controls.target).add(dir);
      this.controls.update();
    }
  }

  update(delta, isFlying, shipPos, shipQuat) {
    // 1. Reset Animation
    if (this.isResetting) {
      this.resetProgress += delta * 2.2;
      const t = Math.min(this.resetProgress, 1.0);
      const ease = 1 - Math.pow(1 - t, 3); // Cubic ease out

      this.camera.position.lerpVectors(this.resetStartPos, this.defaultCamPos, ease);
      this.controls.target.lerpVectors(this.resetStartTarget, this.defaultCamTarget, ease);
      this.controls.update();

      if (t >= 1.0) {
        this.isResetting = false;
      }
      return;
    }

    // 2. Mode Handling
    switch (this.mode) {
      case CAMERA_MODES.ORBIT:
        // When ship is in flight, smoothly track orbit target with ship so it stays framed
        if (isFlying) {
          const targetOffset = new THREE.Vector3(0, 0.8, 0);
          const shipCenter = shipPos.clone().add(targetOffset);
          this.controls.target.lerp(shipCenter, 0.08);
        }
        this.controls.update();
        break;

      case CAMERA_MODES.CHASE: {
        // Dynamic chase cam: behind and slightly above ship with lag damping
        const idealCamPos = new THREE.Vector3();
        this.ship.getChaseCameraMount(idealCamPos, 9.2, 3.4);
        
        // Smoothly interpolate camera position
        this.camera.position.lerp(idealCamPos, 0.12);

        // Look at point slightly in front of ship nose
        const forwardLook = new THREE.Vector3(0, 0.6, 6.0).applyQuaternion(shipQuat).add(shipPos);
        this.camera.lookAt(forwardLook);
        break;
      }

      case CAMERA_MODES.PAD_TOWER: {
        // Fixed at spaceport control observation deck, pan to track spaceship
        this.camera.position.lerp(this.towerCamPos, 0.05);
        const lookTarget = shipPos.clone().add(new THREE.Vector3(0, 0.8, 0));
        this.camera.lookAt(lookTarget);
        break;
      }

      case CAMERA_MODES.COCKPIT: {
        // Mounted directly on ship's cockpit
        const cockpitPos = new THREE.Vector3();
        this.ship.getCockpitWorldPosition(cockpitPos);
        this.camera.position.copy(cockpitPos);

        // Look forward along ship nose
        const forward = new THREE.Vector3(0, 0.1, 12.0).applyQuaternion(shipQuat).add(cockpitPos);
        this.camera.lookAt(forward);
        break;
      }
    }
  }
}
