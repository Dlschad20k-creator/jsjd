import type { BlockType, Layout, WireObject } from './protocol';
import type { MapDef, Place } from './maps';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const LAYOUT_N = 5;
export const LAYOUT_BLOCK = 36;
export const LAYOUT_ROAD = 9;

export function makeLayout(rng: () => number, landmarks: number): Layout {
  const n = LAYOUT_N;
  const block = LAYOUT_BLOCK;
  const road = LAYOUT_ROAD;
  const size = n * block + (n + 1) * road;
  const blocks: BlockType[] = new Array(n * n).fill('city');
  const center = Math.floor(n / 2) * n + Math.floor(n / 2);
  blocks[center] = 'landmark';
  const free = () => {
    for (let tries = 0; tries < 200; tries++) {
      const i = Math.floor(rng() * n * n);
      if (blocks[i] === 'city') return i;
    }
    return blocks.indexOf('city');
  };
  for (let l = 1; l < landmarks; l++) blocks[free()] = 'landmark';
  for (let p = 0; p < 5; p++) blocks[free()] = 'park';
  for (let p = 0; p < 3; p++) blocks[free()] = 'plaza';
  return { size, block, road, n, blocks };
}

export function blockOrigin(layout: Layout, i: number, j: number) {
  const half = layout.size / 2;
  return {
    x0: -half + layout.road + i * (layout.block + layout.road),
    z0: -half + layout.road + j * (layout.block + layout.road),
  };
}

/** Center coordinate of road line k (0..n) */
export function roadCenter(layout: Layout, k: number) {
  return -layout.size / 2 + layout.road / 2 + k * (layout.block + layout.road);
}

interface Placed {
  x: number;
  z: number;
  r: number;
}

class Occupancy {
  cell = 6;
  map = new Map<string, Placed[]>();
  key(cx: number, cz: number) {
    return cx + ',' + cz;
  }
  fits(x: number, z: number, r: number, gap: number) {
    const reach = r + 12 + gap;
    const c0x = Math.floor((x - reach) / this.cell);
    const c1x = Math.floor((x + reach) / this.cell);
    const c0z = Math.floor((z - reach) / this.cell);
    const c1z = Math.floor((z + reach) / this.cell);
    for (let cx = c0x; cx <= c1x; cx++)
      for (let cz = c0z; cz <= c1z; cz++) {
        const list = this.map.get(this.key(cx, cz));
        if (!list) continue;
        for (const p of list) {
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < p.r + r + gap) return false;
        }
      }
    return true;
  }
  add(p: Placed) {
    const k = this.key(Math.floor(p.x / this.cell), Math.floor(p.z / this.cell));
    let list = this.map.get(k);
    if (!list) this.map.set(k, (list = []));
    list.push(p);
  }
}

export function generateWorld(map: MapDef, seed: number): { layout: Layout; objects: WireObject[] } {
  const rng = mulberry32(seed);
  const landmarkKinds = map.kinds.filter((k) => k.place.includes('landmark')).length;
  const layout = makeLayout(rng, Math.max(1, landmarkKinds));
  const { n, block, road, size } = layout;
  const half = size / 2;
  const occ = new Occupancy();
  const objects: WireObject[] = [];
  const blocksOf = (t: BlockType) => {
    const out: { i: number; j: number }[] = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (layout.blocks[j * n + i] === t) out.push({ i, j });
    return out;
  };
  const landmarkBlocks = blocksOf('landmark');
  // the center landmark first
  landmarkBlocks.sort((a, b) => Math.abs(a.i - 2) + Math.abs(a.j - 2) - (Math.abs(b.i - 2) + Math.abs(b.j - 2)));
  let landmarkIdx = 0;
  const allBlocks: { i: number; j: number }[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) allBlocks.push({ i, j });

  const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

  const candidate = (place: Place, r: number): { x: number; z: number; rot: number } | null => {
    switch (place) {
      case 'landmark': {
        const b = landmarkBlocks[landmarkIdx++];
        if (!b) return null;
        const { x0, z0 } = blockOrigin(layout, b.i, b.j);
        return { x: x0 + block / 2, z: z0 + block / 2, rot: 0 };
      }
      case 'road': {
        const k = Math.floor(rng() * (n + 1));
        const horizontal = rng() < 0.5;
        const along = -half + 4 + rng() * (size - 8);
        const lane = (rng() < 0.5 ? -1 : 1) * road * 0.24;
        const c = roadCenter(layout, k) + lane;
        const flip = lane > 0 ? 0 : Math.PI;
        if (horizontal) return { x: along, z: c, rot: Math.PI / 2 + flip };
        return { x: c, z: along, rot: flip };
      }
      case 'edge': {
        const b = pick(allBlocks);
        const { x0, z0 } = blockOrigin(layout, b.i, b.j);
        const side = Math.floor(rng() * 4);
        const inset = 1.2 + r * 0.3;
        const t = 1 + rng() * (block - 2);
        if (side === 0) return { x: x0 + t, z: z0 + inset, rot: 0 };
        if (side === 1) return { x: x0 + t, z: z0 + block - inset, rot: Math.PI };
        if (side === 2) return { x: x0 + inset, z: z0 + t, rot: Math.PI / 2 };
        return { x: x0 + block - inset, z: z0 + t, rot: -Math.PI / 2 };
      }
      case 'city':
      case 'park':
      case 'plaza': {
        const list = blocksOf(place);
        if (!list.length) return null;
        const b = pick(list);
        const { x0, z0 } = blockOrigin(layout, b.i, b.j);
        const m = Math.min(r + 2.4, block / 2 - 0.5);
        const x = x0 + m + rng() * (block - 2 * m);
        const z = z0 + m + rng() * (block - 2 * m);
        // buildings face the nearest block edge
        const dx = x - (x0 + block / 2);
        const dz = z - (z0 + block / 2);
        let rot: number;
        if (place === 'city' || r > 3) {
          rot = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : dz > 0 ? 0 : Math.PI;
        } else rot = rng() * Math.PI * 2;
        return { x, z, rot };
      }
      case 'any':
      default: {
        const x = -half + 2 + rng() * (size - 4);
        const z = -half + 2 + rng() * (size - 4);
        return { x, z, rot: rng() * Math.PI * 2 };
      }
    }
  };

  const order = map.kinds
    .map((k, idx) => ({ k, idx }))
    .sort((a, b) => {
      const la = a.k.place.includes('landmark') ? 1 : 0;
      const lb = b.k.place.includes('landmark') ? 1 : 0;
      if (la !== lb) return lb - la;
      return b.k.r - a.k.r;
    });

  for (const { k, idx } of order) {
    const gap = k.r > 3 ? 0.8 : k.r > 1 ? 0.35 : 0.12;
    let placed = 0;
    let attempts = 0;
    while (placed < k.count && attempts < k.count * 40) {
      attempts++;
      const place = pick(k.place);
      const c = candidate(place, k.r);
      if (!c) continue;
      if (Math.abs(c.x) > half - k.r * 0.5 - 1 || Math.abs(c.z) > half - k.r * 0.5 - 1) continue;
      if (place !== 'landmark' && !occ.fits(c.x, c.z, k.r, gap)) continue;
      // keep landmark blocks mostly clear for the landmark itself
      occ.add({ x: c.x, z: c.z, r: k.r });
      const rot = place === 'any' || place === 'road' || place === 'landmark' || k.r > 3 ? c.rot : c.rot + (rng() - 0.5) * 0.6;
      objects.push([idx, Math.round(c.x * 100) / 100, Math.round(c.z * 100) / 100, Math.round(rot * 1000) / 1000]);
      placed++;
    }
  }
  return { layout, objects };
}
