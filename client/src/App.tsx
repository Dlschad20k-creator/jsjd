import { useEffect } from 'react';
import { sfx } from './audio/Audio';
import { useStore, useT } from './store';
import { GameView } from './ui/GameView';
import { Home } from './ui/Home';
import { Lobby } from './ui/Lobby';
import { HelpPanel, LeaderboardPanel, SettingsPanel } from './ui/Panels';

export function App() {
  const t = useT();
  const screen = useStore((s) => s.screen);
  const panel = useStore((s) => s.panel);
  const toast = useStore((s) => s.toast);
  const conn = useStore((s) => s.conn);
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    sfx.setVolumes(settings.sfx, settings.music);
    sfx.voice = settings.voice;
    sfx.lang = settings.lang;
    document.documentElement.lang = settings.lang;
  }, [settings]);

  useEffect(() => {
    // iOS/Safari: audio may only start after a gesture
    const unlock = () => {
      sfx.unlock();
      if (useStore.getState().screen !== 'game') sfx.playMusic('menu');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (screen !== 'game') sfx.playMusic('menu');
  }, [screen]);

  return (
    <div className={`app reduced-${settings.reducedMotion}`}>
      <div className="bg-vortex" aria-hidden />
      {screen === 'home' && <Home />}
      {screen === 'lobby' && <Lobby />}
      {screen === 'game' && <GameView />}
      {panel === 'settings' && <SettingsPanel />}
      {panel === 'leaderboard' && <LeaderboardPanel />}
      {panel === 'help' && <HelpPanel />}
      {toast && (
        <div className="toast glass" key={toast.id}>
          {toast.text}
        </div>
      )}
      {screen === 'game' && conn !== 'online' && <div className="banner warn top">{t('reconnecting')}</div>}
    </div>
  );
}
