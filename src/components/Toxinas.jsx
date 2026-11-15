import { useMemo, useState } from 'react';
import { useToxinas } from '../hooks/useToxinas.js';

const plain = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const PAGE = 50;
const url = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

/** Regras do catálogo: nível mínimo de acesso + divisões permitidas. O compartimento aberto define o que aparece. */
function canSee(t, targetLevel, division) {
  if (targetLevel === 3) return true;
  if (t.status && t.status !== 'publicada') return false;
  if (Number(t.nivelMinimoAcesso ?? 1) > targetLevel) return false;
  const divs = Array.isArray(t.divisoes) && t.divisoes.length ? t.divisoes : t.divisao ? [t.divisao] : [];
  if (!divs.length) return true;
  return targetLevel === 2 && divs.some((d) => plain(d) === plain(division));
}

const List = ({ title, items }) => (items?.length ? <div className="tox-sec"><h4>{title}</h4><ul>{items.map((x) => <li key={x}>{x}</li>)}</ul></div> : null);
const Text = ({ title, text }) => (text ? <div className="tox-sec"><h4>{title}</h4><p>{text}</p></div> : null);

function Detail({ t }) {
  const extras = t.campos && Object.entries(t.campos);
  const empty = !t.descricaoCompleta && !t.resumo && !t.descricao && !extras?.length;
  return (
    <div className="d-body">
      {t.nomeCientifico && <p><em>{t.nomeCientifico}</em></p>}
      {t.origem && <Text title="Origem" text={[t.origem.tipo, t.origem.agente].filter(Boolean).join(' · ') + (t.origem.descricao ? ` — ${t.origem.descricao}` : '')} />}
      <Text title="Resumo" text={t.resumo || t.descricao} />
      <Text title="Descrição" text={t.descricaoCompleta} />
      <Text title="Mecanismo geral" text={t.mecanismoGeral} />
      <List title="Efeitos à saúde" items={t.efeitosSaude} />
      <List title="Vias de exposição" items={t.viasExposicao} />
      {t.aplicacoesLegitimas?.length > 0 && (
        <div className="tox-sec"><h4>Aplicações legítimas</h4>
          <ul>{t.aplicacoesLegitimas.map((a, i) => <li key={i}><b>{a.area}:</b> {a.descricao}{a.status && <> <em>({a.status})</em></>}</li>)}</ul>
        </div>
      )}
      {t.casosReais?.length > 0 && (
        <div className="tox-sec"><h4>Casos reais</h4>
          <ul>{t.casosReais.map((c, i) => <li key={i}><b>{c.contexto}:</b> {c.descricao} {url(c.url) && <a href={c.url} target="_blank" rel="noopener noreferrer">{c.fonte || 'fonte'}</a>}</li>)}</ul>
        </div>
      )}
      <Text title="Prevenção" text={t.prevencao} />
      <Text title="Resposta a emergência" text={t.respostaEmergencia} />
      {t.referencias?.length > 0 && (
        <div className="tox-sec"><h4>Referências</h4>
          <ul>{t.referencias.map((r, i) => <li key={i}>{url(r.url) ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.titulo || r.url}</a> : r.titulo} {r.instituicao && `· ${r.instituicao}`}{r.ano && ` (${r.ano})`}</li>)}</ul>
        </div>
      )}
      {url(t.imagem?.downloadURL) && (
        <figure className="tox-fig"><img src={t.imagem.downloadURL} alt={t.imagem.alt || ''} loading="lazy" referrerPolicy="no-referrer" />{t.imagem.legenda && <figcaption>{t.imagem.legenda}</figcaption>}</figure>
      )}
      {extras?.length > 0 && (
        <dl className="small tox-sec">{extras.map(([k, v]) => <div key={k}><dt style={{ display: 'inline', fontWeight: 600 }}>{k.replace(/_/g, ' ')}: </dt><dd style={{ display: 'inline', margin: 0 }}>{v}</dd></div>)}</dl>
      )}
      {empty && <p className="muted small">Sem mais detalhes.</p>}
    </div>
  );
}

/** Toxinas do banco visíveis no compartimento aberto (Nível 1, Nível 2 da divisão ou Nível 3). */
export default function Toxinas({ targetLevel, division }) {
  const { list, loading, error } = useToxinas();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(PAGE);

  const mine = useMemo(() => list.filter((t) => canSee(t, targetLevel, division)), [list, targetLevel, division]);
  const term = plain(q);
  const shown = term ? mine.filter((t) => plain(`${t.nome} ${t.nomeCientifico || ''} ${t.classe} ${t.risco} ${(t.divisoes || []).join(' ')} ${t.divisao || ''}`).includes(term)) : mine;

  // sem nenhuma toxina cadastrada para este compartimento, o Nível 1 não mostra seção vazia
  if (!loading && !error && mine.length === 0 && targetLevel === 1) return null;

  return (
    <section className="news" aria-labelledby="tox-h" style={{ marginTop: 22 }}>
      <div className="news-bar">
        <h2 id="tox-h">Toxinas catalogadas <span className="muted small">({mine.length})</span></h2>
        {mine.length > 0 && <input type="search" className="news-search" placeholder="Buscar toxina" aria-label="Buscar toxina" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />}
      </div>
      {loading && <p className="muted" role="status">Carregando toxinas…</p>}
      {error && <p role="alert" style={{ color: 'var(--no)' }}>{error}</p>}
      {!loading && !error && mine.length === 0 && (
        <p className="muted">{targetLevel === 3 ? 'Nenhuma toxina cadastrada. Use Importação em massa para enviar o catálogo.' : 'Nenhuma toxina liberada para este compartimento.'}</p>
      )}
      {shown.length > 0 && (
        <ul className="dossiers">
          {shown.slice(0, limit).map((t) => (
            <li key={t.id} className={open === t.id ? 'open' : ''}>
              <button onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>
                <span className="d-title">{t.nome}</span>
                <span className="d-status">
                  {t.risco && <span className="risk" data-r={plain(t.risco)}>{t.risco}</span>} {t.classe}
                </span>
                <time>{t.divisoes?.length ? t.divisoes.join(', ') : t.divisao || ''}</time>
              </button>
              {open === t.id && <Detail t={t} />}
            </li>
          ))}
        </ul>
      )}
      {shown.length > limit && <button className="btn btn-ghost" onClick={() => setLimit((l) => l + PAGE)}>Mostrar mais ({shown.length - limit})</button>}
      {mine.length > 0 && shown.length === 0 && <p className="muted">Nenhuma toxina encontrada para “{q}”.</p>}
    </section>
  );
}
