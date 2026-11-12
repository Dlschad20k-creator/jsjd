/**
 * Game engine: owns the Three.js renderer/scene and turns server snapshots into
 * visuals. Own hole = client-side prediction + soft reconciliation; opponent =
 * buffered interpolation. UI receives display state via the store at 10 Hz.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  DASH_CD,
  DASH_MULT,
  DASH_TIME,
  MOVE_ACCEL,
  POWERUPS,
  SLIME_MULT,
  TURBO_MULT,
  UPGRADES,
  UPGRADE_KINDS,
  VORTEX_RANGE,
  baseSpeed,
} from '@shared/constants';
import { MAPS } from '@shared/maps';
import type { GameEvent, LobbyPlayer, PlayerSnap, Snapshot, WorldInit } from '@shared/protocol';
import { sfx } from '../audio/Audio';
import { net } from '../net/socket';
import { pushFeed, t, useStore } from '../store';
import { setAnisotropy } from './assets/textures';
import { Effects } from './Effects';
import { buildGround, createHoleUniforms, MAX_HOLES } from './Ground';
import { HoleView } from './Hole';
import { Input } from './Input';
import { Powerups } from './Powerups';
import { THEMES, type Theme } from './themes';
import { World } from './World';

const INTERP_DELAY = 110;

interface SnapEntry {
  t: number;
  players: Map<string, PlayerSnap>;
}

const skyVert = /* glsl */ `
varying vec3 vPos;
void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const skyFrag = /* glsl */ `
precision mediump float;
uniform vec3 uTop;
uniform vec3 uBottom;
varying vec3 vPos;
void main() {
  float h = normalize(vPos).y;
  vec3 c = mix(uBottom, uTop, smoothstep(-0.05, 0.6, h));
  gl_FragColor = vec4(c, 1.0);
}`;

export interface EngineOptions {
  quality: 'high' | 'low';
  reducedMotion: boolean;
  offline?: boolean;
}

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private sun: THREE.DirectionalLight;
  private world: World;
  private effects: Effects;
  private powerups = new Powerups();
  private holes = new Map<string, HoleView>();
  private holeUniforms = createHoleUniforms();
  private ground: ReturnType<typeof buildGround>;
  private input: Input;
  private theme: Theme;
  private init: WorldInit;
  private myId: string;
  private players: Map<string, LobbyPlayer>;
  private snaps: SnapEntry[] = [];
  private latest: Snapshot | null = null;
  private pred = { x: 0, z: 0, vx: 0, vz: 0, init: false, dash: 0, dashCd: 0 };
  private camTarget = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private shake = 0;
  private raf = 0;
  private last = performance.now();
  private hudTimer = 0;
  private inputTimer = 0;
  private lastSent = { x: 9, z: 9 };
  private lastCountdown = -1;
  private fpsAcc = { frames: 0, time: 0, fps: 60 };
  private labels = new Map<string, HTMLDivElement>();
  private overlay: HTMLDivElement;
  private floatPool: HTMLDivElement[] = [];
  private floats: { el: HTMLDivElement; pos: THREE.Vector3; t: number; dur: number }[] = [];
  private unsub: () => void;
  private opts: EngineOptions;
  private container: HTMLElement;
  private disposed = false;
  private tmpV = new THREE.Vector3();
  private ended = false;
  private buildMs = 0;
  private camInit = false;
  debugCam: { x: number; z: number; h: number; yaw: number } | null = null;

  constructor(container: HTMLElement, init: WorldInit, myId: string, players: LobbyPlayer[], opts: EngineOptions) {
    this.container = container;
    this.init = init;
    this.myId = myId;
    this.opts = opts;
    this.players = new Map(players.map((p) => [p.id, p]));
    this.theme = THEMES[init.mapId];
    const high = opts.quality === 'high';
    const t0 = performance.now();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.theme.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = high ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'game-canvas';
    setAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));

    this.overlay = document.createElement('div');
    this.overlay.className = 'world-overlay';
    container.appendChild(this.overlay);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.5, 2500);

    // environment for PBR reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = init.mapId === 'berlin' ? 0.35 : 0.45;
    pmrem.dispose();

    // sky dome + fog
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1800, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        uniforms: { uTop: { value: new THREE.Color(this.theme.skyTop) }, uBottom: { value: new THREE.Color(this.theme.skyBottom) } },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    this.scene.add(sky);
    this.scene.fog = new THREE.Fog(this.theme.fog, this.theme.fogNear, this.theme.fogFar);

    // lights
    this.scene.add(new THREE.HemisphereLight(this.theme.hemiSky, this.theme.hemiGround, this.theme.hemiIntensity));
    this.sun = new THREE.DirectionalLight(this.theme.sun, this.theme.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 400;
    this.scene.add(this.sun, this.sun.target);

    // content
    this.ground = buildGround(init.layout, this.theme, init.mapId, this.holeUniforms, opts.quality, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.scene.add(this.ground.group);
    this.world = new World(init, this.theme, true);
    this.scene.add(this.world.group);
    this.effects = new Effects(this.theme, !high);
    this.scene.add(this.effects.group);
    this.scene.add(this.powerups.group);

    for (const p of players) this.ensureHole(p.id);

    if (high) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), this.theme.bloom, 0.45, 1.15) // only HDR emissives (intensity > 1) bloom;
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.input = new Input(this.renderer.domElement, {
      dash: () => this.tryDash(),
      vortex: () => net.vortex(),
      upgrade: (i) => net.upgrade(UPGRADE_KINDS[i]),
    });

    this.unsub = opts.offline ? () => {} : net.onSnap((s) => this.onSnap(s));
    window.addEventListener('resize', this.resize);
    this.resize();
    if (!opts.offline) sfx.playMusic(init.mapId);
    this.buildMs = Math.round(performance.now() - t0);
    this.loop();
  }

  updatePlayers(players: LobbyPlayer[]) {
    for (const p of players) {
      this.players.set(p.id, p);
      this.ensureHole(p.id);
    }
  }

  setOptions(o: Partial<EngineOptions>) {
    Object.assign(this.opts, o);
  }

  private ensureHole(id: string) {
    if (this.holes.has(id)) return this.holes.get(id)!;
    const p = this.players.get(id);
    const h = new HoleView(p?.color ?? '#ffffff');
    this.holes.set(id, h);
    this.scene.add(h.group);
    const label = document.createElement('div');
    label.className = 'hole-label' + (id === this.myId ? ' me' : '');
    this.overlay.appendChild(label);
    this.labels.set(id, label);
    return h;
  }

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 62 : 48; // portrait phones see more
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set(w / 2, h / 2);
    this.effects.setViewport(h * this.renderer.getPixelRatio());
  };

  private tryDash() {
    const me = this.latest?.players.find((p) => p.id === this.myId);
    if (me && me.dashCd <= 0 && this.pred.dashCd <= 0 && me.dead <= 0 && this.latest?.phase === 'playing') {
      this.pred.dash = DASH_TIME;
      this.pred.dashCd = DASH_CD;
    }
    net.dash();
  }

  // ---------- network ----------
  private onSnap(s: Snapshot) {
    this.latest = s;
    const players = new Map(s.players.map((p) => [p.id, p]));
    this.snaps.push({ t: s.t, players });
    if (this.snaps.length > 30) this.snaps.shift();
    this.powerups.sync(s.pus);
    const me = players.get(this.myId);
    if (me) {
      if (!this.pred.init || me.dead > 0 || s.phase === 'countdown') {
        this.pred.x = me.x;
        this.pred.z = me.z;
        this.pred.vx = me.vx;
        this.pred.vz = me.vz;
        this.pred.init = true;
      } else {
        const lead = Math.min(0.25, net.ping / 2000 + 1 / 30);
        const ex = me.x + me.vx * lead - this.pred.x;
        const ez = me.z + me.vz * lead - this.pred.z;
        if (Math.hypot(ex, ez) > 8) {
          this.pred.x = me.x;
          this.pred.z = me.z;
        } else {
          this.pred.x += ex * 0.15;
          this.pred.z += ez * 0.15;
        }
      }
      if (me.dashCd > 0) this.pred.dashCd = Math.min(this.pred.dashCd, me.dashCd);
    }
    // countdown beeps
    if (s.phase === 'countdown') {
      const c = Math.ceil(s.countdown);
      if (c !== this.lastCountdown && c > 0) sfx.beep(false);
      this.lastCountdown = c;
    } else if (s.phase === 'playing' && this.lastCountdown > 0) {
      sfx.beep(true);
      this.lastCountdown = 0;
    }
    if (s.phase === 'ended' && !this.ended) this.ended = true;
    sfx.setIntensity(s.timeLeft < 30 && s.phase === 'playing' ? 1 : 0);
    for (const e of s.ev) this.handleEvent(e, players);
  }

  private holePos = (id: string) => () => {
    const h = this.holes.get(id);
    return h ? { x: h.x, z: h.z, R: h.R } : { x: 0, z: 0, R: 1 };
  };

  private name(id: string) {
    return this.players.get(id)?.name ?? '???';
  }

  private handleEvent(e: GameEvent, players: Map<string, PlayerSnap>) {
    const map = MAPS[this.init.mapId];
    switch (e.t) {
      case 'eat': {
        const o = this.world.objects[e.o];
        if (!o) return;
        const kind = map.kinds[o.k];
        const hole = this.holes.get(e.p);
        this.world.swallow(e.o, this.holePos(e.p));
        this.effects.eatBurst(o.x, o.z, o.r, o.color, hole?.color ?? new THREE.Color('#fff'), this.holePos(e.p));
        const mine = e.p === this.myId;
        sfx.eat(kind.sfx, o.r, e.c, mine);
        if (mine) {
          this.floatText(`+${e.xp}`, o.x, o.r * 1.5 + 1, o.z, e.c >= 10 ? 'big' : '');
          if (kind.quips && (o.r >= 3 || Math.random() < 0.18)) {
            const q = kind.quips[Math.floor(Math.random() * kind.quips.length)];
            this.floatText(q, o.x, o.r * 2 + 2.5, o.z, 'quip');
            if (o.r >= 3 || Math.random() < 0.3) sfx.say(q);
          }
          if (o.r >= 2.5) this.addShake(Math.min(1.2, o.r * 0.12));
          if (o.r >= 9) pushFeed(`${this.name(e.p)} ${t('ate')} ${kind.name}!`, '#ffd400', 'info');
        } else if (o.r >= 9) pushFeed(`${this.name(e.p)} ${t('ate')} ${kind.name}!`, '#ff6b6b', 'info');
        break;
      }
      case 'spawn':
        this.world.respawn(e.o);
        break;
      case 'kill': {
        const victim = this.holes.get(e.v);
        const killer = this.players.get(e.k);
        const vp = players.get(e.v);
        const x = victim?.x ?? vp?.x ?? 0;
        const z = victim?.z ?? vp?.z ?? 0;
        this.effects.ring(x, z, 25, new THREE.Color(killer?.color ?? '#fff'), 1.1);
        this.effects.burst(x, 1, z, new THREE.Color(this.players.get(e.v)?.color ?? '#fff'), 60, 18, 1.4);
        const quip = map.killQuips[Math.floor(Math.random() * map.killQuips.length)];
        pushFeed(`${this.name(e.k)} ⟶ ${this.name(e.v)} ${quip}`, killer?.color ?? '#fff', 'kill');
        if (e.k === this.myId) {
          sfx.kill(this.init.mapId);
          this.floatText(`KO! +${e.xp}`, x, 4, z, 'big');
          sfx.say(map.id === 'berlin' ? 'Digga! Gefressen!' : map.id === 'pink' ? 'So fabulous!' : 'Hop hop! Gotcha!');
          this.addShake(1.5);
        } else if (e.v === this.myId) {
          sfx.died();
          this.addShake(2);
        }
        break;
      }
      case 'respawn': {
        const p = players.get(e.p);
        if (p) this.effects.ring(p.x, p.z, 8, new THREE.Color(this.players.get(e.p)?.color ?? '#fff'), 0.8);
        break;
      }
      case 'level': {
        if (e.p === this.myId) {
          sfx.levelUp();
          const h = this.holes.get(e.p);
          if (h) {
            this.effects.ring(h.x, h.z, h.R * 2.2, h.color, 0.6);
            this.floatText(`LEVEL ${e.l}`, h.x, h.R + 3, h.z, 'level');
          }
        }
        break;
      }
      case 'pu': {
        const info = POWERUPS[e.k];
        const p = players.get(e.p);
        if (p) this.effects.burst(p.x, 1.5, p.z, new THREE.Color(info.color), 40, 10, 1);
        if (e.p === this.myId) sfx.powerup();
        pushFeed(`${this.name(e.p)}: ${info.name}!`, info.color, 'power');
        break;
      }
      case 'dash':
        if (e.p === this.myId) sfx.dash();
        break;
      case 'vortex': {
        const h = this.holes.get(e.p);
        if (h) this.effects.ring(h.x, h.z, h.R * VORTEX_RANGE, h.color, 0.6);
        if (e.p === this.myId) {
          sfx.vortex();
          this.addShake(0.6);
        }
        break;
      }
      case 'upgrade':
        if (e.p === this.myId) sfx.upgrade();
        break;
    }
  }

  private addShake(a: number) {
    if (this.opts.reducedMotion) return;
    this.shake = Math.min(2.5, this.shake + a);
  }

  // ---------- DOM floating text ----------
  private floatText(text: string, x: number, y: number, z: number, cls: string) {
    const el = this.floatPool.pop() ?? document.createElement('div');
    el.className = 'float-text ' + cls;
    el.textContent = text;
    this.overlay.appendChild(el);
    this.floats.push({ el, pos: new THREE.Vector3(x, y, z), t: 0, dur: cls === 'quip' ? 1.8 : 1.1 });
  }

  private project(v: THREE.Vector3, out: { x: number; y: number; vis: boolean }) {
    this.tmpV.copy(v).project(this.camera);
    out.vis = this.tmpV.z < 1;
    out.x = (this.tmpV.x * 0.5 + 0.5) * this.container.clientWidth;
    out.y = (-this.tmpV.y * 0.5 + 0.5) * this.container.clientHeight;
    return out;
  }

  // ---------- main loop ----------
  private interpolated(id: string): PlayerSnap | null {
    if (!this.snaps.length) return null;
    const renderT = Date.now() - net.clockOffset - INTERP_DELAY;
    let a = this.snaps[0];
    let b = this.snaps[this.snaps.length - 1];
    for (let i = this.snaps.length - 1; i > 0; i--) {
      if (this.snaps[i - 1].t <= renderT) {
        a = this.snaps[i - 1];
        b = this.snaps[i];
        break;
      }
    }
    const pa = a.players.get(id);
    const pb = b.players.get(id);
    if (!pa || !pb) return pb ?? pa ?? null;
    const span = b.t - a.t;
    const k = span > 0 ? Math.max(0, Math.min(1.2, (renderT - a.t) / span)) : 1;
    // teleports (respawn) are not interpolated
    if (Math.hypot(pb.x - pa.x, pb.z - pa.z) > 20) return pb;
    return { ...pb, x: pa.x + (pb.x - pa.x) * k, z: pa.z + (pb.z - pa.z) * k, R: pa.R + (pb.R - pa.R) * Math.min(1, k) };
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const raw = (now - this.last) / 1000;
    const dt = Math.min(0.05, raw);
    this.last = now;
    this.fpsAcc.frames++;
    this.fpsAcc.time += raw;
    if (this.fpsAcc.time > 0.5) {
      this.fpsAcc.fps = Math.round(this.fpsAcc.frames / this.fpsAcc.time);
      this.fpsAcc.frames = 0;
      this.fpsAcc.time = 0;
    }
    this.frame(dt);
  };

  private frame(dt: number) {
    const s = this.latest;
    this.input.update();
    const phase = s?.phase ?? 'countdown';

    // send input
    this.inputTimer -= dt;
    const changed = Math.abs(this.input.x - this.lastSent.x) > 0.05 || Math.abs(this.input.z - this.lastSent.z) > 0.05;
    if (!this.opts.offline && (this.inputTimer <= 0 || (changed && this.inputTimer < 0.03))) {
      net.input(this.input.x, this.input.z);
      this.lastSent = { x: this.input.x, z: this.input.z };
      this.inputTimer = 0.05;
    }

    const meSnap = s?.players.find((p) => p.id === this.myId) ?? null;
    // local prediction (mirrors server movement rules)
    if (meSnap && this.pred.init && phase === 'playing' && meSnap.dead <= 0 && meSnap.conn) {
      this.pred.dash = Math.max(0, this.pred.dash - dt);
      this.pred.dashCd = Math.max(0, this.pred.dashCd - dt);
      let speed = baseSpeed(meSnap.R) * (1 + meSnap.up.speed * UPGRADES.speed.perLevel);
      if (meSnap.fx.turbo) speed *= TURBO_MULT;
      if (meSnap.fx.slime) speed *= SLIME_MULT;
      const dashing = this.pred.dash > 0 || meSnap.dash > 0;
      if (dashing) speed *= DASH_MULT;
      let ix = this.input.x;
      let iz = this.input.z;
      if (dashing && Math.hypot(ix, iz) < 0.2) {
        const v = Math.hypot(this.pred.vx, this.pred.vz) || 1;
        ix = this.pred.vx / v;
        iz = this.pred.vz / v;
      }
      const k = 1 - Math.exp(-MOVE_ACCEL * dt);
      this.pred.vx += (ix * speed - this.pred.vx) * k;
      this.pred.vz += (iz * speed - this.pred.vz) * k;
      this.pred.x += this.pred.vx * dt;
      this.pred.z += this.pred.vz * dt;
      const lim = this.init.layout.size / 2 - 1;
      this.pred.x = Math.max(-lim, Math.min(lim, this.pred.x));
      this.pred.z = Math.max(-lim, Math.min(lim, this.pred.z));
      if (dashing && Math.random() < 0.8) {
        const h = this.holes.get(this.myId);
        if (h) this.effects.trail(h.x, h.z, h.R, h.color);
      }
    }

    // update holes
    let i = 0;
    const holesForWorld: { x: number; z: number; R: number }[] = [];
    for (const [id, hole] of this.holes) {
      const snap = id === this.myId ? meSnap : this.interpolated(id);
      if (!snap) continue;
      const x = id === this.myId && this.pred.init ? this.pred.x : snap.x;
      const z = id === this.myId && this.pred.init ? this.pred.z : snap.z;
      hole.update(dt, { x, z, R: snap.R, fx: snap.fx, prot: snap.prot, dash: snap.dash, dead: snap.dead > 0, reach: snap.up.reach * UPGRADES.reach.perLevel });
      if (snap.fx.turbo && Math.random() < 0.5) this.effects.trail(hole.x, hole.z, hole.R, new THREE.Color(POWERUPS.turbo.color));
      if (i < MAX_HOLES) this.holeUniforms.uHoles.value[i++].set(hole.x, hole.z, hole.R * 0.985, 0);
      holesForWorld.push({ x: hole.x, z: hole.z, R: hole.R });
      // label
      const label = this.labels.get(id);
      if (label) {
        const p = this.players.get(id);
        const txt = `${p?.name ?? ''} · ${t('level')} ${snap.lvl}`;
        if (label.textContent !== txt) label.textContent = txt;
        label.style.borderColor = p?.color ?? '#fff';
        const pos = this.project(this.tmpV.set(hole.x, 0, hole.z + hole.R + 0.6), { x: 0, y: 0, vis: false });
        label.style.display = pos.vis && hole.R > 0.1 ? 'block' : 'none';
        label.style.transform = `translate(-50%, 0) translate(${pos.x}px, ${pos.y}px)`;
        label.classList.toggle('dc', !snap.conn);
      }
    }
    for (; i < MAX_HOLES; i++) this.holeUniforms.uHoles.value[i].set(9999, 9999, 0, 0);

    // camera follows own hole (or a fixed debug/preview camera)
    const myHole = this.holes.get(this.myId);
    if (this.debugCam) {
      const c = this.debugCam;
      this.camTarget.set(c.x, 0, c.z);
      this.camera.position.set(c.x + Math.sin(c.yaw) * c.h * 0.8, c.h, c.z + Math.cos(c.yaw) * c.h * 0.8);
      this.camera.lookAt(c.x, 0, c.z);
      (this.scene.fog as THREE.Fog).near = this.theme.fogNear + c.h;
      (this.scene.fog as THREE.Fog).far = this.theme.fogFar + c.h * 3;
      const d = this.theme.sunDir;
      const ext = 30 + c.h;
      const sc = this.sun.shadow.camera;
      sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
      sc.updateProjectionMatrix();
      this.sun.position.set(c.x + d[0] * 150, d[1] * 150, c.z + d[2] * 150);
      this.sun.target.position.set(c.x, 0, c.z);
    } else if (myHole) {
      const R = Math.max(1.2, meSnap?.R ?? myHole.R);
      const height = 15 + R * 5.2;
      if (!this.camInit && this.pred.init) {
        this.camTarget.set(myHole.x, 0, myHole.z);
        this.camPos.set(myHole.x, height, myHole.z + height * 0.62);
        this.camInit = true;
      }
      this.camTarget.lerp(this.tmpV.set(myHole.x, 0, myHole.z), 1 - Math.exp(-dt * 10));
      const want = new THREE.Vector3(this.camTarget.x, height, this.camTarget.z + height * 0.62);
      // follow position tightly, zoom smoothly
      this.camPos.x += (want.x - this.camPos.x) * (1 - Math.exp(-dt * 12));
      this.camPos.z += (want.z - this.camPos.z) * (1 - Math.exp(-dt * 12));
      this.camPos.y += (want.y - this.camPos.y) * (1 - Math.exp(-dt * 3));
      this.camPos.z += (this.camTarget.z + this.camPos.y * 0.62 - this.camPos.z) * (1 - Math.exp(-dt * 12));
      this.camera.position.copy(this.camPos);
      if (this.shake > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.shake;
        this.camera.position.y += (Math.random() - 0.5) * this.shake;
        this.shake = Math.max(0, this.shake - dt * 4);
      }
      this.camera.lookAt(this.camTarget.x, 0, this.camTarget.z - R * 0.3);
      const fog = this.scene.fog as THREE.Fog;
      fog.near = this.theme.fogNear + height * 0.8;
      fog.far = this.theme.fogFar + height * 2.5;
      // shadows follow the camera focus
      const ext = 45 + R * 4;
      const sc = this.sun.shadow.camera;
      if (Math.abs(sc.right - ext) > 2) {
        sc.left = -ext;
        sc.right = ext;
        sc.top = ext;
        sc.bottom = -ext;
        sc.updateProjectionMatrix();
      }
      const d = this.theme.sunDir;
      this.sun.position.set(this.camTarget.x + d[0] * 150, d[1] * 150, this.camTarget.z + d[2] * 150);
      this.sun.target.position.copy(this.camTarget);
      const sp = this.project(this.tmpV.set(myHole.x, 0, myHole.z), { x: 0, y: 0, vis: false });
      this.input.holeScreen = { x: sp.x, y: sp.y };
    }

    this.world.update(dt, holesForWorld, this.camTarget);
    this.powerups.update(dt);
    this.effects.update(dt, this.camTarget);

    // floating texts
    for (let k = this.floats.length - 1; k >= 0; k--) {
      const f = this.floats[k];
      f.t += dt;
      const p = this.project(this.tmpV.copy(f.pos).setY(f.pos.y + f.t * 3), { x: 0, y: 0, vis: false });
      f.el.style.transform = `translate(-50%, -50%) translate(${p.x}px, ${p.y}px) scale(${1 + Math.min(0.3, f.t)})`;
      f.el.style.opacity = String(Math.max(0, 1 - Math.pow(f.t / f.dur, 3)));
      if (f.t >= f.dur || !p.vis) {
        f.el.remove();
        this.floatPool.push(f.el);
        this.floats.splice(k, 1);
      }
    }

    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    // HUD bridge @ 10 Hz
    this.hudTimer -= dt;
    if (this.hudTimer <= 0 && s) {
      this.hudTimer = 0.1;
      const opp = s.players.find((p) => p.id !== this.myId) ?? null;
      useStore.setState({ hud: { timeLeft: s.timeLeft, countdown: s.countdown, phase: s.phase, me: meSnap, opp, ping: net.ping, fps: this.fpsAcc.fps, pus: s.pus } });
    }
  }

  /** Debug/test hook state (window.__HOLE__) */
  debugState() {
    return {
      fps: this.fpsAcc.fps,
      buildMs: this.buildMs,
      objects: this.world.objects.length,
      alive: this.world.objects.filter((o) => o.alive).length,
      holes: [...this.holes.entries()].map(([id, h]) => ({ id, x: h.x, z: h.z, R: h.R })),
      phase: this.latest?.phase,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unsub();
    window.removeEventListener('resize', this.resize);
    this.input.dispose();
    this.world.dispose();
    this.effects.dispose();
    this.powerups.dispose();
    this.ground.dispose();
    for (const h of this.holes.values()) h.dispose();
    this.composer?.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlay.remove();
  }
}
