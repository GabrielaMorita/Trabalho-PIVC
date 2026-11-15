import { useState } from 'react';
import Protegida from '../components/Protegida.jsx';
import Noticias from '../components/Noticias.jsx';
import Monitoramento from '../components/Monitoramento.jsx';
import Inteligencia from '../components/Inteligencia.jsx';
import Toxinas from '../components/Toxinas.jsx';

// Páginas exclusivas de cada botão do painel.
export const PaginaNoticias = () => <Protegida min={1}><Noticias /></Protegida>;

const INDICADORES = [
  { id: 'ar', label: 'Qualidade do ar em tempo real' },
  { id: 'alertas', label: 'Alertas ambientais' },
  { id: 'mapa', label: 'Mapa de ocorrências' },
  { id: 'agua', label: 'Indicadores de água' },
  { id: 'tendencias', label: 'Painel de tendências' },
];

/** Botão Indicador do painel: primeiro escolhe qual indicador acessar. */
export function PaginaIndicadores() {
  const [sel, setSel] = useState('');
  return (
    <Protegida min={2}>
      <section className="selector" aria-labelledby="sel-h">
        <h1 id="sel-h">Qual <em>indicador</em> deseja acessar?</h1>
        <label className="selector-pill">
          <span className="sr-only">Indicador</span>
          <select value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Selecione um indicador</option>
            {INDICADORES.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
          <span className="caret" aria-hidden="true" />
        </label>
        <div className="selector-line" aria-hidden="true" />
        <div aria-live="polite" className="selector-body">
          {sel
            ? <Monitoramento painel={sel} />
            : <p className="selector-empty">Selecione um indicador para visualizar as informações.</p>}
        </div>
      </section>
    </Protegida>
  );
}

export const PaginaToxinas = () => (
  <Protegida min={3}>
    <Inteligencia />
    <Toxinas targetLevel={3} division={null} />
  </Protegida>
);
