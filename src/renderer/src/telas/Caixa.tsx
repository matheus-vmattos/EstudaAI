import { useState } from 'react'
import { Icone } from '../Icone'
import type { Mudar } from '../useDados'
import { importarDaCaixa, type ResultadoDaCaixa } from '../importarDaCaixa'
import type { Dados, Id, ItemDaCaixa } from '../../../shared/tipos'

export type EstadoDaCaixa = { carregando: boolean; itens: ItemDaCaixa[]; erro: string }

const NOME_DO_TIPO = {
  estrutura: 'Mapa',
  simulado: 'Simulado',
  cartoes: 'Flashcards',
  edital: 'Edital',
  missao: 'Missão',
  anotacoes: 'Anotações'
}

/** O que o Claude preparou para você: mapas e simulados prontos para importar */
export function Caixa({
  dados,
  mudar,
  caixa,
  atualizar,
  abrirMapa,
  abrirSimulado,
  abrirFlashcards,
  abrirEdital,
  abrirAnotacao
}: {
  dados: Dados
  mudar: Mudar
  caixa: EstadoDaCaixa
  atualizar: () => void
  abrirMapa: () => void
  abrirSimulado: (id: Id) => void
  abrirFlashcards: () => void
  abrirEdital: () => void
  abrirAnotacao: (id: Id) => void
}) {
  const [trabalhando, setTrabalhando] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Record<string, ResultadoDaCaixa>>({})
  const importados = new Set(dados.caixaImportados ?? [])
  const itens = [...caixa.itens].reverse() // mais novo primeiro

  const importar = async (item: ItemDaCaixa): Promise<void> => {
    setTrabalhando(item.id)
    const res = await importarDaCaixa(item, dados, mudar)
    setTrabalhando(null)
    setResultado((x) => ({ ...x, [item.id]: res }))
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
                {res?.ok && (item.tipo === 'edital' || item.tipo === 'missao') && (
                  <button type="button" className="botao sucesso" onClick={abrirEdital}>
                    Ver meu edital
                  </button>
                )}
                {res?.ok && item.tipo === 'anotacoes' && res.nos?.[0] && (
                  <button
                    type="button"
                    className="botao sucesso"
                    onClick={() => abrirAnotacao(res.nos![0])}
                  >
                    Ler
                  </button>
                )}
                {res?.ok && item.tipo === 'cartoes' && (
                  <button type="button" className="botao sucesso" onClick={abrirFlashcards}>
                    Estudar
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
