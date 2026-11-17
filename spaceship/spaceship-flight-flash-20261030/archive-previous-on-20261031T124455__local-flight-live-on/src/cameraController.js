import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const CameraMode = {
  TRACKING: 'TRACKING',
  CHASE: 'CHASE',
  TOWER: 'TOWER',
  FREE_ORBIT: 'FREE_ORBIT',
};

export class CameraController {
  constructor(camera, domElement, spaceship) {
    this.camera = camera;
    this.domElement = domElement;
    this.ship = spaceship;

    this.mode = CameraMode.TRACKING;

    // Default tracking offset from ship
    this.orbitOffset = new THREE.Vector3(15, 8.5, 18);
    this.currentOffset = this.orbitOffset.clone();

    // Tower position
    this.towerPosition = new THREE.Vector3(38, 23.5, 36);

    // Setup OrbitControls
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 140;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going underground
    this.controls.minPolarAngle = 0.05;

    // Touch controls optimization for mobile
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    // Set initial camera view
    this.resetCamera();
  }

  setMode(mode) {
    this.mode = mode;

    if (mode === CameraMode.CHASE) {
      this.controls.enabled = false;
    } else if (mode === CameraMode.TOWER) {
      this.controls.enabled = false;
      this.camera.position.copy(this.towerPosition);
    } else if (mode === CameraMode.TRACKING) {
      this.controls.enabled = true;
      const shipPos = this.ship.group.position;
      this.controls.target.copy(shipPos);
      this.camera.position.copy(shipPos).add(this.currentOffset);
    } else if (mode === CameraMode.FREE_ORBIT) {
      this.controls.enabled = true;
      this.controls.target.set(0, 1.5, 0);
    }
  }

  resetCamera() {
    this.mode = CameraMode.TRACKING;
    this.controls.enabled = true;

    const shipPos = this.ship.group.position;
    this.controls.target.copy(shipPos);

    this.currentOffset.set(16, 9, 18);
    this.camera.position.copy(shipPos).add(this.currentOffset);
    this.camera.lookAt(shipPos);
    this.controls.update();
  }

  zoom(factor) {
    // factor > 1 = zoom in, factor < 1 = zoom out
    const target = this.controls.target;
    const direction = this.camera.position.clone().sub(target);
    const newLength = THREE.MathUtils.clamp(
      direction.length() * (1 / factor),
      this.controls.minDistance,
      this.controls.maxDistance
    );
    direction.setLength(newLength);
    this.camera.position.copy(target).add(direction);
    this.currentOffset.copy(direction);
    this.controls.update();
  }

  orbitByAngle(angleRad) {
    // Rotates camera around current target
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);

    // Apply rotation around Y axis
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleRad);
    this.camera.position.copy(target).add(offset);
    this.currentOffset.copy(offset);
    this.camera.lookAt(target);
    this.controls.update();
  }

  update(delta) {
    const shipPos = this.ship.group.position;

    switch (this.mode) {
      case CameraMode.TRACKING: {
        // Target smoothly follows spaceship
        const prevTarget = this.controls.target.clone();
        this.controls.target.lerp(shipPos, 0.12);

        // Keep relative camera offset so ship stays in frame while following
        const translation = this.controls.target.clone().sub(prevTarget);
        this.camera.position.add(translation);

        this.controls.update();
        // Record current relative offset for camera continuity
        this.currentOffset.copy(this.camera.position).sub(this.controls.target);
        break;
      }

      case CameraMode.CHASE: {
        // Cinematic chase cam behind ship's tail
        const localChaseOffset = new THREE.Vector3(0, 3.2, -9.8);
        const worldChasePos = localChaseOffset.applyQuaternion(this.ship.group.quaternion).add(shipPos);

        // Target slightly ahead of ship
        const localTargetOffset = new THREE.Vector3(0, 0.8, 12.0);
        const worldTarget = localTargetOffset.applyQuaternion(this.ship.group.quaternion).add(shipPos);

        this.camera.position.lerp(worldChasePos, 0.12);

        const currentLookAt = new THREE.Vector3();
        this.camera.getWorldDirection(currentLookAt);
        const targetDirection = worldTarget.clone().sub(this.camera.position).normalize();
        currentLookAt.lerp(targetDirection, 0.14);

        this.camera.lookAt(this.camera.position.clone().add(currentLookAt));
        break;
      }

      case CameraMode.TOWER: {
        // Camera fixed at tower cupola, pans & tilts tracking ship
        this.camera.position.copy(this.towerPosition);
        // Smooth lookAt ship
        this.camera.lookAt(shipPos);
        break;
      }

      case CameraMode.FREE_ORBIT: {
        this.controls.update();
        break;
      }
    }
  }
}
