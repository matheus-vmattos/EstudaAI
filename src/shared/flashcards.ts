import { createEmptyCard, fsrs, generatorParameters, State, type Card, type Grade } from 'ts-fsrs'
import type { Agenda, Cartao, Id } from './tipos'

// ponytail: o FSRS é o agendador que o Anki usa hoje; a biblioteca ts-fsrs
// faz a conta. Parâmetros padrão: com centenas de revisões dá para treinar
// os seus, mas o padrão já é melhor que o SM-2 antigo.
const agendador = fsrs(generatorParameters({ enable_fuzz: true }))

export type Nota = 1 | 2 | 3 | 4
export const NOMES_DAS_NOTAS: Record<Nota, string> = {
  1: 'Errei',
  2: 'Difícil',
  3: 'Bom',
  4: 'Fácil'
}
export const NOVOS_POR_DIA = 20

const paraAgenda = (c: Card): Agenda => ({
  due: c.due.toISOString(),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  reps: c.reps,
  lapses: c.lapses,
  learning_steps: c.learning_steps,
  state: c.state,
  ...(c.last_review ? { last_review: c.last_review.toISOString() } : {})
})

const paraCard = (a: Agenda): Card => ({
  ...a,
  due: new Date(a.due),
  state: a.state as State,
  last_review: a.last_review ? new Date(a.last_review) : undefined
})

export const agendaNova = (agora = new Date()): Agenda => paraAgenda(createEmptyCard(agora))

export const ehNovo = (c: Cartao): boolean => c.agenda.state === State.New

/** a agenda depois de responder com essa nota */
export function responder(agenda: Agenda, nota: Nota, agora = new Date()): Agenda {
  return paraAgenda(agendador.next(paraCard(agenda), agora, nota as Grade).card)
}

/** quanto tempo até o cartão voltar, para cada nota (o que aparece nos botões) */
export function previsoes(agenda: Agenda, agora = new Date()): Record<Nota, number> {
  const r = agendador.repeat(paraCard(agenda), agora)
  const ms = (n: Nota): number => r[n as Grade].card.due.getTime() - agora.getTime()
  return { 1: ms(1), 2: ms(2), 3: ms(3), 4: ms(4) }
}

/** 45000 → "<1 min", 480000 → "8 min", 3 dias → "3 dias" */
export function formatarIntervalo(ms: number): string {
  const min = ms / 60000
  if (min < 1) return '<1 min'
  if (min < 60) return `${Math.round(min)} min`
  const h = min / 60
  if (h < 24) return `${Math.round(h)} h`
  const d = h / 24
  if (d < 30) return `${Math.round(d)} ${Math.round(d) === 1 ? 'dia' : 'dias'}`
  const m = d / 30
  if (m < 12) return `${Math.round(m)} ${Math.round(m) === 1 ? 'mês' : 'meses'}`
  const a = Math.round((d / 365) * 10) / 10
  return `${String(a).replace('.', ',')} ${a === 1 ? 'ano' : 'anos'}`
}

const fimDoDia = (agora: Date): number => {
  const d = new Date(agora)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}
const inicioDoDia = (agora: Date): number => {
  const d = new Date(agora)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export interface FilaDoDia {
  /** aprendendo (vencidos agora) e revisões de hoje, nessa ordem */
  revisar: Cartao[]
  /** novos que ainda cabem no limite do dia */
  novos: Cartao[]
}

/** cartão que pode ser mostrado agora: novo e revisão valem o dia todo;
 *  em aprendizado, só quando o minuto chega */
export const podeMostrar = (c: Cartao, agora = new Date()): boolean =>
  c.agenda.state === State.New ||
  c.agenda.state === State.Review ||
  new Date(c.agenda.due).getTime() <= agora.getTime()

/** O que estudar hoje. Revisão vale o dia inteiro; cartão em aprendizado só
 *  quando o minuto chegar; novos até o limite diário. */
export function filaDoDia(
  cartoes: Cartao[],
  agora = new Date(),
  /** só estes assuntos entram na fila; o limite de novos conta TODOS */
  assuntos: Set<Id> | null = null
): FilaDoDia {
  const limite = fimDoDia(agora)
  const aprendendo: Cartao[] = []
  const revisoes: Cartao[] = []
  const novos: Cartao[] = []
  let novosHoje = 0
  for (const c of cartoes) {
    const due = new Date(c.agenda.due).getTime()
    if (c.primeiraRevisao && c.primeiraRevisao >= inicioDoDia(agora)) novosHoje++
    if (assuntos && !assuntos.has(c.assuntoId)) continue
    if (c.agenda.state === State.New) novos.push(c)
    else if (c.agenda.state === State.Review) {
      if (due <= limite) revisoes.push(c)
    } else if (due <= agora.getTime()) aprendendo.push(c)
  }
  const porVencimento = (a: Cartao, b: Cartao): number =>
    new Date(a.agenda.due).getTime() - new Date(b.agenda.due).getTime()
  aprendendo.sort(porVencimento)
  revisoes.sort(porVencimento)
  novos.sort((a, b) => a.criadoEm - b.criadoEm)
  // quem passou da hora vem antes; o resto reveza entre os tópicos, para não
  // estudar cinco cartões de crase seguidos (prática intercalada)
  const hoje = inicioDoDia(agora)
  const atrasadas = revisoes.filter((c) => new Date(c.agenda.due).getTime() < hoje)
  const deHoje = revisoes.filter((c) => new Date(c.agenda.due).getTime() >= hoje)
  return {
    revisar: [...aprendendo, ...atrasadas, ...revezar(deHoje, (c) => c.assuntoId)],
    novos: revezar(novos, (c) => c.assuntoId).slice(0, Math.max(0, NOVOS_POR_DIA - novosHoje))
  }
}

/** Um de cada grupo por vez, mantendo a ordem dentro de cada grupo:
 *  [a1 a2 a3 b1 c1 c2] → [a1 b1 c1 a2 c2 a3] */
export function revezar<T>(itens: T[], grupo: (x: T) => string): T[] {
  const grupos = new Map<string, T[]>()
  for (const x of itens) {
    const g = grupo(x)
    grupos.set(g, [...(grupos.get(g) ?? []), x])
  }
  const filas = [...grupos.values()]
  const saida: T[] = []
  for (let i = 0; saida.length < itens.length; i++)
    for (const f of filas) if (i < f.length) saida.push(f[i])
  return saida
}

/** o próximo cartão em aprendizado que vai vencer ainda hoje (para esperar) */
export function proximoAprendendo(cartoes: Cartao[], agora = new Date()): Cartao | null {
  const limite = fimDoDia(agora)
  const futuros = cartoes
    .filter(
      (c) =>
        (c.agenda.state === State.Learning || c.agenda.state === State.Relearning) &&
        new Date(c.agenda.due).getTime() <= limite
    )
    .sort((a, b) => new Date(a.agenda.due).getTime() - new Date(b.agenda.due).getTime())
  return futuros[0] ?? null
}

// ---------- lacunas ----------

const LACUNA = /\{\{c\d+::(.*?)(?:::(.*?))?\}\}/g

export const temLacuna = (texto: string): boolean => new RegExp(LACUNA.source).test(texto)

/** frente: lacunas viram [...] (ou [dica]); verso: o texto inteiro, com a
 *  parte escondida marcada.
 *  ponytail: um cartão por texto, com todas as lacunas escondidas juntas.
 *  Limite: c1/c2 viram o mesmo cartão; separar pede um cartão por número. */
export function mostrarLacuna(texto: string): { frente: string; verso: string } {
  return {
    frente: texto.replace(LACUNA, (_, _r: string, dica?: string) => `[${dica || '...'}]`),
    verso: texto.replace(LACUNA, (_, resposta: string) => `==${resposta}==`)
  }
}

/** Da anotação para o cartão: pega a linha onde está o trecho selecionado,
 *  limpa a marcação da anotação e esconde o trecho como lacuna. */
export function lacunaDaAnotacao(nota: string, trecho: string): string | null {
  const t = trecho.trim()
  if (!t) return null
  const limpar = (s: string): string =>
    s
      .replace(/^\s*(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*)/, '')
      .replace(/\*\*PEGADINHA\*\*\s*/g, '')
      .replace(/\*\*|==/g, '')
      .trim()
  for (const linha of nota.split('\n')) {
    const limpa = limpar(linha)
    const i = limpa.indexOf(t)
    if (i >= 0) return `${limpa.slice(0, i)}{{c1::${t}}}${limpa.slice(i + t.length)}`
  }
  return null
}
