/**
 * Procedural modelling kit. Every object in the game is built from code here:
 * primitives → grouped by material → merged into one geometry per kind (with
 * material groups) → rendered as a multi-material InstancedMesh.
 *
 * Convention: models are authored in "unit space" where the footprint fits a
 * circle of radius 1, base at y = 0. The world scales them by the kind's radius.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface MatSpec {
  color: string;
  rough?: number;
  metal?: number;
  emissive?: string;
  ei?: number; // emissive intensity
  map?: string; // texture key (see textures.ts)
  emap?: string; // emissive texture key
  opacity?: number;
  side?: 'double';
}

export interface Part {
  g: THREE.BufferGeometry;
  m: string;
}

interface Xf {
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

export class B {
  parts: Part[] = [];
  /** global offset/rotation applied to subsequent parts (for sub-assemblies) */
  private stack: THREE.Matrix4[] = [];

  push(x = 0, y = 0, z = 0, ry = 0, s = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));
    const top = this.stack[this.stack.length - 1];
    this.stack.push(top ? top.clone().multiply(m) : m);
    return this;
  }
  pop() {
    this.stack.pop();
    return this;
  }

  add(g: THREE.BufferGeometry, m: string, x: number, y: number, z: number, o: Xf = {}) {
    tmpE.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    tmpQ.setFromEuler(tmpE);
    tmpS.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    tmpP.set(x, y, z);
    tmpM.compose(tmpP, tmpQ, tmpS);
    g.applyMatrix4(tmpM);
    const top = this.stack[this.stack.length - 1];
    if (top) g.applyMatrix4(top);
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') ng.deleteAttribute(k);
    if (!ng.attributes.uv) {
      const n = ng.attributes.position.count;
      ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    this.parts.push({ g: ng, m });
    return this;
  }

  /** Box with its base at y. uvTile = [u, v] world units per texture repeat. */
  box(w: number, h: number, d: number, m: string, x = 0, y = 0, z = 0, o: Xf & { uv?: [number, number] } = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (o.uv) tileBoxUV(g, w, h, d, o.uv[0], o.uv[1]);
    return this.add(g, m, x, y + h / 2, z, o);
  }

  /** Rounded "pill" box via capsule-ish scaling of a sphere-capped cylinder */
  cyl(rt: number, rb: number, h: number, m: string, x = 0, y = 0, z = 0, seg = 12, o: Xf = {}) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1), m, x, y + h / 2, z, o);
  }
  /** Cylinder centered at (x,y,z) — useful for wheels / horizontal pieces */
  cylC(r: number, h: number, m: string, x = 0, y = 0, z = 0, seg = 12, o: Xf = {}) {
    return this.add(new THREE.CylinderGeometry(r, r, h, seg, 1), m, x, y, z, o);
  }
  sph(r: number, m: string, x = 0, y = 0, z = 0, o: Xf & { seg?: number; phi?: number } = {}) {
    const seg = o.seg ?? 12;
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7)), 0, Math.PI * 2, 0, o.phi ?? Math.PI);
    return this.add(g, m, x, y, z, o);
  }
  /** half sphere dome, base at y */
  dome(r: number, m: string, x = 0, y = 0, z = 0, o: Xf & { seg?: number } = {}) {
    return this.sph(r, m, x, y, z, { ...o, phi: Math.PI / 2 });
  }
  cone(r: number, h: number, m: string, x = 0, y = 0, z = 0, seg = 12, o: Xf = {}) {
    return this.add(new THREE.ConeGeometry(r, h, seg, 1), m, x, y + h / 2, z, o);
  }
  tor(R: number, t: number, m: string, x = 0, y = 0, z = 0, o: Xf & { seg?: number; arc?: number } = {}) {
    return this.add(new THREE.TorusGeometry(R, t, 8, o.seg ?? 20, o.arc ?? Math.PI * 2), m, x, y, z, o);
  }
  cap(r: number, len: number, m: string, x = 0, y = 0, z = 0, o: Xf = {}) {
    return this.add(new THREE.CapsuleGeometry(r, len, 4, 10), m, x, y, z, o);
  }
  plane(w: number, h: number, m: string, x = 0, y = 0, z = 0, o: Xf = {}) {
    return this.add(new THREE.PlaneGeometry(w, h), m, x, y, z, o);
  }
  lathe(pts: [number, number][], m: string, x = 0, y = 0, z = 0, seg = 14, o: Xf = {}) {
    return this.add(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), m, x, y, z, o);
  }
  ico(r: number, m: string, x = 0, y = 0, z = 0, detail = 0, o: Xf = {}) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), m, x, y, z, o);
  }
  oct(r: number, m: string, x = 0, y = 0, z = 0, o: Xf = {}) {
    return this.add(new THREE.OctahedronGeometry(r, 0), m, x, y, z, o);
  }
  dodec(r: number, m: string, x = 0, y = 0, z = 0, o: Xf = {}) {
    return this.add(new THREE.DodecahedronGeometry(r, 0), m, x, y, z, o);
  }
  heart(size: number, depth: number, m: string, x = 0, y = 0, z = 0, o: Xf = {}) {
    const s = new THREE.Shape();
    s.moveTo(0, -0.6);
    s.bezierCurveTo(-0.1, -0.45, -1, -0.1, -1, 0.35);
    s.bezierCurveTo(-1, 0.8, -0.45, 0.95, 0, 0.55);
    s.bezierCurveTo(0.45, 0.95, 1, 0.8, 1, 0.35);
    s.bezierCurveTo(1, -0.1, 0.1, -0.45, 0, -0.6);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -depth / 2);
    g.scale(size, size, size);
    return this.add(g, m, x, y, z, o);
  }
  star(size: number, depth: number, m: string, x = 0, y = 0, z = 0, o: Xf = {}) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 === 0 ? 1 : 0.45;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 });
    g.translate(0, 0, -depth / 2);
    g.scale(size, size, size);
    return this.add(g, m, x, y, z, o);
  }
  /** Generic gable roof prism (triangle cross-section along z), base at y */
  gable(w: number, h: number, d: number, m: string, x = 0, y = 0, z = 0, o: Xf = {}) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.lineTo(-w / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    return this.add(g, m, x, y, z, o);
  }

  // ---- composite helpers reused across maps ----
  wheel(m: string, x: number, y: number, z: number, r: number, w: number, hub = 'chrome') {
    this.cylC(r, w, m, x, y, z, 14, { rz: Math.PI / 2 });
    this.cylC(r * 0.55, w * 1.05, hub, x, y, z, 10, { rz: Math.PI / 2 });
    return this;
  }
  /** Simple stylised person: legs, torso, arms, head. Returns head top y. */
  person(o: { skin: string; top: string; legs: string; shoes?: string; hair?: string; h?: number }) {
    const h = o.h ?? 1.9;
    const s = h / 1.9;
    const shoes = o.shoes ?? 'black';
    this.box(0.16 * s, 0.1 * s, 0.26 * s, shoes, -0.12 * s, 0, 0.03 * s);
    this.box(0.16 * s, 0.1 * s, 0.26 * s, shoes, 0.12 * s, 0, 0.03 * s);
    this.cyl(0.08 * s, 0.07 * s, 0.75 * s, o.legs, -0.12 * s, 0.08 * s, 0, 8);
    this.cyl(0.08 * s, 0.07 * s, 0.75 * s, o.legs, 0.12 * s, 0.08 * s, 0, 8);
    this.cap(0.24 * s, 0.38 * s, o.top, 0, 1.12 * s, 0, { sz: 0.75 });
    this.cap(0.065 * s, 0.5 * s, o.top, -0.32 * s, 1.08 * s, 0, { rz: 0.18 });
    this.cap(0.065 * s, 0.5 * s, o.top, 0.32 * s, 1.08 * s, 0, { rz: -0.18 });
    this.sph(0.07 * s, o.skin, -0.37 * s, 0.8 * s, 0, { seg: 8 });
    this.sph(0.07 * s, o.skin, 0.37 * s, 0.8 * s, 0, { seg: 8 });
    this.cyl(0.07 * s, 0.08 * s, 0.1 * s, o.skin, 0, 1.45 * s, 0, 8);
    this.sph(0.2 * s, o.skin, 0, 1.68 * s, 0, { seg: 12 });
    if (o.hair) this.sph(0.215 * s, o.hair, 0, 1.72 * s, -0.02 * s, { seg: 12, phi: Math.PI * 0.55 });
    return 1.88 * s;
  }
}

/** Scale box UVs so textures tile at fixed world size per face */
function tileBoxUV(g: THREE.BoxGeometry, w: number, h: number, d: number, tu: number, tv: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // faces: +x, -x, +y, -y, +z, -z; 4 verts each
  const spans: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * (spans[f][0] / tu), uv.getY(i) * (spans[f][1] / tv));
    }
}

export interface BuiltKind {
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[];
  height: number;
}

/** Merge a builder's parts into a single grouped geometry, scaled to `scale`. */
export function finalize(b: B, scale: number, getMat: (key: string) => THREE.Material): BuiltKind {
  const byMat = new Map<string, THREE.BufferGeometry[]>();
  for (const p of b.parts) {
    let l = byMat.get(p.m);
    if (!l) byMat.set(p.m, (l = []));
    l.push(p.g);
  }
  const geos: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  for (const [key, list] of byMat) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (!merged) continue;
    geos.push(merged);
    materials.push(getMat(key));
  }
  const geometry = mergeGeometries(geos, true)!;
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  for (const g of geos) g.dispose();
  for (const p of b.parts) p.g.dispose();
  const height = geometry.boundingBox ? geometry.boundingBox.max.y : scale;
  return { geometry, materials, height };
}
