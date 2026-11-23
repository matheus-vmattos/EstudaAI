import { useId, useState } from 'react'
import { Icone } from './Icone'
import { novoId, type Mudar } from './useDados'
import { promptDeConferir } from '../../shared/missao'
import { retornoDe, type SituacaoDaExplicacao } from '../../shared/explicar'
import { semAcento } from '../../shared/texto'
import type { Dados, Id, Questao } from '../../shared/tipos'

/** "Será que você sabe?": explicar com suas palavras. A explicação fica
 *  guardada (sincroniza; o Claude lê no check-in) e pode ir para a IA
 *  corrigir. Serve ao Raio-X do simulado e à tarefa "Explique" da missão.
 *  Quando o Claude avalia (v0.1.22+), o veredito e o retorno aparecem aqui;
 *  reescrever volta a "esperando" (o retorno era do texto antigo). */
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
  aoPular
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
}) {
  const idCampo = useId()
  const ja = (dados.explicacoes ?? []).find((x) =>
    origem
      ? x.simuladoId === origem.simuladoId && x.indice === origem.indice
      : !x.simuladoId && semAcento(x.topico) === semAcento(topico)
  )
  const [texto, setTexto] = useState(ja?.texto ?? '')
  const [aviso, setAviso] = useState('')
  const [editando, setEditando] = useState(!ja?.texto.trim())
  const retorno = ja ? retornoDe(dados, ja) : null
  const situacao: SituacaoDaExplicacao = retorno?.veredito ?? 'esperando'
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
      className={numero ? `explique item ${editando ? '' : situacao}` : 'explique'}
    >
      {numero ? (
        <div className="cabeca-explique">
          <span className="meta">{numero}</span>
          {rotulo}
          {!editando && <Veredito situacao={situacao} />}
        </div>
      ) : (
        <>
          <div className="cabeca-dia">
            <h2 id={`${idCampo}-t`} className="secao">
              Será que você sabe?
            </h2>
            {detalhe && <span className="meta">{detalhe}</span>}
            {ja?.texto.trim() && !editando && <Veredito situacao={situacao} />}
          </div>
          {rotulo}
        </>
      )}
      {numero !== undefined && detalhe && <span className="meta recuo">{detalhe}</span>}
      {!editando && ja && <p className="sua-explicacao">“{ja.texto}”</p>}
      {retorno && (
        <div className={`retorno ${retorno.veredito}`}>
          <span className="rotulo-retorno">Retorno do Claude</span>
          <span>{retorno.texto}</span>
        </div>
      )}
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
      ) : (
        <div className="acoes-explique">
          <button
            type="button"
            className={
              situacao === 'esperando' || situacao === 'certo' ? 'botao' : 'botao pendente'
            }
            onClick={() => {
              setEditando(true)
              setAviso('')
            }}
          >
            {situacao === 'esperando' ? 'Editar' : 'Tentar de novo'}
          </button>
          {aviso && situacao === 'esperando' && (
            <span className="meta nota-boa" role="status">
              {aviso}
            </span>
          )}
        </div>
      )}
    </section>
  )
}

export const NOME_DO_VEREDITO: Record<SituacaoDaExplicacao, string> = {
  certo: 'Certo',
  quase: 'Quase lá',
  revisar: 'Revisar',
  esperando: 'Esperando o Claude'
}

export function Veredito({ situacao }: { situacao: SituacaoDaExplicacao }) {
  return <span className={`veredito ${situacao}`}>{NOME_DO_VEREDITO[situacao]}</span>
}
