import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import AdminGate from '../components/AdminGate.jsx';
import LevelBadge from '../components/LevelBadge.jsx';

export default function Usuarios() {
  const { users, removeUser, notify, session } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [lvl, setLvl] = useState(0);
  const [confirm, setConfirm] = useState(null);

  const list = users
    .filter((u) => (!lvl || u.level === lvl) && (u.name + u.role + (u.division || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));

  function doRemove(u) {
    if (u.id === session?.userId) { notify('Você não pode remover a própria conta enquanto está autenticado.', 'err'); setConfirm(null); return; }
    removeUser(u.id); setConfirm(null);
    notify(`${u.name} removido(a). Os dados faciais foram apagados.`);
  }

  return (
    <AdminGate title="Pessoas autorizadas">
      <header className="page-head row">
        <div>
          <h1>Pessoas autorizadas</h1>
          <p>{users.length} {users.length === 1 ? 'rosto cadastrado' : 'rostos cadastrados'}.</p>
        </div>
        <Link className="btn btn-primary" to="/cadastro"> Cadastrar rosto</Link>
      </header>

      <div className="toolbar">
        <label className="field inline grow"><span>Buscar</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, cargo ou divisão" /></label>
        <div className="seg" role="group" aria-label="Filtrar por nível">
          {[0, 1, 2, 3].map((l) => (
            <button key={l} className={lvl === l ? 'on' : ''} onClick={() => setLvl(l)}>{l ? `Nível ${l}` : 'Todos'}</button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty slim"><p>{users.length ? 'Nenhuma pessoa corresponde ao filtro.' : 'Ainda não há ninguém cadastrado.'}</p></div>
      ) : (
        <ul className="people">
          {list.map((u) => (
            <li key={u.id}>
              <img src={u.photo} alt={`Foto de ${u.name}`} width="56" height="56" />
              <div className="p-main">
                <b>{u.name}</b>
                <span>{u.role}{u.division ? ` · ${u.division}` : ''}</span>
                <small>{u.descriptors.length} amostras faciais · cadastrado em {new Date(u.createdAt).toLocaleDateString('pt-BR')}</small>
              </div>
              <LevelBadge level={u.level} />
              <div className="p-actions">
                <button className="btn btn-quiet" onClick={() => nav(`/cadastro?id=${u.id}`)} aria-label={`Editar ${u.name}`}> Editar</button>
                <button className="btn btn-quiet danger" onClick={() => setConfirm(u)} aria-label={`Remover ${u.name}`}> Remover</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirm && (
        <div className="modal-back" onClick={() => setConfirm(null)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="rm-t" onClick={(e) => e.stopPropagation()}>
            <h2 id="rm-t">Remover {confirm.name}?</h2>
            <p>Os descritores faciais serão apagados e essa pessoa perderá o acesso ao cofre.
              {confirm.level === 3 && ' Sem ministro cadastrado, as áreas administrativas voltam ao modo de configuração inicial, abertas a qualquer pessoa.'}</p>
            <div className="actions end">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)} autoFocus>Manter</button>
              <button className="btn btn-danger" onClick={() => doRemove(confirm)}>Remover</button>
            </div>
          </div>
        </div>
      )}
    </AdminGate>
  );
}
