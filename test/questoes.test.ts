import { describe, expect, it } from 'vitest'
import { acertos, formatarTempo, lerRespostaDaIa, montarPrompt } from '../src/shared/questoes'
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
