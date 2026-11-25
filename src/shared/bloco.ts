import type { NotaDoBloco, Questao } from './tipos'

const MAX_NOTAS = 500
const MAX_TITULO = 200
const MAX_TEXTO = 20000

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
