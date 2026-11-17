import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

/** Compartimento do Nível 1: notícias de meio ambiente cadastradas no banco (coleção "noticias"). */
export default function Noticias() {
  const { news, isAdmin } = useApp();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const shown = term ? news.filter((n) => `${n.title} ${n.source} ${n.excerpt || ''}`.toLowerCase().includes(term)) : news;

  return (
    <section aria-labelledby="news-h" className="news">
      <div className="page-head row">
        <div>
          <h1 id="news-h">Notícias de meio ambiente</h1>
          <p>Acompanhe as principais notícias sobre meio ambiente cadastradas pelo ministério.</p>
        </div>
        {news.length > 0 && (
          <input type="search" className="news-search" placeholder="Buscar notícia" aria-label="Buscar notícia"
            value={q} onChange={(e) => setQ(e.target.value)} />
        )}
      </div>

      {news.length === 0 && (
        <div className="empty slim">
          <h3>Ainda não há notícias cadastradas</h3>
          <p>As notícias deste compartimento vêm do banco de dados e são cadastradas pelo ministro.</p>
          {isAdmin && <Link className="btn btn-primary" to="/gerenciar-noticias">Cadastrar notícias</Link>}
        </div>
      )}

      {news.length > 0 && shown.length === 0 && <p className="muted">Nenhuma notícia encontrada para “{q}”.</p>}

      {shown.length > 0 && (
        <ul className="news-grid">
          {shown.map((n) => (
            <li key={n.id} className="news-card">
              {safeUrl(n.image) && <img src={n.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
              <div className="news-meta"><b>{n.source}</b>{n.date > 0 && <time dateTime={new Date(n.date).toISOString()}>{fmtDate(n.date)}</time>}</div>
              <h3>{safeUrl(n.link) ? <a href={n.link} target="_blank" rel="noopener noreferrer">{n.title}</a> : n.title}</h3>
              {n.excerpt && <p>{n.excerpt}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
