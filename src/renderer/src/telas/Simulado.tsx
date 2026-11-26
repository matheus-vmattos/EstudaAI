import { Texto } from '../Texto'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import { novoId, type Mudar } from '../useDados'
import {
  acertos,
  formatarTempo,
  refazerEmbaralhado,
  resolucaoPorLetra
} from '../../../shared/questoes'
import type { Dados, Id, Simulado as TipoSimulado } from '../../../shared/tipos'
import { EstudarErros } from './EstudarErros'
import { Explique } from '../Explique'
import { explicacaoDoConceito, pedidosDeExplicar, situacaoDe } from '../../../shared/explicar'
import { diagnostico, raioX, ritmoDaProva } from '../../../shared/raioX'
import { notaDeDuvida } from '../../../shared/bloco'
import { notaDaProva, type NotaDaProva } from '../../../shared/provaCompleta'
import { idsAbaixo } from '../../../shared/arvore'
import {
  buscaNoYoutube,
  questoesParaEstudar,
  termosDaVideoaula
} from '../../../shared/estudarErros'

const NOME_DO_TIPO = { multipla: 'Múltipla escolha', certoErrado: 'Certo ou errado' }
const SALVAR_A_CADA_MS = 5000

export function Simulado({
  simulado,
  dados,
  mudar,
  sair,
  abrir,
  adaptar,
  abrirAnotacao
}: {
  simulado: TipoSimulado
  dados: Dados
  mudar: Mudar
  sair: () => void
  /** abre outro simulado (o refeito) no lugar deste */
  abrir: (id: Id) => void
  /** vai para o gerador com o próximo simulado adaptado a este */
  adaptar: () => void
  abrirAnotacao: (id: Id) => void
}) {
  const refazer = (): void => {
    const novo = refazerEmbaralhado(simulado, novoId(), Date.now())
    mudar((d) => {
      d.simulados.push(novo)
    })
    abrir(novo.id)
  }
  return simulado.entregueEm ? (
    <Resultado
      simulado={simulado}
      dados={dados}
      mudar={mudar}
      sair={sair}
      refazer={refazer}
      adaptar={adaptar}
      abrirAnotacao={abrirAnotacao}
    />
  ) : (
    <Prova simulado={simulado} mudar={mudar} sair={sair} />
  )
}

function Prova({
  simulado: s,
  mudar,
  sair
}: {
  simulado: TipoSimulado
  mudar: Mudar
  sair: () => void
}) {
  const [pausado, setPausado] = useState(false)
  const [confirmarEntrega, setConfirmarEntrega] = useState(false)
  const [, setTique] = useState(0)
  // tempo corre em refs: o relógio redesenha a tela, mas só grava no PC
  // a cada 5 s ou quando algo muda (resposta, troca de questão, sair)
  const decorrido = useRef(s.decorridoMs)
  const naQuestao = useRef(0)
  const ultimoTique = useRef(performance.now())
  const ultimoSalvo = useRef(performance.now())

  const limiteMs = s.config.tempoMin * 60000
  const restante = limiteMs - decorrido.current
  const total = s.questoes.length
  const q = s.questoes[s.atual]
  // conferir na hora: na prova completa não (é a prova de verdade)
  const podeConferir = !s.prova
  const conferida = !!s.conferidas?.[s.atual]
  // conferida, o relógio da questão para: ler a explicação não é lentidão
  const parado = useRef(conferida)
  parado.current = conferida

  /** grava o tempo e aplica a mudança junto */
  const gravar = useCallback(
    (mudanca?: (x: TipoSimulado) => void) => {
      const extra = naQuestao.current
      const totalMs = decorrido.current
      naQuestao.current = 0
      ultimoSalvo.current = performance.now()
      mudar((d) => {
        const x = d.simulados.find((y) => y.id === s.id)
        if (!x) return
        x.decorridoMs = totalMs
        x.tempoPorQuestao[x.atual] += extra
        mudanca?.(x)
      })
    },
    [mudar, s.id]
  )

  const entregue = useRef(false)
  const entregar = useCallback(() => {
    if (entregue.current) return
    entregue.current = true
    gravar((x) => (x.entregueEm = Date.now()))
  }, [gravar])

  useEffect(() => {
    ultimoTique.current = performance.now()
    if (pausado) return
    const id = window.setInterval(() => {
      const agora = performance.now()
      const delta = agora - ultimoTique.current
      ultimoTique.current = agora
      decorrido.current += delta
      if (!parado.current) naQuestao.current += delta
      if (limiteMs > 0 && decorrido.current >= limiteMs) {
        decorrido.current = limiteMs
        entregar()
        return
      }
      if (agora - ultimoSalvo.current > SALVAR_A_CADA_MS) gravar()
      setTique((t) => t + 1)
    }, 250)
    return () => window.clearInterval(id)
  }, [pausado, limiteMs, gravar, entregar])

  const irPara = (i: number): void => {
    if (i < 0 || i >= total || i === s.atual) return
    gravar((x) => (x.atual = i))
  }
  const responder = (letra: string): void => {
    if (conferida) return // conferida, a letra fica
    if (podeConferir && s.conferir)
      gravar((x) => {
        x.respostas[x.atual] = letra
        x.conferidas ??= Array(x.questoes.length).fill(false)
        x.conferidas[x.atual] = true
      })
    else gravar((x) => (x.respostas[x.atual] = x.respostas[x.atual] === letra ? null : letra))
  }
  const alternarRevisar = (): void => gravar((x) => (x.revisar[x.atual] = !x.revisar[x.atual]))

  // teclado: letras respondem, setas navegam, espaço pausa
  const teclado = useRef<(e: KeyboardEvent) => void>(() => {})
  teclado.current = (e) => {
    if (confirmarEntrega || e.ctrlKey || e.altKey || e.metaKey) return
    if (e.key === ' ') {
      e.preventDefault()
      setPausado((p) => !p)
      return
    }
    if (pausado) return
    if (e.key === 'ArrowRight') irPara(s.atual + 1)
    else if (e.key === 'ArrowLeft') irPara(s.atual - 1)
    else {
      const letra = e.key.toUpperCase()
      if (q.alternativas.some((a) => a.letra === letra)) responder(letra)
    }
  }
  useEffect(() => {
    const ouvir = (e: KeyboardEvent): void => teclado.current(e)
    window.addEventListener('keydown', ouvir)
    return () => window.removeEventListener('keydown', ouvir)
  }, [])

  const emBranco = s.respostas.filter((r) => r === null).length
  const conferidasAqui = (s.conferidas ?? []).filter(Boolean).length
  const certasConferidas = s.questoes.filter(
    (x, i) => s.conferidas?.[i] && s.respostas[i] === x.gabarito
  ).length
  const respondidas = total - emBranco
  const acabando = limiteMs > 0 && restante < Math.min(5 * 60000, limiteMs * 0.1)
  const tempoNaQuestao = s.tempoPorQuestao[s.atual] + naQuestao.current

  return (
    <div className="prova">
      <header className="topo-prova">
        <button
          type="button"
          className="botao"
          style={{ border: 0, paddingLeft: 0 }}
          onClick={() => {
            gravar()
            sair()
          }}
        >
          <Icone nome="esquerda" tamanho={16} />
          Sair
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="meta">
            Simulado · {NOME_DO_TIPO[s.config.tipo]}
            {s.config.banca && ` · ${s.config.banca}`}
          </span>
          <span
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 600,
              fontSize: 20,
              letterSpacing: '0.06em'
            }}
          >
            {s.config.tema} — Questão {s.atual + 1} de {total}
          </span>
        </div>

        {podeConferir && (
          <button
            type="button"
            role="switch"
            aria-checked={!!s.conferir}
            className="interruptor-conferir"
            title="Ao marcar a letra, mostra o gabarito e a resolução (a letra fica travada)"
            onClick={() => gravar((x) => (x.conferir = !x.conferir))}
          >
            <span className="chave" aria-hidden="true" />
            Conferir na hora
          </button>
        )}
        <div
          role="timer"
          aria-label={limiteMs ? 'Tempo restante' : 'Tempo corrido'}
          className={`cronometro ${acabando ? 'acabando' : ''} ${pausado ? 'pausado' : ''}`}
        >
          <div className="bloco">
            <span className="rotulo">
              {pausado ? 'PAUSADO' : limiteMs ? 'RESTANTE' : 'CORRIDO'}
            </span>
            <span className="grande">{formatarTempo(limiteMs ? restante : decorrido.current)}</span>
          </div>
          <div className="divisor" />
          <div className="bloco">
            <span className="rotulo">NESTA QUESTÃO</span>
            <span className="pequeno">{formatarTempo(tempoNaQuestao)}</span>
          </div>
          <button
            type="button"
            className="botao-icone"
            style={{
              width: 44,
              height: 44,
              borderColor: 'var(--linha-viva)',
              color: 'var(--ciano)'
            }}
            aria-label={pausado ? 'Continuar cronômetro' : 'Pausar cronômetro'}
            title="Espaço"
            onClick={() => setPausado((p) => !p)}
          >
            <Icone nome={pausado ? 'play' : 'pausa'} tamanho={16} cheio />
          </button>
        </div>
      </header>
      <div className="progresso" aria-hidden="true">
        <div style={{ width: `${(respondidas / total) * 100}%` }} />
      </div>

      <div className="corpo-prova">
        {pausado ? (
          <div className="vazio">
            <Icone nome="pausa" tamanho={40} cheio />
            <p>Simulado pausado. As questões ficam escondidas até você continuar.</p>
            <button
              type="button"
              className="botao principal"
              onClick={() => setPausado(false)}
              autoFocus
            >
              Continuar
            </button>
          </div>
        ) : (
          <>
            <main className="questao">
              <p className="enunciado">
                <Texto texto={q.enunciado} />
              </p>
              <div
                role="radiogroup"
                aria-label="Alternativas"
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {q.alternativas.map((a) => (
                  <button
                    key={a.letra}
                    type="button"
                    role="radio"
                    aria-checked={s.respostas[s.atual] === a.letra}
                    disabled={conferida}
                    className={`alternativa ${
                      !conferida
                        ? ''
                        : a.letra === q.gabarito
                          ? 'certa'
                          : a.letra === s.respostas[s.atual]
                            ? 'errada'
                            : 'apagada'
                    }`}
                    onClick={() => responder(a.letra)}
                  >
                    <span className="letra">{a.letra}</span>
                    <span>
                      <Texto texto={a.texto} />
                    </span>
                  </button>
                ))}
              </div>
              {conferida && (
                <Conferencia
                  questao={q}
                  minha={s.respostas[s.atual]}
                  anotar={() => {
                    const nota = notaDeDuvida(q, s.atual + 1, s.config.tema, novoId())
                    mudar((d) => {
                      d.blocoDeNotas = [nota, ...(d.blocoDeNotas ?? [])]
                    })
                    void window.api.bloco.abrir(nota.id)
                  }}
                />
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  type="button"
                  className="botao"
                  style={{ minHeight: 44 }}
                  disabled={s.atual === 0}
                  onClick={() => irPara(s.atual - 1)}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="botao alerta"
                  style={{ minHeight: 44 }}
                  aria-pressed={s.revisar[s.atual]}
                  onClick={alternarRevisar}
                >
                  {s.revisar[s.atual] ? '✓ Marcada p/ revisar' : 'Marcar p/ revisar'}
                </button>
                {s.atual < total - 1 ? (
                  <button
                    type="button"
                    className="botao principal"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => irPara(s.atual + 1)}
                  >
                    Próxima
                  </button>
                ) : (
                  <button
                    type="button"
                    className="botao sucesso"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setConfirmarEntrega(true)}
                  >
                    Entregar
                  </button>
                )}
              </div>
              <p className="meta" style={{ margin: 0 }}>
                Atalhos: letra responde · ← → navega · espaço pausa
              </p>
            </main>

            <aside className="mapa" aria-label="Mapa das questões">
              <h2 className="secao" style={{ fontSize: 14 }}>
                Questões
              </h2>
              <div className="mapa-grade">
                {s.questoes.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Questão ${i + 1}`}
                    aria-current={i === s.atual ? 'step' : undefined}
                    className={
                      s.conferidas?.[i]
                        ? s.respostas[i] === s.questoes[i].gabarito
                          ? 'certa'
                          : 'errada'
                        : s.revisar[i]
                          ? 'revisar'
                          : s.respostas[i]
                            ? 'respondida'
                            : ''
                    }
                    onClick={() => irPara(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="legenda meta">
                <span>
                  <span style={{ color: 'var(--ciano)' }}>■</span> Respondida ({respondidas})
                </span>
                <span>
                  <span style={{ color: 'var(--ambar)' }}>■</span> P/ revisar (
                  {s.revisar.filter(Boolean).length})
                </span>
                <span>□ Em branco ({emBranco})</span>
                {conferidasAqui > 0 && (
                  <>
                    <span>
                      <span style={{ color: 'var(--verde)' }}>■</span> Certa, conferida (
                      {certasConferidas})
                    </span>
                    <span>
                      <span style={{ color: 'var(--vermelho)' }}>■</span> Errada, conferida (
                      {conferidasAqui - certasConferidas})
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                className="botao sucesso"
                style={{ minHeight: 48 }}
                onClick={() => setConfirmarEntrega(true)}
              >
                Entregar e ver gabarito
              </button>
            </aside>
          </>
        )}
      </div>

      {confirmarEntrega && (
        <Confirmar
          titulo="Entregar o simulado?"
          texto={
            emBranco
              ? `Ainda há ${emBranco} ${emBranco === 1 ? 'questão' : 'questões'} em branco.`
              : 'Depois de entregar, você vê o gabarito e a resolução de cada questão.'
          }
          botao="Entregar"
          aoConfirmar={() => {
            setConfirmarEntrega(false)
            entregar()
          }}
          aoCancelar={() => setConfirmarEntrega(false)}
        />
      )}
    </div>
  )
}

/** Conferir na hora: o gabarito logo abaixo da questão, com o porquê */
function Conferencia({
  questao: q,
  minha,
  anotar
}: {
  questao: TipoSimulado['questoes'][number]
  minha: string | null
  anotar: () => void
}) {
  const { porLetra, resto } = resolucaoPorLetra(q)
  const certo = minha === q.gabarito
  const porQueNao = !certo && minha ? porLetra[minha] : undefined
  const resolucao = resto || porLetra[q.gabarito] || q.resolucao
  return (
    <section className={`conferencia ${certo ? 'certo' : 'errado'}`} aria-live="polite">
      <span className="rotulo-retorno">{certo ? 'Certo' : `Era ${q.gabarito}`}</span>
      {porQueNao && (
        <p>
          <b>Por que não {minha}:</b> <Texto texto={porQueNao} />
        </p>
      )}
      <p>
        <b>Resolução:</b> <Texto texto={resolucao} />
      </p>
      {q.conceito && (
        <p className="meta-conceito">
          <b>Conceito:</b> <Texto texto={q.conceito} />
        </p>
      )}
      <div>
        <button type="button" className="botao" onClick={anotar}>
          <Icone nome="lapis" tamanho={14} />
          Anotar dúvida
        </button>
      </div>
    </section>
  )
}

function Resultado({
  simulado: s,
  dados,
  mudar,
  sair,
  refazer,
  adaptar,
  abrirAnotacao
}: {
  simulado: TipoSimulado
  dados: Dados
  mudar: Mudar
  sair: () => void
  refazer: () => void
  adaptar: () => void
  abrirAnotacao: (id: Id) => void
}) {
  const [atual, setAtual] = useState(0)
  // prova completa abre no resumo (notas como a banca calcula); o resto, no Raio-X
  const nota = notaDaProva(s)
  const [vista, setVista] = useState<'resumo' | 'raiox' | 'gabarito'>(nota ? 'resumo' : 'raiox')
  const [filtro, setFiltro] = useState<'todas' | 'estudar'>('todas')
  const [estudando, setEstudando] = useState(false)
  const paraEstudar = questoesParaEstudar(s).map((x) => x.indice)
  const visiveis = filtro === 'todas' ? s.questoes.map((_, i) => i) : paraEstudar
  const posicao = visiveis.indexOf(atual)
  // links que você já guardou no assunto do simulado (e abaixo dele)
  const doAssunto = s.config.assuntoId ? new Set(idsAbaixo(dados, s.config.assuntoId)) : null
  const seusLinks = doAssunto
    ? dados.links.filter((l) => l.assuntoId && doAssunto.has(l.assuntoId)).slice(0, 4)
    : []
  const total = s.questoes.length
  const certas = acertos(s.questoes, s.respostas)
  const emBranco = s.respostas.filter((r) => r === null).length
  const pct = Math.round((certas / total) * 100)
  const q = s.questoes[atual]
  const minha = s.respostas[atual]
  const { porLetra, resto } = resolucaoPorLetra(q)
  const separada = Object.keys(porLetra).length > 0
  // ao trocar de questão, volta para o topo (a tela rola)
  const corpo = useRef<HTMLDivElement>(null)
  useEffect(() => {
    corpo.current?.scrollTo({ top: 0 })
  }, [atual])

  return (
    <div className="prova">
      <header className="topo-prova">
        <button
          type="button"
          className="botao"
          style={{ border: 0, paddingLeft: 0 }}
          onClick={sair}
        >
          <Icone nome="esquerda" tamanho={16} />
          Voltar
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="meta">
            Resultado · {new Date(s.entregueEm ?? s.criadoEm).toLocaleString('pt-BR')}
          </span>
          <span
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 600,
              fontSize: 20,
              letterSpacing: '0.06em'
            }}
          >
            {s.config.tema}
          </span>
        </div>
        <button
          type="button"
          className="botao principal"
          style={{ marginLeft: 'auto' }}
          onClick={adaptar}
        >
          Próximo adaptado
        </button>
        {paraEstudar.length > 0 && (
          <button
            type="button"
            className="botao"
            aria-pressed={estudando}
            onClick={() => setEstudando(!estudando)}
          >
            Estudar meus erros
            <span className="numero-ambar">{paraEstudar.length}</span>
          </button>
        )}
        <div role="tablist" aria-label="Ver" className="opcoes abas-resultado">
          {(
            [
              ...(nota ? [['resumo', 'Resumo']] : []),
              ['raiox', 'Raio-X'],
              ['gabarito', 'Gabarito']
            ] as ['resumo' | 'raiox' | 'gabarito', string][]
          ).map(([v, nome]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vista === v && !estudando}
              className="opcao"
              onClick={() => {
                setVista(v)
                setEstudando(false)
              }}
            >
              {nome}
            </button>
          ))}
        </div>
        <button type="button" className="botao" onClick={refazer}>
          <Icone nome="atualizar" tamanho={16} />
          Refazer embaralhado
        </button>
        <div className="placar">
          <div>
            <span className="meta">Acertos</span>
            <span
              className={`numero ${pct >= 70 ? 'nota-boa' : pct >= 50 ? 'nota-media' : 'nota-ruim'}`}
            >
              {certas}/{total}
            </span>
          </div>
          <div>
            <span className="meta">Aproveitamento</span>
            <span className="numero">{pct}%</span>
          </div>
          <div>
            <span className="meta">Tempo</span>
            <span className="numero">{formatarTempo(s.decorridoMs)}</span>
          </div>
          <div>
            <span className="meta">Média/questão</span>
            <span className="numero">{formatarTempo(raioX(s).ritmo ?? s.decorridoMs / total)}</span>
          </div>
        </div>
      </header>

      {nota && vista === 'resumo' && !estudando ? (
        <ResumoDaProva nota={nota} />
      ) : vista === 'raiox' && !estudando ? (
        <RaioXDoSimulado
          key={s.id}
          simulado={s}
          dados={dados}
          mudar={mudar}
          irPara={(i) => {
            setFiltro('todas')
            setAtual(i)
            setVista('gabarito')
          }}
        />
      ) : estudando ? (
        <EstudarErros
          simulado={s}
          dados={dados}
          mudar={mudar}
          voltar={() => setEstudando(false)}
          abrirAnotacao={abrirAnotacao}
        />
      ) : (
        <div className="corpo-prova" ref={corpo}>
          <main className="questao">
            <div className="linha-duvida">
              <div className="meta">
                Questão {atual + 1} de {total} ·{' '}
                {minha === null
                  ? 'em branco'
                  : minha === q.gabarito
                    ? 'você acertou'
                    : 'você errou'}
                {s.revisar[atual] && (
                  <span style={{ color: 'var(--ambar)' }}> · ■ marcada p/ revisar</span>
                )}{' '}
                · {formatarTempo(s.tempoPorQuestao[atual])} nela
              </div>
              <button
                type="button"
                className="botao"
                title="Cria uma nota com esta questão no bloco de notas flutuante"
                onClick={() => {
                  const nota = notaDeDuvida(q, atual + 1, s.config.tema, novoId())
                  mudar((d) => {
                    d.blocoDeNotas = [nota, ...(d.blocoDeNotas ?? [])]
                  })
                  void window.api.bloco.abrir(nota.id)
                }}
              >
                <Icone nome="lapis" tamanho={14} />
                Anotar dúvida
              </button>
            </div>
            <p className="enunciado">
              <Texto texto={q.enunciado} />
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {q.alternativas.map((a) => {
                const certa = a.letra === q.gabarito
                const classe = certa ? 'certa' : a.letra === minha ? 'errada' : ''
                const comentario = porLetra[a.letra]
                return (
                  <div key={a.letra} className={`bloco-alternativa ${classe}`}>
                    <div className="cabeca-alternativa">
                      <span className="letra">{a.letra}</span>
                      <span style={{ flex: 1 }}>
                        <Texto texto={a.texto} />
                      </span>
                      {certa && (
                        <span className="meta" style={{ color: 'var(--verde)' }}>
                          Gabarito
                        </span>
                      )}
                      {a.letra === minha && !certa && (
                        <span className="meta" style={{ color: 'var(--vermelho)' }}>
                          Sua resposta
                        </span>
                      )}
                    </div>
                    {comentario && (
                      <p className="comentario">
                        {certa ? '✓ ' : a.letra === minha ? '✗ ' : ''}
                        <Texto texto={comentario} />
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {(!separada || resto) && (
              <section className="bloco-explicacao">
                <h2 className="secao">Resolução</h2>
                <p>
                  <Texto texto={separada ? resto : q.resolucao} />
                </p>
              </section>
            )}
            {q.conceito && (
              <section className="bloco-explicacao conceito">
                <h2 className="secao">Conceito</h2>
                <p>
                  <Texto texto={q.conceito} />
                </p>
              </section>
            )}
            <section className="bloco-explicacao videoaulas" aria-labelledby="t-videos">
              <h2 id="t-videos" className="secao">
                Vídeo-aulas
              </h2>
              <div className="chips">
                <button
                  type="button"
                  className="chip video"
                  onClick={() =>
                    void window.api.abrirLink(buscaNoYoutube(termosDaVideoaula(q, s.config.tema)))
                  }
                >
                  <Icone nome="play" tamanho={14} cheio />
                  Buscar no YouTube: “{termosDaVideoaula(q, s.config.tema)}”
                </button>
                {q.videoaula?.canais.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="chip video"
                    onClick={() =>
                      void window.api.abrirLink(
                        buscaNoYoutube(`${c} ${termosDaVideoaula(q, s.config.tema)}`)
                      )
                    }
                  >
                    <Icone nome="play" tamanho={14} cheio />
                    {c}
                  </button>
                ))}
                {seusLinks.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="chip"
                    title={l.url}
                    onClick={() => void window.api.abrirLink(l.url)}
                  >
                    <Icone nome="play" tamanho={14} />
                    Seu link: {l.titulo}
                  </button>
                ))}
              </div>
            </section>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="botao"
                style={{ minHeight: 44 }}
                disabled={posicao <= 0}
                onClick={() => setAtual(visiveis[posicao - 1])}
              >
                Anterior
              </button>
              <button
                type="button"
                className="botao principal"
                style={{ marginLeft: 'auto' }}
                disabled={posicao === -1 || posicao >= visiveis.length - 1}
                onClick={() => setAtual(visiveis[posicao + 1])}
              >
                Próxima
              </button>
            </div>
          </main>

          <aside className="mapa" aria-label="Mapa do resultado">
            <h2 className="secao" style={{ fontSize: 14 }}>
              Questões
            </h2>
            {paraEstudar.length > 0 && (
              <div
                role="radiogroup"
                aria-label="Mostrar"
                className="opcoes"
                style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
              >
                {(
                  [
                    ['todas', `Todas · ${total}`],
                    ['estudar', `Erros + marcadas · ${paraEstudar.length}`]
                  ] as const
                ).map(([v, nome]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={filtro === v}
                    className="opcao"
                    style={{ minHeight: 36, fontSize: 12 }}
                    onClick={() => {
                      setFiltro(v)
                      if (v === 'estudar' && !paraEstudar.includes(atual)) setAtual(paraEstudar[0])
                    }}
                  >
                    {nome}
                  </button>
                ))}
              </div>
            )}
            <div className="mapa-grade">
              {visiveis.map((i) => {
                const x = s.questoes[i]
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Questão ${i + 1}${s.revisar[i] ? ', marcada para revisar' : ''}`}
                    aria-current={i === atual ? 'step' : undefined}
                    className={`${
                      s.respostas[i] === null
                        ? ''
                        : s.respostas[i] === x.gabarito
                          ? 'certa'
                          : 'errada'
                    } ${s.revisar[i] ? 'marcada' : ''}`}
                    onClick={() => setAtual(i)}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="legenda meta">
              <span>
                <span style={{ color: 'var(--verde)' }}>■</span> Certa ({certas})
              </span>
              <span>
                <span style={{ color: 'var(--vermelho)' }}>■</span> Errada (
                {total - certas - emBranco})
              </span>
              <span>□ Em branco ({emBranco})</span>
              {s.revisar.some(Boolean) && (
                <span>
                  <span style={{ color: 'var(--ambar)' }}>■</span> Marcada p/ revisar (
                  {s.revisar.filter(Boolean).length}) · conta no adaptado
                </span>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

const tempo = (ms: number): string => {
  const seg = Math.round(ms / 1000)
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`
}

/** O Raio-X (mockup "Raio-X polido", aprovado em 25/11): o padrão com a prova,
 *  cada erro com o engano que deu aquele número, o conceito para explicar e os
 *  acertos inseguros. Um número de tempo só: o seu tempo médio. */
function RaioXDoSimulado({
  simulado: s,
  dados,
  mudar,
  irPara
}: {
  simulado: TipoSimulado
  dados: Dados
  mudar: Mudar
  irPara: (indice: number) => void
}) {
  const r = raioX(s)
  const d = diagnostico(s, r)
  const [pulados, setPulados] = useState<number[]>([])
  const [todosOsErros, setTodosOsErros] = useState(false)
  // os pedidos desta visita ficam: passar no teste fecha o conceito, mas a
  // lição (o comentário da última resposta, o "Entendido") continua na tela
  const [pedidos] = useState(() => pedidosDeExplicar(s, r, dados))
  const pedidosVisiveis = pedidos.filter((p) => !pulados.includes(p.indice))
  const explicacoesDaqui = pedidos
    .map((p) => explicacaoDoConceito(dados, p.pergunta, p.legado))
    .filter((x): x is NonNullable<typeof x> => !!x?.texto.trim())
  const avaliadas = explicacoesDaqui.filter((x) => situacaoDe(dados, x) !== 'esperando').length
  const e = dados.edital
  const naProva =
    e?.duracaoMin && e.materias.length
      ? ritmoDaProva(
          e.duracaoMin,
          e.materias.reduce((n, m) => n + m.questoes, 0)
        )
      : s.config.tempoMin
        ? ritmoDaProva(s.config.tempoMin, s.questoes.length)
        : null
  const total = s.questoes.length
  const erros = todosOsErros ? d.erros : d.erros.slice(0, 6)
  const resumo = (i: number): string => {
    const t = s.questoes[i].enunciado.replace(/\s+/g, ' ').trim()
    return t.length > 90 ? `${t.slice(0, 88).trimEnd()}…` : t
  }
  const irParaSecao = (id: string): void =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className="corpo-prova">
      <main className="questao raio-x">
        <section aria-labelledby="t-diag" className="diagnostico">
          <div className="diag-principal">
            <h2 id="t-diag" className="secao">
              O que este {s.questoes.length >= 30 ? 'treino' : 'simulado'} mostrou
            </h2>
            <p className="frase-raio-x">{d.frase}</p>
            {d.pontos.length > 0 && (
              <ul className="pontos-diag">
                {d.pontos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {r.ritmo !== null && (
              <span className="meta">
                Seu tempo médio: {tempo(r.ritmo)} por questão
                {naProva !== null && ` · a prova dá ${tempo(naProva)}`}
              </span>
            )}
          </div>
          <div className="diag-lado">
            <h3 className="secao">Por tópico</h3>
            {d.topicos.slice(0, 6).map((t) => {
              const pct = t.certas / t.total
              return (
                <div key={t.topico} className="barra-topico">
                  <div>
                    <span>{t.topico}</span>
                    <span
                      className={`numero-pequeno ${pct >= 0.9 ? 'nota-boa' : pct >= 0.7 ? 'nota-media' : 'nota-ruim'}`}
                    >
                      {t.certas}/{t.total}
                    </span>
                  </div>
                  <div className="trilho" aria-hidden="true">
                    <span
                      className={pct >= 0.9 ? 'boa' : pct >= 0.7 ? 'media' : 'ruim'}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
            <div className="como-acertou">
              <span className="meta">Como você acertou</span>
              <div className="faixa-acertos">
                {d.firmes > 0 && (
                  <span className="firmes" style={{ flexGrow: d.firmes }}>
                    {d.firmes} firmes
                  </span>
                )}
                {d.inseguras.length > 0 && (
                  <button
                    type="button"
                    className="inseguras"
                    style={{ flexGrow: d.inseguras.length }}
                    onClick={() => irParaSecao('t-inseguras')}
                  >
                    {d.inseguras.length} {d.inseguras.length === 1 ? 'insegura' : 'inseguras'}
                  </button>
                )}
                {d.erros.length > 0 && (
                  <button
                    type="button"
                    className="erradas"
                    style={{ flexGrow: d.erros.length }}
                    onClick={() => irParaSecao('t-erros')}
                  >
                    {d.erros.length}
                  </button>
                )}
              </div>
              <span className="meta">
                Insegura = acertou, mas levou mais que o dobro do seu tempo médio ou marcou dúvida.
              </span>
            </div>
          </div>
        </section>

        {d.erros.length > 0 && (
          <section aria-labelledby="t-erros" className="erros-raio-x">
            <div className="cabeca-dia">
              <h2 id="t-erros" className="secao">
                {d.erros.length === 1 ? 'Seu erro' : `Seus ${d.erros.length} erros`}
              </h2>
              <span className="meta">O que você marcou e qual engano dá aquela resposta</span>
            </div>
            {erros.map((x) => (
              <div key={x.indice} className={`raiox-erro ${x.rapido ? 'rapido' : ''}`}>
                <span className="numero-erro">{x.indice + 1}</span>
                <div className="erro-questao">
                  <span>{resumo(x.indice)}</span>
                  <span className="meta">
                    {x.marcada === null ? 'Em branco' : `Marcou ${x.marcada}`} · certa {x.certa}
                    {x.ms > 0 && ` · ${tempo(x.ms)}${x.rapido ? ', rápido' : ''}`}
                    {s.conferidas?.[x.indice] && ' · conferida na hora'}
                  </span>
                </div>
                <span className="erro-motivo">
                  {x.motivo ??
                    (x.rapido
                      ? 'Errou abaixo do seu tempo médio: leia o que a questão pede antes de marcar.'
                      : 'Veja a resolução passo a passo.')}
                </span>
                <button type="button" className="botao passo" onClick={() => irPara(x.indice)}>
                  Ver questão
                  <Icone nome="direita" tamanho={14} />
                </button>
              </div>
            ))}
            {d.erros.length > 6 && (
              <button
                type="button"
                className="botao"
                style={{ alignSelf: 'flex-start' }}
                aria-expanded={todosOsErros}
                onClick={() => setTodosOsErros(!todosOsErros)}
              >
                {todosOsErros ? 'Mostrar menos' : `Ver todos os ${d.erros.length} erros`}
              </button>
            )}
          </section>
        )}

        {pedidosVisiveis.length > 0 && (
          <section aria-labelledby="t-agora" className="agora-explique">
            <div className="cabeca-dia">
              <h2 id="t-agora" className="secao">
                Explique o conceito
              </h2>
              <span className="meta">
                {pedidos.length} {pedidos.length === 1 ? 'conceito' : 'conceitos'} deste treino · a
                mesma pergunta volta até ficar certa
                {explicacoesDaqui.length > 0 &&
                  ` · ${avaliadas} ${avaliadas === 1 ? 'avaliado' : 'avaliados'} · ${explicacoesDaqui.length - avaliadas} esperando o Claude`}
              </span>
            </div>
            {pedidosVisiveis.map((p) => (
              <Explique
                key={p.indice}
                dados={dados}
                mudar={mudar}
                numero={pedidos.indexOf(p) + 1}
                topico={p.topico}
                pergunta={p.pergunta}
                detalhe={`${p.topico} · ${p.motivo}`}
                legado={p.legado}
                questao={s.questoes[p.indice]}
                aoPular={() => setPulados((x) => [...x, p.indice])}
              />
            ))}
          </section>
        )}

        {d.inseguras.length > 0 && (
          <section aria-labelledby="t-inseguras" className="inseguras-raio-x">
            <div className="cabeca-dia">
              <h2 id="t-inseguras" className="secao">
                {d.inseguras.length}{' '}
                {d.inseguras.length === 1 ? 'acerto inseguro' : 'acertos inseguros'}
              </h2>
              <span className="meta">Reveja antes de virar erro</span>
            </div>
            <div className="chips">
              {d.inseguras.map((x) => (
                <button
                  key={x.indice}
                  type="button"
                  className="chip inseguro"
                  onClick={() => irPara(x.indice)}
                >
                  {x.indice + 1}
                  {x.ms > 0 && ` · ${tempo(x.ms)}`}
                  {x.vezes !== null && x.vezes >= 2 && ` (${x.vezes.toFixed(0)}× seu tempo)`}
                  {x.duvida && ' · dúvida'}
                </button>
              ))}
            </div>
          </section>
        )}
        {total > 0 && d.erros.length === 0 && d.inseguras.length === 0 && (
          <p className="meta">Nada para rever aqui: todas firmes.</p>
        )}
      </main>
    </div>
  )
}

const nota10 = (x: number): string =>
  x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Prova completa: as notas como a banca calcula e o acerto por matéria,
 *  da que mais custou nota para a que menos */
function ResumoDaProva({ nota }: { nota: NotaDaProva }) {
  return (
    <div className="corpo-prova">
      <main className="questao resumo-prova">
        <div className="placar">
          {nota.provas.map((p) => (
            <div key={p.peso}>
              <span className="meta">
                {nota.provas.length > 1 ? `Prova peso ${p.peso}` : 'Nota'}
              </span>
              <span className="numero">{nota10(p.nota)}</span>
              <span className="meta">
                {p.acertos} de {p.total}
              </span>
            </div>
          ))}
          <div>
            <span className="meta">Nota final</span>
            <span className={`numero ${nota.passaria === false ? 'nota-ruim' : 'nota-boa'}`}>
              {nota10(nota.final)}
            </span>
            {nota.passaria !== null && (
              <span className="meta">{nota.passaria ? 'Passaria' : 'Abaixo do mínimo'}</span>
            )}
          </div>
        </div>
        <section aria-labelledby="t-por-materia" className="lista-edital">
          <h2 id="t-por-materia" className="secao">
            Por matéria · do que mais custou nota
          </h2>
          {nota.porMateria.map((m) => {
            const pct = m.total ? m.acertos / m.total : 0
            return (
              <div key={m.materiaId} className="linha-resumo">
                <span className="nome">{m.nome}</span>
                <span className="numero-pequeno">
                  {m.acertos}/{m.total}
                </span>
                <span className="barra">
                  <span
                    style={{
                      width: `${pct * 100}%`,
                      background:
                        pct >= 0.7
                          ? 'var(--verde)'
                          : pct >= 0.5
                            ? 'var(--ambar)'
                            : 'var(--vermelho)'
                    }}
                  />
                </span>
                <span
                  className={`numero-pequeno ${pct >= 0.7 ? 'nota-boa' : pct >= 0.5 ? 'nota-media' : 'nota-ruim'}`}
                >
                  {Math.round(pct * 100)}%
                </span>
              </div>
            )
          })}
        </section>
      </main>
    </div>
  )
}
