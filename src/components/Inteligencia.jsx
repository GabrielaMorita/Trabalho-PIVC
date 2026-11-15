import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import { useAmbiente } from '../hooks/useAmbiente.js';
import { fmtDate, riskLevel, riskScore } from '../lib/ambiente.js';
import { MatrizRisco } from './AmbienteCharts.jsx';

const plain = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const SEV = { baixa: ['Baixa', 'ok', 1], media: ['Média', 'warn', 2], alta: ['Alta', 'no', 3], critica: ['Crítica', 'no', 4] };
const Tag = ({ tone, children }) => <span className={`tag t-${tone}`}>{children}</span>;
const url = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

/** Compartimento do Nível 3: inteligência e riscos. As fichas de toxinas aparecem logo abaixo (Toxinas.jsx). */
export default function Inteligencia() {
  const { isAdmin } = useApp();
  const { by, loading, error, hasDemo, list } = useAmbiente();
  const [q, setQ] = useState('');
  const term = plain(q);
  const cont = useMemo(() => by.contaminante.filter((c) => !term || plain(`${c.nome} ${c.classe} ${(c.ocorreEm || []).join(' ')} ${(c.metodosDeteccao || []).join(' ')}`).includes(term)), [by.contaminante, term]);
  const impactos = useMemo(() => [...by.contaminante].sort((a, b) => (SEV[b.gravidade]?.[2] || 0) - (SEV[a.gravidade]?.[2] || 0)), [by.contaminante]);
  const riscos = useMemo(() => [...by.risco].sort((a, b) => riskScore(b) - riskScore(a)), [by.risco]);
  const empty = !loading && !error && list.length === 0;

  return (
    <div className="amb">
      <h2 className="amb-title">Inteligência e riscos</h2>
      <p className="muted">Informações técnicas e análises aprofundadas sobre contaminantes, riscos e impactos de substâncias tóxicas. As fichas de toxinas e substâncias químicas estão logo abaixo.</p>
      {hasDemo && <p className="banner-demo" role="note">Parte dos dados abaixo é <b>fictícia, de demonstração</b>.</p>}
      {error && <p role="alert" style={{ color: 'var(--no)' }}>{error}</p>}
      {loading && <p className="muted" role="status">Carregando dados…</p>}
      {empty && (
        <div className="empty slim">
          <h3>Ainda não há dados de inteligência cadastrados</h3>
          <p>Contaminantes, riscos e relatórios vêm do banco de dados.</p>
          {isAdmin && <Link className="btn btn-primary" to="/importacao">Importar dados ambientais</Link>}
        </div>
      )}

      {by.contaminante.length > 0 && (
        <section aria-labelledby="int-cont">
          <div className="news-bar"><h3 id="int-cont">Identificação de contaminantes</h3>
            <input type="search" className="news-search" placeholder="Buscar contaminante" aria-label="Buscar contaminante" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Contaminante</th><th>Tipo</th><th>Onde ocorre</th><th>Como identificar</th></tr></thead>
              <tbody>
                {cont.map((c) => (
                  <tr key={c.id}><td><b>{c.nome}</b></td><td>{c.classe}</td><td>{(c.ocorreEm || []).join(', ')}</td><td>{(c.metodosDeteccao || []).join('; ')}</td></tr>
                ))}
                {cont.length === 0 && <tr><td colSpan={4} className="muted">Nenhum contaminante encontrado para “{q}”.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {riscos.length > 0 && (
        <section aria-labelledby="int-risco"><h3 id="int-risco">Análise de riscos de contaminação</h3>
          <p className="muted small" style={{ marginTop: -4 }}>Cada cenário é posicionado pela probabilidade e pela severidade (1 a 5); o número na matriz corresponde à primeira coluna da tabela.</p>
          <MatrizRisco items={riscos} />
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>#</th><th>Cenário</th><th>Local</th><th>P × S</th><th>Nível</th><th>Medidas</th></tr></thead>
              <tbody>
                {riscos.map((r, i) => { const l = riskLevel(riskScore(r)); return (
                  <tr key={r.id}><td>{i + 1}</td><td><b>{r.cenario}</b></td><td>{r.local}</td><td>{r.probabilidade} × {r.severidade}</td><td><Tag tone={l.tone}>{l.label}</Tag></td><td>{r.medidas}</td></tr>
                ); })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {impactos.length > 0 && (
        <section aria-labelledby="int-imp"><h3 id="int-imp">Impactos de substâncias tóxicas</h3>
          <ul className="cards">
            {impactos.map((c) => { const [lbl, tone] = SEV[c.gravidade] || SEV.media; return (
              <li key={c.id} className="card-sm">
                <div className="alert-top"><b>{c.nome}</b><Tag tone={tone}>Gravidade {lbl.toLowerCase()}</Tag></div>
                <small className="muted">{c.classe}</small>
                <p>{c.impactos}</p>
              </li>
            ); })}
          </ul>
        </section>
      )}

      {by.relatorio.length > 0 && (
        <section aria-labelledby="int-rel"><h3 id="int-rel">Relatórios técnicos ambientais</h3>
          <ul className="alertas">
            {by.relatorio.map((r) => (
              <li key={r.id}>
                <div className="alert-top"><b>{url(r.link) ? <a href={r.link} target="_blank" rel="noopener noreferrer">{r.titulo}</a> : r.titulo}</b></div>
                <p>{r.resumo}</p>
                <small className="muted">{[r.autor, fmtDate(r.data), (r.tags || []).map((t) => `#${t}`).join(' ')].filter(Boolean).join(' · ')}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
