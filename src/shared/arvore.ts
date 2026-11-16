import { semAcento } from './texto'
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
  /** nó de cima (assunto ou tópico); null no assunto */
  paiId: Id | null
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
        nivel,
        paiId: t.paiId ?? assuntoId
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
      nivel: 0,
      paiId: null
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

/** Um lugar para onde o nó pode ir: matéria (vira assunto dela) ou
 *  assunto/tópico (vira tópico abaixo dele). */
export interface Destino {
  tipo: TipoDoLugar
  id: Id
  nome: string
  /** matéria › ... › pai do destino (sem o próprio destino) */
  acima: string[]
}

/** Para onde o nó pode ir: tudo menos ele mesmo, o que está abaixo dele
 *  (daria um laço) e o lugar onde ele já está. */
export function destinosPara(d: Dados, id: Id): Destino[] {
  const proibidos = new Set(idsAbaixo(d, id))
  const t = d.topicos.find((x) => x.id === id)
  const paiAtual = t
    ? (t.paiId ?? t.assuntoId)
    : d.materias.find((m) => m.assuntos.some((a) => a.id === id))?.id
  const saida: Destino[] = []
  for (const m of d.materias) {
    if (m.id !== paiAtual) saida.push({ tipo: 'materia', id: m.id, nome: m.nome, acima: [] })
    for (const n of nosDaMateria(d, m)) {
      if (proibidos.has(n.id) || n.id === paiAtual) continue
      saida.push({
        tipo: n.tipo,
        id: n.id,
        nome: n.nome,
        acima: [m.nome, ...n.caminho.slice(0, -1)]
      })
    }
  }
  return saida
}

/** Filtra os destinos pelo que a pessoa digitou: todas as palavras têm de
 *  aparecer no caminho; quem tem a palavra no próprio nome vem antes. */
export function procurarDestino(destinos: Destino[], busca: string): Destino[] {
  const palavras = semAcento(busca).split(/\s+/).filter(Boolean)
  if (!palavras.length) return destinos
  const achados = destinos.filter((x) => {
    const tudo = semAcento([...x.acima, x.nome].join(' '))
    return palavras.every((p) => tudo.includes(p))
  })
  const noNome = (x: Destino): number =>
    palavras.every((p) => semAcento(x.nome).includes(p)) ? 0 : 1
  return achados.sort((a, b) => noNome(a) - noNome(b))
}

/** Muda o nó de lugar levando tudo junto: subtópicos, anotação, cartões e
 *  links continuam presos a ele pelo id. Para uma matéria ele vira assunto;
 *  para um assunto ou tópico, vira tópico. Devolve false se não mudou. */
export function moverNo(d: Dados, id: Id, destino: { tipo: TipoDoLugar; id: Id }): boolean {
  if (!destinosPara(d, id).some((x) => x.id === destino.id && x.tipo === destino.tipo)) return false
  const t = d.topicos.find((x) => x.id === id)
  const mOrigem = t ? null : d.materias.find((m) => m.assuntos.some((a) => a.id === id))
  const a = mOrigem?.assuntos.find((x) => x.id === id)
  const no = t ?? a
  if (!no) return false
  const abaixo = new Set(idsAbaixo(d, id))
  abaixo.delete(id)
  // os filhos diretos: num assunto são os tópicos de cima; num tópico, quem aponta para ele
  const filhos = d.topicos.filter((x) => (t ? x.paiId === id : x.assuntoId === id && !x.paiId))

  let materiaDestino: Id
  let assuntoNovo: Id
  if (destino.tipo === 'materia') {
    materiaDestino = destino.id
    assuntoNovo = id
  } else {
    const dt = d.topicos.find((x) => x.id === destino.id)
    assuntoNovo = dt ? dt.assuntoId : destino.id
    materiaDestino = d.materias.find((m) => m.assuntos.some((x) => x.id === assuntoNovo))!.id
  }

  // sai de onde estava
  if (t) d.topicos = d.topicos.filter((x) => x.id !== id)
  else if (mOrigem) mOrigem.assuntos = mOrigem.assuntos.filter((x) => x.id !== id)

  // entra no fim dos irmãos novos
  const quando = no.atualizadoEm ?? Date.now()
  if (destino.tipo === 'materia') {
    d.materias
      .find((m) => m.id === materiaDestino)!
      .assuntos.push({ id, nome: no.nome, nota: no.nota, atualizadoEm: quando })
    filhos.forEach((f) => (f.paiId = null))
  } else {
    d.topicos.push({
      id,
      assuntoId: assuntoNovo,
      paiId: destino.tipo === 'topico' ? destino.id : null,
      nome: no.nome,
      nota: no.nota,
      atualizadoEm: quando
    })
    if (!t) filhos.forEach((f) => (f.paiId = id))
  }
  d.topicos.forEach((x) => {
    if (abaixo.has(x.id)) x.assuntoId = assuntoNovo
  })
  // o link guarda a matéria também
  d.links.forEach((l) => {
    if (l.assuntoId && (l.assuntoId === id || abaixo.has(l.assuntoId))) l.materiaId = materiaDestino
  })
  // o destino e quem está acima dele abrem, para o nó aparecer no mapa
  const abrir = new Set<Id>([materiaDestino, assuntoNovo])
  for (let p: Id | null = destino.id; p; p = d.topicos.find((x) => x.id === p)?.paiId ?? null)
    abrir.add(p)
  d.mapaRecolhidos = d.mapaRecolhidos.filter((x) => !abrir.has(x))
  return true
}
