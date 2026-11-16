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

// nó cabe nome de até 2 linhas (ex.: "Encontros vocálicos (ditongo, tritongo, hiato)")
export const LARGURA_DO_NO = 240
export const ALTURA_DO_NO = 52
const ESPACO_X = 64
const ESPACO_Y = 14

export interface NoPosicionado {
  no: NoDoMapa
  x: number
  y: number
  paiId: Id | null
  /** no vertical: folha empilhada em coluna embaixo do pai */
  empilhado?: boolean
}

/** recuo da coluna de folhas empilhadas, no vertical */
export const RECUO_EMPILHADO = 28
/** a partir de quantas folhas irmãs o vertical empilha em coluna */
const EMPILHAR_A_PARTIR_DE = 4

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
    // vertical: muitas folhas irmãs lado a lado deixam o mapa larguíssimo;
    // elas descem em coluna embaixo do pai, como num organograma
    const empilhar =
      vertical &&
      no.filhos.length >= EMPILHAR_A_PARTIR_DE &&
      no.filhos.every((f) => f.filhos.length === 0)
    if (empilhar) {
      pos = proximaFolha
      proximaFolha += passoFolha + RECUO_EMPILHADO
      const yPai = nivel * passoNivel
      no.filhos.forEach((f, i) =>
        nos.push({
          no: f,
          x: pos + RECUO_EMPILHADO,
          y: yPai + (ALTURA_DO_NO + ESPACO_Y) * (i + 1),
          paiId: no.id,
          empilhado: true
        })
      )
    } else if (no.filhos.length === 0) {
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

export interface Vista {
  x: number
  y: number
  zoom: number
}
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 1.6

/** Vista que mostra a caixa inteira (x, y, largura, altura no espaço do
 *  mapa) centralizada na área, sem passar de 100% de zoom. */
export function vistaQueMostra(
  caixa: { x: number; y: number; largura: number; altura: number },
  areaLargura: number,
  areaAltura: number,
  margem = 32
): Vista {
  const zoom = Math.max(
    ZOOM_MIN,
    Math.min(
      1,
      (areaLargura - 2 * margem) / caixa.largura,
      (areaAltura - 2 * margem) / caixa.altura
    )
  )
  return {
    zoom,
    x: areaLargura / 2 - (caixa.x + caixa.largura / 2) * zoom,
    y: areaAltura / 2 - (caixa.y + caixa.altura / 2) * zoom
  }
}

/** Menor deslocamento da vista para a caixa entrar na área (se ela for maior
 *  que a área, alinha pelo começo: topo/esquerda ficam à vista). */
export function deslocamentoParaMostrar(
  caixa: { x: number; y: number; largura: number; altura: number },
  v: Vista,
  areaLargura: number,
  areaAltura: number,
  margem = 24
): { dx: number; dy: number } {
  const eixo = (inicio: number, tamanho: number, area: number): number => {
    const a = inicio * v.zoom
    const t = tamanho * v.zoom
    if (t > area - 2 * margem || a < margem) return margem - a
    if (a + t > area - margem) return area - margem - (a + t)
    return 0
  }
  return {
    dx: eixo(caixa.x + v.x / v.zoom, caixa.largura, areaLargura),
    dy: eixo(caixa.y + v.y / v.zoom, caixa.altura, areaAltura)
  }
}

/** a caixa que envolve os nós (para ajustar a vista) */
export function caixaDos(nos: NoPosicionado[]): {
  x: number
  y: number
  largura: number
  altura: number
} {
  const xs = nos.map((n) => n.x)
  const ys = nos.map((n) => n.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    largura: Math.max(...xs) + LARGURA_DO_NO - x,
    altura: Math.max(...ys) + ALTURA_DO_NO - y
  }
}
