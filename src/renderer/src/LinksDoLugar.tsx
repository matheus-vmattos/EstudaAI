import { useState, type FormEvent } from 'react'
import { Icone } from './Icone'
import { novoId, type Mudar } from './useDados'
import { normalizarUrl, tipoDoLink } from '../../shared/texto'
import type { Dados, Id } from '../../shared/tipos'

/** Os links (vídeo-aulas, PDFs, sites) de um assunto ou tópico, com
 *  "+ Link" ali mesmo: o mesmo link aparece no quadro de Links. */
export function LinksDoLugar({
  dados,
  mudar,
  lugarId,
  materiaId
}: {
  dados: Dados
  mudar: Mudar
  lugarId: Id
  materiaId: Id
}) {
  const links = dados.links.filter((l) => l.assuntoId === lugarId)
  const [aberto, setAberto] = useState(false)
  const [url, setUrl] = useState('')
  const [titulo, setTitulo] = useState('')
  const [erro, setErro] = useState('')

  const guardar = (e: FormEvent): void => {
    e.preventDefault()
    const certo = normalizarUrl(url)
    if (!certo) {
      setErro('Isso não parece um link de site (ex.: youtube.com/...).')
      return
    }
    const nome =
      titulo.trim() ||
      (tipoDoLink(certo) === 'video' ? 'Vídeo-aula' : new URL(certo).hostname.replace(/^www\./, ''))
    mudar((d) => {
      d.links.push({
        id: novoId(),
        url: certo,
        titulo: nome,
        materiaId,
        assuntoId: lugarId,
        criadoEm: Date.now()
      })
    })
    setUrl('')
    setTitulo('')
    setErro('')
    setAberto(false)
  }

  return (
    <div className="links-do-lugar">
      <div className="chips" aria-label="Links">
        {links.map((l) => {
          const tipo = tipoDoLink(l.url)
          return (
            <button
              key={l.id}
              type="button"
              className={`chip ${tipo}`}
              title={l.url}
              onClick={() => void window.api.abrirLink(l.url)}
            >
              <Icone
                nome={tipo === 'video' ? 'play' : tipo === 'pdf' ? 'doc' : 'globo'}
                tamanho={14}
                cheio={tipo === 'video'}
              />
              {l.titulo}
            </button>
          )
        })}
        {!aberto && (
          <button type="button" className="chip adicionar" onClick={() => setAberto(true)}>
            + Link {links.length === 0 && '(vídeo-aula, PDF…)'}
          </button>
        )}
      </div>
      {aberto && (
        <form className="form-link-lugar" onSubmit={guardar}>
          <input
            type="text"
            inputMode="url"
            aria-label="Link"
            placeholder="Cole o link (youtube.com/…)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          <input
            type="text"
            aria-label="Nome que você vê"
            placeholder="Nome (ex.: Aula de crase)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="botao principal" style={{ flex: 1 }}>
              Guardar
            </button>
            <button type="button" className="botao" onClick={() => setAberto(false)}>
              Cancelar
            </button>
          </div>
          {erro && (
            <div className="aviso erro" role="alert">
              {erro}
            </div>
          )}
        </form>
      )}
    </div>
  )
}
