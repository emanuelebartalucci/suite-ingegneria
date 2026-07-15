import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Disabilita la modifica dei valori tramite la rotella del mouse sui campi numerici attivi
document.addEventListener('wheel', () => {
  if (
    document.activeElement &&
    document.activeElement.tagName === 'INPUT' &&
    (document.activeElement as HTMLInputElement).type === 'number'
  ) {
    (document.activeElement as HTMLInputElement).blur();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
