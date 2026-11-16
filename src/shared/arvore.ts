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

export type TipoDoLugar = 'materia' | 'assunto' | 'topico'

/** Cria um filho do nó: matéria → assunto; assunto ou tópico → tópico.
 *  Devolve o tipo do que foi criado (null se o pai não existe). */
export function adicionarFilho(
  d: Dados,
  pai: { tipo: TipoDoLugar; id: Id },
  id: Id,
  quando = Date.now()
): 'assunto' | 'topico' | null {
  if (pai.tipo === 'materia') {
    const m = d.materias.find((x) => x.id === pai.id)
    if (!m) return null
    m.assuntos.push({ id, nome: 'Novo assunto', nota: '', atualizadoEm: quando })
    m.aberta = true
    d.mapaRecolhidos = d.mapaRecolhidos.filter((x) => x !== m.id)
    return 'assunto'
  }
  const assuntoId =
    pai.tipo === 'assunto' ? pai.id : d.topicos.find((t) => t.id === pai.id)?.assuntoId
  if (!assuntoId || !d.materias.some((m) => m.assuntos.some((a) => a.id === assuntoId))) return null
  d.topicos.push({
    id,
    assuntoId,
    paiId: pai.tipo === 'topico' ? pai.id : null,
    nome: 'Novo tópico',
    nota: '',
    atualizadoEm: quando
  })
  d.mapaRecolhidos = d.mapaRecolhidos.filter((x) => x !== pai.id)
  return 'topico'
}

/** Cria um irmão do nó (mesmo pai). Matéria não tem irmão no mapa: null. */
export function adicionarIrmao(
  d: Dados,
  no: { tipo: TipoDoLugar; id: Id },
  id: Id,
  quando = Date.now()
): 'assunto' | 'topico' | null {
  if (no.tipo === 'assunto') {
    const m = d.materias.find((x) => x.assuntos.some((a) => a.id === no.id))
    return m ? adicionarFilho(d, { tipo: 'materia', id: m.id }, id, quando) : null
  }
  if (no.tipo === 'topico') {
    const t = d.topicos.find((x) => x.id === no.id)
    if (!t) return null
    return adicionarFilho(
      d,
      t.paiId ? { tipo: 'topico', id: t.paiId } : { tipo: 'assunto', id: t.assuntoId },
      id,
      quando
    )
  }
  return null
}

/** renomeia matéria, assunto ou tópico; nome vazio não muda nada */
export function renomearLugar(d: Dados, id: Id, nome: string): void {
  const limpo = nome.trim()
  if (!limpo) return
  const m = d.materias.find((x) => x.id === id)
  if (m) m.nome = limpo
  const a = d.materias.flatMap((x) => x.assuntos).find((x) => x.id === id)
  if (a) a.nome = limpo
  const t = d.topicos.find((x) => x.id === id)
  if (t) t.nome = limpo
}
