import { HABILIDADES } from './questoes'
import type { Nivel, Questao, Simulado } from './tipos'

export interface DesempenhoDoTopico {
  topico: string
  total: number
  erros: number
  /** acertou, mas marcou "p/ revisar": acerto com dúvida (v0.1.13+) */
  duvidas: number
  /** habilidades das questões erradas, da mais frequente para a menos */
  habilidades: string[]
}

export interface Diagnostico {
  total: number
  acertos: number
  pct: number
  mediaMs: number
  /** só das questões que têm marcador (v0.1.5+) */
  porTopico: DesempenhoDoTopico[]
  /** questões erradas (ou em branco) sem marcador: simulados antigos */
  erradasSemTopico: Questao[]
  /** acertadas com dúvida (marcadas) sem marcador */
  duvidasSemTopico: Questao[]
}

/** nome do grupo das questões sem marcador num simulado misto */
export const SEM_MARCADOR = 'Pontos das questões sem marcador listadas abaixo'

/** chave para juntar "Juros compostos" e "juros  compostos" */
const chave = (t: string): string => t.trim().replace(/\s+/g, ' ').toLowerCase()

export function diagnosticar(s: Simulado): Diagnostico {
  const total = s.questoes.length
  const grupos = new Map<string, DesempenhoDoTopico & { contagem: Map<string, number> }>()
  const erradasSemTopico: Questao[] = []
  const duvidasSemTopico: Questao[] = []
  let acertos = 0
  s.questoes.forEach((q, i) => {
    const certa = s.respostas[i] === q.gabarito
    // marcar "p/ revisar" e acertar = acerto com dúvida (ou chute): também reforça
    const duvida = certa && !!s.revisar[i]
    if (certa) acertos++
    if (!q.topico) {
      if (!certa) erradasSemTopico.push(q)
      if (duvida) duvidasSemTopico.push(q)
      return
    }
    const k = chave(q.topico)
    const g = grupos.get(k) ?? {
      topico: q.topico.trim(),
      total: 0,
      erros: 0,
      duvidas: 0,
      habilidades: [],
      contagem: new Map()
    }
    g.total++
    if (duvida) g.duvidas++
    if (!certa) {
      g.erros++
      if (q.habilidade) g.contagem.set(q.habilidade, (g.contagem.get(q.habilidade) ?? 0) + 1)
    }
    grupos.set(k, g)
  })
  // simulado misto (parte com marcador, parte sem): as sem marcador viram um
  // grupo próprio, para os erros delas também entrarem no reforço
  const semMarcador = s.questoes.filter((q) => !q.topico).length
  if (grupos.size && semMarcador) {
    grupos.set(chave(SEM_MARCADOR), {
      topico: SEM_MARCADOR,
      total: semMarcador,
      erros: erradasSemTopico.length,
      duvidas: duvidasSemTopico.length,
      habilidades: [],
      contagem: new Map()
    })
  }
  const porTopico = [...grupos.values()]
    .map(({ contagem, ...g }) => ({
      ...g,
      habilidades: [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h)
    }))
    .sort((a, b) => b.erros - a.erros || b.duvidas - a.duvidas || b.total - a.total)
  return {
    total,
    acertos,
    pct: total ? Math.round((acertos / total) * 100) : 0,
    mediaMs: total ? s.decorridoMs / total : 0,
    porTopico,
    erradasSemTopico,
    duvidasSemTopico
  }
}

export type AjusteDeNivel = 'descer' | 'manter' | 'subir'
const NIVEIS: Nivel[] = ['facil', 'medio', 'dificil']

/** ≥ 80% sobe, < 50% desce, no meio mantém */
export const ajusteSugerido = (pct: number): AjusteDeNivel =>
  pct >= 80 ? 'subir' : pct < 50 ? 'descer' : 'manter'

export function nivelAjustado(atual: Nivel, ajuste: AjusteDeNivel): Nivel {
  const i = NIVEIS.indexOf(atual) + (ajuste === 'subir' ? 1 : ajuste === 'descer' ? -1 : 0)
  return NIVEIS[Math.max(0, Math.min(NIVEIS.length - 1, i))]
}

/** parte do simulado novo que vai para os pontos em que errou */
export const PARTE_DE_REFORCO = 0.6

export interface ItemDoPlano {
  topico: string
  quantidade: number
  reforco: boolean
  erros: number
  duvidas: number
}

/** Reparte n proporcionalmente aos pesos, somando exatamente n (maiores restos). */
export function repartir(n: number, pesos: number[]): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0)
  if (n <= 0 || soma <= 0) return pesos.map(() => 0)
  const brutos = pesos.map((p) => (p / soma) * n)
  const inteiros = brutos.map(Math.floor)
  let falta = n - inteiros.reduce((a, b) => a + b, 0)
  const ordem = brutos.map((b, i) => [b - Math.floor(b), i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of ordem) {
    if (falta <= 0) break
    inteiros[i]++
    falta--
  }
  return inteiros
}

/** Quantas questões de cada tópico no simulado novo: 60% para os que errou
 *  (na proporção dos erros) e 40% para manter os outros (na proporção de
 *  quantas questões tinham). Sem erros ou sem os outros, tudo vai para um lado. */
export function planejar(d: Diagnostico, quantidade: number, insistir: boolean): ItemDoPlano[] {
  // acerto com dúvida pesa metade de um erro
  const peso = (t: DesempenhoDoTopico): number => t.erros + t.duvidas / 2
  const fracos = d.porTopico.filter((t) => peso(t) > 0)
  const fortes = d.porTopico.filter((t) => peso(t) === 0)
  if (!d.porTopico.length) return []
  const usarReforco = insistir && fracos.length > 0
  const nReforco = !usarReforco
    ? 0
    : fortes.length
      ? Math.round(quantidade * PARTE_DE_REFORCO)
      : quantidade
  const nManter = quantidade - nReforco
  const reforco = usarReforco ? repartir(nReforco, fracos.map(peso)) : []
  // sem reforço, todos os tópicos repartem a quantidade inteira
  const paraManter = usarReforco ? fortes : d.porTopico
  const manter = repartir(
    nManter,
    paraManter.map((t) => t.total)
  )
  return (
    [
      ...fracos.map((t, i) => ({
        topico: t.topico,
        quantidade: reforco[i] ?? 0,
        reforco: true,
        erros: t.erros,
        duvidas: t.duvidas
      })),
      ...paraManter.map((t, i) => ({
        topico: t.topico,
        quantidade: manter[i],
        reforco: false,
        erros: t.erros,
        duvidas: t.duvidas
      }))
    ]
      .filter((x) => x.quantidade > 0)
      // sem reforço, um tópico com erro aparece só uma vez (na manutenção)
      .filter((x, i, todos) => todos.findIndex((y) => chave(y.topico) === chave(x.topico)) === i)
  )
}

export type Foco = 'equilibrado' | 'edital' | 'base'

export interface OpcoesAdaptadas {
  quantidade: number
  insistir: boolean
  foco: Foco
  edital: string
  banca: string
  ajuste: AjusteDeNivel
}

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`

/** O bloco <adaptacao> que entra no prompt normal. O formato do JSON e a
 *  entrega do arquivo continuam os do montarPrompt. */
export function blocoDeAdaptacao(
  d: Diagnostico,
  o: OpcoesAdaptadas,
  /** nomes de tópicos já usados em simulados anteriores do tema */
  topicosConhecidos: string[]
): string {
  const linhas: string[] = []
  linhas.push(
    `No último simulado deste tema o estudante acertou ${d.acertos} de ${d.total} (${d.pct}%).`
  )

  const plano = planejar(d, o.quantidade, o.insistir)
  const reforco = plano.filter((p) => p.reforco)
  if (plano.length) {
    linhas.push('', `Distribua as ${o.quantidade} questões assim:`)
    for (const p of plano) {
      const info = p.reforco
        ? ` — REFORÇO: ${[
            p.erros && `ele errou ${plural(p.erros, 'questão', 'questões')}`,
            p.duvidas &&
              `acertou ${plural(p.duvidas, 'questão', 'questões')} com dúvida (marcou para revisar)`
          ]
            .filter(Boolean)
            .join(' e ')}${habilidadesDe(d, p.topico)}`
        : ''
      linhas.push(`- ${p.topico}: ${plural(p.quantidade, 'questão', 'questões')}${info}`)
    }
  }
  if (reforco.length) {
    linhas.push(
      '',
      'Nas questões de REFORÇO: cubra os pontos em que ele errou com questões parecidas, mas nunca iguais, variando o ângulo de cobrança.',
      'Nelas, faça o "conceito" mais completo: 4 a 5 frases e um exemplo concreto.'
    )
  }
  const listarErradas = (): void => {
    const lista = [
      ...d.erradasSemTopico.map((q) => ({ q, nota: '' })),
      ...d.duvidasSemTopico.map((q) => ({ q, nota: ' [acertou com dúvida]' }))
    ]
    for (const { q, nota } of lista.slice(0, 15)) {
      const resumo = q.enunciado.replace(/\s+/g, ' ').slice(0, 180)
      linhas.push(
        `- "${resumo}${q.enunciado.length > 180 ? '…' : ''}"${nota}${q.conceito ? ` (conceito: ${q.conceito.slice(0, 160)})` : ''}`
      )
    }
  }
  if (reforco.some((p) => p.topico === SEM_MARCADOR)) {
    linhas.push('', 'Questões sem marcador que ele errou (base do reforço acima):')
    listarErradas()
  }
  if (o.insistir && !plano.length && d.erradasSemTopico.length + d.duvidasSemTopico.length) {
    const n = Math.round(o.quantidade * PARTE_DE_REFORCO)
    linhas.push(
      '',
      `Faça cerca de ${n} das ${o.quantidade} questões sobre os mesmos pontos destas que ele errou (parecidas, nunca iguais), com o "conceito" mais completo (4 a 5 frases e um exemplo). As demais, sobre o restante do tema:`
    )
    listarErradas()
  }

  linhas.push(
    '',
    o.ajuste === 'manter'
      ? 'Mantenha a dificuldade.'
      : o.ajuste === 'subir'
        ? 'Ele foi bem: aumente a dificuldade em relação ao último simulado.'
        : 'Ele teve dificuldade: diminua um pouco a dificuldade, priorizando entender a regra.'
  )

  if (o.foco === 'edital') {
    const banca = o.banca.trim()
    linhas.push(
      '',
      `Foco: cobre como ${banca ? `a banca ${banca}` : 'as bancas de concurso'} costuma cobrar, com o mesmo estilo de enunciado e de pegadinha.`
    )
    const edital = o.edital.trim()
    if (edital)
      linhas.push(
        `Siga este conteúdo do edital, sem sair dele:\n"""\n${edital.slice(0, 4000)}\n"""`
      )
  } else if (o.foco === 'base') {
    linhas.push(
      '',
      'Foco: base teórica. Priorize conceitos, definições e regras fundamentais, com questões que testem entendimento, e não decoreba de detalhe.'
    )
  }

  const nomes = [...new Set([...d.porTopico.map((t) => t.topico), ...topicosConhecidos])].filter(
    (n) => n !== SEM_MARCADOR
  )
  if (nomes.length) {
    linhas.push(
      '',
      `Use em "topico" um destes nomes quando servir: ${nomes.join('; ')}. Só crie um nome novo se nenhum servir.`
    )
  }
  linhas.push(`"habilidade" deve ser uma destas: ${HABILIDADES.join('; ')}.`)
  return linhas.join('\n')
}

function habilidadesDe(d: Diagnostico, topico: string): string {
  const t = d.porTopico.find((x) => chave(x.topico) === chave(topico))
  return t?.habilidades.length ? ` (habilidade: ${t.habilidades.join(', ')})` : ''
}
