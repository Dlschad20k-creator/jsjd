/** UI state (display only). The game engine and socket push into it; UI never mutates game state directly. */
import { create } from 'zustand';
import { AVATARS, COLORS } from '@shared/constants';
import type { LeaderEntry, MapId, MatchResult, PlayerSnap, PowerupSnap, Profile, RoomInfo, WorldInit } from '@shared/protocol';
import { DICTS, type Lang, type TKey } from './i18n';

export type Screen = 'home' | 'lobby' | 'game';
export type Quality = 'auto' | 'high' | 'low';

export interface Settings {
  music: number;
  sfx: number;
  voice: boolean;
  quality: Quality;
  reducedMotion: boolean;
  lang: Lang;
}

export interface FeedItem {
  id: number;
  text: string;
  color: string;
  icon?: 'kill' | 'level' | 'power' | 'info';
}

export interface HudState {
  timeLeft: number;
  countdown: number;
  phase: string;
  me: PlayerSnap | null;
  opp: PlayerSnap | null;
  ping: number;
  fps: number;
  pus: PowerupSnap[];
}

interface State {
  screen: Screen;
  conn: 'connecting' | 'online' | 'offline';
  profile: Profile;
  mapPref: MapId | 'random';
  settings: Settings;
  room: RoomInfo | null;
  world: WorldInit | null;
  result: MatchResult | null;
  leaderboard: LeaderEntry[];
  stats: { online: number; rooms: number; waiting: number };
  toast: { id: number; text: string } | null;
  feed: FeedItem[];
  hud: HudState;
  panel: null | 'settings' | 'leaderboard' | 'help';
  error: string | null;
}

const LS = 'holeworld:';
function load<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(LS + k);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}
export function save(k: string, v: unknown) {
  try {
    localStorage.setItem(LS + k, JSON.stringify(v));
  } catch {
    /* storage optional */
  }
}

const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
const defaultLang: Lang = typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';

export const useStore = create<State>(() => ({
  screen: 'home',
  conn: 'connecting',
  profile: load<Profile>('profile', {
    name: '',
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }),
  mapPref: (load<{ m: MapId | 'random' }>('map', { m: 'random' }).m) as MapId | 'random',
  settings: load<Settings>('settings', { music: 0.45, sfx: 0.85, voice: true, quality: 'auto', reducedMotion: false, lang: defaultLang }),
  room: null,
  world: null,
  result: null,
  leaderboard: [],
  stats: { online: 0, rooms: 0, waiting: 0 },
  toast: null,
  feed: [],
  hud: { timeLeft: 0, countdown: 0, phase: 'lobby', me: null, opp: null, ping: 0, fps: 0, pus: [] },
  panel: null,
  error: null,
}));

export const isTouchDevice = isTouch;

let toastSeq = 1;
export function toast(text: string) {
  const id = toastSeq++;
  useStore.setState({ toast: { id, text } });
  setTimeout(() => {
    if (useStore.getState().toast?.id === id) useStore.setState({ toast: null });
  }, 2600);
}

let feedSeq = 1;
export function pushFeed(text: string, color: string, icon?: FeedItem['icon']) {
  const item = { id: feedSeq++, text, color, icon };
  useStore.setState((s) => ({ feed: [...s.feed.slice(-4), item] }));
  setTimeout(() => useStore.setState((s) => ({ feed: s.feed.filter((f) => f.id !== item.id) })), 4500);
}

export function t(key: TKey): string {
  return DICTS[useStore.getState().settings.lang][key];
}
export function useT() {
  const lang = useStore((s) => s.settings.lang);
  return (key: TKey) => DICTS[lang][key];
}
