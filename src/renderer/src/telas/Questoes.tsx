import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import { novoId, type Mudar } from '../useDados'
import {
  acertos,
  formatarTempo,
  lerRespostaDaIa,
  montarPrompt,
  refazerEmbaralhado
} from '../../../shared/questoes'
import { acharNo } from '../../../shared/arvore'
import { EscolherLugar } from '../EscolherLugar'
import {
  ajusteSugerido,
  blocoDeAdaptacao,
  diagnosticar,
  nivelAjustado,
  type OpcoesAdaptadas
} from '../../../shared/adaptado'
import { semAcento } from '../../../shared/texto'
import { PainelAdaptado } from './PainelAdaptado'
import type {
  ConfigDoSimulado,
  Dados,
  IaDestino,
  Id,
  Nivel,
  Simulado,
  TipoDeQuestao
} from '../../../shared/tipos'

const CONFIG_INICIAL: ConfigDoSimulado = {
  tema: '',
  assuntoId: null,
  nivel: 'medio',
  tipo: 'multipla',
  quantidade: 10,
  tempoMin: 30,
  banca: ''
}

export function Questoes({
  dados,
  mudar,
  abrirSimulado,
  adaptarDe,
  adaptar,
  pedido
}: {
  dados: Dados
  mudar: Mudar
  abrirSimulado: (id: Id) => void
  /** simulado que serve de base para o próximo adaptado (null = gerador normal) */
  adaptarDe: Id | null
  adaptar: (id: Id | null) => void
  /** "Gerar 1º simulado" do Meu edital: já vem com a matéria (chave muda a cada pedido) */
  pedido?: { materiaId: Id; chave: number; curto?: boolean } | null
}) {
  // a banca do edital já vem preenchida
  const [config, setConfig] = useState<ConfigDoSimulado>(() => ({
    ...CONFIG_INICIAL,
    banca: dados.edital?.banca ?? ''
  }))
  useEffect(() => {
    if (!pedido) return
    const m = dados.materias.find((x) => x.id === pedido.materiaId)
    if (!m) return
    setConfig((c) => ({
      ...c,
      tema: m.nome,
      assuntoId: null,
      materiaId: m.id,
      banca: dados.edital?.banca || c.banca,
      // o simulado curto do estudo do dia
      ...(pedido.curto ? { quantidade: 10, tempoMin: 20 } : {})
    }))
  }, [pedido?.chave]) // eslint-disable-line react-hooks/exhaustive-deps
  const base = adaptarDe ? (dados.simulados.find((x) => x.id === adaptarDe) ?? null) : null
  const diagnostico = useMemo(() => (base ? diagnosticar(base) : null), [base])
  const [opcoes, setOpcoes] = useState<OpcoesAdaptadas | null>(null)
  // ao entrar no modo adaptado, começa pela sugestão e pelo tamanho do último
  useEffect(() => {
    if (!base || !diagnostico) return setOpcoes(null)
    // o conteúdo do edital daquela matéria já vem no "foco no edital"
    // o assunto vale onde está agora; materiaId só no simulado da matéria inteira
    const materiaDaBase = base.config.assuntoId
      ? (acharNo(dados, base.config.assuntoId)?.materia.id ?? null)
      : (base.config.materiaId ?? null)
    const doEdital = dados.edital?.materias.find((m) => m.materiaId === materiaDaBase)?.texto ?? ''
    setOpcoes({
      quantidade: base.questoes.length,
      insistir: true,
      foco: 'equilibrado',
      edital: doEdital,
      banca: base.config.banca,
      ajuste: ajusteSugerido(diagnostico.pct)
    })
    setCopiado(false)
  }, [base?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [ia, setIa] = useState<IaDestino>('claude')
  const [copiado, setCopiado] = useState(false)
  // o texto da IA nunca aparece na tela: tem o gabarito
  const [resposta, setResposta] = useState('')
  const [origem, setOrigem] = useState('')
  const [arrastando, setArrastando] = useState(false)
  const [apagando, setApagando] = useState<Simulado | null>(null)

  const muda = <K extends keyof ConfigDoSimulado>(k: K, v: ConfigDoSimulado[K]): void => {
    setConfig((c) => ({ ...c, [k]: v }))
    setCopiado(false)
  }

  // no modo adaptado, a configuração vem do simulado base + as opções
  const configEfetiva: ConfigDoSimulado =
    base && opcoes
      ? {
          ...base.config,
          nivel: nivelAjustado(base.config.nivel, opcoes.ajuste),
          quantidade: opcoes.quantidade,
          banca: opcoes.banca
        }
      : config
  const topicosConhecidos = base
    ? [
        ...new Set(
          dados.simulados
            .filter((x) => semAcento(x.config.tema) === semAcento(base.config.tema))
            .flatMap((x) => x.questoes.map((q) => q.topico).filter(Boolean) as string[])
        )
      ]
    : []
  const prompt =
    base && opcoes && diagnostico
      ? montarPrompt(configEfetiva, ia, blocoDeAdaptacao(diagnostico, opcoes, topicosConhecidos))
      : montarPrompt(config, ia)
  const temaOk = configEfetiva.tema.trim() !== '' && configEfetiva.quantidade >= 1
  const leitura = useMemo(() => (resposta.trim() ? lerRespostaDaIa(resposta) : null), [resposta])

  const copiar = async (): Promise<void> => {
    await window.api.copiar(prompt)
    setCopiado(true)
  }

  const receber = (texto: string, de: string): void => {
    setResposta(texto)
    setOrigem(texto.trim() ? de : '')
  }
  const lerArquivo = async (arquivo: File | undefined): Promise<void> => {
    if (arquivo) receber(await arquivo.text(), arquivo.name)
  }
  const colar = async (): Promise<void> =>
    receber(await window.api.lerAreaDeTransferencia(), 'área de transferência')

  // Ctrl+V em qualquer lugar da tela (fora dos campos) também cola
  useEffect(() => {
    const aoColar = (e: ClipboardEvent): void => {
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest('input, textarea, select')) return
      const texto = e.clipboardData?.getData('text') ?? ''
      if (texto.includes('{')) {
        e.preventDefault()
        receber(texto, 'área de transferência')
      }
    }
    window.addEventListener('paste', aoColar)
    return () => window.removeEventListener('paste', aoColar)
  }, [])
  const soltar = (e: DragEvent): void => {
    e.preventDefault()
    setArrastando(false)
    void lerArquivo(e.dataTransfer.files[0])
  }

  const iniciar = (): void => {
    if (!leitura?.ok) return
    const id = novoId()
    const n = leitura.questoes.length
    const simulado: Simulado = {
      id,
      config: {
        ...configEfetiva,
        tema: configEfetiva.tema.trim() || leitura.tema || 'Simulado',
        tipo: leitura.tipo,
        quantidade: n
      },
      questoes: leitura.questoes,
      respostas: Array(n).fill(null),
      revisar: Array(n).fill(false),
      tempoPorQuestao: Array(n).fill(0),
      decorridoMs: 0,
      atual: 0,
      criadoEm: Date.now(),
      entregueEm: null
    }
    mudar((d) => {
      d.simulados.push(simulado)
    })
    setResposta('')
    setCopiado(false)
    adaptar(null)
    abrirSimulado(id)
  }

  const historico = [...dados.simulados].sort((a, b) => b.criadoEm - a.criadoEm)

  return (
    <div className="tela">
      <main className="conteudo">
        <header className="cabecalho">
          <div>
            <div className="trilha">
              {base ? 'Questões / Próximo simulado adaptado' : 'Questões / Novo simulado'}
            </div>
            <h1 className="titulo">{base ? base.config.tema : 'Gerador de questões'}</h1>
          </div>
          {base && (
            <button type="button" className="botao" onClick={() => adaptar(null)}>
              Voltar ao gerador normal
            </button>
          )}
          <ol className="etapas" aria-label="Etapas">
            <li className={temaOk ? 'feita' : ''}>1 Configurar</li>
            <li className={copiado ? 'feita' : ''}>2 Copiar prompt</li>
            <li className={leitura?.ok ? 'feita' : ''}>3 Trazer questões</li>
          </ol>
        </header>

        <div className="colunas">
          {base && opcoes && diagnostico ? (
            <PainelAdaptado
              diagnostico={diagnostico}
              opcoes={opcoes}
              mudar={(o) => {
                setOpcoes(o)
                setCopiado(false)
              }}
            />
          ) : (
            <form
              className="form-gerador"
              aria-label="Configurar questões"
              onSubmit={(e) => e.preventDefault()}
            >
              <label className="campo">
                Tema
                <input
                  type="text"
                  placeholder="Ex.: Colocação pronominal"
                  value={config.tema}
                  onChange={(e) => muda('tema', e.target.value)}
                  autoFocus
                />
              </label>
              <EscolherLugar
                dados={dados}
                rotulo="Ligar ao assunto (opcional)"
                nenhum={
                  config.materiaId && !config.assuntoId
                    ? `${dados.materias.find((m) => m.id === config.materiaId)?.nome ?? ''} (matéria inteira)`
                    : 'Nenhum'
                }
                valor={config.assuntoId ?? ''}
                aoEscolher={(valor) => {
                  const id = valor || null
                  muda('assuntoId', id)
                  const a = acharNo(dados, id)
                  // com assunto, a matéria sai dele (e acompanha se ele mudar de lugar)
                  muda('materiaId', undefined)
                  if (a && !config.tema.trim()) muda('tema', a.nome)
                }}
              />

              <Escolha<Nivel>
                rotulo="Nível"
                valor={config.nivel}
                opcoes={[
                  ['facil', 'Fácil'],
                  ['medio', 'Médio'],
                  ['dificil', 'Difícil']
                ]}
                mudar={(v) => muda('nivel', v)}
              />
              <Escolha<TipoDeQuestao>
                rotulo="Formato"
                valor={config.tipo}
                opcoes={[
                  ['multipla', 'Múltipla A–E'],
                  ['certoErrado', 'Certo / Errado']
                ]}
                mudar={(v) => muda('tipo', v)}
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 10
                }}
              >
                <label className="campo">
                  Quantidade
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={config.quantidade}
                    onChange={(e) =>
                      muda('quantidade', Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                    }
                  />
                </label>
                <label className="campo">
                  Tempo (min)
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={config.tempoMin}
                    onChange={(e) =>
                      muda('tempoMin', Math.max(0, Math.min(600, Number(e.target.value) || 0)))
                    }
                    title="0 = sem limite (o cronômetro só conta)"
                  />
                </label>
              </div>
              <label className="campo">
                Banca (opcional)
                <input
                  type="text"
                  placeholder="Ex.: FGV, Cebraspe, FCC"
                  value={config.banca}
                  onChange={(e) => muda('banca', e.target.value)}
                />
              </label>
            </form>
          )}

          <section className="painel-prompt" aria-labelledby="titulo-prompt">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <h2 id="titulo-prompt" className="secao">
                Prompt pronto
              </h2>
              <div
                role="radiogroup"
                aria-label="IA de destino"
                className="opcoes"
                style={{ marginLeft: 'auto', gridTemplateColumns: 'repeat(2, auto)' }}
              >
                {(['claude', 'gpt'] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    role="radio"
                    aria-checked={ia === x}
                    className="opcao"
                    style={{ minHeight: 36, padding: '0 14px' }}
                    onClick={() => {
                      setIa(x)
                      setCopiado(false)
                    }}
                  >
                    {x === 'claude' ? 'Claude' : 'GPT'}
                  </button>
                ))}
              </div>
            </div>
            <pre className="prompt" style={{ opacity: temaOk ? 1 : 0.4 }}>
              {prompt}
            </pre>
            <button
              type="button"
              className="botao principal"
              style={{ alignSelf: 'flex-start' }}
              disabled={!temaOk}
              onClick={() => void copiar()}
            >
              <Icone nome={copiado ? 'check' : 'copiar'} tamanho={16} />
              {copiado ? 'Copiado — cole na IA' : 'Copiar prompt'}
            </button>

            <h2 className="secao" style={{ marginTop: 14 }}>
              Trazer as questões
            </h2>
            <div
              className={`colar ${arrastando ? 'arrastando' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setArrastando(true)
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={soltar}
            >
              <span style={{ color: 'var(--ciano)', display: 'flex' }}>
                <Icone nome="enviar" tamanho={22} />
              </span>
              <span>
                {origem ? `Recebido: ${origem}` : 'Solte aqui o simulado.json que a IA gerou'}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                <label className="botao" style={{ cursor: 'pointer' }}>
                  Abrir arquivo
                  <input
                    type="file"
                    accept=".json,.txt,application/json,text/plain"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      void lerArquivo(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                <button type="button" className="botao" onClick={() => void colar()}>
                  <Icone nome="copiar" tamanho={16} />
                  Colar
                </button>
                {origem && (
                  <button type="button" className="botao" onClick={() => receber('', '')}>
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {leitura && !leitura.ok && (
              <div className="aviso erro" role="alert">
                {leitura.erro}
              </div>
            )}
            {leitura?.ok && (
              <div
                className="aviso ok"
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}
              >
                <span>
                  ✓ {leitura.questoes.length} QUESTÕES VÁLIDAS · GABARITO E RESOLUÇÃO EM TODAS
                  {leitura.questoes.length !== configEfetiva.quantidade &&
                    ` · VOCÊ PEDIU ${configEfetiva.quantidade}`}
                </span>
                <button
                  type="button"
                  className="botao sucesso"
                  style={{ marginLeft: 'auto' }}
                  onClick={iniciar}
                >
                  Iniciar simulado ·{' '}
                  {configEfetiva.tempoMin ? `${configEfetiva.tempoMin} min` : 'sem limite'}
                </button>
              </div>
            )}
          </section>
        </div>

        {historico.length > 0 && (
          <section
            aria-labelledby="titulo-historico"
            style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}
          >
            <h2 id="titulo-historico" className="secao">
              Meus simulados
            </h2>
            <div className="historico">
              {historico.map((s) => {
                const total = s.questoes.length
                const certas = acertos(s.questoes, s.respostas)
                const pct = Math.round((certas / total) * 100)
                return (
                  <div key={s.id} className="linha-historico">
                    <span className="nome">{s.config.tema}</span>
                    <span className="meta">{new Date(s.criadoEm).toLocaleDateString('pt-BR')}</span>
                    <span className="meta">
                      {total} questões · {formatarTempo(s.decorridoMs)}
                    </span>
                    {s.entregueEm ? (
                      <span
                        style={{ fontFamily: 'var(--mono)' }}
                        className={pct >= 70 ? 'nota-boa' : pct >= 50 ? 'nota-media' : 'nota-ruim'}
                      >
                        {certas}/{total} · {pct}%
                      </span>
                    ) : (
                      <span className="meta" style={{ color: 'var(--ambar)' }}>
                        Em andamento
                      </span>
                    )}
                    {s.entregueEm && (
                      <button
                        type="button"
                        className="botao"
                        title="Gerar o próximo simulado com base neste desempenho"
                        onClick={() => adaptar(s.id)}
                      >
                        Adaptar
                      </button>
                    )}
                    <button type="button" className="botao" onClick={() => abrirSimulado(s.id)}>
                      {s.entregueEm ? 'Ver gabarito' : 'Continuar'}
                    </button>
                    {s.entregueEm && (
                      <button
                        type="button"
                        className="botao"
                        title="Mesmas questões, em outra ordem"
                        onClick={() => {
                          const novo = refazerEmbaralhado(s, novoId(), Date.now())
                          mudar((d) => {
                            d.simulados.push(novo)
                          })
                          abrirSimulado(novo.id)
                        }}
                      >
                        <Icone nome="atualizar" tamanho={15} />
                        Refazer
                      </button>
                    )}
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Apagar simulado ${s.config.tema}`}
                      title="Apagar"
                      onClick={() => setApagando(s)}
                    >
                      <Icone nome="lixo" tamanho={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {apagando && (
        <Confirmar
          titulo="Apagar este simulado?"
          texto={`“${apagando.config.tema}” e as respostas dele somem do histórico.`}
          botao="Apagar"
          aoConfirmar={() => {
            const id = apagando.id
            setApagando(null)
            mudar((d) => {
              d.simulados = d.simulados.filter((s) => s.id !== id)
            })
          }}
          aoCancelar={() => setApagando(null)}
        />
      )}
    </div>
  )
}

function Escolha<T extends string>({
  rotulo,
  valor,
  opcoes,
  mudar
}: {
  rotulo: string
  valor: T
  opcoes: [T, string][]
  mudar: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="meta">{rotulo}</span>
      <div
        role="radiogroup"
        aria-label={rotulo}
        className="opcoes"
        style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}
      >
        {opcoes.map(([v, nome]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={valor === v}
            className="opcao"
            onClick={() => mudar(v)}
          >
            {nome}
          </button>
        ))}
      </div>
    </div>
  )
}
