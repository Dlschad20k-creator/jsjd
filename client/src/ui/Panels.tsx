import { useState } from 'react';
import { MAPS } from '@shared/maps';
import type { MapId } from '@shared/protocol';
import { sfx } from '../audio/Audio';
import { save, useStore, useT, type Settings } from '../store';
import { Avatar, IconBtn, PowerIcon } from './Icons';

function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  const close = () => useStore.setState({ panel: null });
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="glass card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="close">
            <IconBtn kind="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const t = useT();
  const s = useStore((st) => st.settings);
  const set = (p: Partial<Settings>) => {
    const next = { ...s, ...p };
    useStore.setState({ settings: next });
    save('settings', next);
    sfx.setVolumes(next.sfx, next.music);
    sfx.voice = next.voice;
    sfx.lang = next.lang;
  };
  return (
    <Modal title={t('settings')}>
      <div className="setting">
        <label>{t('music')}</label>
        <input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => set({ music: Number(e.target.value) })} />
      </div>
      <div className="setting">
        <label>{t('sfx')}</label>
        <input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => set({ sfx: Number(e.target.value) })} />
      </div>
      <div className="setting">
        <label>{t('voice')}</label>
        <input type="checkbox" checked={s.voice} onChange={(e) => set({ voice: e.target.checked })} />
      </div>
      <div className="setting">
        <label>{t('quality')}</label>
        <div className="seg">
          {(['auto', 'high', 'low'] as const).map((q) => (
            <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => set({ quality: q })}>
              {t(q)}
            </button>
          ))}
        </div>
      </div>
      <div className="setting">
        <label>{t('reducedMotion')}</label>
        <input type="checkbox" checked={s.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.checked })} />
      </div>
      <div className="setting">
        <label>{t('language')}</label>
        <div className="seg">
          {(['en', 'de'] as const).map((l) => (
            <button key={l} className={s.lang === l ? 'on' : ''} onClick={() => set({ lang: l })}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function LeaderboardPanel() {
  const t = useT();
  const lb = useStore((s) => s.leaderboard);
  const [filter, setFilter] = useState<MapId | 'all'>('all');
  const rows = lb.filter((e) => filter === 'all' || e.map === filter);
  return (
    <Modal title={t('leaderboard')}>
      <div className="seg wide">
        {(['all', 'pink', 'bunny', 'berlin'] as const).map((m) => (
          <button key={m} className={filter === m ? 'on' : ''} onClick={() => setFilter(m)}>
            {m === 'all' ? 'All' : MAPS[m].name.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="lb">
        {rows.length === 0 && <div className="muted center">{t('noScores')}</div>}
        {rows.slice(0, 25).map((e, i) => (
          <div key={i} className={`lb-row ${i < 3 ? 'top' + (i + 1) : ''}`}>
            <span className="lb-rank">#{i + 1}</span>
            <Avatar id={e.avatar} color={MAPS[e.map]?.ui.accent ?? '#fff'} size={28} />
            <span className="lb-name">
              {e.name}
              {e.won && <i className="win-dot" title="won" />}
            </span>
            <span className="lb-meta">
              {t('level')} {e.level} · {e.kills} KO · {MAPS[e.map]?.name.split(' ')[0]}
            </span>
            <b>{e.score.toLocaleString()}</b>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function HelpPanel() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  return (
    <Modal title={t('howTo')}>
      <div className="help">
        <div className="help-hero">
          <Avatar id={profile.avatar} color={profile.color} size={56} />
          <p>{t('helpWin')}</p>
        </div>
        <ul>
          <li>{t('helpMove')}</li>
          <li>{t('helpDash')}</li>
          <li>{t('helpVortex')}</li>
          <li>{t('helpUpgrade')}</li>
          <li>{t('helpPvp')}</li>
          <li>
            {t('helpPowerups')}
            <span className="pu-row">
              {(['turbo', 'magnet', 'shield', 'giant', 'slime'] as const).map((k) => (
                <PowerIcon key={k} k={k} />
              ))}
            </span>
          </li>
        </ul>
      </div>
    </Modal>
  );
}
