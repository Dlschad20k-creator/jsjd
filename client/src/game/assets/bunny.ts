/** Baby Bunny World — pastel models drawn in code (unit footprint radius 1, base y = 0). */
import type { B, MatSpec } from './kit';

export const BUNNY_MATS: Record<string, MatSpec> = {
  bwhite: { color: '#fffaf5', rough: 0.95 },
  bcream: { color: '#fbe8d3', rough: 0.95 },
  bbrown: { color: '#c79a73', rough: 0.95 },
  bgrey: { color: '#d9d4e3', rough: 0.95 },
  earpink: { color: '#ffb7cf', rough: 0.8 },
  nose: { color: '#ff7fa8', rough: 0.5 },
  eye: { color: '#1c1020', rough: 0.2 },
  carrot: { color: '#ff8a1f', rough: 0.6 },
  carrotleaf: { color: '#5bd16b', rough: 0.7 },
  pblue: { color: '#a8dcff', rough: 0.55 },
  pmint: { color: '#b4f2d6', rough: 0.55 },
  pyellow: { color: '#fff0a3', rough: 0.55 },
  plilac: { color: '#dcc6ff', rough: 0.55 },
  ppink: { color: '#ffc7de', rough: 0.55 },
  ppeach: { color: '#ffd8b8', rough: 0.55 },
  roofpink: { color: '#ff9cc4', rough: 0.6 },
  roofblue: { color: '#7fc4ff', rough: 0.6 },
  roofmint: { color: '#6fdcb0', rough: 0.6 },
  shroomred: { color: '#ff5f6d', rough: 0.5 },
  shroomlilac: { color: '#c59bff', rough: 0.5 },
  stem: { color: '#fff4e0', rough: 0.8 },
  cloud: { color: '#ffffff', rough: 0.95, emissive: '#ffffff', ei: 0.08 },
  candyfloss1: { color: '#ffb6e1', rough: 0.95 },
  candyfloss2: { color: '#b6e3ff', rough: 0.95 },
  candyfloss3: { color: '#fff1a8', rough: 0.95 },
  teddy: { color: '#d8a26b', rough: 0.98 },
  teddylight: { color: '#f2d2a9', rough: 0.98 },
  duck: { color: '#ffd93b', rough: 0.3 },
  bottle: { color: '#f3fbff', rough: 0.05, metal: 0.2, opacity: 0.7 },
  milk: { color: '#ffffff', rough: 0.4 },
  moon: { color: '#ffe680', emissive: '#ffd84d', ei: 0.6, rough: 0.3, metal: 0.4 },
  rocket: { color: '#ff8a1f', rough: 0.25, metal: 0.35 },
  rocketwhite: { color: '#f8f8ff', rough: 0.2, metal: 0.5 },
  flame: { color: '#ffd84d', emissive: '#ff9f1c', ei: 2.5 },
  facade_blue: { color: '#ffffff', map: 'facade:cottage_blue', rough: 0.75 },
  facade_mint: { color: '#ffffff', map: 'facade:cottage_mint', rough: 0.75 },
  facade_lilac: { color: '#ffffff', map: 'facade:cottage_lilac', rough: 0.75 },
  facade_candy: { color: '#ffffff', map: 'facade:candy', rough: 0.55 },
  facade_castle: { color: '#ffffff', map: 'facade:castle_bunny', rough: 0.7 },
  candystripe: { color: '#ffffff', map: 'stripes:ff8fbf:ffffff:10', rough: 0.35 },
  balloonstripe: { color: '#ffffff', map: 'stripes:ff9cc4:a8dcff:12', rough: 0.4 },
  signcarrot: { color: '#ffffff', map: 'sign:carrot', rough: 0.6 },
  rb1: { color: '#ff6b8b', rough: 0.45, emissive: '#ff6b8b', ei: 0.2 },
  rb2: { color: '#ffa94d', rough: 0.45, emissive: '#ffa94d', ei: 0.2 },
  rb3: { color: '#ffe66d', rough: 0.45, emissive: '#ffe66d', ei: 0.2 },
  rb4: { color: '#7ee081', rough: 0.45, emissive: '#7ee081', ei: 0.2 },
  rb5: { color: '#6cc4ff', rough: 0.45, emissive: '#6cc4ff', ei: 0.2 },
  rb6: { color: '#b48cff', rough: 0.45, emissive: '#b48cff', ei: 0.2 },
  grass: { color: '#a7e8a0', rough: 0.9 },
};

/** Sitting bunny, nose toward +z. */
function bunnyFigure(b: B, fur: string, s = 1) {
  b.sph(0.42 * s, fur, 0, 0.42 * s, -0.08 * s, { sy: 0.95 });
  b.sph(0.14 * s, fur, -0.22 * s, 0.1 * s, 0.22 * s, { sz: 1.6, sy: 0.6 });
  b.sph(0.14 * s, fur, 0.22 * s, 0.1 * s, 0.22 * s, { sz: 1.6, sy: 0.6 });
  b.sph(0.16 * s, 'bwhite', 0, 0.35 * s, -0.5 * s);
  b.sph(0.3 * s, fur, 0, 0.92 * s, 0.12 * s);
  b.sph(0.12 * s, 'bwhite', -0.1 * s, 0.84 * s, 0.36 * s);
  b.sph(0.12 * s, 'bwhite', 0.1 * s, 0.84 * s, 0.36 * s);
  b.sph(0.05 * s, 'nose', 0, 0.92 * s, 0.42 * s);
  b.sph(0.045 * s, 'eye', -0.13 * s, 1.0 * s, 0.36 * s);
  b.sph(0.045 * s, 'eye', 0.13 * s, 1.0 * s, 0.36 * s);
  b.cap(0.09 * s, 0.5 * s, fur, -0.12 * s, 1.42 * s, 0.05 * s, { rz: 0.18, sz: 0.55 });
  b.cap(0.09 * s, 0.5 * s, fur, 0.12 * s, 1.42 * s, 0.05 * s, { rz: -0.18, sz: 0.55 });
  b.cap(0.05 * s, 0.38 * s, 'earpink', -0.12 * s, 1.42 * s, 0.09 * s, { rz: 0.18, sz: 0.4 });
  b.cap(0.05 * s, 0.38 * s, 'earpink', 0.12 * s, 1.42 * s, 0.09 * s, { rz: -0.18, sz: 0.4 });
}

function teddyFigure(b: B, s = 1) {
  b.sph(0.5 * s, 'teddy', 0, 0.55 * s, 0);
  b.sph(0.3 * s, 'teddylight', 0, 0.55 * s, 0.28 * s, { sz: 0.6 });
  b.sph(0.2 * s, 'teddy', -0.32 * s, 0.16 * s, 0.35 * s, { sz: 1.4 });
  b.sph(0.2 * s, 'teddy', 0.32 * s, 0.16 * s, 0.35 * s, { sz: 1.4 });
  b.sph(0.17 * s, 'teddy', -0.48 * s, 0.68 * s, 0.15 * s);
  b.sph(0.17 * s, 'teddy', 0.48 * s, 0.68 * s, 0.15 * s);
  b.sph(0.36 * s, 'teddy', 0, 1.25 * s, 0.05 * s);
  b.sph(0.15 * s, 'teddylight', 0, 1.17 * s, 0.35 * s);
  b.sph(0.05 * s, 'eye', 0, 1.22 * s, 0.49 * s);
  b.sph(0.04 * s, 'eye', -0.13 * s, 1.35 * s, 0.33 * s);
  b.sph(0.04 * s, 'eye', 0.13 * s, 1.35 * s, 0.33 * s);
  b.sph(0.13 * s, 'teddy', -0.28 * s, 1.55 * s, 0);
  b.sph(0.13 * s, 'teddy', 0.28 * s, 1.55 * s, 0);
  b.sph(0.07 * s, 'teddylight', -0.28 * s, 1.55 * s, 0.07 * s);
  b.sph(0.07 * s, 'teddylight', 0.28 * s, 1.55 * s, 0.07 * s);
  b.tor(0.18 * s, 0.04 * s, 'nose', 0, 0.95 * s, 0.1 * s, { rx: Math.PI / 2 - 0.2 });
}

function carrotShape(b: B, h: number, r: number, x = 0, y = 0, z = 0) {
  b.cone(r, h, 'carrot', x, y + h, z, 10, { rx: Math.PI });
  for (let i = 0; i < 4; i++) b.cap(r * 0.18, h * 0.22, 'carrotleaf', x + Math.cos(i * 1.6) * r * 0.25, y + h + h * 0.15, z + Math.sin(i * 1.6) * r * 0.25, { rz: Math.cos(i * 1.6) * 0.5, rx: Math.sin(i * 1.6) * 0.5 });
  for (let i = 1; i < 4; i++) b.tor(r * (1 - i / 4) * 0.98, r * 0.03, 'orange', x, y + h * (i / 4), z, { rx: Math.PI / 2 });
}

export const BUNNY_MODELS: Record<string, (b: B) => void> = {
  moon_bunny(b) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      b.sph(0.38, 'cloud', Math.cos(a) * 0.62, 0.2, Math.sin(a) * 0.62);
    }
    b.sph(0.55, 'cloud', 0, 0.25, 0);
    b.push(0, 0.35, 0.1, 0, 0.95);
    bunnyFigure(b, 'bwhite', 1);
    b.pop();
    b.tor(0.8, 0.13, 'moon', 0, 1.3, -0.5, { arc: Math.PI * 1.25, rz: -0.4 });
    b.star(0.12, 0.05, 'moon', 0.75, 2.0, -0.4);
    b.star(0.08, 0.05, 'moon', -0.7, 1.9, -0.4);
    b.tor(0.18, 0.04, 'rb1', 0, 1.25, 0.25, { rx: Math.PI / 2 - 0.3 });
  },
  carrot_rocket(b) {
    b.cyl(0.9, 0.95, 0.12, 'rocketwhite', 0, 0, 0, 20);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.box(0.08, 0.9, 0.5, 'rocketwhite', Math.cos(a) * 0.35, 0.12, Math.sin(a) * 0.35, { ry: -a });
    }
    b.cone(0.18, 0.25, 'flame', 0, 0.12, 0, 10, { rx: Math.PI });
    b.cone(0.42, 2.6, 'rocket', 0, 0.35 + 2.6, 0, 18, { rx: Math.PI });
    for (let i = 1; i < 6; i++) b.tor(0.42 * (1 - i / 6) + 0.01, 0.025, 'orange', 0, 0.35 + 2.6 * (1 - i / 6) + 0.0, 0, { rx: Math.PI / 2 });
    b.cyl(0.43, 0.43, 0.08, 'rocketwhite', 0, 2.95, 0, 18);
    for (let i = 0; i < 5; i++) b.cap(0.08, 0.6, 'carrotleaf', Math.cos(i * 1.25) * 0.12, 3.35, Math.sin(i * 1.25) * 0.12, { rz: Math.cos(i * 1.25) * 0.45, rx: Math.sin(i * 1.25) * 0.45 });
    b.cylC(0.12, 0.05, 'lightblue', 0, 2.4, 0.3, 14, { rx: Math.PI / 2 - 0.15 });
    b.tor(0.12, 0.025, 'rocketwhite', 0, 2.4, 0.31, { rx: -0.15 });
  },
  bunny_castle(b) {
    b.box(1.4, 0.08, 1.4, 'grass', 0, 0, 0);
    b.box(1.1, 0.7, 0.9, 'facade_castle', 0, 0.08, 0, { uv: [0.45, 0.35] });
    for (const [x, z] of [
      [-0.55, -0.45],
      [0.55, -0.45],
      [-0.55, 0.45],
      [0.55, 0.45],
    ]) {
      b.cyl(0.2, 0.2, 1.1, 'plilac', x, 0.08, z, 14);
      b.cone(0.26, 0.45, 'roofpink', x, 1.18, z, 14);
      // bunny-ear pennants
      b.cap(0.04, 0.2, 'bwhite', x - 0.05, 1.72, z, { rz: 0.2, sz: 0.5 });
      b.cap(0.04, 0.2, 'bwhite', x + 0.05, 1.72, z, { rz: -0.2, sz: 0.5 });
    }
    b.cyl(0.3, 0.3, 1.5, 'ppink', 0, 0.08, -0.1, 16);
    b.cone(0.38, 0.6, 'roofblue', 0, 1.58, -0.1, 16);
    b.cap(0.07, 0.4, 'bwhite', -0.1, 2.35, -0.1, { rz: 0.2, sz: 0.5 });
    b.cap(0.07, 0.4, 'bwhite', 0.1, 2.35, -0.1, { rz: -0.2, sz: 0.5 });
    b.cap(0.035, 0.3, 'earpink', -0.1, 2.35, -0.07, { rz: 0.2, sz: 0.4 });
    b.cap(0.035, 0.3, 'earpink', 0.1, 2.35, -0.07, { rz: -0.2, sz: 0.4 });
    b.box(0.3, 0.38, 0.04, 'roofpink', 0, 0.08, 0.45);
    b.cylC(0.15, 0.04, 'roofpink', 0, 0.46, 0.45, 14, { rx: Math.PI / 2 });
    carrotShape(b, 0.3, 0.08, 0.3, 0.08, 0.62);
  },
  candy_tower(b) {
    b.cyl(0.75, 0.8, 0.15, 'ppink', 0, 0, 0, 20);
    b.cyl(0.55, 0.6, 1.3, 'facade_candy', 0, 0.15, 0, 18);
    b.cyl(0.6, 0.6, 0.1, 'rb3', 0, 1.45, 0, 18);
    b.cyl(0.42, 0.45, 1.0, 'candystripe', 0, 1.55, 0, 18);
    b.cyl(0.47, 0.47, 0.08, 'pmint', 0, 2.55, 0, 18);
    b.cyl(0.04, 0.04, 0.6, 'white', 0, 2.63, 0, 8);
    b.cylC(0.4, 0.12, 'candystripe', 0, 3.4, 0, 24, { rx: Math.PI / 2 });
    b.tor(0.4, 0.05, 'rb1', 0, 3.4, 0, { seg: 28 });
    for (let i = 0; i < 6; i++) b.sph(0.09, ['rb1', 'rb3', 'rb5', 'rb4'][i % 4], Math.cos(i) * 0.6, 1.5, Math.sin(i) * 0.6);
  },
  rainbow(b) {
    const cols = ['rb1', 'rb2', 'rb3', 'rb4', 'rb5', 'rb6'];
    cols.forEach((c, i) => b.tor(0.95 - i * 0.09, 0.05, c, 0, 0.15, 0, { arc: Math.PI, seg: 28, sz: 2.2 }));
    for (const x of [-0.85, 0.85]) {
      b.sph(0.25, 'cloud', x, 0.2, 0.0);
      b.sph(0.18, 'cloud', x - 0.18, 0.15, 0.12);
      b.sph(0.2, 'cloud', x + 0.15, 0.17, -0.1);
    }
  },
  giant_teddy(b) {
    b.cyl(0.95, 0.95, 0.06, 'ppink', 0, 0, 0, 20);
    b.push(0, 0.06, 0, 0, 1.0);
    teddyFigure(b, 1);
    b.pop();
    b.heart(0.2, 0.06, 'rb1', 0.0, 0.65, 0.56);
  },
  cottage(b) {
    const v = ['facade_blue', 'facade_mint', 'facade_lilac'];
    const roof = ['roofpink', 'roofblue', 'roofmint'];
    const i = 0;
    b.box(1.4, 0.03, 1.4, 'grass', 0, 0, 0);
    b.box(1.0, 0.6, 0.8, v[i], 0, 0.03, 0, { uv: [0.5, 0.3] });
    b.gable(1.15, 0.5, 0.95, roof[i], 0, 0.63, 0, { ry: Math.PI / 2 });
    b.box(0.12, 0.3, 0.12, 'bwhite', -0.3, 0.85, -0.2);
    b.box(0.22, 0.32, 0.02, 'roofpink', 0, 0.03, 0.41);
    b.cylC(0.11, 0.02, 'roofpink', 0, 0.35, 0.41, 12, { rx: Math.PI / 2 });
    for (let k = 0; k < 6; k++) b.sph(0.08, ['rb1', 'rb3', 'rb6'][k % 3], -0.45 + k * 0.18, 0.08, 0.55);
    b.sph(0.18, 'leaf', 0.55, 0.15, 0.5);
  },
  windmill(b) {
    b.cyl(0.6, 0.65, 0.1, 'grass', 0, 0, 0, 16);
    b.cyl(0.3, 0.5, 1.4, 'pyellow', 0, 0.1, 0, 12);
    b.cone(0.38, 0.4, 'roofpink', 0, 1.5, 0, 12);
    b.box(0.2, 0.3, 0.02, 'roofblue', 0, 0.1, 0.5);
    b.cylC(0.06, 0.2, 'white', 0, 1.45, 0.42, 8, { rx: Math.PI / 2 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      b.box(0.18, 0.9, 0.03, i % 2 ? 'ppink' : 'white', Math.cos(a) * 0.45, 1.45 + Math.sin(a) * 0.45 - 0.45, 0.52, { rz: a - Math.PI / 2 });
    }
    b.cylC(0.08, 0.06, 'roofpink', 0, 1.45, 0.55, 10, { rx: Math.PI / 2 });
  },
  carrot_house(b) {
    b.cyl(0.8, 0.85, 0.06, 'grass', 0, 0, 0, 18);
    b.cyl(0.62, 0.42, 1.6, 'carrot', 0, 0.06, 0, 16);
    for (let i = 1; i < 5; i++) b.tor(0.62 - i * 0.04, 0.025, 'orange', 0, 0.06 + i * 0.32, 0, { rx: Math.PI / 2 });
    b.dome(0.42, 'carrot', 0, 1.66, 0);
    for (let i = 0; i < 6; i++) b.cap(0.1, 0.7, 'carrotleaf', Math.cos(i) * 0.15, 2.3, Math.sin(i) * 0.15, { rz: Math.cos(i) * 0.4, rx: Math.sin(i) * 0.4 });
    b.box(0.26, 0.4, 0.04, 'darkwood', 0, 0.06, 0.6);
    b.cylC(0.13, 0.04, 'darkwood', 0, 0.46, 0.6, 12, { rx: Math.PI / 2 });
    b.cylC(0.1, 0.03, 'pyellow', -0.3, 0.95, 0.47, 12, { rx: Math.PI / 2 - 0.2, ry: -0.5 });
    b.cylC(0.1, 0.03, 'pyellow', 0.3, 1.25, 0.44, 12, { rx: Math.PI / 2 - 0.2, ry: 0.5 });
    b.plane(0.4, 0.13, 'signcarrot', 0, 0.62, 0.64);
  },
  mushroom_house(b) {
    b.cyl(0.85, 0.85, 0.05, 'grass', 0, 0, 0, 18);
    b.cyl(0.42, 0.5, 0.9, 'stem', 0, 0.05, 0, 16);
    b.sph(0.92, 'shroomred', 0, 0.85, 0, { sy: 0.65, phi: Math.PI / 2 });
    b.cyl(0.92, 0.75, 0.08, 'stem', 0, 0.8, 0, 18);
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7;
      const rr = 0.35 + (i % 3) * 0.17;
      b.sph(0.1, 'white', Math.cos(a) * rr, 0.85 + Math.sqrt(Math.max(0, 0.85 - rr * rr)) * 0.62, Math.sin(a) * rr, { sy: 0.4 });
    }
    b.box(0.22, 0.38, 0.04, 'darkwood', 0, 0.05, 0.47);
    b.cylC(0.11, 0.04, 'darkwood', 0, 0.43, 0.47, 12, { rx: Math.PI / 2 });
    b.cylC(0.08, 0.03, 'pyellow', 0.3, 0.55, 0.38, 12, { rx: Math.PI / 2, ry: 0.6 });
  },
  hot_air_balloon(b) {
    b.box(0.35, 0.25, 0.35, 'wood', 0, 0.0, 0);
    for (const [x, z] of [
      [-0.15, -0.15],
      [0.15, -0.15],
      [-0.15, 0.15],
      [0.15, 0.15],
    ])
      b.cyl(0.01, 0.01, 0.55, 'darkwood', x, 0.25, z, 4, { rx: z * 0.6, rz: -x * 0.6 });
    b.sph(0.8, 'balloonstripe', 0, 1.5, 0, { sy: 1.1, seg: 18 });
    b.cone(0.35, 0.35, 'balloonstripe', 0, 0.62, 0, 14, { rx: Math.PI });
    b.cone(0.08, 0.15, 'flame', 0, 0.55, 0, 8);
  },
  toy_train(b) {
    // engine
    b.box(0.6, 0.35, 0.7, 'rb1', 0, 0.1, 0.55);
    b.cyl(0.24, 0.24, 0.5, 'rb5', 0, 0.38, 0.65, 14, { rx: Math.PI / 2 });
    b.cyl(0.08, 0.12, 0.3, 'black', 0, 0.6, 0.8, 10);
    b.box(0.5, 0.35, 0.3, 'rb3', 0, 0.45, 0.25);
    b.box(0.56, 0.06, 0.36, 'rb1', 0, 0.8, 0.25);
    b.sph(0.06, 'lampglow', 0, 0.4, 0.92);
    // wagon
    b.box(0.58, 0.3, 0.75, 'rb4', 0, 0.12, -0.45);
    for (let i = 0; i < 3; i++) b.box(0.18, 0.18, 0.18, ['rb6', 'rb3', 'rb1'][i], -0.15 + i * 0.15, 0.42, -0.45 + (i - 1) * 0.2, { ry: i });
    for (const z of [0.8, 0.35, -0.2, -0.7]) {
      b.wheel('rb6', -0.3, 0.12, z, 0.12, 0.06, 'pyellow');
      b.wheel('rb6', 0.3, 0.12, z, 0.12, 0.06, 'pyellow');
    }
  },
  pastel_tree(b) {
    b.cyl(0.08, 0.12, 0.9, 'bbrown', 0, 0, 0, 8);
    const c = ['candyfloss1', 'candyfloss2', 'candyfloss3'];
    b.sph(0.55, c[0], 0, 1.2, 0);
    b.sph(0.42, c[1], 0.38, 1.0, 0.1);
    b.sph(0.4, c[2], -0.35, 1.05, -0.12);
    b.sph(0.36, c[0], 0.05, 1.6, 0.1);
  },
  giant_carrot(b) {
    b.push(0, 0, 0, 0, 1);
    b.cone(0.38, 1.6, 'carrot', 0, 0.15, 0, 12, { rz: Math.PI / 2 + 0.1, sx: 1 });
    b.pop();
    for (let i = 0; i < 5; i++) b.cap(0.07, 0.4, 'carrotleaf', -0.95, 0.4 + (i - 2) * 0.03, (i - 2) * 0.1, { rz: Math.PI / 2 + 0.3 * (i - 2) * 0.3 });
    b.sph(0.2, 'grass', 0.7, 0.05, 0.2, { sy: 0.3 });
  },
  big_bunny(b) {
    bunnyFigure(b, 'bbrown', 1);
  },
  rocking_horse(b) {
    b.tor(0.9, 0.04, 'pblue', 0, 0.95, 0.15, { arc: Math.PI * 0.6, rz: -Math.PI * 0.8, ry: Math.PI / 2 });
    b.tor(0.9, 0.04, 'pblue', 0, 0.95, -0.15, { arc: Math.PI * 0.6, rz: -Math.PI * 0.8, ry: Math.PI / 2 });
    for (const z of [-0.35, 0.35]) for (const x of [-0.15, 0.15]) b.cyl(0.04, 0.04, 0.4, 'bwhite', x * 0.6, 0.12, z, 6);
    b.cap(0.22, 0.6, 'bwhite', 0, 0.62, 0, { rx: Math.PI / 2 });
    b.cap(0.11, 0.35, 'bwhite', 0, 0.9, 0.42, { rx: -0.4 });
    b.cap(0.1, 0.2, 'bwhite', 0, 1.1, 0.55, { rx: 1.1 });
    b.box(0.06, 0.35, 0.3, 'roofpink', 0, 0.95, 0.3, { rx: -0.4 });
    b.box(0.36, 0.06, 0.3, 'rb1', 0, 0.82, -0.02);
    b.cap(0.05, 0.3, 'roofpink', 0, 0.6, -0.55, { rx: 0.6 });
  },
  balloon(b) {
    const cols = ['rb1', 'rb3', 'rb5', 'rb6', 'rb4'];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = Math.cos(a) * 0.32;
      const z = Math.sin(a) * 0.32;
      const y = 1.6 + (i % 2) * 0.25;
      b.sph(0.32, cols[i], x, y, z, { sy: 1.15 });
      b.cone(0.05, 0.08, cols[i], x, y - 0.42, z, 6, { rx: Math.PI });
      b.cyl(0.006, 0.006, y - 0.35, 'white', x * 0.5, 0.2, z * 0.5, 3, { rx: z * 0.2, rz: -x * 0.2 });
    }
    b.box(0.3, 0.2, 0.3, 'pyellow', 0, 0, 0);
  },
  teddy(b) {
    teddyFigure(b, 1);
  },
  bunny(b) {
    bunnyFigure(b, 'bwhite', 1.05);
  },
  toadstool(b) {
    b.cyl(0.18, 0.25, 0.7, 'stem', 0, 0, 0, 10);
    b.sph(0.75, 'shroomlilac', 0, 0.62, 0, { sy: 0.6, phi: Math.PI / 2 });
    for (let i = 0; i < 6; i++) b.sph(0.08, 'white', Math.cos(i) * 0.45, 0.82, Math.sin(i) * 0.45, { sy: 0.4 });
  },
  blocks(b) {
    const c = ['rb1', 'rb5', 'rb3', 'rb4'];
    b.box(0.7, 0.7, 0.7, c[0], -0.38, 0, 0.1, { ry: 0.2 });
    b.box(0.7, 0.7, 0.7, c[1], 0.38, 0, -0.1, { ry: -0.15 });
    b.box(0.7, 0.7, 0.7, c[2], 0, 0.7, 0, { ry: 0.5 });
    b.star(0.18, 0.05, 'white', -0.38, 0.38, 0.47, { ry: 0.2 });
    b.heart(0.17, 0.05, 'white', 0.38, 0.38, 0.27, { ry: -0.15 });
  },
  lollipop(b) {
    b.cyl(0.05, 0.05, 1.2, 'white', 0, 0, 0, 6);
    b.cylC(0.5, 0.18, 'candystripe', 0, 1.6, 0, 20, { rx: Math.PI / 2 });
    b.tor(0.5, 0.06, 'rb1', 0, 1.6, 0, { seg: 24 });
    b.tor(0.06, 0.03, 'rb5', 0, 1.15, 0, { rx: Math.PI / 2 });
  },
  tulip(b) {
    b.cyl(0.04, 0.05, 1.0, 'carrotleaf', 0, 0, 0, 6);
    b.sph(0.35, 'carrotleaf', 0.2, 0.3, 0, { sx: 0.25, sy: 1.1, rz: -0.4 });
    b.sph(0.32, 'ppink', 0, 1.25, 0, { sy: 1.2 });
    for (let i = 0; i < 3; i++) b.cone(0.13, 0.25, 'roofpink', Math.cos(i * 2.1) * 0.18, 1.42, Math.sin(i * 2.1) * 0.18, 6);
  },
  mushroom(b) {
    b.cyl(0.25, 0.32, 0.6, 'stem', 0, 0, 0, 10);
    b.sph(0.85, 'shroomred', 0, 0.5, 0, { sy: 0.65, phi: Math.PI / 2 });
    for (let i = 0; i < 6; i++) b.sph(0.12, 'white', Math.cos(i) * 0.48, 0.78, Math.sin(i) * 0.48, { sy: 0.4 });
  },
  rubber_duck(b) {
    b.sph(0.65, 'duck', 0, 0.55, -0.1, { sz: 1.25, sy: 0.85 });
    b.sph(0.42, 'duck', 0, 1.2, 0.3);
    b.sph(0.2, 'orange', 0, 1.12, 0.72, { sy: 0.45, sz: 1.3 });
    b.sph(0.07, 'eye', -0.2, 1.32, 0.62);
    b.sph(0.07, 'eye', 0.2, 1.32, 0.62);
    b.sph(0.25, 'duck', -0.55, 0.65, -0.1, { sx: 0.4, sz: 1.2 });
    b.sph(0.25, 'duck', 0.55, 0.65, -0.1, { sx: 0.4, sz: 1.2 });
    b.cone(0.2, 0.3, 'duck', 0, 0.75, -0.9, 8, { rx: -2 });
  },
  baby_bottle(b) {
    b.cyl(0.45, 0.45, 1.2, 'bottle', 0, 0, 0, 14);
    b.cyl(0.4, 0.4, 0.8, 'milk', 0, 0.05, 0, 14);
    b.cyl(0.48, 0.48, 0.22, 'pblue', 0, 1.2, 0, 14);
    b.dome(0.3, 'nose', 0, 1.42, 0);
    b.cap(0.12, 0.2, 'nose', 0, 1.8, 0);
    for (let i = 0; i < 3; i++) b.box(0.15, 0.02, 0.02, 'pblue', 0.4, 0.3 + i * 0.25, 0.22);
  },
  carrot(b) {
    b.cone(0.38, 1.6, 'carrot', 0.1, 0.4, 0, 10, { rz: Math.PI / 2 + 0.15 });
    for (let i = 0; i < 4; i++) b.cap(0.08, 0.45, 'carrotleaf', -0.9, 0.5, (i - 1.5) * 0.12, { rz: Math.PI / 2 + 0.6 + (i - 1.5) * 0.15 });
  },
  daisy(b) {
    b.cyl(0.04, 0.05, 1.0, 'carrotleaf', 0, 0, 0, 6);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      b.sph(0.18, 'white', Math.cos(a) * 0.3, 1.05, Math.sin(a) * 0.3, { sx: 1.8, sy: 0.3, ry: -a });
    }
    b.sph(0.18, 'rb3', 0, 1.08, 0, { sy: 0.6 });
    b.sph(0.3, 'carrotleaf', 0.2, 0.3, 0, { sx: 0.6, sy: 0.15 });
  },
  pastel_egg(b) {
    b.sph(0.62, 'ppink', 0, 0.85, 0, { sy: 1.3, seg: 16 });
    b.tor(0.6, 0.07, 'pblue', 0, 0.85, 0, { rx: Math.PI / 2 });
    b.tor(0.52, 0.06, 'pyellow', 0, 1.25, 0, { rx: Math.PI / 2 });
    b.tor(0.52, 0.06, 'pmint', 0, 0.45, 0, { rx: Math.PI / 2 });
  },
};
