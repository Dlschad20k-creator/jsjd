/** All UI art is drawn as SVG (no emoji / font symbols as art). */
import type { PowerupKind, UpgradeKind } from '@shared/constants';
import type { MapId } from '@shared/protocol';

export function Avatar({ id, color, size = 40 }: { id: string; color: string; size?: number }) {
  const bg = (
    <>
      <defs>
        <radialGradient id={`ag-${id}-${color.slice(1)}`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#120a1c" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#ag-${id}-${color.slice(1)})`} stroke={color} strokeWidth="2.5" />
    </>
  );
  const w = '#fff';
  let art: JSX.Element;
  switch (id) {
    case 'shades':
      art = (
        <g>
          <circle cx="32" cy="34" r="15" fill="#ffd9b0" />
          <rect x="17" y="27" width="13" height="8" rx="3" fill="#111" />
          <rect x="34" y="27" width="13" height="8" rx="3" fill="#111" />
          <rect x="29" y="29" width="6" height="2" fill="#111" />
          <path d="M25 41 Q32 46 39 41" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
      break;
    case 'bunny':
      art = (
        <g>
          <ellipse cx="25" cy="18" rx="5" ry="12" fill={w} />
          <ellipse cx="39" cy="18" rx="5" ry="12" fill={w} />
          <ellipse cx="25" cy="18" rx="2.5" ry="8" fill="#ffb7cf" />
          <ellipse cx="39" cy="18" rx="2.5" ry="8" fill="#ffb7cf" />
          <circle cx="32" cy="37" r="14" fill={w} />
          <circle cx="27" cy="35" r="2" fill="#222" />
          <circle cx="37" cy="35" r="2" fill="#222" />
          <ellipse cx="32" cy="40" rx="2.5" ry="1.8" fill="#ff7fa8" />
        </g>
      );
      break;
    case 'crown':
      art = (
        <g>
          <path d="M14 42 L18 22 L26 32 L32 18 L38 32 L46 22 L50 42 Z" fill="#ffd23f" stroke="#b8860b" strokeWidth="1.5" />
          <rect x="14" y="42" width="36" height="6" rx="2" fill="#f5b800" />
          <circle cx="32" cy="34" r="3" fill="#ff3fa4" />
        </g>
      );
      break;
    case 'star':
      art = <path d="M32 12 L37.5 26 L52 26.5 L40.5 35.5 L44.5 50 L32 41.5 L19.5 50 L23.5 35.5 L12 26.5 L26.5 26 Z" fill="#ffe14d" stroke="#fff" strokeWidth="1.5" />;
      break;
    case 'alien':
      art = (
        <g>
          <ellipse cx="32" cy="34" rx="15" ry="17" fill="#7dff8a" />
          <ellipse cx="25" cy="32" rx="5" ry="7" fill="#111" transform="rotate(-20 25 32)" />
          <ellipse cx="39" cy="32" rx="5" ry="7" fill="#111" transform="rotate(20 39 32)" />
          <path d="M28 44 Q32 46 36 44" stroke="#111" strokeWidth="2" fill="none" />
        </g>
      );
      break;
    case 'robot':
      art = (
        <g>
          <rect x="18" y="20" width="28" height="26" rx="5" fill="#c9d3e0" />
          <rect x="31" y="12" width="2" height="8" fill="#c9d3e0" />
          <circle cx="32" cy="11" r="3" fill="#ff3b3b" />
          <circle cx="26" cy="31" r="4" fill="#00e5ff" />
          <circle cx="38" cy="31" r="4" fill="#00e5ff" />
          <rect x="24" y="39" width="16" height="3" rx="1.5" fill="#445" />
        </g>
      );
      break;
    case 'donut':
      art = (
        <g>
          <circle cx="32" cy="33" r="16" fill="#e9b77a" />
          <path d="M17 31 Q20 18 32 17 Q44 18 47 31 Q44 38 38 34 Q34 40 28 35 Q22 40 17 31 Z" fill="#ff8fd0" />
          <circle cx="32" cy="33" r="6" fill="#120a1c" />
          <rect x="24" y="22" width="5" height="2" rx="1" fill="#fff" transform="rotate(30 26 23)" />
          <rect x="38" y="25" width="5" height="2" rx="1" fill="#7ef2d0" transform="rotate(-20 40 26)" />
        </g>
      );
      break;
    case 'flame':
      art = (
        <g>
          <path d="M32 12 C40 22 46 28 44 38 C42 47 36 51 32 51 C26 51 20 46 20 38 C20 31 25 28 27 22 C29 27 31 28 32 28 C33 23 31 18 32 12 Z" fill="#ff5a36" />
          <path d="M32 30 C36 35 38 38 37 43 C36 47 34 48 32 48 C29 48 27 46 27 42 C27 38 30 36 32 30 Z" fill="#ffd23f" />
        </g>
      );
      break;
    case 'heart':
      art = <path d="M32 48 C20 40 14 33 14 25 C14 19 19 15 24 15 C28 15 31 18 32 21 C33 18 36 15 40 15 C45 15 50 19 50 25 C50 33 44 40 32 48 Z" fill="#ff3fa4" stroke="#fff" strokeWidth="1.5" />;
      break;
    case 'cat':
      art = (
        <g>
          <path d="M18 24 L20 12 L28 20 Z M46 24 L44 12 L36 20 Z" fill="#ffb800" />
          <circle cx="32" cy="34" r="15" fill="#ffb800" />
          <ellipse cx="26" cy="32" rx="2.5" ry="3.5" fill="#111" />
          <ellipse cx="38" cy="32" rx="2.5" ry="3.5" fill="#111" />
          <path d="M30 38 L34 38 L32 40 Z" fill="#ff7fa8" />
          <path d="M20 38 L12 36 M20 41 L12 42 M44 38 L52 36 M44 41 L52 42" stroke="#fff" strokeWidth="1.2" />
        </g>
      );
      break;
    case 'bolt':
      art = <path d="M36 10 L18 36 L30 36 L26 54 L46 26 L34 26 Z" fill="#ffe600" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />;
      break;
    case 'vortex':
    default:
      art = (
        <g fill="none" strokeLinecap="round">
          <circle cx="32" cy="32" r="12" fill="#05010a" />
          <path d="M32 14 A18 18 0 0 1 50 32" stroke="#fff" strokeWidth="3" />
          <path d="M50 32 A18 18 0 0 1 32 50" stroke={color} strokeWidth="3" opacity="0.9" />
          <path d="M32 50 A18 18 0 0 1 14 32" stroke="#fff" strokeWidth="3" opacity="0.6" />
          <path d="M14 32 A18 18 0 0 1 32 14" stroke={color} strokeWidth="3" opacity="0.5" />
        </g>
      );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      {bg}
      {art}
    </svg>
  );
}

export function PowerIcon({ k, size = 22 }: { k: PowerupKind; size?: number }) {
  const c = { turbo: '#ffd23f', magnet: '#3fd0ff', shield: '#7dff8a', giant: '#ff4fd8', slime: '#a6ff00' }[k];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {k === 'turbo' && <path d="M13 2 L4 14 H11 L9 22 L20 9 H13 Z" fill={c} />}
      {k === 'magnet' && <path d="M5 3 H9 V12 A3 3 0 0 0 15 12 V3 H19 V12 A7 7 0 0 1 5 12 Z" fill={c} />}
      {k === 'shield' && <path d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z" fill={c} />}
      {k === 'giant' && <path d="M12 3 L21 19 H3 Z M12 9 L8 16 H16 Z" fill={c} fillRule="evenodd" />}
      {k === 'slime' && <path d="M12 3 C17 9 20 12 20 16 A8 6 0 0 1 4 16 C4 12 7 9 12 3 Z" fill={c} />}
    </svg>
  );
}

export function UpgradeIcon({ k, size = 26 }: { k: UpgradeKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      {k === 'speed' && (
        <g stroke="#ffd23f" strokeWidth="2.2">
          <path d="M3 8 H11 M2 12 H9 M4 16 H11" />
          <path d="M14 5 L21 12 L14 19" />
        </g>
      )}
      {k === 'reach' && (
        <g stroke="#3fd0ff" strokeWidth="2">
          <circle cx="12" cy="12" r="3" fill="#3fd0ff" />
          <circle cx="12" cy="12" r="6.5" strokeDasharray="3 2" />
          <circle cx="12" cy="12" r="10" strokeDasharray="2 3" opacity="0.6" />
        </g>
      )}
      {k === 'appetite' && (
        <g stroke="#ff4fb8" strokeWidth="2">
          <path d="M4 10 A8 8 0 0 0 20 10 Z" fill="#ff4fb8" />
          <path d="M8 4 V8 M12 3 V8 M16 4 V8" />
        </g>
      )}
    </svg>
  );
}

export function ActionIcon({ k, size = 30 }: { k: 'dash' | 'vortex'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" strokeLinecap="round">
      {k === 'dash' ? (
        <g stroke="#fff" strokeWidth="2.2">
          <path d="M3 7 H10 M2 12 H8 M3 17 H10" />
          <path d="M13 6 L19 12 L13 18 M17 6 L23 12 L17 18" />
        </g>
      ) : (
        <g stroke="#fff" strokeWidth="2">
          <path d="M12 12 m-2 0 a2 2 0 1 0 4 0 a4 4 0 1 0 -8 0 a6 6 0 1 0 12 0 a8 8 0 1 0 -16 0" />
        </g>
      )}
    </svg>
  );
}

/** Small drawn emblem per world for the map cards. */
export function MapEmblem({ id, size = 56 }: { id: MapId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      {id === 'pink' && (
        <g>
          <path d="M10 52 V30 L20 22 L30 30 V52 Z" fill="#ffd1ea" />
          <path d="M8 31 L20 20 L32 31" fill="#ff4fb8" />
          <rect x="36" y="14" width="18" height="38" rx="2" fill="#ff8fd0" />
          <rect x="39" y="18" width="5" height="5" fill="#fff" />
          <rect x="47" y="18" width="5" height="5" fill="#fff" />
          <rect x="39" y="27" width="5" height="5" fill="#fff" />
          <rect x="47" y="27" width="5" height="5" fill="#fff" />
          <path d="M45 10 C42 6 38 8 40 11 L45 15 L50 11 C52 8 48 6 45 10 Z" fill="#ff3fa4" />
        </g>
      )}
      {id === 'bunny' && (
        <g>
          <ellipse cx="25" cy="16" rx="5" ry="13" fill="#fff" />
          <ellipse cx="39" cy="16" rx="5" ry="13" fill="#fff" />
          <ellipse cx="25" cy="16" rx="2.5" ry="9" fill="#ffb7cf" />
          <ellipse cx="39" cy="16" rx="2.5" ry="9" fill="#ffb7cf" />
          <circle cx="32" cy="38" r="16" fill="#fff" />
          <circle cx="26" cy="36" r="2.2" fill="#2a1a2a" />
          <circle cx="38" cy="36" r="2.2" fill="#2a1a2a" />
          <ellipse cx="32" cy="42" rx="3" ry="2" fill="#ff7fa8" />
          <path d="M50 46 L60 40 L58 50 Z" fill="#ff8a1f" />
          <path d="M58 40 L62 35 M59 41 L64 39" stroke="#5bd16b" strokeWidth="2" />
        </g>
      )}
      {id === 'berlin' && (
        <g>
          <rect x="6" y="50" width="52" height="4" fill="#d8c39a" />
          {[10, 18, 26, 34, 42, 50].map((x) => (
            <rect key={x} x={x - 1.5} y="30" width="3" height="20" fill="#d8c39a" />
          ))}
          <rect x="6" y="24" width="52" height="6" fill="#c4ab7d" />
          <rect x="22" y="18" width="20" height="6" fill="#d8c39a" />
          <path d="M28 18 L30 12 L34 12 L36 18 Z" fill="#5fa38a" />
          <rect x="52" y="4" width="2" height="20" fill="#e9e6df" />
          <circle cx="53" cy="12" r="4" fill="#b9bec6" />
        </g>
      )}
    </svg>
  );
}

export function IconBtn({ kind }: { kind: 'gear' | 'trophy' | 'help' | 'close' | 'copy' | 'back' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === 'gear' && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </>
      )}
      {kind === 'trophy' && <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />}
      {kind === 'help' && (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 17.5h.01" />
        </>
      )}
      {kind === 'close' && <path d="M18 6 6 18M6 6l12 12" />}
      {kind === 'copy' && (
        <>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      )}
      {kind === 'back' && <path d="M15 18l-6-6 6-6" />}
    </svg>
  );
}
