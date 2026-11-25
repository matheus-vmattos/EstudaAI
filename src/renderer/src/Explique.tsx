import { useId, useState } from 'react'
import { Icone } from './Icone'
import { novoId, type Mudar } from './useDados'
import { promptDeConferir } from '../../shared/missao'
import { estadoDaResposta, explicacaoDoConceito, retornoDe } from '../../shared/explicar'
import { EstadoDaResposta, RespostaDoClaude } from './RespostaDoClaude'
import type { Dados, Id, Questao } from '../../shared/tipos'

/** "Será que você sabe?": explicar com suas palavras. A explicação fica
 *  guardada (sincroniza; o Claude lê no check-in) e pode ir para a IA
 *  corrigir. Serve ao Raio-X do simulado e à tarefa "Explique" da missão.
 *  Quando o Claude responde, a resposta (o que pode ter escapado e um teste
 *  rápido) aparece aqui; reescrever só quando o teste mostrou que não fechou,
 *  e volta a "esperando" (a resposta era do texto antigo). */
export function Explique({
  dados,
  mudar,
  topico,
  pergunta,
  detalhe,
  questao,
  origem,
  pontos,
  numero,
  aoPular,
  legado
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
  /** dentro da lista "Agora explique": o número e o botão Pular */
  numero?: number
  aoPular?: () => void
  /** a explicação da 0.1.22 deste simulado e tópico, se houver */
  legado?: { simuladoId: Id; topico: string }
}) {
  const idCampo = useId()
  const ja = origem
    ? (dados.explicacoes ?? []).find(
        (x) => x.simuladoId === origem.simuladoId && x.indice === origem.indice
      )
    : // conceito: a mesma pergunta em qualquer simulado ou missão (e a da 0.1.22, pelo legado)
      explicacaoDoConceito(dados, pergunta, legado)
  const [texto, setTexto] = useState(ja?.texto ?? '')
  const [aviso, setAviso] = useState('')
  const [editando, setEditando] = useState(!ja?.texto.trim())
  const retorno = ja ? retornoDe(dados, ja) : null
  const estado = ja ? estadoDaResposta(dados, ja) : 'esperando'
  const guardar = (): void =>
    mudar((d) => {
      const lista = d.explicacoes ?? []
      const atual = ja && lista.find((x) => x.id === ja.id)
      if (atual) {
        atual.texto = texto.trim()
        atual.atualizadoEm = Date.now()
      } else
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

  // sem o campo aberto, a pergunta é só texto (o rótulo apontaria para nada)
  const rotulo = editando ? (
    <label htmlFor={idCampo} className="pergunta-explique">
      {pergunta}
    </label>
  ) : (
    <span className="pergunta-explique">{pergunta}</span>
  )

  return (
    <section
      aria-label={numero ? pergunta : undefined}
      aria-labelledby={numero ? undefined : `${idCampo}-t`}
      className={numero ? `explique item ${editando ? '' : estado}` : 'explique'}
    >
      {numero ? (
        <div className="cabeca-explique">
          <span className="meta">{numero}</span>
          {rotulo}
          {!editando && <EstadoDaResposta estado={estado} />}
        </div>
      ) : (
        <>
          <div className="cabeca-dia">
            <h2 id={`${idCampo}-t`} className="secao">
              Será que você sabe?
            </h2>
            {detalhe && <span className="meta">{detalhe}</span>}
            {ja?.texto.trim() && !editando && <EstadoDaResposta estado={estado} />}
          </div>
          {rotulo}
        </>
      )}
      {numero !== undefined && detalhe && <span className="meta recuo">{detalhe}</span>}
      {!editando && ja && <p className="sua-explicacao">“{ja.texto}”</p>}
      {retorno && ja && <RespostaDoClaude dados={dados} mudar={mudar} explicacao={ja} />}
      {editando ? (
        <>
          <textarea
            id={idCampo}
            rows={numero ? 3 : 4}
            value={texto}
            placeholder="Com suas palavras, como se fosse para um colega…"
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
                setEditando(false)
                setAviso('Enviado: o Claude avalia no próximo check-in.')
              }}
            >
              Enviar para o Claude
            </button>
            <button
              type="button"
              className="botao"
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
            {aoPular && !ja && (
              <button type="button" className="botao" onClick={aoPular}>
                Pular
              </button>
            )}
            {aviso && (
              <span className="meta nota-boa" role="status">
                {aviso}
              </span>
            )}
            {pontos ? <span className="meta pontos">+{pontos} pts na missão</span> : null}
          </div>
        </>
      ) : estado === 'esperando' || estado === 'rever' ? (
        <div className="acoes-explique">
          <button
            type="button"
            className={estado === 'rever' ? 'botao pendente' : 'botao'}
            onClick={() => {
              setEditando(true)
              setAviso('')
            }}
          >
            {estado === 'esperando' ? 'Editar' : 'Explicar de novo'}
          </button>
          {aviso && estado === 'esperando' && (
            <span className="meta nota-boa" role="status">
              {aviso}
            </span>
          )}
        </div>
      ) : null}
    </section>
  )
}
