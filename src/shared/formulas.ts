/** Fórmulas no texto, no jeito do LaTeX: $M = C(1+i)^n$ na linha e
 *  $$...$$ em destaque. O cuidado é com dinheiro: "R$ 1.000 e R$ 2.000"
 *  não pode virar fórmula. */
export interface Formula {
  raw: string
  tex: string
  bloco: boolean
}

/** a fórmula que começa no início do texto, ou null.
 *  $...$ só vale colado no texto ($x$, não "$ x $") e não fecha antes de
 *  número ("$5 e $10" é dinheiro). */
export function formulaNoInicio(src: string): Formula | null {
  const b = /^\$\$([^$]+?)\$\$/.exec(src)
  if (b) return { raw: b[0], tex: b[1].trim(), bloco: true }
  const m = /^\$(?![\s$])([^$\n]+?)(?<!\s)\$(?!\d)/.exec(src)
  return m ? { raw: m[0], tex: m[1], bloco: false } : null
}

/** posição do primeiro $ que abre uma fórmula; -1 se não há.
 *  $ logo depois de letra ou número é moeda (R$, US$). */
export function inicioDeFormula(src: string): number {
  for (let i = src.indexOf('$'); i >= 0; i = src.indexOf('$', i + 1)) {
    if (i > 0 && /[\p{L}\p{N}$]/u.test(src[i - 1])) continue
    if (formulaNoInicio(src.slice(i))) return i
  }
  return -1
}

/** o texto em pedaços: texto comum e fórmulas, na ordem */
export function separarFormulas(texto: string): (string | Formula)[] {
  const partes: (string | Formula)[] = []
  let resto = texto
  for (let i = inicioDeFormula(resto); i >= 0; i = inicioDeFormula(resto)) {
    if (i > 0) partes.push(resto.slice(0, i))
    const f = formulaNoInicio(resto.slice(i))!
    partes.push(f)
    resto = resto.slice(i + f.raw.length)
  }
  if (resto) partes.push(resto)
  return partes
}

// os escapes do JSON, mais \“ (aspa curva), que consertarJsonCopiado arruma
const ESCAPES_DO_JSON = '"\\/bfnrtu\u201C\u201D\u201E\u201F'

const COMANDOS_LATEX =
  /^(?:d?frac|tfrac|times|cdots?|ldots|sqrt|left|right|text|mathrm|approx|div|leq?|geq?|neq|qquad|quad|Rightarrow|rightarrow|sum|prod|overline|bar|ln|log|Delta|infty|pm)(?![a-zA-Z])/

/** A IA às vezes escreve \frac no JSON com uma barra só. Isso quebra a
 *  leitura (\c, \s não existem no JSON) ou, pior, passa calado: \f e \t
 *  são "avanço de página" e "tab" e a fórmula some. Dobra a barra quando
 *  ela começa um comando de fórmula ou não é um escape do JSON. */
export function dobrarBarrasDoLatex(json: string): string {
  let saida = ''
  for (let i = 0; i < json.length; i++) {
    const c = json[i]
    if (c !== '\\') {
      saida += c
      continue
    }
    const resto = json.slice(i + 1, i + 12)
    if (resto[0] === '\\') {
      saida += '\\\\'
      i++
    } else if (COMANDOS_LATEX.test(resto) || !ESCAPES_DO_JSON.includes(resto[0] ?? '"'))
      saida += '\\\\'
    else saida += '\\'
  }
  return saida
}
