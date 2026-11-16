import { describe, expect, it } from 'vitest'
import {
  ajusteSugerido,
  blocoDeAdaptacao,
  diagnosticar,
  nivelAjustado,
  planejar,
  repartir
} from '../src/shared/adaptado'
import { montarPrompt } from '../src/shared/questoes'
import type { Questao, Simulado } from '../src/shared/tipos'

const questao = (topico: string | undefined, i: number, habilidade = 'aplicar regra'): Questao => ({
  enunciado: `Q${i} sobre ${topico ?? 'algo'}`,
  alternativas: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({ letra, texto: letra })),
  gabarito: 'A',
  resolucao: 'r',
  ...(topico ? { topico, habilidade } : {}),
  conceito: 'c'
})

/** O cenário do Matheus: 50 questões FCC de conhecimentos bancários,
 *  40 certas e 10 erradas (4 títulos de renda fixa, 2 juros compostos,
 *  4 swap cambial). */
function cenario(): Simulado {
  const blocos: [string, number, number][] = [
    ['Títulos de renda fixa', 12, 4],
    ['Juros compostos', 10, 2],
    ['Swap cambial', 8, 4],
    ['Sistema Financeiro Nacional', 10, 0],
    ['Mercado de câmbio', 10, 0]
  ]
  const questoes: Questao[] = []
  const respostas: (string | null)[] = []
  for (const [topico, n, erros] of blocos) {
    for (let i = 0; i < n; i++) {
      questoes.push(questao(topico, questoes.length))
      respostas.push(i < erros ? 'B' : 'A')
    }
  }
  return {
    id: 's',
    config: {
      tema: 'Conhecimentos bancários',
      assuntoId: null,
      nivel: 'medio',
      tipo: 'multipla',
      quantidade: 50,
      tempoMin: 120,
      banca: 'FCC'
    },
    questoes,
    respostas,
    revisar: questoes.map(() => false),
    tempoPorQuestao: questoes.map(() => 60000),
    decorridoMs: 50 * 60000,
    atual: 0,
    criadoEm: 0,
    entregueEm: 1
  }
}

describe('cenário: 50 questões FCC, 40 certas', () => {
  const d = diagnosticar(cenario())
  it('diagnostica 80% e os 3 tópicos com erro, do que mais errou ao que menos', () => {
    expect(d.acertos).toBe(40)
    expect(d.pct).toBe(80)
    expect(d.porTopico.filter((t) => t.erros).map((t) => [t.topico, t.erros])).toEqual([
      ['Títulos de renda fixa', 4],
      ['Swap cambial', 4],
      ['Juros compostos', 2]
    ])
  })
  it('sugere subir (80%)', () => {
    expect(ajusteSugerido(d.pct)).toBe('subir')
    expect(nivelAjustado('medio', 'subir')).toBe('dificil')
  })
  it('50 novas: 30 de reforço (12/12/6) e 20 mantendo os outros assuntos (10/10)', () => {
    const plano = planejar(d, 50, true)
    const q = Object.fromEntries(plano.map((p) => [p.topico, [p.quantidade, p.reforco]]))
    expect(q).toEqual({
      'Títulos de renda fixa': [12, true],
      'Swap cambial': [12, true],
      'Juros compostos': [6, true],
      'Sistema Financeiro Nacional': [10, false],
      'Mercado de câmbio': [10, false]
    })
    expect(plano.reduce((a, p) => a + p.quantidade, 0)).toBe(50)
  })
  it('o prompt completo pede a distribuição, o conceito maior e o arquivo', () => {
    const bloco = blocoDeAdaptacao(
      d,
      {
        quantidade: 50,
        insistir: true,
        foco: 'edital',
        edital: '',
        banca: 'FCC',
        ajuste: 'manter'
      },
      []
    )
    const prompt = montarPrompt({ ...cenario().config, quantidade: 50 }, 'claude', bloco)
    expect(prompt).toContain(
      '- Títulos de renda fixa: 12 questões — REFORÇO: ele errou 4 questões (habilidade: aplicar regra)'
    )
    expect(prompt).toContain('- Mercado de câmbio: 10 questões\n')
    expect(prompt).toContain('4 a 5 frases e um exemplo')
    expect(prompt).toContain('a banca FCC')
    expect(prompt).toContain('<adaptacao>')
    expect(prompt).toContain('simulado.json')
    expect(prompt).toContain('"topico"')
  })
})

describe('casos de borda', () => {
  it('reparte somando exatamente o total', () => {
    expect(repartir(10, [1, 1, 1])).toEqual([4, 3, 3])
    expect(repartir(7, [0, 0])).toEqual([0, 0])
  })
  it('errou em todos os tópicos: tudo vira reforço', () => {
    const s = cenario()
    s.respostas = s.questoes.map(() => 'B')
    const plano = planejar(diagnosticar(s), 20, true)
    expect(plano.every((p) => p.reforco)).toBe(true)
    expect(plano.reduce((a, p) => a + p.quantidade, 0)).toBe(20)
  })
  it('sem insistir: reparte pelo tamanho de cada tópico, sem repetir', () => {
    const plano = planejar(diagnosticar(cenario()), 50, false)
    expect(plano.every((p) => !p.reforco)).toBe(true)
    expect(new Set(plano.map((p) => p.topico)).size).toBe(plano.length)
    expect(plano.reduce((a, p) => a + p.quantidade, 0)).toBe(50)
  })
  it('simulado antigo sem marcador: manda as questões erradas', () => {
    const s = cenario()
    s.questoes = s.questoes.map((q) => ({ ...q, topico: undefined, habilidade: undefined }))
    const d = diagnosticar(s)
    expect(d.porTopico).toEqual([])
    expect(d.erradasSemTopico).toHaveLength(10)
    const bloco = blocoDeAdaptacao(
      d,
      { quantidade: 50, insistir: true, foco: 'base', edital: '', banca: '', ajuste: 'subir' },
      []
    )
    expect(bloco).toContain('Faça cerca de 30 das 50')
    expect(bloco).toContain('base teórica')
    expect(bloco).toContain('aumente a dificuldade')
  })
})

describe('simulado misto (com e sem marcador)', () => {
  it('erros sem marcador entram no reforço mesmo havendo tópicos marcados', () => {
    const s = cenario()
    // a única marcada foi acertada; as 9 sem marcador, erradas
    s.questoes = s.questoes
      .slice(0, 10)
      .map((q, i) => (i === 0 ? q : { ...q, topico: undefined, habilidade: undefined }))
    s.respostas = s.questoes.map((_, i) => (i === 0 ? 'A' : 'B'))
    const d = diagnosticar(s)
    const plano = planejar(d, 10, true)
    const reforco = plano.filter((p) => p.reforco)
    expect(reforco).toHaveLength(1)
    expect(reforco[0].quantidade).toBe(6)
    const bloco = blocoDeAdaptacao(
      d,
      {
        quantidade: 10,
        insistir: true,
        foco: 'equilibrado',
        edital: '',
        banca: '',
        ajuste: 'manter'
      },
      []
    )
    expect(bloco).toContain('Questões sem marcador que ele errou')
    // o enunciado da questão de teste continua o original (só o marcador foi tirado)
    expect(bloco).toContain('"Q1 sobre Títulos de renda fixa"')
    expect(bloco).not.toMatch(/Use em "topico".*sem marcador/)
  })
})
