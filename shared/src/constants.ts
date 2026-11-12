// Core gameplay tuning shared by server (authoritative) and client (prediction / UI).
// Every gameplay value lives here (data-driven, see design/gdd.md) — never hardcode in systems.

export const PROTOCOL_VERSION = 1;

export const TICK_RATE = 30; // server simulation + broadcast Hz
export const MATCH_DURATION = 180; // seconds
export const COUNTDOWN = 3; // in-game countdown before play
export const LOBBY_COUNTDOWN = 4; // after the 2nd player joins
export const RECONNECT_GRACE = 30; // seconds a disconnected player keeps their seat
export const RESPAWN_TIME = 3;
export const SPAWN_PROTECT = 3;

export const BASE_RADIUS = 1.2;
export const GROWTH = 1.13; // radius multiplier per level
export const MAX_LEVEL = 40;
export const FIT_RATIO = 0.86; // object radius must be <= hole radius * FIT_RATIO
export const PVP_RATIO = 1.12; // need to be 12% bigger to eat the opponent

export const DASH_CD = 6;
export const DASH_TIME = 0.35;
export const DASH_MULT = 2.6;
export const VORTEX_CD = 15;
export const VORTEX_RANGE = 2.4; // multiples of hole radius

export const COMBO_WINDOW = 1.6;
export const COMBO_MAX = 40;

export const MAX_UPGRADE = 5;
export type UpgradeKind = 'speed' | 'reach' | 'appetite';
export const UPGRADE_KINDS: UpgradeKind[] = ['speed', 'reach', 'appetite'];
export const UPGRADES: Record<UpgradeKind, { name: string; desc: string; perLevel: number }> = {
  speed: { name: 'Turbo Core', desc: '+7% movement speed', perLevel: 0.07 },
  reach: { name: 'Event Horizon', desc: '+12% pull reach', perLevel: 0.12 },
  appetite: { name: 'Appetite', desc: '+12% XP from everything', perLevel: 0.12 },
};

export type PowerupKind = 'turbo' | 'magnet' | 'shield' | 'giant' | 'slime';
export const POWERUPS: Record<PowerupKind, { name: string; duration: number; color: string; desc: string }> = {
  turbo: { name: 'Turbo', duration: 8, color: '#ffd23f', desc: 'Speed boost' },
  magnet: { name: 'Magnet', duration: 10, color: '#3fd0ff', desc: 'Pulls objects from further away' },
  shield: { name: 'Shield', duration: 7, color: '#7dff8a', desc: 'Cannot be swallowed' },
  giant: { name: 'Giant', duration: 8, color: '#ff4fd8', desc: '+30% size' },
  slime: { name: 'Slime', duration: 5, color: '#a6ff00', desc: 'Slows your opponent' },
};
export const TURBO_MULT = 1.55;
export const SLIME_MULT = 0.55;
export const GIANT_MULT = 1.3;
export const MAGNET_BONUS = 0.6; // extra capture reach, multiples of hole radius
export const POWERUP_PICK_RANGE = 0.8;
export const POWERUP_KINDS = Object.keys(POWERUPS) as PowerupKind[];
export const MAX_POWERUPS = 4;
export const POWERUP_INTERVAL = 7;

export function radiusForLevel(levelFloat: number): number {
  return BASE_RADIUS * Math.pow(GROWTH, Math.max(0, levelFloat - 1));
}

export function xpToNext(level: number): number {
  return Math.round(6 * Math.pow(1.3, level - 1));
}

export function objectXp(r: number): number {
  return Math.max(1, Math.round(10 * r * r));
}

export function baseSpeed(R: number): number {
  return 7.5 + R * 0.9;
}

export function comboMult(combo: number): number {
  return 1 + Math.min(combo, COMBO_MAX) * 0.05;
}

// Avatar ids — drawn as SVG on the client (no emoji art).
export const AVATARS = ['vortex', 'shades', 'bunny', 'crown', 'star', 'alien', 'robot', 'donut', 'flame', 'heart', 'cat', 'bolt'];

// Object respawn window and kill rewards
export const OBJECT_RESPAWN_MIN = 22;
export const OBJECT_RESPAWN_JITTER = 16;
export const KILL_XP_SHARE = 0.5; // share of victim's lifetime xp awarded
export const KILL_XP_BASE = 25;
export const KILL_SCORE_BASE = 150;
export const KILL_SCORE_PER_LEVEL = 25;
export const MOVE_ACCEL = 10;
export const COLORS = ['#ff3fa4', '#00e5ff', '#a259ff', '#ffb800', '#39ff88', '#ff5a36', '#ffffff', '#5b8cff'];
