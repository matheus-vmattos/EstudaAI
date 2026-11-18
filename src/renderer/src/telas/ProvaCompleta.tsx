import { useState } from 'react'
import { Icone } from '../Icone'
import { novoId, type Mudar } from '../useDados'
import { lerRespostaDaIa } from '../../../shared/questoes'
import {
  blocosDaProva,
  ordenarBloco,
  promptDoBloco,
  simuladoDaProva
} from '../../../shared/provaCompleta'
import type { Dados, Edital, IaDestino, Id } from '../../../shared/tipos'

/** A prova completa do edital, montada em blocos: cada bloco é um pedido à
 *  IA; quando todos chegam, a prova abre com as questões na ordem do edital. */
export function ProvaCompleta({
  dados,
  edital: e,
  mudar,
  voltar,
  abrirSimulado
}: {
  dados: Dados
  edital: Edital
  mudar: Mudar
  voltar: () => void
  abrirSimulado: (id: Id) => void
}) {
  const [ia, setIa] = useState<IaDestino>('claude')
  const [copiado, setCopiado] = useState<number | null>(null)
  const [erro, setErro] = useState<{ bloco: number; texto: string } | null>(null)
  // a montagem fica guardada: dá para pedir um bloco hoje e outro amanhã
  const montagem = dados.provaEmMontagem ?? { criadoEm: 0, blocos: blocosDaProva(dados, e) }
  const recebidas = montagem.blocos.reduce((n, b) => n + (b.questoes?.length ?? 0), 0)
  const total = montagem.blocos.reduce(
    (n, b) => n + b.materias.reduce((k, m) => k + m.questoes, 0),
    0
  )
  const prontos = montagem.blocos.every((b) => b.questoes)

  const guardar = (f: (blocos: typeof montagem.blocos) => void): void =>
    mudar((d) => {
      const m = d.provaEmMontagem ?? { criadoEm: Date.now(), blocos: blocosDaProva(d, e) }
      f(m.blocos)
      d.provaEmMontagem = m
    })

  const copiar = async (i: number): Promise<void> => {
    await window.api.copiar(promptDoBloco(e, montagem.blocos, i, ia))
    setCopiado(i)
    setErro(null)
  }
  const colar = async (i: number): Promise<void> => {
    const leitura = lerRespostaDaIa(await window.api.lerAreaDeTransferencia())
    if (!leitura.ok) return setErro({ bloco: i, texto: leitura.erro })
    const ordem = ordenarBloco(montagem.blocos[i].materias, leitura.questoes)
    if (!ordem.ok) return setErro({ bloco: i, texto: ordem.erro })
    setErro(null)
    guardar((blocos) => {
      blocos[i].questoes = ordem.questoes
    })
  }
  const iniciar = (): void => {
    const s = simuladoDaProva(e, montagem, novoId(), Date.now())
    if (!s) return
    mudar((d) => {
      d.simulados.push(s)
      delete d.provaEmMontagem
    })
    abrirSimulado(s.id)
  }

  return (
    <div className="tela">
      <main className="conteudo">
        <header className="cabecalho">
          <div>
            <button
              type="button"
              className="botao"
              style={{ border: 0, paddingLeft: 0 }}
              onClick={voltar}
            >
              <Icone nome="esquerda" tamanho={16} />
              Meu edital
            </button>
            <h1 className="titulo">
              Prova completa · {e.nome}
              {e.banca && ` · ${e.banca}`}
            </h1>
          </div>
          <div className="placar" style={{ marginLeft: 'auto' }}>
            <div>
              <span className="meta">Questões</span>
              <span className="numero">
                {recebidas} / {total}
              </span>
            </div>
            <div>
              <span className="meta">Tempo</span>
              <span className="numero">
                {Math.floor((e.duracaoMin ?? Math.round(total * 3.4)) / 60)}h
                {String((e.duracaoMin ?? Math.round(total * 3.4)) % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="meta">
            Cada bloco vira um arquivo da IA. Com os {montagem.blocos.length}, a prova abre.
          </span>
          <div
            role="radiogroup"
            aria-label="IA de destino"
            className="opcoes"
            style={{ marginLeft: 'auto', gridTemplateColumns: 'repeat(2, auto)' }}
          >
            {(['claude', 'gpt'] as const).map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={ia === x}
                className="opcao"
                style={{ minHeight: 36, padding: '0 14px' }}
                onClick={() => setIa(x)}
              >
                {x === 'claude' ? 'Claude' : 'GPT'}
              </button>
            ))}
          </div>
        </div>

        <div className="blocos-prova">
          {montagem.blocos.map((b, i) => {
            const n = b.materias.reduce((k, m) => k + m.questoes, 0)
            const peso = b.materias[0]?.peso
            return (
              <section
                key={i}
                className={`bloco-prova ${b.questoes ? 'pronto' : ''}`}
                aria-label={`Bloco ${i + 1}`}
              >
                <div className="cabeca-bloco">
                  <span className="titulo-bloco">
                    Bloco {i + 1} · {n} questões{peso !== undefined && ` · peso ${peso}`}
                  </span>
                  <span
                    className={`meta estado ${b.questoes ? 'nota-boa' : copiado === i ? 'nota-media' : ''}`}
                    role="status"
                  >
                    {b.questoes
                      ? `✓ ${b.questoes.length} questões recebidas`
                      : copiado === i
                        ? 'Prompt copiado · cole a resposta da IA'
                        : 'Ainda não pedido'}
                  </span>
                </div>
                <div className="materias-bloco">
                  {b.materias.map((m) => (
                    <span key={m.materiaId}>
                      {m.nome} <b>{m.questoes}</b>
                    </span>
                  ))}
                </div>
                {erro?.bloco === i && (
                  <div className="aviso erro" role="alert">
                    {erro.texto}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  {b.questoes ? (
                    <button
                      type="button"
                      className="botao"
                      onClick={() =>
                        guardar((blocos) => {
                          blocos[i].questoes = null
                        })
                      }
                    >
                      Refazer bloco
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={copiado === i ? 'botao' : 'botao principal'}
                        onClick={() => void copiar(i)}
                      >
                        <Icone nome="copiar" tamanho={16} />
                        {copiado === i ? 'Copiado ✓' : 'Copiar prompt'}
                      </button>
                      <button
                        type="button"
                        className={copiado === i ? 'botao principal' : 'botao'}
                        onClick={() => void colar(i)}
                      >
                        Colar resposta
                      </button>
                    </>
                  )}
                </div>
              </section>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {dados.provaEmMontagem && (
            <button
              type="button"
              className="botao"
              onClick={() =>
                mudar((d) => {
                  delete d.provaEmMontagem
                })
              }
            >
              Recomeçar
            </button>
          )}
          <button type="button" className="botao sucesso" disabled={!prontos} onClick={iniciar}>
            Iniciar prova
          </button>
        </div>
      </main>
    </div>
  )
}
