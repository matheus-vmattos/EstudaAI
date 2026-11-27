/** Leitura da questão (v0.1.29, mockup "Leitura da questão" aprovado em
 *  27/11): separa o que o enunciado já traz — o número do caderno, o texto de
 *  apoio, os itens I, II, III ou ( ) — para a tela mostrar cada coisa no seu
 *  lugar. Funciona com o que já está salvo: nada muda nos dados. */

export interface EnunciadoLido {
  /** número da questão na prova original ("[Questão 12] …") */
  numero?: string
  /** texto de apoio ("Leia o texto:\n\n…\n\n"), sem o rótulo */
  apoio?: string
  /** o que vem antes dos itens (ou o enunciado inteiro, se não houver itens) */
  antes: string
  /** I., II., III. … ou ( ) — um por linha */
  itens: { marca: string; texto: string }[]
  /** o comando depois dos itens ("Está correto o que se afirma em") */
  depois: string
}

const NUMERO = /^\s*\[Questão (\d+)\]\s*/
const APOIO = /^Leia o texto:\s*\n\n/
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
// o comando que fecha a lista de itens
const FECHO =
  /\s(?=(?:Está(?:ão)? corret|Estão corret|É correto o que|São corretas|São verdadeir|É verdadeir|Assinale|A sequência corret|Completa(?:m)? corretamente|Está(?:ão)? de acordo|Está(?:ão)? em conformidade|Considerando as afirma|Em relação às afirma|Quanto às afirma|Diante do exposto|Está certo|Estão certas|Responde corretamente|As afirmativas,? são|As afirmações,? são|Quais (?:afirma|das)|Qual (?:das|o)\b)[^]*$)/

export function lerEnunciado(enunciado: string): EnunciadoLido {
  let t = enunciado
  let numero: string | undefined
  const n = NUMERO.exec(t)
  if (n) {
    numero = n[1]
    t = t.slice(n[0].length)
  }
  let apoio: string | undefined
  if (APOIO.test(t)) {
    const corpo = t.replace(APOIO, '')
    const fim = corpo.lastIndexOf('\n\n')
    if (fim > 0) {
      apoio = corpo.slice(0, fim).trim()
      t = corpo.slice(fim + 2)
    }
  }
  return { numero, apoio, ...separarItens(t.trim()) }
}

function separarItens(t: string): Pick<EnunciadoLido, 'antes' | 'itens' | 'depois'> {
  const nada = { antes: t, itens: [], depois: '' }
  // I. … II. … na ordem; a marca vem depois de espaço, quebra ou dois-pontos
  const cortes: { marca: string; ini: number; fim: number }[] = []
  let de = 0
  for (const r of ROMANOS) {
    const m = new RegExp(`(^|[\\s:])${r}\\.\\s+(?=\\S)`).exec(t.slice(de))
    if (!m) break
    const ini = de + m.index + m[1].length
    cortes.push({ marca: `${r}.`, ini, fim: de + m.index + m[0].length })
    de = de + m.index + m[0].length
  }
  if (cortes.length < 2) return vf(t) ?? nada
  return montar(t, cortes)
}

// V/F: "( ) afirmação ( ) afirmação"
function vf(t: string): Pick<EnunciadoLido, 'antes' | 'itens' | 'depois'> | null {
  const cortes: { marca: string; ini: number; fim: number }[] = []
  const re = /\(\s*\)\s*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) cortes.push({ marca: '( )', ini: m.index, fim: m.index + m[0].length })
  return cortes.length < 2 ? null : montar(t, cortes)
}

function montar(
  t: string,
  cortes: { marca: string; ini: number; fim: number }[]
): Pick<EnunciadoLido, 'antes' | 'itens' | 'depois'> {
  const itens = cortes.map((c, i) => ({
    marca: c.marca,
    texto: t.slice(c.fim, i + 1 < cortes.length ? cortes[i + 1].ini : undefined).trim()
  }))
  const ultimo = itens[itens.length - 1]
  let depois = ''
  const f = FECHO.exec(ultimo.texto) ?? semPonto(ultimo.texto)
  if (f) {
    depois = ultimo.texto.slice(f.index).trim()
    ultimo.texto = ultimo.texto.slice(0, f.index).trim()
  }
  return { antes: t.slice(0, cortes[0].ini).trim(), itens, depois }
}

// sem frase conhecida: a última frase do item, se não termina em ponto, é o
// comando ("… integra a categoria de créditos garantidos pelo FGC")
function semPonto(t: string): { index: number } | null {
  if (/[.;]\s*$/.test(t)) return null
  let corte = -1
  const re = /[.;]\s+(?=[A-ZÀ-Ý])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) corte = m.index + 1
  return corte > 0 ? { index: corte } : null
}

/** parágrafos do texto de apoio, com onde cada um começa (para o marca-texto) */
export function paragrafos(apoio: string): { ini: number; texto: string }[] {
  const saida: { ini: number; texto: string }[] = []
  const re = /[^\n]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(apoio))) if (m[0].trim()) saida.push({ ini: m.index, texto: m[0] })
  return saida
}

/** chave curta do texto de apoio: as questões do mesmo texto dividem as marcas */
export function chaveDoTexto(t: string): string {
  let h = 5381
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export type Trecho = [number, number]

/** junta um trecho novo aos marcados (sobrepostos ou encostados viram um) */
export function marcar(trechos: Trecho[], novo: Trecho): Trecho[] {
  const [a, b] = novo[0] <= novo[1] ? novo : [novo[1], novo[0]]
  if (a === b) return trechos
  const todos = [...trechos, [a, b] as Trecho].sort((x, y) => x[0] - y[0])
  const saida: Trecho[] = []
  for (const t of todos) {
    const u = saida[saida.length - 1]
    if (u && t[0] <= u[1]) u[1] = Math.max(u[1], t[1])
    else saida.push([t[0], t[1]])
  }
  return saida
}

/** o pedaço [ini, fim) de um parágrafo, dividido em marcado / não marcado */
export function pedacos(
  ini: number,
  texto: string,
  trechos: Trecho[]
): { ini: number; texto: string; marcado: boolean }[] {
  const fim = ini + texto.length
  const saida: { ini: number; texto: string; marcado: boolean }[] = []
  let p = ini
  for (const [a, b] of trechos) {
    if (b <= p || a >= fim) continue
    const x = Math.max(a, p)
    const y = Math.min(b, fim)
    if (x > p) saida.push({ ini: p, texto: texto.slice(p - ini, x - ini), marcado: false })
    saida.push({ ini: x, texto: texto.slice(x - ini, y - ini), marcado: true })
    p = y
  }
  if (p < fim) saida.push({ ini: p, texto: texto.slice(p - ini), marcado: false })
  return saida
}

/** as questões vizinhas que usam o mesmo texto (números a partir de 1) */
export function faixaDoTexto(questoes: { enunciado: string }[], i: number): [number, number] {
  const apoio = (k: number): string | undefined => lerEnunciado(questoes[k].enunciado).apoio
  const meu = apoio(i)
  let a = i
  let b = i
  if (meu) {
    while (a > 0 && apoio(a - 1) === meu) a--
    while (b < questoes.length - 1 && apoio(b + 1) === meu) b++
  }
  return [a + 1, b + 1]
}

/** uma linha da questão para listas: sem o número do caderno nem o texto de apoio */
export function resumoDoEnunciado(enunciado: string, max: number): string {
  const l = lerEnunciado(enunciado)
  const t = [l.antes, ...l.itens.map((i) => `${i.marca} ${i.texto}`), l.depois]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > max ? `${t.slice(0, max - 2).trimEnd()}…` : t
}
