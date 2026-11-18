// Shared lit materials for structures and the train. Created once, patched for
// the shared atmosphere, disposed together.

import * as THREE from 'three';
import { patchMaterial } from './atmosShader.js';
import {
  makeConcreteTexture, makeTrackbedTexture, makePlateTexture, makeChevronTexture,
  makeTunnelTexture, makeTunnelGlowTexture,
} from './textures.js';

export function createMaterials() {
  const concreteTex = makeConcreteTexture();
  const trackbedTex = makeTrackbedTexture();
  const plateTex = makePlateTexture();
  const chevronTex = makeChevronTexture();
  const tunnelTex = makeTunnelTexture();
  const tunnelGlow = makeTunnelGlowTexture();
  plateTex.repeat.set(0.25, 0.25);   // extrusion UVs are in metres: one plate tile per 4 m

  const std = (opts, snow = 0) => patchMaterial(new THREE.MeshStandardMaterial(opts), { snow });
  const m = {
    concrete: std({ color: 0x8d93a0, map: concreteTex, roughness: 0.92, metalness: 0 }, 0.85),
    trackbed: std({ color: 0xffffff, map: trackbedTex, roughness: 0.85, metalness: 0 }),
    snow: std({ color: 0xdfe6f3, roughness: 0.8, metalness: 0 }),
    rail: std({ color: 0x9aa3ad, roughness: 0.32, metalness: 0.85 }),
    steel: std({ color: 0x5a616c, roughness: 0.55, metalness: 0.55 }, 0.7),
    hull: std({ color: 0x9aa3ae, map: plateTex, roughness: 0.5, metalness: 0.35 }, 0.4),
    hullDark: std({ color: 0x3c424b, roughness: 0.6, metalness: 0.35 }, 0.6),
    under: std({ color: 0x24272d, roughness: 0.8, metalness: 0.3 }),
    chevron: std({ color: 0xffffff, map: chevronTex, roughness: 0.6, metalness: 0.1 }, 0.4),
    platform: std({ color: 0xa9adb6, map: concreteTex, roughness: 0.9, metalness: 0 }, 0.5),
    tunnel: std({
      color: 0x9aa0aa, map: tunnelTex, roughness: 0.85, metalness: 0,
      emissive: 0xffffff, emissiveMap: tunnelGlow, emissiveIntensity: 0.9,
    }),
    canopy: std({ color: 0x3a404b, roughness: 0.6, metalness: 0.5 }, 1),
    lampWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.42).multiplyScalar(2.4) }),
  };
  patchMaterial(m.lampWarm, { lit: false });
  const textures = [concreteTex, trackbedTex, plateTex, chevronTex, tunnelTex, tunnelGlow];
  m.dispose = () => {
    Object.values(m).forEach((v) => v && v.isMaterial && v.dispose());
    textures.forEach((t) => t.dispose());
  };
  return m;
}
