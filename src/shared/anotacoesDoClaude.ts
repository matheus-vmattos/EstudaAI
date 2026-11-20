import { importarEstrutura, type NoDoTexto } from './estrutura'
import { semAcento } from './texto'
import { dobrarBarrasDoLatex } from './formulas'
import type { Dados, Id } from './tipos'

/** Anotações prontas (resumo, fórmula, exemplo, pegadinha) para os nós do
 *  mapa, pelo nome do lugar: ["Medidas de dispersão", "Variância"]. */
export interface PacoteDeAnotacoes {
  materia: string
  notas: { lugar: string[]; texto: string }[]
}

export function lerPacoteDeAnotacoes(
  texto: string
): { ok: true; pacote: PacoteDeAnotacoes } | { ok: false; erro: string } {
  let b: { materia?: unknown; notas?: unknown }
  try {
    b = JSON.parse(dobrarBarrasDoLatex(texto))
  } catch {
    return { ok: false, erro: 'O arquivo de anotações veio quebrado.' }
  }
  if (typeof b?.materia !== 'string' || !b.materia.trim() || !Array.isArray(b.notas))
    return { ok: false, erro: 'O arquivo de anotações não tem matéria ou notas.' }
  const notas: PacoteDeAnotacoes['notas'] = []
  for (const [i, n] of b.notas.entries()) {
    const x = n as { lugar?: unknown; texto?: unknown }
    const lugar = Array.isArray(x?.lugar)
      ? x.lugar.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      : []
    const t = typeof x?.texto === 'string' ? x.texto.trim() : ''
    if (!lugar.length || !t) return { ok: false, erro: `A anotação ${i + 1} está incompleta.` }
    notas.push({ lugar, texto: t })
  }
  return { ok: true, pacote: { materia: b.materia.trim(), notas } }
}

/** A nota é sua (conta como estudo) se tem texto e não é só o que o Claude
 *  pôs ali sem você mexer. */
export function temNotaPropria(d: Dados, id: Id, nota: string): boolean {
  const t = nota.trim()
  return !!t && t !== d.notasDoClaude?.[id]?.trim()
}

/** Põe as anotações nos lugares do mapa (criando o que faltar). Só escreve
 *  em anotação vazia ou que ainda é o texto do Claude sem edição (então uma
 *  versão corrigida chega); a sua anotação nunca é tocada. Não muda a data
 *  de edição: anotação do Claude não é dia de estudo seu. */
export function importarAnotacoes(
  d: Dados,
  pacote: PacoteDeAnotacoes,
  novoId: () => Id,
  quando = Date.now()
): { escritas: number; suas: number; lugaresCriados: number; nos: Id[] } {
  const raiz: NoDoTexto = { nome: pacote.materia, filhos: [] }
  for (const n of pacote.notas) {
    let nivel = raiz.filhos
    for (const nome of n.lugar) {
      let no = nivel.find((x) => semAcento(x.nome) === semAcento(nome))
      if (!no) nivel.push((no = { nome, filhos: [] }))
      nivel = no.filhos
    }
  }
  const { criados } = importarEstrutura(d, [raiz], novoId, quando)
  const m = d.materias.find((x) => semAcento(x.nome) === semAcento(pacote.materia))!
  const notasDoClaude = { ...d.notasDoClaude }
  let escritas = 0
  let suas = 0
  const nos: Id[] = []
  for (const n of pacote.notas) {
    const a = m.assuntos.find((x) => semAcento(x.nome) === semAcento(n.lugar[0]))
    if (!a) continue
    let alvo: { id: Id; nota: string } = a
    let paiId: Id | null = null
    for (const nome of n.lugar.slice(1)) {
      const t = d.topicos.find(
        (x) => x.assuntoId === a.id && x.paiId === paiId && semAcento(x.nome) === semAcento(nome)
      )
      if (!t) break
      alvo = t
      paiId = t.id
    }
    nos.push(alvo.id)
    if (temNotaPropria({ ...d, notasDoClaude }, alvo.id, alvo.nota)) {
      suas++
      continue
    }
    if (alvo.nota.trim() !== n.texto) {
      alvo.nota = n.texto
      escritas++
    }
    notasDoClaude[alvo.id] = n.texto
  }
  d.notasDoClaude = notasDoClaude
  return { escritas, suas, lugaresCriados: criados, nos }
}
