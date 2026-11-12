/** Non-interactive surroundings beyond the playable map: skyline / hills per world. */
import * as THREE from 'three';
import type { MapId } from '@shared/protocol';
import { mulberry32 } from '@shared/mapgen';

export function buildScenery(mapId: MapId, size: number) {
  const group = new THREE.Group();
  const rnd = mulberry32(99);
  const half = size / 2;
  const disposables: { dispose(): void }[] = [];
  const ring = (n: number, min: number, max: number, cb: (x: number, z: number, i: number) => void) => {
    for (let i = 0; i < n; i++) {
      const side = i % 4;
      const t = (rnd() - 0.5) * (size + max * 2);
      const d = half + min + rnd() * (max - min);
      const x = side === 0 ? t : side === 1 ? t : side === 2 ? -d : d;
      const z = side === 0 ? -d : side === 1 ? d : t;
      cb(x, z, i);
    }
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  if (mapId === 'bunny') {
    const hillGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const hillMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    const hills = new THREE.InstancedMesh(hillGeo, hillMat, 90);
    const cols = ['#8fdc7f', '#a7e897', '#7fcf72', '#b9f0a8', '#ffd1e8', '#d8c6ff'];
    ring(90, 24, 110, (x, z, i) => {
      const r = 10 + rnd() * 26;
      m4.compose(new THREE.Vector3(x, -0.5, z), q, new THREE.Vector3(r, r * (0.35 + rnd() * 0.4), r));
      hills.setMatrixAt(i, m4);
      hills.setColorAt(i, c.set(cols[i % 4 === 0 ? 4 + (i % 2) : i % 4]));
    });
    hills.receiveShadow = true;
    group.add(hills);
    disposables.push(hillGeo, hillMat);
  } else {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    // plain silhouettes: stretched window textures look wrong on non-uniformly scaled instances
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
    const n = 140;
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const cols = mapId === 'berlin' ? ['#b8b4ae', '#d9cdb6', '#9da3ab', '#c9b79c', '#8f949a'] : ['#ffb3d9', '#ffd1ea', '#ff8fd0', '#e9d6ff', '#fff0f7'];
    ring(n, 30, 110, (x, z, i) => {
      const w = 10 + rnd() * 16;
      const h = 8 + rnd() * (mapId === 'berlin' ? 30 : 34);
      m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(rnd() * 4) * (Math.PI / 2)), new THREE.Vector3(w, h, 8 + rnd() * 14));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.set(cols[i % cols.length]));
    });
    mesh.castShadow = false;
    group.add(mesh);
    disposables.push(geo, mat);
  }
  return { group, dispose: () => disposables.forEach((d) => d.dispose()) };
}
