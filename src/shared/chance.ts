import { nosDaMateria } from './arvore'
import { acharMateria } from './edital'
import type { Dados, Edital, Id, Simulado } from './tipos'

/** quantas questões recentes de cada matéria contam no acerto (o que você
 *  sabe hoje, não o do primeiro dia) */
const RECENTES = 40

export type Nivel = 'nunca' | 'comecando' | 'firmando' | 'firme' | 'dominada'

export const NOME_DO_NIVEL: Record<Nivel, string> = {
  nunca: 'Nunca vi',
  comecando: 'Começando',
  firmando: 'Firmando',
  firme: 'Firme',
  dominada: 'Dominada'
}

export interface ChanceDaMateria {
  materiaId: Id
  questoes: number
  peso: number
  /** acerto nas questões recentes; null = nunca medida */
  acerto: number | null
  medidas: number
  nivel: Nivel
}

export interface Chance {
  /** nota projetada (0–10) só com as matérias medidas; null = nada medido */
  nota: number | null
  notaMinima: number | null
  /** questões do edital (das matérias medidas) / total */
  medidas: number
  total: number
  /** parte da nota (0–1) que ainda não foi medida */
  faltaMedir: number
  materias: ChanceDaMateria[]
}

/** Cada questão respondida da matéria (do simulado da matéria ou da parte
 *  dela numa prova completa), da mais recente para a mais antiga. */
export function respostasDaMateria(d: Dados, materiaId: Id): boolean[] {
  const m = d.materias.find((x) => x.id === materiaId)
  if (!m) return []
  const nos = new Set(nosDaMateria(d, m).map((n) => n.id))
  const lotes: { quando: number; certas: boolean[] }[] = []
  for (const s of d.simulados) {
    if (!s.entregueEm) continue
    const certa = (i: number): boolean => s.respostas[i] === s.questoes[i].gabarito
    const daProva = s.prova?.materias.find((x) => x.materiaId === materiaId)
    if (daProva) {
      const idx = Array.from({ length: daProva.ate - daProva.de }, (_, k) => daProva.de + k)
      lotes.push({ quando: s.entregueEm, certas: idx.map(certa) })
    } else if (
      !s.prova &&
      (s.config.assuntoId ? nos.has(s.config.assuntoId) : s.config.materiaId === materiaId)
    )
      lotes.push({ quando: s.entregueEm, certas: s.questoes.map((_, i) => certa(i)) })
  }
  return lotes.sort((a, b) => b.quando - a.quando).flatMap((l) => l.certas.reverse())
}

function nivelDe(d: Dados, materiaId: Id, acerto: number | null, medidas: number): Nivel {
  if (acerto === null) {
    const m = d.materias.find((x) => x.id === materiaId)
    const nos = m ? new Set(nosDaMateria(d, m).map((n) => n.id)) : new Set<Id>()
    const estudou = d.cartoes.some((c) => nos.has(c.assuntoId) && c.primeiraRevisao)
    return estudou ? 'comecando' : 'nunca'
  }
  if (medidas < 10 || acerto < 0.6) return 'comecando'
  // um simulado só (10 questões) ainda é "firmando", por melhor que seja
  if (acerto < 0.8 || medidas < 20) return 'firmando'
  // "dominada" pede a janela inteira (40 questões recentes) a 90% ou mais:
  // um bom simulado só não basta
  if (acerto < 0.9 || medidas < RECENTES) return 'firme'
  return 'dominada'
}

/** A nota que você tiraria hoje, calculada como a banca calcula (cada prova
 *  de 0 a 10, ponderada pelo peso), mas só com o que já foi medido. O que
 *  nunca foi medido não entra como zero nem como chute: fica em faltaMedir. */
export function chanceDeAprovacao(d: Dados, e: Edital): Chance {
  const materias: ChanceDaMateria[] = e.materias.map((x) => {
    const r = respostasDaMateria(d, x.materiaId).slice(0, RECENTES)
    const acerto = r.length ? r.filter(Boolean).length / r.length : null
    return {
      materiaId: x.materiaId,
      questoes: x.questoes,
      peso: x.peso,
      acerto,
      medidas: r.length,
      nivel: nivelDe(d, x.materiaId, acerto, r.length)
    }
  })
  // quanto cada questão vale na nota final: a prova vira 0–10 antes do peso
  const porPeso = new Map<number, number>()
  for (const x of e.materias) porPeso.set(x.peso, (porPeso.get(x.peso) ?? 0) + x.questoes)
  const somaPesos = [...porPeso.keys()].reduce((a, b) => a + b, 0)
  const valor = (m: ChanceDaMateria): number =>
    (m.questoes / porPeso.get(m.peso)!) * (m.peso / somaPesos)
  const medidas = materias.filter((m) => m.acerto !== null)
  const vale = medidas.reduce((n, m) => n + valor(m), 0)
  return {
    nota: vale ? (medidas.reduce((n, m) => n + valor(m) * m.acerto!, 0) / vale) * 10 : null,
    notaMinima: e.notaMinima ?? null,
    medidas: medidas.reduce((n, m) => n + m.questoes, 0),
    total: e.materias.reduce((n, m) => n + m.questoes, 0),
    faltaMedir: 1 - vale,
    materias
  }
}

/** A frase da chance. Sem nota mínima no edital, não há "passaria": fica só
 *  a nota projetada. */
export function fraseDaChance(c: Chance): string {
  if (c.nota === null)
    return 'Ainda não sei: nenhuma matéria foi medida em simulado. O primeiro simulado de cada matéria já dá o número.'
  if (c.faltaMedir > 0.001)
    return `Ainda não dá para dizer se passa: o que falta medir vale ${Math.round(c.faltaMedir * 100)}% da nota.`
  if (c.notaMinima === null)
    return 'O edital não diz a nota mínima: sem ela, dá para ver a nota, não se passa.'
  return c.nota >= c.notaMinima
    ? 'No ritmo de hoje, você passaria.'
    : 'Hoje, abaixo do mínimo: a lista abaixo mostra onde subir.'
}

/** prova real convertida ("Prova real · Banese 2012…"): conta mais que treino */
export const ehProvaReal = (s: Simulado): boolean => /^prova real\b/i.test(s.config.tema)

export interface FonteDaNota {
  id: Id
  titulo: string
  /** acerto nas questões respondidas (0–1) */
  acerto: number
  respondidas: number
  total: number
  tipo: 'real' | 'modelo'
}

export interface NotaEstimada {
  /** treino + provas reais (a prova real vale 2 respostas de treino) */
  nota: number | null
  notaMinima: number | null
  faltaMedir: number
  /** só treinos e prova modelo: o número de antes */
  notaDoTreino: number | null
  fontes: FonteDaNota[]
  /** acerto em prova real por matéria (null = nenhuma questão dela em prova real) */
  acertoReal: Map<Id, { acerto: number; questoes: number }>
}

const PESO_DA_REAL = 2

/** As questões respondidas das provas reais, por matéria do edital. A prova
 *  em andamento entra com o que já foi respondido. */
function respostasReais(d: Dados): Map<Id, boolean[]> {
  const saida = new Map<Id, boolean[]>()
  for (const s of d.simulados) {
    if (!ehProvaReal(s)) continue
    s.questoes.forEach((q, i) => {
      if (s.respostas[i] === null || !q.materia) return
      const id = acharMateria(d, q.materia)
      if (!id) return
      saida.set(id, [...(saida.get(id) ?? []), s.respostas[i] === q.gabarito])
    })
  }
  return saida
}

/** A nota estimada (mockup "Meu edital enxuto", 27/11): a mesma conta da
 *  chance, mas cada matéria mistura o acerto do treino com o da prova real,
 *  que pesa o dobro. Prova feita pelo Claude é treino; prova da banca é o
 *  que mais se parece com o dia da prova. */
export function notaEstimada(d: Dados, e: Edital): NotaEstimada {
  const treino = chanceDeAprovacao(d, e)
  const reais = respostasReais(d)
  const acertoReal = new Map<Id, { acerto: number; questoes: number }>()
  for (const [id, r] of reais)
    acertoReal.set(id, { acerto: r.filter(Boolean).length / r.length, questoes: r.length })
  const misturado = new Map<Id, number | null>()
  for (const m of treino.materias) {
    const r = reais.get(m.materiaId) ?? []
    const certasTreino = m.acerto === null ? 0 : m.acerto * m.medidas
    const n = m.medidas + PESO_DA_REAL * r.length
    misturado.set(
      m.materiaId,
      n ? (certasTreino + PESO_DA_REAL * r.filter(Boolean).length) / n : null
    )
  }
  const conta = notaPorAcerto(e, (id) => misturado.get(id) ?? null)
  const fontes: FonteDaNota[] = d.simulados
    .filter((s) => ehProvaReal(s) || (s.prova && s.entregueEm))
    .map((s) => {
      const respondidas = s.respostas.filter((r) => r !== null).length
      const certas = s.questoes.filter((q, i) => s.respostas[i] === q.gabarito).length
      return {
        id: s.id,
        titulo: s.config.tema,
        acerto: respondidas ? certas / respondidas : 0,
        respondidas,
        total: s.questoes.length,
        tipo: ehProvaReal(s) ? ('real' as const) : ('modelo' as const)
      }
    })
    .filter((f) => f.respondidas > 0)
  return {
    nota: conta.nota,
    notaMinima: e.notaMinima ?? null,
    faltaMedir: conta.faltaMedir,
    notaDoTreino: treino.nota,
    fontes,
    acertoReal
  }
}

function notaPorAcerto(
  e: Edital,
  acerto: (materiaId: Id) => number | null
): { nota: number | null; faltaMedir: number } {
  const porPeso = new Map<number, number>()
  for (const x of e.materias) porPeso.set(x.peso, (porPeso.get(x.peso) ?? 0) + x.questoes)
  const somaPesos = [...porPeso.keys()].reduce((a, b) => a + b, 0)
  let vale = 0
  let soma = 0
  for (const x of e.materias) {
    const a = acerto(x.materiaId)
    if (a === null) continue
    const v = (x.questoes / porPeso.get(x.peso)!) * (x.peso / somaPesos)
    vale += v
    soma += v * a
  }
  return { nota: vale ? (soma / vale) * 10 : null, faltaMedir: 1 - vale }
}
