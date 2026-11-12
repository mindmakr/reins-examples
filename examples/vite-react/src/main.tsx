import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { reins } from '@mindmakr/reins';
import { routerLocation } from '@mindmakr/reins/adapters';
import { recordFromUrl } from '@mindmakr/reins/record';
import { App } from './App';
import { store } from './store';
import './styles.css';

if (import.meta.env.DEV) {
  reins.state('app', () => store.getSnapshot());
  reins.state('route', routerLocation());
  // Opt-in tester recording: opening `?reins=record` mounts the `● Recording · Export` pill without needing a bridge.
  recordFromUrl();
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
