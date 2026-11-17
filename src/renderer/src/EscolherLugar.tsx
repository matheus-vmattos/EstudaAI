import { useId, useMemo, useRef, useState } from 'react'
import { Icone } from './Icone'
import { procurarDestino, todosOsNos, type Destino } from '../../shared/arvore'
import type { Dados, Id } from '../../shared/tipos'

const MOSTRAR = 8

/** Escolher um assunto ou tópico digitando parte do nome, em vez de rolar
 *  uma lista com a árvore inteira. Fechado, mostra só o caminho escolhido. */
export function EscolherLugar({
  dados,
  valor,
  aoEscolher,
  rotulo,
  nenhum
}: {
  dados: Dados
  valor: Id
  aoEscolher: (id: Id) => void
  rotulo: string
  /** permite ficar sem lugar (id ''), com este nome na lista */
  nenhum?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [indice, setIndice] = useState(0)
  const caixa = useRef<HTMLDivElement>(null)
  const idDaLista = useId()

  const lugares = useMemo<Destino[]>(
    () =>
      todosOsNos(dados).map((n) => ({
        tipo: n.tipo,
        id: n.id,
        nome: n.nome,
        acima: [n.materia.nome, ...n.caminho.slice(0, -1)]
      })),
    [dados]
  )
  const atual = lugares.find((l) => l.id === valor)
  const semLugar: Destino[] =
    nenhum && !busca.trim() ? [{ tipo: 'materia', id: '', nome: nenhum, acima: [] }] : []
  const achados = [...semLugar, ...procurarDestino(lugares, busca)].slice(0, MOSTRAR)
  const escolhido = achados[Math.min(indice, achados.length - 1)]

  const escolher = (id: Id): void => {
    aoEscolher(id)
    setAberto(false)
    setBusca('')
  }

  if (!lugares.length) return <span className="meta">Crie um assunto em Anotações primeiro.</span>

  return (
    <div
      className="escolher-lugar"
      ref={caixa}
      // fecha ao sair do campo (clicar fora ou Tab), mas não ao clicar na lista
      onBlur={(e) => {
        if (!caixa.current?.contains(e.relatedTarget as Node | null)) setAberto(false)
      }}
    >
      <span className="rotulo-campo">{rotulo}</span>
      {!aberto ? (
        <button
          type="button"
          className="lugar-escolhido"
          aria-label={`${rotulo}: ${atual ? [...atual.acima, atual.nome].join(' › ') : 'nenhum'}. Trocar`}
          onClick={() => {
            setAberto(true)
            setIndice(0)
          }}
        >
          <span className="acima">{atual?.acima.join(' › ')}</span>
          <span className="nome">{atual?.nome ?? nenhum ?? 'Escolha onde'}</span>
          <Icone nome="busca" tamanho={15} />
        </button>
      ) : (
        <>
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={idDaLista}
            aria-label={`Procurar ${rotulo.toLowerCase()}`}
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
                // não envia o formulário: Enter aqui escolhe o lugar
                e.preventDefault()
                if (escolhido) escolher(escolhido.id)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setAberto(false)
              }
            }}
          />
          <div role="listbox" id={idDaLista} aria-label={rotulo} className="lista-lugares">
            {achados.length === 0 && <span className="meta">Nada com esse nome.</span>}
            {achados.map((l) => (
              <button
                key={l.id || 'nenhum'}
                type="button"
                role="option"
                aria-selected={l === escolhido}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(l.id)}
              >
                <span className="acima">{l.acima.join(' › ')}</span>
                <span>{l.nome}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
