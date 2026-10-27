import '@ds-css/assets/Source/constellation.css';
import '@ds-css/components/bundle.css';
import '@xyflow/react/dist/base.css';
import './app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme } from './Keys';

applyTheme(); // dark, unless you chose light or auto with :theme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
