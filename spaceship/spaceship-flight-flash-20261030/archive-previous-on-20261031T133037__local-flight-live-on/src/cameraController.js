import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const CAMERA_MODES = {
  DIRECTOR: 'DIRECTOR',
  CHASE: 'CHASE',
  TOWER: 'TOWER',
  FREE: 'FREE'
};

/**
 * Camera controller providing:
 * - Orbit, zoom, and reset camera controls
 * - Intelligent Director tracking to keep spaceship clearly visible at all times
 * - Chase & Tower camera presets
 * - Smooth lerping for comfortable desktop and mobile experience
 */
export class CameraController {
  constructor(camera, domElement, spaceship) {
    this.camera = camera;
    this.domElement = domElement;
    this.spaceship = spaceship;

    // Default pristine camera framing (ready on landing pad)
    this.defaultPosition = new THREE.Vector3(16, 7.5, 20);
    this.defaultTarget = new THREE.Vector3(0, 1.2, 0);

    // Initial camera placement
    this.camera.position.copy(this.defaultPosition);

    // Setup OrbitControls
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.copy(this.defaultTarget);
    this.controls.minDistance = 4.0;
    this.controls.maxDistance = 140.0;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Prevent going beneath ground

    // Current camera mode
    this.mode = CAMERA_MODES.DIRECTOR;

    // Transition animation state
    this.isResetting = false;
    this.resetTimer = 0;
    this.resetDuration = 1.0;
    this.resetStartPos = new THREE.Vector3();
    this.resetStartTarget = new THREE.Vector3();

    // Tower vantage point (on control tower roof)
    this.towerPosition = new THREE.Vector3(-28, 16.5, -22);

    // Detect user manual interaction to handle mode gracefully
    this.controls.addEventListener('start', () => {
      // If user starts dragging in Director mode, allow them to freely orbit
      if (this.mode === CAMERA_MODES.DIRECTOR) {
        // Keeps target locked on ship but allows manual rotation around it
      }
    });
  }

  setMode(mode) {
    if (!CAMERA_MODES[mode]) return;
    this.mode = mode;

    if (mode === CAMERA_MODES.TOWER) {
      this.camera.position.copy(this.towerPosition);
      this.controls.target.copy(this.spaceship.getMesh().position);
    } else if (mode === CAMERA_MODES.FREE) {
      this.controls.enabled = true;
    }
  }

  resetCamera() {
    this.isResetting = true;
    this.resetTimer = 0;
    this.resetStartPos.copy(this.camera.position);
    this.resetStartTarget.copy(this.controls.target);
    this.mode = CAMERA_MODES.DIRECTOR;
  }

  zoomIn() {
    // Zoom closer towards the target
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const newDist = Math.max(this.controls.minDistance, dir.length() * 0.8);
    dir.setLength(newDist);
    this.camera.position.copy(this.controls.target).add(dir);
  }

  zoomOut() {
    // Zoom out further away
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const newDist = Math.min(this.controls.maxDistance, dir.length() * 1.25);
    dir.setLength(newDist);
    this.camera.position.copy(this.controls.target).add(dir);
  }

  update(delta) {
    const shipMesh = this.spaceship.getMesh();
    const shipPos = shipMesh.position;

    // Handle smooth reset animation
    if (this.isResetting) {
      this.resetTimer += delta;
      const t = Math.min(1.0, this.resetTimer / this.resetDuration);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      this.camera.position.lerpVectors(this.resetStartPos, this.defaultPosition, ease);
      this.controls.target.lerpVectors(this.resetStartTarget, this.defaultTarget, ease);

      if (t >= 1.0) {
        this.isResetting = false;
      }
      this.controls.update();
      return;
    }

    // Mode-specific camera behavior
    switch (this.mode) {
      case CAMERA_MODES.DIRECTOR: {
        // Track the spaceship smoothly
        const targetPoint = shipPos.clone().add(new THREE.Vector3(0, 0.8, 0));
        this.controls.target.lerp(targetPoint, delta * 3.5);

        // Adjust camera position smoothly so ship remains centered with spaceport scenery
        // Calculate offset vector from target to camera
        const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);

        // Ensure distance stays within comfortable 18-36m range so ship is clearly visible
        const currentDist = offset.length();
        let desiredDist = THREE.MathUtils.clamp(18.0 + shipPos.y * 0.4, 16.0, 36.0);

        if (Math.abs(currentDist - desiredDist) > 0.5) {
          offset.setLength(THREE.MathUtils.lerp(currentDist, desiredDist, delta * 1.5));
          this.camera.position.copy(this.controls.target).add(offset);
        }
        break;
      }

      case CAMERA_MODES.CHASE: {
        // Third person follow camera
        // Calculate point behind the ship based on ship's rotation
        const backOffset = new THREE.Vector3(0, 2.5, -7.5);
        backOffset.applyQuaternion(shipMesh.quaternion);
        const desiredPos = shipPos.clone().add(backOffset);

        // Keep camera above ground
        desiredPos.y = Math.max(1.8, desiredPos.y);

        this.camera.position.lerp(desiredPos, delta * 4.5);

        // Look ahead of the ship
        const forwardLook = new THREE.Vector3(0, 0.8, 12);
        forwardLook.applyQuaternion(shipMesh.quaternion);
        const targetLook = shipPos.clone().add(forwardLook);

        this.controls.target.lerp(targetLook, delta * 6.0);
        break;
      }

      case CAMERA_MODES.TOWER: {
        // Fixed high vantage point on tower
        this.camera.position.lerp(this.towerPosition, delta * 3.0);
        this.controls.target.lerp(shipPos, delta * 4.0);
        break;
      }

      case CAMERA_MODES.FREE: {
        // Free orbit: only controls updates
        break;
      }
    }

    this.controls.update();
  }
}
