import * as THREE from 'three';
import type { MatSpec } from './kit';
import { textureByKey } from './textures';

/** Materials shared by every map. Map packs add their own on top. */
export const COMMON_MATS: Record<string, MatSpec> = {
  black: { color: '#15151a', rough: 0.6 },
  white: { color: '#f5f5f5', rough: 0.55 },
  offwhite: { color: '#efe8dc', rough: 0.7 },
  chrome: { color: '#e8e8ee', rough: 0.12, metal: 1 },
  gold: { color: '#f5c542', rough: 0.25, metal: 1 },
  glass: { color: '#9fd8ff', rough: 0.05, metal: 0.6, opacity: 0.55 },
  darkglass: { color: '#1b2430', rough: 0.08, metal: 0.7 },
  tire: { color: '#1d1d1f', rough: 0.85 },
  rubber: { color: '#2a2a2e', rough: 0.9 },
  metal: { color: '#9aa0a8', rough: 0.35, metal: 0.8 },
  darkmetal: { color: '#3b3f46', rough: 0.4, metal: 0.8 },
  wood: { color: '#a8743f', rough: 0.8 },
  darkwood: { color: '#6b4524', rough: 0.8 },
  leaf: { color: '#4caf50', rough: 0.75 },
  leafdark: { color: '#2e7d32', rough: 0.8 },
  trunk: { color: '#7a5533', rough: 0.9 },
  skin1: { color: '#f2c9a5', rough: 0.6 },
  skin2: { color: '#d9a07a', rough: 0.6 },
  skin3: { color: '#a8714d', rough: 0.6 },
  skin4: { color: '#6e4630', rough: 0.6 },
  red: { color: '#e53935', rough: 0.45 },
  orange: { color: '#ff8a1f', rough: 0.5 },
  yellow: { color: '#ffd23f', rough: 0.5 },
  green: { color: '#43c463', rough: 0.5 },
  blue: { color: '#2f7bff', rough: 0.45 },
  lightblue: { color: '#8fd3ff', rough: 0.5 },
  purple: { color: '#8a5cff', rough: 0.45 },
  pinkhot: { color: '#ff3fa4', rough: 0.4 },
  pinksoft: { color: '#ffc2e6', rough: 0.55 },
  water: { color: '#6fd3ff', rough: 0.05, metal: 0.3, opacity: 0.75 },
  stone: { color: '#cfc7bb', rough: 0.85 },
  concrete: { color: '#9b9a96', rough: 0.9, map: 'concrete' },
  lampglow: { color: '#fff4c2', emissive: '#ffe08a', ei: 2.2, rough: 0.3 },
  neonpink: { color: '#ff2bd6', emissive: '#ff2bd6', ei: 2.5 },
  neongreen: { color: '#39ff88', emissive: '#39ff88', ei: 2.5 },
  neonblue: { color: '#2bd9ff', emissive: '#2bd9ff', ei: 2.5 },
  redlight: { color: '#ff2a2a', emissive: '#ff2a2a', ei: 2.5 },
  greenlight: { color: '#2aff6a', emissive: '#2aff6a', ei: 2.5 },
};

export class MaterialLib {
  private cache = new Map<string, THREE.Material>();
  private specs: Record<string, MatSpec>;

  constructor(specs: Record<string, MatSpec>) {
    this.specs = { ...COMMON_MATS, ...specs };
  }

  get = (key: string): THREE.Material => {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const s = this.specs[key];
    if (!s) throw new Error('unknown material ' + key);
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(s.color),
      roughness: s.rough ?? 0.6,
      metalness: s.metal ?? 0,
      transparent: s.opacity != null,
      opacity: s.opacity ?? 1,
      side: s.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
    });
    if (s.opacity != null) m.depthWrite = s.opacity > 0.7;
    if (s.map) m.map = textureByKey(s.map);
    if (s.emissive) {
      m.emissive = new THREE.Color(s.emissive);
      m.emissiveIntensity = s.ei ?? 1;
    }
    if (s.emap) {
      m.emissiveMap = textureByKey(s.emap);
      m.emissive = new THREE.Color('#ffffff');
      m.emissiveIntensity = s.ei ?? 1.4;
    }
    m.name = key;
    this.cache.set(key, m);
    return m;
  };

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
  }
}
