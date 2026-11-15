import { useEffect, useState } from 'react';
import { loadEngine, engineReady } from '../lib/faceEngine.js';

export function useEngine() {
  const [state, setState] = useState({ ready: engineReady(), error: '', backend: '' });
  useEffect(() => {
    let alive = true;
    loadEngine()
      .then((r) => alive && setState({ ready: true, error: '', backend: r?.backend || '' }))
      .catch((e) => alive && setState({ ready: false, error: `Falha ao carregar os modelos de IA: ${e.message}`, backend: '' }));
    return () => { alive = false; };
  }, []);
  return state;
}
