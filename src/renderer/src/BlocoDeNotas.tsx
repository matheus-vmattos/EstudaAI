import { useEffect, useRef, useState } from 'react'
import { Icone } from './Icone'
import type { ConfigDoBloco, NotaDoBloco } from '../../shared/tipos'

const novoId = (): string => crypto.randomUUID()

/** O bloco de notas flutuante (sistema do esquecAI): fica por cima de tudo,
 *  para anotar uma dúvida enquanto assiste a uma aula ou lê um PDF. Quem grava
 *  é a janela principal; daqui sai a lista inteira (em lote, a cada pausa na
 *  digitação) e volta o que ficou valendo. */
export function BlocoDeNotas() {
  const [notas, setNotas] = useState<NotaDoBloco[] | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [config, setConfig] = useState<ConfigDoBloco | null>(null)
  const [ajustes, setAjustes] = useState(false)
  const [apagando, setApagando] = useState(false)
  const pendente = useRef<number | undefined>(undefined)
  const campo = useRef<HTMLTextAreaElement>(null)
  const sujo = useRef(false)

  useEffect(() => {
    document.title = 'Bloco de notas'
    void window.api.bloco.ler().then(({ notas, selecionar }) => {
      setNotas(notas)
      if (selecionar) setAberta(selecionar)
    })
    void window.api.bloco.config().then(setConfig)
    // o que vem da principal (edição lá, nuvem, outro PC) só entra quando não
    // há digitação esperando para sair daqui: senão apagaria letras
    const off1 = window.api.bloco.aoMudar((n) => {
      if (!sujo.current) setNotas(n)
    })
    const off2 = window.api.bloco.aoSelecionar((id) => setAberta(id))
    return () => {
      off1()
      off2()
    }
  }, [])

  const gravar = (lista: NotaDoBloco[]): void => {
    setNotas(lista)
    sujo.current = true
    window.clearTimeout(pendente.current)
    pendente.current = window.setTimeout(() => {
      sujo.current = false
      void window.api.bloco.salvar(lista)
    }, 400)
  }
  // ao sair (fechar a janelinha), o que estiver esperando sai na hora
  useEffect(() => {
    const sair = (): void => {
      if (sujo.current && notas) void window.api.bloco.salvar(notas)
    }
    window.addEventListener('beforeunload', sair)
    return () => window.removeEventListener('beforeunload', sair)
  }, [notas])

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
    gravar([n, ...(notas ?? [])])
    setAberta(n.id)
  }
  const editar = (patch: Partial<Pick<NotaDoBloco, 'titulo' | 'texto'>>): void => {
    if (!nota || !notas) return
    gravar(notas.map((n) => (n.id === nota.id ? { ...n, ...patch, atualizadoEm: Date.now() } : n)))
  }

  return (
    <div className={`bloco ${travado ? '' : 'destravado'}`}>
      <header className="cabeca-bloco">
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
        <span className="titulo-bloco">
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
        <p className="meta dica-bloco">
          Arraste pela barra de cima; puxe a borda para mudar o tamanho.
        </p>
      )}

      {ajustes && config && (
        <label className="ajuste-bloco">
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
          <button type="button" className="botao principal nova-nota" onClick={nova}>
            <Icone nome="mais" tamanho={16} />
            Nova nota
          </button>
          <div className="lista-bloco">
            {lista.length === 0 && (
              <p className="meta vazio-bloco">
                Anote aqui as dúvidas: elas ficam salvas e o Claude lê no check-in.
              </p>
            )}
            {lista.map((n) => (
              <button
                key={n.id}
                type="button"
                className="item-bloco"
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
        <div className="nota-bloco">
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
            <div className="acoes-bloco">
              <span className="meta">Apagar esta nota?</span>
              <button
                type="button"
                className="botao perigo"
                onClick={() => {
                  gravar((notas ?? []).filter((n) => n.id !== nota.id))
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
            <button type="button" className="botao apagar-nota" onClick={() => setApagando(true)}>
              <Icone nome="lixo" tamanho={14} />
              Apagar nota
            </button>
          )}
        </div>
      )}
    </div>
  )
}
