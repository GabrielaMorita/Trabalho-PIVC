import { Link } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import Logo from '../components/Logo.jsx';

/** Primeira tela do sistema. */
export default function Home() {
  const { session } = useApp();
  const itens = [
    { to: session ? '/painel' : '/acesso', label: 'Acesso', primary: true },
    { to: '/pipeline', label: 'Laboratório de imagem' },
    { to: '/registros', label: 'Registros' },
  ];
  return (
    <section className="home-card" aria-labelledby="home-h">
      <div className="home-brand">
        <Logo size={190} />
        <h1 id="home-h">Cofre Facial</h1>
        <p>Ministério do Meio Ambiente</p>
        <small>TECNOLOGIA · PROTEÇÃO · AMBIENTE</small>
      </div>
      <nav className="home-menu" aria-label="Início">
        {itens.map((i) => (
          <Link key={i.to + i.label} to={i.to} className={`menu-btn ${i.primary ? 'primary' : ''}`}>
            
            <span>{i.label}</span>
            
          </Link>
        ))}
      </nav>
    </section>
  );
}
