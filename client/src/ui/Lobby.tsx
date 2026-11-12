import { useState } from 'react';
import { MAPS, MAP_IDS } from '@shared/maps';
import { sfx } from '../audio/Audio';
import { net } from '../net/socket';
import { useStore, useT } from '../store';
import { Avatar, IconBtn, MapEmblem } from './Icons';
import { TopBar } from './Home';

export function Lobby() {
  const t = useT();
  const room = useStore((s) => s.room);
  const [copied, setCopied] = useState(false);
  if (!room) return null;
  const me = room.players.find((p) => p.id === room.you);
  const isHost = !!me?.host;
  const map = MAPS[room.mapId];
  const link = `${location.origin}${location.pathname}?room=${room.code}`;
  const starting = room.phase === 'starting';
  const slots = [0, 1].map((i) => room.players[i] ?? null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard may be blocked */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="screen lobby" style={{ ['--accent' as string]: map.ui.accent, ['--glow' as string]: map.ui.glow }}>
      <TopBar />
      <div className="glass card lobby-card">
        <div className="lobby-head">
          <button className="btn ghost small" onClick={() => (sfx.click(), net.leave())}>
            <IconBtn kind="back" /> {t('leave')}
          </button>
          <div className="lobby-kind">{room.isPrivate ? t('privateRoom') : t('publicRoom')}</div>
        </div>

        {room.isPrivate && (
          <div className="code-box">
            <div className="field-label">{t('roomCode')}</div>
            <div className="room-code" data-testid="room-code">
              {room.code.split('').map((c, i) => (
                <span key={i}>{c}</span>
              ))}
            </div>
            <div className="muted">{t('shareCode')}</div>
            <button className="btn small" onClick={copy}>
              <IconBtn kind="copy" /> {copied ? t('copied') : t('copyLink')}
            </button>
          </div>
        )}

        <div className="slots">
          {slots.map((p, i) => (
            <div key={i} className={`slot ${p ? 'filled' : 'empty'}`} style={p ? { ['--pc' as string]: p.color } : undefined}>
              {p ? (
                <>
                  <Avatar id={p.avatar} color={p.color} size={72} />
                  <div className="slot-name">{p.name}</div>
                  <div className="slot-tags">
                    {p.id === room.you && <span className="tag">{t('you')}</span>}
                    {p.host && <span className="tag">{t('host')}</span>}
                    {!p.connected && <span className="tag warn">{t('disconnected')}</span>}
                  </div>
                </>
              ) : (
                <>
                  <div className="radar" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="slot-name muted">{room.isPrivate ? t('waitingFor') : t('searching')}</div>
                </>
              )}
            </div>
          ))}
          <div className="vs">VS</div>
        </div>

        {starting ? (
          <div className="starting">
            <div className="muted">{t('opponentJoined')}</div>
            <div className="big-count" key={room.startsIn}>
              {t('startsIn')} {room.startsIn}
            </div>
          </div>
        ) : (
          <div className="muted center">{t('waitingFor')}</div>
        )}

        <div className="lobby-map">
          <div className="field-label">{map.name}</div>
          {isHost && room.isPrivate ? (
            <div className="map-grid small">
              {MAP_IDS.map((id) => (
                <button key={id} className={`map-card map-${id} ${room.mapId === id ? 'on' : ''}`} style={{ ['--accent' as string]: MAPS[id].ui.accent, ['--glow' as string]: MAPS[id].ui.glow }} onClick={() => (sfx.click(), net.setMap(id))}>
                  <MapEmblem id={id} size={40} />
                  <div className="map-name">{MAPS[id].name}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="map-preview">
              <MapEmblem id={room.mapId} size={64} />
              <div>
                <div className="map-sub">{map.subtitle}</div>
                <div className="muted">{map.description}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
