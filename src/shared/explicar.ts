import type { RaioX } from './raioX'
import type { Dados, Explicacao, Retorno, Simulado, Veredito } from './tipos'

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
    if (ja && ja.veredito === r.veredito && ja.texto === r.texto) continue
    vistos.set(chave(r), r)
    mudou = true
  }
  if (mudou) d.retornos = [...vistos.values()]
  return mudou
}

export interface PedidoDeExplicar {
  indice: number
  topico: string
  pergunta: string
  motivo: string
}

/** Depois do simulado: até 3 conceitos para explicar, do que mais pede
 *  (não sabia, errou achando que sabia, acertou inseguro), um por tópico. */
export function pedidosDeExplicar(s: Simulado, r: RaioX, max = 3): PedidoDeExplicar[] {
  const ordem: { faixa: 'lacuna' | 'engano' | 'fragil'; motivo: string }[] = [
    { faixa: 'lacuna', motivo: 'Você errou' },
    { faixa: 'engano', motivo: 'Errou rápido, achando que sabia' },
    { faixa: 'fragil', motivo: 'Acertou, mas com dúvida' }
  ]
  const saida: PedidoDeExplicar[] = []
  const topicos = new Set<string>()
  const pedir = (x: { indice: number; topico: string }, motivo: string): void => {
    const q = s.questoes[x.indice]
    topicos.add(x.topico)
    saida.push({
      indice: x.indice,
      topico: x.topico,
      motivo,
      pergunta:
        q.explicar ??
        `Explique com suas palavras esta questão de ${x.topico}: o que ela cobra e como se chega na resposta certa.`
    })
  }
  // 1ª volta: um por tópico; 2ª (treino de um tópico só): outras questões que
  // trazem a própria pergunta, para não pedir duas vezes a mesma coisa
  for (const volta of [1, 2])
    for (const { faixa, motivo } of ordem)
      for (const x of r.porFaixa[faixa]) {
        if (saida.length >= max) return saida
        if (saida.some((p) => p.indice === x.indice)) continue
        if (volta === 1 && topicos.has(x.topico)) continue
        if (volta === 2 && !s.questoes[x.indice].explicar) continue
        pedir(x, motivo)
      }
  return saida
}
