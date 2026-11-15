import { useMemo, useState } from 'react';
import { useApp } from '../AppContext.jsx';
import AdminGate from '../components/AdminGate.jsx';
import LevelBadge from '../components/LevelBadge.jsx';
import { downloadText, toCsv } from '../lib/csv.js';
import { targetLabel } from '../lib/access.js';

const fmt = (t) => new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

export default function Registros() {
  const { logs, clearLogs, notify } = useApp();
  const [res, setRes] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [confirm, setConfirm] = useState(false);

  const stats = useMemo(() => {
    const g = logs.filter((l) => l.result === 'granted').length;
    const d = logs.filter((l) => l.result === 'denied').length;
    const unknown = logs.filter((l) => l.result === 'denied' && !l.userId).length;
    // últimos 7 dias
    const days = Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - (6 - i));
      return { key: dt.getTime(), label: dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), g: 0, d: 0 };
    });
    logs.forEach((l) => {
      const dt = new Date(l.ts); dt.setHours(0, 0, 0, 0);
      const row = days.find((x) => x.key === dt.getTime());
      if (row) l.result === 'granted' ? row.g++ : row.d++;
    });
    return { g, d, unknown, total: g + d, days, max: Math.max(1, ...days.map((x) => x.g + x.d)) };
  }, [logs]);

  const list = logs.filter((l) => (res === 'all' || l.result === res) && `${l.userName} ${l.reason} ${targetLabel(l.target)}`.toLowerCase().includes(q.toLowerCase()));

  function exportCsv() {
    const csv = toCsv(list, [
      { label: 'Data/hora', get: (l) => fmt(l.ts) },
      { label: 'Resultado', get: (l) => (l.result === 'granted' ? 'Autorizado' : 'Negado') },
      { label: 'Pessoa', get: (l) => l.userName },
      { label: 'Nível da pessoa', get: (l) => l.level ?? '' },
      { label: 'Compartimento', get: (l) => targetLabel(l.target) },
      { label: 'Motivo', get: (l) => l.reason },
      { label: 'Distância facial', get: (l) => l.distance ?? '' },
      { label: 'Prova de vida', get: (l) => (l.liveness ? 'sim' : 'não') },
    ]);
    downloadText(`registros-cofre-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  }

  return (
    <AdminGate title="Registros">
      <header className="page-head row">
        <div><h1>Registros de acesso</h1><p>Todas as tentativas no terminal, com foto das negadas.</p></div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!list.length}> Exportar CSV</button>
          <button className="btn btn-ghost" onClick={() => window.print()}> Imprimir</button>
        </div>
      </header>

      <section className="stats">
        <div><small>Tentativas</small><b>{stats.total}</b></div>
        <div className="s-ok"><small>Autorizadas</small><b>{stats.g}</b></div>
        <div className="s-no"><small>Negadas</small><b>{stats.d}</b></div>
        <div><small>Rostos desconhecidos</small><b>{stats.unknown}</b></div>
        <div className="week" aria-label="Tentativas nos últimos 7 dias">
          {stats.days.map((d) => (
            <div key={d.key} className="bar" title={`${d.g} autorizadas, ${d.d} negadas`}>
              <div className="col">
                <i className="no" style={{ height: `${(d.d / stats.max) * 100}%` }} />
                <i className="ok" style={{ height: `${(d.g / stats.max) * 100}%` }} />
              </div>
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="toolbar no-print">
        <label className="field inline grow"><span>Buscar</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pessoa, motivo ou compartimento" /></label>
        <div className="seg" role="group" aria-label="Filtrar por resultado">
          {[['all', 'Todos'], ['granted', 'Autorizados'], ['denied', 'Negados']].map(([k, l]) => (
            <button key={k} className={res === k ? 'on' : ''} onClick={() => setRes(k)}>{l}</button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty slim"><p>{logs.length ? 'Nenhum registro com esse filtro.' : 'Nenhuma tentativa registrada ainda.'}</p></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Quando</th><th>Resultado</th><th>Pessoa</th><th>Compartimento</th><th>Motivo</th><th className="num">Dist.</th><th className="no-print">Foto</th></tr></thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id} className={l.result}>
                  <td>{fmt(l.ts)}</td>
                  <td><span className={`pill ${l.result}`}>{l.result === 'granted' ? 'Autorizado' : 'Negado'}</span></td>
                  <td>{l.userName}{l.level ? <> <LevelBadge level={l.level} /></> : null}</td>
                  <td>{targetLabel(l.target)}</td>
                  <td>{l.reason}</td>
                  <td className="num">{l.distance ?? '–'}</td>
                  <td className="no-print">{l.snapshot ? <button className="thumb" onClick={() => setSel(l)} aria-label="Ampliar foto"><img src={l.snapshot} alt="" width="36" height="36" /></button> : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="actions no-print">
        <button className="btn btn-quiet danger" onClick={() => setConfirm(true)} disabled={!logs.length}> Apagar registros</button>
      </div>

      {sel && (
        <div className="modal-back" onClick={() => setSel(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <img className="snap" src={sel.snapshot} alt="Foto da tentativa negada" />
            <h2>{sel.userName}</h2>
            <p>{fmt(sel.ts)}<br />{sel.reason}</p>
            <div className="actions end"><button className="btn btn-primary" onClick={() => setSel(null)} autoFocus>Fechar</button></div>
          </div>
        </div>
      )}
      {confirm && (
        <div className="modal-back" onClick={() => setConfirm(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>Apagar todos os registros?</h2>
            <p>Isso remove o histórico e as fotos das tentativas negadas. Exporte o CSV antes se precisar guardar.</p>
            <div className="actions end">
              <button className="btn btn-ghost" onClick={() => setConfirm(false)} autoFocus>Manter</button>
              <button className="btn btn-danger" onClick={() => { clearLogs(); setConfirm(false); notify('Registros apagados.'); }}>Apagar</button>
            </div>
          </div>
        </div>
      )}
    </AdminGate>
  );
}
