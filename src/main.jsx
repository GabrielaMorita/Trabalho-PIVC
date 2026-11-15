try { document.documentElement.dataset.theme = localStorage.getItem('cofre.theme') || 'dark'; } catch { /* sem armazenamento: tema padrão */ }
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import App from './App.jsx';
import { AppProvider } from './AppContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </StrictMode>,
);
