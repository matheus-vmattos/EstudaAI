import './assets/fonts/fontes.css'
import './estilo.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ConflitoDaNuvem } from './Sincronizar'
import { BlocoDeNotas } from './BlocoDeNotas'

// a mesma página serve à janelinha do bloco de notas (#/bloco)
const ehBloco = location.hash === '#/bloco'

createRoot(document.getElementById('root')!).render(
  ehBloco ? (
    <StrictMode>
      <BlocoDeNotas />
    </StrictMode>
  ) : (
    <StrictMode>
      <App />
      {/* fora do App: a pergunta chega até no simulado e na revisão (modo foco) */}
      <ConflitoDaNuvem />
    </StrictMode>
  )
)
