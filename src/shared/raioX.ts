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
  /** quantas vezes o seu tempo médio (tempo ÷ média); null sem tempo medido */
  vezes: number | null
}

export interface RaioX {
  itens: ItemDoRaioX[]
  porFaixa: Record<Faixa, ItemDoRaioX[]>
  /** tempo médio por questão, em ms (o mesmo número do topo do resultado);
   *  null se o simulado não mediu tempo */
  ritmo: number | null
  certas: number
  frase: string
}

/** "demorou" = mais que o dobro do seu tempo médio no mesmo simulado */
const DEMOROU = 2

// ponytail: um número de tempo só na tela. A média (e não a mediana, que é
// mais robusta) porque é o que o topo do resultado mostra: dois números
// diferentes para "seu tempo" confundiam (pedido do dono, 24/11).
const media = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

const juntar = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`

/** Lê o simulado entregue pelo tempo e pelo acerto de cada questão. Sem tempo
 *  medido (simulados antigos), não chuta: errada vira lacuna e só a dúvida
 *  marcada faz a certa ficar frágil. */
export function raioX(s: Simulado): RaioX {
  const tempos = s.tempoPorQuestao.filter((t) => t > 0)
  const comTempo = tempos.length >= Math.ceil(s.questoes.length / 2)
  const ritmo = comTempo ? media(tempos) : null
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

export interface ErroDoRaioX {
  indice: number
  topico: string
  /** o texto da alternativa marcada (null = em branco) e o da certa */
  marcada: string | null
  certa: string
  ms: number
  /** errou abaixo do seu tempo médio: pressa, achou que sabia */
  rapido: boolean
  /** o comentário da alternativa marcada (o engano que dá aquele número) */
  motivo: string | null
}

export interface TopicoDoRaioX {
  topico: string
  certas: number
  total: number
}

export interface Diagnostico {
  frase: string
  pontos: string[]
  /** do pior para o melhor acerto */
  topicos: TopicoDoRaioX[]
  erros: ErroDoRaioX[]
  inseguras: ItemDoRaioX[]
  firmes: number
}

const aspas = (t: string): string => `“${t}”`
const sem = (t: string): string => t.trim().replace(/[.;]$/, '')

/** O que o simulado mostrou, com a prova: o padrão por tópico, por pressa e
 *  pela troca de assunto, e cada erro com o engano que deu aquele número. */
export function diagnostico(s: Simulado, r: RaioX): Diagnostico {
  const certo = (i: number): boolean => s.respostas[i] === s.questoes[i].gabarito
  const porTopico = new Map<string, TopicoDoRaioX>()
  for (const x of r.itens) {
    const k = semAcento(x.topico)
    const t = porTopico.get(k) ?? { topico: x.topico, certas: 0, total: 0 }
    t.total++
    if (certo(x.indice)) t.certas++
    porTopico.set(k, t)
  }
  const topicos = [...porTopico.values()].sort(
    (a, b) => a.certas / a.total - b.certas / b.total || b.total - a.total
  )
  const erros: ErroDoRaioX[] = r.itens
    .filter((x) => x.faixa === 'engano' || x.faixa === 'lacuna')
    .map((x) => {
      const q = s.questoes[x.indice]
      const m = s.respostas[x.indice]
      const texto = (l: string | null): string | null =>
        l ? (q.alternativas.find((a) => a.letra === l)?.texto ?? null) : null
      return {
        indice: x.indice,
        topico: x.topico,
        marcada: m ? sem(texto(m) ?? m) : null,
        certa: sem(texto(q.gabarito) ?? q.gabarito),
        ms: x.ms,
        rapido: x.faixa === 'engano',
        motivo: (m && q.comentarios?.[m]?.trim()) || null
      }
    })
  const inseguras = r.porFaixa.fragil
  const total = s.questoes.length

  let frase: string
  const comVarias = topicos.filter((t) => t.total >= 2)
  const pior = comVarias[0]
  const melhor = comVarias[comVarias.length - 1]
  const rapidos = erros.filter((e) => e.rapido).length
  if (!erros.length)
    frase = inseguras.length
      ? `Acertou todas, mas ${inseguras.length} ${inseguras.length === 1 ? 'com insegurança' : 'com insegurança'}: reveja-as antes que virem erro.`
      : 'Tudo firme: acertou todas, no seu tempo e sem dúvida.'
  else if (
    pior &&
    melhor &&
    pior !== melhor &&
    melhor.certas / melhor.total - pior.certas / pior.total >= 0.2
  )
    // "firme" só com 80% ou mais; abaixo disso, é só o melhor que o pior
    frase =
      melhor.certas / melhor.total >= 0.8
        ? `Em ${aspas(melhor.topico)} você está firme (${melhor.certas}/${melhor.total}). Onde perde ponto: ${aspas(pior.topico)} (${pior.certas}/${pior.total}).`
        : `Onde mais perde ponto: ${aspas(pior.topico)} (${pior.certas}/${pior.total}). O melhor foi ${aspas(melhor.topico)} (${melhor.certas}/${melhor.total}), ainda abaixo de 80%.`
  else if (rapidos * 2 >= erros.length && rapidos >= 2)
    frase = `Você sabe mais do que o placar mostra: ${rapidos} dos ${erros.length} erros foram rápidos, por pressa.`
  else
    frase = `Acertou ${r.certas} de ${total}. Os erros pedem estudo de ${juntar([...new Set(erros.map((e) => aspas(e.topico)))].slice(0, 2))}.`

  const pontos: string[] = []
  // a troca de assunto entre uma questão e a seguinte (o efeito do treino em bloco)
  const troca = { c: 0, n: 0 }
  const repete = { c: 0, n: 0 }
  for (let i = 1; i < total; i++) {
    const alvo = semAcento(r.itens[i].topico) === semAcento(r.itens[i - 1].topico) ? repete : troca
    alvo.n++
    if (certo(i)) alvo.c++
  }
  if (troca.n >= 4 && repete.n >= 4 && repete.c / repete.n - troca.c / troca.n >= 0.25)
    pontos.push(
      `Quando o assunto muda de uma questão para a seguinte, você acerta ${troca.c} de ${troca.n}; quando repete, ${repete.c} de ${repete.n}. Treine com os assuntos misturados.`
    )
  if (rapidos)
    pontos.push(
      `${rapidos} ${rapidos === 1 ? 'erro foi rápido' : 'erros foram rápidos'} (abaixo do seu tempo médio): confira o que a questão pede antes de marcar.`
    )
  const lentos = erros.length - rapidos
  if (lentos)
    pontos.push(
      r.ritmo === null
        ? `${lentos} ${lentos === 1 ? 'erro' : 'erros'}: aí é conteúdo a estudar (este simulado não mediu o tempo).`
        : `${lentos} ${lentos === 1 ? 'erro' : 'erros'} com tempo de sobra ou em branco: aí é conteúdo a estudar.`
    )
  if (inseguras.length)
    pontos.push(
      `${inseguras.length} ${inseguras.length === 1 ? 'acerto inseguro' : 'acertos inseguros'} (mais que o dobro do seu tempo médio, ou com dúvida).`
    )
  return { frase, pontos, topicos, erros, inseguras, firmes: r.porFaixa.domina.length }
}
