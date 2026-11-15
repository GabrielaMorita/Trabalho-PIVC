import { LEVELS } from '../lib/constants.js';
export default function LevelBadge({ level, long = false }) {
  const l = LEVELS[level];
  return (
    <span className={`lvl lvl-${level}`}>
      <i aria-hidden="true" />
      {long ? `${l.short} · ${l.title}` : l.short}
    </span>
  );
}
