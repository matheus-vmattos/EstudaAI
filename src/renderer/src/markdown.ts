import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { formulaNoInicio, inicioDeFormula, separarFormulas } from '../../shared/formulas'

// ponytail: KaTeX desenha a fórmula em HTML e CSS, sem internet e sem
// esperar; um erro de digitação aparece em vermelho no lugar, não quebra a tela
const desenhar = (tex: string, bloco: boolean): string =>
  `<span class="formula${bloco ? ' bloco' : ''}" role="math" aria-label="${escapar(tex)}">${katex.renderToString(
    tex,
    { throwOnError: false, displayMode: bloco, output: 'html', strict: false }
  )}</span>`

const escapar = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

marked.use({
  extensions: [
    // ==texto== vira <mark>: o "marca-texto" da barra de ferramentas
    {
      name: 'marcado',
      level: 'inline',
      start: (src: string) => src.indexOf('=='),
      tokenizer(src: string) {
        const m = /^==([^=\n]+)==/.exec(src)
        if (m) return { type: 'marcado', raw: m[0], text: m[1] }
        return undefined
      },
      renderer: (token) => `<mark>${marked.parseInline(token['text'] as string)}</mark>`
    },
    // $fórmula$ e $$fórmula$$ (R$ 10 continua sendo dinheiro)
    {
      name: 'formula',
      level: 'inline',
      start: (src: string) => {
        const i = inicioDeFormula(src)
        return i >= 0 ? i : undefined
      },
      tokenizer(src: string) {
        const f = formulaNoInicio(src)
        return f ? { type: 'formula', raw: f.raw, tex: f.tex, bloco: f.bloco } : undefined
      },
      renderer: (token) => desenhar(token['tex'] as string, token['bloco'] as boolean)
    }
  ]
})

/** Markdown → HTML limpo. A anotação é do próprio usuário, mas texto colado
 *  da internet pode trazer script: o DOMPurify tira. */
export function renderizarMarkdown(md: string): string {
  const html = marked.parse(md, { async: false, gfm: true, breaks: true })
  return DOMPurify.sanitize(html)
}

/** Texto comum (enunciado, alternativa, resolução) com as fórmulas
 *  desenhadas; o resto sai como está, com as quebras de linha. */
export function textoComFormulas(texto: string): string {
  const html = separarFormulas(texto)
    .map((p) =>
      typeof p === 'string' ? escapar(p).replace(/\n/g, '<br>') : desenhar(p.tex, p.bloco)
    )
    .join('')
  return DOMPurify.sanitize(html)
}
