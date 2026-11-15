import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Acesso from './pages/Acesso.jsx';
import Painel from './pages/Painel.jsx';
import { PaginaIndicadores, PaginaNoticias, PaginaToxinas } from './pages/Conteudo.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Cadastro from './pages/Cadastro.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Registros from './pages/Registros.jsx';
import Configuracoes from './pages/Configuracoes.jsx';
import GerenciarNoticias from './pages/GerenciarNoticias.jsx';
import ImportacaoMassa from './pages/ImportacaoMassa.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="acesso" element={<Acesso />} />
        <Route path="painel" element={<Painel />} />
        <Route path="noticias" element={<PaginaNoticias />} />
        <Route path="indicadores" element={<PaginaIndicadores />} />
        <Route path="toxinas" element={<PaginaToxinas />} />
        <Route path="cofre" element={<Navigate to="/painel" replace />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="cadastro" element={<Cadastro />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="gerenciar-noticias" element={<GerenciarNoticias />} />
        <Route path="importacao" element={<ImportacaoMassa />} />
        <Route path="registros" element={<Registros />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
