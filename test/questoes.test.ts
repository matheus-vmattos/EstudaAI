import { describe, expect, it } from 'vitest'
import {
  acertos,
  formatarTempo,
  lerRespostaDaIa,
  montarPrompt,
  refazerEmbaralhado,
  resolucaoPorLetra
} from '../src/shared/questoes'
import type { ConfigDoSimulado } from '../src/shared/tipos'

const config: ConfigDoSimulado = {
  tema: 'Colocação pronominal',
  assuntoId: null,
  nivel: 'medio',
  tipo: 'multipla',
  quantidade: 20,
  tempoMin: 60,
  banca: ''
}

const questao = {
  enunciado: 'Qual está correta?',
  alternativas: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
  gabarito: 'b',
  resolucao: 'Porque sim.'
}

describe('montarPrompt', () => {
  it('leva tema, nível, quantidade e banca', () => {
    const p = montarPrompt({ ...config, banca: 'FGV' }, 'gpt')
    expect(p).toContain('20 questões')
    expect(p).toContain('MÉDIO')
    expect(p).toContain('"Colocação pronominal"')
    expect(p).toContain('banca FGV')
  })
  it('usa tags XML para o Claude', () => {
    expect(montarPrompt(config, 'claude')).toContain('<entrega>')
    expect(montarPrompt(config, 'gpt')).not.toContain('<tarefa>')
  })
  it('pede C/E no certo ou errado', () => {
    expect(montarPrompt({ ...config, tipo: 'certoErrado' }, 'gpt')).toContain('"C": "Certo"')
  })
})

describe('lerRespostaDaIa', () => {
  it('aceita JSON dentro de bloco de código com texto em volta', () => {
    const r = lerRespostaDaIa(
      'Aqui está:\n```json\n' + JSON.stringify({ tema: 'X', questoes: [questao] }) + '\n```'
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.tipo).toBe('multipla')
      expect(r.questoes[0].gabarito).toBe('B')
      expect(r.questoes[0].alternativas).toHaveLength(5)
    }
  })
  it('aceita certo/errado', () => {
    const r = lerRespostaDaIa(
      JSON.stringify({
        questoes: [{ ...questao, alternativas: { C: 'Certo', E: 'Errado' }, gabarito: 'E' }]
      })
    )
    expect(r.ok && r.tipo).toBe('certoErrado')
  })
  it('diz qual questão está com problema', () => {
    const r = lerRespostaDaIa(
      JSON.stringify({ questoes: [questao, { ...questao, gabarito: 'F' }] })
    )
    expect(r).toEqual({ ok: false, erro: expect.stringContaining('Questão 2') })
  })
  it('recusa resolução vazia e texto sem JSON', () => {
    expect(lerRespostaDaIa(JSON.stringify({ questoes: [{ ...questao, resolucao: ' ' }] })).ok).toBe(
      false
    )
    expect(lerRespostaDaIa('desculpe, não consigo').ok).toBe(false)
  })
})

describe('utilitários', () => {
  it('formata o tempo', () => {
    expect(formatarTempo(3725000)).toBe('01:02:05')
    expect(formatarTempo(161000)).toBe('02:41')
    expect(formatarTempo(-5)).toBe('00:00')
  })
  it('conta acertos', () => {
    const r = lerRespostaDaIa(JSON.stringify({ questoes: [questao, questao] }))
    if (!r.ok) throw new Error()
    expect(acertos(r.questoes, ['B', null])).toBe(1)
  })
})

describe('alternativas fora de ordem', () => {
  it('aceita e ordena A→E e C/E', () => {
    const r = lerRespostaDaIa(
      JSON.stringify({
        questoes: [{ ...questao, alternativas: { E: 'e', D: 'd', C: 'c', B: 'b', A: 'a' } }]
      })
    )
    expect(r.ok && r.questoes[0].alternativas.map((a) => a.letra).join('')).toBe('ABCDE')
    const ce = lerRespostaDaIa(
      JSON.stringify({
        questoes: [{ ...questao, alternativas: { E: 'Errado', C: 'Certo' }, gabarito: 'C' }]
      })
    )
    expect(ce.ok && ce.tipo).toBe('certoErrado')
  })
})

describe('gabarito não aparece na conversa', () => {
  it('pede arquivo para baixar e proíbe mostrar as respostas', () => {
    for (const ia of ['claude', 'gpt'] as const) {
      const p = montarPrompt(config, ia)
      expect(p).toContain('simulado.json')
      expect(p).toContain('NÃO escreva as questões')
    }
  })
})

describe('texto copiado da conversa', () => {
  const json = JSON.stringify({ questoes: [questao] }, null, 2)
  it('aceita aspas curvas', () => {
    expect(lerRespostaDaIa(json.replace(/"/g, '“')).ok).toBe(true)
  })
  it('aceita vírgula sobrando no fim', () => {
    expect(
      lerRespostaDaIa(json.replace(/"resolucao": "Porque sim."/, '"resolucao": "Porque sim.",')).ok
    ).toBe(true)
  })
  it('não estraga aspas curvas que estão dentro de um texto válido', () => {
    const r = lerRespostaDaIa(
      JSON.stringify({ questoes: [{ ...questao, enunciado: 'Na palavra “chuva”…' }] })
    )
    expect(r.ok && r.questoes[0].enunciado).toBe('Na palavra “chuva”…')
  })
})

describe('conserto do JSON não mexe no texto das questões', () => {
  const base = { questoes: [{ ...questao, enunciado: 'O trecho [,] e {,} ficam como estão.' }] }
  it('vírgula sobrando: tira só a da estrutura', () => {
    const json = JSON.stringify(base, null, 2).replace(/\n}$/, ',\n}')
    const r = lerRespostaDaIa(json)
    expect(r.ok && r.questoes[0].enunciado).toBe('O trecho [,] e {,} ficam como estão.')
  })
  it('aspas curvas válidas dentro do texto + vírgula sobrando', () => {
    const json = JSON.stringify({
      questoes: [{ ...questao, enunciado: 'Na palavra “chuva”, há dígrafo.' }]
    }).replace(/}]}$/, '},]}')
    const r = lerRespostaDaIa(json)
    expect(r.ok && r.questoes[0].enunciado).toBe('Na palavra “chuva”, há dígrafo.')
  })
  it('tudo com aspas curvas e aspa reta dentro do texto', () => {
    const json = JSON.stringify(base)
      .replace(/"/g, '“')
      .replace('ficam como estão.', 'ficam "como" estão.')
    const r = lerRespostaDaIa(json)
    expect(r.ok && r.questoes[0].enunciado).toBe('O trecho [,] e {,} ficam "como" estão.')
  })
})

describe('escape com aspa curva', () => {
  it('\\" que virou \\“ na conversa continua sendo aspa dentro do texto', () => {
    const json = JSON.stringify({
      questoes: [{ ...questao, resolucao: 'O "não" atrai.' }]
    }).replace(/"/g, '“')
    const r = lerRespostaDaIa(json)
    expect(r.ok && r.questoes[0].resolucao).toBe('O "não" atrai.')
  })
})

describe('gabarito organizado (v0.1.4)', () => {
  it('o prompt pede comentários por letra e o conceito', () => {
    const p = montarPrompt(config, 'gpt')
    expect(p).toContain('"comentarios"')
    expect(p).toContain('"conceito"')
  })
  it('lê comentários e conceito, ignorando letras que não existem', () => {
    const r = lerRespostaDaIa(
      JSON.stringify({
        questoes: [
          { ...questao, comentarios: { a: 'errada', B: 'certa', Z: 'x' }, conceito: 'Regra geral.' }
        ]
      })
    )
    expect(r.ok && r.questoes[0].comentarios).toEqual({ A: 'errada', B: 'certa' })
    expect(r.ok && r.questoes[0].conceito).toBe('Regra geral.')
  })
  it('simulado antigo: quebra a resolução da captura por letra', () => {
    const q = {
      enunciado: 'x',
      alternativas: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({ letra, texto: letra })),
      gabarito: 'E',
      resolucao:
        "E correta: na análise escolar, o 'n' nasaliza a vogal 'e' em 'enxame' e não representa consoante autônoma, formando dígrafo vocálico. A errada: não há duas consoantes nesse segmento. B errada: não há duas unidades vocálicas orais. C errada: não há três unidades vocálicas. D errada: não há vogais em sílabas distintas nesse segmento."
    }
    const { porLetra, resto } = resolucaoPorLetra(q)
    expect(Object.keys(porLetra).sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(porLetra.A).toBe('não há duas consoantes nesse segmento.')
    expect(porLetra.E).toMatch(/^na análise escolar.*dígrafo vocálico\.$/)
    expect(resto).toBe('')
  })
  it('sem padrão reconhecível, não arrisca', () => {
    const q = {
      enunciado: 'x',
      alternativas: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({ letra, texto: letra })),
      gabarito: 'B',
      resolucao: 'A regra diz que a próclise é obrigatória com palavras atrativas.'
    }
    expect(resolucaoPorLetra(q)).toEqual({ porLetra: {}, resto: q.resolucao })
  })
  it('com comentários, o resumo vai para o gabarito se faltar', () => {
    const q = {
      ...questao,
      gabarito: 'B',
      resolucao: 'Resumo.',
      alternativas: [],
      comentarios: { A: 'a' }
    }
    expect(resolucaoPorLetra(q).porLetra).toEqual({ A: 'a', B: 'Resumo.' })
  })
})

describe('refazer embaralhado', () => {
  it('mesmas questões, outra ordem, tudo zerado', () => {
    const r = lerRespostaDaIa(
      JSON.stringify({
        questoes: ['1', '2', '3', '4'].map((e) => ({ ...questao, enunciado: `Q${e}` }))
      })
    )
    if (!r.ok) throw new Error()
    const original = {
      id: 's1',
      config: { ...config, quantidade: 4 },
      questoes: r.questoes,
      respostas: ['B', 'A', null, 'B'],
      revisar: [true, false, false, false],
      tempoPorQuestao: [1, 2, 3, 4],
      decorridoMs: 10,
      atual: 3,
      criadoEm: 1,
      entregueEm: 2
    }
    let semente = 0.3
    const novo = refazerEmbaralhado(original, 's2', 99, () => (semente = (semente * 7.3) % 1))
    expect(novo.id).toBe('s2')
    expect(novo.questoes.map((q) => q.enunciado).sort()).toEqual(['Q1', 'Q2', 'Q3', 'Q4'])
    expect(novo.questoes.map((q) => q.enunciado)).not.toEqual(['Q1', 'Q2', 'Q3', 'Q4'])
    expect(novo.respostas).toEqual([null, null, null, null])
    expect(novo.entregueEm).toBeNull()
    expect(original.questoes.map((q) => q.enunciado)).toEqual(['Q1', 'Q2', 'Q3', 'Q4'])
  })
})
