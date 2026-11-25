import type { RaioX } from './raioX'
import type { Dados, Explicacao, Id, Licao, Questao, Retorno, Simulado, Veredito } from './tipos'
import { semAcento } from './texto'
import { lerRespostaDaIa } from './questoes'

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

/** O que a resposta do Claude pede de você agora:
 *  - esperando: o Claude ainda não leu este texto;
 *  - nova: chegou e você ainda não leu (ou não fez o teste);
 *  - entendeu: acertou o teste (ou a explicação já estava certa);
 *  - rever: errou o teste (ou leu uma correção sem teste): o assunto volta. */
export type EstadoDaResposta = 'esperando' | 'nova' | 'entendeu' | 'rever'

export function estadoDaResposta(d: Dados, x: Explicacao): EstadoDaResposta {
  const r = retornoDe(d, x)
  if (!r) return 'esperando'
  const feito = x.licao?.retornoEm === r.criadoEm ? x.licao : undefined
  const teste = r.licao?.teste ?? []
  // certa e sem nada a mais para ler: nada a fazer
  if (!feito) return r.veredito === 'certo' && !r.licao ? 'entendeu' : 'nova'
  if (!teste.length) return r.veredito === 'certo' ? 'entendeu' : 'rever'
  return teste.every((q, i) => feito.respostas[i] === q.gabarito) ? 'entendeu' : 'rever'
}

/** O conceito está fechado: a explicação veio certa ou você passou no teste */
export const conceitoFechado = (d: Dados, x: Explicacao): boolean =>
  retornoDe(d, x)?.veredito === 'certo' || estadoDaResposta(d, x) === 'entendeu'

/** A lição que vem da nuvem é texto de fora: só entra inteira e no formato
 *  (as questões passam pelo mesmo leitor dos simulados). */
export function lerLicao(b: unknown): Licao | undefined {
  if (!b || typeof b !== 'object') return undefined
  const x = b as Record<string, unknown>
  const txt = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
  if (!txt(x.acertou) || !Array.isArray(x.pontos)) return undefined
  const pontos: Licao['pontos'] = []
  for (const p of x.pontos) {
    const y = p as Record<string, unknown>
    if (!y || !txt(y.titulo) || !txt(y.texto)) return undefined
    pontos.push({ titulo: y.titulo.trim(), texto: y.texto.trim() })
  }
  let teste: Questao[] = []
  if (Array.isArray(x.teste) && x.teste.length) {
    const lido = lerRespostaDaIa(JSON.stringify({ questoes: x.teste }))
    if (!lido.ok) return undefined
    teste = lido.questoes
  }
  const fontes = Array.isArray(x.fontes) ? x.fontes.filter(txt).map((f) => f.trim()) : []
  return { acertou: x.acertou.trim(), pontos, teste, fontes }
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
        (ja.criadoEm === r.criadoEm &&
          ja.veredito === r.veredito &&
          ja.texto === r.texto &&
          JSON.stringify(ja.licao) === JSON.stringify(r.licao)))
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
  /** a explicação da 0.1.22 que vale para este pedido (presa a este simulado) */
  legado?: { simuladoId: Id; topico: string }
}

/** A pergunta é sobre o CONCEITO, não sobre a questão: a do conteúdo, ou uma
 *  geral do tópico. A mesma pergunta volta em outros simulados até virar "Certo". */
export const perguntaDoConceito = (q: Questao, topico: string): string =>
  q.explicar ??
  `O que é ${topico} e como você reconhece e resolve uma questão desse tipo? Explique a ideia com suas palavras e um exemplo seu.`

const mesmaPergunta = (a: string, b: string): boolean => semAcento(a.trim()) === semAcento(b.trim())

/** A sua explicação de um conceito (vale para todos os simulados): pela mesma
 *  pergunta, em qualquer simulado ou missão (a sem simulado primeiro). As da
 *  0.1.22 eram presas à questão e à pergunta antiga; o `legado` (o simulado e o
 *  tópico) as encontra, para não pedir de novo nem perder o retorno. */
export function explicacaoDoConceito(
  d: Dados,
  pergunta: string,
  legado?: { simuladoId: Id; topico: string }
): Explicacao | undefined {
  const iguais = (d.explicacoes ?? []).filter((x) => mesmaPergunta(x.pergunta, pergunta))
  return iguais.find((x) => !x.simuladoId) ?? iguais[0] ?? (legado && explicacaoAntiga(d, legado))
}

/** A explicação da 0.1.22: presa a um simulado e a um tópico */
const explicacaoAntiga = (
  d: Dados,
  l: { simuladoId: Id; topico: string }
): Explicacao | undefined =>
  (d.explicacoes ?? []).find(
    (x) =>
      x.simuladoId === l.simuladoId && semAcento(x.topico.trim()) === semAcento(l.topico.trim())
  )

const MOTIVO = { lacuna: 'errou', engano: 'errou rápido', fragil: 'acertou com dúvida' } as const

/** Depois do simulado: até 3 conceitos para explicar, do que mais pede (não
 *  sabia, errou achando que sabia, acertou inseguro). Um pedido por conceito,
 *  com as questões que o puxaram; conceito já explicado "Certo" não volta. */
export function pedidosDeExplicar(s: Simulado, r: RaioX, d?: Dados, max = 3): PedidoDeExplicar[] {
  type Grupo = PedidoDeExplicar & { faixas: (keyof typeof MOTIVO)[] }
  const grupos = new Map<string, Grupo>()
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
      grupos.set(chave, {
        indice: x.indice,
        indices: [x.indice],
        topico: x.topico,
        pergunta,
        motivo: '',
        faixas: [faixa]
      })
    }
  let lista = [...grupos.values()]
  if (d) {
    // a mesma pergunta acha a explicação; as da 0.1.22 (presas a este simulado,
    // com a pergunta antiga) só entram pelo tópico se nenhum pedido já as achou
    // pela pergunta, e cada uma num pedido só
    const exatas = lista.map((g) => explicacaoDoConceito(d, g.pergunta))
    const usadas = new Set(exatas.filter((x) => x).map((x) => x!.id))
    lista = lista.filter((g, k) => {
      let ja = exatas[k]
      if (!ja) {
        const velha = explicacaoAntiga(d, { simuladoId: s.id, topico: g.topico })
        if (velha && !usadas.has(velha.id)) {
          usadas.add(velha.id)
          g.legado = { simuladoId: s.id, topico: g.topico }
          ja = velha
        }
      }
      return !(ja && conceitoFechado(d, ja))
    })
  }
  return lista.slice(0, max).map(({ faixas, ...p }) => {
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
