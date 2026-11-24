import type { RaioX } from './raioX'
import type { Dados, Explicacao, Questao, Retorno, Simulado, Veredito } from './tipos'
import { semAcento } from './texto'

export type SituacaoDaExplicacao = 'esperando' | Veredito

/** O retorno que vale para a explicação: o do texto que está lá agora. Se você
 *  reescreveu depois da avaliação, o retorno antigo não conta (esperando). */
export function retornoDe(d: Dados, x: Explicacao): Retorno | null {
  const texto = x.texto.trim()
  const doTexto = (d.retornos ?? []).filter(
    (r) => r.explicacaoId === x.id && r.textoAvaliado.trim() === texto
  )
  return doTexto.sort((a, b) => b.criadoEm - a.criadoEm)[0] ?? null
}

export function situacaoDe(d: Dados, x: Explicacao): SituacaoDaExplicacao {
  return retornoDe(d, x)?.veredito ?? 'esperando'
}

export function placarDeExplicacoes(d: Dados): Record<SituacaoDaExplicacao, number> {
  const p: Record<SituacaoDaExplicacao, number> = { certo: 0, quase: 0, revisar: 0, esperando: 0 }
  for (const x of d.explicacoes ?? []) if (x.texto.trim()) p[situacaoDe(d, x)]++
  return p
}

/** Junta os retornos que chegaram da nuvem (sem repetir). Devolve se mudou. */
export function mesclarRetornos(d: Dados, novos: Retorno[]): boolean {
  const atuais = d.retornos ?? []
  const chave = (r: Retorno): string => `${r.explicacaoId}\u0000${r.textoAvaliado.trim()}`
  const vistos = new Map(atuais.map((r) => [chave(r), r]))
  let mudou = false
  for (const r of novos) {
    const ja = vistos.get(chave(r))
    // o mais novo vence: a nuvem manda do mais novo ao mais velho
    if (
      ja &&
      (ja.criadoEm > r.criadoEm ||
        (ja.criadoEm === r.criadoEm && ja.veredito === r.veredito && ja.texto === r.texto))
    )
      continue
    vistos.set(chave(r), r)
    mudou = true
  }
  if (mudou) d.retornos = [...vistos.values()]
  return mudou
}

export interface PedidoDeExplicar {
  /** a questão que puxou o pedido (a primeira do conceito) */
  indice: number
  /** todas as questões deste simulado que pediram este conceito */
  indices: number[]
  topico: string
  pergunta: string
  motivo: string
}

/** A pergunta é sobre o CONCEITO, não sobre a questão: a do conteúdo, ou uma
 *  geral do tópico. A mesma pergunta volta em outros simulados até virar "Certo". */
export const perguntaDoConceito = (q: Questao, topico: string): string =>
  q.explicar ??
  `O que é ${topico} e como você reconhece e resolve uma questão desse tipo? Explique a ideia com suas palavras e um exemplo seu.`

const mesmaPergunta = (a: string, b: string): boolean => semAcento(a.trim()) === semAcento(b.trim())

/** A sua explicação de um conceito (vale para todos os simulados) */
export const explicacaoDoConceito = (d: Dados, pergunta: string): Explicacao | undefined =>
  (d.explicacoes ?? []).find((x) => !x.simuladoId && mesmaPergunta(x.pergunta, pergunta))

const MOTIVO = { lacuna: 'errou', engano: 'errou rápido', fragil: 'acertou com dúvida' } as const

/** Depois do simulado: até 3 conceitos para explicar, do que mais pede (não
 *  sabia, errou achando que sabia, acertou inseguro). Um pedido por conceito,
 *  com as questões que o puxaram; conceito já explicado "Certo" não volta. */
export function pedidosDeExplicar(s: Simulado, r: RaioX, d?: Dados, max = 3): PedidoDeExplicar[] {
  const grupos = new Map<string, PedidoDeExplicar & { faixas: (keyof typeof MOTIVO)[] }>()
  for (const faixa of ['lacuna', 'engano', 'fragil'] as const)
    for (const x of r.porFaixa[faixa]) {
      const pergunta = perguntaDoConceito(s.questoes[x.indice], x.topico)
      const chave = semAcento(pergunta.trim())
      const g = grupos.get(chave)
      if (g) {
        g.indices.push(x.indice)
        g.faixas.push(faixa)
        continue
      }
      if (
        d &&
        explicacaoDoConceito(d, pergunta) &&
        situacaoDe(d, explicacaoDoConceito(d, pergunta)!) === 'certo'
      )
        continue
      grupos.set(chave, {
        indice: x.indice,
        indices: [x.indice],
        topico: x.topico,
        pergunta,
        motivo: '',
        faixas: [faixa]
      })
    }
  return [...grupos.values()].slice(0, max).map(({ faixas, ...p }) => {
    const partes = (['lacuna', 'engano', 'fragil'] as const)
      .map((f) => {
        const nums = p.indices.filter((_, i) => faixas[i] === f).map((i) => i + 1)
        if (!nums.length) return ''
        const lista =
          nums.length > 4
            ? `${nums.slice(0, 3).join(', ')} e mais ${nums.length - 3}`
            : nums.length > 1
              ? `${nums.slice(0, -1).join(', ')} e ${nums.at(-1)}`
              : `${nums[0]}`
        return `${MOTIVO[f]} a ${lista}`
      })
      .filter(Boolean)
    const texto = partes.join('; ')
    return { ...p, motivo: texto[0].toUpperCase() + texto.slice(1) }
  })
}
