import { Link } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import { useAmbiente } from '../hooks/useAmbiente.js';
import { fmtDate, trend } from '../lib/ambiente.js';
import { LineChart, MapaOcorrencias, QualidadeAr } from './AmbienteCharts.jsx';

const nf = (v, d = 1) => (v == null ? '–' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }));
const SEV = { baixa: ['Baixa', 'ok'], media: ['Média', 'warn'], alta: ['Alta', 'no'], critica: ['Crítica', 'no'] };
const CLASSE = { boa: ['Boa', 'ok'], regular: ['Regular', 'warn'], ruim: ['Ruim', 'no'] };
const Tag = ({ tone, children }) => <span className={`tag t-${tone}`}>{children}</span>;

function Trend({ hist }) {
  const t = trend(hist);
  if (t === null) return null;
  const up = t > 0;
  return <span className={`kpi-trend ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {nf(Math.abs(t))}% <span className="muted small">vs. período anterior</span></span>;
}

/** Compartimento do Nível 2: monitoramento ambiental. */
export default function Monitoramento({ painel }) {
  const show = (k) => !painel || painel === k;
  const { isAdmin } = useApp();
  const { by, loading, error, hasDemo, list } = useAmbiente();
  const empty = !loading && !error && list.length === 0;
  const qtd = { alertas: by.alerta.length, mapa: by.ocorrencia.length, agua: by.agua.length, tendencias: by.indicador.length };
  const semDados = painel && painel !== 'ar' && !loading && !error && !empty && qtd[painel] === 0;

  return (
    <div className="amb">
      <h2 className="amb-title">Monitoramento ambiental</h2>
      <p className="muted">Acompanhe as condições ambientais, as áreas afetadas, a qualidade da água e a evolução dos principais indicadores.</p>
      {hasDemo && <p className="banner-demo" role="note">Parte dos dados abaixo é <b>fictícia, de demonstração</b> (alertas, ocorrências, água e indicadores).</p>}
      {error && <p role="alert" style={{ color: 'var(--no)' }}>{error}</p>}

      {show('ar') && <section aria-labelledby="amb-ar"><h3 id="amb-ar">Condições em tempo real</h3><QualidadeAr /></section>}

      {loading && <p className="muted" role="status">Carregando dados ambientais…</p>}
      {empty && painel !== 'ar' && (
        <div className="empty slim">
          <h3>Ainda não há dados ambientais cadastrados</h3>
          <p>Alertas, mapa, água e indicadores vêm do banco de dados.</p>
          {isAdmin && <Link className="btn btn-primary" to="/importacao">Importar dados ambientais</Link>}
        </div>
      )}

      {show('alertas') && by.alerta.length > 0 && (
        <section aria-labelledby="amb-al"><h3 id="amb-al">Alertas ambientais</h3>
          <ul className="alertas">
            {by.alerta.map((a) => (
              <li key={a.id}>
                <div className="alert-top"><Tag tone={(SEV[a.severidade] || SEV.media)[1]}>{(SEV[a.severidade] || SEV.media)[0]}</Tag><b>{a.titulo}</b></div>
                <p>{a.descricao}</p>
                <small className="muted">{[a.regiao, fmtDate(a.data)].filter(Boolean).join(' · ')}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {show('mapa') && by.ocorrencia.length > 0 && (
        <section aria-labelledby="amb-map"><h3 id="amb-map">Mapa de ocorrências</h3>
          <p className="muted small" style={{ marginTop: -4 }}>Áreas afetadas por queimadas, desmatamento e poluição.</p>
          <MapaOcorrencias items={by.ocorrencia} />
        </section>
      )}

      {show('agua') && by.agua.length > 0 && (
        <section aria-labelledby="amb-agua"><h3 id="amb-agua">Indicadores de água</h3>
          <ul className="cards">
            {by.agua.map((a) => {
              const [lbl, tone] = CLASSE[a.classe] || CLASSE.regular;
              return (
                <li key={a.id} className="card-sm">
                  <div className="alert-top"><b>{a.corpo}</b><Tag tone={tone}>{lbl}</Tag></div>
                  <small className="muted">{a.local}</small>
                  <dl className="aqi-dl">
                    <div><dt>pH</dt><dd>{nf(a.ph)}</dd></div>
                    <div><dt>Oxigênio</dt><dd>{nf(a.oxigenio)} mg/L</dd></div>
                    <div><dt>Turbidez</dt><dd>{nf(a.turbidez, 0)} NTU</dd></div>
                  </dl>
                  <small className="muted">Medido em {fmtDate(a.data)}</small>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {show('tendencias') && by.indicador.length > 0 && (
        <section aria-labelledby="amb-ind"><h3 id="amb-ind">Painel de tendências</h3>
          <p className="muted small" style={{ marginTop: -4 }}>Evolução do desmatamento, das queimadas, das emissões de CO₂ e da qualidade do ar ao longo do tempo.</p>
          <ul className="cards">
            {by.indicador.map((i) => {
              const last = i.historico[i.historico.length - 1];
              return (
                <li key={i.id} className="card-sm">
                  <b>{i.nome}</b>
                  <div className="kpi"><span className="kpi-v">{nf(last.valor)}</span><span className="muted">{i.unidade}</span></div>
                  <Trend hist={i.historico} />
                  <LineChart points={i.historico} label={i.nome} />
                  <small className="muted">Histórico: {i.historico[0].periodo} a {last.periodo}</small>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {semDados && <p className="muted" role="status">Ainda não há dados deste indicador no banco.</p>}
    </div>
  );
}
