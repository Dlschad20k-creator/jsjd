/**
 * Ground: a canvas-painted city plan (roads, sidewalks, parks, plazas) on one plane
 * whose shader discards fragments inside the holes, so swallowed objects visibly
 * fall *through* the ground into the hole shaft below.
 */
import * as THREE from 'three';
import type { Layout, MapId } from '@shared/protocol';
import { blockOrigin, mulberry32, roadCenter } from '@shared/mapgen';
import type { Theme } from './themes';
import { noise } from './assets/textures';

export const MAX_HOLES = 2;

export interface HoleUniforms {
  uHoles: { value: THREE.Vector4[] }; // x, z, radius, unused
}

export function createHoleUniforms(): HoleUniforms {
  return { uHoles: { value: Array.from({ length: MAX_HOLES }, () => new THREE.Vector4(9999, 9999, 0, 0)) } };
}

/** Patch a standard material so it discards fragments inside hole circles. */
export function patchHoleDiscard(mat: THREE.MeshStandardMaterial, uniforms: HoleUniforms) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHoles = uniforms.uHoles;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosH;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPosH = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldPosH;
uniform vec4 uHoles[${MAX_HOLES}];`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
for (int i = 0; i < ${MAX_HOLES}; i++) {
  // discard ground inside each hole's radius
  if (distance(vWorldPosH.xz, uHoles[i].xy) < uHoles[i].z) discard;
}`,
      );
  };
  mat.customProgramCacheKey = () => 'hole-discard';
}

function drawGround(layout: Layout, theme: Theme, mapId: MapId, px: number) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  const k = px / layout.size;
  const half = layout.size / 2;
  const X = (x: number) => (x + half) * k;
  const g = theme.ground;
  const rnd = mulberry32(1337);

  // asphalt base
  ctx.fillStyle = g.road;
  ctx.fillRect(0, 0, px, px);
  noise(ctx, px, px, rnd, 0.07, px * 6);

  // lane markings
  ctx.strokeStyle = g.roadLine;
  ctx.lineWidth = Math.max(1, 0.25 * k);
  ctx.setLineDash([2.2 * k, 2.2 * k]);
  for (let i = 0; i <= layout.n; i++) {
    const c0 = X(roadCenter(layout, i));
    ctx.beginPath();
    ctx.moveTo(c0, 0);
    ctx.lineTo(c0, px);
    ctx.moveTo(0, c0);
    ctx.lineTo(px, c0);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (let j = 0; j < layout.n; j++)
    for (let i = 0; i < layout.n; i++) {
      const type = layout.blocks[j * layout.n + i];
      const { x0, z0 } = blockOrigin(layout, i, j);
      const bx = X(x0);
      const bz = X(z0);
      const bs = layout.block * k;
      // curb + sidewalk ring
      ctx.fillStyle = g.curb;
      ctx.fillRect(bx - 0.35 * k, bz - 0.35 * k, bs + 0.7 * k, bs + 0.7 * k);
      ctx.fillStyle = g.sidewalk;
      ctx.fillRect(bx, bz, bs, bs);
      // paving tiles
      ctx.strokeStyle = 'rgba(0,0,0,0.07)';
      ctx.lineWidth = 1;
      for (let t = 0; t <= layout.block; t += 1.5) {
        ctx.beginPath();
        ctx.moveTo(bx + t * k, bz);
        ctx.lineTo(bx + t * k, bz + 2.6 * k);
        ctx.moveTo(bx + t * k, bz + bs - 2.6 * k);
        ctx.lineTo(bx + t * k, bz + bs);
        ctx.moveTo(bx, bz + t * k);
        ctx.lineTo(bx + 2.6 * k, bz + t * k);
        ctx.moveTo(bx + bs - 2.6 * k, bz + t * k);
        ctx.lineTo(bx + bs, bz + t * k);
        ctx.stroke();
      }
      const inset = 2.6 * k;
      const ix = bx + inset;
      const iz = bz + inset;
      const is = bs - inset * 2;
      if (type === 'park') {
        ctx.fillStyle = g.grass;
        roundRect(ctx, ix, iz, is, is, 3 * k);
        ctx.fill();
        for (let s = 0; s < 260; s++) {
          ctx.fillStyle = rnd() < 0.5 ? g.grass2 : 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.arc(ix + rnd() * is, iz + rnd() * is, (0.3 + rnd() * 1.4) * k, 0, Math.PI * 2);
          ctx.fill();
        }
        // winding path
        ctx.strokeStyle = g.plaza;
        ctx.lineWidth = 2.2 * k;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ix, iz + is * 0.3);
        ctx.bezierCurveTo(ix + is * 0.4, iz + is * 0.1, ix + is * 0.6, iz + is * 0.9, ix + is, iz + is * 0.7);
        ctx.stroke();
        if (mapId !== 'berlin') {
          // pond
          ctx.fillStyle = mapId === 'pink' ? '#9fe3ff' : '#b9e8ff';
          ctx.beginPath();
          ctx.ellipse(ix + is * 0.7, iz + is * 0.28, 4 * k, 2.6 * k, 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#4f7b8f';
          ctx.beginPath();
          ctx.ellipse(ix + is * 0.25, iz + is * 0.72, 3.5 * k, 2 * k, -0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'plaza' || type === 'landmark') {
        ctx.fillStyle = g.plaza;
        ctx.fillRect(ix, iz, is, is);
        const tile = 3 * k;
        for (let ty = 0; ty < is / tile; ty++)
          for (let tx = 0; tx < is / tile; tx++)
            if ((tx + ty) % 2 === 0) {
              ctx.fillStyle = g.plaza2;
              ctx.globalAlpha = 0.5;
              ctx.fillRect(ix + tx * tile, iz + ty * tile, tile, tile);
              ctx.globalAlpha = 1;
            }
        if (type === 'landmark') {
          ctx.strokeStyle = g.curb;
          ctx.lineWidth = 0.6 * k;
          ctx.beginPath();
          ctx.arc(bx + bs / 2, bz + bs / 2, 15 * k, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(bx + bs / 2, bz + bs / 2, 13.5 * k, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // city block: courtyard lawn + paths
        ctx.fillStyle = mapId === 'berlin' ? '#7d776c' : g.plaza2;
        ctx.fillRect(ix, iz, is, is);
        ctx.fillStyle = g.grass2;
        ctx.globalAlpha = 0.6;
        roundRect(ctx, ix + is * 0.3, iz + is * 0.3, is * 0.4, is * 0.4, 2 * k);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

  // crosswalks at intersections
  ctx.fillStyle = g.crosswalk;
  for (let i = 0; i <= layout.n; i++)
    for (let j = 0; j <= layout.n; j++) {
      const cx = roadCenter(layout, i);
      const cz = roadCenter(layout, j);
      for (let s = -3; s <= 3; s++) {
        ctx.fillRect(X(cx + s * 1.1) - 0.3 * k, X(cz - layout.road / 2 - 2.2), 0.6 * k, 1.8 * k);
        ctx.fillRect(X(cx + s * 1.1) - 0.3 * k, X(cz + layout.road / 2 + 0.4), 0.6 * k, 1.8 * k);
      }
    }

  if (mapId === 'berlin') {
    // U-Bahn tracks along one avenue
    const tz = X(roadCenter(layout, 2));
    ctx.strokeStyle = '#8a8d94';
    ctx.lineWidth = 0.25 * k;
    for (const off of [-1.1, 1.1]) {
      ctx.beginPath();
      ctx.moveTo(0, tz + off * k);
      ctx.lineTo(px, tz + off * k);
      ctx.stroke();
    }
    // graffiti tags + chewing gum stains on sidewalks
    for (let s = 0; s < 900; s++) {
      ctx.fillStyle = `rgba(40,40,40,${0.1 + rnd() * 0.15})`;
      ctx.beginPath();
      ctx.arc(rnd() * px, rnd() * px, (0.1 + rnd() * 0.2) * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (mapId === 'pink') {
    // little painted hearts on sidewalks
    for (let s = 0; s < 260; s++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,79,184,0.35)' : 'rgba(255,255,255,0.6)';
      const x = rnd() * px;
      const y = rnd() * px;
      const r = (0.35 + rnd() * 0.4) * k;
      ctx.beginPath();
      ctx.arc(x - r * 0.5, y, r * 0.55, 0, Math.PI * 2);
      ctx.arc(x + r * 0.5, y, r * 0.55, 0, Math.PI * 2);
      ctx.moveTo(x - r, y + r * 0.1);
      ctx.lineTo(x, y + r * 1.2);
      ctx.lineTo(x + r, y + r * 0.1);
      ctx.fill();
    }
  }
  if (mapId === 'bunny') {
    for (let s = 0; s < 500; s++) {
      ctx.fillStyle = ['#ffd1e8', '#fff3a3', '#ffffff', '#d8c6ff'][s % 4];
      ctx.beginPath();
      ctx.arc(rnd() * px, rnd() * px, (0.12 + rnd() * 0.2) * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // map border
  ctx.strokeStyle = g.curb;
  ctx.lineWidth = 0.8 * k;
  ctx.strokeRect(0.4 * k, 0.4 * k, px - 0.8 * k, px - 0.8 * k);
  return c;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function buildGround(layout: Layout, theme: Theme, mapId: MapId, uniforms: HoleUniforms, quality: 'high' | 'low', aniso: number) {
  const group = new THREE.Group();
  // 3072 stays below iOS Safari's 16.7 MP canvas limit
  const canvas = drawGround(layout, theme, mapId, quality === 'high' ? 4096 : 3072);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 });
  patchHoleDiscard(mat, uniforms);
  const geo = new THREE.PlaneGeometry(layout.size, layout.size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  group.add(ground);

  // outer surroundings (beyond the playable map)
  const outerMat = new THREE.MeshStandardMaterial({ color: theme.ground.outside, roughness: 1 });
  patchHoleDiscard(outerMat, uniforms);
  const outerSize = layout.size * 5;
  const ring = new THREE.Shape();
  ring.moveTo(-outerSize / 2, -outerSize / 2);
  ring.lineTo(outerSize / 2, -outerSize / 2);
  ring.lineTo(outerSize / 2, outerSize / 2);
  ring.lineTo(-outerSize / 2, outerSize / 2);
  const holePath = new THREE.Path();
  const h = layout.size / 2;
  holePath.moveTo(-h, -h);
  holePath.lineTo(-h, h);
  holePath.lineTo(h, h);
  holePath.lineTo(h, -h);
  ring.holes.push(holePath);
  const outerGeo = new THREE.ShapeGeometry(ring);
  outerGeo.rotateX(-Math.PI / 2);
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  group.add(outer);

  // low border wall so the edge reads clearly
  const wallMat = new THREE.MeshStandardMaterial({ color: theme.ground.curb, roughness: 0.6 });
  patchHoleDiscard(wallMat, uniforms);
  const wallH = 0.6;
  for (let s = 0; s < 4; s++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(layout.size + 1.2, wallH, 0.6), wallMat);
    const a = (s * Math.PI) / 2;
    w.position.set(Math.sin(a) * (h + 0.3), wallH / 2, Math.cos(a) * (h + 0.3));
    w.rotation.y = a;
    w.castShadow = true;
    w.receiveShadow = true;
    group.add(w);
  }
  return { group, dispose: () => { tex.dispose(); mat.dispose(); outerMat.dispose(); wallMat.dispose(); geo.dispose(); outerGeo.dispose(); } };
}
