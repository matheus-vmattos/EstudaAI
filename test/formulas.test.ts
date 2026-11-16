import { describe, expect, it } from 'vitest'
import { dobrarBarrasDoLatex, separarFormulas } from '../src/shared/formulas'
import { lerRespostaDaIa, montarPrompt } from '../src/shared/questoes'

const formulas = (t: string): string[] =>
  separarFormulas(t).flatMap((p) => (typeof p === 'string' ? [] : [p.tex]))

describe('fórmulas no texto', () => {
  it('acha $...$ e $$...$$', () => {
    expect(formulas('Montante: $M = C(1+i)^n$.')).toEqual(['M = C(1+i)^n'])
    expect(separarFormulas('$$PMT = PV \\cdot i$$')).toEqual([
      { raw: '$$PMT = PV \\cdot i$$', tex: 'PMT = PV \\cdot i', bloco: true }
    ])
  })

  it('dinheiro não vira fórmula', () => {
    expect(formulas('Aplicou R$ 1.000,00 e resgatou R$ 1.210,00.')).toEqual([])
    expect(formulas('De R$1.000 para R$2.000')).toEqual([])
    expect(formulas('Custa $5 e depois $10')).toEqual([])
    expect(formulas('US$ 100 com $i = 10\\%$ ao mês')).toEqual(['i = 10\\%'])
  })

  it('o texto em volta fica intacto, na ordem', () => {
    const p = separarFormulas('Se $C = 100$, então R$ 121,00.')
    expect(p.map((x) => (typeof x === 'string' ? x : `[${x.tex}]`)).join('')).toBe(
      'Se [C = 100], então R$ 121,00.'
    )
  })
})

describe('barra invertida da IA no JSON', () => {
  it('\\frac com uma barra só não some (\\f seria "avanço de página")', () => {
    const json = '{"t": "$\\frac{1}{2}$ e $a \\times b$ e \\n nova linha e \\"aspas\\""}'
    const lido = JSON.parse(dobrarBarrasDoLatex(json)) as { t: string }
    expect(lido.t).toBe('$\\frac{1}{2}$ e $a \\times b$ e \n nova linha e "aspas"')
  })

  it('o que já veio dobrado continua igual', () => {
    const json = '{"t": "$\\\\frac{1}{2} \\\\cdot 10\\\\%$"}'
    expect(dobrarBarrasDoLatex(json)).toBe(json)
  })

  it('a resposta da IA com fórmula de barra simples é lida inteira', () => {
    const resposta = `{"questoes": [{"enunciado": "Calcule $M = C(1+i)^n$ para R$ 1.000,00.",
      "alternativas": {"A": "R$ 1.100,00", "B": "R$ 1.210,00", "C": "1", "D": "2", "E": "3"},
      "gabarito": "B", "resolucao": "$M = 1000 \\cdot 1{,}1^2$\\n$M = 1210$"}]}`
    const r = lerRespostaDaIa(resposta)
    expect(r.ok && r.questoes[0].resolucao).toBe('$M = 1000 \\cdot 1{,}1^2$\n$M = 1210$')
  })

  it('o prompt pede passo a passo e fórmula com barra dobrada', () => {
    const p = montarPrompt(
      {
        tema: 'Juros compostos',
        assuntoId: null,
        nivel: 'medio',
        tipo: 'multipla',
        quantidade: 5,
        tempoMin: 15,
        banca: 'FCC'
      },
      'claude'
    )
    expect(p).toContain('passo a passo')
    expect(p).toContain('\\\\frac')
  })
})

describe('passo a passo no gabarito', () => {
  it('com comentário no gabarito, a resolução (a conta) continua aparecendo', async () => {
    const { resolucaoPorLetra } = await import('../src/shared/questoes')
    const q = {
      enunciado: 'x',
      alternativas: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({ letra, texto: letra })),
      gabarito: 'B',
      resolucao: '$M = 1000 \\cdot 1{,}1^2$\n$M = 1210$',
      comentarios: { A: 'simples', B: 'Correta.' }
    }
    expect(resolucaoPorLetra(q).resto).toBe(q.resolucao)
    expect(resolucaoPorLetra({ ...q, comentarios: { A: 'simples' } })).toEqual({
      porLetra: { A: 'simples', B: q.resolucao },
      resto: ''
    })
  })
})

describe('fórmulas dentro do Markdown (anotação e flashcard)', () => {
  // o mesmo caminho do renderizarMarkdown, com a fórmula desenhada como [tex]
  const md = async (texto: string): Promise<string> => {
    const { marked } = await import('marked')
    const { trocarFormulasPorMarcas, devolverFormulas } = await import('../src/shared/formulas')
    const t = trocarFormulasPorMarcas(texto)
    const html = marked.parse(t.texto, { async: false, gfm: true, breaks: true })
    return devolverFormulas(html, t.formulas, (f) => `[${f.tex}]`).trim()
  }

  it('dinheiro no começo da linha continua dinheiro', async () => {
    expect(await md('R$100 e R$ 200')).toBe('<p>R$100 e R$ 200</p>')
    expect(await md('**R**$1 e $x$')).toBe('<p><strong>R</strong>$1 e [x]</p>')
  })

  it('fórmula com _ e * não vira itálico', async () => {
    expect(await md('Taxa $i_a = i_m * 12$ e *nota*')).toBe(
      '<p>Taxa [i_a = i_m * 12] e <em>nota</em></p>'
    )
  })
})
