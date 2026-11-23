import { useState } from 'react'
import { Icone } from './Icone'
import { Explique, Veredito } from './Explique'
import type { Mudar } from './useDados'
import { placarDeExplicacoes, situacaoDe, type SituacaoDaExplicacao } from '../../shared/explicar'
import type { Dados, Id } from '../../shared/tipos'

const ORDEM: SituacaoDaExplicacao[] = ['revisar', 'quase', 'esperando']

/** No Meu edital: o placar das suas explicações e o que pede outra tentativa */
export function SuasExplicacoes({ dados, mudar }: { dados: Dados; mudar: Mudar }) {
  const [aberta, setAberta] = useState<Id | null>(null)
  const placar = placarDeExplicacoes(dados)
  const total = placar.certo + placar.quase + placar.revisar + placar.esperando
  if (total === 0) return null
  const pendentes = (dados.explicacoes ?? [])
    .filter((x) => x.texto.trim())
    .map((x) => ({ x, sit: situacaoDe(dados, x) }))
    .filter(({ sit }) => sit !== 'certo')
    .sort((a, b) => ORDEM.indexOf(a.sit) - ORDEM.indexOf(b.sit) || b.x.criadoEm - a.x.criadoEm)
    .slice(0, 8)
  const partes = [
    placar.certo && `${placar.certo} ${placar.certo === 1 ? 'certa' : 'certas'}`,
    placar.quase && `${placar.quase} quase lá`,
    placar.revisar && `${placar.revisar} para revisar`,
    placar.esperando && `${placar.esperando} esperando`
  ].filter(Boolean)
  return (
    <section aria-labelledby="t-explicacoes" className="estudo-do-dia">
      <div className="cabeca-dia">
        <h2 id="t-explicacoes" className="secao">
          Suas explicações
        </h2>
        <span className="meta">{partes.join(' · ')}</span>
      </div>
      {pendentes.map(({ x, sit }) => (
        <div key={x.id} style={{ display: 'contents' }}>
          <div className="linha-explicacao">
            <span>{x.topico}</span>
            <Veredito situacao={sit} />
            <button
              type="button"
              className="botao passo"
              aria-expanded={aberta === x.id}
              onClick={() => setAberta(aberta === x.id ? null : x.id)}
            >
              {sit === 'esperando' ? 'Ver' : 'Tentar de novo'}
              <Icone nome="direita" tamanho={14} />
            </button>
          </div>
          {aberta === x.id && (
            <Explique
              dados={dados}
              mudar={mudar}
              topico={x.topico}
              pergunta={x.pergunta}
              origem={
                x.simuladoId && x.indice !== undefined
                  ? { simuladoId: x.simuladoId, indice: x.indice }
                  : undefined
              }
              questao={
                x.simuladoId
                  ? dados.simulados.find((s) => s.id === x.simuladoId)?.questoes[x.indice ?? -1]
                  : undefined
              }
            />
          )}
        </div>
      ))}
    </section>
  )
}
