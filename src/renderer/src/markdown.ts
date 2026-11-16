import { marked } from 'marked'
import DOMPurify from 'dompurify'

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

/** Markdown → HTML limpo. A anotação é do próprio usuário, mas texto colado
 *  da internet pode trazer script: o DOMPurify tira. */
export function renderizarMarkdown(md: string): string {
  const html = marked.parse(md, { async: false, gfm: true, breaks: true })
  return DOMPurify.sanitize(html)
}
