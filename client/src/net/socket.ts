/**
 * Socket.IO client. Replication strategy (design/gdd.md §7):
 *  - snapshots: reliable, 30 Hz, server → client, remote holes interpolated (110 ms buffer)
 *  - input: 20 Hz + on change, client → server (direction only — server authoritative)
 *  - discrete actions (dash/vortex/upgrade): reliable, rate-limited on the server
 */
import { io, type Socket } from 'socket.io-client';
import { PROTOCOL_VERSION } from '@shared/constants';
import type { ClientToServer, MapId, Profile, ServerToClient, Snapshot, MatchResult } from '@shared/protocol';
import { save, toast, useStore, t } from '../store';
import { sfx } from '../audio/Audio';

type S = Socket<ServerToClient, ClientToServer>;

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) || undefined;

function getToken() {
  try {
    let tok = localStorage.getItem('holeworld:token');
    if (!tok) {
      tok = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('holeworld:token', tok);
    }
    return tok;
  } catch {
    return 'anon' + Math.random().toString(36).slice(2, 14);
  }
}

type SnapListener = (s: Snapshot) => void;

class Net {
  socket: S;
  token = getToken();
  private snapListeners = new Set<SnapListener>();
  ping = 0;
  /** estimated (local clock - server clock) in ms */
  clockOffset = 0;
  private offsetSamples: number[] = [];

  constructor() {
    this.socket = io(SERVER_URL ?? '/', { transports: ['websocket', 'polling'], reconnectionDelay: 600, reconnectionDelayMax: 3000 });
    const s = this.socket;
    s.on('connect', () => {
      useStore.setState({ conn: 'online' });
      s.emit('hello', { token: this.token, v: PROTOCOL_VERSION });
    });
    s.on('disconnect', () => useStore.setState({ conn: 'offline' }));
    s.on('connect_error', () => useStore.setState({ conn: 'offline' }));
    s.on('hello', () => {
      /* resumed seats re-send room/world automatically */
    });
    s.on('room', (room) => {
      const st = useStore.getState();
      const prev = st.room;
      let screen = st.screen;
      if (room.phase === 'countdown' || room.phase === 'playing') screen = 'game';
      else if (st.screen === 'game' && st.result) screen = 'game'; // keep the results overlay up
      else screen = 'lobby';
      if (prev && prev.players.length < 2 && room.players.length === 2) sfx.join();
      useStore.setState({ room, screen });
    });
    s.on('roomLeft', ({ reason }) => {
      if (reason !== 'left') toast(reason);
      useStore.setState({ room: null, world: null, result: null, screen: 'home' });
    });
    s.on('world', (world) => useStore.setState({ world, result: null, screen: 'game' }));
    s.on('snap', (snap) => {
      const now = Date.now();
      this.offsetSamples.push(now - snap.t);
      if (this.offsetSamples.length > 40) this.offsetSamples.shift();
      // the smallest observed offset approximates clock skew + minimum latency
      this.clockOffset = Math.min(...this.offsetSamples);
      for (const l of this.snapListeners) l(snap);
    });
    s.on('result', (r: MatchResult) => useStore.setState({ result: r }));
    s.on('errorMsg', ({ message }) => {
      toast(message);
      useStore.setState({ error: message });
    });
    s.on('leaderboard', (leaderboard) => useStore.setState({ leaderboard }));
    s.on('stats', (stats) => useStore.setState({ stats }));
    s.on('pong2', ({ t: sent }) => {
      this.ping = Math.round(performance.now() - sent);
    });
    setInterval(() => {
      if (s.connected) s.emit('ping2', { t: performance.now() });
    }, 2000);
  }

  onSnap(l: SnapListener) {
    this.snapListeners.add(l);
    return () => this.snapListeners.delete(l);
  }

  private profile(): Profile {
    const p = useStore.getState().profile;
    save('profile', p);
    return { ...p, name: p.name.trim() || 'Hole' + Math.floor(100 + Math.random() * 900) };
  }

  quickMatch(mapId: MapId | 'random') {
    this.socket.emit('quickMatch', { profile: this.profile(), mapId });
  }
  createRoom(mapId: MapId) {
    this.socket.emit('createRoom', { profile: this.profile(), mapId });
  }
  joinRoom(code: string) {
    this.socket.emit('joinRoom', { profile: this.profile(), code });
  }
  leave() {
    this.socket.emit('leaveRoom');
    useStore.setState({ room: null, world: null, result: null, screen: 'home' });
  }
  setMap(mapId: MapId) {
    this.socket.emit('setMap', { mapId });
  }
  input(x: number, z: number) {
    this.socket.emit('input', { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
  }
  dash() {
    this.socket.emit('dash');
  }
  vortex() {
    this.socket.emit('vortex');
  }
  upgrade(k: 'speed' | 'reach' | 'appetite') {
    this.socket.emit('upgrade', { k });
  }
  rematch() {
    this.socket.emit('rematch');
  }
  leaderboard() {
    this.socket.emit('getLeaderboard');
  }
}

export const net = new Net();
export { t };
