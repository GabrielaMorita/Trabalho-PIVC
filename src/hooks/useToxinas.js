import { useEffect, useState } from 'react';
import { subscribeToxins } from '../services/cloud.js';

/** Escuta a coleção "toxinas" enquanto a tela estiver aberta. */
export function useToxinas() {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  useEffect(() => {
    const stop = subscribeToxins(
      (list) => setState({ list, loading: false, error: '' }),
      (e) => setState({ list: [], loading: false, error: e?.code === 'permission-denied' ? 'O Firebase recusou a leitura. Publique o firestore.rules atualizado.' : 'Não foi possível carregar as toxinas.' }),
    );
    return stop;
  }, []);
  return state;
}
