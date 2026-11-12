import { useEffect, useState } from 'react';
import { AVATARS, COLORS } from '@shared/constants';
import { MAPS, MAP_IDS } from '@shared/maps';
import type { MapId } from '@shared/protocol';
import { sfx } from '../audio/Audio';
import { net } from '../net/socket';
import { save, useStore, useT } from '../store';
import { Avatar, IconBtn, MapEmblem } from './Icons';

export function TopBar() {
  const t = useT();
  const stats = useStore((s) => s.stats);
  const conn = useStore((s) => s.conn);
  const open = (panel: 'settings' | 'leaderboard' | 'help') => {
    sfx.click();
    useStore.setState({ panel });
    if (panel === 'leaderboard') net.leaderboard();
  };
  return (
    <div className="topbar">
      <div className={`pill conn-${conn}`}>
        <span className="dot" />
        {conn === 'online' ? (
          <>
            {stats.online} {t('online')} · {stats.rooms} {t('playing')} · {stats.waiting} {t('waitingPlayers')}
          </>
        ) : conn === 'connecting' ? (
          t('connecting')
        ) : (
          t('offline')
        )}
      </div>
      <div className="topbar-actions">
        <button className="icon-btn" aria-label={t('howTo')} onClick={() => open('help')}>
          <IconBtn kind="help" />
        </button>
        <button className="icon-btn" aria-label={t('leaderboard')} onClick={() => open('leaderboard')}>
          <IconBtn kind="trophy" />
        </button>
        <button className="icon-btn" aria-label={t('settings')} onClick={() => open('settings')}>
          <IconBtn kind="gear" />
        </button>
      </div>
    </div>
  );
}

export function Home() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const mapPref = useStore((s) => s.mapPref);
  const conn = useStore((s) => s.conn);
  const [code, setCode] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('room');
    if (q) setCode(q.toUpperCase().slice(0, 5));
    sfx.playMusic('menu');
  }, []);

  const setProfile = (p: Partial<typeof profile>) => {
    const next = { ...profile, ...p };
    useStore.setState({ profile: next });
    save('profile', next);
  };
  const setMap = (m: MapId | 'random') => {
    sfx.click();
    useStore.setState({ mapPref: m });
    save('map', { m });
  };
  const online = conn === 'online';
  const firstMap: MapId = mapPref === 'random' ? MAP_IDS[Math.floor(Math.random() * 3)] : mapPref;

  return (
    <div className="screen home">
      <TopBar />
      <header className="hero">
        <div className="logo-hole" aria-hidden>
          <div className="logo-swirl" />
        </div>
        <h1 className="logo">
          HOLE<span>WORLD</span>
        </h1>
        <div className="logo-sub">ULTIMATE MULTIPLAYER · 1v1</div>
        <p className="tagline">{t('tagline')}</p>
      </header>

      <div className="home-grid">
        <section className="glass card profile-card">
          <label className="field-label" htmlFor="name">
            {t('name')}
          </label>
          <div className="name-row">
            <Avatar id={profile.avatar} color={profile.color} size={52} />
            <input
              id="name"
              className="input"
              maxLength={16}
              placeholder="Hole Master"
              value={profile.name}
              onChange={(e) => setProfile({ name: e.target.value })}
            />
          </div>
          <div className="field-label">{t('avatar')}</div>
          <div className="avatar-grid">
            {AVATARS.map((a) => (
              <button key={a} className={`avatar-btn ${profile.avatar === a ? 'on' : ''}`} onClick={() => (sfx.click(), setProfile({ avatar: a }))} aria-label={a}>
                <Avatar id={a} color={profile.color} size={38} />
              </button>
            ))}
          </div>
          <div className="field-label">{t('color')}</div>
          <div className="color-row">
            {COLORS.map((c) => (
              <button key={c} className={`swatch ${profile.color === c ? 'on' : ''}`} style={{ background: c, boxShadow: `0 0 16px ${c}` }} onClick={() => (sfx.click(), setProfile({ color: c }))} aria-label={c} />
            ))}
          </div>
        </section>

        <section className="glass card play-card">
          <div className="field-label">{t('chooseMap')}</div>
          <div className="map-grid">
            {MAP_IDS.map((id) => {
              const m = MAPS[id];
              return (
                <button key={id} className={`map-card map-${id} ${mapPref === id ? 'on' : ''}`} style={{ ['--accent' as string]: m.ui.accent, ['--glow' as string]: m.ui.glow }} onClick={() => setMap(id)}>
                  <MapEmblem id={id} />
                  <div className="map-name">{m.name}</div>
                  <div className="map-sub">{m.subtitle}</div>
                </button>
              );
            })}
            <button className={`map-card map-random ${mapPref === 'random' ? 'on' : ''}`} onClick={() => setMap('random')}>
              <div className="random-dice" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <div className="map-name">{t('random')}</div>
            </button>
          </div>

          <button
            className="btn primary big"
            disabled={!online}
            onClick={() => {
              sfx.unlock();
              sfx.click();
              net.quickMatch(mapPref);
            }}
          >
            {t('quickMatch')}
            <small>{t('quickMatchSub')}</small>
          </button>
          <div className="row">
            <button
              className="btn"
              disabled={!online}
              onClick={() => {
                sfx.unlock();
                sfx.click();
                net.createRoom(firstMap);
              }}
            >
              {t('createRoom')}
            </button>
          </div>
          <form
            className="join-row"
            onSubmit={(e) => {
              e.preventDefault();
              sfx.unlock();
              if (code.trim().length >= 4) net.joinRoom(code.trim());
            }}
          >
            <input className="input code" placeholder={t('roomCode')} value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
            <button className="btn" disabled={!online || code.length < 4}>
              {t('joinRoom')}
            </button>
          </form>
        </section>
      </div>
      <footer className="foot">Original game · all art, models & sounds generated in code · v1.0</footer>
    </div>
  );
}
