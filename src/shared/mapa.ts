import type { Dados, Id } from './tipos'

export type TipoDoNo = 'materia' | 'assunto' | 'topico'

export interface NoDoMapa {
  id: Id
  tipo: TipoDoNo
  nome: string
  /** filhos visíveis (vazio se recolhido) */
  filhos: NoDoMapa[]
  /** quantos filhos existem, mesmo recolhido (o "+3" do nó) */
  totalFilhos: number
  recolhido: boolean
}

/** Matéria → assuntos → tópicos (e tópicos dentro de tópicos) */
export function montarArvore(dados: Dados, materiaId: Id): NoDoMapa | null {
  const m = dados.materias.find((x) => x.id === materiaId)
  if (!m) return null
  const recolhidos = new Set(dados.mapaRecolhidos)
  const no = (id: Id, tipo: TipoDoNo, nome: string, filhos: NoDoMapa[]): NoDoMapa => {
    const recolhido = recolhidos.has(id) && filhos.length > 0
    return {
      id,
      tipo,
      nome,
      filhos: recolhido ? [] : filhos,
      totalFilhos: filhos.length,
      recolhido
    }
  }
  const topicosDe = (assuntoId: Id, paiId: Id | null): NoDoMapa[] =>
    dados.topicos
      .filter((t) => t.assuntoId === assuntoId && t.paiId === paiId)
      .map((t) => no(t.id, 'topico', t.nome, topicosDe(assuntoId, t.id)))
  return no(
    m.id,
    'materia',
    m.nome,
    m.assuntos.map((a) => no(a.id, 'assunto', a.nome, topicosDe(a.id, null)))
  )
}

export const LARGURA_DO_NO = 220
export const ALTURA_DO_NO = 44
const ESPACO_X = 64
const ESPACO_Y = 14

export interface NoPosicionado {
  no: NoDoMapa
  x: number
  y: number
  paiId: Id | null
}

const ESPACO_X_VERTICAL = 24
const ESPACO_Y_VERTICAL = 64

/** Árvore horizontal (níveis em colunas) ou vertical (níveis em linhas, como
 *  árvore genealógica): folhas lado a lado e o pai no meio dos filhos. */
export function posicionar(
  raiz: NoDoMapa,
  vertical = false
): {
  nos: NoPosicionado[]
  largura: number
  altura: number
} {
  const nos: NoPosicionado[] = []
  let proximaFolha = 0
  const passoFolha = vertical ? LARGURA_DO_NO + ESPACO_X_VERTICAL : ALTURA_DO_NO + ESPACO_Y
  const passoNivel = vertical ? ALTURA_DO_NO + ESPACO_Y_VERTICAL : LARGURA_DO_NO + ESPACO_X
  const visitar = (no: NoDoMapa, nivel: number, paiId: Id | null): number => {
    let pos: number
    if (no.filhos.length === 0) {
      pos = proximaFolha
      proximaFolha += passoFolha
    } else {
      const ps = no.filhos.map((f) => visitar(f, nivel + 1, no.id))
      pos = (ps[0] + ps[ps.length - 1]) / 2
    }
    const n = nivel * passoNivel
    nos.push(vertical ? { no, x: pos, y: n, paiId } : { no, x: n, y: pos, paiId })
    return pos
  }
  visitar(raiz, 0, null)
  const largura = Math.max(...nos.map((n) => n.x)) + LARGURA_DO_NO
  const altura = Math.max(...nos.map((n) => n.y)) + ALTURA_DO_NO
  return { nos, largura, altura }
}

/** todos os ids com filhos (para "recolher tudo") */
export function idsComFilhos(dados: Dados, materiaId: Id): Id[] {
  const m = dados.materias.find((x) => x.id === materiaId)
  if (!m) return []
  const pais = new Set(dados.topicos.map((t) => t.paiId).filter(Boolean) as Id[])
  const assuntosComTopicos = new Set(dados.topicos.map((t) => t.assuntoId))
  return [
    ...(m.assuntos.length ? [m.id] : []),
    ...m.assuntos.filter((a) => assuntosComTopicos.has(a.id)).map((a) => a.id),
    ...dados.topicos
      .filter((t) => pais.has(t.id) && m.assuntos.some((a) => a.id === t.assuntoId))
      .map((t) => t.id)
  ]
}

/** o tópico e todos os descendentes (para apagar junto) */
export function descendentes(dados: Dados, topicoId: Id): Id[] {
  const filhos = dados.topicos.filter((t) => t.paiId === topicoId)
  return [topicoId, ...filhos.flatMap((f) => descendentes(dados, f.id))]
}
