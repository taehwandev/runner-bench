import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const CameraMode = {
  FOLLOW: 'FOLLOW',
  PAD: 'PAD',
  FREE: 'FREE',
  COCKPIT: 'COCKPIT',
};

export class CameraController {
  constructor(camera, domElement, spaceship) {
    this.camera = camera;
    this.domElement = domElement;
    this.ship = spaceship;

    this.mode = CameraMode.FOLLOW;

    // Standard OrbitControls for interactive orbit & zoom
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 140;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // prevent dipping under ground

    // Default framing values for RESET
    this.defaultFollowOffset = new THREE.Vector3(0, 4.0, -11.0);
    this.defaultPadPos = new THREE.Vector3(-18.0, 10.5, 20.0);
    this.defaultPadTarget = new THREE.Vector3(0, 1.5, 0);

    // Current smooth targets for camera transitions
    this.currentTarget = new THREE.Vector3(0, 1.0, 0);
    this.currentCamPos = this.camera.position.clone();

    // Listen to user interaction on OrbitControls to allow manual orbiting in all modes
    this.isUserInteracting = false;
    this.controls.addEventListener('start', () => {
      this.isUserInteracting = true;
    });
    this.controls.addEventListener('end', () => {
      this.isUserInteracting = false;
    });

    this.setMode(CameraMode.FOLLOW);
  }

  setMode(mode) {
    this.mode = mode;
    this.isUserInteracting = false;

    if (mode === CameraMode.COCKPIT) {
      this.controls.enabled = false;
    } else {
      this.controls.enabled = true;
    }

    if (mode === CameraMode.PAD) {
      this.camera.position.copy(this.defaultPadPos);
      this.controls.target.copy(this.defaultPadTarget);
    } else if (mode === CameraMode.FOLLOW || mode === CameraMode.FREE) {
      this.resetView();
    }
  }

  resetView() {
    this.isUserInteracting = false;
    const shipPos = this.ship.group.position;

    if (this.mode === CameraMode.FOLLOW || this.mode === CameraMode.FREE) {
      // Calculate position behind the ship based on ship orientation
      const behindOffset = this.defaultFollowOffset.clone();
      behindOffset.applyQuaternion(this.ship.group.quaternion);

      this.camera.position.copy(shipPos).add(behindOffset);
      this.controls.target.copy(shipPos).add(new THREE.Vector3(0, 1.0, 0));
    } else if (this.mode === CameraMode.PAD) {
      this.camera.position.copy(this.defaultPadPos);
      this.controls.target.copy(shipPos);
    }
    this.controls.update();
  }

  zoomIn(scale = 1.18) {
    if (this.mode === CameraMode.COCKPIT) return;
    if (this.controls._dollyOut) {
      this.controls._dollyOut(scale);
      this.controls.update();
    }
  }

  zoomOut(scale = 1.18) {
    if (this.mode === CameraMode.COCKPIT) return;
    if (this.controls._dollyIn) {
      this.controls._dollyIn(scale);
      this.controls.update();
    }
  }

  update(delta) {
    const shipPos = this.ship.group.position;
    const shipQuat = this.ship.group.quaternion;

    if (this.mode === CameraMode.COCKPIT) {
      // Camera mounted inside cockpit looking forward (+Z in ship local space)
      const cockpitOffset = new THREE.Vector3(0, 1.25, 0.75);
      cockpitOffset.applyQuaternion(shipQuat);
      this.camera.position.copy(shipPos).add(cockpitOffset);

      // Forward look target
      const forward = new THREE.Vector3(0, 0, 10).applyQuaternion(shipQuat);
      const lookTarget = shipPos.clone().add(forward);
      this.camera.lookAt(lookTarget);
      return;
    }

    if (this.mode === CameraMode.PAD) {
      // Fixed observer camera tracking the ship smoothly
      if (!this.isUserInteracting) {
        const lookTarget = shipPos.clone().add(new THREE.Vector3(0, 0.8, 0));
        this.controls.target.lerp(lookTarget, 0.08);
      }
      this.controls.update();
      return;
    }

    if (this.mode === CameraMode.FOLLOW) {
      const targetLook = shipPos.clone().add(new THREE.Vector3(0, 1.0, 0));

      if (!this.isUserInteracting) {
        // Compute desired camera position behind and above ship
        const offset = this.defaultFollowOffset.clone().applyQuaternion(shipQuat);
        const desiredPos = shipPos.clone().add(offset);

        // Prevent camera from clipping through ground
        desiredPos.y = Math.max(1.8, desiredPos.y);

        this.camera.position.lerp(desiredPos, 0.06);
        this.controls.target.lerp(targetLook, 0.09);
      } else {
        // User is manually orbiting in follow mode: keep target on ship
        this.controls.target.lerp(targetLook, 0.12);
      }

      this.controls.update();
      return;
    }

    if (this.mode === CameraMode.FREE) {
      // In Free mode, smoothly follow ship center as target
      const targetLook = shipPos.clone().add(new THREE.Vector3(0, 1.0, 0));
      this.controls.target.lerp(targetLook, 0.08);
      this.controls.update();
    }
  }
}
