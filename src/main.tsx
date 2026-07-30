import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Polices variables auto-hébergées (aucun appel réseau à l'exécution) : Archivo porte l'axe de
// chasse utilisé par .font-display / .font-stage, Inter Tight est la police d'interface.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/inter-tight/index.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
