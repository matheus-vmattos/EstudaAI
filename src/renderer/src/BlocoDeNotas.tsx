import { useEffect, useRef, useState } from 'react'
import { Icone } from './Icone'
import { aplicarOps, type OpDoBloco } from '../../shared/bloco'
import type { ConfigDoBloco, NotaDoBloco } from '../../shared/tipos'

const novoId = (): string => crypto.randomUUID()

/** O bloco de notas flutuante (sistema do esquecAI): fica por cima de tudo,
 *  para anotar uma dúvida enquanto assiste a uma aula ou lê um PDF. Quem grava
 *  é a janela principal; daqui saem operações (salvar/apagar UMA nota), em
 *  lote a cada pausa na digitação, e volta a lista que ficou valendo. */
export function BlocoDeNotas() {
  const [notas, setNotas] = useState<NotaDoBloco[] | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [config, setConfig] = useState<ConfigDoBloco | null>(null)
  const [ajustes, setAjustes] = useState(false)
  const [apagando, setApagando] = useState(false)
  const pendente = useRef<number | undefined>(undefined)
  const campo = useRef<HTMLTextAreaElement>(null)
  // a última operação de cada nota que ainda não saiu daqui (lote de 400 ms)
  const fila = useRef(new Map<string, OpDoBloco>())

  useEffect(() => {
    document.title = 'Bloco de notas'
    void window.api.bloco.ler().then(({ notas, selecionar }) => {
      setNotas(aplicarOps(notas, [...fila.current.values()]))
      if (selecionar) setAberta(selecionar)
    })
    void window.api.bloco.config().then(setConfig)
    // o que vem da principal (edição lá, nuvem, outro PC) sempre entra; o que
    // você está digitando e ainda não saiu fica por cima
    const off1 = window.api.bloco.aoMudar((n) =>
      setNotas(aplicarOps(n, [...fila.current.values()]))
    )
    const off2 = window.api.bloco.aoSelecionar((id) => setAberta(id))
    // ao fechar a janelinha, o que estiver esperando sai na hora
    const sair = (): void => {
      if (fila.current.size) window.api.bloco.opsAgora([...fila.current.values()])
      fila.current.clear()
    }
    window.addEventListener('beforeunload', sair)
    return () => {
      off1()
      off2()
      window.removeEventListener('beforeunload', sair)
    }
  }, [])

  const operar = (op: OpDoBloco): void => {
    fila.current.set(op.tipo === 'salvar' ? op.nota.id : op.id, op)
    setNotas((atual) => aplicarOps(atual ?? [], [op]))
    window.clearTimeout(pendente.current)
    pendente.current = window.setTimeout(() => {
      const ops = [...fila.current.values()]
      fila.current.clear()
      if (ops.length) void window.api.bloco.ops(ops)
    }, 400)
  }

  // ao abrir uma nota com texto (ex.: a dúvida do gabarito), o cursor vai
  // para o fim, onde se escreve
  useEffect(() => {
    const t = campo.current
    if (!t || !t.value) return
    t.focus()
    t.setSelectionRange(t.value.length, t.value.length)
    t.scrollTop = t.scrollHeight
  }, [aberta, notas !== null])

  const mudarConfig = (patch: Partial<ConfigDoBloco>): void =>
    void window.api.bloco.mudarConfig(patch).then(setConfig)

  const lista = [...(notas ?? [])].sort((a, b) => b.atualizadoEm - a.atualizadoEm)
  const nota = notas?.find((n) => n.id === aberta) ?? null
  const travado = config?.travado ?? true

  const nova = (): void => {
    const agora = Date.now()
    const n: NotaDoBloco = {
      id: novoId(),
      titulo: '',
      texto: '',
      criadoEm: agora,
      atualizadoEm: agora
    }
    operar({ tipo: 'salvar', nota: n })
    setAberta(n.id)
  }
  const editar = (patch: Partial<Pick<NotaDoBloco, 'titulo' | 'texto'>>): void => {
    if (!nota) return
    operar({ tipo: 'salvar', nota: { ...nota, ...patch, atualizadoEm: Date.now() } })
  }

  return (
    <div className={`bn ${travado ? '' : 'destravado'}`}>
      <header className="bn-cabeca">
        {nota ? (
          <button
            type="button"
            className="botao-icone"
            aria-label="Todas as notas"
            title="Todas as notas"
            onClick={() => {
              setAberta(null)
              setApagando(false)
            }}
          >
            <Icone nome="esquerda" tamanho={16} />
          </button>
        ) : (
          <Icone nome="lapis" tamanho={16} />
        )}
        <span className="bn-titulo">
          {nota ? nota.titulo || 'Sem título' : 'Bloco de notas'}
        </span>
        <button
          type="button"
          className="botao-icone"
          aria-pressed={!travado}
          aria-label={travado ? 'Destravar para mover e redimensionar' : 'Travar no lugar'}
          title={travado ? 'Destravar para mover' : 'Travar no lugar'}
          onClick={() => mudarConfig({ travado: !travado })}
        >
          <Icone nome={travado ? 'cadeado' : 'cadeadoAberto'} tamanho={16} />
        </button>
        <button
          type="button"
          className="botao-icone"
          aria-expanded={ajustes}
          aria-label="Ajustes"
          title="Ajustes"
          onClick={() => setAjustes(!ajustes)}
        >
          <Icone nome="engrenagem" tamanho={16} />
        </button>
        <button
          type="button"
          className="botao-icone"
          aria-label="Fechar o bloco"
          title="Fechar (as notas ficam salvas)"
          onClick={() => void window.api.bloco.fechar()}
        >
          <Icone nome="fechar" tamanho={16} />
        </button>
      </header>
      {!travado && (
        <p className="meta bn-dica">
          Arraste pela barra de cima; puxe a borda para mudar o tamanho.
        </p>
      )}

      {ajustes && config && (
        <label className="bn-ajuste">
          <span className="meta">Opacidade</span>
          <input
            type="range"
            min={40}
            max={100}
            value={Math.round(config.opacidade * 100)}
            onChange={(e) => mudarConfig({ opacidade: Number(e.target.value) / 100 })}
          />
        </label>
      )}

      {notas === null && <p className="meta">Abrindo…</p>}

      {notas && !nota && (
        <>
          <button type="button" className="botao principal bn-nova" onClick={nova}>
            <Icone nome="mais" tamanho={16} />
            Nova nota
          </button>
          <div className="bn-lista">
            {lista.length === 0 && (
              <p className="meta bn-vazio">
                Anote aqui as dúvidas: elas ficam salvas e o Claude lê no check-in.
              </p>
            )}
            {lista.map((n) => (
              <button
                key={n.id}
                type="button"
                className="bn-item"
                onClick={() => setAberta(n.id)}
              >
                <span className="nome">{n.titulo || 'Sem título'}</span>
                {n.texto.trim() && <span className="previa">{n.texto.trim().split('\n')[0]}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {notas && nota && (
        <div className="bn-nota">
          <input
            aria-label="Título"
            placeholder="Título"
            value={nota.titulo}
            autoFocus={!nota.titulo}
            onChange={(e) => editar({ titulo: e.target.value })}
          />
          <textarea
            ref={campo}
            aria-label="Texto da nota"
            placeholder="Escreva livremente…"
            value={nota.texto}
            onChange={(e) => editar({ texto: e.target.value })}
          />
          {apagando ? (
            <div className="bn-acoes">
              <span className="meta">Apagar esta nota?</span>
              <button
                type="button"
                className="botao perigo"
                onClick={() => {
                  operar({ tipo: 'apagar', id: nota.id })
                  setAberta(null)
                  setApagando(false)
                }}
              >
                Apagar
              </button>
              <button type="button" className="botao" onClick={() => setApagando(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" className="botao bn-apagar" onClick={() => setApagando(true)}>
              <Icone nome="lixo" tamanho={14} />
              Apagar nota
            </button>
          )}
        </div>
      )}
    </div>
  )
}
