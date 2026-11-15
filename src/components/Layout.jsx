import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import LevelBadge from './LevelBadge.jsx';
import Logo from './Logo.jsx';

const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

const TABS = [
  { to: '/acesso', label: 'Acesso' },
  { to: '/pipeline', label: 'Laboratório de imagem' },
  { to: '/registros', label: 'Registros' },
];

export default function Layout() {
  const { session, endSession, toast, cloudError, bootstrap } = useApp();
  const { label, seconds } = useCountdown(session?.expiresAt);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('cofre.theme', theme); } catch { /* sem armazenamento */ }
  }, [theme]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const go = (to) => { setOpen(false); nav(to); };
  const admin = session?.level === 3;

  return (
    <div className="app">
      <a className="skip" href="#main">Pular para o conteúdo</a>
      <header className="topbar">
        <Link to="/" className="brand-link" aria-label="Cofre Facial, início">
          <Logo size={34} />
          <span><b>Cofre Facial</b><small>Ministério do Meio Ambiente</small></span>
        </Link>
        <span className="divider tabs-div" aria-hidden="true" />
        <nav className="tabs" aria-label="Principal">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right" ref={box}>
          {session ? (
            <button className="lock-btn" onClick={() => { endSession(); nav('/'); }} aria-label={`Trancar o cofre. Sessão termina em ${label}`}>
              <span>Trancar</span><time data-low={seconds <= 30}>{label}</time>
            </button>
          ) : (
            <span className="lock-state" role="status"><span>Trancado</span></span>
          )}
          <button className="icon-btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}>
            {theme === 'dark' ? 'Claro' : 'Escuro'}
          </button>
          <span className="divider" aria-hidden="true" />
          <button className="avatar-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
            aria-label={session ? `Menu de ${session.name}` : 'Menu'}>
            <span className="avatar">{session ? initials(session.name) : 'GA'}</span>
            <span className="caret" aria-hidden="true" />
          </button>
          {open && (
            <div className="menu" role="menu">
              {session ? (
                <div className="menu-head" data-low={seconds <= 30}>
                  <b>{session.name}</b>
                  <small>{session.role}</small>
                  <div><LevelBadge level={session.level} /> <time>Sessão {label}</time></div>
                </div>
              ) : (
                <div className="menu-head"><b>Cofre trancado</b><small>Faça o acesso para continuar.</small></div>
              )}
              {session && <button role="menuitem" onClick={() => go('/painel')}> Painel</button>}
              {!session && <button role="menuitem" onClick={() => go('/acesso')}> Fazer acesso</button>}
              {bootstrap && <button role="menuitem" onClick={() => go('/cadastro')}> Cadastrar primeiro rosto</button>}
              {admin && (
                <>
                  <button role="menuitem" onClick={() => go('/registros')}> Registros</button>
                  <button role="menuitem" onClick={() => go('/gerenciar-noticias')}> Gerenciar notícias</button>
                  <button role="menuitem" onClick={() => go('/importacao')}> Importação em massa</button>
                  <button role="menuitem" onClick={() => go('/configuracoes')}> Configurações</button>
                </>
              )}
              {session && <button role="menuitem" className="menu-out" onClick={() => { setOpen(false); endSession(); nav('/'); }}> Trancar e sair</button>}
            </div>
          )}
        </div>
      </header>
      <main id="main" className="main">
        {cloudError && (
          <div className="banner banner-err" role="alert">
            
            <div>{cloudError}</div>
          </div>
        )}
        <Outlet />
      </main>
      {toast && (
        <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">{toast.message}</div>
      )}
    </div>
  );
}
