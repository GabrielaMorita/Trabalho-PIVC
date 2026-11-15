import { useRef, useState } from 'react';
import { useApp } from '../AppContext.jsx';
import AdminGate from '../components/AdminGate.jsx';
import { downloadText } from '../lib/csv.js';
import { mapAmbiente, TIPOS } from '../lib/ambiente.js';
import { demoAmbiente, TEMPLATE_AMBIENTE } from '../lib/demoAmbiente.js';
import { NEWS_TEMPLATE, TOXIN_TEMPLATE, mapCatalogAlerts, mapCatalogToxins, mapNews, mapToxins, readCatalog, readRows } from '../lib/importer.js';

const KINDS = {
  news: {
    title: 'Notícias', listKeys: ['noticias', 'news'], map: mapNews, template: NEWS_TEMPLATE, file: 'modelo-noticias.csv',
    help: 'Colunas: titulo, link (obrigatórios), fonte, data, resumo, imagem.',
  },
  toxins: {
    title: 'Toxinas', listKeys: ['toxinas', 'toxins'], map: mapToxins, template: TOXIN_TEMPLATE, file: 'modelo-toxinas.csv',
    help: 'Colunas: nome (obrigatória), classe, risco, divisao, descricao. Qualquer outra coluna da planilha também é guardada.',
  },
};

function Block({ kind }) {
  const cfg = KINDS[kind];
  const { bulkNews, bulkToxins, clearNews, clearToxins, notify } = useApp();
  const ref = useRef(null);
  const [prev, setPrev] = useState(null); // { name, ok, skipped }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr(''); setPrev(null);
    try {
      const rows = await readRows(f, cfg.listKeys);
      const { ok, skipped } = cfg.map(rows);
      if (!ok.length) throw new Error('Nenhuma linha válida. Confira os nomes das colunas (baixe o modelo).');
      setPrev({ name: f.name, ok, skipped });
    } catch (x) { setErr(x.message || 'Não foi possível ler o arquivo.'); }
  }

  async function confirm() {
    setBusy(true); setErr('');
    try {
      const n = await (kind === 'news' ? bulkNews : bulkToxins)(prev.ok);
      notify(`${n} ${cfg.title.toLowerCase()} importadas para o banco.`);
      setPrev(null);
    } catch { setErr('Falha ao gravar no Firebase. Confira a conexão e as regras e tente de novo.'); }
    setBusy(false);
  }

  async function wipe() {
    if (!window.confirm(`Apagar TODAS as ${cfg.title.toLowerCase()} do banco? Isso não pode ser desfeito.`)) return;
    setBusy(true);
    try { const n = await (kind === 'news' ? clearNews : clearToxins)(); notify(`${n} ${cfg.title.toLowerCase()} apagadas.`); }
    catch { notify('Não foi possível apagar no Firebase.', 'err'); }
    setBusy(false);
  }

  return (
    <section className="panel">
      <h2>{cfg.title}</h2>
      <p className="muted small" style={{ marginBottom: 12 }}>{cfg.help} Aceita .csv (separado por vírgula, ponto e vírgula ou tab) e .json. Itens repetidos são atualizados, não duplicados.</p>
      <div className="actions" style={{ flexWrap: 'wrap' }}>
        <input ref={ref} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={onFile} />
        <button className="btn btn-primary" onClick={() => ref.current?.click()} disabled={busy}>Importar {cfg.title.toLowerCase()} (CSV/JSON)</button>
        <button className="btn btn-ghost" onClick={() => downloadText(cfg.file, cfg.template, 'text/csv')}>Baixar modelo</button>
        <button className="btn btn-quiet danger" onClick={wipe} disabled={busy}>Apagar todas</button>
      </div>
      {err && <div className="banner banner-err" role="alert" style={{ marginTop: 12 }}><div>{err}</div></div>}
      {prev && (
        <div className="banner banner-warn" role="status" style={{ marginTop: 12 }}>
          
          <div>
            <strong>{prev.name}</strong>: {prev.ok.length} linhas válidas{prev.skipped.length > 0 && `, ${prev.skipped.length} ignoradas`}.
            {prev.skipped.length > 0 && (
              <ul className="small">{prev.skipped.slice(0, 5).map((s) => <li key={s.line}>linha {s.line}: {s.reason}</li>)}{prev.skipped.length > 5 && <li>… e mais {prev.skipped.length - 5}</li>}</ul>
            )}
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={confirm} disabled={busy}>{busy ? 'Importando…' : `Confirmar importação de ${prev.ok.length}`}</button>
              <button className="btn btn-quiet" onClick={() => setPrev(null)} disabled={busy}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


function CatalogBlock() {
  const { bulkNews, bulkToxins, notify } = useApp();
  const ref = useRef(null);
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr(''); setPrev(null);
    try {
      const c = await readCatalog(f);
      const tox = mapCatalogToxins(c.toxinas, c.divisoes);
      const alerts = mapCatalogAlerts(c.alertas);
      if (!tox.ok.length && !alerts.ok.length) throw new Error('O catálogo não tem toxinas nem alertas válidos.');
      setPrev({ name: f.name, tox, alerts });
    } catch (x) { setErr(x.message || 'Não foi possível ler o arquivo.'); }
  }

  async function confirm() {
    setBusy(true); setErr('');
    try {
      const t = prev.tox.ok.length ? await bulkToxins(prev.tox.ok) : 0;
      const n = prev.alerts.ok.length ? await bulkNews(prev.alerts.ok) : 0;
      notify(`Catálogo importado: ${t} toxinas e ${n} notícias.`);
      setPrev(null);
    } catch { setErr('Falha ao gravar no Firebase. Confira a conexão e as regras e tente de novo.'); }
    setBusy(false);
  }

  const skipped = prev ? [...prev.tox.skipped.map((s) => ({ ...s, kind: 'toxina' })), ...prev.alerts.skipped.map((s) => ({ ...s, kind: 'alerta' }))] : [];
  return (
    <section className="panel" style={{ gridColumn: '1 / -1' }}>
      <h2>Catálogo completo (JSON do Firebase)</h2>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Para o arquivo no formato <code>{'{ "colecoes": { "toxinas": [...], "alertas": [...] } }'}</code>. Importa as fichas completas de toxinas (com nível mínimo de acesso e divisões permitidas) e os alertas ativos como notícias do Nível 1. Usuários, registros de acesso e o restante do modelo não são importados.
      </p>
      <input ref={ref} type="file" accept=".json,application/json" hidden onChange={onFile} />
      <div className="actions"><button className="btn btn-primary" onClick={() => ref.current?.click()} disabled={busy}>Importar catálogo (JSON)</button></div>
      {err && <div className="banner banner-err" role="alert" style={{ marginTop: 12 }}><div>{err}</div></div>}
      {prev && (
        <div className="banner banner-warn" role="status" style={{ marginTop: 12 }}>
          
          <div>
            <strong>{prev.name}</strong>: {prev.tox.ok.length} toxinas e {prev.alerts.ok.length} alertas (viram notícias).
            {skipped.length > 0 && <ul className="small">{skipped.slice(0, 5).map((s, i) => <li key={i}>{s.kind} {s.line}: {s.reason}</li>)}</ul>}
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={confirm} disabled={busy}>{busy ? 'Importando…' : 'Confirmar importação'}</button>
              <button className="btn btn-quiet" onClick={() => setPrev(null)} disabled={busy}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const TIPO_NOME = { alerta: 'alertas', ocorrencia: 'ocorrências', agua: 'medições de água', indicador: 'indicadores', contaminante: 'contaminantes', risco: 'riscos', relatorio: 'relatórios' };

function AmbienteBlock() {
  const { bulkAmbiente, clearAmbiente, notify } = useApp();
  const ref = useRef(null);
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const resumo = (ok) => TIPOS.map((t) => [t, ok.filter((x) => x.tipo === t).length]).filter(([, n]) => n > 0).map(([t, n]) => `${n} ${TIPO_NOME[t]}`).join(', ');

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr(''); setPrev(null);
    try {
      if (f.size > 8 * 1024 * 1024) throw new Error('Arquivo maior que 8 MB.');
      let j;
      try { j = JSON.parse(await f.text()); } catch { throw new Error('JSON inválido.'); }
      const items = Array.isArray(j) ? j : j?.ambiente;
      if (!Array.isArray(items)) throw new Error('Esperado uma lista ou um objeto com o campo “ambiente”. Baixe o modelo.');
      const { ok, skipped } = mapAmbiente(items);
      if (!ok.length) throw new Error('Nenhum item válido. Confira o campo “tipo” de cada item (baixe o modelo).');
      setPrev({ name: f.name, ok, skipped });
    } catch (x) { setErr(x.message || 'Não foi possível ler o arquivo.'); }
  }

  async function save(items, msg) {
    setBusy(true); setErr('');
    try { const n = await bulkAmbiente(items); notify(`${n} ${msg}`); setPrev(null); }
    catch { setErr('Falha ao gravar no Firebase. Confira a conexão e as regras e tente de novo.'); }
    setBusy(false);
  }
  async function wipe() {
    if (!window.confirm('Apagar TODOS os dados ambientais do banco? Isso não pode ser desfeito.')) return;
    setBusy(true);
    try { const n = await clearAmbiente(); notify(`${n} itens ambientais apagados.`); }
    catch { notify('Não foi possível apagar no Firebase.', 'err'); }
    setBusy(false);
  }

  return (
    <section className="panel" style={{ gridColumn: '1 / -1' }}>
      <h2>Dados ambientais (Nível 2 e Nível 3)</h2>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Alimentam o monitoramento ambiental do Nível 2 (alertas, mapa de ocorrências, água e indicadores) e a inteligência e riscos do Nível 3 (contaminantes, riscos e relatórios). Arquivo JSON com a lista no campo <code>ambiente</code>; cada item tem um <code>tipo</code>. Para testar, carregue os dados de demonstração (fictícios).
      </p>
      <input ref={ref} type="file" accept=".json,application/json" hidden onChange={onFile} />
      <div className="actions" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => save(mapAmbiente(demoAmbiente()).ok, 'itens de demonstração carregados.')} disabled={busy}>Carregar dados de demonstração</button>
        <button className="btn btn-ghost" onClick={() => ref.current?.click()} disabled={busy}>Importar JSON</button>
        <button className="btn btn-ghost" onClick={() => downloadText('modelo-ambiente.json', TEMPLATE_AMBIENTE, 'application/json')}>Baixar modelo</button>
        <button className="btn btn-quiet danger" onClick={wipe} disabled={busy}>Apagar todos</button>
      </div>
      {err && <div className="banner banner-err" role="alert" style={{ marginTop: 12 }}><div>{err}</div></div>}
      {prev && (
        <div className="banner banner-warn" role="status" style={{ marginTop: 12 }}>
          
          <div>
            <strong>{prev.name}</strong>: {resumo(prev.ok)}{prev.skipped.length > 0 && `; ${prev.skipped.length} ignorados`}.
            {prev.skipped.length > 0 && (
              <ul className="small">{prev.skipped.slice(0, 5).map((s) => <li key={s.line}>item {s.line}: {s.reason}</li>)}{prev.skipped.length > 5 && <li>… e mais {prev.skipped.length - 5}</li>}</ul>
            )}
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={() => save(prev.ok, 'itens ambientais importados.')} disabled={busy}>{busy ? 'Importando…' : `Confirmar importação de ${prev.ok.length}`}</button>
              <button className="btn btn-quiet" onClick={() => setPrev(null)} disabled={busy}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ImportacaoMassa() {
  return (
    <AdminGate title="A importação em massa">
      <header className="page-head">
        <h1>Importação em massa</h1>
        <p>Envie uma planilha ou arquivo com todas as toxinas e todas as notícias de uma vez. Você confere o resumo antes de gravar no banco.</p>
      </header>
      <div className="cfg-grid">
        <CatalogBlock />
        <AmbienteBlock />
        <Block kind="toxins" />
        <Block kind="news" />
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>Cada linha importada conta como uma gravação no Firestore (cota gratuita: 20 mil por dia). O limite é de 5.000 linhas por arquivo.</p>
    </AdminGate>
  );
}
