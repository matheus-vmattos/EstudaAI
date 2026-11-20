import { useState } from 'react'
import { Icone } from './Icone'
import { novoId, type Mudar } from './useDados'
import { promptDeConferir } from '../../shared/missao'
import { semAcento } from '../../shared/texto'
import type { Dados, Id, Questao } from '../../shared/tipos'

/** "Será que você sabe?": explicar com suas palavras. A explicação fica
 *  guardada (sincroniza; o Claude lê no check-in) e pode ir para a IA
 *  corrigir. Serve ao Raio-X do simulado e à tarefa "Explique" da missão. */
export function Explique({
  dados,
  mudar,
  topico,
  pergunta,
  detalhe,
  questao,
  origem,
  pontos
}: {
  dados: Dados
  mudar: Mudar
  topico: string
  pergunta: string
  /** a linha de contexto: por que perguntar isto */
  detalhe?: string
  questao?: Questao
  origem?: { simuladoId: Id; indice: number }
  pontos?: number
}) {
  const ja = (dados.explicacoes ?? []).find((x) =>
    origem
      ? x.simuladoId === origem.simuladoId && x.indice === origem.indice
      : !x.simuladoId && semAcento(x.topico) === semAcento(topico)
  )
  const [texto, setTexto] = useState(ja?.texto ?? '')
  const [aviso, setAviso] = useState('')
  const guardar = (): void =>
    mudar((d) => {
      const lista = d.explicacoes ?? []
      const atual = ja && lista.find((x) => x.id === ja.id)
      if (atual) atual.texto = texto.trim()
      else
        lista.push({
          id: novoId(),
          criadoEm: Date.now(),
          topico,
          pergunta,
          texto: texto.trim(),
          ...(origem ?? {})
        })
      d.explicacoes = lista
    })

  return (
    <section aria-labelledby="t-explique" className="explique">
      <div className="cabeca-dia">
        <h2 id="t-explique" className="secao">
          Será que você sabe?
        </h2>
        {detalhe && <span className="meta">{detalhe}</span>}
      </div>
      <label htmlFor="explicacao" className="pergunta-explique">
        {pergunta}
      </label>
      <textarea
        id="explicacao"
        rows={4}
        value={texto}
        placeholder="Com suas palavras, como se fosse para um cliente…"
        onChange={(e) => {
          setTexto(e.target.value)
          setAviso('')
        }}
      />
      <div className="acoes-explique">
        <button
          type="button"
          className="botao principal"
          disabled={!texto.trim()}
          onClick={() => {
            guardar()
            void window.api
              .copiar(promptDeConferir(dados.edital, topico, pergunta, texto, questao))
              .then(() => setAviso('Copiado: cole na IA para ela corrigir.'))
          }}
        >
          <Icone nome="copiar" tamanho={16} />
          Conferir com a IA
        </button>
        <button
          type="button"
          className="botao"
          disabled={!texto.trim()}
          onClick={() => {
            guardar()
            setAviso('Guardado ✓')
          }}
        >
          Guardar para o Claude
        </button>
        {aviso && (
          <span className="meta nota-boa" role="status">
            {aviso}
          </span>
        )}
        {pontos ? <span className="meta pontos">+{pontos} pts na missão</span> : null}
      </div>
    </section>
  )
}
