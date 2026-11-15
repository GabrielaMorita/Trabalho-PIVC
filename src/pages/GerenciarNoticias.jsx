import { useState } from 'react';
import { useApp } from '../AppContext.jsx';
import AdminGate from '../components/AdminGate.jsx';
import { loadNews } from '../services/noticias.js';

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { title: '', source: '', link: '', excerpt: '', image: '', date: today() };
const isUrl = (u) => /^https?:\/\/\S+$/i.test(u);

export default function GerenciarNoticias() {
  const { news, addNews, removeNews, importNews, notify } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    const errs = [];
    if (form.title.trim().length < 5) errs.push('Informe o título (mínimo 5 letras).');
    if (!form.source.trim()) errs.push('Informe a fonte (ex.: Agência Brasil).');
    if (!isUrl(form.link.trim())) errs.push('O link precisa começar com http:// ou https://.');
    if (form.image.trim() && !isUrl(form.image.trim())) errs.push('O link da imagem precisa começar com http:// ou https://.');
    if (!form.date) errs.push('Informe a data da notícia.');
    setErrors(errs);
    if (errs.length) return;
    addNews({
      title: form.title.trim(), source: form.source.trim(), link: form.link.trim(),
      excerpt: form.excerpt.trim(), image: form.image.trim(),
      date: new Date(`${form.date}T12:00:00`).getTime(),
    });
    setForm(EMPTY);
    notify('Notícia cadastrada.');
  }

  async function importFromWeb() {
    setImporting(true);
    try {
      const { items } = await loadNews({ force: true });
      const n = await importNews(items);
      notify(`${n} notícias importadas da internet para o banco.`);
    } catch (e) {
      notify('Não foi possível buscar notícias agora. Cadastre manualmente ou tente mais tarde.', 'err');
    }
    setImporting(false);
  }

  return (
    <AdminGate title="O cadastro de notícias">
      <header className="page-head">
        <h1>Notícias do Nível 1</h1>
        <p>As notícias abaixo são gravadas no banco (coleção <code>noticias</code>) e aparecem para quem abre o compartimento de permissão geral.</p>
      </header>

      {errors.length > 0 && (
        <div className="banner banner-err" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
      )}

      <section className="panel">
        <h2>Nova notícia</h2>
        <form className="news-form" onSubmit={submit} noValidate>
          <label className="field wide"><span>Título</span><input value={form.title} onChange={set('title')} autoComplete="off" /></label>
          <label className="field"><span>Fonte</span><input value={form.source} onChange={set('source')} autoComplete="off" placeholder="Ex.: Agência Brasil" /></label>
          <label className="field"><span>Data</span><input type="date" value={form.date} onChange={set('date')} max={today()} /></label>
          <label className="field wide"><span>Link da notícia</span><input type="url" value={form.link} onChange={set('link')} placeholder="https://" /></label>
          <label className="field wide"><span>Resumo (opcional)</span><textarea value={form.excerpt} onChange={set('excerpt')} maxLength={400} /></label>
          <label className="field wide"><span>Link da imagem (opcional)</span><input type="url" value={form.image} onChange={set('image')} placeholder="https://" /></label>
          <div className="wide actions"><button className="btn btn-primary" type="submit">Salvar notícia</button></div>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Importar da internet</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>Busca as notícias mais recentes de meio ambiente (Google Notícias, Mongabay Brasil e ((o))eco) e salva no banco. Rodar de novo não duplica as que já estão salvas.</p>
        <button className="btn btn-ghost" onClick={importFromWeb} disabled={importing}>{importing ? 'Importando…' : 'Importar notícias'}</button>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Notícias no banco <span className="muted small">({news.length})</span></h2>
        {news.length === 0 && <p className="muted">Nenhuma notícia cadastrada ainda.</p>}
        <ul className="news-admin-list">
          {news.map((n) => (
            <li key={n.id}>
              <div>
                <a href={n.link} target="_blank" rel="noopener noreferrer">{n.title}</a>
                <small>{n.source} · {n.date ? new Date(n.date).toLocaleDateString('pt-BR') : 's/ data'}</small>
              </div>
              <button className="btn btn-quiet danger" onClick={() => { if (window.confirm('Remover esta notícia do banco?')) { removeNews(n.id); notify('Notícia removida.'); } }}>Remover</button>
            </li>
          ))}
        </ul>
      </section>
    </AdminGate>
  );
}
