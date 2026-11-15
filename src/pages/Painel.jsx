import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import LevelBadge from '../components/LevelBadge.jsx';

// Cada botão aparece a partir de um nível mínimo:
// Nível 1: Notícia · Nível 2: + Indicador · Nível 3: tudo.
const BOTOES = [
  { to: '/noticias', label: 'Notícia', min: 1 },
  { to: '/indicadores', label: 'Indicador', min: 2 },
  { to: '/toxinas', label: 'Relatório\nToxina', min: 3 },
  { to: '/cadastro', label: 'Cadastrar\nPessoa', min: 3, wide: true },
  { to: '/usuarios', label: 'Pessoa\nAutorizada', min: 3, wide: true },
];

/** Tela exibida depois que o reconhecimento é aprovado. */
export default function Painel() {
  const { session } = useApp();
  const { label } = useCountdown(session?.expiresAt);
  if (!session) return <Navigate to="/acesso" replace />;
  const botoes = BOTOES.filter((b) => session.level >= b.min);

  return (
    <section className="painel" aria-labelledby="painel-h">
      <h1 id="painel-h">Seja bem-vindo!</h1>
      <p className="painel-nome">{session.name}</p>
      <p className="painel-meta"><LevelBadge level={session.level} /> {session.role}{session.division ? ` · ${session.division}` : ''} <span aria-hidden="true">·</span> <time>Sessão {label}</time></p>
      <nav className="painel-grid" aria-label="O que você pode acessar">
        {botoes.map((b) => (
          <Link key={b.to} to={b.to} className={`menu-btn painel-btn ${b.wide ? 'wide' : ''}`}>
            
            <span className="lbl">{b.label}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
