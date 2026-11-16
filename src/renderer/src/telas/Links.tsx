import { useState, type FormEvent } from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import { novoId, type Mudar } from '../useDados'
import { normalizarUrl, tipoDoLink } from '../../../shared/texto'
import type { Dados, Id, LinkGuardado } from '../../../shared/tipos'

/** "materiaId" ou "materiaId/assuntoId" no <select> */
const valorDoDestino = (l: Pick<LinkGuardado, 'materiaId' | 'assuntoId'>): string =>
  l.materiaId ? (l.assuntoId ? `${l.materiaId}/${l.assuntoId}` : l.materiaId) : ''

export function Links({ dados, mudar }: { dados: Dados; mudar: Mudar }) {
  const [url, setUrl] = useState('')
  const [titulo, setTitulo] = useState('')
  const [destino, setDestino] = useState('')
  const [editandoId, setEditandoId] = useState<Id | null>(null)
  const [erro, setErro] = useState('')
  const [apagando, setApagando] = useState<LinkGuardado | null>(null)

  const limpar = (): void => {
    setUrl('')
    setTitulo('')
    setEditandoId(null)
    setErro('')
  }

  const guardar = (e: FormEvent): void => {
    e.preventDefault()
    const certo = normalizarUrl(url)
    if (!certo) {
      setErro('Isso não parece um link de site (ex.: youtube.com/...).')
      return
    }
    const [materiaId = null, assuntoId = null] = destino ? destino.split('/') : []
    const nome = titulo.trim() || new URL(certo).hostname.replace(/^www\./, '')
    mudar((d) => {
      const existente = d.links.find((l) => l.id === editandoId)
      if (existente) Object.assign(existente, { url: certo, titulo: nome, materiaId, assuntoId })
      else
        d.links.push({
          id: novoId(),
          url: certo,
          titulo: nome,
          materiaId,
          assuntoId,
          criadoEm: Date.now()
        })
    })
    limpar()
  }

  const editar = (l: LinkGuardado): void => {
    setEditandoId(l.id)
    setUrl(l.url)
    setTitulo(l.titulo)
    setDestino(valorDoDestino(l))
    setErro('')
  }

  const grupos = [
    ...dados.materias.map((m) => ({
      id: m.id,
      nome: m.nome,
      links: dados.links.filter((l) => l.materiaId === m.id)
    })),
    {
      id: 'outros',
      nome: 'Sem matéria',
      links: dados.links.filter(
        (l) => !l.materiaId || !dados.materias.some((m) => m.id === l.materiaId)
      )
    }
  ].filter((g) => g.links.length > 0)

  const nomeDoAssunto = (id: Id | null): string | undefined =>
    id ? dados.materias.flatMap((m) => m.assuntos).find((a) => a.id === id)?.nome : undefined

  return (
    <div className="tela">
      <main className="conteudo">
        <header className="cabecalho">
          <div>
            <div className="trilha">
              Quadro / {dados.links.length} {dados.links.length === 1 ? 'link' : 'links'}
            </div>
            <h1 className="titulo">Links</h1>
          </div>
          <form className="form-link" onSubmit={guardar}>
            <label className="campo" style={{ flex: '2 1 220px' }}>
              Cole o link
              <input
                type="text"
                inputMode="url"
                placeholder="youtube.com/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </label>
            <label className="campo" style={{ flex: '1 1 160px' }}>
              Nome que você vê
              <input
                type="text"
                placeholder="Pronomes"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </label>
            <label className="campo" style={{ flex: '1 1 180px' }}>
              Onde guardar
              <select value={destino} onChange={(e) => setDestino(e.target.value)}>
                <option value="">Sem matéria</option>
                {dados.materias.map((m) => [
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>,
                  ...m.assuntos.map((a) => (
                    <option key={a.id} value={`${m.id}/${a.id}`}>
                      {m.nome} › {a.nome}
                    </option>
                  ))
                ])}
              </select>
            </label>
            <button type="submit" className="botao principal">
              {editandoId ? 'Salvar' : 'Guardar'}
            </button>
            {editandoId && (
              <button type="button" className="botao" style={{ minHeight: 44 }} onClick={limpar}>
                Cancelar
              </button>
            )}
          </form>
        </header>
        {erro && (
          <div className="aviso erro" role="alert">
            {erro}
          </div>
        )}

        {grupos.length === 0 && (
          <div className="vazio">
            <Icone nome="link" tamanho={40} />
            <p>
              Cole um link acima e dê um nome curto, como “Pronomes”. No quadro aparece só o nome;
              um clique abre o link.
            </p>
          </div>
        )}

        {grupos.map((g) => (
          <section
            key={g.id}
            aria-label={g.nome}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <h2 className="secao">{g.nome}</h2>
            <div className="grade-links">
              {g.links.map((l) => {
                const tipo = tipoDoLink(l.url)
                const assunto = nomeDoAssunto(l.assuntoId)
                return (
                  <div key={l.id} className="cartao-link">
                    <button
                      type="button"
                      title={l.url}
                      onClick={() => void window.api.abrirLink(l.url)}
                    >
                      <span className={`selo ${tipo}`}>
                        <Icone
                          nome={tipo === 'video' ? 'play' : tipo === 'pdf' ? 'doc' : 'globo'}
                          tamanho={16}
                          cheio={tipo === 'video'}
                        />
                      </span>
                      <span className="nome">
                        {l.titulo}
                        {assunto && (
                          <span className="meta" style={{ display: 'block', marginTop: 2 }}>
                            {assunto}
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="acoes">
                      <button
                        type="button"
                        className="botao-icone"
                        aria-label={`Editar ${l.titulo}`}
                        title="Editar"
                        onClick={() => editar(l)}
                      >
                        <Icone nome="lapis" tamanho={15} />
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        aria-label={`Apagar ${l.titulo}`}
                        title="Apagar"
                        onClick={() => setApagando(l)}
                      >
                        <Icone nome="lixo" tamanho={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </main>

      {apagando && (
        <Confirmar
          titulo={`Apagar “${apagando.titulo}”?`}
          texto="O link sai do quadro e das anotações."
          botao="Apagar"
          aoConfirmar={() => {
            const id = apagando.id
            setApagando(null)
            mudar((d) => {
              d.links = d.links.filter((l) => l.id !== id)
            })
            if (editandoId === id) limpar()
          }}
          aoCancelar={() => setApagando(null)}
        />
      )}
    </div>
  )
}
