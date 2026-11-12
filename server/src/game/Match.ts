/**
 * Authoritative match simulation (design/gdd.md §2–§5).
 * Pure logic: no sockets, no timers. The Room drives `step(dt)` at TICK_RATE and
 * broadcasts `snapshot()`. Unit-tested in server/test/match.test.ts.
 */
import {
  COMBO_WINDOW,
  COUNTDOWN,
  DASH_CD,
  DASH_MULT,
  DASH_TIME,
  FIT_RATIO,
  GIANT_MULT,
  KILL_SCORE_BASE,
  KILL_SCORE_PER_LEVEL,
  KILL_XP_BASE,
  KILL_XP_SHARE,
  MAGNET_BONUS,
  MATCH_DURATION,
  MAX_LEVEL,
  MAX_POWERUPS,
  MAX_UPGRADE,
  MOVE_ACCEL,
  OBJECT_RESPAWN_JITTER,
  OBJECT_RESPAWN_MIN,
  POWERUPS,
  POWERUP_INTERVAL,
  POWERUP_KINDS,
  POWERUP_PICK_RANGE,
  PVP_RATIO,
  RESPAWN_TIME,
  SLIME_MULT,
  SPAWN_PROTECT,
  TURBO_MULT,
  UPGRADES,
  VORTEX_CD,
  VORTEX_RANGE,
  baseSpeed,
  comboMult,
  objectXp,
  radiusForLevel,
  xpToNext,
  type PowerupKind,
  type UpgradeKind,
} from '../../../shared/src/constants';
import { MAPS, type MapDef } from '../../../shared/src/maps';
import { generateWorld, mulberry32, roadCenter } from '../../../shared/src/mapgen';
import type {
  GameEvent,
  Layout,
  MapId,
  MatchResult,
  PlayerSnap,
  PowerupSnap,
  Snapshot,
  WireObject,
  WorldInit,
} from '../../../shared/src/protocol';

export interface SimObject {
  id: number;
  k: number;
  x: number;
  z: number;
  r: number;
  xp: number;
  alive: boolean;
  respawnAt: number;
}

export interface SimPlayer {
  id: string;
  name: string;
  avatar: string;
  color: string;
  connected: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  inX: number;
  inZ: number;
  R: number;
  level: number;
  xp: number;
  lifeXp: number;
  maxLevel: number;
  score: number;
  kills: number;
  deaths: number;
  eaten: number;
  combo: number;
  comboT: number;
  maxCombo: number;
  dead: number;
  prot: number;
  dash: number;
  dashCd: number;
  vortexCd: number;
  fx: Partial<Record<PowerupKind, number>>;
  up: Record<UpgradeKind, number>;
  upPts: number;
}

export interface SimPowerup {
  id: number;
  k: PowerupKind;
  x: number;
  z: number;
}

export type MatchPhase = 'countdown' | 'playing' | 'ended';

const r2 = (v: number) => Math.round(v * 100) / 100;
const GRID_CELL = 8;

export class Match {
  readonly mapId: MapId;
  readonly map: MapDef;
  readonly layout: Layout;
  readonly wire: WireObject[];
  readonly objects: SimObject[];
  readonly players = new Map<string, SimPlayer>();
  powerups: SimPowerup[] = [];
  phase: MatchPhase = 'countdown';
  countdown = COUNTDOWN;
  timeLeft = MATCH_DURATION;
  time = 0;
  forfeitWinner: string | null = null;
  private events: GameEvent[] = [];
  private grid = new Map<number, number[]>();
  private gridW: number;
  private rng: () => number;
  private puTimer = 3;
  private puSeq = 1;

  constructor(mapId: MapId, seed: number, players: { id: string; name: string; avatar: string; color: string }[], opts?: { duration?: number; countdown?: number; startLevel?: number }) {
    this.mapId = mapId;
    this.map = MAPS[mapId];
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    const world = generateWorld(this.map, seed);
    this.layout = world.layout;
    this.wire = world.objects;
    if (opts?.duration != null) this.timeLeft = opts.duration;
    if (opts?.countdown != null) this.countdown = opts.countdown;
    this.objects = world.objects.map(([k, x, z], id) => {
      const r = this.map.kinds[k].r;
      return { id, k, x, z, r, xp: objectXp(r), alive: true, respawnAt: 0 };
    });
    this.gridW = Math.ceil(this.layout.size / GRID_CELL) + 2;
    for (const o of this.objects) {
      const key = this.cellKey(o.x, o.z);
      let list = this.grid.get(key);
      if (!list) this.grid.set(key, (list = []));
      list.push(o.id);
    }
    const a = roadCenter(this.layout, 1);
    const b = roadCenter(this.layout, this.layout.n - 1);
    const spawns = [
      { x: a, z: a },
      { x: b, z: b },
    ];
    players.forEach((p, i) => {
      const s = spawns[i % 2];
      const np = this.newPlayer(p, s.x, s.z);
      if (opts?.startLevel && opts.startLevel > 1) {
        np.level = np.maxLevel = Math.min(MAX_LEVEL, Math.floor(opts.startLevel));
        this.updateRadius(np);
      }
      this.players.set(p.id, np);
    });
  }

  private newPlayer(p: { id: string; name: string; avatar: string; color: string }, x: number, z: number): SimPlayer {
    return {
      ...p,
      connected: true,
      x,
      z,
      vx: 0,
      vz: 0,
      inX: 0,
      inZ: 0,
      R: radiusForLevel(1),
      level: 1,
      xp: 0,
      lifeXp: 0,
      maxLevel: 1,
      score: 0,
      kills: 0,
      deaths: 0,
      eaten: 0,
      combo: 0,
      comboT: 0,
      maxCombo: 0,
      dead: 0,
      prot: 0,
      dash: 0,
      dashCd: 0,
      vortexCd: 0,
      fx: {},
      up: { speed: 0, reach: 0, appetite: 0 },
      upPts: 0,
    };
  }

  private cellKey(x: number, z: number) {
    const half = this.layout.size / 2;
    const cx = Math.floor((x + half) / GRID_CELL) + 1;
    const cz = Math.floor((z + half) / GRID_CELL) + 1;
    return cz * this.gridW + cx;
  }

  /** Object ids in grid cells overlapping the circle */
  private query(x: number, z: number, radius: number, out: number[]) {
    out.length = 0;
    const half = this.layout.size / 2;
    // objects are bucketed by center; widen by the largest object radius
    const reach = radius + 12;
    const c0x = Math.floor((x - reach + half) / GRID_CELL) + 1;
    const c1x = Math.floor((x + reach + half) / GRID_CELL) + 1;
    const c0z = Math.floor((z - reach + half) / GRID_CELL) + 1;
    const c1z = Math.floor((z + reach + half) / GRID_CELL) + 1;
    for (let cz = c0z; cz <= c1z; cz++)
      for (let cx = c0x; cx <= c1x; cx++) {
        const list = this.grid.get(cz * this.gridW + cx);
        if (list) for (const id of list) out.push(id);
      }
    return out;
  }

  // ---- commands (validated) ----
  setInput(id: string, x: number, z: number) {
    const p = this.players.get(id);
    if (!p) return;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const len = Math.hypot(x, z);
    const s = len > 1 ? 1 / len : 1;
    p.inX = x * s;
    p.inZ = z * s;
  }

  dash(id: string) {
    const p = this.players.get(id);
    if (!p || this.phase !== 'playing' || p.dead > 0 || p.dashCd > 0) return;
    p.dash = DASH_TIME;
    p.dashCd = DASH_CD;
    this.events.push({ t: 'dash', p: id });
  }

  vortex(id: string) {
    const p = this.players.get(id);
    if (!p || this.phase !== 'playing' || p.dead > 0 || p.vortexCd > 0) return;
    p.vortexCd = VORTEX_CD;
    this.events.push({ t: 'vortex', p: id });
    const range = p.R * VORTEX_RANGE;
    const ids = this.query(p.x, p.z, range, []);
    for (const oid of ids) {
      const o = this.objects[oid];
      if (!o.alive || o.r > p.R * FIT_RATIO) continue;
      if (Math.hypot(o.x - p.x, o.z - p.z) <= range) this.eatObject(p, o);
    }
  }

  upgrade(id: string, k: UpgradeKind) {
    const p = this.players.get(id);
    if (!p || !(k in UPGRADES) || p.upPts <= 0 || p.up[k] >= MAX_UPGRADE) return;
    p.up[k]++;
    p.upPts--;
    this.events.push({ t: 'upgrade', p: id, k });
  }

  setConnected(id: string, connected: boolean) {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = connected;
    if (!connected) {
      p.inX = 0;
      p.inZ = 0;
    }
  }

  forfeit(loserId: string) {
    if (this.phase === 'ended') return;
    for (const p of this.players.values()) if (p.id !== loserId) this.forfeitWinner = p.id;
    this.phase = 'ended';
  }

  // ---- simulation ----
  step(dt: number) {
    if (this.phase === 'ended') return;
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      for (const p of this.players.values()) this.updateRadius(p);
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.phase = 'playing';
      }
      return;
    }
    this.time += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.phase = 'ended';
      return;
    }
    const scratch: number[] = [];
    for (const p of this.players.values()) {
      if (p.dead > 0) {
        p.dead -= dt;
        if (p.dead <= 0) this.respawn(p);
        continue;
      }
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.vortexCd = Math.max(0, p.vortexCd - dt);
      p.dash = Math.max(0, p.dash - dt);
      p.prot = Math.max(0, p.prot - dt);
      for (const k of Object.keys(p.fx) as PowerupKind[]) {
        const v = (p.fx[k] ?? 0) - dt;
        if (v <= 0) delete p.fx[k];
        else p.fx[k] = v;
      }
      if (p.combo > 0) {
        p.comboT -= dt;
        if (p.comboT <= 0) p.combo = 0;
      }
      this.updateRadius(p);
      this.move(p, dt);
      this.eatNearby(p, scratch);
      this.pickPowerups(p);
    }
    this.pvp();
    this.respawnObjects();
    this.spawnPowerups(dt);
  }

  private updateRadius(p: SimPlayer) {
    const need = xpToNext(p.level);
    p.R = radiusForLevel(p.level + Math.min(0.999, p.xp / need)) * (p.fx.giant ? GIANT_MULT : 1);
  }

  private move(p: SimPlayer, dt: number) {
    let speed = baseSpeed(p.R) * (1 + p.up.speed * UPGRADES.speed.perLevel);
    if (p.fx.turbo) speed *= TURBO_MULT;
    if (p.fx.slime) speed *= SLIME_MULT;
    if (p.dash > 0) speed *= DASH_MULT;
    let ix = p.connected ? p.inX : 0;
    let iz = p.connected ? p.inZ : 0;
    if (p.dash > 0 && Math.hypot(ix, iz) < 0.2) {
      // dash keeps going in the current direction
      const v = Math.hypot(p.vx, p.vz) || 1;
      ix = p.vx / v;
      iz = p.vz / v;
    }
    const k = 1 - Math.exp(-MOVE_ACCEL * dt);
    p.vx += (ix * speed - p.vx) * k;
    p.vz += (iz * speed - p.vz) * k;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const lim = this.layout.size / 2 - 1;
    if (p.x < -lim) (p.x = -lim), (p.vx = 0);
    if (p.x > lim) (p.x = lim), (p.vx = 0);
    if (p.z < -lim) (p.z = -lim), (p.vz = 0);
    if (p.z > lim) (p.z = lim), (p.vz = 0);
  }

  private eatNearby(p: SimPlayer, scratch: number[]) {
    if (!p.connected) return;
    const reachBonus = p.R * (p.up.reach * UPGRADES.reach.perLevel + (p.fx.magnet ? MAGNET_BONUS : 0));
    const fit = p.R * FIT_RATIO;
    const ids = this.query(p.x, p.z, p.R + reachBonus, scratch);
    for (const oid of ids) {
      const o = this.objects[oid];
      if (!o.alive || o.r > fit) continue;
      const d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d <= p.R - o.r * 0.35 + reachBonus) this.eatObject(p, o);
    }
  }

  private eatObject(p: SimPlayer, o: SimObject) {
    o.alive = false;
    o.respawnAt = this.time + OBJECT_RESPAWN_MIN + this.rng() * OBJECT_RESPAWN_JITTER;
    p.combo++;
    p.comboT = COMBO_WINDOW;
    p.maxCombo = Math.max(p.maxCombo, p.combo);
    const xp = o.xp * comboMult(p.combo) * (1 + p.up.appetite * UPGRADES.appetite.perLevel);
    p.score += Math.round(xp);
    p.eaten++;
    this.gainXp(p, xp);
    this.events.push({ t: 'eat', o: o.id, p: p.id, xp: Math.round(xp), c: p.combo });
  }

  private gainXp(p: SimPlayer, xp: number) {
    p.xp += xp;
    p.lifeXp += xp;
    while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level++;
      p.upPts++;
      p.maxLevel = Math.max(p.maxLevel, p.level);
      this.events.push({ t: 'level', p: p.id, l: p.level });
    }
    if (p.level >= MAX_LEVEL) p.xp = Math.min(p.xp, xpToNext(p.level) - 1);
    this.updateRadius(p);
  }

  private pickPowerups(p: SimPlayer) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      if (Math.hypot(pu.x - p.x, pu.z - p.z) > p.R + POWERUP_PICK_RANGE) continue;
      this.powerups.splice(i, 1);
      const dur = POWERUPS[pu.k].duration;
      if (pu.k === 'slime') {
        for (const o of this.players.values()) if (o.id !== p.id) o.fx.slime = dur;
      } else p.fx[pu.k] = dur;
      this.events.push({ t: 'pu', p: p.id, k: pu.k, id: pu.id });
    }
  }

  private pvp() {
    const list = [...this.players.values()];
    for (const a of list)
      for (const b of list) {
        if (a === b || a.dead > 0 || b.dead > 0) continue;
        if (!a.connected || !b.connected) continue;
        if (b.prot > 0 || b.fx.shield) continue;
        if (a.R < b.R * PVP_RATIO) continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d > a.R - b.R * 0.4) continue;
        this.kill(a, b);
      }
  }

  private kill(a: SimPlayer, b: SimPlayer) {
    const xp = KILL_XP_BASE + b.lifeXp * KILL_XP_SHARE;
    a.kills++;
    a.score += KILL_SCORE_BASE + b.level * KILL_SCORE_PER_LEVEL;
    this.gainXp(a, xp);
    b.deaths++;
    b.dead = RESPAWN_TIME;
    b.level = 1;
    b.xp = 0;
    b.lifeXp = 0;
    b.up = { speed: 0, reach: 0, appetite: 0 };
    b.upPts = 0;
    b.fx = {};
    b.combo = 0;
    b.vx = b.vz = 0;
    b.dash = 0;
    this.updateRadius(b);
    this.events.push({ t: 'kill', k: a.id, v: b.id, xp: Math.round(xp) });
  }

  private respawn(p: SimPlayer) {
    p.dead = 0;
    p.prot = SPAWN_PROTECT;
    const others = [...this.players.values()].filter((o) => o !== p);
    let best = { x: 0, z: 0 };
    let bestD = -1;
    for (let i = 0; i <= this.layout.n; i++)
      for (let j = 0; j <= this.layout.n; j++) {
        const x = roadCenter(this.layout, i);
        const z = roadCenter(this.layout, j);
        const d = Math.min(...others.map((o) => Math.hypot(o.x - x, o.z - z) - o.R), 9999) + this.rng() * 30;
        if (d > bestD) (bestD = d), (best = { x, z });
      }
    p.x = best.x;
    p.z = best.z;
    this.updateRadius(p);
    this.events.push({ t: 'respawn', p: p.id });
  }

  private respawnObjects() {
    for (const o of this.objects) {
      if (o.alive || o.respawnAt > this.time) continue;
      let covered = false;
      for (const p of this.players.values()) if (Math.hypot(p.x - o.x, p.z - o.z) < p.R + o.r + 2) covered = true;
      if (covered) {
        o.respawnAt = this.time + 3;
        continue;
      }
      o.alive = true;
      this.events.push({ t: 'spawn', o: o.id });
    }
  }

  private spawnPowerups(dt: number) {
    this.puTimer -= dt;
    if (this.puTimer > 0) return;
    this.puTimer = POWERUP_INTERVAL;
    if (this.powerups.length >= MAX_POWERUPS) return;
    const half = this.layout.size / 2;
    const i = Math.floor(this.rng() * (this.layout.n + 1));
    const along = -half + 10 + this.rng() * (this.layout.size - 20);
    const c = roadCenter(this.layout, i);
    const horiz = this.rng() < 0.5;
    const k = POWERUP_KINDS[Math.floor(this.rng() * POWERUP_KINDS.length)];
    this.powerups.push({ id: this.puSeq++, k, x: horiz ? along : c, z: horiz ? c : along });
  }

  // ---- output ----
  snapshot(roomPhase: Snapshot['phase']): Snapshot {
    const players: PlayerSnap[] = [];
    for (const p of this.players.values()) {
      const fx: PlayerSnap['fx'] = {};
      for (const k of Object.keys(p.fx) as PowerupKind[]) fx[k] = r2(p.fx[k] ?? 0);
      players.push({
        id: p.id,
        x: r2(p.x),
        z: r2(p.z),
        vx: r2(p.vx),
        vz: r2(p.vz),
        R: r2(p.R),
        lvl: p.level,
        xpf: r2(p.xp / xpToNext(p.level)),
        score: p.score,
        kills: p.kills,
        deaths: p.deaths,
        combo: p.combo,
        dead: r2(Math.max(0, p.dead)),
        prot: r2(p.prot),
        conn: p.connected,
        dashCd: r2(p.dashCd),
        dash: r2(p.dash),
        vortexCd: r2(p.vortexCd),
        fx,
        up: { ...p.up },
        upPts: p.upPts,
      });
    }
    const pus: PowerupSnap[] = this.powerups.map((p) => ({ id: p.id, k: p.k, x: r2(p.x), z: r2(p.z) }));
    const ev = this.events;
    this.events = [];
    return { t: Date.now(), phase: roomPhase, timeLeft: r2(this.timeLeft), countdown: r2(this.countdown), players, pus, ev };
  }

  worldInit(): WorldInit {
    return {
      mapId: this.mapId,
      layout: this.layout,
      objects: this.wire,
      dead: this.objects.filter((o) => !o.alive).map((o) => o.id),
    };
  }

  result(): MatchResult {
    const list = [...this.players.values()];
    let winner: string | null = this.forfeitWinner;
    if (!winner && list.length === 2) {
      if (list[0].score > list[1].score) winner = list[0].id;
      else if (list[1].score > list[0].score) winner = list[1].id;
    }
    return {
      winner,
      reason: this.forfeitWinner ? 'forfeit' : 'time',
      stats: list.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        score: p.score,
        level: p.level,
        maxLevel: p.maxLevel,
        kills: p.kills,
        deaths: p.deaths,
        eaten: p.eaten,
        maxCombo: p.maxCombo,
      })),
    };
  }
}
