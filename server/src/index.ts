import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import { AVATARS, COLORS, PROTOCOL_VERSION } from '../../shared/src/constants';
import { MAP_IDS, MAPS } from '../../shared/src/maps';
import type { ClientToServer, MapId, Profile, ServerToClient } from '../../shared/src/protocol';
import { Room, type Seat } from './game/Room';
import { Leaderboard } from './leaderboard';

const PORT = Number(process.env.PORT) || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data');
const CLIENT_DIST = process.env.CLIENT_DIST || path.resolve(__dirname, '../../client/dist');
const CORS_ORIGIN = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : '*';

const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);
const io = new Server<ClientToServer, ServerToClient>(server, {
  cors: { origin: CORS_ORIGIN },
  maxHttpBufferSize: 16 * 1024, // incoming messages are tiny; reject anything large
  pingInterval: 10000,
  pingTimeout: 25000, // tolerate slow phones blocking the main thread while building the 3D world
});

const leaderboard = new Leaderboard(DATA_DIR);
const rooms = new Map<string, Room>();
const tokens = new Map<string, { code: string; seatId: string }>();

// ---------- validation helpers (never trust the client) ----------
const isMapId = (m: unknown): m is MapId => typeof m === 'string' && (MAP_IDS as string[]).includes(m);
function sanitizeProfile(p: unknown): Profile {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  let name = typeof o.name === 'string' ? o.name : '';
  name = name.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16);
  if (!name) name = 'Hole' + Math.floor(Math.random() * 900 + 100);
  const avatar = typeof o.avatar === 'string' && AVATARS.includes(o.avatar) ? o.avatar : AVATARS[0];
  const color = typeof o.color === 'string' && COLORS.includes(o.color) ? o.color : COLORS[0];
  return { name, avatar, color };
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}

function createRoom(isPrivate: boolean, mapId: MapId) {
  const room = new Room(io, newCode(), isPrivate, mapId, {
    onResult(r, result) {
      for (const st of result.stats) {
        leaderboard.add({
          name: st.name,
          avatar: st.avatar,
          score: st.score,
          level: st.maxLevel,
          kills: st.kills,
          map: r.mapId,
          won: result.winner === st.id,
          date: Date.now(),
        });
      }
      io.emit('leaderboard', leaderboard.top());
    },
    onEmpty(r) {
      rooms.delete(r.code);
    },
  });
  rooms.set(room.code, room);
  return room;
}

function currentSeat(token: string): { room: Room; seat: Seat } | null {
  const ref = tokens.get(token);
  if (!ref) return null;
  const room = rooms.get(ref.code);
  const seat = room?.seats.find((s) => s.id === ref.seatId);
  if (!room || !seat) {
    tokens.delete(token);
    return null;
  }
  return { room, seat };
}

function leaveCurrent(token: string) {
  const cur = currentSeat(token);
  if (!cur) return;
  tokens.delete(token);
  cur.room.removeSeat(cur.seat, 'left');
}

function seatIn(room: Room, token: string, profile: Profile, socket: Socket) {
  const seat = room.addSeat(token, profile, socket.id);
  tokens.set(token, { code: room.code, seatId: seat.id });
}

/** Simple token bucket: `rate` events per second, burst `burst`. */
function limiter(rate: number, burst: number) {
  let tokensLeft = burst;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokensLeft = Math.min(burst, tokensLeft + ((now - last) / 1000) * rate);
    last = now;
    if (tokensLeft < 1) return false;
    tokensLeft -= 1;
    return true;
  };
}

let logBudget = 20; // rate-limit noisy logs
setInterval(() => (logBudget = 20), 60000);
const log = (...a: unknown[]) => {
  if (logBudget-- > 0) console.log(...a);
};

io.on('connection', (socket) => {
  let token = '';
  const inputLimit = limiter(45, 60);
  const actionLimit = limiter(8, 12);

  socket.on('hello', (d) => {
    if (!d || typeof d.token !== 'string' || d.token.length < 8 || d.token.length > 64) return;
    if (d.v !== PROTOCOL_VERSION) {
      socket.emit('errorMsg', { message: 'A new version of Hole World is available — please reload the page.' });
      return;
    }
    token = d.token;
    const cur = currentSeat(token);
    if (cur) {
      // reconnection: take over the seat (also kicks a stale duplicate tab)
      const old = cur.seat.socketId && cur.seat.socketId !== socket.id ? io.sockets.sockets.get(cur.seat.socketId) : null;
      old?.emit('roomLeft', { reason: 'opened in another tab' });
      old?.leave(cur.room.channel);
      cur.room.attachSocket(cur.seat, socket.id);
      socket.emit('hello', { playerToken: token, resumed: true });
      log(`[resume] ${cur.seat.profile.name} -> ${cur.room.code}`);
    } else socket.emit('hello', { playerToken: token, resumed: false });
    socket.emit('leaderboard', leaderboard.top());
  });

  const guard = () => !!token && actionLimit();

  socket.on('quickMatch', (d) => {
    if (!guard()) return;
    const profile = sanitizeProfile(d?.profile);
    const pref = isMapId(d?.mapId) ? d.mapId : MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)];
    leaveCurrent(token);
    const open = [...rooms.values()].find((r) => !r.isPrivate && r.phase === 'lobby' && r.seats.length === 1 && r.seats[0].connected && r.seats[0].token !== token);
    const room = open ?? createRoom(false, pref);
    seatIn(room, token, profile, socket);
  });

  socket.on('createRoom', (d) => {
    if (!guard()) return;
    const profile = sanitizeProfile(d?.profile);
    leaveCurrent(token);
    const room = createRoom(true, isMapId(d?.mapId) ? d.mapId : 'pink');
    seatIn(room, token, profile, socket);
  });

  socket.on('joinRoom', (d) => {
    if (!guard()) return;
    const code = typeof d?.code === 'string' ? d.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : '';
    const room = rooms.get(code);
    if (!room) return void socket.emit('errorMsg', { message: `Room ${code || '?'} not found.` });
    const existing = room.seatByToken(token);
    if (existing) return void room.attachSocket(existing, socket.id);
    if (room.isFull()) return void socket.emit('errorMsg', { message: `Room ${code} is full.` });
    if (room.phase !== 'lobby' && room.phase !== 'ended') return void socket.emit('errorMsg', { message: 'That match already started.' });
    leaveCurrent(token);
    seatIn(room, token, sanitizeProfile(d?.profile), socket);
  });

  socket.on('leaveRoom', () => {
    if (!token) return;
    leaveCurrent(token);
    socket.emit('roomLeft', { reason: 'left' });
  });

  socket.on('setMap', (d) => {
    if (!guard() || !isMapId(d?.mapId)) return;
    const cur = currentSeat(token);
    cur?.room.setMap(cur.seat.id, d.mapId);
  });

  socket.on('input', (d) => {
    if (!token || !inputLimit()) return;
    if (!d || typeof d.x !== 'number' || typeof d.z !== 'number') return;
    const cur = currentSeat(token);
    if (cur?.seat.socketId === socket.id) cur.room.match?.setInput(cur.seat.id, d.x, d.z);
  });

  socket.on('dash', () => {
    if (!guard()) return;
    const cur = currentSeat(token);
    cur?.room.match?.dash(cur.seat.id);
  });

  socket.on('vortex', () => {
    if (!guard()) return;
    const cur = currentSeat(token);
    cur?.room.match?.vortex(cur.seat.id);
  });

  socket.on('upgrade', (d) => {
    if (!guard() || typeof d?.k !== 'string') return;
    const cur = currentSeat(token);
    if (d.k === 'speed' || d.k === 'reach' || d.k === 'appetite') cur?.room.match?.upgrade(cur.seat.id, d.k);
  });

  socket.on('rematch', () => {
    if (!guard()) return;
    const cur = currentSeat(token);
    cur?.room.voteRematch(cur.seat.id);
  });

  socket.on('getLeaderboard', () => {
    if (guard()) socket.emit('leaderboard', leaderboard.top());
  });

  socket.on('ping2', (d) => {
    if (typeof d?.t === 'number') socket.emit('pong2', { t: d.t });
  });

  socket.on('disconnect', () => {
    if (!token) return;
    const cur = currentSeat(token);
    if (cur && cur.seat.socketId === socket.id) cur.room.detachSocket(cur.seat);
  });
});

setInterval(() => {
  const all = [...rooms.values()];
  io.emit('stats', {
    online: io.engine.clientsCount,
    rooms: all.filter((r) => r.phase === 'playing' || r.phase === 'countdown').length,
    waiting: all.filter((r) => !r.isPrivate && r.phase === 'lobby' && r.seats.length === 1).length,
  });
}, 4000);

// ---------- HTTP ----------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: PROTOCOL_VERSION, rooms: rooms.size, online: io.engine.clientsCount, maps: Object.keys(MAPS) });
});
app.get('/api/leaderboard', (_req, res) => {
  res.json(leaderboard.top(50));
});

if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  console.log('[http] serving client from', CLIENT_DIST);
} else {
  app.get('/', (_req, res) => res.send('Hole World multiplayer server is running. Build the client to serve it from here.'));
}

server.listen(PORT, () => console.log(`[hole-world] server listening on :${PORT}`));
