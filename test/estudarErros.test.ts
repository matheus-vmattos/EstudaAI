import { describe, expect, it } from 'vitest'
import {
  anotacaoComRevisao,
  blocoDaRevisao,
  buscaNoYoutube,
  montarPromptDeEstudo,
  questoesParaEstudar,
  termosDaVideoaula
} from '../src/shared/estudarErros'
import { diagnosticar, planejar } from '../src/shared/adaptado'
import { lerRespostaDaIa } from '../src/shared/questoes'
import type { Questao, Simulado } from '../src/shared/tipos'

const q = (topico: string, gabarito = 'B'): Questao => ({
  enunciado: `Pergunta de ${topico}`,
  alternativas: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({ letra, texto: `opção ${letra}` })),
  gabarito,
  resolucao: 'porque sim',
  topico
})

const simulado = (
  respostas: (string | null)[],
  revisar: boolean[],
  topicos: string[]
): Simulado => ({
  id: 's',
  config: {
    tema: 'Juros',
    assuntoId: null,
    nivel: 'medio',
    tipo: 'multipla',
    quantidade: topicos.length,
    tempoMin: 10,
    banca: 'FCC'
  },
  questoes: topicos.map((t) => q(t)),
  respostas,
  revisar,
  tempoPorQuestao: topicos.map(() => 0),
  decorridoMs: 0,
  atual: 0,
  criadoEm: 0,
  entregueEm: 1
})

describe('marcar para revisar conta', () => {
  const s = simulado(
    ['A', 'B', 'B', null, 'B'],
    [true, true, false, false, false],
    ['Swap', 'Juros compostos', 'Juros compostos', 'Swap', 'CDB']
  )

  it('entram as erradas, as em branco e as acertadas com dúvida', () => {
    expect(questoesParaEstudar(s)).toEqual([
      { indice: 0, motivo: 'errou' },
      { indice: 1, motivo: 'duvida' },
      { indice: 3, motivo: 'branco' }
    ])
  })

  it('o adaptado reforça o acerto com dúvida, com metade do peso de um erro', () => {
    const d = diagnosticar(s)
    const jc = d.porTopico.find((t) => t.topico === 'Juros compostos')!
    expect([jc.erros, jc.duvidas]).toEqual([0, 1])
    const plano = planejar(d, 10, true)
    const reforco = Object.fromEntries(
      plano.filter((p) => p.reforco).map((p) => [p.topico, p.quantidade])
    )
    // 6 de reforço, pesos Swap 2 e Juros 0,5
    expect(reforco).toEqual({ Swap: 5, 'Juros compostos': 1 })
    expect(plano.find((p) => p.topico === 'CDB')).toMatchObject({ reforco: false, quantidade: 4 })
  })
})

describe('prompt de estudo', () => {
  const s = simulado(['A', 'B'], [false, true], ['Swap', 'Juros'])
  it('leva a minha resposta, o gabarito e pede só links de busca', () => {
    const p = montarPromptDeEstudo(s, [0, 1], 'claude')
    expect(p).toContain('Minha resposta: A) opção A')
    expect(p).toContain('Gabarito: B) opção B')
    expect(p).toContain('Acertei, mas marquei para revisar')
    expect(p).toContain('Onde o raciocínio desviou')
    expect(p).toContain('https://www.youtube.com/results?search_query=')
    expect(p.startsWith('<pedido>')).toBe(true)
    expect(montarPromptDeEstudo(s, [0], 'gpt').startsWith('<pedido>')).toBe(false)
  })
})

describe('vídeo-aula', () => {
  it('busca no YouTube com os termos da IA, ou com o tópico em simulado antigo', () => {
    expect(buscaNoYoutube('juros compostos FCC')).toBe(
      'https://www.youtube.com/results?search_query=juros%20compostos%20FCC'
    )
    expect(termosDaVideoaula(q('Swap cambial'), 'Bancário')).toBe('Swap cambial concurso')
    expect(
      termosDaVideoaula({ ...q('x'), videoaula: { busca: 'swap cambial aula', canais: [] } }, 'T')
    ).toBe('swap cambial aula')
  })

  it('a resposta da IA traz a videoaula (opcional, sem quebrar se faltar)', () => {
    const base = {
      enunciado: 'e',
      alternativas: { A: '1', B: '2', C: '3', D: '4', E: '5' },
      gabarito: 'A',
      resolucao: 'r'
    }
    const r = lerRespostaDaIa(
      JSON.stringify({
        questoes: [
          { ...base, videoaula: { busca: 'swap cambial', canais: ['Canal X', 7, ''] } },
          { ...base, videoaula: 'texto solto' }
        ]
      })
    )
    expect(r.ok && r.questoes.map((x) => x.videoaula)).toEqual([
      { busca: 'swap cambial', canais: ['Canal X'] },
      undefined
    ])
  })
})

describe('resposta vira anotação', () => {
  it('entra no fim, sem apagar nada, com os títulos um nível abaixo', () => {
    const bloco = blocoDaRevisao('## Questão 1 — Swap\nTexto', new Date('2026-11-17T12:00:00'))
    expect(bloco).toBe('## Revisão de erros — 17/11\n\n### Questão 1 — Swap\nTexto\n')
    expect(anotacaoComRevisao('Minha nota', bloco)).toBe(`Minha nota\n\n${bloco}`)
    expect(anotacaoComRevisao('', bloco)).toBe(bloco)
  })
})
