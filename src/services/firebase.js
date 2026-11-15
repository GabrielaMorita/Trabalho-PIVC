// Inicialização do Firebase (projeto trabalho-pivc).
// Esta configuração do app web não é segredo: quem protege os dados são as
// regras do Firestore (veja firestore.rules).
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBhAtGsh79alAzY2XgmwuCXDdyX29eAjC4',
  authDomain: 'trabalho-pivc.firebaseapp.com',
  projectId: 'trabalho-pivc',
  storageBucket: 'trabalho-pivc.firebasestorage.app',
  messagingSenderId: '78288732049',
  appId: '1:78288732049:web:68d0f5dc35ce9a1e42a430',
  measurementId: 'G-YLMWV2PPKG',
};

export const app = initializeApp(firebaseConfig);

// Cache local em IndexedDB: o app continua abrindo sem internet e sincroniza ao voltar.
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

// Analytics só funciona em https/localhost e fora de bloqueadores; falha em silêncio.
isSupported()
  .then((ok) => { if (ok) getAnalytics(app); })
  .catch(() => {});
