import { useState } from 'react'
import { Icone } from '../Icone'
import { novoId, type Mudar } from '../useDados'
import {
  importarEstrutura,
  lerEstrutura,
  recolherAbaixoDosAssuntos
} from '../../../shared/estrutura'
import { lerRespostaDaIa } from '../../../shared/questoes'
import { importarCartoes, lerPacoteDeCartoes } from '../../../shared/pacoteDeCartoes'
import { importarEdital, lerPacoteDeEdital, simuladoDaCaixa } from '../../../shared/edital'
import type { Dados, Id, ItemDaCaixa } from '../../../shared/tipos'

export type EstadoDaCaixa = { carregando: boolean; itens: ItemDaCaixa[]; erro: string }

const NOME_DO_TIPO = {
  estrutura: 'Mapa',
  simulado: 'Simulado',
  cartoes: 'Flashcards',
  edital: 'Edital'
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
  abrirEdital
}: {
  dados: Dados
  mudar: Mudar
  caixa: EstadoDaCaixa
  atualizar: () => void
  abrirMapa: () => void
  abrirSimulado: (id: Id) => void
  abrirFlashcards: () => void
  abrirEdital: () => void
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
        recolherAbaixoDosAssuntos(d, importarEstrutura(d, raizes, novoId).materias)
        d.caixaImportados = [...new Set([...(d.caixaImportados ?? []), item.id])]
      })
      setResultado((x) => ({
        ...x,
        [item.id]: { ok: true, texto: `✓ ${res.criados} criados · ${res.aproveitados} já existiam` }
      }))
      return
    }
    if (item.tipo === 'edital') {
      const lido = lerPacoteDeEdital(r.texto)
      if (!lido.ok) {
        setResultado((x) => ({ ...x, [item.id]: { ok: false, texto: lido.erro } }))
        return
      }
      const res = importarEdital(structuredClone(dados), lido.pacote, novoId)
      mudar((d) => {
        importarEdital(d, lido.pacote, novoId)
        d.caixaImportados = [...new Set([...(d.caixaImportados ?? []), item.id])]
      })
      setResultado((x) => ({
        ...x,
        [item.id]: {
          ok: true,
          texto:
            `✓ Edital ligado: ${res.materias} matérias` +
            (res.criadas ? ` (${res.criadas} novas, importe também o mapa)` : '')
        }
      }))
      return
    }
    if (item.tipo === 'cartoes') {
      const lido = lerPacoteDeCartoes(r.texto)
      if (!lido.ok) {
        setResultado((x) => ({ ...x, [item.id]: { ok: false, texto: lido.erro } }))
        return
      }
      const quando = Date.now()
      const res = importarCartoes(structuredClone(dados), lido.pacote, novoId, quando)
      mudar((d) => {
        importarCartoes(d, lido.pacote, novoId, quando)
        d.caixaImportados = [...new Set([...(d.caixaImportados ?? []), item.id])]
      })
      setResultado((x) => ({
        ...x,
        [item.id]: {
          ok: true,
          texto:
            `✓ ${res.novos} cartões novos` +
            (res.repetidos ? ` · ${res.repetidos} já existiam` : '') +
            (res.lugaresCriados ? ` · ${res.lugaresCriados} lugares novos no mapa` : '')
        }
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
    const simulado = simuladoDaCaixa(dados, leitura, item.titulo, id, Date.now())
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
                {res?.ok && item.tipo === 'edital' && (
                  <button type="button" className="botao sucesso" onClick={abrirEdital}>
                    Ver meu edital
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
