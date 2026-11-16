import { useState } from 'react'
import { Icone } from '../Icone'
import { novoId, type Mudar } from '../useDados'
import { importarEstrutura, lerEstrutura } from '../../../shared/estrutura'
import { lerRespostaDaIa } from '../../../shared/questoes'
import type { Dados, Id, ItemDaCaixa, Simulado } from '../../../shared/tipos'

export type EstadoDaCaixa = { carregando: boolean; itens: ItemDaCaixa[]; erro: string }

const NOME_DO_TIPO = { estrutura: 'Mapa', simulado: 'Simulado' }

/** O que o Claude preparou para você: mapas e simulados prontos para importar */
export function Caixa({
  dados,
  mudar,
  caixa,
  atualizar,
  abrirMapa,
  abrirSimulado
}: {
  dados: Dados
  mudar: Mudar
  caixa: EstadoDaCaixa
  atualizar: () => void
  abrirMapa: () => void
  abrirSimulado: (id: Id) => void
}) {
  const [trabalhando, setTrabalhando] = useState<string | null>(null)
  const [resultado, setResultado] = useState<
    Record<string, { ok: boolean; texto: string; simulado?: Id }>
  >({})
  const importados = new Set(dados.caixaImportados ?? [])
  const itens = [...caixa.itens].reverse() // mais novo primeiro

  const importar = async (item: ItemDaCaixa): Promise<void> => {
    setTrabalhando(item.id)
    const r = await window.api.caixaArquivo(item.arquivo)
    setTrabalhando(null)
    if ('erro' in r) {
      setResultado((x) => ({ ...x, [item.id]: { ok: false, texto: r.erro } }))
      return
    }
    if (item.tipo === 'estrutura') {
      const raizes = lerEstrutura(r.texto)
      // a contagem sai de uma cópia: o mudar do React pode rodar depois
      const res = importarEstrutura(structuredClone(dados), raizes, novoId)
      mudar((d) => {
        importarEstrutura(d, raizes, novoId)
        d.caixaImportados = [...new Set([...(d.caixaImportados ?? []), item.id])]
      })
      setResultado((x) => ({
        ...x,
        [item.id]: { ok: true, texto: `✓ ${res.criados} criados · ${res.aproveitados} já existiam` }
      }))
      return
    }
    const leitura = lerRespostaDaIa(r.texto)
    if (!leitura.ok) {
      setResultado((x) => ({ ...x, [item.id]: { ok: false, texto: leitura.erro } }))
      return
    }
    const n = leitura.questoes.length
    const id = novoId()
    const simulado: Simulado = {
      id,
      config: {
        tema: leitura.tema || item.titulo,
        assuntoId: null,
        nivel: 'medio',
        tipo: leitura.tipo,
        quantidade: n,
        // padrão de prova: 3 min por questão
        tempoMin: n * 3,
        banca: ''
      },
      questoes: leitura.questoes,
      respostas: Array(n).fill(null),
      revisar: Array(n).fill(false),
      tempoPorQuestao: Array(n).fill(0),
      decorridoMs: 0,
      atual: 0,
      criadoEm: Date.now(),
      entregueEm: null
    }
    mudar((d) => {
      d.simulados.push(simulado)
      d.caixaImportados = [...new Set([...(d.caixaImportados ?? []), item.id])]
    })
    setResultado((x) => ({
      ...x,
      [item.id]: { ok: true, texto: `✓ ${n} questões no histórico (${n * 3} min)`, simulado: id }
    }))
  }

  return (
    <div className="tela">
      <main className="conteudo">
        <header className="cabecalho">
          <div>
            <div className="trilha">Do Claude</div>
            <h1 className="titulo">Preparado para você</h1>
          </div>
          <button type="button" className="botao" disabled={caixa.carregando} onClick={atualizar}>
            <Icone nome="atualizar" tamanho={16} />
            {caixa.carregando ? 'Buscando…' : 'Atualizar'}
          </button>
        </header>

        {caixa.erro && <div className="aviso erro">{caixa.erro}</div>}
        {!caixa.erro && !caixa.carregando && itens.length === 0 && (
          <div className="vazio">
            <Icone nome="enviar" tamanho={40} />
            <p>
              Peça ao Claude um mapa pelo seu edital ou um simulado pronto: ele aparece aqui para
              importar.
            </p>
          </div>
        )}

        <div className="historico">
          {itens.map((item) => {
            const feito = importados.has(item.id)
            const res = resultado[item.id]
            return (
              <div key={item.id} className="item-caixa">
                <span className={`selo-tipo ${item.tipo}`}>{NOME_DO_TIPO[item.tipo]}</span>
                <div className="corpo-item">
                  <span className="nome">{item.titulo}</span>
                  {item.descricao && <span className="descricao">{item.descricao}</span>}
                  {res && (
                    <span className={`meta ${res.ok ? 'nota-boa' : 'nota-ruim'}`} role="status">
                      {res.texto}
                    </span>
                  )}
                </div>
                {item.data && (
                  <span className="meta">{item.data.split('-').reverse().join('/')}</span>
                )}
                {res?.ok && item.tipo === 'estrutura' && (
                  <button type="button" className="botao" onClick={abrirMapa}>
                    Ver no mapa
                  </button>
                )}
                {res?.simulado && (
                  <button
                    type="button"
                    className="botao sucesso"
                    onClick={() => abrirSimulado(res.simulado!)}
                  >
                    Começar
                  </button>
                )}
                {!res?.ok && (
                  <button
                    type="button"
                    className={feito ? 'botao' : 'botao principal'}
                    disabled={trabalhando === item.id}
                    onClick={() => void importar(item)}
                  >
                    {trabalhando === item.id
                      ? 'Importando…'
                      : feito
                        ? 'Importar de novo'
                        : 'Importar'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
