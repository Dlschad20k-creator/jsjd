/**
 * Room lifecycle (design/gdd.md §6): lobby → starting → countdown → playing → ended → (rematch).
 * State transitions:
 *   lobby    --2 connected players-->  starting
 *   starting --player leaves-->        lobby
 *   starting --LOBBY_COUNTDOWN elapsed--> countdown (Match created)
 *   countdown/playing --Match.phase=ended--> ended
 *   ended    --both vote rematch-->    starting
 *   ended    --player leaves-->        lobby
 */
import type { Server } from 'socket.io';
import { LOBBY_COUNTDOWN, RECONNECT_GRACE, TICK_RATE } from '../../../shared/src/constants';
import type { ClientToServer, MapId, MatchResult, Profile, RoomInfo, RoomPhase, ServerToClient } from '../../../shared/src/protocol';
import { Match } from './Match';

export interface Seat {
  id: string;
  token: string;
  profile: Profile;
  socketId: string | null;
  connected: boolean;
  rematch: boolean;
  graceTimer: NodeJS.Timeout | null;
}

export interface RoomHooks {
  onResult(room: Room, result: MatchResult): void;
  onEmpty(room: Room): void;
}

type IO = Server<ClientToServer, ServerToClient>;

let seatSeq = 1;

export class Room {
  readonly code: string;
  readonly isPrivate: boolean;
  mapId: MapId;
  phase: RoomPhase = 'lobby';
  seats: Seat[] = [];
  hostId: string | null = null;
  startsIn = 0;
  match: Match | null = null;
  lastResult: MatchResult | null = null;
  private io: IO;
  private hooks: RoomHooks;
  private startTimer: NodeJS.Timeout | null = null;
  private loop: NodeJS.Timeout | null = null;
  private lastTick = 0;
  private acc = 0;
  createdAt = Date.now();

  constructor(io: IO, code: string, isPrivate: boolean, mapId: MapId, hooks: RoomHooks) {
    this.io = io;
    this.code = code;
    this.isPrivate = isPrivate;
    this.mapId = mapId;
    this.hooks = hooks;
  }

  get channel() {
    return 'room:' + this.code;
  }

  isFull() {
    return this.seats.length >= 2;
  }

  seatByToken(token: string) {
    return this.seats.find((s) => s.token === token) ?? null;
  }

  addSeat(token: string, profile: Profile, socketId: string): Seat {
    const seat: Seat = { id: 'p' + seatSeq++, token, profile, socketId, connected: true, rematch: false, graceTimer: null };
    this.seats.push(seat);
    if (!this.hostId) this.hostId = seat.id;
    const sock = this.io.sockets.sockets.get(socketId);
    sock?.join(this.channel);
    this.evaluate();
    this.broadcastRoom();
    return seat;
  }

  removeSeat(seat: Seat, reason = 'left') {
    if (seat.graceTimer) clearTimeout(seat.graceTimer);
    const sock = seat.socketId ? this.io.sockets.sockets.get(seat.socketId) : null;
    sock?.leave(this.channel);
    if (sock && reason !== 'left') sock.emit('roomLeft', { reason });
    this.seats = this.seats.filter((s) => s !== seat);
    if (this.hostId === seat.id) this.hostId = this.seats[0]?.id ?? null;
    if (this.match && (this.phase === 'countdown' || this.phase === 'playing')) {
      this.match.forfeit(this.match.players.has(seat.id) ? seat.id : '');
      this.finishMatch();
    }
    if (this.phase === 'ended' || this.phase === 'starting') this.toLobby();
    if (this.seats.length === 0) {
      this.dispose();
      this.hooks.onEmpty(this);
      return;
    }
    this.broadcastRoom();
  }

  attachSocket(seat: Seat, socketId: string) {
    if (seat.graceTimer) clearTimeout(seat.graceTimer);
    seat.graceTimer = null;
    seat.socketId = socketId;
    seat.connected = true;
    const sock = this.io.sockets.sockets.get(socketId);
    sock?.join(this.channel);
    this.match?.setConnected(seat.id, true);
    if (sock && this.match && (this.phase === 'countdown' || this.phase === 'playing')) sock.emit('world', this.match.worldInit());
    if (sock && this.phase === 'ended' && this.lastResult) sock.emit('result', this.lastResult);
    this.evaluate();
    this.broadcastRoom();
  }

  detachSocket(seat: Seat) {
    seat.connected = false;
    seat.socketId = null;
    this.match?.setConnected(seat.id, false);
    const inGame = this.phase === 'countdown' || this.phase === 'playing';
    if (this.phase === 'starting') this.toLobby();
    const grace = inGame ? RECONNECT_GRACE * 1000 : 8000;
    seat.graceTimer = setTimeout(() => this.removeSeat(seat, 'timeout'), grace);
    this.broadcastRoom();
  }

  setMap(seatId: string, mapId: MapId) {
    if (seatId !== this.hostId) return;
    if (this.phase !== 'lobby' && this.phase !== 'starting' && this.phase !== 'ended') return;
    this.mapId = mapId;
    if (this.phase === 'starting') this.startsIn = LOBBY_COUNTDOWN;
    this.broadcastRoom();
  }

  voteRematch(seatId: string) {
    if (this.phase !== 'ended') return;
    const seat = this.seats.find((s) => s.id === seatId);
    if (!seat) return;
    seat.rematch = true;
    if (this.seats.length === 2 && this.seats.every((s) => s.rematch && s.connected)) {
      this.phase = 'lobby';
      this.evaluate();
    }
    this.broadcastRoom();
  }

  private toLobby() {
    if (this.startTimer) clearInterval(this.startTimer);
    this.startTimer = null;
    this.phase = 'lobby';
    this.startsIn = 0;
    for (const s of this.seats) s.rematch = false;
  }

  /** Start the pre-match countdown when exactly two connected players are seated. */
  private evaluate() {
    if (this.phase !== 'lobby') return;
    if (this.seats.length < 2 || !this.seats.every((s) => s.connected)) return;
    this.phase = 'starting';
    this.startsIn = LOBBY_COUNTDOWN;
    if (this.startTimer) clearInterval(this.startTimer);
    this.startTimer = setInterval(() => {
      if (this.phase !== 'starting') return;
      this.startsIn -= 1;
      if (this.startsIn <= 0) {
        if (this.startTimer) clearInterval(this.startTimer);
        this.startTimer = null;
        this.startMatch();
      } else this.broadcastRoom();
    }, 1000);
  }

  private startMatch() {
    const seed = (Math.random() * 2 ** 31) | 0;
    this.match = new Match(
      this.mapId,
      seed,
      this.seats.map((s) => ({ id: s.id, name: s.profile.name, avatar: s.profile.avatar, color: s.profile.color })),
    );
    this.lastResult = null;
    for (const s of this.seats) s.rematch = false;
    this.phase = 'countdown';
    this.io.to(this.channel).emit('world', this.match.worldInit());
    this.broadcastRoom();
    this.lastTick = performance.now();
    this.acc = 0;
    if (this.loop) clearInterval(this.loop);
    this.loop = setInterval(() => this.tick(), 1000 / TICK_RATE);
  }

  private tick() {
    const m = this.match;
    if (!m) return;
    const now = performance.now();
    this.acc += Math.min(250, now - this.lastTick) / 1000;
    this.lastTick = now;
    const dt = 1 / TICK_RATE;
    let steps = 0;
    while (this.acc >= dt && steps < 5) {
      m.step(dt);
      this.acc -= dt;
      steps++;
    }
    if (m.phase === 'playing' && this.phase === 'countdown') {
      this.phase = 'playing';
      this.broadcastRoom();
    }
    if (m.phase === 'ended') {
      this.finishMatch();
      return;
    }
    this.io.to(this.channel).emit('snap', m.snapshot(this.phase));
  }

  private finishMatch() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    const m = this.match;
    if (!m || this.phase === 'ended') return;
    this.phase = 'ended';
    this.io.to(this.channel).emit('snap', m.snapshot('ended'));
    const result = m.result();
    this.lastResult = result;
    this.io.to(this.channel).emit('result', result);
    this.hooks.onResult(this, result);
    this.broadcastRoom();
  }

  info(forSeat: Seat): RoomInfo {
    return {
      code: this.code,
      isPrivate: this.isPrivate,
      mapId: this.mapId,
      phase: this.phase,
      startsIn: this.startsIn,
      you: forSeat.id,
      players: this.seats.map((s) => ({ ...s.profile, id: s.id, connected: s.connected, host: s.id === this.hostId, rematch: s.rematch })),
    };
  }

  broadcastRoom() {
    for (const s of this.seats) {
      if (!s.socketId) continue;
      this.io.sockets.sockets.get(s.socketId)?.emit('room', this.info(s));
    }
  }

  dispose() {
    if (this.loop) clearInterval(this.loop);
    if (this.startTimer) clearInterval(this.startTimer);
    for (const s of this.seats) if (s.graceTimer) clearTimeout(s.graceTimer);
    this.loop = null;
    this.startTimer = null;
  }
}
