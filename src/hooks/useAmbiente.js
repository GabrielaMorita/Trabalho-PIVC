import { useEffect, useMemo, useState } from 'react';
import { subscribeAmbiente } from '../services/cloud.js';

/** Escuta a coleção "ambiente" enquanto a tela está aberta e separa os documentos por tipo. */
export function useAmbiente() {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  useEffect(() => subscribeAmbiente(
    (list) => setState({ list, loading: false, error: '' }),
    (e) => setState({ list: [], loading: false, error: e?.code === 'permission-denied' ? 'O Firebase recusou a leitura. Publique o firestore.rules atualizado.' : 'Não foi possível carregar os dados ambientais.' }),
  ), []);
  const by = useMemo(() => {
    const g = { alerta: [], ocorrencia: [], agua: [], indicador: [], contaminante: [], risco: [], relatorio: [] };
    state.list.forEach((x) => g[x.tipo]?.push(x));
    g.alerta.sort((a, b) => (b.data || 0) - (a.data || 0));
    g.relatorio.sort((a, b) => (b.data || 0) - (a.data || 0));
    g.indicador.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    return g;
  }, [state.list]);
  return { ...state, by, hasDemo: state.list.some((x) => x.demo) };
}
