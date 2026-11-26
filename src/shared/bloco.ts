import type { NotaDoBloco, Questao } from './tipos'

const MAX_NOTAS = 500
/** os mesmos limites na janelinha, na tela do app e no que passa entre elas */
export const MAX_TITULO = 200
export const MAX_TEXTO = 20000

/** A lista que chega da janelinha (outra janela, outro processo): só passa o
 *  que tem a forma de uma nota, com limite de tamanho. */
export function lerNotasDoBloco(x: unknown): NotaDoBloco[] {
  if (!Array.isArray(x)) return []
  const vistos = new Set<string>()
  const saida: NotaDoBloco[] = []
  for (const n of x.slice(0, MAX_NOTAS)) {
    const v = n as Partial<NotaDoBloco>
    if (typeof v?.id !== 'string' || !v.id || vistos.has(v.id)) continue
    vistos.add(v.id)
    saida.push({
      id: v.id,
      titulo: typeof v.titulo === 'string' ? v.titulo.slice(0, MAX_TITULO) : '',
      texto: typeof v.texto === 'string' ? v.texto.slice(0, MAX_TEXTO) : '',
      criadoEm: Number.isFinite(v.criadoEm) ? Number(v.criadoEm) : Date.now(),
      atualizadoEm: Number.isFinite(v.atualizadoEm) ? Number(v.atualizadoEm) : Date.now()
    })
  }
  return saida
}

/** "Anotar dúvida" no gabarito: a nota já nasce com a questão, para você só
 *  escrever o que não entendeu. */
export function notaDeDuvida(
  q: Questao,
  numero: number,
  tema: string,
  id: string,
  agora = Date.now()
): NotaDoBloco {
  const certa = q.alternativas.find((a) => a.letra === q.gabarito)
  return {
    id,
    titulo: `Dúvida: questão ${numero} · ${tema}`.slice(0, MAX_TITULO),
    texto: `${q.enunciado.trim()}\n\nCerta: ${q.gabarito}) ${certa?.texto ?? ''}\n\nMinha dúvida: `,
    criadoEm: agora,
    atualizadoEm: agora
  }
}

/** O que a janelinha manda: salvar uma nota ou apagar uma. Nunca a lista
 *  inteira: uma lista velha apagaria o que chegou da nuvem (ou do "Anotar
 *  dúvida") enquanto você digitava. */
export type OpDoBloco = { tipo: 'salvar'; nota: NotaDoBloco } | { tipo: 'apagar'; id: string }

/** Aplica as operações sobre a lista que vale agora. A edição mais nova de
 *  cada nota vence; operação malformada (veio de outra janela) não entra. */
export function aplicarOps(notas: NotaDoBloco[], ops: unknown): NotaDoBloco[] {
  let lista = [...notas]
  if (!Array.isArray(ops)) return lista
  for (const op of ops.slice(0, MAX_NOTAS)) {
    const o = op as Partial<{ tipo: string; nota: unknown; id: unknown }>
    if (o?.tipo === 'apagar' && typeof o.id === 'string') {
      lista = lista.filter((n) => n.id !== o.id)
    } else if (o?.tipo === 'salvar') {
      const [nota] = lerNotasDoBloco([o.nota])
      if (!nota) continue
      const ja = lista.find((n) => n.id === nota.id)
      if (ja && ja.atualizadoEm > nota.atualizadoEm) continue
      lista = ja ? lista.map((n) => (n.id === nota.id ? nota : n)) : [nota, ...lista]
    }
  }
  return lista.slice(0, MAX_NOTAS)
}
