import { useEffect, useState } from 'react';
export function useCountdown(expiresAt) {
  const [left, setLeft] = useState(() => (expiresAt ? Math.max(0, expiresAt - Date.now()) : 0));
  useEffect(() => {
    if (!expiresAt) { setLeft(0); return; }
    const tick = () => setLeft(Math.max(0, expiresAt - Date.now()));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [expiresAt]);
  const s = Math.ceil(left / 1000);
  return { seconds: s, label: `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` };
}
