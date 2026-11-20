import { useCallback, useEffect, useRef, useState } from 'react'
import { Icone, type NomeDoIcone } from './Icone'
import { useDados } from './useDados'
import { Atualizacao } from './Atualizacao'
import { Configuracoes } from './Configuracoes'
import { OndeEstaSalvo } from './Sincronizar'
import { Anotacoes } from './telas/Anotacoes'
import { Links } from './telas/Links'
import { Questoes } from './telas/Questoes'
import { Simulado } from './telas/Simulado'
import { Flashcards } from './telas/Flashcards'
import { Revisao } from './telas/Revisao'
import { Mapa } from './telas/Mapa'
import { Caixa, type EstadoDaCaixa } from './telas/Caixa'
import { filaDoDia } from '../../shared/flashcards'
import { diasAte } from '../../shared/edital'
import { MeuEdital } from './telas/MeuEdital'
import type { Id } from '../../shared/tipos'

export type Tela = 'edital' | 'anotacoes' | 'flashcards' | 'mapa' | 'links' | 'questoes' | 'caixa'

const MENU: { tela: Tela; nome: string; icone: NomeDoIcone }[] = [
  { tela: 'edital', nome: 'Meu edital', icone: 'alvo' },
  { tela: 'anotacoes', nome: 'Anotações', icone: 'nota' },
  { tela: 'flashcards', nome: 'Flashcards', icone: 'cartas' },
  { tela: 'mapa', nome: 'Mapa mental', icone: 'mapa' },
  { tela: 'links', nome: 'Links', icone: 'link' },
  { tela: 'questoes', nome: 'Questões', icone: 'relogio' },
  { tela: 'caixa', nome: 'Do Claude', icone: 'enviar' }
]

/** quais assuntos a revisão cobre (null = todos) */
export type AlvoDaRevisao = { assuntos: Id[] | null; titulo: string }

export function App() {
  const { dados, mudar, erroAoSalvar } = useDados()
  const [tela, setTela] = useState<Tela>('anotacoes')
  const [assuntoAberto, setAssuntoAberto] = useState<Id | null>(null)
  const [simuladoAberto, setSimuladoAberto] = useState<Id | null>(null)
  const [adaptarDe, setAdaptarDe] = useState<Id | null>(null)
  // "Gerar 1º simulado" do Meu edital: o gerador abre já com a matéria
  const [pedidoDeSimulado, setPedidoDeSimulado] = useState<{
    materiaId: Id
    chave: number
    curto?: boolean
  } | null>(null)
  const [revisao, setRevisao] = useState<AlvoDaRevisao | null>(null)
  const [config, setConfig] = useState(false)
  // a contagem "para hoje" do menu acompanha o relógio (cartão em
  // aprendizado vence em minutos)
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 60000)
    return () => window.clearInterval(id)
  }, [])

  // caixa "Do Claude": busca ao abrir e a cada 30 min
  const [caixa, setCaixa] = useState<EstadoDaCaixa>({ carregando: false, itens: [], erro: '' })
  const buscarCaixa = useCallback(() => {
    setCaixa((c) => ({ ...c, carregando: true }))
    void window.api
      .caixaListar()
      .then((r) =>
        setCaixa(
          'erro' in r
            ? { carregando: false, itens: [], erro: r.erro }
            : { carregando: false, itens: r.itens, erro: '' }
        )
      )
  }, [])
  useEffect(() => {
    buscarCaixa()
    const id = window.setInterval(buscarCaixa, 30 * 60000)
    return () => window.clearInterval(id)
  }, [buscarCaixa])

  // com edital, o app abre nele: é o "por onde começo hoje"
  const abriuNoEdital = useRef(false)
  useEffect(() => {
    if (!dados || abriuNoEdital.current) return
    abriuNoEdital.current = true
    if (dados.edital) setTela('edital')
  }, [dados])

  if (!dados) return null

  const simulado = dados.simulados.find((s) => s.id === simuladoAberto)
  // simulado e revisão ocupam a tela toda: modo foco, sem menu
  if (simulado) {
    return (
      <Simulado
        simulado={simulado}
        dados={dados}
        mudar={mudar}
        sair={() => setSimuladoAberto(null)}
        abrir={setSimuladoAberto}
        adaptar={() => {
          setAdaptarDe(simulado.id)
          setSimuladoAberto(null)
          setTela('questoes')
        }}
        abrirAnotacao={(id) => {
          setSimuladoAberto(null)
          setAssuntoAberto(id)
          setTela('anotacoes')
        }}
      />
    )
  }
  if (revisao) {
    return <Revisao dados={dados} mudar={mudar} alvo={revisao} sair={() => setRevisao(null)} />
  }

  const novidades = caixa.itens.filter((i) => !(dados.caixaImportados ?? []).includes(i.id)).length
  const fila = filaDoDia(dados.cartoes, agora)
  const paraHoje = fila.revisar.length + fila.novos.length
  const diasParaProva = dados.edital ? diasAte(dados.edital.dataProva, agora) : null
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
            {m.tela === 'caixa' && novidades > 0 && (
              <span className="contador" aria-label={`${novidades} novidades`}>
                {novidades}
              </span>
            )}
            {m.tela === 'edital' && diasParaProva !== null && diasParaProva >= 0 && (
              <span className="dias-menu" aria-label={`${diasParaProva} dias para a prova`}>
                {diasParaProva} D
              </span>
            )}
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
              <OndeEstaSalvo erroAoSalvar={erroAoSalvar} />
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
      {tela === 'edital' && (
        <MeuEdital
          dados={dados}
          mudar={mudar}
          agora={agora}
          estudar={setRevisao}
          gerarSimulado={(materiaId, curto) => {
            setPedidoDeSimulado({ materiaId, chave: Date.now(), curto })
            setAdaptarDe(null)
            setTela('questoes')
          }}
          adaptar={(id) => {
            setAdaptarDe(id)
            setTela('questoes')
          }}
          abrirCaixa={() => setTela('caixa')}
          abrirSimulado={setSimuladoAberto}
          abrirAnotacao={abrirAnotacao}
          caixa={caixa.itens}
        />
      )}
      {tela === 'caixa' && (
        <Caixa
          dados={dados}
          mudar={mudar}
          caixa={caixa}
          atualizar={buscarCaixa}
          abrirMapa={() => setTela('mapa')}
          abrirSimulado={setSimuladoAberto}
          abrirFlashcards={() => setTela('flashcards')}
          abrirEdital={() => setTela('edital')}
        />
      )}
      {tela === 'questoes' && (
        <Questoes
          dados={dados}
          mudar={mudar}
          abrirSimulado={setSimuladoAberto}
          adaptarDe={adaptarDe}
          adaptar={setAdaptarDe}
          pedido={pedidoDeSimulado}
        />
      )}

      {config && <Configuracoes dados={dados} mudar={mudar} fechar={() => setConfig(false)} />}
    </div>
  )
}
