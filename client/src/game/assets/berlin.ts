/** Berlin Meme City — models drawn in code (unit footprint radius 1, base y = 0).
 * All characters, signs and brands are original/generic (no real logos). */
import type { B, MatSpec } from './kit';

export const BERLIN_MATS: Record<string, MatSpec> = {
  sandstone: { color: '#d8c39a', rough: 0.85 },
  sandstone2: { color: '#c4ab7d', rough: 0.85 },
  patina: { color: '#5fa38a', rough: 0.45, metal: 0.5 },
  facade_altbau: { color: '#ffffff', map: 'facade:altbau', emap: 'facade:altbau:e', ei: 0.7, rough: 0.8 },
  facade_altbau2: { color: '#ffffff', map: 'facade:altbau2', emap: 'facade:altbau2:e', ei: 0.7, rough: 0.8 },
  facade_platte: { color: '#ffffff', map: 'facade:platte', emap: 'facade:platte:e', ei: 0.7, rough: 0.85 },
  facade_platte2: { color: '#ffffff', map: 'facade:platte2', emap: 'facade:platte2:e', ei: 0.7, rough: 0.85 },
  facade_shop: { color: '#ffffff', map: 'facade:shop_berlin', emap: 'facade:shop_berlin:e', ei: 0.6, rough: 0.6 },
  cornice: { color: '#efe4cc', rough: 0.8 },
  roofgrey: { color: '#5a5f66', rough: 0.8 },
  roofred: { color: '#9c4a35', rough: 0.85 },
  bunker: { color: '#ffffff', map: 'concrete', rough: 0.95 },
  graffiti: { color: '#ffffff', map: 'graffiti:a', rough: 0.9 },
  graffiti2: { color: '#ffffff', map: 'graffiti:b', rough: 0.9 },
  poster: { color: '#ffffff', map: 'poster', rough: 0.7 },
  brick: { color: '#ffffff', map: 'brick', rough: 0.9 },
  signdoener: { color: '#ffffff', map: 'sign:doener', emap: 'sign:doener:e', ei: 1.6 },
  signspaeti: { color: '#ffffff', map: 'sign:spaeti', emap: 'sign:spaeti:e', ei: 1.8 },
  signcurry: { color: '#ffffff', map: 'sign:curry', rough: 0.6 },
  signu: { color: '#ffffff', map: 'sign:ubahn', emissive: '#1a5fb4', ei: 0.4 },
  signclub: { color: '#ffffff', map: 'sign:club', emap: 'sign:club:e', ei: 2 },
  signphone: { color: '#ffffff', map: 'sign:phone' },
  busyellow: { color: '#ffd400', rough: 0.3, metal: 0.3 },
  trabiblue: { color: '#8fb8c9', rough: 0.45, metal: 0.1 },
  trabibeige: { color: '#e8dcc0', rough: 0.5 },
  luxblack: { color: '#0d0d10', rough: 0.12, metal: 0.8 },
  matteblack: { color: '#1a1a1f', rough: 0.35, metal: 0.6 },
  bsrorange: { color: '#ff6a00', rough: 0.45 },
  ampelgreen: { color: '#1aff6a', emissive: '#1aff6a', ei: 2.8 },
  ampelred: { color: '#ff1f1f', emissive: '#ff1f1f', ei: 2.8 },
  meat: { color: '#9a5a2e', rough: 0.75 },
  meat2: { color: '#b8743f', rough: 0.7 },
  bread: { color: '#e8c38a', rough: 0.85 },
  salad: { color: '#5cc85a', rough: 0.7 },
  tomato: { color: '#e5372b', rough: 0.5 },
  sauce: { color: '#c7301b', rough: 0.3 },
  paper: { color: '#f4efe6', rough: 0.9 },
  sausage: { color: '#b0522a', rough: 0.4 },
  tracksuit: { color: '#16161a', rough: 0.7 },
  tracksuitw: { color: '#f2f2f2', rough: 0.7 },
  puffer: { color: '#d9c3a5', rough: 0.6 },
  puffer2: { color: '#111114', rough: 0.4 },
  leggings: { color: '#1b1b1f', rough: 0.4 },
  monogram: { color: '#ffffff', map: 'monogram', rough: 0.6 },
  neonvest: { color: '#c6ff00', emissive: '#7aff00', ei: 0.6, rough: 0.5 },
  hawaii: { color: '#ff7a3d', rough: 0.6 },
  khaki: { color: '#c2b280', rough: 0.8 },
  hairblack: { color: '#17110d', rough: 0.4 },
  hairbrown: { color: '#5a3a22', rough: 0.5 },
  nails: { color: '#ff3fa4', rough: 0.2, metal: 0.4 },
  pigeon: { color: '#8a8f9c', rough: 0.8 },
  pigeonneck: { color: '#5b7f74', rough: 0.4, metal: 0.4 },
  bottlegreen: { color: '#3c7a3a', rough: 0.05, metal: 0.3, opacity: 0.8 },
  bottlebrown: { color: '#7a4a1e', rough: 0.05, metal: 0.3, opacity: 0.85 },
  mate: { color: '#e0a72e', rough: 0.05, metal: 0.3, opacity: 0.85 },
  label: { color: '#f2e7c9', rough: 0.7 },
  conecol: { color: '#ff5a1f', rough: 0.5 },
  tvsphere: { color: '#b9bec6', rough: 0.2, metal: 0.9 },
  tvshaft: { color: '#e9e6df', rough: 0.7 },
  tvred: { color: '#d9261c', rough: 0.5 },
  lindeleaf: { color: '#6ea83f', rough: 0.8 },
  lindeleaf2: { color: '#4f8a2e', rough: 0.8 },
  crate: { color: '#d6b13a', rough: 0.7 },
  awning_berlin: { color: '#ffffff', map: 'stripes:c8102e:ffffff:8', rough: 0.7, side: 'double' },
  awning_green: { color: '#ffffff', map: 'stripes:1f6b3a:f2e7c9:8', rough: 0.7, side: 'double' },
  spree: { color: '#3c6b8a', rough: 0.1, metal: 0.4 },
};

function jungFigure(b: B) {
  b.person({ skin: 'skin2', top: 'tracksuit', legs: 'tracksuit', shoes: 'white', hair: 'hairblack' });
  // two white side stripes (generic) on sleeves & legs
  b.box(0.02, 0.7, 0.03, 'tracksuitw', -0.2, 0.08, 0.06);
  b.box(0.02, 0.7, 0.03, 'tracksuitw', 0.2, 0.08, 0.06);
  // designer-pattern cap
  b.dome(0.22, 'monogram', 0, 1.76, 0);
  b.box(0.3, 0.025, 0.22, 'monogram', 0, 1.78, 0.2);
  b.tor(0.12, 0.018, 'gold', 0, 1.4, 0.12, { rx: 1.2 });
  b.box(0.22, 0.16, 0.06, 'matteblack', 0.12, 1.02, 0.18, { rz: 0.4 });
}

function chayaFigure(b: B) {
  b.person({ skin: 'skin1', top: 'puffer', legs: 'leggings', shoes: 'white', hair: 'hairblack' });
  b.sph(0.32, 'puffer', 0, 1.2, 0, { sy: 0.9, sz: 0.85 });
  // slick high ponytail
  b.sph(0.08, 'hairblack', 0, 1.92, -0.1);
  b.cap(0.06, 0.32, 'hairblack', 0, 1.7, -0.25, { rx: 0.5 });
  b.tor(0.07, 0.012, 'gold', -0.2, 1.6, 0, { ry: Math.PI / 2 });
  b.tor(0.07, 0.012, 'gold', 0.2, 1.6, 0, { ry: Math.PI / 2 });
  b.box(0.05, 0.02, 0.07, 'nails', -0.37, 0.72, 0.04);
  b.box(0.05, 0.02, 0.07, 'nails', 0.37, 0.72, 0.04);
  b.box(0.18, 0.06, 0.05, 'black', 0, 1.68, 0.18);
  b.box(0.14, 0.24, 0.03, 'matteblack', 0.37, 0.95, 0.12);
}

function treeLinde(b: B) {
  b.cyl(0.09, 0.13, 1.1, 'trunk', 0, 0, 0, 8);
  b.ico(0.6, 'lindeleaf', 0, 1.5, 0, 1);
  b.ico(0.45, 'lindeleaf2', 0.35, 1.2, 0.15, 1);
  b.ico(0.42, 'lindeleaf', -0.32, 1.3, -0.2, 1);
  b.ico(0.35, 'lindeleaf2', 0.05, 1.95, -0.05, 1);
}

export const BERLIN_MODELS: Record<string, (b: B) => void> = {
  brandenburger_tor(b) {
    b.box(1.95, 0.08, 0.7, 'sandstone2', 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const x = -0.85 + i * 0.34;
      for (const z of [-0.22, 0.22]) {
        b.cyl(0.07, 0.075, 0.85, 'sandstone', x, 0.08, z, 14);
        b.box(0.17, 0.04, 0.17, 'sandstone2', x, 0.08, z);
        b.box(0.17, 0.04, 0.17, 'sandstone2', x, 0.89, z);
      }
    }
    b.box(1.95, 0.18, 0.62, 'sandstone', 0, 0.93, 0);
    b.box(2.0, 0.04, 0.66, 'sandstone2', 0, 1.11, 0);
    b.box(1.1, 0.16, 0.5, 'sandstone', 0, 1.15, 0);
    b.box(0.6, 0.12, 0.42, 'sandstone2', 0, 1.31, 0);
    // wings
    b.box(0.25, 0.55, 0.5, 'sandstone', -1.0, 0.08, 0.0, { sx: 0.4 });
    // quadriga (stylised)
    for (let i = 0; i < 4; i++) {
      const x = -0.18 + i * 0.12;
      b.cap(0.035, 0.12, 'patina', x, 1.55, 0.04, { rx: Math.PI / 2 });
      b.cap(0.02, 0.07, 'patina', x, 1.63, 0.13, { rx: -0.4 });
      for (const lz of [-0.04, 0.1]) b.cyl(0.008, 0.008, 0.12, 'patina', x, 1.43, lz, 4);
    }
    b.box(0.18, 0.1, 0.12, 'patina', 0, 1.43, -0.12);
    b.cap(0.025, 0.12, 'patina', 0, 1.6, -0.14);
    b.cyl(0.008, 0.008, 0.25, 'patina', 0.06, 1.6, -0.14, 4);
    b.sph(0.03, 'patina', 0.06, 1.86, -0.14);
  },
  fernsehturm(b) {
    // base pavilion
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.box(0.5, 0.12, 0.3, 'tvshaft', Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55, { ry: -a });
    }
    b.cyl(0.32, 0.38, 0.14, 'concrete', 0, 0, 0, 16);
    b.cyl(0.08, 0.16, 3.1, 'tvshaft', 0, 0.14, 0, 16);
    b.sph(0.38, 'tvsphere', 0, 3.35, 0, { seg: 20 });
    b.tor(0.37, 0.025, 'darkglass', 0, 3.33, 0, { rx: Math.PI / 2, seg: 28 });
    b.tor(0.33, 0.02, 'lampglow', 0, 3.25, 0, { rx: Math.PI / 2, seg: 28 });
    b.cyl(0.05, 0.07, 0.35, 'tvshaft', 0, 3.7, 0, 10);
    for (let i = 0; i < 5; i++) b.cyl(0.025, 0.025, 0.12, i % 2 ? 'white' : 'tvred', 0, 4.05 + i * 0.12, 0, 8);
    b.sph(0.03, 'redlight', 0, 4.68, 0);
  },
  plattenbau(b) {
    b.box(1.45, 2.4, 0.7, 'facade_platte', 0, 0, 0, { uv: [0.36, 0.4] });
    b.box(1.5, 0.08, 0.75, 'roofgrey', 0, 2.4, 0);
    b.box(0.3, 0.25, 0.3, 'roofgrey', 0.4, 2.48, 0);
    for (let i = 0; i < 6; i++) for (const x of [-0.45, 0.45]) b.box(0.34, 0.03, 0.12, 'concrete', x, 0.35 + i * 0.38, 0.4);
    b.box(0.3, 0.3, 0.05, 'darkglass', 0, 0, 0.36);
    b.box(0.4, 0.5, 0.01, 'graffiti', -0.5, 0, 0.355);
    b.cylC(0.12, 0.02, 'white', 0.65, 2.0, 0.37, 10, { rx: Math.PI / 2 });
  },
  club_bunker(b) {
    b.box(1.4, 1.2, 1.2, 'bunker', 0, 0, 0, { uv: [0.7, 0.6] });
    b.box(1.5, 0.12, 1.3, 'concrete', 0, 1.2, 0);
    for (let i = 0; i < 4; i++) b.box(0.18, 0.05, 0.02, 'darkglass', -0.5 + i * 0.33, 0.8, 0.61);
    b.box(0.3, 0.4, 0.02, 'black', 0, 0, 0.605);
    b.plane(0.7, 0.22, 'signclub', 0, 0.55, 0.615);
    // the queue (tiny people)
    for (let i = 0; i < 6; i++) {
      b.cap(0.05, 0.12, i % 2 ? 'tracksuit' : 'neonvest', 0.3 + i * 0.1, 0.1, 0.75 + Math.sin(i) * 0.05);
      b.sph(0.035, 'skin2', 0.3 + i * 0.1, 0.24, 0.75 + Math.sin(i) * 0.05);
    }
    b.box(0.6, 0.6, 0.01, 'graffiti2', -0.45, 0.05, 0.605);
    b.box(0.3, 0.15, 0.3, 'darkmetal', 0.4, 1.32, -0.3);
  },
  altbau(b) {
    b.box(1.4, 1.5, 0.95, 'facade_altbau', 0, 0.3, 0, { uv: [0.35, 0.3] });
    b.box(1.4, 0.3, 0.95, 'facade_shop', 0, 0, 0, { uv: [0.7, 0.3] });
    for (let i = 0; i < 4; i++) b.box(1.44, 0.03, 0.99, 'cornice', 0, 0.3 + i * 0.45, 0);
    b.box(1.48, 0.06, 1.02, 'cornice', 0, 1.8, 0);
    b.gable(1.0, 0.35, 1.42, 'roofgrey', 0, 1.86, 0, { ry: Math.PI / 2, sx: 1 });
    // balconies
    for (let i = 0; i < 3; i++)
      for (const x of [-0.35, 0.35]) {
        b.box(0.32, 0.03, 0.14, 'cornice', x, 0.5 + i * 0.45, 0.54);
        b.box(0.32, 0.1, 0.01, 'darkmetal', x, 0.53 + i * 0.45, 0.61);
      }
    b.box(1.2, 0.02, 0.22, 'awning_green', 0, 0.28, 0.58, { rx: 0.3 });
    b.box(0.4, 0.06, 0.4, 'brick', -0.45, 2.05, 0.1);
  },
  ubahn_train(b) {
    for (const z of [-0.48, 0.48]) {
      b.push(0, 0, z);
      b.box(0.42, 0.44, 0.9, 'busyellow', 0, 0.06, 0);
      b.box(0.44, 0.12, 0.88, 'darkglass', 0, 0.3, 0);
      b.box(0.43, 0.05, 0.9, 'white', 0, 0.48, 0);
      for (let d = -1; d <= 1; d++) b.box(0.445, 0.3, 0.1, 'darkmetal', 0, 0.08, d * 0.32);
      b.pop();
    }
    b.box(0.3, 0.12, 0.04, 'darkglass', 0, 0.35, 0.94);
    b.box(0.08, 0.04, 0.01, 'lampglow', -0.12, 0.2, 0.935);
    b.box(0.08, 0.04, 0.01, 'lampglow', 0.12, 0.2, 0.935);
    b.box(0.34, 0.025, 1.9, 'darkmetal', 0, 0.0, 0);
    b.plane(0.2, 0.2, 'signu', 0.225, 0.4, 0.6, { ry: Math.PI / 2 });
    b.plane(0.2, 0.2, 'signu', -0.225, 0.4, -0.6, { ry: -Math.PI / 2 });
  },
  doener_shop(b) {
    b.box(1.3, 0.65, 0.9, 'facade_shop', 0, 0, -0.1, { uv: [0.65, 0.32] });
    b.box(1.34, 0.12, 0.94, 'roofred', 0, 0.65, -0.1);
    b.plane(1.2, 0.36, 'signdoener', 0, 0.82, 0.37);
    b.box(1.2, 0.02, 0.3, 'awning_berlin', 0, 0.52, 0.48, { rx: 0.35 });
    // spit in the window
    b.cyl(0.08, 0.13, 0.3, 'meat', -0.35, 0.12, 0.38, 10);
    b.cyl(0.01, 0.01, 0.45, 'chrome', -0.35, 0.06, 0.38, 4);
    // tables outside
    for (const x of [0.2, 0.5]) {
      b.cyl(0.1, 0.1, 0.02, 'white', x, 0.22, 0.65, 10);
      b.cyl(0.015, 0.015, 0.22, 'chrome', x, 0, 0.65, 4);
    }
  },
  spaeti(b) {
    b.box(1.2, 0.62, 0.9, 'brick', 0, 0, -0.1, { uv: [0.5, 0.5] });
    b.box(0.9, 0.35, 0.02, 'facade_shop', 0, 0.06, 0.355, { uv: [0.9, 0.35] });
    b.plane(1.1, 0.34, 'signspaeti', 0, 0.78, 0.36);
    b.box(1.24, 0.06, 0.94, 'roofgrey', 0, 0.62, -0.1);
    // beer crates + bench
    for (let i = 0; i < 3; i++) b.box(0.18, 0.12, 0.13, 'crate', -0.45, i * 0.12, 0.55);
    b.box(0.45, 0.04, 0.14, 'wood', 0.3, 0.2, 0.55);
    for (const x of [0.12, 0.48]) b.box(0.04, 0.2, 0.12, 'darkmetal', x, 0, 0.55);
    for (let i = 0; i < 5; i++) b.cyl(0.02, 0.02, 0.12, i % 2 ? 'bottlegreen' : 'bottlebrown', -0.5 + i * 0.03, 0.36, 0.55, 6);
  },
  graffiti_wall(b) {
    b.box(1.9, 0.9, 0.18, 'graffiti', 0, 0, 0, { uv: [1.9, 0.9] });
    b.box(1.95, 0.06, 0.22, 'concrete', 0, 0.9, 0);
    b.cyl(0.04, 0.04, 0.14, 'pinkhot', 0.6, 0, 0.25, 8);
    b.cyl(0.04, 0.04, 0.14, 'neonblue', 0.7, 0, 0.22, 8);
  },
  yellow_bus(b) {
    b.box(0.58, 0.9, 1.9, 'busyellow', 0, 0.08, 0);
    b.box(0.6, 0.18, 1.8, 'darkglass', 0, 0.32, 0);
    b.box(0.6, 0.18, 1.8, 'darkglass', 0, 0.72, 0);
    b.box(0.5, 0.28, 0.02, 'darkglass', 0, 0.3, 0.955);
    b.box(0.3, 0.06, 0.01, 'lampglow', 0, 0.9, 0.955);
    b.box(0.6, 0.04, 1.92, 'white', 0, 0.55, 0);
    for (const z of [0.6, -0.55]) {
      b.wheel('tire', -0.28, 0.1, z, 0.1, 0.07);
      b.wheel('tire', 0.28, 0.1, z, 0.1, 0.07);
    }
  },
  ubahn_entrance(b) {
    b.box(0.9, 0.06, 1.6, 'concrete', 0, 0, 0);
    b.box(0.7, 0.02, 1.4, 'black', 0, 0.06, 0);
    for (const x of [-0.42, 0.42]) {
      b.box(0.04, 0.35, 1.45, 'darkmetal', x, 0.06, 0);
      b.box(0.06, 0.04, 1.45, 'patina', x, 0.4, 0);
    }
    b.box(0.85, 0.04, 0.04, 'darkmetal', 0, 0.38, -0.72);
    b.cyl(0.03, 0.03, 1.1, 'darkmetal', 0.55, 0, 0.7, 8);
    b.box(0.34, 0.34, 0.06, 'signu', 0.55, 1.1, 0.7);
    for (let i = 0; i < 5; i++) b.box(0.66, 0.04, 0.12, 'stone', 0, 0.05 - i * 0.06, 0.55 - i * 0.14);
  },
  curry_stand(b) {
    b.box(1.2, 0.7, 0.8, 'white', 0, 0, 0);
    b.box(1.0, 0.25, 0.02, 'darkmetal', 0, 0.4, 0.41);
    b.box(1.26, 0.05, 0.95, 'awning_berlin', 0, 0.7, 0.05, { rx: 0.08 });
    b.plane(1.1, 0.3, 'signcurry', 0, 0.92, 0.36);
    b.box(1.1, 0.04, 0.2, 'chrome', 0, 0.38, 0.5);
    for (let i = 0; i < 4; i++) b.cap(0.025, 0.12, 'sausage', -0.3 + i * 0.12, 0.44, 0.5, { rz: Math.PI / 2 });
    b.cyl(0.12, 0.12, 0.6, 'white', 0.75, 0, 0.6, 10);
    b.box(0.3, 0.02, 0.3, 'white', 0.75, 0.6, 0.6);
  },
  luxury_car(b) {
    b.box(0.86, 0.26, 1.9, 'luxblack', 0, 0.12, 0);
    b.box(0.74, 0.24, 0.95, 'luxblack', 0, 0.38, -0.12);
    b.box(0.76, 0.18, 0.9, 'darkglass', 0, 0.4, -0.12);
    b.box(0.7, 0.2, 0.03, 'darkglass', 0, 0.36, 0.36, { rx: -0.7 });
    b.box(0.36, 0.14, 0.02, 'chrome', 0, 0.18, 0.955);
    for (let i = 0; i < 5; i++) b.box(0.01, 0.12, 0.01, 'black', -0.14 + i * 0.07, 0.19, 0.965);
    for (const x of [-0.32, 0.32]) {
      b.box(0.18, 0.04, 0.02, 'neonblue', x, 0.3, 0.955);
      b.box(0.2, 0.04, 0.02, 'redlight', x, 0.3, -0.955);
    }
    b.box(0.88, 0.02, 1.92, 'chrome', 0, 0.12, 0);
    for (const z of [0.6, -0.6])
      for (const x of [-0.4, 0.4]) b.wheel('tire', x, 0.15, z, 0.15, 0.1, 'gold');
  },
  trabi(b) {
    b.box(0.76, 0.3, 1.7, 'trabiblue', 0, 0.12, 0);
    b.box(0.7, 0.28, 0.85, 'trabibeige', 0, 0.42, -0.1);
    b.box(0.72, 0.2, 0.8, 'glass', 0, 0.44, -0.1);
    b.box(0.74, 0.04, 0.88, 'trabibeige', 0, 0.68, -0.1);
    for (const x of [-0.26, 0.26]) {
      b.cylC(0.06, 0.02, 'lampglow', x, 0.3, 0.86, 10, { rx: Math.PI / 2 });
      b.box(0.1, 0.05, 0.02, 'redlight', x, 0.3, -0.86);
    }
    b.box(0.3, 0.05, 0.02, 'chrome', 0, 0.2, 0.86);
    b.cyl(0.02, 0.03, 0.08, 'darkmetal', 0.25, 0.08, -0.86, 6, { rx: Math.PI / 2 });
    for (const z of [0.55, -0.55])
      for (const x of [-0.36, 0.36]) b.wheel('tire', x, 0.13, z, 0.13, 0.08, 'trabibeige');
  },
  linde(b) {
    treeLinde(b);
  },
  doner_spiess(b) {
    b.box(0.7, 0.1, 0.7, 'chrome', 0, 0, 0);
    b.cyl(0.03, 0.03, 2.0, 'chrome', 0, 0.1, 0, 6);
    b.cyl(0.32, 0.5, 1.3, 'meat', 0, 0.25, 0, 14);
    for (let i = 0; i < 5; i++) b.tor(0.5 - i * 0.04, 0.03, 'meat2', 0, 0.4 + i * 0.25, 0, { rx: Math.PI / 2, seg: 16 });
    b.cyl(0.1, 0.1, 0.06, 'chrome', 0, 1.55, 0, 10);
    b.box(0.08, 1.4, 0.5, 'redlight', -0.6, 0.15, 0, { sx: 0.6 });
  },
  bench(b) {
    for (let i = 0; i < 3; i++) b.box(1.5, 0.04, 0.12, 'wood', 0, 0.38, -0.12 + i * 0.13);
    for (let i = 0; i < 2; i++) b.box(1.5, 0.12, 0.04, 'wood', 0, 0.55 + i * 0.16, -0.24, { rx: -0.15 });
    for (const x of [-0.6, 0.6]) {
      b.box(0.05, 0.38, 0.4, 'darkmetal', x, 0, 0);
      b.box(0.05, 0.42, 0.05, 'darkmetal', x, 0.42, -0.24);
    }
    b.cyl(0.05, 0.05, 0.3, 'bottlegreen', 0.35, 0.42, 0.05, 8);
  },
  litfass(b) {
    b.cyl(0.6, 0.62, 0.15, 'darkmetal', 0, 0, 0, 18);
    b.cyl(0.55, 0.55, 1.5, 'poster', 0, 0.15, 0, 18);
    b.cyl(0.62, 0.62, 0.06, 'darkmetal', 0, 1.65, 0, 18);
    b.dome(0.5, 'patina', 0, 1.7, 0, { seg: 16 });
    b.sph(0.06, 'patina', 0, 2.22, 0);
  },
  phone_booth(b) {
    b.box(0.9, 0.06, 0.9, 'darkmetal', 0, 0, 0);
    b.box(0.8, 1.7, 0.8, 'glass', 0, 0.06, 0);
    for (const [x, z] of [
      [-0.4, -0.4],
      [0.4, -0.4],
      [-0.4, 0.4],
      [0.4, 0.4],
    ])
      b.box(0.06, 1.7, 0.06, 'busyellow', x, 0.06, z);
    b.box(0.9, 0.2, 0.9, 'busyellow', 0, 1.76, 0);
    b.plane(0.7, 0.16, 'signphone', 0, 1.86, 0.455);
    b.box(0.2, 0.3, 0.1, 'darkmetal', 0, 0.9, -0.33);
  },
  bike(b) {
    b.tor(0.32, 0.03, 'tire', 0, 0.34, 0.55, { ry: Math.PI / 2 });
    b.tor(0.32, 0.03, 'tire', 0, 0.34, -0.55, { ry: Math.PI / 2 });
    b.box(0.04, 0.04, 0.8, 'red', 0, 0.55, 0, { rx: 0.1 });
    b.box(0.04, 0.5, 0.04, 'red', 0, 0.34, -0.15, { rx: -0.3 });
    b.box(0.04, 0.5, 0.04, 'red', 0, 0.36, 0.45, { rx: 0.3 });
    b.box(0.12, 0.04, 0.25, 'black', 0, 0.85, -0.2);
    b.box(0.5, 0.03, 0.03, 'chrome', 0, 0.9, 0.5);
    b.box(0.25, 0.15, 0.2, 'crate', 0, 0.72, -0.62);
  },
  jung(b) {
    jungFigure(b);
  },
  chaya(b) {
    chayaFigure(b);
  },
  raver(b) {
    b.person({ skin: 'skin1', top: 'neonvest', legs: 'black', shoes: 'black', hair: 'neonpink' });
    b.box(0.34, 0.08, 0.06, 'neonblue', 0, 1.66, 0.17);
    b.cyl(0.11, 0.1, 0.25, 'neonpink', -0.12, 0.08, 0, 8);
    b.cyl(0.11, 0.1, 0.25, 'neonpink', 0.12, 0.08, 0, 8);
    b.box(0.06, 0.3, 0.06, 'neongreen', 0.4, 1.4, 0.0, { rz: -0.4 });
    b.cone(0.06, 0.25, 'neonpink', 0, 1.88, 0, 6);
  },
  tourist(b) {
    b.person({ skin: 'skin1', top: 'hawaii', legs: 'khaki', shoes: 'white', hair: 'hairbrown' });
    b.cyl(0.2, 0.26, 0.12, 'khaki', 0, 1.8, 0, 12);
    b.box(0.35, 0.4, 0.2, 'blue', 0, 0.95, -0.25);
    b.cyl(0.012, 0.012, 0.9, 'chrome', 0.38, 0.9, 0.1, 4, { rz: -0.5, rx: -0.3 });
    b.box(0.12, 0.2, 0.02, 'black', 0.8, 1.6, 0.3, { rz: -0.5 });
    b.box(0.18, 0.1, 0.08, 'black', 0, 1.25, 0.2);
  },
  escooter(b) {
    b.box(0.25, 0.05, 1.0, 'neongreen', 0, 0.12, 0, { rz: Math.PI / 2 - 0.25 });
    b.wheel('tire', 0.08, 0.1, 0.45, 0.1, 0.05);
    b.wheel('tire', -0.05, 0.1, -0.45, 0.1, 0.05);
    b.box(0.05, 1.0, 0.05, 'black', 0.4, 0.15, 0.45, { rz: -1.1 });
    b.box(0.05, 0.5, 0.05, 'black', 1.0, 0.45, 0.45);
  },
  bin(b) {
    b.cyl(0.42, 0.36, 1.05, 'bsrorange', 0, 0.1, 0, 14);
    b.cyl(0.45, 0.45, 0.08, 'bsrorange', 0, 1.15, 0, 14);
    b.box(0.3, 0.12, 0.02, 'black', 0, 0.9, 0.42);
    b.cyl(0.04, 0.04, 1.6, 'darkmetal', 0, 0, -0.45, 6);
    b.box(0.2, 0.08, 0.02, 'white', 0, 0.55, 0.4);
  },
  ampel(b) {
    b.cyl(0.08, 0.1, 2.0, 'darkmetal', 0, 0, 0, 8);
    b.box(0.34, 0.8, 0.28, 'black', 0, 1.6, 0.15);
    b.box(0.26, 0.3, 0.02, 'ampelred', 0, 2.02, 0.3);
    b.box(0.26, 0.3, 0.02, 'black', 0, 1.65, 0.3);
    // the little green man (generic walking figure)
    b.box(0.06, 0.12, 0.02, 'ampelgreen', 0, 1.68, 0.31);
    b.sph(0.035, 'ampelgreen', 0, 1.79, 0.31);
    b.box(0.03, 0.1, 0.02, 'ampelgreen', -0.04, 1.6, 0.31, { rz: 0.4 });
    b.box(0.03, 0.1, 0.02, 'ampelgreen', 0.04, 1.6, 0.31, { rz: -0.4 });
    b.box(0.12, 0.02, 0.02, 'ampelgreen', 0, 1.76, 0.31);
    b.dome(0.05, 'ampelgreen', 0, 1.82, 0.31);
  },
  doener(b) {
    b.cone(0.55, 1.6, 'bread', 0, 1.6, 0, 12, { rx: Math.PI });
    b.cone(0.48, 0.25, 'paper', 0, 0.1, 0, 12, { rx: Math.PI });
    b.sph(0.45, 'meat2', 0, 1.5, 0, { sy: 0.4 });
    b.sph(0.12, 'salad', 0.25, 1.65, 0.1);
    b.sph(0.1, 'tomato', -0.2, 1.68, 0.15);
    b.sph(0.12, 'salad', -0.1, 1.68, -0.25);
    b.sph(0.08, 'white', 0.05, 1.72, 0.2);
    b.box(0.7, 0.4, 0.02, 'paper', 0, 0.4, 0.35, { rx: -0.2 });
  },
  currywurst(b) {
    b.box(1.6, 0.18, 0.9, 'paper', 0, 0, 0);
    for (let i = 0; i < 6; i++) b.cylC(0.16, 0.16, 'sausage', -0.55 + i * 0.22, 0.3, 0, 10, { rz: Math.PI / 2 + 0.3 });
    b.sph(0.5, 'sauce', 0, 0.28, 0, { sx: 1.5, sy: 0.15 });
    b.box(0.05, 0.03, 0.5, 'red', 0.4, 0.45, 0.2, { ry: 0.5, rx: -0.3 });
    for (let i = 0; i < 8; i++) b.box(0.08, 0.08, 0.5, 'yellow', -0.6 + i * 0.16, 0.18, -0.65, { ry: i * 0.3 });
  },
  cone(b) {
    b.box(1.0, 0.1, 1.0, 'conecol', 0, 0, 0);
    b.cone(0.45, 1.6, 'conecol', 0, 0.1, 0, 12);
    b.cyl(0.32, 0.38, 0.18, 'white', 0, 0.55, 0, 12);
    b.cyl(0.18, 0.24, 0.16, 'white', 0, 1.05, 0, 12);
  },
  pigeon(b) {
    b.sph(0.45, 'pigeon', 0, 0.5, 0, { sz: 1.4, sy: 0.85 });
    b.sph(0.25, 'pigeonneck', 0, 0.85, 0.35);
    b.sph(0.22, 'pigeon', 0, 1.05, 0.45);
    b.cone(0.06, 0.18, 'orange', 0, 1.0, 0.75, 6, { rx: Math.PI / 2 });
    b.sph(0.04, 'orange', -0.12, 1.1, 0.6);
    b.sph(0.04, 'orange', 0.12, 1.1, 0.6);
    b.box(0.5, 0.06, 0.6, 'darkmetal', 0, 0.55, -0.6, { rx: 0.3 });
    b.cyl(0.03, 0.03, 0.25, 'orange', -0.15, 0, 0, 4);
    b.cyl(0.03, 0.03, 0.25, 'orange', 0.15, 0, 0, 4);
  },
  designer_cap(b) {
    b.dome(0.75, 'monogram', 0, 0.1, -0.15, { seg: 16 });
    b.box(1.1, 0.08, 0.7, 'monogram', 0, 0.1, 0.6, { rx: -0.1 });
    b.sph(0.1, 'monogram', 0, 0.85, -0.15);
    b.cyl(0.78, 0.78, 0.1, 'puffer2', 0, 0.05, -0.15, 16);
  },
  mate(b) {
    b.cyl(0.5, 0.5, 1.3, 'mate', 0, 0, 0, 12);
    b.cyl(0.5, 0.18, 0.5, 'mate', 0, 1.3, 0, 12);
    b.cyl(0.18, 0.18, 0.35, 'mate', 0, 1.8, 0, 12);
    b.cyl(0.21, 0.21, 0.1, 'blue', 0, 2.1, 0, 12);
    b.cyl(0.52, 0.52, 0.55, 'label', 0, 0.35, 0, 12);
  },
  pfand(b) {
    b.cyl(0.5, 0.5, 1.4, 'bottlegreen', 0, 0, 0, 12);
    b.cyl(0.5, 0.18, 0.5, 'bottlegreen', 0, 1.4, 0, 12);
    b.cyl(0.17, 0.17, 0.4, 'bottlegreen', 0, 1.9, 0, 12);
    b.cyl(0.2, 0.2, 0.08, 'gold', 0, 2.3, 0, 12);
    b.cyl(0.52, 0.52, 0.5, 'label', 0, 0.4, 0, 12);
  },
};
