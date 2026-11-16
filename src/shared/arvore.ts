import type { Dados, Id, Materia } from './tipos'

/** Um lugar da árvore de estudo: assunto ou tópico (em qualquer nível).
 *  Anotação, cartões e links se prendem a qualquer um deles pelo id. */
export interface NoDeEstudo {
  id: Id
  tipo: 'assunto' | 'topico'
  nome: string
  nota: string
  materia: Materia
  /** assunto ao qual o nó pertence (ele mesmo, se for assunto) */
  assuntoId: Id
  /** nomes do assunto até o nó, sem a matéria */
  caminho: string[]
  nivel: number
}

/** todos os nós de uma matéria, na ordem de leitura (pai antes dos filhos) */
export function nosDaMateria(dados: Dados, m: Materia): NoDeEstudo[] {
  const saida: NoDeEstudo[] = []
  const topicos = (assuntoId: Id, paiId: Id | null, caminho: string[], nivel: number): void => {
    for (const t of dados.topicos.filter((x) => x.assuntoId === assuntoId && x.paiId === paiId)) {
      const c = [...caminho, t.nome]
      saida.push({
        id: t.id,
        tipo: 'topico',
        nome: t.nome,
        nota: t.nota,
        materia: m,
        assuntoId,
        caminho: c,
        nivel
      })
      topicos(assuntoId, t.id, c, nivel + 1)
    }
  }
  for (const a of m.assuntos) {
    saida.push({
      id: a.id,
      tipo: 'assunto',
      nome: a.nome,
      nota: a.nota,
      materia: m,
      assuntoId: a.id,
      caminho: [a.nome],
      nivel: 0
    })
    topicos(a.id, null, [a.nome], 1)
  }
  return saida
}

export const todosOsNos = (dados: Dados): NoDeEstudo[] =>
  dados.materias.flatMap((m) => nosDaMateria(dados, m))

export const acharNo = (dados: Dados, id: Id | null): NoDeEstudo | null =>
  id ? (todosOsNos(dados).find((n) => n.id === id) ?? null) : null

/** o nó e tudo abaixo dele (assunto → todos os tópicos; tópico → subtópicos) */
export function idsAbaixo(dados: Dados, id: Id): Id[] {
  const ehAssunto = dados.materias.some((m) => m.assuntos.some((a) => a.id === id))
  const filhos = ehAssunto
    ? dados.topicos.filter((t) => t.assuntoId === id && t.paiId === null)
    : dados.topicos.filter((t) => t.paiId === id)
  return [id, ...filhos.flatMap((f) => idsAbaixo(dados, f.id))]
}

/** grava a anotação no assunto ou no tópico */
export function gravarNota(d: Dados, id: Id, nota: string, quando = Date.now()): void {
  const a = d.materias.flatMap((m) => m.assuntos).find((x) => x.id === id)
  if (a) {
    a.nota = nota
    a.atualizadoEm = quando
    return
  }
  const t = d.topicos.find((x) => x.id === id)
  if (t) {
    t.nota = nota
    t.atualizadoEm = quando
  }
}

/** apaga o nó, o que está abaixo dele e os cartões presos a eles; links
 *  continuam no quadro, só perdem o lugar */
export function apagarNo(d: Dados, id: Id): void {
  const ids = new Set(idsAbaixo(d, id))
  d.cartoes = d.cartoes.filter((c) => !ids.has(c.assuntoId))
  d.topicos = d.topicos.filter((t) => !ids.has(t.id))
  d.mapaRecolhidos = d.mapaRecolhidos.filter((x) => !ids.has(x))
  d.links.forEach((l) => {
    if (l.assuntoId && ids.has(l.assuntoId)) l.assuntoId = null
  })
  d.materias.forEach((m) => (m.assuntos = m.assuntos.filter((a) => a.id !== id)))
}
