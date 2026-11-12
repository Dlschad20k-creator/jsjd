/** Procedural canvas textures (facades, signs, graffiti, posters). All drawn in code. */
import * as THREE from 'three';
import { mulberry32 } from '@shared/mapgen';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void;

const cache = new Map<string, THREE.Texture>();
let maxAniso = 4;
export function setAnisotropy(a: number) {
  maxAniso = a;
}

function canvasTex(key: string, w: number, h: number, draw: Draw, opts: { repeat?: boolean; srgb?: boolean } = {}) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, w, h, mulberry32(hash(key)));
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  cache.set(key, t);
  return t;
}

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function noise(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, amount = 0.06, n = 1800) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * amount;
    ctx.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
  }
}

interface FacadeOpts {
  wall: string;
  frame: string;
  glass: [string, string];
  cols: number;
  rows: number;
  winW: number; // 0..1 of cell
  winH: number;
  arch?: boolean;
  sill?: string;
  flowers?: string[];
  lit?: number; // probability a window is lit (emissive map)
  panels?: boolean;
  shutters?: string;
}

function facadeDraw(o: FacadeOpts, emissive: boolean): Draw {
  return (ctx, w, h, rnd) => {
    ctx.fillStyle = emissive ? '#000' : o.wall;
    ctx.fillRect(0, 0, w, h);
    if (!emissive) noise(ctx, w, h, rnd, 0.05, 2500);
    const cw = w / o.cols;
    const ch = h / o.rows;
    for (let r = 0; r < o.rows; r++)
      for (let c = 0; c < o.cols; c++) {
        const x0 = c * cw;
        const y0 = r * ch;
        if (o.panels && !emissive) {
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x0 + 1, y0 + 1, cw - 2, ch - 2);
        }
        const ww = cw * o.winW;
        const wh = ch * o.winH;
        const wx = x0 + (cw - ww) / 2;
        const wy = y0 + (ch - wh) * 0.45;
        const lit = (o.lit ?? 0) > rnd();
        if (emissive) {
          if (lit) {
            const warm = rnd() < 0.7;
            ctx.fillStyle = warm ? `hsl(${35 + rnd() * 15},90%,${55 + rnd() * 15}%)` : `hsl(${190 + rnd() * 40},70%,60%)`;
            ctx.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);
          }
          continue;
        }
        ctx.fillStyle = o.frame;
        if (o.arch) {
          ctx.beginPath();
          ctx.moveTo(wx, wy + wh);
          ctx.lineTo(wx, wy + ww / 2);
          ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0);
          ctx.lineTo(wx + ww, wy + wh);
          ctx.closePath();
          ctx.fill();
        } else ctx.fillRect(wx, wy, ww, wh);
        const g = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
        g.addColorStop(0, lit ? '#ffe2a0' : o.glass[0]);
        g.addColorStop(1, lit ? '#ffb347' : o.glass[1]);
        ctx.fillStyle = g;
        const inset = 4;
        if (o.arch) {
          ctx.beginPath();
          ctx.moveTo(wx + inset, wy + wh - inset);
          ctx.lineTo(wx + inset, wy + ww / 2);
          ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2 - inset, Math.PI, 0);
          ctx.lineTo(wx + ww - inset, wy + wh - inset);
          ctx.closePath();
          ctx.fill();
        } else ctx.fillRect(wx + inset, wy + inset, ww - inset * 2, wh - inset * 2);
        // mullion + reflection streak
        ctx.fillStyle = o.frame;
        ctx.fillRect(wx + ww / 2 - 1.5, wy + inset, 3, wh - inset * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(wx + inset, wy + wh * 0.7);
        ctx.lineTo(wx + ww * 0.45, wy + inset);
        ctx.lineTo(wx + ww * 0.6, wy + inset);
        ctx.lineTo(wx + inset, wy + wh * 0.9);
        ctx.fill();
        if (o.shutters) {
          ctx.fillStyle = o.shutters;
          ctx.fillRect(wx - ww * 0.28, wy, ww * 0.24, wh);
          ctx.fillRect(wx + ww * 1.04, wy, ww * 0.24, wh);
        }
        if (o.sill) {
          ctx.fillStyle = o.sill;
          ctx.fillRect(wx - 4, wy + wh, ww + 8, 6);
        }
        if (o.flowers && rnd() < 0.6) {
          for (let f = 0; f < 6; f++) {
            ctx.fillStyle = o.flowers[Math.floor(rnd() * o.flowers.length)];
            ctx.beginPath();
            ctx.arc(wx + 4 + rnd() * (ww - 8), wy + wh - 2 - rnd() * 6, 3 + rnd() * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
  };
}

const FACADES: Record<string, FacadeOpts> = {
  pinkhouse: { wall: '#ffc4dd', frame: '#ffffff', glass: ['#bfe9ff', '#6fb7e8'], cols: 3, rows: 3, winW: 0.55, winH: 0.6, sill: '#fff', flowers: ['#ff3f8e', '#fff', '#ffd1e8'], shutters: '#ff7eb6' },
  pinkmansion: { wall: '#fff0f7', frame: '#ffd6ea', glass: ['#d6f2ff', '#7cc3ee'], cols: 4, rows: 4, winW: 0.5, winH: 0.65, arch: true, sill: '#ffb3d6', flowers: ['#ff5ea8', '#ffffff'] },
  fashion: { wall: '#ff5eb3', frame: '#ffffff', glass: ['#fde6ff', '#d98bff'], cols: 4, rows: 6, winW: 0.86, winH: 0.8 },
  boutique: { wall: '#fff4fb', frame: '#ff8cc6', glass: ['#ffe8f5', '#ffb8dd'], cols: 2, rows: 2, winW: 0.75, winH: 0.65, arch: true },
  cottage_blue: { wall: '#cfeaff', frame: '#ffffff', glass: ['#fff8d6', '#ffe08a'], cols: 2, rows: 2, winW: 0.5, winH: 0.55, sill: '#fff', flowers: ['#ff9ec7', '#fff36b'], shutters: '#9ad0ff' },
  cottage_mint: { wall: '#d4f7e4', frame: '#ffffff', glass: ['#fff8d6', '#ffe08a'], cols: 2, rows: 2, winW: 0.5, winH: 0.55, sill: '#fff', flowers: ['#ffb3de', '#c3a6ff'], shutters: '#8de0b5' },
  cottage_lilac: { wall: '#eadcff', frame: '#ffffff', glass: ['#fff8d6', '#ffe08a'], cols: 2, rows: 2, winW: 0.5, winH: 0.55, sill: '#fff', flowers: ['#ffd36b', '#ff9ec7'], shutters: '#c7a8ff' },
  candy: { wall: '#ffe7f0', frame: '#ff9ac2', glass: ['#ffffff', '#ffd6ea'], cols: 3, rows: 4, winW: 0.45, winH: 0.5, arch: true },
  castle_bunny: { wall: '#fdf6ff', frame: '#d8c4ff', glass: ['#c8ecff', '#89c8f0'], cols: 3, rows: 4, winW: 0.4, winH: 0.6, arch: true },
  altbau: { wall: '#e9dcc2', frame: '#f8f3e8', glass: ['#3e4c5e', '#1d2633'], cols: 4, rows: 5, winW: 0.42, winH: 0.66, sill: '#d8c8a8', lit: 0.35 },
  altbau2: { wall: '#c9b79c', frame: '#efe6d4', glass: ['#3a4656', '#1b2430'], cols: 4, rows: 5, winW: 0.42, winH: 0.66, arch: true, sill: '#b9a789', lit: 0.3 },
  platte: { wall: '#a9adb2', frame: '#d8d8d8', glass: ['#334050', '#1b2430'], cols: 4, rows: 6, winW: 0.5, winH: 0.45, panels: true, lit: 0.4 },
  platte2: { wall: '#c7b9a2', frame: '#e6e0d0', glass: ['#334050', '#1b2430'], cols: 4, rows: 6, winW: 0.5, winH: 0.45, panels: true, lit: 0.4 },
  shop_berlin: { wall: '#d9cdb6', frame: '#3b3b3b', glass: ['#2c3a4a', '#121820'], cols: 2, rows: 2, winW: 0.8, winH: 0.7, lit: 0.8 },
};

export function facade(name: string, emissive = false) {
  const o = FACADES[name];
  if (!o) throw new Error('unknown facade ' + name);
  return canvasTex(`facade:${name}:${emissive ? 'e' : 'c'}`, 256, 256, facadeDraw(o, emissive));
}

const SIGNS: Record<string, { bg: string; fg: string; text: string; sub?: string; font?: string; border?: string; glow?: boolean }> = {
  doener: { bg: '#c8102e', fg: '#ffe066', text: 'DÖNER', sub: 'KEBAB · MIT ALLES', glow: true },
  spaeti: { bg: '#1c1c1c', fg: '#39ff88', text: 'SPÄTI', sub: '24/7 · KALTE GETRÄNKE', glow: true },
  curry: { bg: '#ffb000', fg: '#5b1a00', text: 'CURRY', sub: 'WURST · POMMES' },
  ubahn: { bg: '#1a5fb4', fg: '#ffffff', text: 'U', border: '#ffffff' },
  club: { bg: '#0b0b0b', fg: '#ff2bd6', text: 'BUNKER', sub: 'TECHNO · OPEN END', glow: true },
  boutique: { bg: '#ffffff', fg: '#ff3fa4', text: 'Boutique', sub: 'GLAM · FASHION', font: 'italic 700' },
  icecream: { bg: '#ffd1ea', fg: '#d6337a', text: 'ICE CREAM' },
  dream: { bg: '#ff4fb8', fg: '#ffffff', text: 'DREAM', sub: 'MALL · FASHION · CAFÉ', glow: true },
  carrot: { bg: '#ffffff', fg: '#ff8a1f', text: 'CARROTS', sub: 'FRESH · CRUNCHY' },
  phone: { bg: '#ffe600', fg: '#222', text: 'TELEFON' },
};

export function sign(name: string, emissive = false) {
  const s = SIGNS[name];
  return canvasTex(
    `sign:${name}:${emissive ? 'e' : 'c'}`,
    512,
    s.text.length <= 1 ? 512 : 160,
    (ctx, w, h) => {
      ctx.fillStyle = emissive ? '#000' : s.bg;
      ctx.fillRect(0, 0, w, h);
      if (s.border && !emissive) {
        ctx.strokeStyle = s.border;
        ctx.lineWidth = w * 0.06;
        ctx.strokeRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
      }
      ctx.fillStyle = emissive ? (s.glow ? s.fg : '#000') : s.fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const big = s.text.length <= 1;
      ctx.font = `${s.font ?? '900'} ${big ? h * 0.7 : s.sub ? h * 0.5 : h * 0.62}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
      if (!emissive && s.glow) {
        ctx.shadowColor = s.fg;
        ctx.shadowBlur = 18;
      }
      ctx.fillText(s.text, w / 2, s.sub ? h * 0.4 : h * 0.54, w * 0.92);
      if (s.sub) {
        ctx.font = `700 ${h * 0.17}px Arial, sans-serif`;
        ctx.fillText(s.sub, w / 2, h * 0.8, w * 0.9);
      }
    },
    { repeat: false },
  );
}

export function graffiti(seedName = 'a') {
  return canvasTex('graffiti:' + seedName, 512, 256, (ctx, w, h, rnd) => {
    ctx.fillStyle = '#8f8a84';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, rnd, 0.1, 3000);
    const cols = ['#ff2bd6', '#00e5ff', '#ffe600', '#39ff88', '#ff5a36', '#ffffff', '#8a5cff', '#111'];
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = cols[Math.floor(rnd() * cols.length)];
      ctx.lineWidth = 6 + rnd() * 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      let x = rnd() * w;
      let y = rnd() * h;
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (rnd() - 0.5) * 160;
        y += (rnd() - 0.5) * 110;
        ctx.quadraticCurveTo(x + (rnd() - 0.5) * 80, y + (rnd() - 0.5) * 80, x, y);
      }
      ctx.stroke();
    }
    const words = ['KIEZ', 'LAN', 'DIGGA', 'BRRR', 'LOST', 'EHRE', 'SPREE', 'WOW'];
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(40 + rnd() * (w - 120), 60 + rnd() * (h - 80));
      ctx.rotate((rnd() - 0.5) * 0.5);
      ctx.font = `900 ${50 + rnd() * 40}px "Arial Black", Impact, sans-serif`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#111';
      const word = words[Math.floor(rnd() * words.length)];
      ctx.strokeText(word, 0, 0);
      ctx.fillStyle = cols[Math.floor(rnd() * 6)];
      ctx.fillText(word, 0, 0);
      ctx.restore();
    }
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
      ctx.globalAlpha = 0.5;
      ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    ctx.globalAlpha = 1;
  });
}

export function poster() {
  return canvasTex('poster', 512, 256, (ctx, w, h, rnd) => {
    const items = [
      ['TECHNO', '#111', '#ff2bd6'],
      ['RAVE', '#ffe600', '#111'],
      ['FLOHMARKT', '#2bd9ff', '#111'],
      ['KONZERT', '#ff5a36', '#fff'],
      ['DÖNER-FEST', '#39ff88', '#111'],
      ['KIEZ PARTY', '#8a5cff', '#fff'],
    ];
    const pw = w / 3;
    for (let i = 0; i < 3; i++) {
      const it = items[Math.floor(rnd() * items.length)];
      ctx.fillStyle = it[1];
      ctx.fillRect(i * pw + 4, 4, pw - 8, h - 8);
      ctx.fillStyle = it[2];
      ctx.font = '900 34px Arial Black, sans-serif';
      ctx.save();
      ctx.translate(i * pw + pw / 2, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(it[0], 0, 12, h - 30);
      ctx.restore();
    }
  });
}

export function stripes(a: string, b: string, n = 8, key = '') {
  return canvasTex(`stripes:${a}:${b}:${n}:${key}`, 128, 128, (ctx, w, h) => {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fillRect((i * w) / n, 0, w / n, h);
    }
  });
}

export function monogram() {
  // a generic designer-style repeating pattern (not any real brand)
  return canvasTex('monogram', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d9c7a1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7a5a2e';
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        ctx.save();
        ctx.translate(x * 32 + (y % 2) * 16 + 8, y * 32 + 16);
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#7a5a2e';
        ctx.stroke();
        ctx.fillRect(-1.5, -10, 3, 20);
        ctx.restore();
      }
    ctx.fillStyle = '#1f6b3a';
    ctx.fillRect(0, h * 0.42, w, h * 0.06);
    ctx.fillStyle = '#b3202a';
    ctx.fillRect(0, h * 0.48, w, h * 0.06);
    ctx.fillStyle = '#1f6b3a';
    ctx.fillRect(0, h * 0.54, w, h * 0.06);
  });
}

export function concrete(key = 'concrete', base = '#8d8b87') {
  return canvasTex(key, 256, 256, (ctx, w, h, rnd) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, rnd, 0.12, 6000);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = `rgba(40,35,30,${rnd() * 0.15})`;
      ctx.fillRect(rnd() * w, rnd() * h * 0.3, 3 + rnd() * 6, 40 + rnd() * 140);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
}

export function brick() {
  return canvasTex('brick', 256, 256, (ctx, w, h, rnd) => {
    ctx.fillStyle = '#d9d2c5';
    ctx.fillRect(0, 0, w, h);
    const bh = 16;
    const bw = 40;
    for (let y = 0; y < h / bh; y++)
      for (let x = -1; x < w / bw + 1; x++) {
        const l = 34 + rnd() * 12;
        ctx.fillStyle = `hsl(${8 + rnd() * 10},${45 + rnd() * 15}%,${l}%)`;
        ctx.fillRect(x * bw + (y % 2) * (bw / 2) + 1, y * bh + 1, bw - 3, bh - 3);
      }
    noise(ctx, w, h, rnd, 0.08, 1500);
  });
}

export function swirl() {
  return canvasTex(
    'swirl',
    256,
    256,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { repeat: false },
  );
}

export function textureByKey(key: string): THREE.Texture {
  const [kind, a, b] = key.split(':');
  switch (kind) {
    case 'facade':
      return facade(a, b === 'e');
    case 'sign':
      return sign(a, b === 'e');
    case 'graffiti':
      return graffiti(a);
    case 'poster':
      return poster();
    case 'stripes': {
      const [, c1, c2, n] = key.split(':');
      return stripes('#' + c1, '#' + c2, Number(n) || 8, key);
    }
    case 'monogram':
      return monogram();
    case 'concrete':
      return concrete();
    case 'brick':
      return brick();
    default:
      throw new Error('unknown texture ' + key);
  }
}
