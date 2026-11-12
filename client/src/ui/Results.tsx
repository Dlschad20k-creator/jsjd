import { useEffect } from 'react';
import { MAPS } from '@shared/maps';
import { sfx } from '../audio/Audio';
import { net } from '../net/socket';
import { useStore, useT } from '../store';
import { Avatar } from './Icons';

export function Results() {
  const t = useT();
  const result = useStore((s) => s.result);
  const room = useStore((s) => s.room);
  const world = useStore((s) => s.world);
  const lb = useStore((s) => s.leaderboard);
  const won = result?.winner === room?.you;
  const draw = result && !result.winner;

  useEffect(() => {
    if (!result) return;
    if (won) sfx.win();
    else if (!draw) sfx.lose();
    if (won && world) sfx.say(MAPS[world.mapId].winQuips[Math.floor(Math.random() * 3)]);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!result || !room) return null;
  const me = room.players.find((p) => p.id === room.you);
  const opp = room.players.find((p) => p.id !== room.you);
  const oppGone = room.players.length < 2;
  const map = world ? MAPS[world.mapId] : null;
  const sorted = [...result.stats].sort((a, b) => b.score - a.score);

  return (
    <div className="results-backdrop">
      <div className={`glass card results ${won ? 'won' : draw ? 'draw' : 'lost'}`}>
        <div className="result-title">{won ? t('victory') : draw ? t('draw') : t('defeat')}</div>
        {won && map && <div className="result-quip">{map.winQuips[0]}</div>}
        {result.reason === 'forfeit' && <div className="muted">{t('forfeit')}</div>}
        <div className="result-players">
          {sorted.map((s, i) => (
            <div key={s.id} className={`rp ${s.id === result.winner ? 'winner' : ''}`} style={{ ['--pc' as string]: s.color }}>
              <div className="rank">#{i + 1}</div>
              <Avatar id={s.avatar} color={s.color} size={64} />
              <div className="rp-name">
                {s.name}
                {s.id === room.you && <span className="tag">{t('you')}</span>}
              </div>
              <div className="rp-score">{s.score.toLocaleString()}</div>
              <div className="rp-grid">
                <span>{t('maxLevel')}</span>
                <b>{s.maxLevel}</b>
                <span>{t('kills')}</span>
                <b>{s.kills}</b>
                <span>{t('deaths')}</span>
                <b>{s.deaths}</b>
                <span>{t('eaten')}</span>
                <b>{s.eaten}</b>
                <span>{t('maxCombo')}</span>
                <b>x{s.maxCombo}</b>
              </div>
            </div>
          ))}
        </div>
        <div className="row center">
          {!oppGone ? (
            <button className="btn primary" disabled={!!me?.rematch} onClick={() => (sfx.click(), net.rematch())}>
              {me?.rematch ? t('waitingRematch') : t('rematch')}
            </button>
          ) : (
            <button className="btn primary" onClick={() => useStore.setState({ result: null, world: null, screen: 'lobby' })}>
              {t('backLobby')}
            </button>
          )}
          <button className="btn" onClick={() => (sfx.click(), net.leave())}>
            {t('menu')}
          </button>
        </div>
        {opp?.rematch && !me?.rematch && <div className="pulse-text">{t('oppWantsRematch')}</div>}
        {lb.length > 0 && (
          <div className="mini-lb">
            <div className="field-label">{t('topScores')}</div>
            {lb.slice(0, 5).map((e, i) => (
              <div key={i} className="lb-row">
                <span>#{i + 1}</span>
                <Avatar id={e.avatar} color="#a259ff" size={22} />
                <span className="lb-name">{e.name}</span>
                <b>{e.score.toLocaleString()}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
