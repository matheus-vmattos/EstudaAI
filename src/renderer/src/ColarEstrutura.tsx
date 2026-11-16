import { useEffect, useMemo, useRef, useState } from 'react'
import { Icone } from './Icone'
import { novoId, type Mudar } from './useDados'
import {
  importarEstrutura,
  lerEstrutura,
  sobAMateria,
  type ResultadoDaImportacao
} from '../../shared/estrutura'
import type { Dados } from '../../shared/tipos'

/** Cola uma árvore em texto (recuo, traços ou ├─) e cria os nós que faltam.
 *  Com uma matéria aberta no mapa, o texto entra dentro dela. */
export function ColarEstrutura({
  dados,
  materia,
  mudar,
  fechar
}: {
  dados: Dados
  materia: string | null
  mudar: Mudar
  fechar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const [texto, setTexto] = useState('')
  const [feito, setFeito] = useState<ResultadoDaImportacao | null>(null)
  const raizes = useMemo(() => {
    const r = lerEstrutura(texto)
    return materia && r.length ? sobAMateria(r, materia) : r
  }, [texto, materia])
  const total = (nos: typeof raizes): number => nos.reduce((s, n) => s + 1 + total(n.filhos), 0)

  const importar = (): void => {
    // a contagem sai de uma cópia: o mudar do React pode rodar depois
    setFeito(importarEstrutura(structuredClone(dados), raizes, novoId))
    mudar((d) => {
      importarEstrutura(d, raizes, novoId)
    })
  }

  return (
    <dialog ref={ref} onClose={fechar} aria-labelledby="titulo-colar" className="config">
      <header>
        <span style={{ color: 'var(--ciano)', display: 'flex' }}>
          <Icone nome="mapa" tamanho={20} />
        </span>
        <h2 id="titulo-colar">Colar estrutura</h2>
        <button type="button" className="botao-icone" aria-label="Fechar" onClick={fechar}>
          <Icone nome="fechar" />
        </button>
      </header>
      <section>
        <p>
          Cole a árvore{' '}
          {materia ? (
            <>
              de <strong>{materia}</strong>
            </>
          ) : null}{' '}
          com recuo, traços ou ├─. O que já existe com o mesmo nome é aproveitado.
        </p>
        <textarea
          className="colar-texto"
          rows={12}
          aria-label="Estrutura"
          placeholder={
            'Fonologia\n  Fonema e letra\n  Encontros vocálicos\nMorfologia\n  Estrutura das palavras'
          }
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setFeito(null)
          }}
        />
        {feito ? (
          <div className="aviso ok" role="status">
            ✓ {feito.criados} {feito.criados === 1 ? 'criado' : 'criados'} · {feito.aproveitados}{' '}
            {feito.aproveitados === 1 ? 'já existia' : 'já existiam'}
          </div>
        ) : (
          texto.trim() && <span className="meta">{total(raizes)} itens lidos</span>
        )}
        <div className="acoes-dialogo">
          <button type="button" className="botao" onClick={fechar}>
            {feito ? 'Fechar' : 'Cancelar'}
          </button>
          {!feito && (
            <button
              type="button"
              className="botao principal"
              disabled={!raizes.length}
              onClick={importar}
            >
              Importar
            </button>
          )}
        </div>
      </section>
    </dialog>
  )
}
