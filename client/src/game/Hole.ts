/**
 * Visual black hole: open shaft below ground (gradient walls), a rotating accretion
 * swirl, glowing rim in the player's colour and power-up auras.
 * Target: forward renderer, mobile-friendly (mediump, no texture loops).
 */
import * as THREE from 'three';

const SHAFT_DEPTH = 60;

const shaftVert = /* glsl */ `
varying float vDepth;
void main() {
  vDepth = -position.y; // 0 at top, grows downward
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const shaftFrag = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform float uScale;
varying float vDepth;
void main() {
  // walls glow faintly in player colour near the rim, fading into the void
  float d = vDepth * uScale;
  float glow = exp(-d * 0.9) * 0.9;
  vec3 col = mix(vec3(0.015, 0.0, 0.03), uColor * 0.9, glow);
  gl_FragColor = vec4(col, 1.0);
}`;

const swirlFrag = /* glsl */ `
precision mediump float;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  // logarithmic spiral arms rotating over time
  float arms = sin(a * 3.0 + log(r + 0.05) * 7.0 + uTime * 3.0);
  float band = smoothstep(0.2, 1.0, arms) * smoothstep(1.0, 0.35, r) * smoothstep(0.02, 0.3, r);
  float core = smoothstep(0.35, 0.0, r);
  vec3 col = uColor * band * 0.85;
  float alpha = band * 0.75 * (1.0 - core);
  gl_FragColor = vec4(col, alpha);
}`;

const glowFrag = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform float uPulse;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  // ring from r=0.66 (hole edge) outward, soft falloff
  float edge = 0.666;
  float g = smoothstep(1.0, edge, r) * step(edge, r);
  g = pow(g, 2.2) * (0.55 + 0.45 * uPulse);
  gl_FragColor = vec4(uColor * 1.6, g);
}`;

const simpleVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const shieldFrag = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
  float hex = 0.5 + 0.5 * sin(uTime * 4.0 + vV.y * 2.0);
  gl_FragColor = vec4(uColor * (1.2 + hex * 0.5), f * 0.85 + 0.05);
}`;
const shieldVert = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

export class HoleView {
  group = new THREE.Group();
  R = 0.01;
  x = 0;
  z = 0;
  visible = true;
  color: THREE.Color;
  private shaft: THREE.Mesh;
  private shaftMat: THREE.ShaderMaterial;
  private swirl: THREE.Mesh;
  private swirlMat: THREE.ShaderMaterial;
  private rim: THREE.Mesh;
  private rimMat: THREE.MeshBasicMaterial;
  private glow: THREE.Mesh;
  private glowMat: THREE.ShaderMaterial;
  private shield: THREE.Mesh;
  private shieldMat: THREE.ShaderMaterial;
  private magnet: THREE.Mesh;
  private time = Math.random() * 10;

  constructor(color: string) {
    this.color = new THREE.Color(color);
    this.shaftMat = new THREE.ShaderMaterial({
      vertexShader: shaftVert,
      fragmentShader: shaftFrag,
      uniforms: { uColor: { value: this.color.clone() }, uScale: { value: 1 } },
      side: THREE.BackSide,
    });
    const shaftGeo = new THREE.CylinderGeometry(1, 1, SHAFT_DEPTH, 48, 1, true);
    shaftGeo.translate(0, -SHAFT_DEPTH / 2, 0);
    this.shaft = new THREE.Mesh(shaftGeo, this.shaftMat);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    bottom.position.y = -SHAFT_DEPTH + 0.1;
    this.shaft.add(bottom);
    this.group.add(this.shaft);

    this.swirlMat = new THREE.ShaderMaterial({
      vertexShader: simpleVert,
      fragmentShader: swirlFrag,
      uniforms: { uTime: { value: 0 }, uColor: { value: this.color.clone() } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.swirl = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.swirlMat);
    this.swirl.position.y = -0.6;
    this.group.add(this.swirl);

    this.rimMat = new THREE.MeshBasicMaterial({ color: this.color.clone().multiplyScalar(2.2), toneMapped: false });
    this.rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.06, 72).rotateX(-Math.PI / 2), this.rimMat);
    this.rim.position.y = 0.04;
    this.group.add(this.rim);

    this.glowMat = new THREE.ShaderMaterial({
      vertexShader: simpleVert,
      fragmentShader: glowFrag,
      uniforms: { uColor: { value: this.color.clone() }, uPulse: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.glowMat);
    this.glow.position.y = 0.03;
    this.group.add(this.glow);

    this.shieldMat = new THREE.ShaderMaterial({
      vertexShader: shieldVert,
      fragmentShader: shieldFrag,
      uniforms: { uColor: { value: new THREE.Color('#7dff8a') }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.15, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), this.shieldMat);
    this.shield.visible = false;
    this.group.add(this.shield);

    const magGeo = new THREE.TorusGeometry(1.6, 0.04, 6, 64);
    magGeo.rotateX(Math.PI / 2);
    this.magnet = new THREE.Mesh(magGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#3fd0ff').multiplyScalar(2), transparent: true, opacity: 0.7, toneMapped: false }));
    this.magnet.position.y = 0.15;
    this.magnet.visible = false;
    this.group.add(this.magnet);
  }

  setColor(c: string) {
    this.color.set(c);
    this.shaftMat.uniforms.uColor.value.copy(this.color);
    this.swirlMat.uniforms.uColor.value.copy(this.color);
    this.glowMat.uniforms.uColor.value.copy(this.color);
    this.rimMat.color.copy(this.color).multiplyScalar(2.2);
  }

  update(dt: number, o: { x: number; z: number; R: number; fx: Record<string, number | undefined>; prot: number; dash: number; dead: boolean; reach: number }) {
    this.time += dt;
    this.x = o.x;
    this.z = o.z;
    const targetR = o.dead ? 0 : o.R;
    this.R += (targetR - this.R) * Math.min(1, dt * (o.dead ? 14 : 6));
    const R = Math.max(0.001, this.R);
    this.group.visible = R > 0.02;
    this.group.position.set(o.x, 0, o.z);
    this.shaft.scale.set(R, 1, R);
    this.shaftMat.uniforms.uScale.value = 1 / Math.max(0.5, R);
    this.swirl.scale.setScalar(R * 0.99);
    this.swirlMat.uniforms.uTime.value = this.time * (o.dash > 0 ? 3 : 1);
    this.rim.scale.setScalar(R);
    const glowSize = R * 1.5 * (o.fx.giant ? 1.25 : 1);
    this.glow.scale.setScalar(glowSize);
    const blink = o.prot > 0 ? (Math.sin(this.time * 18) > 0 ? 1 : 0.15) : 1;
    this.glowMat.uniforms.uPulse.value = (0.5 + 0.5 * Math.sin(this.time * 4)) * blink;
    this.rimMat.opacity = blink;
    this.rim.visible = blink > 0.5;
    const slime = !!o.fx.slime;
    const rimColor = slime ? new THREE.Color('#a6ff00') : o.fx.giant ? new THREE.Color('#ff4fd8') : o.fx.turbo ? new THREE.Color('#ffd23f') : this.color;
    this.rimMat.color.copy(rimColor).multiplyScalar(2.2);
    this.shield.visible = !!o.fx.shield;
    if (this.shield.visible) {
      this.shield.scale.setScalar(R);
      this.shieldMat.uniforms.uTime.value = this.time;
    }
    this.magnet.visible = !!o.fx.magnet || o.reach > 0;
    if (this.magnet.visible) {
      const reach = 1 + o.reach + (o.fx.magnet ? 0.6 : 0);
      this.magnet.scale.setScalar(R * reach / 1.6);
      this.magnet.rotation.y = this.time * 2;
      (this.magnet.material as THREE.MeshBasicMaterial).opacity = o.fx.magnet ? 0.75 : 0.22;
    }
  }

  dispose() {
    this.group.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });
  }
}
