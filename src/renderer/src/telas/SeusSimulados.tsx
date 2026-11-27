import { useState } from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import type { Mudar } from '../useDados'
import { acertos, formatarTempo } from '../../../shared/questoes'
import { historico, pctDe, type GrupoDeTreinos } from '../../../shared/historico'
import type { Dados, Id, Simulado } from '../../../shared/tipos'

const cor = (pct: number): string =>
  pct >= 70 ? 'var(--verde)' : pct >= 50 ? 'var(--ambar)' : 'var(--vermelho)'
const data = (ms: number): string =>
  new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

/** A tela Questões (mockup "Questões enxuto", aprovado em 27/11): o que está
 *  pela metade, as provas e os treinos por matéria. Cada simulado é uma linha
 *  de clique único; refazer, adaptar e apagar ficam dentro do resultado. */
export function SeusSimulados({
  dados,
  mudar,
  abrirSimulado,
  adaptar,
  novo,
  colar
}: {
  dados: Dados
  mudar: Mudar
  abrirSimulado: (id: Id) => void
  adaptar: (id: Id) => void
  novo: () => void
  colar: () => void
}) {
  const { emAndamento, provas, treinos } = historico(dados)
  const [aberto, setAberto] = useState<string | null>(null)
  const [todosDe, setTodosDe] = useState<string | null>(null)
  const [verTodasMaterias, setVerTodasMaterias] = useState(false)
  const [apagando, setApagando] = useState<Simulado | null>(null)
  const MATERIAS_VISIVEIS = 6
  const grupos = verTodasMaterias ? treinos : treinos.slice(0, MATERIAS_VISIVEIS)

  return (
    <div className="tela">
      <main className="conteudo">
        <header className="cabecalho">
          <div>
            <div className="trilha">Questões</div>
            <h1 className="titulo">Seus simulados</h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="botao"
              title="Cola o simulado que a IA gerou (Ctrl+V também funciona)"
              onClick={colar}
            >
              <Icone nome="copiar" tamanho={14} />
              Colar questões
            </button>
            <button type="button" className="botao principal" onClick={novo}>
              + Novo simulado
            </button>
          </div>
        </header>

        {dados.simulados.length === 0 && (
          <div className="vazio">
            <Icone nome="relogio" tamanho={40} />
            <p>Nenhum simulado ainda. Gere o primeiro ou cole um que a IA fez.</p>
          </div>
        )}

        {emAndamento.length > 0 && (
          <section className="ss-secao" aria-labelledby="ss-andamento">
            <h2 id="ss-andamento" className="secao">
              Em andamento
            </h2>
            <div className="ss-cartoes">
              {emAndamento.map((s) => {
                const feitas = s.respostas.filter((r) => r !== null).length
                return (
                  <div key={s.id} className="ss-cartao">
                    <span className="nome">{s.config.tema}</span>
                    <span className="meta">
                      {feitas
                        ? `${feitas} de ${s.questoes.length}`
                        : `0 de ${s.questoes.length} · não começou`}
                      {feitas > 0 && ` · ${formatarTempo(s.decorridoMs)} corridos`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className="botao principal"
                        onClick={() => abrirSimulado(s.id)}
                      >
                        {feitas ? 'Continuar' : 'Começar'}
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        style={{ marginLeft: 'auto' }}
                        aria-label={`Apagar ${s.config.tema}`}
                        title="Apagar"
                        onClick={() => setApagando(s)}
                      >
                        <Icone nome="lixo" tamanho={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {provas.length > 0 && (
          <section className="ss-secao" aria-labelledby="ss-provas">
            <h2 id="ss-provas" className="secao">
              Provas
            </h2>
            {provas.map((s) => (
              <LinhaDoSimulado key={s.id} s={s} abrir={() => abrirSimulado(s.id)} />
            ))}
          </section>
        )}

        {treinos.length > 0 && (
          <section className="ss-secao" aria-labelledby="ss-treinos">
            <h2 id="ss-treinos" className="secao">
              Treinos por matéria
              <span className="meta">Cada barra é um simulado, do mais antigo ao mais novo</span>
            </h2>
            {grupos.map((g) => (
              <Grupo
                key={g.nome}
                g={g}
                aberto={aberto === g.nome}
                alternar={() => setAberto(aberto === g.nome ? null : g.nome)}
                todos={todosDe === g.nome}
                verTodos={() => setTodosDe(g.nome)}
                abrirSimulado={abrirSimulado}
                adaptar={adaptar}
              />
            ))}
            {treinos.length > MATERIAS_VISIVEIS && !verTodasMaterias && (
              <button type="button" className="ss-mais" onClick={() => setVerTodasMaterias(true)}>
                + {treinos.length - MATERIAS_VISIVEIS} matérias
              </button>
            )}
          </section>
        )}
      </main>

      {apagando && (
        <Confirmar
          titulo="Apagar este simulado?"
          texto={`“${apagando.config.tema}” e as respostas dele somem do histórico.`}
          botao="Apagar"
          aoConfirmar={() => {
            const id = apagando.id
            setApagando(null)
            mudar((d) => {
              d.simulados = d.simulados.filter((s) => s.id !== id)
            })
          }}
          aoCancelar={() => setApagando(null)}
        />
      )}
    </div>
  )
}

function LinhaDoSimulado({ s, abrir, sub }: { s: Simulado; abrir: () => void; sub?: boolean }) {
  const certas = acertos(s.questoes, s.respostas)
  const pct = pctDe(s)
  return (
    <button type="button" className={`ss-linha ${sub ? 'sub' : ''}`} onClick={abrir}>
      <span className="nome">{s.config.tema}</span>
      <span className="meta">
        {data(s.criadoEm)} · {s.questoes.length} questões · {formatarTempo(s.decorridoMs)}
      </span>
      <span className="ss-nota" style={{ color: cor(pct) }}>
        {sub ? `${certas}/${s.questoes.length}` : `${pct}%`}
      </span>
      <Icone nome="direita" tamanho={14} />
    </button>
  )
}

const RECENTES = 3

function Grupo({
  g,
  aberto,
  alternar,
  todos,
  verTodos,
  abrirSimulado,
  adaptar
}: {
  g: GrupoDeTreinos
  aberto: boolean
  alternar: () => void
  todos: boolean
  verTodos: () => void
  abrirSimulado: (id: Id) => void
  adaptar: (id: Id) => void
}) {
  const ultimo = g.simulados[g.simulados.length - 1]
  const ultimoPct = g.pcts[g.pcts.length - 1]
  const recentes = [...g.simulados].reverse()
  const visiveis = todos ? recentes : recentes.slice(0, RECENTES)
  // as barras: os 16 mais novos
  const barras = g.pcts.slice(-16)
  return (
    <div className="ss-grupo">
      <div className={`ss-materia ${aberto ? 'aberta' : ''}`}>
        <button type="button" className="ss-abrir" aria-expanded={aberto} onClick={alternar}>
          <Icone nome={aberto ? 'abaixo' : 'direita'} tamanho={14} />
          <span className="nome">{g.nome}</span>
          <span className="meta">
            {g.simulados.length} {g.simulados.length === 1 ? 'simulado' : 'simulados'}
          </span>
        </button>
        <span
          className="ss-barras"
          role="img"
          aria-label={`Acerto nos últimos: ${barras.map((p) => `${p}%`).join(', ')}`}
        >
          {barras.map((p, i) => (
            <i key={i} style={{ height: `${Math.max(8, p)}%`, background: cor(p) }} />
          ))}
        </span>
        <span className="ss-nota" style={{ color: cor(ultimoPct) }}>
          últ. {ultimoPct}%
        </span>
        <button
          type="button"
          className="botao"
          title="O próximo simulado, a partir do último desta matéria"
          onClick={() => adaptar(ultimo.id)}
        >
          Adaptar
        </button>
      </div>
      {aberto && (
        <>
          {visiveis.map((s) => (
            <LinhaDoSimulado key={s.id} s={s} sub abrir={() => abrirSimulado(s.id)} />
          ))}
          {!todos && recentes.length > RECENTES && (
            <button type="button" className="ss-mais sub" onClick={verTodos}>
              + {recentes.length - RECENTES} mais antigos
            </button>
          )}
        </>
      )}
    </div>
  )
}
