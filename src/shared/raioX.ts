import { semAcento } from './texto'
import type { Simulado } from './tipos'

/** domina: certa, no seu ritmo, sem dúvida · frágil: certa, mas demorou ou
 *  marcou dúvida · engano: errou rápido (acha que sabe) · lacuna: errou e
 *  demorou, ou deixou em branco (não sabia) */
export type Faixa = 'domina' | 'fragil' | 'engano' | 'lacuna'

export interface ItemDoRaioX {
  indice: number
  topico: string
  faixa: Faixa
  ms: number
  duvida: boolean
  /** quantas vezes o seu ritmo (tempo ÷ mediana); null sem tempo medido */
  vezes: number | null
}

export interface RaioX {
  itens: ItemDoRaioX[]
  porFaixa: Record<Faixa, ItemDoRaioX[]>
  /** mediana do tempo por questão, em ms; null se o simulado não mediu tempo */
  ritmo: number | null
  certas: number
  frase: string
}

/** "demorou" = mais que o dobro do seu ritmo no mesmo simulado */
const DEMOROU = 2

const mediana = (xs: number[]): number => {
  const v = [...xs].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

const juntar = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`

/** Lê o simulado entregue pelo tempo e pelo acerto de cada questão. Sem tempo
 *  medido (simulados antigos), não chuta: errada vira lacuna e só a dúvida
 *  marcada faz a certa ficar frágil. */
export function raioX(s: Simulado): RaioX {
  const tempos = s.tempoPorQuestao.filter((t) => t > 0)
  const comTempo = tempos.length >= Math.ceil(s.questoes.length / 2)
  const ritmo = comTempo ? mediana(tempos) : null
  const itens: ItemDoRaioX[] = s.questoes.map((q, i) => {
    const ms = s.tempoPorQuestao[i] ?? 0
    const duvida = !!s.revisar[i]
    const vezes = ritmo && ms > 0 ? ms / ritmo : null
    const resposta = s.respostas[i]
    const faixa: Faixa =
      resposta === q.gabarito
        ? duvida || (vezes !== null && vezes > DEMOROU)
          ? 'fragil'
          : 'domina'
        : resposta !== null && vezes !== null && vezes < 1
          ? 'engano'
          : 'lacuna'
    return { indice: i, topico: q.topico?.trim() || 'Sem tópico', faixa, ms, duvida, vezes }
  })
  const porFaixa: Record<Faixa, ItemDoRaioX[]> = { domina: [], fragil: [], engano: [], lacuna: [] }
  for (const x of itens) porFaixa[x.faixa].push(x)
  const certas = porFaixa.domina.length + porFaixa.fragil.length
  return { itens, porFaixa, ritmo, certas, frase: fraseDoRaioX(itens, certas) }
}

/** A frase do topo: o que o número de acertos esconde. */
function fraseDoRaioX(itens: ItemDoRaioX[], certas: number): string {
  const problemas = itens.filter((x) => x.faixa !== 'domina')
  if (!problemas.length) return 'Tudo firme: acertou no seu ritmo, sem dúvida.'
  // tópico com mais de um sinal (erro, engano ou acerto inseguro) é lacuna escondida
  const conta = new Map<string, { nome: string; n: number }>()
  for (const x of problemas) {
    const k = semAcento(x.topico)
    conta.set(k, { nome: x.topico, n: (conta.get(k)?.n ?? 0) + 1 })
  }
  const repetidos = [...conta.values()].filter((t) => t.n > 1).sort((a, b) => b.n - a.n)
  const naoSabia = [
    ...new Set(itens.filter((x) => x.faixa === 'lacuna').map((x) => x.topico))
  ].filter((t) => !repetidos.some((r) => r.nome === t))
  const enganos = [
    ...new Set(itens.filter((x) => x.faixa === 'engano').map((x) => x.topico))
  ].filter((t) => !repetidos.some((r) => r.nome === t))
  const bastante = certas / itens.length >= 0.7
  const partes: string[] = []
  if (repetidos.length)
    partes.push(
      `${bastante ? 'Acertou bastante, mas mostrou lacuna em' : 'Mais erros em'} ${juntar(repetidos.slice(0, 2).map((t) => t.nome))}.`
    )
  if (naoSabia.length)
    partes.push(
      `${partes.length ? 'Você não sabia' : bastante ? 'Acertou bastante, mas não sabia' : 'Não sabia'} ${juntar(naoSabia.slice(0, 3))}.`
    )
  if (enganos.length)
    partes.push(`Cuidado com ${juntar(enganos.slice(0, 2))}: errou rápido, achando que sabia.`)
  if (!partes.length) {
    const inseguros = [...new Set(problemas.map((x) => x.topico))]
    partes.push(`Acertou, mas sem firmeza em ${juntar(inseguros.slice(0, 3))}.`)
  }
  return partes.join(' ')
}

/** Tempo por questão que a prova dá, em ms (edital: duração ÷ questões). */
export function ritmoDaProva(duracaoMin: number, questoes: number): number {
  return (duracaoMin * 60000) / Math.max(1, questoes)
}
