import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/game/Match';
import { MAPS, MAP_IDS } from '../../shared/src/maps';
import { generateWorld } from '../../shared/src/mapgen';
import { FIT_RATIO, PVP_RATIO, RESPAWN_TIME, radiusForLevel, xpToNext } from '../../shared/src/constants';

const P = [
  { id: 'a', name: 'A', avatar: 'vortex', color: '#ffffff' },
  { id: 'b', name: 'B', avatar: 'bunny', color: '#00e5ff' },
];
const DT = 1 / 30;

function playing(mapId: 'pink' | 'bunny' | 'berlin' = 'berlin') {
  const m = new Match(mapId, 1234, P, { countdown: 0 });
  m.step(DT); // countdown -> playing
  assert.equal(m.phase, 'playing');
  return m;
}

test('world generation is deterministic and populated for every map', () => {
  for (const id of MAP_IDS) {
    const a = generateWorld(MAPS[id], 42);
    const b = generateWorld(MAPS[id], 42);
    assert.deepEqual(a.objects, b.objects);
    assert.ok(a.objects.length > 600, `${id} has ${a.objects.length} objects`);
    const half = a.layout.size / 2;
    for (const [, x, z] of a.objects) assert.ok(Math.abs(x) < half && Math.abs(z) < half);
    // every landmark kind got placed
    const placedKinds = new Set(a.objects.map((o) => o[0]));
    MAPS[id].kinds.forEach((k, i) => {
      if (k.place.includes('landmark')) assert.ok(placedKinds.has(i), `${id}:${k.id} landmark placed`);
    });
  }
});

test('players start apart, at level 1, and do not move during countdown', () => {
  const m = new Match('pink', 1, P);
  m.setInput('a', 1, 0);
  m.step(DT);
  const a = m.players.get('a')!;
  const b = m.players.get('b')!;
  assert.equal(m.phase, 'countdown');
  assert.equal(a.level, 1);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 100);
  assert.equal(a.vx, 0);
});

test('input is normalised and non-finite input is ignored', () => {
  const m = playing();
  m.setInput('a', 100, 0);
  assert.equal(m.players.get('a')!.inX, 1);
  m.setInput('a', NaN, 0);
  assert.equal(m.players.get('a')!.inX, 1);
});

test('holes swallow objects that fit and gain xp, but not ones too big', () => {
  const m = playing();
  const a = m.players.get('a')!;
  const small = m.objects.find((o) => o.r <= a.R * FIT_RATIO)!;
  const big = m.objects.find((o) => o.r > 5)!;
  a.x = small.x;
  a.z = small.z;
  m.step(DT);
  assert.equal(small.alive, false);
  assert.ok(a.score > 0);
  a.x = big.x;
  a.z = big.z;
  m.step(DT);
  assert.equal(big.alive, true);
  const ev = m.snapshot('playing').ev;
  assert.ok(ev.some((e) => e.t === 'eat' && e.o === small.id));
});

test('leveling grows the radius and grants upgrade points', () => {
  const m = playing();
  const a = m.players.get('a')!;
  const r0 = a.R;
  (m as any).gainXp(a, xpToNext(1) + xpToNext(2) + 1);
  assert.equal(a.level, 3);
  assert.equal(a.upPts, 2);
  assert.ok(a.R > r0 && a.R >= radiusForLevel(3));
  m.upgrade('a', 'speed');
  assert.equal(a.up.speed, 1);
  assert.equal(a.upPts, 1);
});

test('bigger hole eats the smaller opponent; victim respawns at level 1, survivor keeps progress', () => {
  const m = playing();
  const a = m.players.get('a')!;
  const b = m.players.get('b')!;
  (m as any).gainXp(a, 2000);
  (m as any).gainXp(b, 20);
  const aLevel = a.level;
  assert.ok(a.R >= b.R * PVP_RATIO);
  b.x = a.x;
  b.z = a.z;
  b.prot = 0;
  m.step(DT);
  assert.ok(b.dead > 0, 'b died');
  assert.equal(b.level, 1);
  assert.equal(a.kills, 1);
  assert.ok(a.level >= aLevel, 'survivor keeps size');
  for (let i = 0; i < (RESPAWN_TIME + 0.5) / DT; i++) m.step(DT);
  assert.equal(b.dead, 0);
  assert.ok(b.prot > 0, 'spawn protection');
});

test('shield and spawn protection prevent being swallowed', () => {
  const m = playing();
  const a = m.players.get('a')!;
  const b = m.players.get('b')!;
  (m as any).gainXp(a, 2000);
  b.fx.shield = 5;
  b.x = a.x;
  b.z = a.z;
  m.step(DT);
  assert.equal(b.dead, 0);
});

test('match ends on time and picks the higher score as winner', () => {
  const m = new Match('bunny', 7, P, { countdown: 0, duration: 1 });
  m.players.get('b')!.score = 50;
  for (let i = 0; i < 40; i++) m.step(DT);
  assert.equal(m.phase, 'ended');
  assert.equal(m.result().winner, 'b');
});

test('forfeit gives the win to the remaining player', () => {
  const m = playing();
  m.forfeit('a');
  assert.equal(m.phase, 'ended');
  const r = m.result();
  assert.equal(r.winner, 'b');
  assert.equal(r.reason, 'forfeit');
});

test('disconnected players freeze and are protected', () => {
  const m = playing();
  const a = m.players.get('a')!;
  const b = m.players.get('b')!;
  (m as any).gainXp(a, 2000);
  m.setConnected('b', false);
  b.prot = 0;
  b.x = a.x;
  b.z = a.z;
  m.step(DT);
  assert.equal(b.dead, 0);
});

test('vortex swallows fitting objects in range and goes on cooldown', () => {
  const m = playing();
  const a = m.players.get('a')!;
  (m as any).gainXp(a, 300);
  const before = a.eaten;
  // park next to a cluster of small objects
  const target = m.objects.find((o) => o.r < 0.5)!;
  a.x = target.x + a.R * 1.5;
  a.z = target.z;
  m.vortex('a');
  assert.ok(a.eaten > before);
  assert.ok(a.vortexCd > 0);
  const cd = a.vortexCd;
  m.vortex('a');
  assert.equal(a.vortexCd, cd);
});
