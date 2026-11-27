import { acharNo } from './arvore'
import { acertos } from './questoes'
import type { Dados, Simulado } from './tipos'

/** Os simulados como a tela Questões mostra (mockup "Questões enxuto",
 *  aprovado em 27/11): primeiro o que está pela metade, depois as provas,
 *  depois os treinos agrupados por matéria. */
export interface GrupoDeTreinos {
  nome: string
  /** do mais antigo ao mais novo */
  simulados: Simulado[]
  /** % de acerto de cada um, na mesma ordem */
  pcts: number[]
}

export const pctDe = (s: Simulado): number =>
  s.questoes.length ? Math.round((acertos(s.questoes, s.respostas) / s.questoes.length) * 100) : 0

export const ehProva = (s: Simulado): boolean => !!s.prova || /^prova real\b/i.test(s.config.tema)

const OUTROS = 'Outros'

/** a matéria do simulado: a que ele foi gerado; senão, a das questões (se
 *  todas forem da mesma) */
export function materiaDoSimulado(d: Dados, s: Simulado): string {
  const porId = s.config.materiaId
    ? d.materias.find((m) => m.id === s.config.materiaId)?.nome
    : acharNo(d, s.config.assuntoId)?.materia.nome
  if (porId) return porId
  const nas = new Set(s.questoes.map((q) => q.materia?.trim()).filter(Boolean))
  return nas.size === 1 ? [...nas][0]! : OUTROS
}

export function historico(d: Dados): {
  emAndamento: Simulado[]
  provas: Simulado[]
  treinos: GrupoDeTreinos[]
} {
  const recentes = [...d.simulados].sort((a, b) => b.criadoEm - a.criadoEm)
  const emAndamento = recentes.filter((s) => !s.entregueEm)
  const provas = recentes.filter((s) => s.entregueEm && ehProva(s))
  const grupos = new Map<string, Simulado[]>()
  for (const s of [...recentes].reverse()) {
    if (!s.entregueEm || ehProva(s)) continue
    const nome = materiaDoSimulado(d, s)
    grupos.set(nome, [...(grupos.get(nome) ?? []), s])
  }
  // a matéria treinada por último primeiro; "Outros" no fim
  const treinos = [...grupos.entries()]
    .map(([nome, simulados]) => ({ nome, simulados, pcts: simulados.map(pctDe) }))
    .sort(
      (a, b) =>
        Number(a.nome === OUTROS) - Number(b.nome === OUTROS) ||
        b.simulados[b.simulados.length - 1].criadoEm - a.simulados[a.simulados.length - 1].criadoEm
    )
  return { emAndamento, provas, treinos }
}
