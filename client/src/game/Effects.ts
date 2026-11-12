/** Particle bursts, shockwave rings and ambient atmosphere particles. */
import * as THREE from 'three';
import type { Theme } from './themes';

const pointVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
uniform float uScale;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const pointFrag = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
uniform float uShape; // 0 = soft glow, 1 = solid chunk
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float soft = smoothstep(0.5, 0.0, d);
  float solid = step(d, 0.42);
  float a = mix(soft, solid, uShape) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

class ParticlePool {
  points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseSize: Float32Array;
  private target: (null | (() => { x: number; z: number }))[];
  private next = 0;
  private n: number;
  private geo: THREE.BufferGeometry;
  gravity: number;

  constructor(n: number, additive: boolean, solid: boolean, gravity: number) {
    this.n = n;
    this.gravity = gravity;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.baseSize = new Float32Array(n);
    this.target = new Array(n).fill(null);
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -999;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: pointVert,
      fragmentShader: pointFrag,
      uniforms: { uScale: { value: 300 }, uShape: { value: solid ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }

  setScale(s: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = s;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color, size: number, life: number, target: null | (() => { x: number; z: number }) = null) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r;
    this.col[i * 3 + 1] = color.g;
    this.col[i * 3 + 2] = color.b;
    this.baseSize[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.target[i] = target;
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          this.pos[i * 3 + 1] = -999;
        }
        continue;
      }
      this.life[i] -= dt;
      const t = this.life[i] / this.maxLife[i];
      const tg = this.target[i];
      if (tg) {
        // spiral into the hole
        const h = tg();
        const dx = h.x - this.pos[i * 3];
        const dz = h.z - this.pos[i * 3 + 2];
        this.vel[i * 3] += (dx * 8 - dz * 4) * dt;
        this.vel[i * 3 + 2] += (dz * 8 + dx * 4) * dt;
        this.vel[i * 3] *= 1 - dt * 3;
        this.vel[i * 3 + 2] *= 1 - dt * 3;
      }
      this.vel[i * 3 + 1] -= this.gravity * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.min(1, t * 2.5);
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * t);
    }
    for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) (this.geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

interface Ring {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  maxR: number;
}

export class Effects {
  group = new THREE.Group();
  private sparks: ParticlePool;
  private debris: ParticlePool;
  private ambient: THREE.Points;
  private ambientPos: Float32Array;
  private ambientVel: Float32Array;
  private rings: Ring[] = [];
  private ringGeo = new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2);
  private tmpC = new THREE.Color();
  private theme: Theme;
  private time = 0;

  constructor(theme: Theme, lowPower: boolean) {
    this.theme = theme;
    this.sparks = new ParticlePool(lowPower ? 350 : 800, true, false, 4);
    this.debris = new ParticlePool(lowPower ? 250 : 600, false, true, 0);
    this.group.add(this.sparks.points, this.debris.points);
    const n = lowPower ? 90 : 200;
    this.ambientPos = new Float32Array(n * 3);
    this.ambientVel = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const alpha = new Float32Array(n);
    const c1 = new THREE.Color(theme.particles.color);
    const c2 = new THREE.Color(theme.particles.color2);
    for (let i = 0; i < n; i++) {
      this.ambientPos[i * 3] = (Math.random() - 0.5) * 160;
      this.ambientPos[i * 3 + 1] = Math.random() * 30;
      this.ambientPos[i * 3 + 2] = (Math.random() - 0.5) * 160;
      this.ambientVel[i * 3] = (Math.random() - 0.5) * 1.5;
      this.ambientVel[i * 3 + 1] = theme.particles.kind === 'petal' ? -0.6 - Math.random() : 0.3 + Math.random() * 0.6;
      this.ambientVel[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      const c = Math.random() < 0.5 ? c1 : c2;
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = theme.particles.kind === 'petal' ? 0.5 + Math.random() * 0.5 : 0.3 + Math.random() * 0.5;
      alpha[i] = 0.35 + Math.random() * 0.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.ambientPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    this.ambient = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        vertexShader: pointVert,
        fragmentShader: pointFrag,
        uniforms: { uScale: { value: 300 }, uShape: { value: theme.particles.kind === 'petal' ? 1 : 0 } },
        transparent: true,
        depthWrite: false,
        blending: theme.particles.kind === 'petal' ? THREE.NormalBlending : THREE.AdditiveBlending,
      }),
    );
    this.ambient.frustumCulled = false;
    this.group.add(this.ambient);
  }

  setViewport(h: number) {
    const s = h * 0.9;
    this.sparks.setScale(s);
    this.debris.setScale(s);
    (this.ambient.material as THREE.ShaderMaterial).uniforms.uScale.value = s;
  }

  /** Debris swirling into the hole + sparkles when something is swallowed. */
  eatBurst(x: number, z: number, r: number, color: THREE.Color, holeColor: THREE.Color, hole: () => { x: number; z: number }) {
    const n = Math.min(28, 5 + Math.round(r * 5));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4 + r;
      this.debris.emit(x + Math.cos(a) * r * 0.5, 0.2 + Math.random() * r, z + Math.sin(a) * r * 0.5, Math.cos(a) * sp, -1 - Math.random() * 2, Math.sin(a) * sp, color, 0.25 + Math.random() * 0.35 + r * 0.1, 0.5 + Math.random() * 0.4, hole);
    }
    const m = Math.min(24, 4 + Math.round(r * 4));
    for (let i = 0; i < m; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 5;
      this.tmpC.copy(Math.random() < 0.5 ? holeColor : color).lerp(new THREE.Color('#ffffff'), 0.4);
      this.sparks.emit(x, 0.3 + Math.random() * r, z, Math.cos(a) * sp, 3 + Math.random() * 6, Math.sin(a) * sp, this.tmpC, 0.5 + Math.random() * 0.6 + r * 0.08, 0.5 + Math.random() * 0.5);
    }
  }

  burst(x: number, y: number, z: number, color: THREE.Color, count: number, speed: number, size = 0.8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.5;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.sparks.emit(x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 2, Math.sin(a) * Math.cos(e) * sp, color, size * (0.6 + Math.random() * 0.8), 0.7 + Math.random() * 0.6);
    }
  }

  trail(x: number, z: number, R: number, color: THREE.Color) {
    const a = Math.random() * Math.PI * 2;
    this.sparks.emit(x + Math.cos(a) * R, 0.2, z + Math.sin(a) * R, 0, 1 + Math.random(), 0, color, 0.6 + R * 0.1, 0.5);
  }

  ring(x: number, z: number, maxR: number, color: THREE.Color, dur = 0.7) {
    const mat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(x, 0.15, z);
    mesh.scale.setScalar(0.1);
    this.group.add(mesh);
    this.rings.push({ mesh, t: 0, dur, maxR });
  }

  update(dt: number, focus: THREE.Vector3) {
    this.time += dt;
    this.sparks.update(dt);
    this.debris.update(dt);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const t = Math.min(1, r.t / r.dur);
      r.mesh.scale.setScalar(0.1 + (1 - Math.pow(1 - t, 3)) * r.maxR);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      if (t >= 1) {
        this.group.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
    // ambient particles wrap around the camera focus
    const p = this.ambientPos;
    const n = p.length / 3;
    const span = 160;
    for (let i = 0; i < n; i++) {
      p[i * 3] += (this.ambientVel[i * 3] + Math.sin(this.time + i) * 0.5) * dt;
      p[i * 3 + 1] += this.ambientVel[i * 3 + 1] * dt;
      p[i * 3 + 2] += this.ambientVel[i * 3 + 2] * dt;
      let dx = p[i * 3] - focus.x;
      let dz = p[i * 3 + 2] - focus.z;
      if (dx > span / 2) p[i * 3] -= span;
      if (dx < -span / 2) p[i * 3] += span;
      if (dz > span / 2) p[i * 3 + 2] -= span;
      if (dz < -span / 2) p[i * 3 + 2] += span;
      if (p[i * 3 + 1] > 32) p[i * 3 + 1] = 0.5;
      if (p[i * 3 + 1] < 0.2) p[i * 3 + 1] = 30;
      dx = dz = 0;
    }
    (this.ambient.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.sparks.dispose();
    this.debris.dispose();
    this.ambient.geometry.dispose();
    (this.ambient.material as THREE.Material).dispose();
    this.ringGeo.dispose();
  }
}
