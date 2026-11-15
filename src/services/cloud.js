// Camada Firestore do cofre. Coleções: users/{id}, logs/{id}, config/settings.
// Sessão e bloqueio de tentativas continuam locais (por navegador) em storage.js.
import {
  collection, doc, setDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { firestore } from './firebase.js';

export const MAX_LOGS = 300;
const BATCH = 400; // limite do Firestore é 500 operações por lote

const usersCol = collection(firestore, 'users');
const logsCol = collection(firestore, 'logs');
const settingsDoc = doc(firestore, 'config', 'settings');
const newsCol = collection(firestore, 'noticias');
const MAX_NEWS = 200;
const toxCol = collection(firestore, 'toxinas');
const MAX_TOXINS = 2000;
const ambCol = collection(firestore, 'ambiente');
const MAX_AMBIENTE = 1000;

// Firestore não aceita array dentro de array: os descritores (lista de vetores)
// são gravados como [{ v: [...128 números] }, ...].
const packUser = (u) => {
  const out = { ...u };
  if (Array.isArray(out.descriptors)) out.descriptors = out.descriptors.map((v) => ({ v }));
  return out;
};
const unpackUser = (d) => ({
  ...d,
  descriptors: Array.isArray(d.descriptors) ? d.descriptors.map((x) => (Array.isArray(x) ? x : x.v)) : [],
});

async function commitInChunks(ops) {
  for (let i = 0; i < ops.length; i += BATCH) {
    const b = writeBatch(firestore);
    ops.slice(i, i + BATCH).forEach((fn) => fn(b));
    await b.commit();
  }
}

/** Ouve os dados em tempo real. onError recebe o erro do Firestore. */
export function subscribe({ onUsers, onLogs, onSettings, onNews, onError }) {
  const fail = (e) => onError?.(e);
  const stops = [
    onSnapshot(usersCol, (s) => {
      const list = s.docs.map((d) => unpackUser({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      onUsers(list, s.metadata.fromCache);
    }, fail),
    onSnapshot(query(logsCol, orderBy('ts', 'desc'), limit(MAX_LOGS)), (s) => {
      onLogs(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, fail),
    onSnapshot(settingsDoc, (s) => onSettings(s.exists() ? s.data() : {}), fail),
    onSnapshot(query(newsCol, orderBy('date', 'desc'), limit(MAX_NEWS)), (s) => {
      onNews(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, fail),
  ];
  return () => stops.forEach((s) => s());
}

export const saveUser = (user) => setDoc(doc(usersCol, user.id), packUser(user));
export const patchUser = (id, patch) => setDoc(doc(usersCol, id), packUser(patch), { merge: true });
export const deleteUser = (id) => deleteDoc(doc(usersCol, id));

export const saveLog = (log) => setDoc(doc(logsCol, log.id), log);
export function pruneLogs(ops) {
  // ops: [{ type: 'delete'|'nullSnapshot', id }]
  if (!ops.length) return Promise.resolve();
  return commitInChunks(ops.map((o) => (b) => {
    const ref = doc(logsCol, o.id);
    if (o.type === 'delete') b.delete(ref); else b.update(ref, { snapshot: null });
  }));
}

export const saveNews = (n) => setDoc(doc(newsCol, n.id), n);
export const deleteNews = (id) => deleteDoc(doc(newsCol, id));
/** Grava várias notícias de uma vez (ids fixos evitam duplicar ao importar de novo). */
export const saveManyNews = (list) => commitInChunks(list.map((n) => (b) => b.set(doc(newsCol, n.id), n)));

export async function deleteAllNews() {
  const ids = await allIds(newsCol);
  await commitInChunks(ids.map((id) => (b) => b.delete(doc(newsCol, id))));
  return ids.length;
}

/** Toxinas: lidas só nas telas que precisam (não entram na escuta global do app). */
export function subscribeToxins(onList, onError) {
  return onSnapshot(query(toxCol, limit(MAX_TOXINS)), (s) => {
    const list = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    onList(list);
  }, (e) => onError?.(e));
}
export const saveManyToxins = (list) => commitInChunks(list.map((t) => (b) => b.set(doc(toxCol, t.id), t)));
export async function deleteAllToxins() {
  const ids = await allIds(toxCol);
  await commitInChunks(ids.map((id) => (b) => b.delete(doc(toxCol, id))));
  return ids.length;
}

/** Dados ambientais (alertas, ocorrências, água, indicadores, contaminantes, riscos e relatórios). */
export function subscribeAmbiente(onList, onError) {
  return onSnapshot(query(ambCol, limit(MAX_AMBIENTE)), (s) => {
    onList(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (e) => onError?.(e));
}
export const saveManyAmbiente = (list) => commitInChunks(list.map((a) => (b) => b.set(doc(ambCol, a.id), a)));
export async function deleteAllAmbiente() {
  const ids = await allIds(ambCol);
  await commitInChunks(ids.map((id) => (b) => b.delete(doc(ambCol, id))));
  return ids.length;
}

export const saveSettings = (patch) => setDoc(settingsDoc, patch, { merge: true });

async function allIds(col) {
  const s = await getDocs(col);
  return s.docs.map((d) => d.id);
}

export async function clearLogs() {
  const ids = await allIds(logsCol);
  await commitInChunks(ids.map((id) => (b) => b.delete(doc(logsCol, id))));
}

/** Substitui usuários (e, se vierem, os registros) pelos de um backup. */
export async function replaceAll({ users, logs, settings }) {
  const oldUsers = await allIds(usersCol);
  const ops = oldUsers.map((id) => (b) => b.delete(doc(usersCol, id)));
  users.forEach((u) => ops.push((b) => b.set(doc(usersCol, u.id), packUser(u))));
  if (logs) {
    const oldLogs = await allIds(logsCol);
    oldLogs.forEach((id) => ops.push((b) => b.delete(doc(logsCol, id))));
    logs.slice(0, MAX_LOGS).forEach((l) => ops.push((b) => b.set(doc(logsCol, l.id), l)));
  }
  if (settings) ops.push((b) => b.set(settingsDoc, settings));
  await commitInChunks(ops);
}

export async function wipeCloud() {
  const [u, l, n, tx, am] = await Promise.all([allIds(usersCol), allIds(logsCol), allIds(newsCol), allIds(toxCol), allIds(ambCol)]);
  const ops = [
    ...u.map((id) => (b) => b.delete(doc(usersCol, id))),
    ...l.map((id) => (b) => b.delete(doc(logsCol, id))),
    ...n.map((id) => (b) => b.delete(doc(newsCol, id))),
    ...tx.map((id) => (b) => b.delete(doc(toxCol, id))),
    ...am.map((id) => (b) => b.delete(doc(ambCol, id))),
    (b) => b.delete(settingsDoc),
  ];
  await commitInChunks(ops);
}
