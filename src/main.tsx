import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.tsx';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    {/* HashRouter (#/settings) because GitHub Pages can't rewrite unknown paths to
        index.html; a refresh on /settings would 404 with BrowserRouter. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
