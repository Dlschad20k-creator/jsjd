import type { PowerupKind, UpgradeKind } from './constants';

export type MapId = 'pink' | 'bunny' | 'berlin';

export interface Profile {
  name: string;
  avatar: string;
  color: string;
}

export type BlockType = 'city' | 'park' | 'plaza' | 'landmark';

export interface Layout {
  size: number;
  block: number;
  road: number;
  n: number;
  blocks: BlockType[]; // n*n, row-major (z then x)
}

/** Compact world object: [kindIndex, x, z, rotation] */
export type WireObject = [number, number, number, number];

export interface WorldInit {
  mapId: MapId;
  layout: Layout;
  objects: WireObject[];
  dead: number[]; // object ids currently swallowed (for reconnects)
}

export type RoomPhase = 'lobby' | 'starting' | 'countdown' | 'playing' | 'ended';

export interface LobbyPlayer extends Profile {
  id: string;
  connected: boolean;
  host: boolean;
  rematch: boolean;
}

export interface RoomInfo {
  code: string;
  isPrivate: boolean;
  mapId: MapId;
  phase: RoomPhase;
  players: LobbyPlayer[];
  startsIn: number; // seconds (lobby countdown)
  you: string; // your player id
}

export interface PlayerSnap {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  R: number;
  lvl: number;
  xpf: number; // 0..1 progress to next level
  score: number;
  kills: number;
  deaths: number;
  combo: number;
  dead: number; // seconds until respawn, 0 = alive
  prot: number; // spawn protection seconds
  conn: boolean;
  dashCd: number;
  dash: number;
  vortexCd: number;
  fx: Partial<Record<PowerupKind, number>>; // remaining seconds
  up: Record<UpgradeKind, number>;
  upPts: number;
}

export interface PowerupSnap {
  id: number;
  k: PowerupKind;
  x: number;
  z: number;
}

export type GameEvent =
  | { t: 'eat'; o: number; p: string; xp: number; c: number }
  | { t: 'spawn'; o: number }
  | { t: 'kill'; k: string; v: string; xp: number }
  | { t: 'respawn'; p: string }
  | { t: 'level'; p: string; l: number }
  | { t: 'pu'; p: string; k: PowerupKind; id: number }
  | { t: 'dash'; p: string }
  | { t: 'vortex'; p: string }
  | { t: 'upgrade'; p: string; k: UpgradeKind };

export interface Snapshot {
  t: number; // server time ms
  phase: RoomPhase;
  timeLeft: number;
  countdown: number;
  players: PlayerSnap[];
  pus: PowerupSnap[];
  ev: GameEvent[];
}

export interface MatchResult {
  winner: string | null; // player id, null = draw
  reason: 'time' | 'forfeit';
  stats: {
    id: string;
    name: string;
    avatar: string;
    color: string;
    score: number;
    level: number;
    maxLevel: number;
    kills: number;
    deaths: number;
    eaten: number;
    maxCombo: number;
  }[];
}

export interface LeaderEntry {
  name: string;
  avatar: string;
  score: number;
  level: number;
  kills: number;
  map: MapId;
  won: boolean;
  date: number;
}

export interface InputMsg {
  x: number;
  z: number;
}

// Socket.IO event typing
export interface ServerToClient {
  hello: (d: { playerToken: string; resumed: boolean }) => void;
  room: (d: RoomInfo) => void;
  roomLeft: (d: { reason: string }) => void;
  world: (d: WorldInit) => void;
  snap: (d: Snapshot) => void;
  result: (d: MatchResult) => void;
  errorMsg: (d: { message: string }) => void;
  leaderboard: (d: LeaderEntry[]) => void;
  stats: (d: { online: number; rooms: number; waiting: number }) => void;
  pong2: (d: { t: number }) => void;
}

export interface ClientToServer {
  hello: (d: { token: string; v: number }) => void;
  quickMatch: (d: { profile: Profile; mapId: MapId | 'random' }) => void;
  createRoom: (d: { profile: Profile; mapId: MapId }) => void;
  joinRoom: (d: { profile: Profile; code: string }) => void;
  leaveRoom: () => void;
  setMap: (d: { mapId: MapId }) => void;
  input: (d: InputMsg) => void;
  dash: () => void;
  vortex: () => void;
  upgrade: (d: { k: UpgradeKind }) => void;
  rematch: () => void;
  getLeaderboard: () => void;
  ping2: (d: { t: number }) => void;
}
