import { useEffect, useMemo, useRef, useState } from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import { novoId, type Mudar } from '../useDados'
import { agendaNova, lacunaDaAnotacao, mostrarLacuna } from '../../../shared/flashcards'
import { renderizarMarkdown } from '../markdown'
import { LinksDoLugar } from '../LinksDoLugar'
import { ListaDeRespostas } from '../RespostaDoClaude'
import { retornoDe } from '../../../shared/explicar'
import { haQuantoTempo, semAcento } from '../../../shared/texto'
import type { Dados, Id } from '../../../shared/tipos'
import {
  acharNo,
  apagarNo,
  gravarNota,
  idsAbaixo,
  nosDaMateria,
  type NoDeEstudo
} from '../../../shared/arvore'

type Editando = { tipo: 'materia' | 'assunto' | 'topico'; id: Id } | null
type Apagando = { tipo: 'materia' | 'assunto' | 'topico'; id: Id; nome: string } | null

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
  // as respostas do Claude às suas explicações, para reler (no Meu edital só aparecem as novas)
  const [vendoRespostas, setVendoRespostas] = useState(false)
  const comResposta = (dados.explicacoes ?? []).filter((x) => retornoDe(dados, x)).length
  useEffect(() => setVendoRespostas(false), [assuntoId])

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
  // assuntos e tópicos juntos: a mesma árvore do mapa e dos flashcards
  const arvore = useMemo(() => {
    const comNos = dados.materias.map((m) => ({
      materia: m,
      nos: nosDaMateria(dados, m),
      aberta: m.aberta
    }))
    if (!termo) return comNos
    return comNos
      .map((x) => ({
        ...x,
        aberta: true,
        nos: semAcento(x.materia.nome).includes(termo)
          ? x.nos
          : x.nos.filter((n) => semAcento(n.nome + ' ' + n.nota).includes(termo))
      }))
      .filter((x) => x.nos.length > 0 || semAcento(x.materia.nome).includes(termo))
  }, [dados, termo])

  const atual = acharNo(dados, assuntoId)

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

  const novoTopico = (pai: NoDeEstudo): void => {
    const id = novoId()
    mudar((d) => {
      d.topicos.push({
        id,
        assuntoId: pai.assuntoId,
        paiId: pai.tipo === 'topico' ? pai.id : null,
        nome: 'Novo tópico',
        nota: '',
        atualizadoEm: Date.now()
      })
      d.mapaRecolhidos = d.mapaRecolhidos.filter((x) => x !== pai.id)
    })
    abrirAssunto(id)
    setEditando({ tipo: 'topico', id })
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
      const t = d.topicos.find((x) => x.id === alvo.id)
      if (alvo.tipo === 'topico' && t) t.nome = limpo
    })
  }

  const apagar = (): void => {
    const alvo = apagando
    setApagando(null)
    if (!alvo) return
    // o nó aberto some junto? então a tela volta ao vazio
    const somem = new Set(
      alvo.tipo === 'materia'
        ? (dados.materias.find((x) => x.id === alvo.id)?.assuntos ?? []).flatMap((a) =>
            idsAbaixo(dados, a.id)
          )
        : idsAbaixo(dados, alvo.id)
    )
    mudar((d) => {
      // cartões e tópicos vivem dentro do assunto: saem junto (arvore.ts)
      if (alvo.tipo === 'materia') {
        const m = d.materias.find((x) => x.id === alvo.id)
        for (const a of m?.assuntos ?? []) apagarNo(d, a.id)
        d.materias = d.materias.filter((x) => x.id !== alvo.id)
        d.links.forEach((l) => {
          if (l.materiaId === alvo.id) {
            l.materiaId = null
            l.assuntoId = null
          }
        })
      } else apagarNo(d, alvo.id)
    })
    if (assuntoId && somem.has(assuntoId)) abrirAssunto(null)
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
          {arvore.map(({ materia: m, nos, aberta }) => (
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
                nos.map((n) =>
                  editando?.id === n.id ? (
                    <div key={n.id} style={{ paddingLeft: 28 + n.nivel * 16 }}>
                      <CampoDeNome
                        inicial={n.nome}
                        rotulo={n.tipo === 'assunto' ? 'Nome do assunto' : 'Nome do tópico'}
                        aoTerminar={renomear}
                      />
                    </div>
                  ) : (
                    <div key={n.id} className={`assunto ${n.tipo}`}>
                      <button
                        type="button"
                        aria-current={n.id === assuntoId ? 'true' : undefined}
                        style={{ paddingLeft: 28 + n.nivel * 16 }}
                        onClick={() => abrirAssunto(n.id)}
                        onDoubleClick={() => setEditando({ tipo: n.tipo, id: n.id })}
                      >
                        {n.nome}
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        aria-label={`Novo tópico em ${n.nome}`}
                        title="Novo tópico dentro"
                        onClick={() => novoTopico(n)}
                      >
                        <Icone nome="mais" tamanho={14} />
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        aria-label={`Apagar ${n.nome}`}
                        title="Apagar"
                        onClick={() => setApagando({ tipo: n.tipo, id: n.id, nome: n.nome })}
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

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comResposta > 0 && (
            <button
              type="button"
              className="botao respostas"
              style={{ minHeight: 44 }}
              aria-pressed={vendoRespostas}
              onClick={() => setVendoRespostas(!vendoRespostas)}
            >
              <Icone nome="check" tamanho={16} />
              Respostas do Claude
              <span className="conta">{comResposta}</span>
            </button>
          )}
          <button
            type="button"
            className="botao tracejado"
            style={{ minHeight: 44 }}
            onClick={novaMateria}
          >
            + Nova matéria
          </button>
        </div>
      </aside>

      {vendoRespostas ? (
        <main className="conteudo">
          <ListaDeRespostas dados={dados} mudar={mudar} todas />
        </main>
      ) : atual ? (
        <Editor key={atual.id} dados={dados} mudar={mudar} no={atual} />
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
              ? 'A matéria e todas as anotações, flashcards e tópicos do mapa dentro dela serão apagados. Os links continuam no quadro.'
              : apagando.tipo === 'topico'
                ? 'A anotação, os flashcards e os subtópicos deste tópico serão apagados. Os links continuam no quadro.'
                : 'A anotação, os flashcards e os tópicos deste assunto serão apagados. Os links continuam no quadro.'
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

function Editor({ dados, mudar, no }: { dados: Dados; mudar: Mudar; no: NoDeEstudo }) {
  // assunto ou tópico: os dois têm anotação, cartões e links
  const assunto = no
  const materia = no.materia
  const editadoEm =
    no.tipo === 'assunto'
      ? no.materia.assuntos.find((a) => a.id === no.id)?.atualizadoEm
      : dados.topicos.find((t) => t.id === no.id)?.atualizadoEm
  const [modo, setModo] = useState<'ler' | 'editar'>(assunto.nota.trim() ? 'ler' : 'editar')
  const area = useRef<HTMLTextAreaElement>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const nCartoes = dados.cartoes.filter((c) => c.assuntoId === assunto.id).length

  /** o trecho selecionado vira lacuna: a linha inteira é o cartão */
  const virarFlashcard = (): void => {
    const el = area.current
    const trecho =
      modo === 'editar' && el
        ? el.value.slice(el.selectionStart, el.selectionEnd)
        : (window.getSelection()?.toString() ?? '')
    if (!trecho.trim()) {
      setAviso({
        ok: false,
        texto: 'Selecione na anotação o trecho que vai ficar escondido no cartão.'
      })
      return
    }
    const frente = lacunaDaAnotacao(assunto.nota, trecho)
    if (!frente) {
      setAviso({ ok: false, texto: 'Selecione um trecho dentro de uma linha só.' })
      return
    }
    mudar((d) => {
      d.cartoes.push({
        id: novoId(),
        assuntoId: assunto.id,
        tipo: 'lacuna',
        frente,
        verso: '',
        agenda: agendaNova(),
        criadoEm: Date.now()
      })
    })
    setAviso({ ok: true, texto: `✓ Flashcard criado: ${mostrarLacuna(frente).frente}` })
  }

  const salvarNota = (nota: string): void =>
    mudar((d) => {
      gravarNota(d, assunto.id, nota)
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
          <div className="trilha">
            {[materia.nome, ...assunto.caminho.slice(0, -1)].join(' / ')} /{' '}
            {assunto.tipo === 'assunto' ? 'Assunto' : 'Tópico'}
          </div>
          <h1 className="titulo">{assunto.nome}</h1>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="botao"
            title="Selecione um trecho da anotação: ele vira a lacuna do cartão"
            // sem roubar a seleção do texto
            onMouseDown={(e) => e.preventDefault()}
            onClick={virarFlashcard}
          >
            <Icone nome="cartas" tamanho={16} />
            Virar flashcard{nCartoes > 0 && ` · ${nCartoes}`}
          </button>
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

      {aviso && (
        <div className={`aviso ${aviso.ok ? 'ok' : 'erro'}`} role={aviso.ok ? 'status' : 'alert'}>
          {aviso.texto}
        </div>
      )}

      <LinksDoLugar dados={dados} mudar={mudar} lugarId={assunto.id} materiaId={materia.id} />

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
        {editadoEm && <span>Editado {haQuantoTempo(editadoEm)}</span>}
      </footer>
    </main>
  )
}
