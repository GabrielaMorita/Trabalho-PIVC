// Mostrador do cofre: três anéis, um por nível. O anel do compartimento escolhido
// gira e abre quando o acesso é concedido.
const RINGS = [
  { level: 3, r: 46 },
  { level: 2, r: 70 },
  { level: 1, r: 94 },
];
import { logoUrl } from '../lib/logo.js';

export default function Dial({ target = 1, state = 'idle', scan = 0 }) {
  return (
    <svg className={`dial dial-${state}`} viewBox="-110 -110 220 220" role="img"
      aria-label={`Mostrador do cofre, compartimento nível ${target}, estado ${state}`}>
      {RINGS.map(({ level, r }) => {
        const c = 2 * Math.PI * r;
        const active = level === target;
        const open = active && state === 'granted';
        const denied = active && state === 'denied';
        return (
          <g key={level} className={`ring ring-${level} ${active ? 'is-target' : ''} ${open ? 'is-open' : ''} ${denied ? 'is-denied' : ''}`}>
            <circle r={r} className="ring-track" />
            <circle r={r} className="ring-ticks" strokeDasharray={`2 ${(c / 60 - 2).toFixed(2)}`} />
            <circle
              r={r}
              className="ring-bolt"
              strokeDasharray={`${c * 0.22} ${c * 0.78}`}
            />
          </g>
        );
      })}
      <circle r="28" className="hub" />
      {state === 'granted' ? (
        <path d="M-10 0l7 7 14-14" className="hub-mark ok" />
      ) : state === 'denied' ? (
        <path d="M-9 -9l18 18M9 -9l-18 18" className="hub-mark no" />
      ) : (
        <image href={logoUrl} x="-15" y="-17" width="30" height="34" className="hub-logo" style={{ opacity: 0.55 + scan * 0.45 }} />
      )}
    </svg>
  );
}
