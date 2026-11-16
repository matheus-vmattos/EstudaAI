import { useEffect, useState } from 'react'
import { Icone, type NomeDoIcone } from './Icone'
import { useDados } from './useDados'
import { Atualizacao } from './Atualizacao'
import { Configuracoes } from './Configuracoes'
import { Anotacoes } from './telas/Anotacoes'
import { Links } from './telas/Links'
import { Questoes } from './telas/Questoes'
import { Simulado } from './telas/Simulado'
import { Flashcards } from './telas/Flashcards'
import { Revisao } from './telas/Revisao'
import { Mapa } from './telas/Mapa'
import { filaDoDia } from '../../shared/flashcards'
import type { Id } from '../../shared/tipos'

export type Tela = 'anotacoes' | 'flashcards' | 'mapa' | 'links' | 'questoes'

const MENU: { tela: Tela; nome: string; icone: NomeDoIcone }[] = [
  { tela: 'anotacoes', nome: 'Anotações', icone: 'nota' },
  { tela: 'flashcards', nome: 'Flashcards', icone: 'cartas' },
  { tela: 'mapa', nome: 'Mapa mental', icone: 'mapa' },
  { tela: 'links', nome: 'Links', icone: 'link' },
  { tela: 'questoes', nome: 'Questões', icone: 'relogio' }
]

/** quais assuntos a revisão cobre (null = todos) */
export type AlvoDaRevisao = { assuntos: Id[] | null; titulo: string }

export function App() {
  const { dados, mudar, erroAoSalvar } = useDados()
  const [tela, setTela] = useState<Tela>('anotacoes')
  const [assuntoAberto, setAssuntoAberto] = useState<Id | null>(null)
  const [simuladoAberto, setSimuladoAberto] = useState<Id | null>(null)
  const [adaptarDe, setAdaptarDe] = useState<Id | null>(null)
  const [revisao, setRevisao] = useState<AlvoDaRevisao | null>(null)
  const [config, setConfig] = useState(false)
  // a contagem "para hoje" do menu acompanha o relógio (cartão em
  // aprendizado vence em minutos)
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 60000)
    return () => window.clearInterval(id)
  }, [])

  if (!dados) return null

  const simulado = dados.simulados.find((s) => s.id === simuladoAberto)
  // simulado e revisão ocupam a tela toda: modo foco, sem menu
  if (simulado) {
    return (
      <Simulado
        simulado={simulado}
        mudar={mudar}
        sair={() => setSimuladoAberto(null)}
        abrir={setSimuladoAberto}
        adaptar={() => {
          setAdaptarDe(simulado.id)
          setSimuladoAberto(null)
          setTela('questoes')
        }}
      />
    )
  }
  if (revisao) {
    return <Revisao dados={dados} mudar={mudar} alvo={revisao} sair={() => setRevisao(null)} />
  }

  const fila = filaDoDia(dados.cartoes, agora)
  const paraHoje = fila.revisar.length + fila.novos.length
  const abrirAnotacao = (assuntoId: Id): void => {
    setAssuntoAberto(assuntoId)
    setTela('anotacoes')
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
            onClick={() => setTela(m.tela)}
          >
            <Icone nome={m.icone} />
            {m.nome.toUpperCase()}
            {m.tela === 'flashcards' && paraHoje > 0 && (
              <span className="contador" aria-label={`${paraHoje} para hoje`}>
                {paraHoje}
              </span>
            )}
          </button>
        ))}
        <div className="rodape-menu">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              {erroAoSalvar ? (
                <div style={{ color: 'var(--vermelho)' }}>NÃO CONSEGUI SALVAR</div>
              ) : (
                <div>SALVO NO PC</div>
              )}
              <Atualizacao />
            </div>
            <button
              type="button"
              className="botao-icone"
              aria-label="Configurações"
              title="Configurações"
              onClick={() => setConfig(true)}
            >
              <Icone nome="engrenagem" />
            </button>
          </div>
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
      {tela === 'flashcards' && (
        <Flashcards dados={dados} mudar={mudar} agora={agora} estudar={setRevisao} />
      )}
      {tela === 'mapa' && (
        <Mapa dados={dados} mudar={mudar} abrirAnotacao={abrirAnotacao} estudar={setRevisao} />
      )}
      {tela === 'links' && <Links dados={dados} mudar={mudar} />}
      {tela === 'questoes' && (
        <Questoes
          dados={dados}
          mudar={mudar}
          abrirSimulado={setSimuladoAberto}
          adaptarDe={adaptarDe}
          adaptar={setAdaptarDe}
        />
      )}

      {config && <Configuracoes dados={dados} mudar={mudar} fechar={() => setConfig(false)} />}
    </div>
  )
}
