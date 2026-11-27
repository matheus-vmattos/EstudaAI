import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  devolverFormulas,
  separarFormulas,
  trocarFormulasPorMarcas,
  type Formula
} from '../../shared/formulas'

// ponytail: KaTeX desenha a fórmula em HTML e CSS, sem internet e sem
// esperar; um erro de digitação aparece em vermelho no lugar, não quebra a tela
const desenhar = ({ tex, bloco }: Formula): string =>
  `<span class="formula${bloco ? ' bloco' : ''}" role="math" aria-label="${escapar(tex)}">${katex.renderToString(
    tex,
    { throwOnError: false, displayMode: bloco, output: 'html', strict: false }
  )}</span>`

const escapar = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// ==texto== vira <mark>: o "marca-texto" da barra de ferramentas
marked.use({
  extensions: [
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
    }
  ]
})

/** Markdown → HTML limpo, com $fórmulas$ desenhadas. A anotação é do
 *  próprio usuário, mas texto colado da internet pode trazer script: o
 *  DOMPurify tira. */
export function renderizarMarkdown(md: string): string {
  const { texto, formulas } = trocarFormulasPorMarcas(md)
  const html = marked.parse(texto, { async: false, gfm: true, breaks: true })
  return DOMPurify.sanitize(devolverFormulas(html, formulas, desenhar))
}

/** Texto comum (enunciado, alternativa, resolução) com as fórmulas
 *  desenhadas; o resto sai como está, com as quebras de linha. */
export function textoComFormulas(texto: string): string {
  const html = separarFormulas(texto)
    .map((p) => (typeof p === 'string' ? escapar(p).replace(/\n/g, '<br>') : desenhar(p)))
    .join('')
  return DOMPurify.sanitize(html)
}

// NÃO, EXCETO, INCORRETA… em caixa alta: é onde a banca prende quem lê rápido
const COMANDO =
  /(^|[^\p{L}])(NÃO|EXCETO|INCORRET[AO]S?|CORRET[AO]S?|ERRAD[AO]S?|FALS[AO]S?|VERDADEIR[AO]S?|APENAS|SOMENTE|SEMPRE|NUNCA|MENOS|MAIOR|MENOR)(?!\p{L})/gu

/** O enunciado: como `textoComFormulas`, com os comandos da banca em
 *  destaque e o <u>sublinhado</u> do original de volta. */
export function textoDaQuestao(texto: string): string {
  const html = separarFormulas(texto)
    .map((p) =>
      typeof p === 'string'
        ? escapar(p)
            .replace(/&#60;u&#62;([^]*?)&#60;\/u&#62;/g, '<u>$1</u>')
            .replace(COMANDO, '$1<strong class="comando">$2</strong>')
            .replace(/\n/g, '<br>')
        : desenhar(p)
    )
    .join('')
  return DOMPurify.sanitize(html)
}
