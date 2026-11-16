import { useState } from 'react'
import { Icone, type NomeDoIcone } from './Icone'
import { useDados } from './useDados'
import { Atualizacao } from './Atualizacao'
import { Anotacoes } from './telas/Anotacoes'
import { Links } from './telas/Links'
import { Questoes } from './telas/Questoes'
import { Simulado } from './telas/Simulado'
import type { Id } from '../../shared/tipos'

export type Tela = 'anotacoes' | 'links' | 'questoes'

const MENU: { tela: Tela | null; nome: string; icone: NomeDoIcone }[] = [
  { tela: 'anotacoes', nome: 'Anotações', icone: 'nota' },
  { tela: null, nome: 'Flashcards', icone: 'cartas' },
  { tela: null, nome: 'Mapa mental', icone: 'mapa' },
  { tela: 'links', nome: 'Links', icone: 'link' },
  { tela: 'questoes', nome: 'Questões', icone: 'relogio' }
]

export function App() {
  const { dados, mudar, erroAoSalvar } = useDados()
  const [tela, setTela] = useState<Tela>('anotacoes')
  const [assuntoAberto, setAssuntoAberto] = useState<Id | null>(null)
  const [simuladoAberto, setSimuladoAberto] = useState<Id | null>(null)

  if (!dados) return null

  const simulado = dados.simulados.find((s) => s.id === simuladoAberto)
  // o simulado ocupa a tela toda: modo foco, sem menu
  if (simulado) {
    return <Simulado simulado={simulado} mudar={mudar} sair={() => setSimuladoAberto(null)} />
  }

  return (
    <div className="app">
      <nav className="menu" aria-label="Módulos">
        <div className="marca">
          <span style={{ color: 'var(--ciano)', display: 'flex' }}>
            <Icone nome="marca" tamanho={22} />
          </span>
          <span>
            ESTUDA<b>AI</b>
          </span>
        </div>
        {MENU.map((m) => (
          <button
            key={m.nome}
            type="button"
            className="item-menu"
            aria-current={m.tela === tela ? 'page' : undefined}
            disabled={!m.tela}
            title={m.tela ? undefined : 'Em breve'}
            onClick={() => m.tela && setTela(m.tela)}
          >
            <Icone nome={m.icone} />
            {m.nome.toUpperCase()}
          </button>
        ))}
        <div className="rodape-menu">
          {erroAoSalvar ? (
            <div style={{ color: 'var(--vermelho)' }}>NÃO CONSEGUI SALVAR</div>
          ) : (
            <div>SALVO NO PC</div>
          )}
          <Atualizacao />
        </div>
      </nav>

      {tela === 'anotacoes' && (
        <Anotacoes
          dados={dados}
          mudar={mudar}
          assuntoId={assuntoAberto}
          abrirAssunto={setAssuntoAberto}
        />
      )}
      {tela === 'links' && <Links dados={dados} mudar={mudar} />}
      {tela === 'questoes' && (
        <Questoes dados={dados} mudar={mudar} abrirSimulado={setSimuladoAberto} />
      )}
    </div>
  )
}
