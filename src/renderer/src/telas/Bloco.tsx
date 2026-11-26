import { useState } from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import { novoId, type Mudar } from '../useDados'
import { semAcento } from '../../../shared/texto'
import { MAX_TEXTO, MAX_TITULO } from '../../../shared/bloco'
import type { Dados, Id, NotaDoBloco } from '../../../shared/tipos'

const quando = (ms: number): string =>
  new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

/** O bloco de notas dentro do app (mockup BlocoNoApp, aprovado em 26/11):
 *  as mesmas notas da janelinha flutuante, com espaço para ler. Quem grava é
 *  esta janela (a dona dos dados); a janelinha recebe o que mudou. */
export function Bloco({ dados, mudar }: { dados: Dados; mudar: Mudar }) {
  const notas = dados.blocoDeNotas ?? []
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState<Id | null>(null)
  const [apagando, setApagando] = useState(false)

  const termo = semAcento(busca.trim())
  const lista = [...notas]
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm)
    .filter(
      (n) => !termo || n.id === aberta || semAcento(`${n.titulo}\n${n.texto}`).includes(termo)
    )
  // sem escolha, abre a mais recente
  const nota = notas.find((n) => n.id === aberta) ?? lista[0] ?? null

  const editar = (patch: Partial<Pick<NotaDoBloco, 'titulo' | 'texto'>>): void => {
    if (!nota) return
    // a nota aberta pela busca fica presa: editar não troca de nota se o texto
    // deixar de bater com o que se buscou
    setAberta(nota.id)
    const limitado = {
      ...(patch.titulo !== undefined ? { titulo: patch.titulo.slice(0, MAX_TITULO) } : {}),
      ...(patch.texto !== undefined ? { texto: patch.texto.slice(0, MAX_TEXTO) } : {})
    }
    mudar((d) => {
      const x = d.blocoDeNotas?.find((n) => n.id === nota.id)
      if (x) Object.assign(x, limitado, { atualizadoEm: Date.now() })
    })
  }
  const nova = (): void => {
    const agora = Date.now()
    const n: NotaDoBloco = {
      id: novoId(),
      titulo: '',
      texto: '',
      criadoEm: agora,
      atualizadoEm: agora
    }
    mudar((d) => {
      d.blocoDeNotas = [n, ...(d.blocoDeNotas ?? [])]
    })
    setBusca('')
    setAberta(n.id)
  }

  return (
    <div className="bt">
      <aside className="bt-lista" aria-label="Notas">
        <div className="bt-busca">
          <label className="busca">
            <Icone nome="busca" tamanho={16} />
            <input
              type="search"
              placeholder="Buscar nas notas"
              aria-label="Buscar nas notas"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="botao-icone"
            aria-label="Nova nota"
            title="Nova nota"
            onClick={nova}
          >
            <Icone nome="mais" tamanho={18} />
          </button>
        </div>
        {lista.length === 0 && (
          <p className="meta">
            {notas.length ? 'Nenhuma nota com esse texto.' : 'Nenhuma nota ainda.'}
          </p>
        )}
        {lista.map((n) => (
          <button
            key={n.id}
            type="button"
            className="bn-item"
            aria-current={n.id === nota?.id ? 'true' : undefined}
            onClick={() => {
              setAberta(n.id)
              setApagando(false)
            }}
          >
            <span className="nome">{n.titulo || 'Sem título'}</span>
            {n.texto.trim() && <span className="previa">{n.texto.trim().split('\n')[0]}</span>}
            <span className="meta">{quando(n.atualizadoEm)}</span>
          </button>
        ))}
      </aside>

      {nota ? (
        <main className="bt-nota">
          <div className="bt-cabeca">
            <input
              className="bt-titulo"
              aria-label="Título"
              placeholder="Título"
              maxLength={MAX_TITULO}
              value={nota.titulo}
              onChange={(e) => editar({ titulo: e.target.value })}
            />
            <button
              type="button"
              className="botao"
              title="Leva esta nota para a janelinha que fica por cima de tudo"
              onClick={() => void window.api.bloco.abrir(nota.id)}
            >
              <Icone nome="externo" tamanho={14} />
              Abrir flutuante
            </button>
            <button type="button" className="botao perigo" onClick={() => setApagando(true)}>
              <Icone nome="lixo" tamanho={14} />
              Apagar
            </button>
          </div>
          <span className="meta">Editada em {quando(nota.atualizadoEm)}</span>
          <textarea
            className="bt-texto"
            aria-label="Texto da nota"
            placeholder="Escreva livremente…"
            maxLength={MAX_TEXTO}
            value={nota.texto}
            onChange={(e) => editar({ texto: e.target.value })}
          />
        </main>
      ) : (
        <main className="conteudo">
          <div className="vazio">
            <Icone nome="lapis" tamanho={40} />
            <p>
              As dúvidas que você anota aqui ou na janelinha ficam salvas, e o Claude lê no
              check-in.
            </p>
            <button type="button" className="botao principal" onClick={nova}>
              + Nova nota
            </button>
          </div>
        </main>
      )}

      {apagando && nota && (
        <Confirmar
          titulo={`Apagar “${nota.titulo || 'Sem título'}”?`}
          texto="A nota some daqui e da janelinha."
          botao="Apagar"
          aoConfirmar={() => {
            mudar((d) => {
              d.blocoDeNotas = (d.blocoDeNotas ?? []).filter((n) => n.id !== nota.id)
            })
            setApagando(false)
            setAberta(null)
          }}
          aoCancelar={() => setApagando(false)}
        />
      )}
    </div>
  )
}
