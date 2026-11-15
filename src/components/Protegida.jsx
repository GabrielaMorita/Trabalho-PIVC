import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';

/** Página que exige sessão ativa e um nível mínimo; leva de volta ao acesso se a sessão acabou. */
export default function Protegida({ min, children }) {
  const { session } = useApp();
  if (!session) return <Navigate to="/acesso" replace />;
  if (session.level < min) {
    return (
      <div className="empty">
        
        <h2>Sem permissão para esta página</h2>
        <p>O seu nível não libera este conteúdo.</p>
        <Link className="btn btn-primary" to="/painel">Voltar ao painel</Link>
      </div>
    );
  }
  return (
    <>
      <Link className="back-link" to="/painel">Voltar ao painel</Link>
      {children}
    </>
  );
}
