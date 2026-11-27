import { montagemDaProva } from '../../../shared/provaCompleta'
import { useEffect, useRef, useState } from 'react'
import { Icone } from '../Icone'
import { novoId, type Mudar } from '../useDados'
import type { AlvoDaRevisao } from '../App'
import { nosDaMateria } from '../../../shared/arvore'
import { importarEstrutura } from '../../../shared/estrutura'
import {
  acharMateria,
  dataDoEdital,
  diasAte,
  itensDoEdital,
  estudadoPonderado,
  lerEditalColado,
  proximoPasso,
  situacaoDoEdital,
  type MateriaLida,
  type SituacaoDaMateria
} from '../../../shared/edital'
import {
  planoDeHoje,
  planoDoDia,
  diaDe,
  sequenciaDeDias,
  tarefaFeita
} from '../../../shared/estudoDoDia'
import { ProvaCompleta } from './ProvaCompleta'
import { Explique } from '../Explique'
import { estadoDaResposta } from '../../../shared/explicar'
import { semAcento } from '../../../shared/texto'
import { importarDaCaixa } from '../importarDaCaixa'
import { chanceDeAprovacao, notaEstimada } from '../../../shared/chance'
import {
  feitaPelosDados,
  pontosDaMissao,
  tarefaFeita as feitaNaMissao
} from '../../../shared/missao'
import type { Dados, Id, ItemDaCaixa, TarefaDaMissao, TarefaDoDia } from '../../../shared/tipos'

const pct = (x: number): string => `${Math.round(x * 100)}%`
const um = (x: number): string =>
  x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const corDe = (x: number | null): string =>
  x === null ? 'sem' : x >= 0.7 ? 'nota-boa' : x >= 0.5 ? 'nota-media' : 'nota-ruim'
const MATERIAS_NO_TOPO = 4

/** uma tarefa da missão no Hoje (com os pontos) */
function TarefaDaMissaoLinha({
  t,
  feita,
  explicando,
  marcar,
  fazer
}: {
  t: TarefaDaMissao
  feita: boolean
  explicando: boolean
  marcar: () => void
  fazer: () => void
}) {
  return (
    <div className={`tarefa-dia com-pontos ${feita ? 'feita' : ''}`}>
      <button
        type="button"
        className="marca-tarefa"
        aria-pressed={feita}
        aria-label={feita ? `Desmarcar: ${t.titulo}` : `Marcar como feito: ${t.titulo}`}
        onClick={marcar}
      >
        {feita && <Icone nome="check" tamanho={14} />}
      </button>
      <span className="corpo-tarefa">
        <span className="titulo-tarefa">{t.titulo}</span>
        <span className="meta">Missão · {t.detalhe}</span>
      </span>
      <span className={`pontos ${feita ? 'nota-boa' : ''}`}>+{t.pontos} pts</span>
      {!feita ? (
        <button
          type="button"
          className="botao passo"
          aria-pressed={t.tipo === 'explicar' ? explicando : undefined}
          onClick={fazer}
        >
          {t.tipo === 'explicar'
            ? 'Explicar'
            : t.tipo === 'simulado'
              ? 'Começar'
              : t.tipo === 'anotacoes'
                ? 'Ler'
                : 'Abrir'}
          <Icone nome="direita" tamanho={14} />
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}

/** O concurso numa tela: quanto falta, quanto cada matéria vale e o próximo
 *  passo de cada uma, da que mais precisa de estudo para a que menos. */
export function MeuEdital({
  dados,
  mudar,
  agora,
  estudar,
  gerarSimulado,
  adaptar,
  abrirCaixa,
  abrirSimulado,
  abrirAnotacao,
  caixa
}: {
  dados: Dados
  mudar: Mudar
  agora: Date
  estudar: (alvo: AlvoDaRevisao) => void
  /** curto: o simulado do estudo do dia (10 questões, 20 min) */
  gerarSimulado: (materiaId: Id, curto?: boolean) => void
  adaptar: (simuladoId: Id) => void
  abrirCaixa: () => void
  abrirSimulado: (id: Id) => void
  abrirAnotacao: (id: Id) => void
  /** itens da caixa "Do Claude" (a missão da semana chega por ela) */
  caixa: ItemDaCaixa[]
}) {
  const [colando, setColando] = useState(false)
  const [explicando, setExplicando] = useState<string | null>(null)
  const [avisoMissao, setAvisoMissao] = useState('')
  // a missão mais nova da caixa entra sozinha: o Claude a montou para você
  const novaMissao = [...caixa].reverse().find((i) => i.tipo === 'missao')
  const buscando = useRef<string | null>(null)
  useEffect(() => {
    if (!novaMissao || dados.missao?.itemId === novaMissao.id) return
    if (buscando.current === novaMissao.id) return
    buscando.current = novaMissao.id
    void importarDaCaixa(novaMissao, dados, mudar).then((r) => !r.ok && setAvisoMissao(r.texto))
  }, [novaMissao?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // o que os dados já mostram feito fica marcado (não desmarca sozinho depois)
  const missao = dados.missao
  const vistasFeitas = missao
    ? missao.tarefas.filter(
        (t) => !feitaNaMissao(missao, t) && feitaPelosDados(dados, missao, t, agora)
      )
    : []
  useEffect(() => {
    if (!vistasFeitas.length) return
    mudar((d) => {
      if (d.missao)
        d.missao.feitas = [...new Set([...d.missao.feitas, ...vistasFeitas.map((t) => t.id)])]
    })
  }, [vistasFeitas.map((t) => t.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const [naProva, setNaProva] = useState(false)
  const [verFeitas, setVerFeitas] = useState(false)
  const [todasMaterias, setTodasMaterias] = useState(false)
  // o plano do dia é fixado na primeira vez que a tela abre no dia
  const hoje = diaDe(agora)
  useEffect(() => {
    if (!dados.edital || dados.planoDoDia?.dia === hoje) return
    mudar((d) => {
      d.planoDoDia = planoDoDia(d, agora)
    })
  }, [hoje, !!dados.edital]) // eslint-disable-line react-hooks/exhaustive-deps
  const plano = planoDeHoje(dados, agora)
  const feitas = plano.tarefas.filter((t) => tarefaFeita(dados, plano, t, agora))
  const minutos = plano.tarefas.reduce((n, t) => n + t.minutos, 0)
  const sequencia = sequenciaDeDias(dados, agora)
  const fazerTarefa = (t: TarefaDoDia): void => {
    if (t.tipo === 'revisar') estudar({ assuntos: null, titulo: 'Estudo de hoje' })
    else if (t.tipo === 'simulado')
      t.simuladoId ? adaptar(t.simuladoId) : gerarSimulado(t.materiaId, true)
    else abrirAnotacao(t.lugarId)
  }
  const marcar = (t: TarefaDoDia): void =>
    mudar((d) => {
      const p = d.planoDoDia?.dia === hoje ? d.planoDoDia : planoDoDia(d, agora)
      p.marcadas = p.marcadas.includes(t.chave)
        ? p.marcadas.filter((x) => x !== t.chave)
        : [...p.marcadas, t.chave]
      d.planoDoDia = p
    })
  const marcarNaMissao = (t: TarefaDaMissao): void =>
    mudar((d) => {
      if (!d.missao) return
      d.missao.feitas = d.missao.feitas.includes(t.id)
        ? d.missao.feitas.filter((x) => x !== t.id)
        : [...d.missao.feitas, t.id]
    })
  const fazerNaMissao = async (t: TarefaDaMissao): Promise<void> => {
    setAvisoMissao('')
    if (t.tipo === 'explicar') return setExplicando(explicando === t.id ? null : t.id)
    if (t.tipo === 'atrasados') return estudar({ assuntos: null, titulo: t.titulo })
    if (t.tipo === 'simulado') {
      const aberto = dados.simulados.find(
        (s) => !s.entregueEm && semAcento(s.config.tema) === semAcento(t.tema)
      )
      if (aberto) return abrirSimulado(aberto.id)
    }
    // cartões: importa sempre (não duplica e aplica a errata, se houver)
    const item = caixa.find((i) => i.id === t.item)
    if (!item)
      return setAvisoMissao(
        'Não achei este conteúdo na caixa do Claude. Toque em Atualizar em Do Claude.'
      )
    const r = await importarDaCaixa(item, dados, mudar)
    if (!r.ok) return setAvisoMissao(r.texto)
    if (r.simulado) return abrirSimulado(r.simulado)
    if (r.nos?.[0]) return abrirAnotacao(r.nos[0])
    if (r.frentes) {
      const frentes = r.frentes
      mudar((d) => {
        if (d.missao) d.missao.cartoesFrentes = { ...d.missao.cartoesFrentes, [t.id]: frentes }
      })
      estudar({ assuntos: null, titulo: t.titulo, frentes })
    }
  }
  const e = dados.edital
  const chance = e ? chanceDeAprovacao(dados, e) : null
  const nota = e ? notaEstimada(dados, e) : null
  const pontos = missao ? pontosDaMissao(missao) : null
  // a missão entra no Hoje: o que falta fica na lista; as feitas, recolhidas
  const pendentes = missao ? missao.tarefas.filter((t) => !feitaNaMissao(missao, t)) : []
  const concluidas = missao ? missao.tarefas.filter((t) => feitaNaMissao(missao, t)) : []
  const respostasNovas = (dados.explicacoes ?? []).filter(
    (x) => x.texto.trim() && estadoDaResposta(dados, x) === 'nova'
  ).length
  const situacao = situacaoDoEdital(dados, agora)
  const dias = e ? diasAte(e.dataProva, agora) : null

  const fazer = (s: SituacaoDaMateria): void => {
    const p = proximoPasso(s)
    if (p.tipo === 'revisar') {
      const m = dados.materias.find((x) => x.id === s.materiaId)!
      estudar({ assuntos: nosDaMateria(dados, m).map((n) => n.id), titulo: m.nome })
    } else if (p.tipo === 'adaptar') adaptar(p.simuladoId)
    else gerarSimulado(s.materiaId)
  }

  if (e && naProva)
    return (
      <ProvaCompleta
        dados={dados}
        edital={e}
        mudar={mudar}
        voltar={() => setNaProva(false)}
        abrirSimulado={abrirSimulado}
      />
    )

  return (
    <div className="tela">
      <main className="conteudo">
        {!e ? (
          <div className="vazio">
            <Icone nome="alvo" tamanho={40} />
            <p>Cole o conteúdo programático do seu edital, ou importe um edital pronto da caixa.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="botao principal" onClick={() => setColando(true)}>
                Colar edital
              </button>
              <button type="button" className="botao" onClick={abrirCaixa}>
                Do Claude
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="cabecalho">
              <div>
                <div className="trilha">Meu edital{e.banca && ` · ${e.banca}`}</div>
                <h1 className="titulo">{e.nome}</h1>
              </div>
              <div className="placar" style={{ marginLeft: 'auto' }}>
                {dias !== null && (
                  <div>
                    <span className="meta">Prova</span>
                    <span className="numero">
                      {dias > 0 ? `${dias} dias` : dias === 0 ? 'hoje' : 'já foi'}
                    </span>
                    <span className="meta">{e.dataProva.split('-').reverse().join('/')}</span>
                  </div>
                )}
                <div>
                  <span className="meta">Estudado</span>
                  <span className="numero nota-media">{pct(estudadoPonderado(situacao))}</span>
                  <span className="meta">pelo peso de cada matéria</span>
                </div>
                {e.notaMinima !== undefined && (
                  <div>
                    <span className="meta">Nota mínima</span>
                    <span className="numero">{e.notaMinima.toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
              <button type="button" className="botao" onClick={() => setColando(true)}>
                Trocar edital
              </button>
            </header>

            <div className="edital-topo">
              <section aria-labelledby="t-hoje" className="estudo-do-dia hoje">
                <div className="cabeca-dia">
                  <h2 id="t-hoje" className="secao">
                    Hoje
                  </h2>
                  <span className="meta">
                    {feitas.length} de {plano.tarefas.length + pendentes.length} · ~{minutos} min
                  </span>
                  {sequencia > 0 && (
                    <span className="meta sequencia">
                      Sequência: {sequencia} {sequencia === 1 ? 'dia' : 'dias'}
                    </span>
                  )}
                </div>
                {pendentes.map((t) => (
                  <TarefaDaMissaoLinha
                    key={t.id}
                    t={t}
                    feita={false}
                    explicando={explicando === t.id}
                    marcar={() => marcarNaMissao(t)}
                    fazer={() => void fazerNaMissao(t)}
                  />
                ))}
                {plano.tarefas.map((t) => {
                  const feita = feitas.includes(t)
                  return (
                    <div key={t.chave} className={`tarefa-dia ${feita ? 'feita' : ''}`}>
                      <button
                        type="button"
                        className="marca-tarefa"
                        aria-pressed={feita}
                        aria-label={
                          feita ? `Desmarcar: ${t.titulo}` : `Marcar como feito: ${t.titulo}`
                        }
                        onClick={() => marcar(t)}
                      >
                        {feita && <Icone nome="check" tamanho={14} />}
                      </button>
                      <span className="corpo-tarefa">
                        <span className="titulo-tarefa">{t.titulo}</span>
                        <span className="meta">{t.detalhe}</span>
                      </span>
                      {!feita && (
                        <button
                          type="button"
                          className="botao passo"
                          onClick={() => fazerTarefa(t)}
                        >
                          {t.tipo === 'revisar'
                            ? 'Começar'
                            : t.tipo === 'simulado'
                              ? t.simuladoId
                                ? 'Adaptar'
                                : 'Gerar prompt'
                              : 'Abrir'}
                          <Icone nome="direita" tamanho={14} />
                        </button>
                      )}
                    </div>
                  )
                })}
                {missao && (
                  <div className="linha-missao">
                    <span className="meta">
                      Missão da semana · {missao.de.split('-').reverse().slice(0, 2).join('/')} a{' '}
                      {missao.ate.split('-').reverse().slice(0, 2).join('/')}
                    </span>
                    <span className="barra">
                      <span
                        style={{
                          width: `${(pontos!.feitos / Math.max(1, pontos!.total)) * 100}%`
                        }}
                      />
                    </span>
                    <span className="meta pontos-missao">
                      {pontos!.feitos} / {pontos!.total} pts
                    </span>
                    {concluidas.length > 0 && (
                      <button
                        type="button"
                        className="botao discreto"
                        aria-expanded={verFeitas}
                        onClick={() => setVerFeitas((v) => !v)}
                      >
                        {concluidas.length} {concluidas.length === 1 ? 'feita' : 'feitas'}
                        <Icone nome={verFeitas ? 'abaixo' : 'direita'} tamanho={14} />
                      </button>
                    )}
                  </div>
                )}
                {missao && verFeitas && (
                  <>
                    {missao.frase && <p className="frase-missao">{missao.frase}</p>}
                    {concluidas.map((t) => (
                      <TarefaDaMissaoLinha
                        key={t.id}
                        t={t}
                        feita
                        explicando={false}
                        marcar={() => marcarNaMissao(t)}
                        fazer={() => void fazerNaMissao(t)}
                      />
                    ))}
                  </>
                )}
                {avisoMissao && (
                  <div className="aviso erro" role="alert">
                    {avisoMissao}
                  </div>
                )}
                {missao?.tarefas.map(
                  (t) =>
                    t.tipo === 'explicar' &&
                    explicando === t.id && (
                      <Explique
                        key={t.id}
                        dados={dados}
                        mudar={mudar}
                        topico={t.topico}
                        pergunta={t.pergunta}
                        detalhe={t.detalhe}
                        pontos={t.pontos}
                      />
                    )
                )}
              </section>

              {nota && (
                <section aria-labelledby="t-nota" className="chance">
                  <h2 id="t-nota" className="secao">
                    Nota estimada
                  </h2>
                  {nota.nota === null ? (
                    <span className="frase-chance">
                      Ainda não sei: nenhuma matéria foi medida. O primeiro simulado de cada matéria
                      já dá o número.
                    </span>
                  ) : (
                    <>
                      <div className="nota-chance">
                        <span
                          className={`numero ${nota.notaMinima === null ? '' : nota.nota < nota.notaMinima ? 'nota-ruim' : nota.nota < nota.notaMinima + 1 ? 'nota-media' : 'nota-boa'}`}
                        >
                          {um(nota.nota)}
                        </span>
                        <span className="meta">
                          {nota.notaMinima !== null && `mínimo ${um(nota.notaMinima)}`}
                          {nota.faltaMedir > 0.001 &&
                            ` · falta medir ${Math.round(nota.faltaMedir * 100)}% da nota`}
                        </span>
                      </div>
                      <div className="fontes-da-nota">
                        {nota.fontes.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className="fonte-da-nota"
                            onClick={() => abrirSimulado(f.id)}
                          >
                            <span>
                              {f.titulo}
                              {f.respondidas < f.total && ` (${f.respondidas} de ${f.total})`}
                            </span>
                            <span className="meta">{pct(f.acerto)}</span>
                            <span className={`meta ${f.tipo === 'real' ? 'nota-boa' : ''}`}>
                              {f.tipo === 'real' ? 'pesa o dobro' : 'treino'}
                            </span>
                          </button>
                        ))}
                        {nota.notaDoTreino !== null && (
                          <div className="fonte-da-nota">
                            <span>Só com os treinos</span>
                            <span className="meta">{um(nota.notaDoTreino)}</span>
                            <span className="meta" />
                          </div>
                        )}
                      </div>
                      <span className="frase-chance">
                        {nota.fontes.some((f) => f.tipo === 'real')
                          ? 'A prova real da banca conta o dobro do treino: é o que mais se parece com o dia da prova.'
                          : 'Ainda sem prova real: o número vem dos treinos e tende a ser otimista.'}
                      </span>
                    </>
                  )}
                </section>
              )}
            </div>

            <section aria-labelledby="t-prioridade" className="lista-edital">
              <div className="cabeca-dia">
                <h2 id="t-prioridade" className="secao">
                  Onde estudar primeiro
                </h2>
                <span className="meta">Peso na nota × o que falta</span>
                <button
                  type="button"
                  className="botao passo pendente"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => setNaProva(true)}
                >
                  {dados.provaEmMontagem && montagemDaProva(dados, e) === dados.provaEmMontagem
                    ? 'Continuar prova completa'
                    : 'Prova completa'}{' '}
                  · {e.materias.reduce((n, m) => n + m.questoes, 0)} questões
                  <Icone nome="direita" tamanho={14} />
                </button>
              </div>
              <div className="linha-edital cabeca" aria-hidden="true">
                <span>Matéria</span>
                <span>Peso na nota</span>
                <span>Acerto em treino</span>
                <span>Em prova real</span>
                <span />
              </div>
              {(todasMaterias ? situacao : situacao.slice(0, MATERIAS_NO_TOPO)).map((s) => {
                const passo = proximoPasso(s)
                const treino =
                  chance?.materias.find((m) => m.materiaId === s.materiaId)?.acerto ?? null
                const real = nota?.acertoReal.get(s.materiaId)
                return (
                  <div key={s.materiaId} className="linha-edital">
                    <span className="nome">{s.nome}</span>
                    <span className="medidor">
                      <span className="valor ciano">{pct(s.peso)}</span>
                      <span className="barra">
                        <span style={{ width: `${Math.min(100, s.peso * 400)}%` }} />
                      </span>
                    </span>
                    <span className={`numero-pequeno ${corDe(treino)}`}>
                      {treino === null ? 'sem treino' : pct(treino)}
                    </span>
                    <span
                      className={`numero-pequeno ${corDe(real?.acerto ?? null)}`}
                      title={real ? `${real.questoes} questões de prova real` : undefined}
                    >
                      {real ? pct(real.acerto) : '—'}
                    </span>
                    <button
                      type="button"
                      className={`botao passo ${passo.tipo === 'simulado' && !s.ultimoSimulado ? 'pendente' : ''}`}
                      onClick={() => fazer(s)}
                    >
                      {passo.texto}
                      <Icone nome="direita" tamanho={14} />
                    </button>
                  </div>
                )
              })}
              {situacao.length > MATERIAS_NO_TOPO && (
                <button
                  type="button"
                  className="ss-mais"
                  onClick={() => setTodasMaterias((v) => !v)}
                >
                  {todasMaterias
                    ? 'Mostrar só as primeiras'
                    : `+ ${situacao.length - MATERIAS_NO_TOPO} matérias`}
                </button>
              )}
            </section>

            {respostasNovas > 0 && (
              <button type="button" className="aviso-respostas" onClick={abrirCaixa}>
                <span className="ponto" aria-hidden="true" />
                <span style={{ flex: 1 }}>
                  {respostasNovas === 1
                    ? '1 resposta nova do Claude a uma explicação sua'
                    : `${respostasNovas} respostas novas do Claude às suas explicações`}
                </span>
                <span className="meta">Abrir em Do Claude</span>
                <Icone nome="direita" tamanho={14} />
              </button>
            )}
          </>
        )}
      </main>
      {colando && <ColarEdital dados={dados} mudar={mudar} fechar={() => setColando(false)} />}
    </div>
  )
}

type Linha = MateriaLida & { usar: boolean; questoes: string; peso: string }

// ponytail: o <dialog> do navegador já prende o foco, fecha no Esc e escurece o fundo
function ColarEdital({ dados, mudar, fechar }: { dados: Dados; mudar: Mudar; fechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const [nome, setNome] = useState(dados.edital?.nome ?? '')
  const [banca, setBanca] = useState(dados.edital?.banca ?? '')
  const [data, setData] = useState(dados.edital?.dataProva.split('-').reverse().join('/') ?? '')
  const [texto, setTexto] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [erro, setErro] = useState('')

  const ler = (t: string): void => {
    setTexto(t)
    setLinhas(lerEditalColado(t).map((m) => ({ ...m, usar: true, questoes: '', peso: '1' })))
  }
  const muda = (i: number, campo: Partial<Linha>): void =>
    setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...campo } : l)))

  const criar = (): void => {
    const usadas = linhas.filter((l) => l.usar)
    if (!nome.trim()) return setErro('Dê um nome ao concurso.')
    if (!usadas.length) return setErro('Nenhuma matéria marcada.')
    if (usadas.some((l) => !(Number(l.questoes) > 0)))
      return setErro('Preencha quantas questões cada matéria tem na prova.')
    const quando = data.trim() ? dataDoEdital(data) : ''
    if (data.trim() && !quando) return setErro('Data da prova no formato dd/mm/aaaa.')
    mudar((d) => {
      const materias = usadas.map((l) => {
        let id = acharMateria(d, l.nome)
        if (!id) {
          id = novoId()
          d.materias.push({ id, nome: l.nome, aberta: true, assuntos: [] })
        }
        // cada item do edital vira um assunto (o que já existe com o mesmo nome fica)
        importarEstrutura(
          d,
          [{ nome: l.nome, filhos: itensDoEdital(l.texto).map((nome) => ({ nome, filhos: [] })) }],
          novoId,
          Date.now(),
          id
        )
        return {
          materiaId: id,
          questoes: Number(l.questoes),
          peso: Number(l.peso) > 0 ? Number(l.peso) : 1,
          texto: l.texto
        }
      })
      d.edital = { nome: nome.trim(), banca: banca.trim(), dataProva: quando, materias }
    })
    fechar()
  }

  return (
    <dialog
      ref={ref}
      onClose={fechar}
      aria-labelledby="t-colar-edital"
      className="config colar-edital"
    >
      <header>
        <h2 id="t-colar-edital">Colar edital</h2>
        <button type="button" className="botao-icone" aria-label="Fechar" onClick={fechar}>
          <Icone nome="fechar" />
        </button>
      </header>
      <section>
        <div className="campos-edital">
          <label className="campo">
            Concurso
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="campo">
            Banca
            <input value={banca} onChange={(e) => setBanca(e.target.value)} />
          </label>
          <label className="campo">
            Prova
            <input
              placeholder="dd/mm/aaaa"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
        </div>
        <label className="campo">
          Conteúdo programático
          <textarea
            rows={5}
            placeholder="LÍNGUA PORTUGUESA: Ortografia e acentuação. Crase…"
            value={texto}
            onChange={(e) => ler(e.target.value)}
          />
        </label>
        {texto.trim() && (
          <span className="meta">
            {linhas.length
              ? `Encontrei ${linhas.length} matérias · ${linhas.reduce((n, l) => n + l.itens, 0)} itens`
              : 'Não achei matérias. Cada uma começa numa linha com o nome em maiúsculas e dois-pontos.'}
          </span>
        )}
        {linhas.length > 0 && (
          <div className="materias-lidas">
            <div className="linha-lida cabeca" aria-hidden="true">
              <span />
              <span>Matéria</span>
              <span>Questões</span>
              <span>Peso da prova</span>
            </div>
            {linhas.map((l, i) => (
              <div key={i} className="linha-lida">
                <input
                  type="checkbox"
                  aria-label={`Usar ${l.nome}`}
                  checked={l.usar}
                  onChange={(e) => muda(i, { usar: e.target.checked })}
                />
                <input
                  aria-label="Nome da matéria"
                  value={l.nome}
                  onChange={(e) => muda(i, { nome: e.target.value })}
                />
                <input
                  aria-label={`Questões de ${l.nome}`}
                  inputMode="numeric"
                  value={l.questoes}
                  onChange={(e) => muda(i, { questoes: e.target.value.replace(/\D/g, '') })}
                />
                <input
                  aria-label={`Peso da prova de ${l.nome}`}
                  inputMode="numeric"
                  value={l.peso}
                  onChange={(e) =>
                    muda(i, { peso: e.target.value.replace(/[^\d,.]/g, '').replace(',', '.') })
                  }
                />
              </div>
            ))}
          </div>
        )}
        {erro && (
          <div className="aviso erro" role="alert">
            {erro}
          </div>
        )}
        <div className="acoes-dialogo">
          <button type="button" className="botao" onClick={fechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="botao principal"
            disabled={!linhas.length}
            onClick={criar}
          >
            Criar matérias e assuntos
          </button>
        </div>
      </section>
    </dialog>
  )
}
