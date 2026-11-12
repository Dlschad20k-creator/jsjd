/** Offline world showcase: ?preview=pink|bunny|berlin[&cam=x,z,height,yaw][&q=high|low]. Used for art review + screenshots. */
import { useEffect, useRef } from 'react';
import { MAPS } from '@shared/maps';
import { generateWorld } from '@shared/mapgen';
import type { MapId } from '@shared/protocol';
import { Engine } from '../game/Engine';

export function Preview({ mapId }: { mapId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = (mapId in MAPS ? mapId : 'pink') as MapId;
    const q = new URLSearchParams(location.search);
    const w = generateWorld(MAPS[id], Number(q.get('seed') ?? 7));
    const engine = new Engine(ref.current!, { mapId: id, layout: w.layout, objects: w.objects, dead: [] }, 'none', [], { quality: (q.get('q') as 'high' | 'low') ?? 'high', reducedMotion: true, offline: true });
    const [x, z, h, yaw] = (q.get('cam') ?? '0,30,60,0').split(',').map(Number);
    engine.debugCam = { x, z, h, yaw: yaw || 0 };
    (window as unknown as { __HOLE__: unknown }).__HOLE__ = {
      debug: () => engine.debugState(),
      cam: (x: number, z: number, h: number, yaw = 0) => (engine.debugCam = { x, z, h, yaw }),
    };
    return () => engine.dispose();
  }, [mapId]);
  return <div ref={ref} className="game-root" />;
}
