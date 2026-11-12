import type { MapId } from '@shared/protocol';
import type { B, MatSpec } from './assets/kit';
import { PINK_MATS, PINK_MODELS } from './assets/pink';
import { BUNNY_MATS, BUNNY_MODELS } from './assets/bunny';
import { BERLIN_MATS, BERLIN_MODELS } from './assets/berlin';

export interface Theme {
  skyTop: string;
  skyBottom: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  sun: string;
  sunIntensity: number;
  sunDir: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  exposure: number;
  bloom: number;
  ground: {
    road: string;
    roadLine: string;
    sidewalk: string;
    curb: string;
    grass: string;
    grass2: string;
    plaza: string;
    plaza2: string;
    outside: string;
    crosswalk: string;
  };
  particles: { color: string; color2: string; kind: 'sparkle' | 'petal' | 'ember' };
  mats: Record<string, MatSpec>;
  models: Record<string, (b: B) => void>;
}

export const THEMES: Record<MapId, Theme> = {
  pink: {
    skyTop: '#ff9fd6',
    skyBottom: '#ffe6f4',
    fog: '#ffd6ee',
    fogNear: 140,
    fogFar: 520,
    sun: '#fff1f8',
    sunIntensity: 1.9,
    sunDir: [0.55, 1, 0.35],
    hemiSky: '#ffe3f3',
    hemiGround: '#ff9fcf',
    hemiIntensity: 0.55,
    exposure: 0.92,
    bloom: 0.35,
    ground: {
      road: '#9c5a7f',
      roadLine: '#ffe3f2',
      sidewalk: '#ffbfdd',
      curb: '#fff4fa',
      grass: '#7fd99a',
      grass2: '#6cc98a',
      plaza: '#ffd2e8',
      plaza2: '#ffa8d2',
      outside: '#f58cc0',
      crosswalk: '#ffffff',
    },
    particles: { color: '#ffffff', color2: '#ff7ac8', kind: 'sparkle' },
    mats: PINK_MATS,
    models: PINK_MODELS,
  },
  bunny: {
    skyTop: '#9fd8ff',
    skyBottom: '#fff4e0',
    fog: '#e9f4ff',
    fogNear: 140,
    fogFar: 520,
    sun: '#fff6e5',
    sunIntensity: 1.9,
    sunDir: [-0.4, 1, 0.5],
    hemiSky: '#dff1ff',
    hemiGround: '#bfeec0',
    hemiIntensity: 0.6,
    exposure: 0.92,
    bloom: 0.3,
    ground: {
      road: '#b99c86',
      roadLine: '#fff4e0',
      sidewalk: '#f6dcb8',
      curb: '#fffaf0',
      grass: '#93dd84',
      grass2: '#7fcf72',
      plaza: '#e9d6ff',
      plaza2: '#d2b8ff',
      outside: '#86cf78',
      crosswalk: '#ffffff',
    },
    particles: { color: '#ffd1e8', color2: '#ffffff', kind: 'petal' },
    mats: BUNNY_MATS,
    models: BUNNY_MODELS,
  },
  berlin: {
    skyTop: '#2b2f5e',
    skyBottom: '#ff9a62',
    fog: '#8a6a7a',
    fogNear: 120,
    fogFar: 480,
    sun: '#ffc48a',
    sunIntensity: 2.0,
    sunDir: [-0.7, 0.55, -0.3],
    hemiSky: '#9fa8ff',
    hemiGround: '#5a4a44',
    hemiIntensity: 0.6,
    exposure: 0.95,
    bloom: 0.55,
    ground: {
      road: '#3d3f45',
      roadLine: '#e8e2c8',
      sidewalk: '#9a958c',
      curb: '#c9c4b8',
      grass: '#6f9e4a',
      grass2: '#5f8f3e',
      plaza: '#b3aa9a',
      plaza2: '#a0978a',
      outside: '#4a4b50',
      crosswalk: '#e8e2c8',
    },
    particles: { color: '#ffd400', color2: '#ff2bd6', kind: 'ember' },
    mats: BERLIN_MATS,
    models: BERLIN_MODELS,
  },
};
