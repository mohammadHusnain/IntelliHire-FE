import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/controls.css';
import './styles/calculator.css';
import './styles/results.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
