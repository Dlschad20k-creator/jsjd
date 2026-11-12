/**
 * Protocol end-to-end test against a running server started with
 *   HW_MATCH_SECONDS=8 HW_GRACE_SECONDS=4 PORT=3011 node dist/index.js
 * Covers: lobby waits for 2 players, match start, snapshots, match end + result,
 * rematch, disconnect + reconnect (seat resume), forfeit after grace, private rooms.
 */
import assert from 'node:assert/strict';
import { io, type Socket } from 'socket.io-client';

const URL = process.env.URL || 'http://localhost:3011';
type C = { s: Socket; room: any; snaps: number; world: number; result: any; last: any; errors: string[]; token: string };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(f: () => boolean, ms = 15000, what = 'condition') {
  const t0 = Date.now();
  while (!f()) {
    if (Date.now() - t0 > ms) throw new Error('timeout: ' + what);
    await wait(50);
  }
}
function client(name: string, token = name + '-' + Math.random().toString(36).slice(2, 10)): Promise<C> {
  return new Promise((res) => {
    const s = io(URL, { transports: ['websocket'], forceNew: true });
    const c: C = { s, room: null, snaps: 0, world: 0, result: null, last: null, errors: [], token };
    s.on('connect', () => {
      s.emit('hello', { token, v: 1 });
      res(c);
    });
    s.on('room', (r) => (c.room = r));
    s.on('world', () => c.world++);
    s.on('snap', (sn) => {
      c.snaps++;
      c.last = sn;
    });
    s.on('result', (r) => (c.result = r));
    s.on('errorMsg', (e) => c.errors.push(e.message));
  });
}
const prof = (name: string) => ({ name, avatar: 'bunny', color: '#ffffff' });

// 1) quick match: waits for second player, then starts
const a = await client('A');
a.s.emit('quickMatch', { profile: prof('A'), mapId: 'bunny' });
await until(() => a.room, 5000, 'A room');
await wait(1500);
assert.equal(a.room.players.length, 1);
assert.equal(a.room.phase, 'lobby');
assert.equal(a.world, 0, 'no match with one player');
const b = await client('B');
b.s.emit('quickMatch', { profile: prof('B'), mapId: 'pink' });
await until(() => a.room?.players.length === 2 && b.room?.code === a.room.code, 5000, 'paired');
await until(() => a.world === 1 && b.world === 1, 8000, 'world sent');
assert.equal(a.room.mapId, 'bunny', 'first player map preference');
await until(() => a.last?.phase === 'playing', 6000, 'playing');
console.log('✓ matchmaking + start');

// 2) disconnect + reconnect resumes the seat mid-match
const tokenB = b.token;
b.s.disconnect();
await until(() => a.last?.players.find((p: any) => p.id !== a.room.you)?.conn === false, 3000, 'B marked disconnected');
const b2 = await client('B', tokenB);
await until(() => b2.world === 1 && b2.room?.code === a.room.code, 5000, 'B resumed');
await until(() => a.last?.players.every((p: any) => p.conn), 3000, 'B connected again');
console.log('✓ reconnect resumes seat');

// 3) match ends on time with a result for both
await until(() => !!a.result && !!b2.result, 15000, 'results');
assert.equal(a.result.reason, 'time');
assert.equal(a.result.stats.length, 2);
console.log('✓ match end + results', a.result.stats.map((s: any) => `${s.name}:${s.score}`).join(' '));

// 4) rematch requires both votes
a.s.emit('rematch');
await wait(600);
assert.equal(a.room.phase, 'ended');
b2.s.emit('rematch');
await until(() => a.world === 2 && b2.world === 2, 8000, 'rematch world');
console.log('✓ rematch');

// 5) forfeit after reconnect grace expires
b2.s.disconnect();
a.result = null;
await until(() => !!a.result, 9000, 'forfeit result');
assert.equal(a.result.reason, 'forfeit');
assert.equal(a.result.winner, a.room.you);
console.log('✓ forfeit after grace');

// 6) private room by code; unknown code errors; full room rejected
const h = await client('H');
h.s.emit('createRoom', { profile: prof('Host'), mapId: 'berlin' });
await until(() => h.room?.isPrivate, 3000, 'private room');
const g = await client('G');
g.s.emit('joinRoom', { profile: prof('Guest'), code: 'ZZZZZ' });
await until(() => g.errors.length > 0, 3000, 'bad code error');
g.s.emit('joinRoom', { profile: prof('Guest'), code: h.room.code.toLowerCase() });
await until(() => g.room?.code === h.room.code && h.room.players.length === 2, 3000, 'joined by code');
const x = await client('X');
x.s.emit('joinRoom', { profile: prof('X'), code: h.room.code });
await until(() => x.errors.length > 0, 3000, 'full room error');
await until(() => h.world === 1 && g.world === 1, 8000, 'private match started');
assert.equal(h.room.mapId, 'berlin');
console.log('✓ private rooms');

// 7) hostile input is ignored / clamped
g.s.emit('input', { x: 1e9, z: NaN } as any);
g.s.emit('upgrade', { k: '__proto__' } as any);
g.s.emit('quickMatch', null as any);
await wait(300);
assert.ok(h.s.connected && g.s.connected);
console.log('✓ input validation');

for (const c of [a, b2, h, g, x]) c.s.disconnect();
console.log('ALL PROTOCOL TESTS PASSED');
process.exit(0);
