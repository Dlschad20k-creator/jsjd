/**
 * World objects: one multi-material InstancedMesh per kind. Handles the swallow
 * animation (object slides to the hole centre and tumbles down the shaft), tipping
 * of objects hanging over a hole edge, creature idle animations and respawn pop-ins.
 */
import * as THREE from 'three';
import { FIT_RATIO } from '@shared/constants';
import { MAPS, type KindDef } from '@shared/maps';
import type { WorldInit } from '@shared/protocol';
import { B, finalize, type BuiltKind } from './assets/kit';
import { MaterialLib } from './assets/materials';
import type { Theme } from './themes';

interface KindRender {
  def: KindDef;
  built: BuiltKind;
  mesh: THREE.InstancedMesh;
  anim: KindDef['anim'];
  ids: number[];
}

export interface WObj {
  id: number;
  k: number;
  x: number;
  z: number;
  rot: number;
  r: number;
  slot: number;
  alive: boolean;
  tilt: number; // current tilt amount (0..1)
  pop: number; // respawn pop-in timer (0 = done)
  color: THREE.Color;
}

interface Falling {
  mesh: THREE.Mesh;
  obj: WObj;
  t: number;
  dur: number;
  hole: () => { x: number; z: number; R: number };
  sx: number;
  sz: number;
  axis: THREE.Vector3;
  spin: number;
}

export interface HoleView {
  x: number;
  z: number;
  R: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _axis = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const CELL = 8;
const MAX_FALLING = 70;

export class World {
  group = new THREE.Group();
  objects: WObj[] = [];
  kinds: KindRender[] = [];
  matLib: MaterialLib;
  private falling: Falling[] = [];
  private grid = new Map<number, number[]>();
  private gridW: number;
  private half: number;
  private tilted = new Set<number>();
  private time = 0;
  private dirtyKinds = new Set<number>();

  constructor(init: WorldInit, theme: Theme, shadows: boolean) {
    const map = MAPS[init.mapId];
    this.matLib = new MaterialLib(theme.mats);
    this.half = init.layout.size / 2;
    this.gridW = Math.ceil(init.layout.size / CELL) + 2;
    const dead = new Set(init.dead);
    const byKind: number[][] = map.kinds.map(() => []);
    init.objects.forEach(([k, x, z, rot], id) => {
      const r = map.kinds[k].r;
      const o: WObj = { id, k, x, z, rot, r, slot: byKind[k].length, alive: !dead.has(id), tilt: 0, pop: 0, color: new THREE.Color() };
      byKind[k].push(id);
      this.objects.push(o);
      const key = this.cellKey(x, z);
      let l = this.grid.get(key);
      if (!l) this.grid.set(key, (l = []));
      l.push(id);
    });

    map.kinds.forEach((def, k) => {
      const ids = byKind[k];
      const builder = theme.models[def.id];
      const b = new B();
      if (builder) builder(b);
      else b.box(1.2, 1.2, 1.2, 'pinkhot'); // should never happen: every kind has a model
      const built = finalize(b, def.r, this.matLib.get);
      const mesh = new THREE.InstancedMesh(built.geometry, built.materials, Math.max(1, ids.length));
      mesh.count = ids.length;
      mesh.castShadow = shadows && def.r >= 0.5;
      mesh.receiveShadow = shadows && def.r >= 1.2;
      mesh.instanceMatrix.setUsage(def.anim ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
      mesh.frustumCulled = false;
      this.kinds.push({ def, built, mesh, anim: def.anim, ids });
      // representative colour for particles = first material colour
      const c = (built.materials[0] as THREE.MeshStandardMaterial).color ?? new THREE.Color('#fff');
      for (const id of ids) {
        const o = this.objects[id];
        o.color.copy(c);
        this.writeMatrix(o, mesh);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    });
  }

  private cellKey(x: number, z: number) {
    return (Math.floor((z + this.half) / CELL) + 1) * this.gridW + Math.floor((x + this.half) / CELL) + 1;
  }

  near(x: number, z: number, radius: number, out: number[]) {
    out.length = 0;
    const reach = radius + 12;
    const c0x = Math.floor((x - reach + this.half) / CELL) + 1;
    const c1x = Math.floor((x + reach + this.half) / CELL) + 1;
    const c0z = Math.floor((z - reach + this.half) / CELL) + 1;
    const c1z = Math.floor((z + reach + this.half) / CELL) + 1;
    for (let cz = c0z; cz <= c1z; cz++)
      for (let cx = c0x; cx <= c1x; cx++) {
        const l = this.grid.get(cz * this.gridW + cx);
        if (l) for (const id of l) out.push(id);
      }
    return out;
  }

  private writeMatrix(o: WObj, mesh: THREE.InstancedMesh, extra?: (pos: THREE.Vector3, q: THREE.Quaternion, s: THREE.Vector3) => void) {
    if (!o.alive) {
      _m.makeScale(0, 0, 0);
      mesh.setMatrixAt(o.slot, _m);
      return;
    }
    _p.set(o.x, 0, o.z);
    _q.setFromAxisAngle(UP, o.rot);
    _s.set(1, 1, 1);
    if (o.pop > 0) {
      const t = 1 - o.pop / 0.6;
      const e = t < 1 ? 1 + Math.sin(t * Math.PI * 1.5) * (1 - t) * 0.4 - (1 - t) * (1 - t) : 1;
      _s.setScalar(Math.max(0.001, Math.min(1.25, e)));
    }
    if (extra) extra(_p, _q, _s);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(o.slot, _m);
  }

  /** Start the swallow animation for an object. */
  swallow(id: number, hole: () => HoleView) {
    const o = this.objects[id];
    if (!o || !o.alive) return o;
    o.alive = false;
    o.tilt = 0;
    this.tilted.delete(id);
    const kr = this.kinds[o.k];
    this.writeMatrix(o, kr.mesh);
    this.dirtyKinds.add(o.k);
    if (this.falling.length < MAX_FALLING) {
      const mesh = new THREE.Mesh(kr.built.geometry, kr.built.materials);
      mesh.position.set(o.x, 0, o.z);
      mesh.quaternion.setFromAxisAngle(UP, o.rot);
      const h = hole();
      const dx = h.x - o.x;
      const dz = h.z - o.z;
      const axis = new THREE.Vector3(dz, 0, -dx).normalize();
      if (!Number.isFinite(axis.x)) axis.set(1, 0, 0);
      this.group.add(mesh);
      this.falling.push({ mesh, obj: o, t: 0, dur: 0.55 + Math.min(1.1, o.r * 0.12), hole, sx: o.x, sz: o.z, axis, spin: (Math.random() - 0.5) * 6 });
    }
    return o;
  }

  respawn(id: number) {
    const o = this.objects[id];
    if (!o || o.alive) return;
    o.alive = true;
    o.pop = 0.6;
    this.dirtyKinds.add(o.k);
  }

  update(dt: number, holes: HoleView[], cam: THREE.Vector3) {
    this.time += dt;
    // falling animations
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.t += dt;
      const t = Math.min(1, f.t / f.dur);
      const h = f.hole();
      const pull = Math.min(1, t * 1.6);
      const e = pull * pull * (3 - 2 * pull);
      const x = f.sx + (h.x - f.sx) * e;
      const z = f.sz + (h.z - f.sz) * e;
      const depth = (f.obj.r * 2.4 + 2) * t * t * 1.6;
      f.mesh.position.set(x, -depth, z);
      _q2.setFromAxisAngle(f.axis, t * t * 2.2);
      _q.setFromAxisAngle(UP, f.obj.rot + f.spin * t);
      f.mesh.quaternion.multiplyQuaternions(_q2, _q);
      // shrink into the singularity near the end
      const s = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
      f.mesh.scale.setScalar(Math.max(0.01, s));
      if (t >= 1) {
        this.group.remove(f.mesh);
        this.falling.splice(i, 1);
      }
    }

    // tipping: objects overlapping a hole edge lean into it
    const touched = new Set<number>();
    const scratch: number[] = [];
    for (const h of holes) {
      if (h.R <= 0.05) continue;
      for (const id of this.near(h.x, h.z, h.R, scratch)) {
        const o = this.objects[id];
        if (!o.alive) continue;
        const d = Math.hypot(o.x - h.x, o.z - h.z);
        const overlap = h.R + o.r * 0.6 - d;
        if (overlap <= 0) continue;
        const fits = o.r <= h.R * FIT_RATIO;
        const amt = Math.min(1, overlap / (o.r + 0.5)) * (fits ? 1 : 0.45);
        touched.add(id);
        if (Math.abs(amt - o.tilt) > 0.01) {
          o.tilt = amt;
          const dx = (h.x - o.x) / (d || 1);
          const dz = (h.z - o.z) / (d || 1);
          const wob = Math.sin(this.time * 22 + id) * 0.06;
          this.writeMatrix(o, this.kinds[o.k].mesh, (pos, q) => {
            _axis.set(dz, 0, -dx).normalize();
            _q2.setFromAxisAngle(_axis, (amt * 0.55 + wob * amt) * (fits ? 1.2 : 0.7));
            q.premultiply(_q2);
            pos.x += dx * amt * o.r * 0.3;
            pos.z += dz * amt * o.r * 0.3;
            pos.y -= amt * o.r * 0.35;
          });
          this.dirtyKinds.add(o.k);
        }
      }
    }
    for (const id of this.tilted) {
      if (touched.has(id)) continue;
      const o = this.objects[id];
      o.tilt = 0;
      this.writeMatrix(o, this.kinds[o.k].mesh);
      this.dirtyKinds.add(o.k);
    }
    this.tilted = touched;

    // creature animations + pop-ins
    for (let k = 0; k < this.kinds.length; k++) {
      const kr = this.kinds[k];
      if (!kr.anim) continue;
      for (const id of kr.ids) {
        const o = this.objects[id];
        if (!o.alive || o.tilt > 0) continue;
        const dxc = o.x - cam.x;
        const dzc = o.z - cam.z;
        if (dxc * dxc + dzc * dzc > 140 * 140) continue;
        const ph = id * 1.7;
        this.writeMatrix(o, kr.mesh, (pos, q, s) => {
          switch (kr.anim) {
            case 'hop':
              pos.y += Math.abs(Math.sin(this.time * 5 + ph)) * o.r * 0.35;
              s.y *= 1 + Math.sin(this.time * 10 + ph) * 0.05;
              break;
            case 'bob':
              pos.y += Math.abs(Math.sin(this.time * 3 + ph)) * o.r * 0.06;
              _q2.setFromAxisAngle(UP, Math.sin(this.time * 0.8 + ph) * 0.6);
              q.multiply(_q2);
              break;
            case 'spin':
              _q2.setFromAxisAngle(UP, this.time * 1.5);
              q.multiply(_q2);
              break;
            case 'sway':
              _axis.set(1, 0, 0);
              _q2.setFromAxisAngle(_axis, Math.sin(this.time * 2 + ph) * 0.15);
              q.multiply(_q2);
              break;
          }
          if (kr.def.id === 'hot_air_balloon' || kr.def.id === 'balloon') pos.y += Math.sin(this.time * 1.2 + ph) * o.r * 0.25 + o.r * 0.25;
        });
        this.dirtyKinds.add(k);
      }
    }
    for (const o of this.objects) {
      if (o.pop <= 0) continue;
      o.pop = Math.max(0, o.pop - dt);
      if (!this.kinds[o.k].anim) this.writeMatrix(o, this.kinds[o.k].mesh);
      this.dirtyKinds.add(o.k);
    }
    for (const k of this.dirtyKinds) this.kinds[k].mesh.instanceMatrix.needsUpdate = true;
    this.dirtyKinds.clear();
  }

  dispose() {
    for (const f of this.falling) this.group.remove(f.mesh);
    for (const k of this.kinds) {
      k.mesh.dispose();
      k.built.geometry.dispose();
    }
    this.matLib.dispose();
  }
}
