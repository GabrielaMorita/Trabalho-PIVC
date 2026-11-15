// Armazenamento LOCAL (por navegador): sessão, bloqueio de tentativas e a câmera escolhida.
// Usuários, registros e ajustes compartilhados ficam no Firestore (src/services/cloud.js).
const K = {
  users: 'cofre.users',
  logs: 'cofre.logs',
  settings: 'cofre.settings',
  session: 'cofre.session',
  lock: 'cofre.lock',
};

function read(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(store, key, value) {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const db = {
  loadUsers: () => read(localStorage, K.users, []),
  saveUsers: (v) => write(localStorage, K.users, v),
  loadLogs: () => read(localStorage, K.logs, []),
  saveLogs: (v) => write(localStorage, K.logs, v),
  loadSettings: () => read(localStorage, K.settings, {}),
  saveSettings: (v) => write(localStorage, K.settings, v),
  loadSession: () => read(sessionStorage, K.session, null),
  saveSession: (v) =>
    v ? write(sessionStorage, K.session, v) : (sessionStorage.removeItem(K.session), true),
  loadLock: () => read(localStorage, K.lock, { until: 0, fails: 0 }),
  saveLock: (v) => write(localStorage, K.lock, v),
  wipe: () => {
    [K.users, K.logs, K.settings, K.lock].forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(K.session);
  },
};
