import { montarPrompt } from './questoes'
import { semAcento } from './texto'
import type {
  Dados,
  Edital,
  IaDestino,
  Id,
  MateriaNaProva,
  ProvaEmMontagem,
  Questao,
  Simulado
} from './tipos'

/** maior bloco pedido de uma vez: a IA costuma travar ou cortar acima disso */
export const BLOCO_MAX = 30

type MateriaDoBloco = ProvaEmMontagem['blocos'][number]['materias'][number]

/** Divide a prova em pedidos à IA sem partir uma matéria: cada prova (grupo
 *  de mesmo peso) vira blocos de tamanho parecido, de até BLOCO_MAX.
 *  Banestes: Gerais 30 → 1 bloco; Específicos 40 → 20 + 20. */
export function blocosDaProva(d: Dados, e: Edital): ProvaEmMontagem['blocos'] {
  const nome = (id: Id): string => d.materias.find((m) => m.id === id)?.nome ?? '?'
  const pesos = [...new Set(e.materias.map((m) => m.peso))]
  const blocos: ProvaEmMontagem['blocos'] = []
  for (const peso of pesos) {
    const doGrupo = e.materias.filter((m) => m.peso === peso)
    const total = doGrupo.reduce((n, m) => n + m.questoes, 0)
    const alvo = Math.ceil(total / Math.ceil(total / BLOCO_MAX))
    let atual: MateriaDoBloco[] = []
    let soma = 0
    for (const m of doGrupo) {
      if (atual.length && soma + m.questoes > alvo) {
        blocos.push({ materias: atual, questoes: null })
        atual = []
        soma = 0
      }
      atual.push({ materiaId: m.materiaId, nome: nome(m.materiaId), questoes: m.questoes, peso })
      soma += m.questoes
    }
    if (atual.length) blocos.push({ materias: atual, questoes: null })
  }
  return blocos
}

/** o pedido à IA de um bloco: as matérias na ordem, o número de questões de
 *  cada uma, o campo "materia" e o conteúdo do edital de cada matéria */
export function promptDoBloco(
  e: Edital,
  blocos: ProvaEmMontagem['blocos'],
  indice: number,
  ia: IaDestino
): string {
  const b = blocos[indice]
  const total = b.materias.reduce((n, m) => n + m.questoes, 0)
  const textoDe = (id: Id): string => e.materias.find((m) => m.materiaId === id)?.texto ?? ''
  const linhas = [
    `Esta é a parte ${indice + 1} de ${blocos.length} de uma prova completa${e.banca ? ` da ${e.banca}` : ''} para "${e.nome}", no formato do edital.`,
    'Faça as questões exatamente nesta quantidade e nesta ordem (todas as de uma matéria juntas):',
    ...b.materias.map(
      (m) => `- ${m.nome}: ${m.questoes} ${m.questoes === 1 ? 'questão' : 'questões'}`
    ),
    `Em cada questão, preencha também "materia" com o nome exato da matéria, um destes: ${b.materias.map((m) => `"${m.nome}"`).join(', ')}.`,
    'Dificuldade de prova real, variando os itens do conteúdo de cada matéria.',
    '',
    'Conteúdo programático de cada matéria, segundo o edital (não saia dele):',
    ...b.materias.map((m) => `${m.nome}: """${textoDe(m.materiaId).slice(0, 2500)}"""`)
  ]
  return montarPrompt(
    {
      tema: `${e.nome} — prova completa, parte ${indice + 1} (${b.materias.map((m) => m.nome).join(', ')})`,
      assuntoId: null,
      nivel: 'medio',
      tipo: 'multipla',
      quantidade: total,
      tempoMin: 0,
      banca: e.banca
    },
    ia,
    linhas.join('\n')
  )
}

/** Põe as questões que a IA mandou na ordem das matérias do bloco. Usa o
 *  campo "materia"; se a IA não preencheu (ou errou o nome), vale a ordem em
 *  que vieram. Devolve as que sobraram fora de alguma matéria como erro. */
export function ordenarBloco(
  materias: MateriaDoBloco[],
  questoes: Questao[]
): { ok: true; questoes: Questao[]; porMateria: number[] } | { ok: false; erro: string } {
  const indice = (q: Questao): number =>
    q.materia ? materias.findIndex((m) => semAcento(m.nome) === semAcento(q.materia!)) : -1
  const todasMarcadas = questoes.every((q) => indice(q) >= 0)
  if (todasMarcadas) {
    // cada matéria com a quantidade pedida: a menos mudaria o tamanho e o
    // peso da prova; a mais, as primeiras valem e o resto fica de fora
    const grupos = materias.map((_, i) => questoes.filter((q) => indice(q) === i))
    const curta = materias.findIndex((m, i) => grupos[i].length < m.questoes)
    if (curta >= 0)
      return {
        ok: false,
        erro: `${materias[curta].nome}: vieram ${grupos[curta].length} de ${materias[curta].questoes} questões. Peça de novo à IA.`
      }
    const certas = grupos.map((g, i) => g.slice(0, materias[i].questoes))
    return { ok: true, questoes: certas.flat(), porMateria: certas.map((g) => g.length) }
  }
  // sem o campo: confia na ordem, se a quantidade bater
  const esperadas = materias.reduce((n, m) => n + m.questoes, 0)
  if (questoes.length !== esperadas)
    return {
      ok: false,
      erro: `Vieram ${questoes.length} questões sem dizer a matéria; o bloco pede ${esperadas}. Peça de novo à IA.`
    }
  return { ok: true, questoes, porMateria: materias.map((m) => m.questoes) }
}

/** A montagem salva, se ainda for deste edital (mesmas matérias, quantidades
 *  e pesos); se o edital mudou, uma nova, do zero. */
export function montagemDaProva(d: Dados, e: Edital): ProvaEmMontagem {
  const blocos = blocosDaProva(d, e)
  const forma = (b: ProvaEmMontagem['blocos']): string =>
    JSON.stringify(b.map((x) => x.materias.map((m) => [m.materiaId, m.questoes, m.peso])))
  const salva = d.provaEmMontagem
  return salva && forma(salva.blocos) === forma(blocos) ? salva : { criadoEm: 0, blocos }
}

/** a prova pronta para fazer, com as questões na ordem do edital */
export function simuladoDaProva(
  e: Edital,
  montagem: ProvaEmMontagem,
  id: Id,
  agora: number
): Simulado | null {
  if (montagem.blocos.some((b) => !b.questoes)) return null
  const questoes: Questao[] = []
  const materias: MateriaNaProva[] = []
  for (const b of montagem.blocos) {
    const ordem = ordenarBloco(b.materias, b.questoes!)
    if (!ordem.ok) return null
    b.materias.forEach((m, i) => {
      const de = questoes.length + ordem.porMateria.slice(0, i).reduce((n, x) => n + x, 0)
      materias.push({
        materiaId: m.materiaId,
        nome: m.nome,
        peso: m.peso,
        de,
        ate: de + ordem.porMateria[i]
      })
    })
    questoes.push(...ordem.questoes)
  }
  const n = questoes.length
  return {
    id,
    config: {
      tema: `Prova completa · ${e.nome}`,
      assuntoId: null,
      nivel: 'medio',
      tipo: 'multipla',
      quantidade: n,
      // a duração do edital; sem ela, ~3,4 min por questão (a média da FCC)
      tempoMin: e.duracaoMin ?? Math.round(n * 3.4),
      banca: e.banca
    },
    questoes,
    respostas: Array(n).fill(null),
    revisar: Array(n).fill(false),
    tempoPorQuestao: Array(n).fill(0),
    decorridoMs: 0,
    atual: 0,
    criadoEm: agora,
    entregueEm: null,
    prova: { materias, notaMinima: e.notaMinima }
  }
}

export interface NotaDaProva {
  /** uma por peso (Gerais ×1, Específicos ×2), escala 0–10 */
  provas: { peso: number; acertos: number; total: number; nota: number }[]
  /** média ponderada pelos pesos, 0–10 */
  final: number
  passaria: boolean | null
  porMateria: (MateriaNaProva & { acertos: number; total: number; perdido: number })[]
}

/** A nota como a banca calcula: cada prova vale 0–10 e a final é a média
 *  ponderada pelo peso de cada prova. "perdido" é quanto da nota final a
 *  matéria custou (para mostrar primeiro o que mais pesou). */
export function notaDaProva(s: Simulado): NotaDaProva | null {
  if (!s.prova) return null
  const certa = (i: number): boolean => s.respostas[i] === s.questoes[i]?.gabarito
  const porMateria = s.prova.materias.map((m) => {
    let acertos = 0
    for (let i = m.de; i < m.ate; i++) if (certa(i)) acertos++
    return { ...m, acertos, total: m.ate - m.de, perdido: 0 }
  })
  const pesos = [...new Set(porMateria.map((m) => m.peso))]
  const somaDosPesos = pesos.reduce((a, p) => a + p, 0)
  const provas = pesos.map((peso) => {
    const doPeso = porMateria.filter((m) => m.peso === peso)
    const acertos = doPeso.reduce((n, m) => n + m.acertos, 0)
    const total = doPeso.reduce((n, m) => n + m.total, 0)
    return { peso, acertos, total, nota: total ? (acertos / total) * 10 : 0 }
  })
  for (const m of porMateria) {
    const p = provas.find((x) => x.peso === m.peso)!
    // cada questão errada tira 10/total da prova, e a prova pesa peso/soma na final
    m.perdido = p.total ? ((m.total - m.acertos) * (10 / p.total) * m.peso) / somaDosPesos : 0
  }
  const final = provas.reduce((n, p) => n + p.nota * p.peso, 0) / (somaDosPesos || 1)
  return {
    provas,
    final,
    passaria: s.prova.notaMinima === undefined ? null : final >= s.prova.notaMinima,
    porMateria: [...porMateria].sort((a, b) => b.perdido - a.perdido)
  }
}
