import { filaDoDia } from './flashcards'
import { nosDaMateria } from './arvore'
import { situacaoDoEdital, proximoPasso } from './edital'
import { temNotaPropria } from './anotacoesDoClaude'
import type { Dados, Id, PlanoDoDia, TarefaDoDia } from './tipos'

/** AAAA-MM-DD do dia local */
export const diaDe = (quando: Date): string =>
  `${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}-${String(quando.getDate()).padStart(2, '0')}`

const inicioDoDia = (agora: Date): number =>
  new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()

/** O dia de estudo, em até 3 tarefas, pela ordem do Meu edital:
 *  1. os cartões de hoje (se houver); 2. um simulado curto (ou o próximo
 *  adaptado) da matéria mais urgente; 3. um tópico que ainda não foi
 *  estudado, da matéria mais urgente que tiver um. */
export function planoDoDia(d: Dados, agora = new Date()): PlanoDoDia {
  const tarefas: TarefaDoDia[] = []
  const fila = filaDoDia(d.cartoes, agora)
  const cartoes = fila.revisar.length + fila.novos.length
  const situacao = situacaoDoEdital(d, agora)

  if (cartoes > 0) {
    // de quais matérias vêm os cartões (as 3 com mais)
    const daMateria = new Map<Id, number>()
    for (const m of d.materias) {
      const ids = new Set(nosDaMateria(d, m).map((n) => n.id))
      const n = [...fila.revisar, ...fila.novos].filter((c) => ids.has(c.assuntoId)).length
      if (n) daMateria.set(m.nome, n)
    }
    const nomes = [...daMateria.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([n]) => n)
    const minutos = Math.max(5, Math.round(cartoes * 0.5))
    tarefas.push({
      chave: 'revisar',
      tipo: 'revisar',
      titulo: `Revisar ${cartoes} ${cartoes === 1 ? 'cartão' : 'cartões'}`,
      detalhe: `${nomes.join(', ')} · ~${minutos} min`,
      minutos
    })
  }

  const urgente = situacao[0]
  if (urgente) {
    const passo = proximoPasso({ ...urgente, paraRevisar: 0 })
    const peso = Math.round(urgente.peso * 100)
    if (passo.tipo === 'adaptar')
      tarefas.push({
        chave: `simulado-${urgente.materiaId}`,
        tipo: 'simulado',
        titulo: `Próximo adaptado: ${urgente.nome}`,
        detalhe: `acerto de ${Math.round((urgente.acerto ?? 0) * 100)}% · ${peso}% da nota · ~20 min`,
        minutos: 20,
        materiaId: urgente.materiaId,
        simuladoId: passo.simuladoId
      })
    else
      tarefas.push({
        chave: `simulado-${urgente.materiaId}`,
        tipo: 'simulado',
        titulo: `Simulado curto: ${urgente.nome}`,
        detalhe: `10 questões · 20 min · ${peso}% da nota${urgente.ultimoSimulado ? '' : ', ainda sem simulado'}`,
        minutos: 20,
        materiaId: urgente.materiaId
      })
  }

  // tópico novo: o primeiro ainda sem anotação nem cartão, de preferência
  // um que não tenha filhos (o assunto mais concreto)
  for (const s of situacao) {
    const m = d.materias.find((x) => x.id === s.materiaId)
    if (!m) continue
    const nos = nosDaMateria(d, m)
    const comFilho = new Set(nos.map((n) => n.paiId).filter(Boolean) as Id[])
    const comCartao = new Set(d.cartoes.map((c) => c.assuntoId))
    const livres = nos.filter((n) => !temNotaPropria(d, n.id, n.nota) && !comCartao.has(n.id))
    const no = livres.find((n) => !comFilho.has(n.id)) ?? livres[0]
    if (no) {
      tarefas.push({
        chave: `topico-${no.id}`,
        tipo: 'topico',
        titulo: `Tópico novo: ${no.caminho.slice(-2).join(' › ')}`,
        detalhe: `${m.nome} · ainda sem anotação nem cartão · ~20 min`,
        minutos: 20,
        lugarId: no.id
      })
      break
    }
  }
  return { dia: diaDe(agora), tarefas, marcadas: [] }
}

/** o plano de hoje: o guardado, se for de hoje; senão, um novo */
export const planoDeHoje = (d: Dados, agora = new Date()): PlanoDoDia =>
  d.planoDoDia?.dia === diaDe(agora) ? d.planoDoDia : planoDoDia(d, agora)

/** A tarefa está feita? Pelo que aconteceu de verdade (os cartões acabaram,
 *  o simulado da matéria foi entregue hoje, o tópico ganhou anotação ou
 *  cartão) ou porque a pessoa marcou à mão. */
export function tarefaFeita(
  d: Dados,
  plano: PlanoDoDia,
  t: TarefaDoDia,
  agora = new Date()
): boolean {
  if (plano.marcadas.includes(t.chave)) return true
  if (t.tipo === 'revisar') {
    const f = filaDoDia(d.cartoes, agora)
    return f.revisar.length + f.novos.length === 0
  }
  if (t.tipo === 'simulado') {
    const m = d.materias.find((x) => x.id === t.materiaId)
    if (!m) return false
    const nos = new Set(nosDaMateria(d, m).map((n) => n.id))
    const hoje = inicioDoDia(agora)
    return d.simulados.some(
      (s) =>
        (s.entregueEm ?? 0) >= hoje &&
        (s.config.assuntoId ? nos.has(s.config.assuntoId) : s.config.materiaId === t.materiaId)
    )
  }
  const no =
    d.topicos.find((x) => x.id === t.lugarId) ??
    d.materias.flatMap((m) => m.assuntos).find((a) => a.id === t.lugarId)
  return (
    !!no && (temNotaPropria(d, no.id, no.nota) || d.cartoes.some((c) => c.assuntoId === t.lugarId))
  )
}

/** Os dias com estudo que dá para ver nos dados de agora. Só o mais recente
 *  de cada coisa fica (o cartão guarda a última revisão), por isso os dias
 *  já passados são guardados em `diasDeEstudo` por registrarDiaDeEstudo. */
function diasVisiveis(d: Dados): Set<string> {
  const dias = new Set<string>()
  const marcar = (ms: number | undefined | null): void => {
    if (ms) dias.add(diaDe(new Date(ms)))
  }
  for (const c of d.cartoes) if (c.agenda.last_review) marcar(Date.parse(c.agenda.last_review))
  for (const c of d.cartoes) marcar(c.primeiraRevisao)
  for (const s of d.simulados) marcar(s.entregueEm)
  // tópico só conta pela anotação sua (criar no mapa ou receber a do Claude não é estudo)
  for (const t of d.topicos) if (temNotaPropria(d, t.id, t.nota)) marcar(t.atualizadoEm)
  for (const m of d.materias)
    for (const a of m.assuntos) if (temNotaPropria(d, a.id, a.nota)) marcar(a.atualizadoEm)
  return dias
}

/** Guarda hoje como dia de estudo, se hoje teve estudo. Roda a cada mudança
 *  (useDados), então o dia fica salvo antes que uma revisão nova apague o
 *  rastro dele. Guarda os últimos 400 dias. */
export function registrarDiaDeEstudo(d: Dados, agora = new Date()): void {
  const hoje = diaDe(agora)
  if (d.diasDeEstudo?.includes(hoje) || !diasVisiveis(d).has(hoje)) return
  d.diasDeEstudo = [...(d.diasDeEstudo ?? []), hoje].slice(-400)
}

/** Quantos dias seguidos com estudo (cartão respondido, simulado entregue
 *  ou anotação mexida), contando até hoje; se hoje ainda não teve, conta
 *  até ontem, para a sequência não "zerar" de manhã. */
export function sequenciaDeDias(d: Dados, agora = new Date()): number {
  const dias = diasVisiveis(d)
  for (const x of d.diasDeEstudo ?? []) dias.add(x)
  const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  if (!dias.has(diaDe(dia))) dia.setDate(dia.getDate() - 1)
  let n = 0
  while (dias.has(diaDe(dia))) {
    n++
    dia.setDate(dia.getDate() - 1)
  }
  return n
}
