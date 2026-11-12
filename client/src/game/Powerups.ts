/** Floating power-up pickups: each kind has its own drawn 3D silhouette + light beam. */
import * as THREE from 'three';
import { POWERUPS, type PowerupKind } from '@shared/constants';
import type { PowerupSnap } from '@shared/protocol';

function iconGeometry(k: PowerupKind): THREE.BufferGeometry {
  switch (k) {
    case 'turbo': {
      const s = new THREE.Shape();
      s.moveTo(0.15, 1);
      s.lineTo(-0.5, -0.05);
      s.lineTo(-0.02, -0.05);
      s.lineTo(-0.2, -1);
      s.lineTo(0.5, 0.15);
      s.lineTo(0.05, 0.15);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 });
      g.center();
      return g;
    }
    case 'magnet': {
      const g = new THREE.TorusGeometry(0.55, 0.2, 10, 24, Math.PI);
      g.rotateZ(Math.PI);
      return g;
    }
    case 'shield': {
      const s = new THREE.Shape();
      s.moveTo(0, 1);
      s.quadraticCurveTo(0.5, 0.85, 0.75, 0.85);
      s.quadraticCurveTo(0.8, -0.3, 0, -1);
      s.quadraticCurveTo(-0.8, -0.3, -0.75, 0.85);
      s.quadraticCurveTo(-0.5, 0.85, 0, 1);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06 });
      g.center();
      return g;
    }
    case 'giant': {
      const g = new THREE.ConeGeometry(0.7, 1.4, 4);
      return g;
    }
    case 'slime':
    default:
      return new THREE.IcosahedronGeometry(0.7, 1);
  }
}

interface PuView {
  id: number;
  group: THREE.Group;
  icon: THREE.Mesh;
  born: number;
}

export class Powerups {
  group = new THREE.Group();
  private views = new Map<number, PuView>();
  private geos = new Map<PowerupKind, THREE.BufferGeometry>();
  private mats = new Map<PowerupKind, THREE.Material>();
  private beamMat = new Map<PowerupKind, THREE.Material>();
  private ringGeo = new THREE.TorusGeometry(1.1, 0.06, 6, 40);
  private beamGeo = new THREE.CylinderGeometry(0.35, 0.9, 18, 16, 1, true);
  private time = 0;

  constructor() {
    this.beamGeo.translate(0, 9, 0);
    this.ringGeo.rotateX(Math.PI / 2);
  }

  private get(k: PowerupKind) {
    if (!this.geos.has(k)) {
      this.geos.set(k, iconGeometry(k));
      const c = new THREE.Color(POWERUPS[k].color);
      this.mats.set(k, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.3 }));
      this.beamMat.set(k, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    }
    return { geo: this.geos.get(k)!, mat: this.mats.get(k)!, beam: this.beamMat.get(k)! };
  }

  sync(list: PowerupSnap[]) {
    const seen = new Set<number>();
    for (const p of list) {
      seen.add(p.id);
      if (this.views.has(p.id)) continue;
      const { geo, mat, beam } = this.get(p.k);
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      const icon = new THREE.Mesh(geo, mat);
      icon.castShadow = true;
      icon.scale.setScalar(1.3);
      g.add(icon);
      const ring = new THREE.Mesh(this.ringGeo, mat);
      ring.position.y = 0.1;
      g.add(ring);
      g.add(new THREE.Mesh(this.beamGeo, beam));
      this.group.add(g);
      this.views.set(p.id, { id: p.id, group: g, icon, born: this.time });
    }
    for (const [id, v] of this.views)
      if (!seen.has(id)) {
        this.group.remove(v.group);
        this.views.delete(id);
      }
  }

  update(dt: number) {
    this.time += dt;
    for (const v of this.views.values()) {
      const age = Math.min(1, (this.time - v.born) * 2);
      v.icon.position.y = 2 + Math.sin(this.time * 2.5 + v.id) * 0.4;
      v.icon.rotation.y = this.time * 2 + v.id;
      v.group.scale.setScalar(age);
    }
  }

  dispose() {
    for (const g of this.geos.values()) g.dispose();
    for (const m of this.mats.values()) m.dispose();
    for (const m of this.beamMat.values()) m.dispose();
    this.ringGeo.dispose();
    this.beamGeo.dispose();
  }
}
