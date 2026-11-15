import { Link } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';

/** Protege áreas administrativas: só o ministro (Nível 3) autenticado entra.
 *  Se ainda não existe ministro, libera para a configuração inicial. */
export default function AdminGate({ title, children }) {
  const { isAdmin, bootstrap } = useApp();
  if (isAdmin) return children;
  if (bootstrap) {
    return (
      <>
        <div className="banner banner-warn" role="status">
          
          <div>
            <strong>Configuração inicial.</strong> Ainda não há ministro (Nível 3) cadastrado, então esta área está
            aberta. Cadastre o ministro primeiro: depois disso, só ele poderá entrar aqui.
          </div>
        </div>
        {children}
      </>
    );
  }
  return (
    <div className="empty">
      
      <h2>{title} exige o ministro</h2>
      <p>Esta área é exclusiva do Nível 3. Autentique o rosto do ministro para o compartimento “Nível 3”.</p>
      <Link className="btn btn-primary" to="/acesso?alvo=3">Autenticar como ministro</Link>
    </div>
  );
}
