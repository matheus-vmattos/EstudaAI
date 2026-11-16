import { useEffect, useMemo, useRef, useState } from 'react'
import { Icone } from '../Icone'
import type { Mudar } from '../useDados'
import type { AlvoDaRevisao } from '../App'
import { renderizarMarkdown } from '../markdown'
import {
  ehNovo,
  filaDoDia,
  formatarIntervalo,
  mostrarLacuna,
  NOMES_DAS_NOTAS,
  podeMostrar,
  previsoes,
  responder,
  type Nota
} from '../../../shared/flashcards'
import type { Cartao, Dados, Id } from '../../../shared/tipos'
import { acharNo } from '../../../shared/arvore'

const NOTAS: Nota[] = [1, 2, 3, 4]
const CLASSE_DA_NOTA: Record<Nota, string> = { 1: 'errei', 2: 'dificil', 3: 'bom', 4: 'facil' }

export function Revisao({
  dados,
  mudar,
  alvo,
  sair
}: {
  dados: Dados
  mudar: Mudar
  alvo: AlvoDaRevisao
  sair: () => void
}) {
  // a fila é montada uma vez, ao entrar; quem volta em minutos (aprendendo)
  // entra de novo no fim
  const [fila, setFila] = useState<Id[]>(() => {
    // o limite de novos do dia conta todos os assuntos, não só o aberto
    const f = filaDoDia(dados.cartoes, new Date(), alvo.assuntos ? new Set(alvo.assuntos) : null)
    return [...f.revisar, ...f.novos].map((c) => c.id)
  })
  const [feitos, setFeitos] = useState(0)
  const [revelado, setRevelado] = useState(false)
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const porId = useMemo(() => new Map(dados.cartoes.map((c) => [c.id, c])), [dados.cartoes])
  const naFila = fila.map((id) => porId.get(id)).filter(Boolean) as Cartao[]
  // o primeiro que já pode ser mostrado (aprendendo só quando o minuto chegar)
  const atual = naFila.find((c) => podeMostrar(c, agora)) ?? null
  const esperando = !atual && naFila.length > 0
  const proximoEm = esperando
    ? Math.min(...naFila.map((c) => new Date(c.agenda.due).getTime())) - agora.getTime()
    : 0

  const lugar = atual ? acharNo(dados, atual.assuntoId) : null

  const responderCom = (nota: Nota): void => {
    if (!atual || !revelado) return
    const quando = new Date()
    const nova = responder(atual.agenda, nota, quando)
    const id = atual.id
    mudar((d) => {
      const c = d.cartoes.find((x) => x.id === id)
      if (!c) return
      c.agenda = nova
      c.primeiraRevisao ??= quando.getTime()
    })
    const fim = new Date(quando)
    fim.setHours(23, 59, 59, 999)
    // ainda aprendendo e volta hoje: vai para o fim da fila
    const volta = nova.state !== 2 && new Date(nova.due) <= fim
    setFila((f) => {
      const resto = f.filter((x) => x !== id)
      return volta ? [...resto, id] : resto
    })
    if (!volta) setFeitos((n) => n + 1)
    setRevelado(false)
  }

  const prev = useMemo(() => (atual ? previsoes(atual.agenda, agora) : null), [atual, revelado]) // eslint-disable-line react-hooks/exhaustive-deps

  const teclado = useRef<(e: KeyboardEvent) => void>(() => {})
  teclado.current = (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return
    if (e.key === 'Escape') return sair()
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (atual && !revelado) setRevelado(true)
      return
    }
    const n = Number(e.key)
    if (n >= 1 && n <= 4) responderCom(n as Nota)
  }
  useEffect(() => {
    const ouvir = (e: KeyboardEvent): void => teclado.current(e)
    window.addEventListener('keydown', ouvir)
    return () => window.removeEventListener('keydown', ouvir)
  }, [])

  const contagem = {
    novos: naFila.filter((c) => ehNovo(c)).length,
    reaprender: naFila.filter((c) => c.agenda.state === 1 || c.agenda.state === 3).length,
    revisar: naFila.filter((c) => c.agenda.state === 2).length
  }
  const total = feitos + naFila.length

  const faces = atual
    ? atual.tipo === 'lacuna'
      ? { ...mostrarLacuna(atual.frente), extra: atual.verso }
      : { frente: atual.frente, verso: atual.verso, extra: '' }
    : null

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
          Sair
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="meta">
            Revisão · {lugar ? `${lugar.materia.nome} › ${lugar.caminho.join(' › ')}` : alvo.titulo}
          </span>
          <span
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 600,
              fontSize: 20,
              letterSpacing: '0.06em'
            }}
          >
            {total > 0 ? `Cartão ${Math.min(feitos + 1, total)} de ${total}` : alvo.titulo}
          </span>
        </div>
        <div className="contagem-revisao meta">
          <span style={{ color: 'var(--ciano)' }}>Novos {contagem.novos}</span>
          <span style={{ color: 'var(--vermelho)' }}>Reaprender {contagem.reaprender}</span>
          <span style={{ color: 'var(--verde)' }}>Revisar {contagem.revisar}</span>
        </div>
      </header>
      <div className="progresso" aria-hidden="true">
        <div style={{ width: `${total ? (feitos / total) * 100 : 100}%` }} />
      </div>

      <main className="area-revisao">
        {!atual && !esperando && (
          <div className="vazio">
            <Icone nome="check" tamanho={40} />
            <p>
              {feitos > 0
                ? `Concluído por hoje: ${feitos} ${feitos === 1 ? 'cartão' : 'cartões'}.`
                : 'Nada para revisar aqui hoje.'}
            </p>
            <button type="button" className="botao principal" onClick={sair} autoFocus>
              Voltar
            </button>
          </div>
        )}
        {esperando && (
          <div className="vazio">
            <Icone nome="relogio" tamanho={40} />
            <p>
              Os cartões que você errou voltam em {formatarIntervalo(proximoEm)}. Pode esperar aqui
              ou sair: eles ficam para depois.
            </p>
            <button type="button" className="botao" onClick={sair}>
              Encerrar por agora
            </button>
          </div>
        )}
        {atual && faces && (
          <>
            <article className="cartao-revisao" aria-live="polite">
              <div
                className="face frente"
                dangerouslySetInnerHTML={{ __html: renderizarMarkdown(faces.frente) }}
              />
              {revelado && (
                <>
                  <div className="divisor-cartao" />
                  <div
                    className="face verso"
                    dangerouslySetInnerHTML={{ __html: renderizarMarkdown(faces.verso) }}
                  />
                  {faces.extra && (
                    <div
                      className="face extra"
                      dangerouslySetInnerHTML={{ __html: renderizarMarkdown(faces.extra) }}
                    />
                  )}
                </>
              )}
            </article>
            {revelado && prev ? (
              <div role="group" aria-label="Como foi?" className="notas">
                {NOTAS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`nota ${CLASSE_DA_NOTA[n]}`}
                    onClick={() => responderCom(n)}
                  >
                    {NOMES_DAS_NOTAS[n]}
                    <span>
                      {n} · {formatarIntervalo(prev[n])}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                className="botao principal grande"
                onClick={() => setRevelado(true)}
                autoFocus
              >
                Mostrar resposta
              </button>
            )}
            <p className="meta" style={{ margin: 0 }}>
              Espaço mostra a resposta · 1–4 responde · Esc sai
            </p>
          </>
        )}
      </main>
    </div>
  )
}
