import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorldScene } from '../src/scene.js';

describe('WorldScene Component', () => {
  it('creates the complete spaceport world with lighting, pad, and scenery', () => {
    const scene = new THREE.Scene();
    const world = new WorldScene(scene);

    expect(world.scene).toBe(scene);
    expect(world.runwayLights.length).toBeGreaterThan(0);
    expect(world.radarDish).toBeDefined();

    // Verify lights in scene
    const lights = scene.children.filter(c => c.isLight);
    expect(lights.length).toBeGreaterThanOrEqual(3); // Hemi, Sun, Fill

    // Update animations
    world.update(0.1);
    expect(world.radarDish.rotation.y).toBeGreaterThan(0);
  });
});
