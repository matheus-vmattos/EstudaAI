import { useState } from 'react'
import {
  destinosPara,
  idsAbaixo,
  procurarDestino,
  type Destino,
  type TipoDoLugar
} from '../../shared/arvore'
import type { Dados, Id } from '../../shared/tipos'

/** Escolher para onde o nó vai: digita parte do nome, setas escolhem,
 *  Enter move. Tudo dele vai junto (filhos, anotação, cartões, links). */
export function MoverPara({
  dados,
  id,
  mover,
  fechar
}: {
  dados: Dados
  id: Id
  mover: (destino: { tipo: TipoDoLugar; id: Id }) => void
  fechar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [indice, setIndice] = useState(0)
  const achados = procurarDestino(destinosPara(dados, id), busca).slice(0, 30)
  const escolhido: Destino | undefined = achados[Math.min(indice, achados.length - 1)]

  const abaixo = new Set(idsAbaixo(dados, id))
  const junto = [
    abaixo.size > 1 && `${abaixo.size - 1} ${abaixo.size === 2 ? 'filho' : 'filhos'}`,
    [...abaixo].some((x) =>
      (
        dados.topicos.find((t) => t.id === x) ??
        dados.materias.flatMap((m) => m.assuntos).find((a) => a.id === x)
      )?.nota.trim()
    ) && 'anotação',
    (() => {
      const n = dados.cartoes.filter((c) => abaixo.has(c.assuntoId)).length
      return n > 0 && `${n} ${n === 1 ? 'cartão' : 'cartões'}`
    })(),
    (() => {
      const n = dados.links.filter((l) => l.assuntoId && abaixo.has(l.assuntoId)).length
      return n > 0 && `${n} ${n === 1 ? 'link' : 'links'}`
    })()
  ].filter(Boolean)

  const confirmar = (): void => {
    if (escolhido) mover({ tipo: escolhido.tipo, id: escolhido.id })
  }

  return (
    <div className="mover-para" role="group" aria-label="Mover para">
      <span className="titulo-mover">Mover para…</span>
      <input
        type="text"
        aria-label="Procurar destino"
        placeholder="Digite parte do nome"
        value={busca}
        autoFocus
        onChange={(e) => {
          setBusca(e.target.value)
          setIndice(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIndice((i) => Math.min(i + 1, achados.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIndice((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            confirmar()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            fechar()
          }
        }}
      />
      {achados.length === 0 ? (
        <span className="meta">Nada com esse nome.</span>
      ) : (
        <div role="listbox" aria-label="Destinos">
          {achados.map((x) => (
            <button
              key={x.id}
              type="button"
              role="option"
              aria-selected={x === escolhido}
              onClick={() => mover({ tipo: x.tipo, id: x.id })}
            >
              {x.acima.length > 0 && <span className="acima">{x.acima.join(' › ')}</span>}
              <span>{x.tipo === 'materia' ? `${x.nome} (como assunto)` : x.nome}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="botao principal"
          style={{ flex: 1 }}
          disabled={!escolhido}
          onClick={confirmar}
        >
          Mover
        </button>
        <button type="button" className="botao" onClick={fechar}>
          Cancelar
        </button>
      </div>
      {junto.length > 0 && <span className="meta">Vai junto: {junto.join(' · ')}</span>}
    </div>
  )
}
