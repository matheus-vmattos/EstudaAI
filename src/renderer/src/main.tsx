import './assets/fonts/fontes.css'
import './estilo.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ConflitoDaNuvem } from './Sincronizar'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* fora do App: a pergunta chega até no simulado e na revisão (modo foco) */}
    <ConflitoDaNuvem />
  </StrictMode>
)
