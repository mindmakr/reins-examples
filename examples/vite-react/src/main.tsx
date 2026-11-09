import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { reins } from 'reins';
import { routerLocation } from 'reins/adapters';
import { App } from './App';
import { store } from './store';
import './styles.css';

if (import.meta.env.DEV) {
  reins.state('app', () => store.getSnapshot());
  reins.state('route', routerLocation());
  void reins.connect({
    lazy: false,
    meta: {
      app: 'payday-invoice-studio',
      framework: 'vite-react',
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
