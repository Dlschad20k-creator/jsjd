import { useEffect, useRef } from 'react';
import { DASH_CD, MATCH_DURATION, MAX_UPGRADE, POWERUPS, PVP_RATIO, UPGRADES, UPGRADE_KINDS, VORTEX_CD, type PowerupKind } from '@shared/constants';
import { MAPS } from '@shared/maps';
import type { PlayerSnap } from '@shared/protocol';
import { gameActions, joystickState } from '../game/Input';
import { isTouchDevice, useStore, useT } from '../store';
import { ActionIcon, Avatar, PowerIcon, UpgradeIcon } from './Icons';

function fmt(t: number) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function PlayerCard({ p, side }: { p: PlayerSnap | null; side: 'left' | 'right' }) {
  const t = useT();
  const room = useStore((s) => s.room);
  const info = room?.players.find((x) => x.id === p?.id);
  if (!p || !info) return <div className={`pcard ${side} glass`} />;
  return (
    <div className={`pcard ${side} glass ${p.dead > 0 ? 'dead' : ''}`} style={{ ['--pc' as string]: info.color }}>
      <Avatar id={info.avatar} color={info.color} size={44} />
      <div className="pcard-body">
        <div className="pcard-name">
          {info.name}
          {!p.conn && <span className="tag warn">{t('disconnected')}</span>}
        </div>
        <div className="pcard-stats">
          <span className="lvl">
            {t('level')} {p.lvl}
          </span>
          <span>{p.score.toLocaleString()}</span>
          <span className="kd">
            {p.kills}/{p.deaths}
          </span>
        </div>
        <div className="xpbar">
          <div style={{ width: `${Math.round(p.xpf * 100)}%` }} />
        </div>
        <div className="fx-row">
          {(Object.keys(p.fx) as PowerupKind[]).map((k) => (
            <span key={k} className="fx" style={{ borderColor: POWERUPS[k].color }} title={POWERUPS[k].name}>
              <PowerIcon k={k} size={14} />
              {Math.ceil(p.fx[k] ?? 0)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const world = useStore((s) => s.world);
  const hud = useStore((s) => s.hud);
  const room = useStore((s) => s.room);
  useEffect(() => {
    const c = ref.current;
    if (!c || !world) return;
    const ctx = c.getContext('2d')!;
    const S = c.width;
    const L = world.layout;
    const k = S / L.size;
    const X = (v: number) => (v + L.size / 2) * k;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(10,6,20,0.55)';
    ctx.fillRect(0, 0, S, S);
    const accent = MAPS[world.mapId].ui.accent;
    for (let j = 0; j < L.n; j++)
      for (let i = 0; i < L.n; i++) {
        const type = L.blocks[j * L.n + i];
        const x0 = X(-L.size / 2 + L.road + i * (L.block + L.road));
        const z0 = X(-L.size / 2 + L.road + j * (L.block + L.road));
        ctx.fillStyle = type === 'park' ? 'rgba(120,220,140,0.45)' : type === 'landmark' ? accent : type === 'plaza' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.14)';
        ctx.fillRect(x0, z0, L.block * k, L.block * k);
      }
    for (const pu of hud.pus) {
      ctx.fillStyle = POWERUPS[pu.k].color;
      ctx.beginPath();
      ctx.arc(X(pu.x), X(pu.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of [hud.opp, hud.me]) {
      if (!p || p.dead > 0) continue;
      const info = room?.players.find((x) => x.id === p.id);
      ctx.fillStyle = info?.color ?? '#fff';
      ctx.strokeStyle = p === hud.me ? '#fff' : '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(p.x), X(p.z), Math.max(3.5, p.R * k), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [hud, world, room]);
  return <canvas ref={ref} className="minimap glass" width={150} height={150} />;
}

function Cooldown({ cd, max, label, icon, onClick, hotkey }: { cd: number; max: number; label: string; icon: 'dash' | 'vortex'; onClick: () => void; hotkey: string }) {
  const pct = Math.max(0, Math.min(1, cd / max));
  return (
    <button
      className={`ability ${cd > 0 ? 'cooling' : 'ready'}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      aria-label={label}
    >
      <svg className="ring" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" />
        <circle cx="20" cy="20" r="18" className="fill" style={{ strokeDashoffset: 113 * pct }} />
      </svg>
      <ActionIcon k={icon} />
      <span className="ab-label">{cd > 0 ? Math.ceil(cd) : label}</span>
      {!isTouchDevice && <kbd>{hotkey}</kbd>}
    </button>
  );
}

export function Hud() {
  const t = useT();
  const hud = useStore((s) => s.hud);
  const feed = useStore((s) => s.feed);
  const world = useStore((s) => s.world);
  const { me, opp } = hud;
  const map = world ? MAPS[world.mapId] : null;
  let threat: 'eat' | 'danger' | null = null;
  if (me && opp && me.dead <= 0 && opp.dead <= 0) {
    if (me.R >= opp.R * PVP_RATIO && !opp.fx.shield && opp.prot <= 0) threat = 'eat';
    else if (opp.R >= me.R * PVP_RATIO && !me.fx.shield && me.prot <= 0) threat = 'danger';
  }
  const total = (me?.score ?? 0) + (opp?.score ?? 0) || 1;

  return (
    <div className="hud">
      <div className="hud-top">
        <PlayerCard p={me} side="left" />
        <div className="timer glass">
          <div className={`time ${hud.timeLeft < 30 && hud.phase === 'playing' ? 'urgent' : ''}`}>{fmt(hud.timeLeft)}</div>
          <div className="tug">
            <div className="tug-me" style={{ width: `${((me?.score ?? 0) / total) * 100}%` }} />
          </div>
          <div className="ping">
            {hud.ping}ms · {hud.fps}fps
          </div>
        </div>
        <PlayerCard p={opp} side="right" />
      </div>

      <div className="feed">
        {feed.map((f) => (
          <div key={f.id} className={`feed-item ${f.icon ?? ''}`} style={{ borderColor: f.color }}>
            {f.text}
          </div>
        ))}
      </div>

      {threat && <div className={`threat ${threat}`}>{threat === 'eat' ? t('canEat') : t('danger')}</div>}

      {me && me.combo >= 3 && (
        <div className="combo" key={Math.floor(me.combo / 5)}>
          <span>{t('combo')}</span> x{me.combo}
        </div>
      )}

      {hud.phase === 'countdown' && hud.countdown > 0 && (
        <div className="countdown" key={Math.ceil(hud.countdown)}>
          {Math.ceil(hud.countdown)}
        </div>
      )}
      {hud.phase === 'playing' && hud.timeLeft > MATCH_DURATION - 1.4 && <div className="countdown go">{t('go')}</div>}

      {me && me.dead > 0 && (
        <div className="death glass">
          <div className="death-title">{t('youWereEaten')}</div>
          <div>
            {t('respawnIn')} {Math.ceil(me.dead)}
          </div>
        </div>
      )}
      {opp && !opp.conn && <div className="banner warn">{t('oppReconnecting')}</div>}

      {me && me.upPts > 0 && me.dead <= 0 && (
        <div className="upgrades">
          <div className="up-title">
            {t('upgrades')} · {me.upPts}
          </div>
          <div className="up-cards">
            {UPGRADE_KINDS.map((k, i) => {
              const lvl = me.up[k];
              const maxed = lvl >= MAX_UPGRADE;
              return (
                <button
                  key={k}
                  className={`up-card glass ${maxed ? 'maxed' : ''}`}
                  disabled={maxed}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    gameActions.upgrade(i);
                  }}
                >
                  <UpgradeIcon k={k} />
                  <div className="up-name">{UPGRADES[k].name}</div>
                  <div className="up-desc">{UPGRADES[k].desc}</div>
                  <div className="pips">
                    {Array.from({ length: MAX_UPGRADE }, (_, j) => (
                      <i key={j} className={j < lvl ? 'on' : ''} />
                    ))}
                  </div>
                  {!isTouchDevice && <kbd>{i + 1}</kbd>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="abilities">
        <Cooldown cd={me?.vortexCd ?? 0} max={VORTEX_CD} label={t('vortex')} icon="vortex" onClick={() => gameActions.vortex()} hotkey="E" />
        <Cooldown cd={me?.dashCd ?? 0} max={DASH_CD} label={t('dash')} icon="dash" onClick={() => gameActions.dash()} hotkey="Space" />
      </div>
      <Minimap />
      {map && <div className="map-chip glass">{map.name}</div>}
      <Joystick />
    </div>
  );
}

function Joystick() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isTouchDevice) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      const j = joystickState;
      if (!el) return;
      el.style.display = j.active ? 'block' : 'none';
      el.style.transform = `translate(${j.ox - 60}px, ${j.oy - 60}px)`;
      (el.firstChild as HTMLElement).style.transform = `translate(${j.dx}px, ${j.dy}px)`;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={ref} className="joystick" style={{ display: 'none' }}>
      <div className="knob" />
    </div>
  );
}
