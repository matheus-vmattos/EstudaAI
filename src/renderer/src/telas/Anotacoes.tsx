import { useEffect, useMemo, useRef, useState } from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import { novoId, type Mudar } from '../useDados'
import { renderizarMarkdown } from '../markdown'
import { haQuantoTempo, semAcento, tipoDoLink } from '../../../shared/texto'
import type { Dados, Id } from '../../../shared/tipos'

type Editando = { tipo: 'materia' | 'assunto'; id: Id } | null
type Apagando = { tipo: 'materia' | 'assunto'; id: Id; nome: string } | null

export function Anotacoes({
  dados,
  mudar,
  assuntoId,
  abrirAssunto
}: {
  dados: Dados
  mudar: Mudar
  assuntoId: Id | null
  abrirAssunto: (id: Id | null) => void
}) {
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<Editando>(null)
  const [apagando, setApagando] = useState<Apagando>(null)
  const buscaRef = useRef<HTMLInputElement>(null)

  // Ctrl+K vai para a busca
  useEffect(() => {
    const tecla = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        buscaRef.current?.focus()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  const termo = semAcento(busca.trim())
  const arvore = useMemo(() => {
    if (!termo)
      return dados.materias.map((m) => ({ materia: m, assuntos: m.assuntos, aberta: m.aberta }))
    return dados.materias
      .map((m) => ({
        materia: m,
        aberta: true,
        assuntos: semAcento(m.nome).includes(termo)
          ? m.assuntos
          : m.assuntos.filter((a) => semAcento(a.nome + ' ' + a.nota).includes(termo))
      }))
      .filter((x) => x.assuntos.length > 0 || semAcento(x.materia.nome).includes(termo))
  }, [dados.materias, termo])

  let atual: {
    materia: Dados['materias'][number]
    assunto: Dados['materias'][number]['assuntos'][number]
  } | null = null
  for (const m of dados.materias) {
    const a = m.assuntos.find((x) => x.id === assuntoId)
    if (a) atual = { materia: m, assunto: a }
  }

  const novaMateria = (): void => {
    const id = novoId()
    mudar((d) => {
      d.materias.push({ id, nome: 'Nova matéria', aberta: true, assuntos: [] })
    })
    setBusca('')
    setEditando({ tipo: 'materia', id })
  }

  const novoAssunto = (materiaId: Id): void => {
    const id = novoId()
    mudar((d) => {
      const m = d.materias.find((x) => x.id === materiaId)
      if (!m) return
      m.aberta = true
      m.assuntos.push({ id, nome: 'Novo assunto', nota: '', atualizadoEm: Date.now() })
    })
    abrirAssunto(id)
    setEditando({ tipo: 'assunto', id })
  }

  const renomear = (nome: string): void => {
    const alvo = editando
    setEditando(null)
    const limpo = nome.trim()
    if (!alvo || !limpo) return
    mudar((d) => {
      for (const m of d.materias) {
        if (alvo.tipo === 'materia' && m.id === alvo.id) m.nome = limpo
        const a = m.assuntos.find((x) => x.id === alvo.id)
        if (alvo.tipo === 'assunto' && a) a.nome = limpo
      }
    })
  }

  const apagar = (): void => {
    const alvo = apagando
    setApagando(null)
    if (!alvo) return
    mudar((d) => {
      if (alvo.tipo === 'materia') {
        d.materias = d.materias.filter((m) => m.id !== alvo.id)
        d.links.forEach((l) => {
          if (l.materiaId === alvo.id) {
            l.materiaId = null
            l.assuntoId = null
          }
        })
      } else {
        d.materias.forEach((m) => (m.assuntos = m.assuntos.filter((a) => a.id !== alvo.id)))
        d.links.forEach((l) => l.assuntoId === alvo.id && (l.assuntoId = null))
      }
    })
    if (alvo.id === assuntoId || atual?.materia.id === alvo.id) abrirAssunto(null)
  }

  return (
    <div className="tela">
      <aside className="arvore" aria-label="Matérias e assuntos">
        <label className="busca">
          <Icone nome="busca" tamanho={16} />
          <input
            ref={buscaRef}
            type="search"
            placeholder="Buscar em tudo"
            aria-label="Buscar em matérias, assuntos e anotações"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <span className="tecla">Ctrl K</span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {arvore.map(({ materia: m, assuntos, aberta }) => (
            <div key={m.id}>
              {editando?.tipo === 'materia' && editando.id === m.id ? (
                <CampoDeNome inicial={m.nome} rotulo="Nome da matéria" aoTerminar={renomear} />
              ) : (
                <div className="materia">
                  <button
                    type="button"
                    aria-expanded={aberta}
                    onClick={() =>
                      mudar((d) => {
                        const x = d.materias.find((y) => y.id === m.id)
                        if (x) x.aberta = !x.aberta
                      })
                    }
                  >
                    <span
                      style={{
                        color: aberta ? 'var(--ciano)' : 'var(--texto-meta)',
                        display: 'flex'
                      }}
                    >
                      <Icone nome={aberta ? 'abaixo' : 'direita'} tamanho={12} />
                    </span>
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {m.nome}
                    </span>
                    <span className="conta">{m.assuntos.length}</span>
                  </button>
                  <button
                    type="button"
                    className="botao-icone"
                    aria-label={`Novo assunto em ${m.nome}`}
                    title="Novo assunto"
                    onClick={() => novoAssunto(m.id)}
                  >
                    <Icone nome="mais" tamanho={14} />
                  </button>
                  <button
                    type="button"
                    className="botao-icone"
                    aria-label={`Renomear ${m.nome}`}
                    title="Renomear"
                    onClick={() => setEditando({ tipo: 'materia', id: m.id })}
                  >
                    <Icone nome="lapis" tamanho={14} />
                  </button>
                  <button
                    type="button"
                    className="botao-icone"
                    aria-label={`Apagar ${m.nome}`}
                    title="Apagar"
                    onClick={() => setApagando({ tipo: 'materia', id: m.id, nome: m.nome })}
                  >
                    <Icone nome="lixo" tamanho={14} />
                  </button>
                </div>
              )}
              {aberta &&
                assuntos.map((a) =>
                  editando?.tipo === 'assunto' && editando.id === a.id ? (
                    <div key={a.id} style={{ paddingLeft: 28 }}>
                      <CampoDeNome
                        inicial={a.nome}
                        rotulo="Nome do assunto"
                        aoTerminar={renomear}
                      />
                    </div>
                  ) : (
                    <div key={a.id} className="assunto">
                      <button
                        type="button"
                        aria-current={a.id === assuntoId ? 'true' : undefined}
                        onClick={() => abrirAssunto(a.id)}
                      >
                        {a.nome}
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        aria-label={`Apagar ${a.nome}`}
                        title="Apagar"
                        onClick={() => setApagando({ tipo: 'assunto', id: a.id, nome: a.nome })}
                      >
                        <Icone nome="lixo" tamanho={14} />
                      </button>
                    </div>
                  )
                )}
              {aberta && !termo && m.assuntos.length === 0 && (
                <button
                  type="button"
                  className="botao tracejado"
                  style={{ marginLeft: 28, minHeight: 34, fontSize: 12 }}
                  onClick={() => novoAssunto(m.id)}
                >
                  + Assunto
                </button>
              )}
            </div>
          ))}
          {termo && arvore.length === 0 && <p className="meta">Nada encontrado.</p>}
        </div>

        <button
          type="button"
          className="botao tracejado"
          style={{ marginTop: 'auto', minHeight: 44 }}
          onClick={novaMateria}
        >
          + Nova matéria
        </button>
      </aside>

      {atual ? (
        <Editor
          key={atual.assunto.id}
          dados={dados}
          mudar={mudar}
          materia={atual.materia}
          assunto={atual.assunto}
        />
      ) : (
        <main className="conteudo">
          <div className="vazio">
            <Icone nome="nota" tamanho={40} />
            {dados.materias.length === 0 ? (
              <>
                <p>
                  Comece criando uma matéria, por exemplo “Língua Portuguesa”. Dentro dela, cada
                  assunto tem a sua anotação.
                </p>
                <button type="button" className="botao principal" onClick={novaMateria}>
                  + Nova matéria
                </button>
              </>
            ) : (
              <p>Escolha um assunto à esquerda.</p>
            )}
          </div>
        </main>
      )}

      {apagando && (
        <Confirmar
          titulo={`Apagar “${apagando.nome}”?`}
          texto={
            apagando.tipo === 'materia'
              ? 'A matéria e todas as anotações dentro dela serão apagadas. Os links continuam no quadro.'
              : 'A anotação deste assunto será apagada. Os links continuam no quadro.'
          }
          botao="Apagar"
          aoConfirmar={apagar}
          aoCancelar={() => setApagando(null)}
        />
      )}
    </div>
  )
}

function CampoDeNome({
  inicial,
  rotulo,
  aoTerminar
}: {
  inicial: string
  rotulo: string
  aoTerminar: (nome: string) => void
}) {
  const [valor, setValor] = useState(inicial)
  return (
    <input
      className="renomear"
      aria-label={rotulo}
      autoFocus
      value={valor}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => aoTerminar(valor)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') aoTerminar(valor)
        if (e.key === 'Escape') aoTerminar(inicial)
      }}
    />
  )
}

type Materia = Dados['materias'][number]
type Assunto = Materia['assuntos'][number]

function Editor({
  dados,
  mudar,
  materia,
  assunto
}: {
  dados: Dados
  mudar: Mudar
  materia: Materia
  assunto: Assunto
}) {
  const [modo, setModo] = useState<'ler' | 'editar'>(assunto.nota.trim() ? 'ler' : 'editar')
  const area = useRef<HTMLTextAreaElement>(null)
  const links = dados.links.filter((l) => l.assuntoId === assunto.id)

  const salvarNota = (nota: string): void =>
    mudar((d) => {
      const a = d.materias.flatMap((m) => m.assuntos).find((x) => x.id === assunto.id)
      if (a) {
        a.nota = nota
        a.atualizadoEm = Date.now()
      }
    })

  /** envolve a seleção (ou insere no começo da linha) e devolve o foco */
  const formatar = (antes: string, depois = '', inicioDeLinha = false): void => {
    const el = area.current
    if (!el) return
    const { selectionStart: i, selectionEnd: f, value } = el
    let novo: string
    let cursor: number
    if (inicioDeLinha) {
      const linha = value.lastIndexOf('\n', i - 1) + 1
      novo = value.slice(0, linha) + antes + value.slice(linha)
      cursor = f + antes.length
    } else {
      const sel = value.slice(i, f) || 'texto'
      novo = value.slice(0, i) + antes + sel + depois + value.slice(f)
      cursor = i + antes.length + sel.length
    }
    salvarNota(novo)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  const html = useMemo(() => renderizarMarkdown(assunto.nota), [assunto.nota])

  return (
    <main className="conteudo">
      <header className="cabecalho">
        <div>
          <div className="trilha">{materia.nome} / Assunto</div>
          <h1 className="titulo">{assunto.nome}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="botao"
            aria-pressed={modo === 'ler'}
            onClick={() => setModo(modo === 'ler' ? 'editar' : 'ler')}
          >
            <Icone nome={modo === 'ler' ? 'lapis' : 'olho'} tamanho={16} />
            {modo === 'ler' ? 'Editar' : 'Ver pronto'}
          </button>
        </div>
      </header>

      {links.length > 0 && (
        <div className="chips" aria-label="Links deste assunto">
          <span className="meta">Links</span>
          {links.map((l) => (
            <button
              key={l.id}
              type="button"
              className="chip"
              title={l.url}
              onClick={() => void window.api.abrirLink(l.url)}
            >
              <Icone
                nome={
                  tipoDoLink(l.url) === 'video'
                    ? 'play'
                    : tipoDoLink(l.url) === 'pdf'
                      ? 'doc'
                      : 'globo'
                }
                tamanho={14}
                cheio={tipoDoLink(l.url) === 'video'}
              />
              {l.titulo}
            </button>
          ))}
        </div>
      )}

      {modo === 'editar' ? (
        <>
          <div className="barra-ferramentas" role="toolbar" aria-label="Formatação">
            <button
              type="button"
              aria-label="Título"
              title="Título"
              onClick={() => formatar('## ', '', true)}
              style={{ fontFamily: 'var(--mono)' }}
            >
              H
            </button>
            <button
              type="button"
              aria-label="Negrito"
              title="Negrito"
              onClick={() => formatar('**', '**')}
              style={{ fontWeight: 700 }}
            >
              B
            </button>
            <button
              type="button"
              aria-label="Lista"
              title="Lista"
              onClick={() => formatar('- ', '', true)}
            >
              •≡
            </button>
            <button
              type="button"
              aria-label="Marca-texto"
              title="Marca-texto"
              onClick={() => formatar('==', '==')}
              style={{ color: 'var(--verde)' }}
            >
              ▌
            </button>
            <button
              type="button"
              title="Destacar como pegadinha"
              onClick={() => formatar('> **PEGADINHA** ', '', true)}
              style={{
                color: 'var(--ambar)',
                borderColor: 'var(--ambar-linha)',
                fontFamily: 'var(--display)',
                letterSpacing: '0.1em',
                fontWeight: 600
              }}
            >
              ! PEGADINHA
            </button>
          </div>
          <textarea
            ref={area}
            className="editor"
            aria-label={`Anotação de ${assunto.nome}`}
            placeholder={
              'Escreva aqui. Dicas:\n## Título\n**negrito**   ==marca-texto==\n- item de lista\n> **PEGADINHA** cuidado com…'
            }
            value={assunto.nota}
            onChange={(e) => salvarNota(e.target.value)}
          />
        </>
      ) : (
        // o HTML vem do DOMPurify (markdown.ts)
        <article className="leitura" dangerouslySetInnerHTML={{ __html: html }} />
      )}

      <footer className="meta" style={{ marginTop: 'auto', display: 'flex', gap: 20 }}>
        <span>Salvo automaticamente</span>
        <span>Editado {haQuantoTempo(assunto.atualizadoEm)}</span>
      </footer>
    </main>
  )
}
