import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db } from './lib/storage.js';
import * as cloud from './services/cloud.js';
import { DEFAULT_SETTINGS } from './lib/constants.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const MAX_SNAPSHOTS = 40;
const READY_TIMEOUT_MS = 6000; // sem rede e sem cache: segue com o que houver

export function AppProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [news, setNews] = useState([]);
  const [cloudSettings, setCloudSettings] = useState({});
  const [cameraId, setCameraId] = useState(() => db.loadSettings().cameraId || '');
  const [session, setSession] = useState(() => {
    const s = db.loadSession();
    return s && s.expiresAt > Date.now() ? s : null;
  });
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);
  const [cloudError, setCloudError] = useState('');
  const toastTimer = useRef();
  const logsRef = useRef([]);
  const settingsTimer = useRef(null);
  const pendingSettings = useRef({});

  const notify = useCallback((message, tone = 'ok') => {
    setToast({ message, tone, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const fail = useCallback((e) => {
    console.error('[firebase]', e);
    setCloudError(e?.code === 'permission-denied'
      ? 'O Firebase recusou a operação (regras do Firestore). Publique o arquivo firestore.rules do projeto.'
      : 'Sem conexão com o Firebase. Os dados mostrados podem estar desatualizados e as alterações serão enviadas quando a conexão voltar.');
    setReady(true);
  }, []);

  // Dados em tempo real do Firestore.
  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), READY_TIMEOUT_MS);
    const stop = cloud.subscribe({
      onUsers: (list, fromCache) => {
        setUsers(list);
        if (!fromCache) { setReady(true); setCloudError(''); }
      },
      onLogs: (list) => { logsRef.current = list; setLogs(list); },
      onNews: setNews,
      // enquanto um ajuste está sendo digitado/arrastado, ignora ecos do servidor
      onSettings: (s) => { if (!settingsTimer.current) setCloudSettings(s); },
      onError: fail,
    });
    return () => { clearTimeout(timeout); stop(); };
  }, [fail]);

  const settings = useMemo(() => {
    const { sessionSeconds: saved, ...rest } = cloudSettings;
    // 180 s era o padrão antigo: se ficou salvo no banco, vale o padrão atual (5 minutos).
    const sessionSeconds = saved && saved !== 180 ? saved : DEFAULT_SETTINGS.sessionSeconds;
    return { ...DEFAULT_SETTINGS, ...rest, sessionSeconds, cameraId }; // câmera é por computador
  }, [cloudSettings, cameraId]);

  // encerra a sessão quando o tempo acaba
  useEffect(() => {
    if (!session) return;
    const ms = session.expiresAt - Date.now();
    if (ms <= 0) { setSession(null); db.saveSession(null); return; }
    const t = setTimeout(() => {
      setSession(null);
      db.saveSession(null);
      notify('Sessão encerrada: o tempo expirou.', 'warn');
    }, ms);
    return () => clearTimeout(t);
  }, [session, notify]);

  const startSession = useCallback((user, target) => {
    const s = {
      userId: user.id, name: user.name, role: user.role, level: user.level, division: user.division || '',
      target, startedAt: Date.now(), expiresAt: Date.now() + settings.sessionSeconds * 1000,
    };
    db.saveSession(s);
    setSession(s);
    return s;
  }, [settings.sessionSeconds]);

  const endSession = useCallback((silent) => {
    db.saveSession(null);
    setSession(null);
    if (!silent) notify('Cofre trancado. Sessão encerrada.');
  }, [notify]);

  const addLog = useCallback((entry) => {
    const log = { id: uid(), ts: Date.now(), ...entry };
    cloud.saveLog(log).catch(fail);
    // mantém no máximo MAX_LOGS registros e só as fotos mais recentes
    const next = [log, ...logsRef.current];
    const ops = next.slice(cloud.MAX_LOGS).map((l) => ({ type: 'delete', id: l.id }));
    let seen = 0;
    next.slice(0, cloud.MAX_LOGS).forEach((l) => {
      if (l.snapshot && ++seen > MAX_SNAPSHOTS) ops.push({ type: 'nullSnapshot', id: l.id });
    });
    if (ops.length) cloud.pruneLogs(ops).catch(fail);
  }, [fail]);
  const clearLogs = useCallback(() => cloud.clearLogs().catch(fail), [fail]);

  const addUser = useCallback((u) => {
    const user = { id: uid(), createdAt: Date.now(), ...u };
    cloud.saveUser(user).catch(fail);
    return user;
  }, [fail]);
  const updateUser = useCallback((id, patch) => { cloud.patchUser(id, patch).catch(fail); }, [fail]);
  const removeUser = useCallback((id) => { cloud.deleteUser(id).catch(fail); }, [fail]);

  const addNews = useCallback((n) => {
    const item = { id: uid(), createdAt: Date.now(), ...n };
    cloud.saveNews(item).catch(fail);
    return item;
  }, [fail]);
  const removeNews = useCallback((id) => { cloud.deleteNews(id).catch(fail); }, [fail]);
  /** Salva no banco notícias já normalizadas (ex.: vindas de um feed). */
  const importNews = useCallback(async (list) => {
    const items = list.map((n) => ({
      id: `n${[...n.link].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36)}`,
      title: n.title, source: n.source, link: n.link, excerpt: n.excerpt || '', image: n.image || '',
      date: n.date || Date.now(), createdAt: Date.now(),
    }));
    await cloud.saveManyNews(items);
    return items.length;
  }, []);

  // Importação em massa (itens já validados por lib/importer.js). Retornam a quantidade.
  const bulkNews = useCallback(async (items) => { await cloud.saveManyNews(items); return items.length; }, []);
  const bulkToxins = useCallback(async (items) => { await cloud.saveManyToxins(items); return items.length; }, []);
  const clearNews = useCallback(() => cloud.deleteAllNews(), []);
  const clearToxins = useCallback(() => cloud.deleteAllToxins(), []);
  const bulkAmbiente = useCallback(async (items) => { await cloud.saveManyAmbiente(items); return items.length; }, []);
  const clearAmbiente = useCallback(() => cloud.deleteAllAmbiente(), []);

  const saveSettings = useCallback((patch) => {
    const { cameraId: cam, ...shared } = patch;
    if (cam !== undefined) { setCameraId(cam); db.saveSettings({ cameraId: cam }); }
    if (!Object.keys(shared).length) return;
    setCloudSettings((s) => ({ ...s, ...shared }));
    pendingSettings.current = { ...pendingSettings.current, ...shared };
    clearTimeout(settingsTimer.current);
    // agrupa mudanças rápidas (ex.: arrastar um controle) em uma única gravação
    settingsTimer.current = setTimeout(() => {
      const toSave = pendingSettings.current;
      pendingSettings.current = {};
      settingsTimer.current = null;
      cloud.saveSettings(toSave).catch(fail);
    }, 400);
  }, [fail]);

  const importData = useCallback(async (json) => {
    if (!json || !Array.isArray(json.users)) throw new Error('Arquivo de backup inválido.');
    const usersIn = json.users.map((u) => ({ ...u, id: u.id || uid(), createdAt: u.createdAt || Date.now() }));
    const logsIn = Array.isArray(json.logs)
      ? json.logs.map((l) => ({ ...l, id: l.id || uid(), ts: l.ts || Date.now() }))
      : null;
    let settingsIn = null;
    if (json.settings) { const { cameraId: _c, ...rest } = json.settings; settingsIn = rest; }
    await cloud.replaceAll({ users: usersIn, logs: logsIn, settings: settingsIn });
  }, []);

  const resetAll = useCallback(async () => {
    await cloud.wipeCloud();
    db.wipe();
    setCameraId('');
    setSession(null);
  }, []);

  const bootstrap = !users.some((u) => u.level === 3);
  const isAdmin = session?.level === 3;

  const value = useMemo(
    () => ({
      users, logs, news, settings, session, toast, cloudError, bootstrap, isAdmin,
      addNews, removeNews, importNews, bulkNews, bulkToxins, clearNews, clearToxins, bulkAmbiente, clearAmbiente,
      notify, startSession, endSession, addLog, clearLogs, addUser, updateUser, removeUser,
      saveSettings, importData, resetAll,
    }),
    [users, logs, news, settings, session, toast, cloudError, bootstrap, isAdmin, addNews, removeNews, importNews, bulkNews, bulkToxins, clearNews, clearToxins, bulkAmbiente, clearAmbiente, notify, startSession, endSession,
      addLog, clearLogs, addUser, updateUser, removeUser, saveSettings, importData, resetAll],
  );

  if (!ready) {
    return (
      <div className="splash" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Conectando ao banco de dados…</p>
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
