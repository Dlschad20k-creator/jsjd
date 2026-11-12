import { useEffect, useRef } from 'react';
import { Engine } from '../game/Engine';
import { isTouchDevice, useStore } from '../store';
import { Hud } from './Hud';
import { Results } from './Results';

function pickQuality(q: 'auto' | 'high' | 'low'): 'high' | 'low' {
  if (q !== 'auto') return q;
  const cores = navigator.hardwareConcurrency || 4;
  return isTouchDevice || cores <= 4 ? 'low' : 'high';
}

export function GameView() {
  const ref = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const world = useStore((s) => s.world);
  const room = useStore((s) => s.room);
  const settings = useStore((s) => s.settings);
  const result = useStore((s) => s.result);

  useEffect(() => {
    if (!ref.current || !world || !room) return;
    const engine = new Engine(ref.current, world, room.you, room.players, { quality: pickQuality(settings.quality), reducedMotion: settings.reducedMotion });
    engineRef.current = engine;
    (window as unknown as { __HOLE__: unknown }).__HOLE__ = { debug: () => engine.debugState() };
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // a new world (new match) rebuilds the engine
  }, [world]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (room) engineRef.current?.updatePlayers(room.players);
  }, [room]);
  useEffect(() => {
    engineRef.current?.setOptions({ reducedMotion: settings.reducedMotion });
  }, [settings.reducedMotion]);

  return (
    <div className="screen game">
      <div ref={ref} className="game-root" />
      {world && <Hud />}
      {result && <Results />}
    </div>
  );
}
