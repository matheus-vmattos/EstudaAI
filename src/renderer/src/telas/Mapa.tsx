import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent
} from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import { novoId, type Mudar } from '../useDados'
import type { AlvoDaRevisao } from '../App'
import {
  ALTURA_DO_NO,
  descendentes,
  idsComFilhos,
  LARGURA_DO_NO,
  montarArvore,
  posicionar,
  type NoPosicionado
} from '../../../shared/mapa'
import type { Dados, Id } from '../../../shared/tipos'
import {
  acharNo,
  adicionarFilho,
  adicionarIrmao,
  apagarNo,
  idsAbaixo,
  renomearLugar
} from '../../../shared/arvore'

const MARGEM = 40
const textoSimples = (md: string): string =>
  md
    .replace(/[#>*=`_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function Mapa({
  dados,
  mudar,
  abrirAnotacao,
  estudar
}: {
  dados: Dados
  mudar: Mudar
  abrirAnotacao: (assuntoId: Id) => void
  estudar: (alvo: AlvoDaRevisao) => void
}) {
  const [materiaId, setMateriaId] = useState<Id | null>(dados.materias[0]?.id ?? null)
  const [selecionado, setSelecionado] = useState<Id | null>(null)
  const [renomeando, setRenomeando] = useState<Id | null>(null)
  const [apagando, setApagando] = useState<Id | null>(null)
  const [vista, setVista] = useState({ x: MARGEM, y: MARGEM, zoom: 1 })
  const area = useRef<HTMLDivElement>(null)
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  const materia = dados.materias.find((m) => m.id === materiaId) ?? dados.materias[0] ?? null
  const raiz = useMemo(() => (materia ? montarArvore(dados, materia.id) : null), [dados, materia])
  const vertical = !!dados.mapaVertical
  const layout = useMemo(() => (raiz ? posicionar(raiz, vertical) : null), [raiz, vertical])
  const porId = useMemo(() => new Map(layout?.nos.map((n) => [n.no.id, n]) ?? []), [layout])

  // ao trocar de matéria: raiz à esquerda, centralizada na altura
  useLayoutEffect(() => {
    const el = area.current
    const r = layout?.nos.find((n) => !n.paiId)
    if (!el || !r) return
    // horizontal: raiz à esquerda, no meio da altura; vertical: raiz no topo, no meio da largura
    setVista(
      vertical
        ? { x: el.clientWidth / 2 - r.x - LARGURA_DO_NO / 2, y: MARGEM, zoom: 1 }
        : { x: MARGEM, y: el.clientHeight / 2 - r.y - ALTURA_DO_NO / 2, zoom: 1 }
    )
  }, [materia?.id, vertical]) // eslint-disable-line react-hooks/exhaustive-deps

  const sel = selecionado ? porId.get(selecionado) : undefined

  useEffect(() => {
    const el = area.current
    const n = selecionado ? porId.get(selecionado) : undefined
    if (!el || !n) return
    const margem = 24
    const x = vista.x + n.x * vista.zoom
    const y = vista.y + n.y * vista.zoom
    const w = LARGURA_DO_NO * vista.zoom
    const h = ALTURA_DO_NO * vista.zoom
    const fora =
      x < margem ||
      y < margem ||
      x + w > el.clientWidth - margem ||
      y + h > el.clientHeight - margem
    if (fora)
      setVista((v) => ({
        ...v,
        x: el.clientWidth / 2 - (n.x + LARGURA_DO_NO / 2) * v.zoom,
        y: el.clientHeight / 2 - (n.y + ALTURA_DO_NO / 2) * v.zoom
      }))
  }, [selecionado, layout]) // eslint-disable-line react-hooks/exhaustive-deps
  const assuntoDoNo = (no: NoPosicionado | undefined): Id | null => {
    if (!no) return null
    if (no.no.tipo === 'assunto') return no.no.id
    if (no.no.tipo === 'topico')
      return dados.topicos.find((t) => t.id === no.no.id)?.assuntoId ?? null
    return null
  }

  const alternar = (id: Id): void =>
    mudar((d) => {
      d.mapaRecolhidos = d.mapaRecolhidos.includes(id)
        ? d.mapaRecolhidos.filter((x) => x !== id)
        : [...d.mapaRecolhidos, id]
    })

  /** filho do nó selecionado: matéria → assunto; assunto/tópico → tópico */
  const novoFilho = (): void => {
    if (!sel) return
    const id = novoId()
    const no = { tipo: sel.no.tipo, id: sel.no.id }
    mudar((d) => {
      adicionarFilho(d, no, id)
    })
    setSelecionado(id)
    setRenomeando(id)
  }
  /** irmão do nó selecionado (mesmo pai) */
  const novoIrmao = (): void => {
    if (!sel || sel.no.tipo === 'materia') return
    const id = novoId()
    const no = { tipo: sel.no.tipo, id: sel.no.id }
    mudar((d) => {
      adicionarIrmao(d, no, id)
    })
    setSelecionado(id)
    setRenomeando(id)
  }
  // compatível com os botões que já chamavam "novo tópico"
  const novoTopico = novoFilho

  const renomear = (id: Id, nome: string): void => {
    setRenomeando(null)
    mudar((d) => renomearLugar(d, id, nome))
  }

  // teclado: Tab cria filho, Enter cria irmão, F2 renomeia, Delete apaga
  const teclado = useRef<(e: KeyboardEvent) => void>(() => {})
  teclado.current = (e) => {
    const alvo = e.target as HTMLElement
    if (alvo.closest('input, textarea, select') || apagando) return
    if (!sel || renomeando) return
    if (e.key === 'Tab') {
      e.preventDefault()
      novoFilho()
    } else if (e.key === 'Enter' && sel.no.tipo !== 'materia') {
      e.preventDefault()
      novoIrmao()
    } else if (e.key === 'F2') setRenomeando(sel.no.id)
    else if (e.key === 'Delete' && sel.no.tipo !== 'materia') setApagando(sel.no.id)
  }
  useEffect(() => {
    const ouvir = (e: KeyboardEvent): void => teclado.current(e)
    window.addEventListener('keydown', ouvir)
    return () => window.removeEventListener('keydown', ouvir)
  }, [])

  // arrastar o fundo move o mapa; a roda dá zoom no ponto do mouse
  const comecarArrasto = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest('button, input')) return
    arrasto.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const arrastar = (e: PointerEvent): void => {
    const a = arrasto.current
    if (a) setVista((v) => ({ ...v, x: a.vx + e.clientX - a.x, y: a.vy + e.clientY - a.y }))
  }
  const zoomar = (e: WheelEvent): void => {
    const el = area.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    setVista((v) => {
      const zoom = Math.min(2, Math.max(0.3, v.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
      const k = zoom / v.zoom
      return { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k }
    })
  }
  const zoomBotao = (fator: number): void =>
    setVista((v) => ({ ...v, zoom: Math.min(2, Math.max(0.3, v.zoom * fator)) }))

  if (!materia || !layout) {
    return (
      <div className="tela">
        <main className="conteudo">
          <div className="vazio">
            <Icone nome="mapa" tamanho={40} />
            <p>O mapa é montado a partir das suas matérias, assuntos e tópicos.</p>
            <button
              type="button"
              className="botao principal"
              onClick={() => {
                const id = novoId()
                mudar((d) => {
                  d.materias.push({ id, nome: 'Nova matéria', aberta: true, assuntos: [] })
                })
                setMateriaId(id)
                setSelecionado(id)
                setRenomeando(id)
              }}
            >
              + Nova matéria
            </button>
          </div>
        </main>
      </div>
    )
  }

  const assuntoSel = assuntoDoNo(sel)
  const assunto = assuntoSel ? materia.assuntos.find((a) => a.id === assuntoSel) : undefined
  const topico =
    sel?.no.tipo === 'topico' ? dados.topicos.find((t) => t.id === sel.no.id) : undefined
  // assunto ou tópico: a anotação, os cartões e os links são do próprio nó
  const lugar = sel && sel.no.tipo !== 'materia' ? acharNo(dados, sel.no.id) : null
  const abaixo = lugar ? new Set(idsAbaixo(dados, lugar.id)) : new Set<Id>()
  const cartoesDoAssunto = dados.cartoes.filter((c) => abaixo.has(c.assuntoId)).length
  const linksDoAssunto = lugar ? dados.links.filter((l) => l.assuntoId === lugar.id).length : 0

  return (
    <div className="tela" style={{ flexDirection: 'column' }}>
      <div role="toolbar" aria-label="Mapa" className="barra-mapa">
        <select
          aria-label="Matéria"
          value={materia.id}
          onChange={(e) => setMateriaId(e.target.value)}
        >
          {dados.materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <div
          role="radiogroup"
          aria-label="Direção do mapa"
          className="opcoes"
          style={{ gridTemplateColumns: 'repeat(2, auto)' }}
        >
          {([false, true] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={vertical === v}
              className="opcao"
              style={{ minHeight: 40, padding: '0 14px' }}
              onClick={() =>
                mudar((d) => {
                  d.mapaVertical = v
                })
              }
            >
              {v ? '↓ Vertical' : '⟶ Horizontal'}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="botao"
          onClick={() => {
            const ids = new Set(idsComFilhos(dados, materia.id))
            mudar((d) => {
              d.mapaRecolhidos = d.mapaRecolhidos.filter((x) => !ids.has(x))
            })
          }}
        >
          Expandir tudo
        </button>
        <button
          type="button"
          className="botao"
          onClick={() => {
            // recolhe tudo abaixo dos assuntos: a matéria e os assuntos continuam à vista
            const ids = idsComFilhos(dados, materia.id).filter((x) => x !== materia.id)
            mudar((d) => {
              d.mapaRecolhidos = [...new Set([...d.mapaRecolhidos, ...ids])]
            })
          }}
        >
          Recolher
        </button>
        <button
          type="button"
          className="botao tracejado"
          disabled={!sel}
          title={sel ? 'Tab' : 'Selecione um nó do mapa'}
          onClick={novoFilho}
        >
          {sel?.no.tipo === 'materia' ? '+ Assunto' : '+ Tópico'}
        </button>
        <span className="meta" style={{ marginLeft: 'auto' }}>
          Tab cria filho · Enter cria irmão · F2 renomeia · Del apaga · arraste e roda movem
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div
          ref={area}
          className="area-mapa"
          onPointerDown={comecarArrasto}
          onPointerMove={arrastar}
          onPointerUp={() => (arrasto.current = null)}
          onWheel={zoomar}
          onClick={(e) => e.target === e.currentTarget && setSelecionado(null)}
        >
          <div
            className="camada-mapa"
            style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.zoom})` }}
          >
            <svg
              width={layout.largura}
              height={layout.altura}
              aria-hidden="true"
              className="linhas-mapa"
            >
              {layout.nos
                .filter((n) => n.paiId)
                .map((n) => {
                  const pai = porId.get(n.paiId!)!
                  const ativa = selecionado === n.no.id || selecionado === pai.no.id
                  // horizontal: da direita do pai à esquerda do filho;
                  // vertical: de baixo do pai ao topo do filho
                  const d = vertical
                    ? (() => {
                        const x1 = pai.x + LARGURA_DO_NO / 2
                        const y1 = pai.y + ALTURA_DO_NO
                        const x2 = n.x + LARGURA_DO_NO / 2
                        const y2 = n.y
                        const meio = (y1 + y2) / 2
                        return `M${x1} ${y1} C ${x1} ${meio}, ${x2} ${meio}, ${x2} ${y2}`
                      })()
                    : (() => {
                        const x1 = pai.x + LARGURA_DO_NO
                        const y1 = pai.y + ALTURA_DO_NO / 2
                        const x2 = n.x
                        const y2 = n.y + ALTURA_DO_NO / 2
                        const meio = (x1 + x2) / 2
                        return `M${x1} ${y1} C ${meio} ${y1}, ${meio} ${y2}, ${x2} ${y2}`
                      })()
                  return <path key={n.no.id} d={d} className={ativa ? 'ativa' : ''} />
                })}
            </svg>
            {layout.nos.map((n) => (
              <div
                key={n.no.id}
                className={`no-mapa ${n.no.tipo} ${selecionado === n.no.id ? 'selecionado' : ''}`}
                style={{ left: n.x, top: n.y, width: LARGURA_DO_NO, height: ALTURA_DO_NO }}
              >
                {renomeando === n.no.id ? (
                  <input
                    className="renomear"
                    aria-label="Nome"
                    autoFocus
                    defaultValue={n.no.nome}
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => renomear(n.no.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renomear(n.no.id, e.currentTarget.value)
                      if (e.key === 'Escape') setRenomeando(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="nome-no"
                    onClick={() => setSelecionado(n.no.id)}
                    onDoubleClick={() => setRenomeando(n.no.id)}
                  >
                    {n.no.nome}
                  </button>
                )}
                {n.no.totalFilhos > 0 && (
                  <button
                    type="button"
                    className="recolher-no"
                    aria-label={n.no.recolhido ? `Expandir ${n.no.nome}` : `Recolher ${n.no.nome}`}
                    aria-expanded={!n.no.recolhido}
                    onClick={() => alternar(n.no.id)}
                  >
                    {n.no.recolhido ? `+${n.no.totalFilhos}` : '−'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div role="group" aria-label="Zoom" className="zoom-mapa">
            <button type="button" aria-label="Diminuir" onClick={() => zoomBotao(1 / 1.2)}>
              −
            </button>
            <span>{Math.round(vista.zoom * 100)}%</span>
            <button type="button" aria-label="Aumentar" onClick={() => zoomBotao(1.2)}>
              +
            </button>
          </div>
        </div>

        <aside className="painel-mapa" aria-label="Nó selecionado">
          {!sel && <p className="meta">Clique num assunto ou tópico para ver a anotação.</p>}
          {sel?.no.tipo === 'materia' && (
            <>
              <span className="meta">Matéria</span>
              <h2>{materia.nome}</h2>
              <p className="meta">
                {materia.assuntos.length} assuntos ·{' '}
                {
                  dados.topicos.filter((t) => materia.assuntos.some((a) => a.id === t.assuntoId))
                    .length
                }{' '}
                tópicos
              </p>
              <button
                type="button"
                className="botao tracejado"
                style={{ minHeight: 40 }}
                onClick={novoFilho}
              >
                + Assunto
              </button>
            </>
          )}
          {assunto && sel && sel.no.tipo !== 'materia' && (
            <>
              <span className="meta">
                {topico ? `Tópico · ${assunto.nome}` : `Assunto · ${materia.nome}`}
              </span>
              <h2>{lugar?.nome}</h2>
              <p className="previa">
                {textoSimples(lugar?.nota ?? '').slice(0, 280) || 'Ainda sem anotação.'}
                {textoSimples(lugar?.nota ?? '').length > 280 && '…'}
              </p>
              <div className="chips meta">
                <span className="chip-meta">{linksDoAssunto} links</span>
                <span className="chip-meta">{cartoesDoAssunto} cartões</span>
              </div>
              <button
                type="button"
                className="botao principal"
                onClick={() => lugar && abrirAnotacao(lugar.id)}
              >
                Abrir anotação
              </button>
              {cartoesDoAssunto > 0 && (
                <button
                  type="button"
                  className="botao"
                  style={{ minHeight: 44 }}
                  onClick={() =>
                    lugar &&
                    estudar({
                      assuntos: [...abaixo],
                      titulo: `${materia.nome} › ${lugar.caminho.join(' › ')}`
                    })
                  }
                >
                  Revisar cartões
                </button>
              )}
              <button
                type="button"
                className="botao tracejado"
                style={{ minHeight: 40 }}
                onClick={novoTopico}
              >
                + {topico ? 'Subtópico' : 'Tópico'}
              </button>
              {lugar && (
                <button
                  type="button"
                  className="botao perigo"
                  style={{ minHeight: 40 }}
                  onClick={() => setApagando(lugar.id)}
                >
                  <Icone nome="lixo" tamanho={15} />
                  {lugar.tipo === 'assunto' ? 'Apagar assunto' : 'Apagar tópico'}
                </button>
              )}
            </>
          )}
        </aside>
      </div>

      {apagando && (
        <Confirmar
          titulo={
            dados.topicos.some((t) => t.id === apagando)
              ? 'Apagar este tópico?'
              : 'Apagar este assunto?'
          }
          texto={
            !dados.topicos.some((t) => t.id === apagando)
              ? 'O assunto e tudo dentro dele (tópicos, anotações e flashcards) saem. Os links continuam no quadro.'
              : descendentes(dados, apagando).length > 1
                ? `O tópico e os ${descendentes(dados, apagando).length - 1} subtópicos dentro dele saem, com anotações e flashcards.`
                : 'O tópico, a anotação e os flashcards dele saem.'
          }
          botao="Apagar"
          aoConfirmar={() => {
            const id = apagando
            setApagando(null)
            setSelecionado(null)
            mudar((d) => apagarNo(d, id))
          }}
          aoCancelar={() => setApagando(null)}
        />
      )}
    </div>
  )
}
