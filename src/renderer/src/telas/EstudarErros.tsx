import { useState } from 'react'
import { Icone } from '../Icone'
import { Texto } from '../Texto'
import { resumoDoEnunciado } from '../../../shared/leitura'
import { EscolherLugar } from '../EscolherLugar'
import type { Mudar } from '../useDados'
import { acharNo, gravarNota, todosOsNos } from '../../../shared/arvore'
import {
  anotacaoComRevisao,
  blocoDaRevisao,
  montarPromptDeEstudo,
  questoesParaEstudar,
  type MotivoDoEstudo
} from '../../../shared/estudarErros'
import { semAcento } from '../../../shared/texto'
import type { Dados, IaDestino, Id, Simulado } from '../../../shared/tipos'

const MOTIVO: Record<MotivoDoEstudo, { texto: string; cor: string }> = {
  errou: { texto: 'Errada', cor: 'var(--vermelho)' },
  branco: { texto: 'Em branco', cor: 'var(--texto-meta)' },
  duvida: { texto: 'Acertou, mas marcou', cor: 'var(--ambar)' }
}

/** Em vez de outro simulado: um prompt para entender cada erro, e a
 *  resposta da IA guardada na anotação do tópico. */
export function EstudarErros({
  simulado: s,
  dados,
  mudar,
  voltar,
  abrirAnotacao
}: {
  simulado: Simulado
  dados: Dados
  mudar: Mudar
  voltar: () => void
  abrirAnotacao: (id: Id) => void
}) {
  const itens = questoesParaEstudar(s)
  const [marcadas, setMarcadas] = useState(() => new Set(itens.map((x) => x.indice)))
  const [ia, setIa] = useState<IaDestino>('claude')
  const [copiado, setCopiado] = useState(false)
  const [resposta, setResposta] = useState('')
  const [salvoEm, setSalvoEm] = useState<Id | null>(null)
  // onde guardar: o assunto do simulado; senão, o nó com o nome do tópico da 1ª questão
  const [destino, setDestino] = useState<Id>(() => {
    if (s.config.assuntoId && acharNo(dados, s.config.assuntoId)) return s.config.assuntoId
    const topico = s.questoes[itens[0]?.indice ?? 0]?.topico ?? s.config.tema
    const nos = todosOsNos(dados)
    return (nos.find((n) => semAcento(n.nome) === semAcento(topico)) ?? nos[0])?.id ?? ''
  })

  const escolhidas = itens.map((x) => x.indice).filter((i) => marcadas.has(i))
  const copiar = async (): Promise<void> => {
    await window.api.copiar(montarPromptDeEstudo(s, escolhidas, ia))
    setCopiado(true)
  }
  const salvar = (): void => {
    const bloco = blocoDaRevisao(resposta, new Date())
    mudar((d) => {
      const no = acharNo(d, destino)
      if (no) gravarNota(d, destino, anotacaoComRevisao(no.nota, bloco))
    })
    setSalvoEm(destino)
    setResposta('')
  }
  const lugar = salvoEm ? acharNo(dados, salvoEm) : null

  return (
    <div className="corpo-prova">
      <main className="questao estudar-erros">
        <button
          type="button"
          className="botao"
          style={{ border: 0, paddingLeft: 0, alignSelf: 'flex-start' }}
          onClick={voltar}
        >
          <Icone nome="esquerda" tamanho={16} />
          Voltar ao gabarito
        </button>

        <section aria-labelledby="t-entra" className="passo-estudo">
          <h2 id="t-entra" className="secao">
            1 · O que entra
          </h2>
          {itens.map(({ indice, motivo }) => {
            const q = s.questoes[indice]
            const minha = s.respostas[indice]
            return (
              <label key={indice} className="item-estudo">
                <input
                  type="checkbox"
                  checked={marcadas.has(indice)}
                  onChange={(e) => {
                    const novo = new Set(marcadas)
                    if (e.target.checked) novo.add(indice)
                    else novo.delete(indice)
                    setMarcadas(novo)
                    setCopiado(false)
                  }}
                />
                <span className="corpo-item-estudo">
                  <span className="meta">
                    Questão {indice + 1} ·{' '}
                    <span style={{ color: MOTIVO[motivo].cor }}>{MOTIVO[motivo].texto}</span>
                    {q.topico && ` · ${q.topico}`}
                  </span>
                  <span className="enunciado-curto">
                    <Texto texto={resumoDoEnunciado(q.enunciado, 160)} />
                  </span>
                  <span className="meta">
                    {motivo !== 'duvida' && (
                      <span style={{ color: 'var(--vermelho)' }}>
                        Você: {minha ?? 'em branco'} ·{' '}
                      </span>
                    )}
                    <span style={{ color: 'var(--verde)' }}>Certa: {q.gabarito}</span>
                  </span>
                </span>
              </label>
            )
          })}
        </section>
      </main>

      <aside className="mapa painel-estudo" aria-label="Pedir à IA e guardar">
        <section aria-labelledby="t-ia" className="passo-estudo">
          <h2 id="t-ia" className="secao">
            2 · Peça à IA
          </h2>
          <div
            role="radiogroup"
            aria-label="IA de destino"
            className="opcoes"
            style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          >
            {(['claude', 'gpt'] as const).map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={ia === x}
                className="opcao"
                onClick={() => {
                  setIa(x)
                  setCopiado(false)
                }}
              >
                {x === 'claude' ? 'Claude' : 'GPT'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="botao principal"
            disabled={!escolhidas.length}
            onClick={() => void copiar()}
          >
            <Icone nome="copiar" tamanho={16} />
            {copiado ? 'Copiado ✓' : `Copiar prompt · ${escolhidas.length}`}
          </button>
        </section>

        <section aria-labelledby="t-guardar" className="passo-estudo">
          <h2 id="t-guardar" className="secao">
            3 · Guarde a resposta
          </h2>
          <textarea
            rows={6}
            aria-label="Resposta da IA"
            placeholder="Cole aqui a resposta da IA"
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
          />
          <EscolherLugar
            dados={dados}
            rotulo="Salvar na anotação de"
            valor={destino}
            aoEscolher={setDestino}
          />
          <button
            type="button"
            className="botao sucesso"
            disabled={!resposta.trim() || !destino}
            onClick={salvar}
          >
            Salvar na anotação
          </button>
          {lugar && (
            <div className="aviso ok" role="status">
              Salvo em {[lugar.materia.nome, ...lugar.caminho].join(' › ')}.{' '}
              <button type="button" className="link-botao" onClick={() => abrirAnotacao(lugar.id)}>
                Abrir anotação
              </button>
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}
