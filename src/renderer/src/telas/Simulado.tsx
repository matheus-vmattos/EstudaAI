import { useCallback, useEffect, useRef, useState } from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import type { Mudar } from '../useDados'
import { acertos, formatarTempo } from '../../../shared/questoes'
import type { Simulado as TipoSimulado } from '../../../shared/tipos'

const NOME_DO_TIPO = { multipla: 'Múltipla escolha', certoErrado: 'Certo ou errado' }
const SALVAR_A_CADA_MS = 5000

export function Simulado({
  simulado,
  mudar,
  sair
}: {
  simulado: TipoSimulado
  mudar: Mudar
  sair: () => void
}) {
  return simulado.entregueEm ? (
    <Resultado simulado={simulado} sair={sair} />
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
      naQuestao.current += delta
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
  const responder = (letra: string): void =>
    gravar((x) => (x.respostas[x.atual] = x.respostas[x.atual] === letra ? null : letra))
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
              <p className="enunciado">{q.enunciado}</p>
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
                    className="alternativa"
                    onClick={() => responder(a.letra)}
                  >
                    <span className="letra">{a.letra}</span>
                    <span>{a.texto}</span>
                  </button>
                ))}
              </div>
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
                    className={s.revisar[i] ? 'revisar' : s.respostas[i] ? 'respondida' : ''}
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

function Resultado({ simulado: s, sair }: { simulado: TipoSimulado; sair: () => void }) {
  const [atual, setAtual] = useState(0)
  const total = s.questoes.length
  const certas = acertos(s.questoes, s.respostas)
  const emBranco = s.respostas.filter((r) => r === null).length
  const pct = Math.round((certas / total) * 100)
  const q = s.questoes[atual]
  const minha = s.respostas[atual]

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
        <div className="placar" style={{ marginLeft: 'auto' }}>
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
            <span className="numero">{formatarTempo(s.decorridoMs / total)}</span>
          </div>
        </div>
      </header>

      <div className="corpo-prova">
        <main className="questao">
          <div className="meta">
            Questão {atual + 1} de {total} ·{' '}
            {minha === null ? 'em branco' : minha === q.gabarito ? 'você acertou' : 'você errou'} ·{' '}
            {formatarTempo(s.tempoPorQuestao[atual])} nela
          </div>
          <p className="enunciado">{q.enunciado}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.alternativas.map((a) => {
              const classe = a.letra === q.gabarito ? 'certa' : a.letra === minha ? 'errada' : ''
              return (
                <button key={a.letra} type="button" disabled className={`alternativa ${classe}`}>
                  <span className="letra">{a.letra}</span>
                  <span style={{ flex: 1 }}>{a.texto}</span>
                  {a.letra === q.gabarito && (
                    <span className="meta" style={{ color: 'var(--verde)' }}>
                      Gabarito
                    </span>
                  )}
                  {a.letra === minha && a.letra !== q.gabarito && (
                    <span className="meta" style={{ color: 'var(--vermelho)' }}>
                      Sua resposta
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <h2 className="secao">Resolução</h2>
          <div className="resolucao">{q.resolucao}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="botao"
              style={{ minHeight: 44 }}
              disabled={atual === 0}
              onClick={() => setAtual(atual - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="botao principal"
              style={{ marginLeft: 'auto' }}
              disabled={atual === total - 1}
              onClick={() => setAtual(atual + 1)}
            >
              Próxima
            </button>
          </div>
        </main>

        <aside className="mapa" aria-label="Mapa do resultado">
          <h2 className="secao" style={{ fontSize: 14 }}>
            Questões
          </h2>
          <div className="mapa-grade">
            {s.questoes.map((x, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Questão ${i + 1}`}
                aria-current={i === atual ? 'step' : undefined}
                className={
                  s.respostas[i] === null ? '' : s.respostas[i] === x.gabarito ? 'certa' : 'errada'
                }
                onClick={() => setAtual(i)}
              >
                {i + 1}
              </button>
            ))}
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
          </div>
        </aside>
      </div>
    </div>
  )
}
