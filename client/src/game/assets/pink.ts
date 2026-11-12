/** Pink Dream World — every model drawn in code (unit footprint radius 1, base y = 0). */
import type { B, MatSpec } from './kit';

export const PINK_MATS: Record<string, MatSpec> = {
  pink1: { color: '#ff4fb8', rough: 0.35 },
  pink2: { color: '#ff8fd0', rough: 0.45 },
  pink3: { color: '#ffd1ea', rough: 0.6 },
  magenta: { color: '#d6007a', rough: 0.35 },
  lilac: { color: '#c9a7ff', rough: 0.45 },
  mint: { color: '#9df2d8', rough: 0.5 },
  peach: { color: '#ffcfb0', rough: 0.55 },
  paintpink: { color: '#ff5ec4', rough: 0.18, metal: 0.55 },
  paintwhite: { color: '#fff5fb', rough: 0.18, metal: 0.4 },
  paintlilac: { color: '#c39bff', rough: 0.18, metal: 0.55 },
  paintmint: { color: '#7ef2d0', rough: 0.18, metal: 0.5 },
  paintgold: { color: '#ffd36b', rough: 0.2, metal: 0.8 },
  pearl: { color: '#fff0f8', rough: 0.25, metal: 0.25 },
  blonde: { color: '#ffe08a', rough: 0.5 },
  brunette: { color: '#6b3f2a', rough: 0.55 },
  fur: { color: '#fff3fa', rough: 0.95 },
  furpink: { color: '#ffb6dc', rough: 0.95 },
  frosting: { color: '#ff9fd2', rough: 0.6 },
  cream: { color: '#fff7e8', rough: 0.6 },
  cake: { color: '#e9b77a', rough: 0.8 },
  pool: { color: '#5fd7ff', rough: 0.05, metal: 0.2, opacity: 0.85 },
  lawn: { color: '#8fe39a', rough: 0.9 },
  palmleaf: { color: '#3ccf7a', rough: 0.6, side: 'double' },
  palmtrunk: { color: '#c79a63', rough: 0.9 },
  facade_house: { color: '#ffffff', map: 'facade:pinkhouse', rough: 0.7 },
  facade_mansion: { color: '#ffffff', map: 'facade:pinkmansion', rough: 0.65 },
  facade_fashion: { color: '#ffffff', map: 'facade:fashion', rough: 0.25, metal: 0.3 },
  facade_boutique: { color: '#ffffff', map: 'facade:boutique', rough: 0.5 },
  awning: { color: '#ffffff', map: 'stripes:ff4fb8:ffffff:8', rough: 0.7, side: 'double' },
  awningmint: { color: '#ffffff', map: 'stripes:7ef2d0:ffffff:8', rough: 0.7, side: 'double' },
  signboutique: { color: '#ffffff', map: 'sign:boutique', rough: 0.5 },
  signdream: { color: '#ffffff', map: 'sign:dream', emap: 'sign:dream:e', ei: 1.5, rough: 0.4 },
  signice: { color: '#ffffff', map: 'sign:icecream', rough: 0.5 },
  glitter: { color: '#ffd6f0', rough: 0.15, metal: 0.9, emissive: '#ff4fb8', ei: 0.25 },
  heartglow: { color: '#ff7ac8', emissive: '#ff3fa4', ei: 2.2, rough: 0.3 },
  lipred: { color: '#e0115f', rough: 0.3 },
  perfumeglass: { color: '#ffb3e0', rough: 0.05, metal: 0.3, opacity: 0.6 },
  hydrant: { color: '#ff4fb8', rough: 0.3, metal: 0.4 },
  bag: { color: '#ff3fa4', rough: 0.35, metal: 0.1 },
  bagwhite: { color: '#fff0f7', rough: 0.4 },
  flamingo: { color: '#ff8fb8', rough: 0.55 },
};

export const PINK_MODELS: Record<string, (b: B) => void> = {
  dream_castle(b) {
    b.box(1.6, 0.12, 1.6, 'pearl', 0, 0, 0);
    b.box(1.1, 0.8, 0.9, 'pink3', 0, 0.12, 0);
    // crenellations
    for (let i = -4; i <= 4; i++) b.box(0.08, 0.1, 0.08, 'pink2', i * 0.13, 0.92, 0.42);
    // corner towers
    for (const [x, z] of [
      [-0.62, -0.5],
      [0.62, -0.5],
      [-0.62, 0.5],
      [0.62, 0.5],
    ]) {
      b.cyl(0.2, 0.22, 1.25, 'pink2', x, 0.12, z, 16);
      b.tor(0.2, 0.03, 'gold', x, 1.37, z, { rx: Math.PI / 2 });
      b.cone(0.27, 0.6, 'pink1', x, 1.37, z, 16);
      b.sph(0.05, 'gold', x, 2.0, z);
    }
    // keep + spire
    b.cyl(0.3, 0.34, 1.8, 'pink3', 0, 0.12, -0.1, 18);
    b.cone(0.4, 0.8, 'magenta', 0, 1.92, -0.1, 18);
    b.cyl(0.015, 0.015, 0.3, 'gold', 0, 2.7, -0.1, 6);
    b.box(0.22, 0.13, 0.01, 'pink1', 0.11, 2.86, -0.1);
    // gate + heart crest
    b.box(0.34, 0.45, 0.06, 'magenta', 0, 0.12, 0.45);
    b.cyl(0.17, 0.17, 0.06, 'magenta', 0, 0.57, 0.45, 16, { rx: Math.PI / 2 });
    b.heart(0.18, 0.06, 'glitter', 0, 0.82, 0.48);
    b.heart(0.12, 0.05, 'heartglow', 0, 1.35, 0.22);
    // windows
    for (const x of [-0.35, 0.35]) b.box(0.12, 0.2, 0.02, 'glass', x, 0.45, 0.455);
  },
  ferris_wheel(b) {
    b.box(1.5, 0.08, 0.7, 'pearl', 0, 0, 0);
    for (const z of [-0.2, 0.2]) {
      b.box(0.06, 1.15, 0.06, 'pink2', -0.3, 0.04, z, { rz: -0.28 });
      b.box(0.06, 1.15, 0.06, 'pink2', 0.3, 0.04, z, { rz: 0.28 });
    }
    b.cylC(0.08, 0.5, 'gold', 0, 1.15, 0, 12, { rx: Math.PI / 2 });
    b.tor(0.9, 0.03, 'glitter', 0, 1.15, -0.12, { seg: 40 });
    b.tor(0.9, 0.03, 'glitter', 0, 1.15, 0.12, { seg: 40 });
    b.tor(0.55, 0.02, 'pink1', 0, 1.15, 0, { seg: 32 });
    const gc = ['pink1', 'lilac', 'mint', 'paintgold', 'pink2', 'white'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.box(0.02, 0.9, 0.02, 'pink3', Math.cos(a) * 0.45, 1.15 - 0.45, 0, { rz: a - Math.PI / 2 + Math.PI / 2 });
      const gx = Math.cos(a) * 0.9;
      const gy = 1.15 + Math.sin(a) * 0.9;
      b.cyl(0.09, 0.09, 0.12, gc[i % gc.length], gx, gy - 0.16, 0, 10);
      b.dome(0.09, 'white', gx, gy - 0.04, 0);
      b.sph(0.03, 'heartglow', gx, gy, 0.0);
    }
    b.heart(0.12, 0.05, 'heartglow', 0, 1.15, 0.2);
  },
  mansion(b) {
    b.box(1.9, 0.04, 1.9, 'lawn', 0, 0, 0);
    b.box(1.35, 0.75, 0.75, 'facade_mansion', 0, 0.04, -0.35, { uv: [0.45, 0.4] });
    b.box(1.42, 0.06, 0.82, 'pink3', 0, 0.79, -0.35);
    b.cone(1.0, 0.4, 'pink1', 0, 0.85, -0.35, 4, { ry: Math.PI / 4, sz: 0.58 });
    // wings
    b.box(0.4, 0.55, 0.5, 'facade_mansion', -0.75, 0.04, -0.15, { uv: [0.45, 0.4] });
    b.box(0.4, 0.55, 0.5, 'facade_mansion', 0.75, 0.04, -0.15, { uv: [0.45, 0.4] });
    b.gable(0.44, 0.22, 0.54, 'pink1', -0.75, 0.59, -0.15, { ry: Math.PI / 2 });
    b.gable(0.44, 0.22, 0.54, 'pink1', 0.75, 0.59, -0.15, { ry: Math.PI / 2 });
    // portico
    for (const x of [-0.24, -0.08, 0.08, 0.24]) b.cyl(0.035, 0.035, 0.55, 'white', x, 0.04, 0.1, 10);
    b.box(0.62, 0.06, 0.2, 'white', 0, 0.59, 0.08);
    b.gable(0.62, 0.15, 0.2, 'pink2', 0, 0.65, 0.08);
    b.box(0.2, 0.32, 0.02, 'magenta', 0, 0.04, 0.03);
    // pool + palms
    b.box(0.9, 0.05, 0.42, 'white', 0, 0.02, 0.6);
    b.box(0.8, 0.05, 0.33, 'pool', 0, 0.04, 0.6);
    b.heart(0.08, 0.03, 'pink1', 0.3, 0.12, 0.6, { rx: -Math.PI / 2 });
    b.cyl(0.03, 0.04, 0.5, 'palmtrunk', -0.75, 0.04, 0.6, 6);
    for (let i = 0; i < 5; i++) b.sph(0.18, 'palmleaf', -0.75 + Math.cos(i * 1.25) * 0.12, 0.55, 0.6 + Math.sin(i * 1.25) * 0.12, { sy: 0.18, ry: i * 1.25 });
  },
  fashion_tower(b) {
    b.box(1.2, 0.2, 1.2, 'pink3', 0, 0, 0);
    b.box(0.95, 3.0, 0.95, 'facade_fashion', 0, 0.2, 0, { uv: [0.48, 0.5] });
    b.box(1.02, 0.08, 1.02, 'white', 0, 1.2, 0);
    b.box(1.02, 0.08, 1.02, 'white', 0, 2.2, 0);
    b.box(0.85, 0.35, 0.85, 'glass', 0, 3.2, 0);
    b.box(0.95, 0.05, 0.95, 'gold', 0, 3.55, 0);
    b.plane(0.85, 0.27, 'signdream', 0, 0.62, 0.485);
    b.heart(0.25, 0.08, 'heartglow', 0, 3.9, 0);
    b.box(0.5, 0.06, 0.25, 'pink1', 0, 0.5, 0.6);
  },
  dream_house(b) {
    b.box(1.5, 0.03, 1.5, 'lawn', 0, 0, 0);
    b.box(1.0, 0.62, 0.8, 'facade_house', 0, 0.03, -0.1, { uv: [0.34, 0.3] });
    b.gable(1.12, 0.42, 0.9, 'pink1', 0, 0.65, -0.1, { ry: Math.PI / 2 });
    b.box(0.1, 0.28, 0.1, 'pink3', 0.3, 0.8, -0.3);
    b.box(0.2, 0.3, 0.02, 'magenta', 0, 0.03, 0.31);
    b.sph(0.02, 'gold', 0.06, 0.18, 0.33);
    b.box(0.32, 0.04, 0.12, 'pink2', 0, 0.36, 0.36);
    // picket fence
    for (let i = -6; i <= 6; i++) if (Math.abs(i) > 1) b.box(0.04, 0.16, 0.02, 'white', i * 0.1, 0.03, 0.62);
    b.box(1.3, 0.025, 0.02, 'white', 0, 0.14, 0.62);
    b.cyl(0.02, 0.02, 0.22, 'white', 0.55, 0.03, 0.5, 6);
    b.box(0.1, 0.08, 0.14, 'pink1', 0.55, 0.25, 0.5);
  },
  boutique(b) {
    b.box(1.3, 0.62, 0.9, 'facade_boutique', 0, 0, -0.1, { uv: [0.65, 0.31] });
    b.box(1.36, 0.08, 0.96, 'pink1', 0, 0.62, -0.1);
    b.box(1.0, 0.18, 0.04, 'white', 0, 0.7, 0.34);
    b.plane(0.96, 0.16, 'signboutique', 0, 0.79, 0.365);
    b.box(1.2, 0.02, 0.3, 'awning', 0, 0.5, 0.48, { rx: 0.35 });
    // mannequins
    for (const x of [-0.42, 0.42]) {
      b.cyl(0.05, 0.12, 0.25, 'pinkhot', x, 0.0, 0.55, 10);
      b.cyl(0.04, 0.05, 0.12, 'pearl', x, 0.25, 0.55, 8);
      b.sph(0.05, 'pearl', x, 0.42, 0.55);
    }
    b.box(0.18, 0.06, 0.12, 'bag', 0, 0, 0.6);
  },
  carousel(b) {
    b.cyl(0.95, 0.95, 0.12, 'pearl', 0, 0, 0, 24);
    b.cyl(0.08, 0.08, 1.0, 'gold', 0, 0.12, 0, 10);
    b.cone(1.0, 0.45, 'pink1', 0, 1.0, 0, 16);
    b.cyl(1.0, 1.0, 0.1, 'white', 0, 0.92, 0, 16);
    b.sph(0.08, 'gold', 0, 1.5, 0);
    const cols = ['white', 'lilac', 'mint', 'pink2', 'paintgold', 'pink3'];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * 0.68;
      const z = Math.sin(a) * 0.68;
      b.cyl(0.015, 0.015, 0.8, 'gold', x, 0.12, z, 6);
      b.push(x, 0.38 + (i % 2) * 0.1, z, -a);
      b.cap(0.08, 0.2, cols[i], 0, 0, 0, { rx: Math.PI / 2 });
      b.cap(0.04, 0.1, cols[i], 0, 0.1, 0.13, { rx: -0.6 });
      b.box(0.04, 0.03, 0.1, 'pink1', 0, 0.16, 0.2);
      for (const lx of [-0.04, 0.04]) for (const lz of [-0.1, 0.1]) b.cyl(0.015, 0.015, 0.14, cols[i], lx, -0.18, lz, 5);
      b.pop();
    }
  },
  fountain(b) {
    b.cyl(0.98, 1.0, 0.22, 'pearl', 0, 0, 0, 24);
    b.cyl(0.88, 0.88, 0.05, 'pool', 0, 0.17, 0, 24);
    b.cyl(0.12, 0.18, 0.5, 'pearl', 0, 0.2, 0, 12);
    b.cyl(0.42, 0.32, 0.08, 'pearl', 0, 0.7, 0, 18);
    b.cyl(0.38, 0.38, 0.03, 'pool', 0, 0.76, 0, 18);
    b.heart(0.22, 0.08, 'pink1', 0, 1.02, 0);
    b.sph(0.1, 'water', 0, 1.3, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.cap(0.025, 0.35, 'water', Math.cos(a) * 0.32, 0.6, Math.sin(a) * 0.32, { rx: Math.sin(a) * 0.6, rz: -Math.cos(a) * 0.6 });
    }
  },
  limo(b) {
    b.box(0.48, 0.2, 1.92, 'paintpink', 0, 0.1, 0);
    b.box(0.44, 0.14, 1.1, 'paintpink', 0, 0.3, -0.05);
    b.box(0.45, 0.1, 1.06, 'darkglass', 0, 0.32, -0.05);
    b.box(0.5, 0.03, 1.94, 'chrome', 0, 0.16, 0);
    b.box(0.3, 0.06, 0.02, 'chrome', 0, 0.18, 0.96);
    for (const x of [-0.16, 0.16]) b.box(0.08, 0.04, 0.02, 'lampglow', x, 0.22, 0.965);
    for (const z of [0.68, 0.25, -0.62]) {
      b.wheel('tire', -0.24, 0.1, z, 0.1, 0.07);
      b.wheel('tire', 0.24, 0.1, z, 0.1, 0.07);
    }
    b.heart(0.05, 0.02, 'gold', 0, 0.28, 0.95);
  },
  convertible(b) {
    b.box(0.84, 0.28, 1.84, 'paintpink', 0, 0.14, 0);
    b.box(0.86, 0.05, 1.86, 'chrome', 0, 0.2, 0);
    b.box(0.74, 0.05, 0.8, 'white', 0, 0.42, -0.2);
    b.box(0.3, 0.22, 0.1, 'white', -0.18, 0.42, -0.4);
    b.box(0.3, 0.22, 0.1, 'white', 0.18, 0.42, -0.4);
    b.box(0.7, 0.25, 0.03, 'glass', 0, 0.42, 0.23, { rx: -0.45 });
    b.box(0.8, 0.12, 0.5, 'paintpink', 0, 0.42, 0.6);
    b.box(0.8, 0.1, 0.4, 'paintpink', 0, 0.42, -0.75);
    for (const x of [-0.28, 0.28]) {
      b.box(0.18, 0.07, 0.02, 'lampglow', x, 0.34, 0.925);
      b.box(0.16, 0.06, 0.02, 'redlight', x, 0.34, -0.925);
    }
    b.cylC(0.08, 0.02, 'black', -0.18, 0.55, 0.12, 12, { rx: 1.1 });
    b.wheel('tire', -0.4, 0.15, 0.58, 0.15, 0.1);
    b.wheel('tire', 0.4, 0.15, 0.58, 0.15, 0.1);
    b.wheel('tire', -0.4, 0.15, -0.58, 0.15, 0.1);
    b.wheel('tire', 0.4, 0.15, -0.58, 0.15, 0.1);
  },
  palm(b) {
    let x = 0;
    for (let i = 0; i < 6; i++) {
      b.cyl(0.07 - i * 0.004, 0.08 - i * 0.004, 0.3, 'palmtrunk', x, i * 0.28, 0, 8, { rz: -0.08 });
      x += 0.03;
    }
    const top = 1.7;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.sph(0.45, 'palmleaf', x + Math.cos(a) * 0.4, top - 0.08, Math.sin(a) * 0.4, { sx: 1, sy: 0.08, sz: 0.28, ry: -a, rz: -0.35 });
    }
    for (let i = 0; i < 3; i++) b.sph(0.06, 'darkwood', x + Math.cos(i * 2) * 0.08, top - 0.12, Math.sin(i * 2) * 0.08);
  },
  ice_cream_cart(b) {
    b.box(1.1, 0.45, 0.6, 'pearl', 0, 0.18, 0);
    b.box(1.14, 0.06, 0.64, 'pink1', 0, 0.63, 0);
    b.plane(0.9, 0.2, 'signice', 0, 0.42, 0.305);
    b.wheel('tire', -0.4, 0.15, 0.3, 0.15, 0.06, 'pink1');
    b.wheel('tire', 0.4, 0.15, 0.3, 0.15, 0.06, 'pink1');
    b.wheel('tire', -0.4, 0.15, -0.3, 0.15, 0.06, 'pink1');
    b.wheel('tire', 0.4, 0.15, -0.3, 0.15, 0.06, 'pink1');
    b.cyl(0.02, 0.02, 0.8, 'white', 0.4, 0.69, 0, 6);
    b.cone(0.6, 0.25, 'awning', 0.4, 1.4, 0, 12);
    b.cone(0.14, 0.4, 'cake', -0.25, 0.69, 0, 12, { rx: Math.PI });
    b.sph(0.15, 'frosting', -0.25, 1.15, 0);
    b.sph(0.12, 'mint', -0.25, 1.32, 0);
  },
  heart_bench(b) {
    b.box(1.4, 0.06, 0.4, 'pearl', 0, 0.35, 0);
    for (const x of [-0.6, 0.6]) b.box(0.06, 0.35, 0.36, 'gold', x, 0, 0);
    b.heart(0.32, 0.06, 'pink1', -0.34, 0.68, -0.18);
    b.heart(0.32, 0.06, 'pink1', 0.34, 0.68, -0.18);
  },
  vespa(b) {
    b.box(0.3, 0.12, 1.2, 'paintmint', 0, 0.2, 0);
    b.cap(0.18, 0.45, 'paintmint', 0, 0.42, -0.3, { rx: Math.PI / 2 });
    b.box(0.26, 0.08, 0.45, 'white', 0, 0.58, -0.28);
    b.box(0.32, 0.55, 0.14, 'paintmint', 0, 0.2, 0.5, { rx: -0.25 });
    b.cyl(0.02, 0.02, 0.4, 'chrome', 0, 0.75, 0.55, 6);
    b.box(0.6, 0.03, 0.03, 'chrome', 0, 1.12, 0.55);
    b.sph(0.07, 'lampglow', 0, 0.98, 0.64);
    b.wheel('tire', 0, 0.16, 0.55, 0.16, 0.08);
    b.wheel('tire', 0, 0.16, -0.5, 0.16, 0.08);
  },
  doll_npc(b) {
    b.cone(0.38, 0.75, 'pinkhot', 0, 0.45, 0, 16, { rx: Math.PI });
    b.cyl(0.05, 0.05, 0.5, 'skin1', -0.1, 0, 0, 6);
    b.cyl(0.05, 0.05, 0.5, 'skin1', 0.1, 0, 0, 6);
    b.box(0.12, 0.08, 0.2, 'pink1', -0.1, 0, 0.04);
    b.box(0.12, 0.08, 0.2, 'pink1', 0.1, 0, 0.04);
    b.cap(0.16, 0.3, 'pinkhot', 0, 1.12, 0, { sz: 0.7 });
    b.cap(0.045, 0.45, 'skin1', -0.22, 1.08, 0, { rz: 0.2 });
    b.cap(0.045, 0.45, 'skin1', 0.22, 1.08, 0, { rz: -0.2 });
    b.cyl(0.05, 0.05, 0.12, 'skin1', 0, 1.36, 0, 8);
    b.sph(0.17, 'skin1', 0, 1.58, 0);
    b.sph(0.19, 'blonde', 0, 1.63, -0.04, { phi: Math.PI * 0.6 });
    b.cap(0.12, 0.5, 'blonde', 0, 1.28, -0.12, { sz: 0.5 });
    b.box(0.2, 0.06, 0.06, 'black', 0, 1.6, 0.15);
    b.box(0.16, 0.14, 0.06, 'bag', 0.32, 0.72, 0.05);
  },
  flamingo(b) {
    b.cyl(0.015, 0.015, 0.7, 'flamingo', -0.05, 0, 0, 5);
    b.cyl(0.015, 0.015, 0.45, 'flamingo', 0.05, 0.25, 0, 5, { rz: 0.5 });
    b.sph(0.3, 'flamingo', 0, 0.85, 0, { sx: 0.8, sy: 0.65, sz: 1.2 });
    b.cap(0.05, 0.4, 'flamingo', 0, 1.15, 0.25, { rx: 0.4 });
    b.cap(0.05, 0.25, 'flamingo', 0, 1.45, 0.3, { rx: -0.5 });
    b.sph(0.09, 'flamingo', 0, 1.58, 0.36);
    b.cone(0.04, 0.16, 'black', 0, 1.5, 0.46, 6, { rx: 2.2 });
    b.sph(0.02, 'black', 0.07, 1.61, 0.4);
    b.sph(0.02, 'black', -0.07, 1.61, 0.4);
  },
  poodle(b) {
    for (const [x, z] of [
      [-0.15, 0.25],
      [0.15, 0.25],
      [-0.15, -0.25],
      [0.15, -0.25],
    ]) {
      b.cyl(0.05, 0.05, 0.35, 'fur', x, 0, z, 6);
      b.sph(0.1, 'furpink', x, 0.06, z);
    }
    b.sph(0.28, 'fur', 0, 0.55, -0.1, { sz: 1.1 });
    b.sph(0.32, 'furpink', 0, 0.65, 0.22);
    b.sph(0.2, 'fur', 0, 0.95, 0.42);
    b.sph(0.13, 'furpink', 0, 1.15, 0.4);
    b.cap(0.07, 0.12, 'fur', 0, 0.85, 0.6, { rx: Math.PI / 2 });
    b.sph(0.04, 'black', 0, 0.86, 0.72);
    b.sph(0.12, 'furpink', -0.2, 0.9, 0.42, { sy: 1.4 });
    b.sph(0.12, 'furpink', 0.2, 0.9, 0.42, { sy: 1.4 });
    b.sph(0.12, 'furpink', 0, 0.8, -0.5);
    b.tor(0.15, 0.03, 'pinkhot', 0, 0.78, 0.4, { rx: Math.PI / 2 - 0.3 });
  },
  gift_box(b) {
    b.box(1.2, 0.9, 1.2, 'pink1', 0, 0, 0);
    b.box(1.26, 0.18, 1.26, 'pink2', 0, 0.9, 0);
    b.box(0.2, 1.1, 1.27, 'gold', 0, 0, 0);
    b.box(1.27, 1.1, 0.2, 'gold', 0, 0, 0);
    b.tor(0.22, 0.07, 'gold', -0.2, 1.25, 0, { ry: Math.PI / 2, rz: 0.5 });
    b.tor(0.22, 0.07, 'gold', 0.2, 1.25, 0, { ry: Math.PI / 2, rz: -0.5 });
    b.sph(0.1, 'gold', 0, 1.15, 0);
  },
  heart_lamp(b) {
    b.cyl(0.15, 0.2, 0.15, 'magenta', 0, 0, 0, 10);
    b.cyl(0.05, 0.06, 2.0, 'magenta', 0, 0.15, 0, 8);
    b.tor(0.25, 0.03, 'gold', 0.2, 2.1, 0, { arc: Math.PI, ry: Math.PI / 2 });
    b.heart(0.25, 0.12, 'heartglow', 0, 2.42, 0);
  },
  flower_pot(b) {
    b.cyl(0.55, 0.4, 0.6, 'pearl', 0, 0, 0, 14);
    b.cyl(0.58, 0.58, 0.08, 'pink1', 0, 0.55, 0, 14);
    b.sph(0.5, 'leaf', 0, 0.7, 0, { sy: 0.5 });
    const fc = ['pinkhot', 'white', 'lilac', 'pink2', 'yellow'];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      b.sph(0.14, fc[i % fc.length], Math.cos(a) * 0.32 * ((i % 3) / 2 + 0.3), 0.92 + (i % 2) * 0.06, Math.sin(a) * 0.32 * ((i % 3) / 2 + 0.3));
    }
  },
  hydrant(b) {
    b.cyl(0.4, 0.45, 0.15, 'hydrant', 0, 0, 0, 12);
    b.cyl(0.3, 0.32, 0.9, 'hydrant', 0, 0.15, 0, 12);
    b.dome(0.32, 'hydrant', 0, 1.05, 0);
    b.cyl(0.08, 0.08, 0.15, 'gold', 0, 1.35, 0, 8);
    b.cylC(0.12, 0.8, 'hydrant', 0, 0.75, 0, 10, { rz: Math.PI / 2 });
    b.cylC(0.15, 0.1, 'gold', 0, 0.75, 0.33, 10, { rx: Math.PI / 2 });
    b.heart(0.12, 0.04, 'white', 0, 0.5, 0.32);
  },
  handbag(b) {
    b.box(1.4, 0.9, 0.6, 'bag', 0, 0, 0);
    b.box(1.44, 0.12, 0.64, 'bagwhite', 0, 0.85, 0);
    b.tor(0.45, 0.06, 'gold', 0, 0.97, 0, { arc: Math.PI });
    b.box(0.25, 0.18, 0.04, 'gold', 0, 0.6, 0.31);
    b.heart(0.12, 0.03, 'glitter', 0, 0.35, 0.31);
  },
  cupcake(b) {
    b.cyl(0.7, 0.5, 0.75, 'cake', 0, 0, 0, 14);
    b.cyl(0.72, 0.72, 0.1, 'pink1', 0, 0.7, 0, 14);
    b.sph(0.7, 'frosting', 0, 0.8, 0, { sy: 0.55 });
    b.sph(0.48, 'frosting', 0, 1.1, 0, { sy: 0.6 });
    b.sph(0.24, 'frosting', 0, 1.35, 0, { sy: 0.7 });
    b.sph(0.16, 'red', 0, 1.58, 0);
    for (let i = 0; i < 10; i++) b.box(0.06, 0.03, 0.12, i % 2 ? 'mint' : 'yellow', Math.cos(i) * 0.4, 1.05 + (i % 3) * 0.08, Math.sin(i) * 0.4, { ry: i });
  },
  high_heel(b) {
    b.box(0.5, 0.08, 1.6, 'pinkhot', 0, 0, 0.1, { rx: 0 });
    b.box(0.5, 0.5, 0.6, 'pinkhot', 0, 0.08, 0.55);
    b.box(0.48, 0.07, 1.1, 'pinkhot', 0, 0.5, -0.15, { rx: -0.55 });
    b.cyl(0.05, 0.1, 0.95, 'gold', 0, 0, -0.75, 8);
    b.box(0.55, 0.3, 0.45, 'pinkhot', 0, 0.75, -0.55, { rx: -0.2 });
    b.box(0.6, 0.12, 0.12, 'gold', 0, 0.55, 0.85);
  },
  perfume(b) {
    b.box(1.1, 1.0, 0.7, 'perfumeglass', 0, 0, 0);
    b.box(0.9, 0.65, 0.5, 'pink1', 0, 0.08, 0);
    b.cyl(0.18, 0.18, 0.2, 'gold', 0, 1.0, 0, 10);
    b.heart(0.4, 0.3, 'perfumeglass', 0, 1.55, 0);
    b.box(0.5, 0.2, 0.02, 'gold', 0, 0.4, 0.36);
  },
  lipstick(b) {
    b.cyl(0.42, 0.42, 0.85, 'gold', 0, 0, 0, 14);
    b.cyl(0.38, 0.38, 0.45, 'paintpink', 0, 0.85, 0, 14);
    b.cyl(0.3, 0.3, 0.5, 'lipred', 0, 1.3, 0, 14);
    b.cone(0.3, 0.35, 'lipred', 0, 1.8, 0, 14, { rz: 0.3 });
  },
  heart_candy(b) {
    b.heart(0.85, 0.55, 'pink2', 0, 0.75, 0, { rx: -0.25 });
    b.box(0.6, 0.12, 0.05, 'white', 0, 0.75, 0.38);
  },
};
