// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Hud } from '../src/ui/hud.js';
import { FlightController } from '../src/flight/flightController.js';
import { CameraManager, CameraMode } from '../src/camera/cameraManager.js';
import { FlightPhase } from '../src/flight/circuit.js';

describe('HUD & User Interaction Suite (jsdom)', () => {
  let mockShip;
  let flight;
  let camera;
  let cameraManager;
  let mockAudio;
  let hud;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="canvas-container"></div>
      <div id="hud-overlay"></div>
    `;

    mockShip = {
      position: new THREE.Vector3(0, 0.65, 0),
      quaternion: new THREE.Quaternion(),
      gearExtension: 1,
      throttle: 0,
      vtolThrottle: 0,
      setGearExtension(v) { this.gearExtension = v; },
      setThrottle(m, v) { this.throttle = m; this.vtolThrottle = v; }
    };

    flight = new FlightController(mockShip);
    camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 1000);
    const mockDom = document.getElementById('canvas-container');
    Object.defineProperty(mockDom, 'clientHeight', { value: 600, configurable: true });
    Object.defineProperty(mockDom, 'clientWidth', { value: 800, configurable: true });
    cameraManager = new CameraManager(camera, mockDom, mockShip);

    mockAudio = {
      isMuted: true,
      init: () => {},
      toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
      },
      update: () => {},
      playTouchdown: () => {}
    };

    hud = new Hud({
      flightController: flight,
      cameraManager,
      synthAudio: mockAudio
    });
  });

  it('renders all essential HUD sections and initial READY state', () => {
    const badge = document.getElementById('flight-status-badge');
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe('READY ON PAD 01');

    const btnPrimary = document.getElementById('btn-primary-action');
    expect(btnPrimary).toBeDefined();
    expect(document.getElementById('primary-action-text').textContent).toBe('INITIATE TAKEOFF');

    const radar = document.getElementById('radar-canvas');
    expect(radar).toBeDefined();

    const telAlt = document.getElementById('tel-alt');
    expect(telAlt.textContent).toBe('0.0');
  });

  it('initiates takeoff when clicking primary action button', () => {
    const btnPrimary = document.getElementById('btn-primary-action');
    btnPrimary.click();

    expect(flight.phase).toBe(FlightPhase.SPOOLING);
    const badge = document.getElementById('flight-status-badge');
    expect(badge.textContent).toBe('SPOOLING ENGINES...');
  });

  it('switches camera modes when clicking view buttons', () => {
    const chaseBtn = document.querySelector('[data-mode="CHASE"]');
    expect(chaseBtn).toBeDefined();
    chaseBtn.click();

    expect(cameraManager.mode).toBe(CameraMode.CHASE);
    expect(chaseBtn.classList.contains('active')).toBe(true);

    const inspectBtn = document.querySelector('[data-mode="INSPECT"]');
    inspectBtn.click();
    expect(cameraManager.mode).toBe(CameraMode.INSPECT);
    expect(inspectBtn.classList.contains('active')).toBe(true);
  });

  it('executes zoom in, zoom out, and reset camera buttons', () => {
    const initialDist = camera.position.distanceTo(cameraManager.controls.target);

    document.getElementById('btn-zoom-in').click();
    const zoomedInDist = camera.position.distanceTo(cameraManager.controls.target);
    expect(zoomedInDist).toBeLessThan(initialDist);

    document.getElementById('btn-zoom-out').click();
    const zoomedOutDist = camera.position.distanceTo(cameraManager.controls.target);
    expect(zoomedOutDist).toBeGreaterThan(zoomedInDist);

    document.getElementById('btn-cam-reset').click();
    expect(cameraManager.mode).toBe(CameraMode.ORBIT_PAD);
  });

  it('toggles audio on and off with visual text feedback', () => {
    const btnSound = document.getElementById('btn-sound');
    expect(btnSound.querySelector('.btn-text').textContent).toBe('SOUND OFF');

    btnSound.click();
    expect(mockAudio.isMuted).toBe(false);
    expect(btnSound.querySelector('.btn-text').textContent).toBe('SOUND ON');

    btnSound.click();
    expect(mockAudio.isMuted).toBe(true);
    expect(btnSound.querySelector('.btn-text').textContent).toBe('SOUND OFF');
  });

  it('changes simulation speed multiplier', () => {
    const btn2x = document.querySelector('[data-speed="2.0"]');
    btn2x.click();
    expect(flight.speedMultiplier).toBe(2.0);
    expect(btn2x.classList.contains('active')).toBe(true);
  });

  it('responds to keyboard shortcuts', () => {
    // Space triggers takeoff
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(flight.phase).toBe(FlightPhase.SPOOLING);

    // Number keys switch cameras
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
    expect(cameraManager.mode).toBe(CameraMode.CHASE);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4' }));
    expect(cameraManager.mode).toBe(CameraMode.TOWER);

    // R resets camera
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    expect(cameraManager.mode).toBe(CameraMode.ORBIT_PAD);
  });

  it('opens and closes the guide modal', () => {
    const modal = document.getElementById('guide-modal');
    expect(modal.classList.contains('hidden')).toBe(true);

    document.getElementById('btn-help').click();
    expect(modal.classList.contains('hidden')).toBe(false);

    document.getElementById('btn-close-modal').click();
    expect(modal.classList.contains('hidden')).toBe(true);
  });

  it('updates telemetry HUD metrics during flight', () => {
    flight.startCircuit();
    flight.update(1.4); // spool
    flight.update(1.6); // mid-climb

    const telAlt = document.getElementById('tel-alt');
    const telGear = document.getElementById('tel-gear');
    const barAlt = document.getElementById('bar-alt');

    expect(parseFloat(telAlt.textContent)).toBeGreaterThan(2.0);
    expect(barAlt.style.width).not.toBe('0%');
    expect(telGear.textContent).toMatch(/IN TRANSIT|RETRACTED/);
  });
});
