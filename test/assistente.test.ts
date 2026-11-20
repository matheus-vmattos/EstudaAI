import { describe, expect, it } from 'vitest'
import { raioX } from '../src/shared/raioX'
import { chanceDeAprovacao, fraseDaChance, respostasDaMateria } from '../src/shared/chance'
import {
  feitaPelosDados,
  lerPacoteDeMissao,
  pontosDaMissao,
  promptDeConferir
} from '../src/shared/missao'
import { agendaNova } from '../src/shared/flashcards'
import {
  DADOS_VAZIOS,
  type Dados,
  type Edital,
  type Questao,
  type Simulado
} from '../src/shared/tipos'

const q = (topico: string, gabarito = 'A'): Questao => ({
  enunciado: `sobre ${topico}`,
  alternativas: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({ letra, texto: letra })),
  gabarito,
  resolucao: 'r',
  topico
})

/** simulado entregue: cada item = [tópico, acertou?, segundos, marcou dúvida?] */
const sim = (
  linhas: [string, boolean, number, boolean?][],
  extra: Partial<Simulado> = {}
): Simulado => ({
  id: 's',
  config: {
    tema: 't',
    assuntoId: null,
    nivel: 'medio',
    tipo: 'multipla',
    quantidade: linhas.length,
    tempoMin: 30,
    banca: 'FCC'
  },
  questoes: linhas.map(([t]) => q(t)),
  respostas: linhas.map(([, ok]) => (ok ? 'A' : 'B')),
  revisar: linhas.map(([, , , d]) => !!d),
  tempoPorQuestao: linhas.map(([, , seg]) => seg * 1000),
  decorridoMs: 0,
  atual: 0,
  criadoEm: 0,
  entregueEm: 1,
  ...extra
})

describe('Raio-X do simulado', () => {
  // o simulado de Bancários de 19/11 (27/30), resumido: ritmo de 23 s
  const firmes = Array.from({ length: 24 }, (_, i): [string, boolean, number] => [
    `SFN ${i}`,
    true,
    23
  ])
  const s = sim([
    ...firmes,
    ['Tributação de investimentos', true, 101, true],
    ['Caderneta de poupança', true, 37, true],
    ['Títulos públicos federais', true, 36, true],
    ['Títulos públicos federais', false, 21, true],
    ['Cheque', false, 44, true],
    ['Garantias do crédito', false, 38, true]
  ])
  const r = raioX(s)

  it('classifica pelo tempo e pelo acerto', () => {
    expect(r.ritmo).toBe(23000)
    expect(r.porFaixa.domina).toHaveLength(24)
    expect(r.porFaixa.fragil.map((x) => x.topico)).toEqual([
      'Tributação de investimentos',
      'Caderneta de poupança',
      'Títulos públicos federais'
    ])
    // errou em 21 s (abaixo do ritmo): engano; errou devagar: lacuna
    expect(r.porFaixa.engano.map((x) => x.topico)).toEqual(['Títulos públicos federais'])
    expect(r.porFaixa.lacuna.map((x) => x.topico)).toEqual(['Cheque', 'Garantias do crédito'])
    expect(r.certas).toBe(27)
    expect(r.porFaixa.fragil[0].vezes).toBeCloseTo(101 / 23)
  })
  it('a frase diz o que o placar esconde', () => {
    expect(r.frase).toBe(
      'Acertou bastante, mas mostrou lacuna em Títulos públicos federais. Você não sabia Cheque e Garantias do crédito.'
    )
  })
  it('certa demorada (mais que o dobro do ritmo) sem dúvida também é frágil', () => {
    const x = raioX(
      sim([
        ['a', true, 10],
        ['b', true, 10],
        ['c', true, 10],
        ['d', true, 25]
      ])
    )
    expect(x.porFaixa.fragil.map((i) => i.topico)).toEqual(['d'])
  })
  it('sem tempo medido não chuta engano: errada é lacuna', () => {
    const x = raioX(
      sim([
        ['a', true, 0],
        ['b', false, 0],
        ['c', true, 0, true]
      ])
    )
    expect(x.ritmo).toBeNull()
    expect(x.porFaixa.engano).toHaveLength(0)
    expect(x.porFaixa.lacuna.map((i) => i.topico)).toEqual(['b'])
    expect(x.porFaixa.fragil.map((i) => i.topico)).toEqual(['c'])
  })
  it('em branco é lacuna; tudo certo e no ritmo é "tudo firme"', () => {
    const branco = sim([
      ['a', true, 10],
      ['b', true, 10]
    ])
    branco.respostas[1] = null
    expect(raioX(branco).porFaixa.lacuna).toHaveLength(1)
    expect(
      raioX(
        sim([
          ['a', true, 10],
          ['b', true, 11]
        ])
      ).frase
    ).toBe('Tudo firme: acertou no seu ritmo, sem dúvida.')
  })
})

const EDITAL: Edital = {
  nome: 'Banestes · TB',
  banca: 'FCC',
  dataProva: '2027-01-24',
  notaMinima: 6,
  materias: [
    { materiaId: 'port', questoes: 10, peso: 1, texto: '' },
    { materiaId: 'rl', questoes: 10, peso: 1, texto: '' },
    { materiaId: 'atu', questoes: 5, peso: 1, texto: '' },
    { materiaId: 'etica', questoes: 5, peso: 1, texto: '' },
    { materiaId: 'banc', questoes: 15, peso: 2, texto: '' },
    { materiaId: 'mf', questoes: 5, peso: 2, texto: '' },
    { materiaId: 'est', questoes: 5, peso: 2, texto: '' },
    { materiaId: 'info', questoes: 5, peso: 2, texto: '' },
    { materiaId: 'vendas', questoes: 10, peso: 2, texto: '' }
  ]
}
const dadosDoEdital = (): Dados => {
  const d: Dados = structuredClone(DADOS_VAZIOS)
  for (const m of EDITAL.materias)
    d.materias.push({
      id: m.materiaId,
      nome: m.materiaId,
      aberta: true,
      assuntos: [{ id: `${m.materiaId}-a`, nome: 'a', nota: '', atualizadoEm: 0 }]
    })
  d.edital = EDITAL
  return d
}
const daMateria = (materiaId: string, certas: number, total: number, entregueEm = 1): Simulado => {
  const s = sim(
    Array.from({ length: total }, (_, i): [string, boolean, number] => ['x', i < certas, 20]),
    { entregueEm }
  )
  return { ...s, id: `${materiaId}-${entregueEm}`, config: { ...s.config, materiaId } }
}

describe('Chance de aprovação', () => {
  it('nada medido: sem nota, falta medir tudo', () => {
    const c = chanceDeAprovacao(dadosDoEdital(), EDITAL)
    expect(c.nota).toBeNull()
    expect(c.faltaMedir).toBeCloseTo(1)
    expect(c.materias.every((m) => m.nivel === 'nunca')).toBe(true)
  })
  it('como a banca: com tudo medido a 60%, a nota é 6,0', () => {
    const d = dadosDoEdital()
    for (const m of EDITAL.materias) d.simulados.push(daMateria(m.materiaId, 6, 10))
    const c = chanceDeAprovacao(d, EDITAL)
    expect(c.nota).toBeCloseTo(6)
    expect(c.faltaMedir).toBeCloseTo(0)
    expect(c.medidas).toBe(70)
  })
  it('só Bancários medido (90%): nota 9,0 e falta medir 75% da nota', () => {
    const d = dadosDoEdital()
    d.simulados.push(daMateria('banc', 27, 30))
    const c = chanceDeAprovacao(d, EDITAL)
    expect(c.nota).toBeCloseTo(9)
    // Bancários vale 15/40 × 2/3 = 25% da nota
    expect(c.faltaMedir).toBeCloseTo(0.75)
    expect(c.medidas).toBe(15)
    expect(c.materias.find((m) => m.materiaId === 'banc')!.nivel).toBe('firme')
  })
  it('vale o recente: as 40 últimas questões da matéria', () => {
    const d = dadosDoEdital()
    d.simulados.push(daMateria('rl', 0, 40, 1), daMateria('rl', 40, 40, 2))
    expect(chanceDeAprovacao(d, EDITAL).materias.find((m) => m.materiaId === 'rl')!.acerto).toBe(1)
  })
  it('a parte da matéria numa prova completa também conta', () => {
    const d = dadosDoEdital()
    const p = sim(
      [
        ['x', true, 20],
        ['x', false, 20],
        ['x', true, 20]
      ],
      {
        prova: {
          materias: [
            { materiaId: 'port', nome: 'Português', peso: 1, de: 0, ate: 2 },
            { materiaId: 'rl', nome: 'RL', peso: 1, de: 2, ate: 3 }
          ]
        }
      }
    )
    d.simulados.push(p)
    expect(respostasDaMateria(d, 'port')).toEqual([false, true])
    expect(respostasDaMateria(d, 'rl')).toEqual([true])
  })
  it('estudou cartões mas nunca fez simulado: "começando", sem acerto', () => {
    const d = dadosDoEdital()
    d.cartoes.push({
      id: 'c',
      assuntoId: 'est-a',
      tipo: 'basico',
      frente: 'f',
      verso: 'v',
      agenda: agendaNova(new Date()),
      criadoEm: 0,
      primeiraRevisao: 5
    })
    const m = chanceDeAprovacao(d, EDITAL).materias.find((x) => x.materiaId === 'est')!
    expect([m.nivel, m.acerto]).toEqual(['comecando', null])
  })
})

describe('Missão da semana', () => {
  const pacote = JSON.stringify({
    de: '2026-11-23',
    ate: '2026-11-29',
    frase: 'f',
    tarefas: [
      {
        id: 'inf',
        tipo: 'simulado',
        titulo: 'Primeiro contato: Informática',
        detalhe: 'd',
        pontos: 150,
        item: 'i1',
        tema: 'Primeiro contato com informática'
      },
      { id: 'lac', tipo: 'cartoes', titulo: 'Lacunas', detalhe: 'd', pontos: 100, item: 'i2' },
      { id: 'atr', tipo: 'atrasados', titulo: 'Zerar atrasados', detalhe: 'd', pontos: 180 },
      {
        id: 'exp',
        tipo: 'explicar',
        titulo: 'Explique',
        detalhe: 'd',
        pontos: 20,
        topico: 'Tributação de investimentos',
        pergunta: 'Como funciona a tabela regressiva?'
      }
    ]
  })
  it('lê o arquivo e recusa tarefa incompleta', () => {
    const r = lerPacoteDeMissao(pacote, 'm1', 100)
    expect(r.ok && r.missao.tarefas.map((t) => t.tipo)).toEqual([
      'simulado',
      'cartoes',
      'atrasados',
      'explicar'
    ])
    expect(r.ok && pontosDaMissao(r.missao)).toEqual({ feitos: 0, total: 450 })
    const ruim = lerPacoteDeMissao(
      JSON.stringify({ de: 'a', ate: 'b', tarefas: [{ tipo: 'simulado', titulo: 'x' }] }),
      'm',
      0
    )
    expect(ruim).toEqual({ ok: false, erro: 'Tarefa 1: tipo "simulado" incompleto.' })
  })
  it('vê pelos dados o que já foi feito', () => {
    const r = lerPacoteDeMissao(pacote, 'm1', 100)
    if (!r.ok) throw new Error(r.erro)
    const m = r.missao
    const d = dadosDoEdital()
    const [inf, lac, atr, exp] = m.tarefas
    expect(feitaPelosDados(d, m, inf)).toBe(false)
    d.simulados.push({
      ...daMateria('info', 5, 10),
      config: { ...daMateria('info', 5, 10).config, tema: 'Primeiro contato com Informática' }
    })
    expect(feitaPelosDados(d, m, inf)).toBe(true)
    // cartões: os do pacote (pela frente) todos vistos
    m.cartoesFrentes = { lac: ['a', 'b'] }
    d.cartoes.push(
      {
        id: 'a',
        assuntoId: 'banc-a',
        tipo: 'basico',
        frente: 'a',
        verso: '',
        agenda: agendaNova(new Date()),
        criadoEm: 5000,
        primeiraRevisao: 1
      },
      {
        id: 'b',
        assuntoId: 'banc-a',
        tipo: 'basico',
        frente: 'b',
        verso: '',
        agenda: agendaNova(new Date()),
        criadoEm: 5001
      }
    )
    expect(feitaPelosDados(d, m, lac)).toBe(false)
    d.cartoes[1].primeiraRevisao = 2
    expect(feitaPelosDados(d, m, lac)).toBe(true)
    // os cartões acima têm agenda de cartão novo (contam como "de hoje"); sem
    // cartão nenhum para hoje, a tarefa de zerar está feita
    expect(feitaPelosDados(dadosDoEdital(), m, atr)).toBe(true)
    expect(feitaPelosDados(d, m, exp)).toBe(false)
    d.explicacoes = [
      { id: 'x', criadoEm: 50, topico: 'Tributação de investimentos', pergunta: 'p', texto: 't' }
    ]
    expect(feitaPelosDados(d, m, exp)).toBe(false) // escrita antes da missão chegar
    d.explicacoes[0].criadoEm = 200
    expect(feitaPelosDados(d, m, exp)).toBe(true)
  })
  it('o pedido de correção leva a explicação e o conceito da questão', () => {
    const p = promptDeConferir(EDITAL, 'Cheque', 'Prazo?', 'É de 30 dias.', {
      ...q('Cheque'),
      conceito: '30 ou 60 dias'
    })
    expect(p).toContain('Banestes · TB (banca FCC)')
    expect(p).toContain('É de 30 dias.')
    expect(p).toContain('Gabarito: A. 30 ou 60 dias')
  })
})

describe('Raio-X: frase com engano e nível com pouca evidência', () => {
  it('o engano (errou rápido) aparece na frase', () => {
    const x = raioX(
      sim([
        ['a', true, 10],
        ['b', true, 10],
        ['c', true, 10],
        ['d', false, 2]
      ])
    )
    expect(x.frase).toBe('Cuidado com d: errou rápido, achando que sabia.')
  })
  it('um simulado de 10 questões a 80% ainda é "firmando"', () => {
    const d = dadosDoEdital()
    d.simulados.push(daMateria('info', 8, 10))
    expect(chanceDeAprovacao(d, EDITAL).materias.find((m) => m.materiaId === 'info')!.nivel).toBe(
      'firmando'
    )
  })
})

describe('revisão do Codex (PR 22)', () => {
  it('sem nota mínima no edital, não diz que passaria', () => {
    const d = dadosDoEdital()
    const semMinimo: Edital = { ...EDITAL, notaMinima: undefined }
    for (const m of EDITAL.materias) d.simulados.push(daMateria(m.materiaId, 0, 10))
    const c = chanceDeAprovacao(d, semMinimo)
    expect(c.nota).toBe(0)
    expect(fraseDaChance(c)).not.toContain('passaria')
  })
  it('"zerar os cartões de hoje" espera também os novos do dia', () => {
    const r = lerPacoteDeMissao(
      JSON.stringify({
        de: 'a',
        ate: 'b',
        tarefas: [{ id: 'atr', tipo: 'atrasados', titulo: 'Zerar', pontos: 1 }]
      }),
      'm',
      0
    )
    if (!r.ok) throw new Error(r.erro)
    const d = dadosDoEdital()
    d.cartoes.push({
      id: 'n',
      assuntoId: 'banc-a',
      tipo: 'basico',
      frente: 'nova',
      verso: '',
      agenda: agendaNova(new Date()),
      criadoEm: 1
    })
    expect(feitaPelosDados(d, r.missao, r.missao.tarefas[0])).toBe(false)
  })
  it('cartões já importados antes pela caixa contam na tarefa', () => {
    const r = lerPacoteDeMissao(
      JSON.stringify({
        de: 'a',
        ate: 'b',
        tarefas: [{ id: 'lac', tipo: 'cartoes', titulo: 'L', pontos: 1, item: 'i2' }]
      }),
      'm',
      0
    )
    if (!r.ok) throw new Error(r.erro)
    const d = dadosDoEdital()
    // importados pela tela Do Claude (criadoEm 5000) e todos revisados...
    d.cartoes.push({
      id: 'a',
      assuntoId: 'banc-a',
      tipo: 'basico',
      frente: 'Cheque: prazo',
      verso: '',
      agenda: agendaNova(new Date()),
      criadoEm: 5000,
      primeiraRevisao: 6000
    })
    // ...e depois a missão "importa" de novo: nada novo, mas guarda as frentes
    r.missao.cartoesFrentes = { lac: ['Cheque: prazo'] }
    expect(feitaPelosDados(d, r.missao, r.missao.tarefas[0])).toBe(true)
  })
})

describe('Anotações do Claude e errata de cartões', () => {
  const pacote = (texto: string): string =>
    JSON.stringify({
      materia: 'est',
      notas: [
        { lugar: ['a'], texto },
        { lugar: ['a', 'Mediana'], texto: 'Mediana: o **meio** da lista ordenada.' }
      ]
    })
  it('escreve só em anotação vazia, não conta como estudo e não apaga a sua', async () => {
    const { lerPacoteDeAnotacoes, importarAnotacoes, temNotaPropria } =
      await import('../src/shared/anotacoesDoClaude')
    const { situacaoDoEdital } = await import('../src/shared/edital')
    const d = dadosDoEdital()
    const port = d.materias.find((m) => m.id === 'port')!
    port.assuntos[0].nota = 'minha nota'
    const r = lerPacoteDeAnotacoes(pacote('Resumo v1'))
    if (!r.ok) throw new Error(r.erro)
    let n = 0
    const res = importarAnotacoes(d, r.pacote, () => `n${++n}`, 5)
    expect(res.escritas).toBe(2)
    expect(res.lugaresCriados).toBe(1) // o tópico Mediana
    const a = d.materias.find((m) => m.id === 'est')!.assuntos[0]
    expect(a.nota).toBe('Resumo v1')
    expect(a.atualizadoEm).toBe(0) // não vira dia de estudo
    expect(temNotaPropria(d, a.id, a.nota)).toBe(false)
    const est = situacaoDoEdital(d, new Date()).find((s) => s.materiaId === 'est')!
    expect(est.estudado).toBe(0)
    // a sua continua sua
    expect(port.assuntos[0].nota).toBe('minha nota')
    // versão corrigida chega enquanto você não editou...
    const v2 = lerPacoteDeAnotacoes(pacote('Resumo v2'))
    if (!v2.ok) throw new Error(v2.erro)
    importarAnotacoes(d, v2.pacote, () => `m${++n}`, 6)
    expect(a.nota).toBe('Resumo v2')
    // ...e não chega depois que você editou
    a.nota = 'Resumo v2 + o que eu entendi'
    expect(temNotaPropria(d, a.id, a.nota)).toBe(true)
    const v3 = lerPacoteDeAnotacoes(pacote('Resumo v3'))
    if (!v3.ok) throw new Error(v3.erro)
    expect(importarAnotacoes(d, v3.pacote, () => `k${++n}`, 7).suas).toBe(1)
    expect(a.nota).toBe('Resumo v2 + o que eu entendi')
  })
  it('errata: corrige o verso só se ainda for o antigo exato', async () => {
    const { lerPacoteDeCartoes, importarCartoes } = await import('../src/shared/pacoteDeCartoes')
    const d = dadosDoEdital()
    const v1 = lerPacoteDeCartoes(
      JSON.stringify({
        materia: 'info',
        cartoes: [{ lugar: ['a'], frente: 'Drive', verso: 'Comentarista' }]
      })
    )
    if (!v1.ok) throw new Error(v1.erro)
    let n = 0
    importarCartoes(d, v1.pacote, () => `c${++n}`, 1)
    const v2 = lerPacoteDeCartoes(
      JSON.stringify({
        materia: 'info',
        cartoes: [{ lugar: ['a'], frente: 'Drive', verso: 'Comentador', antes: ['Comentarista'] }]
      })
    )
    if (!v2.ok) throw new Error(v2.erro)
    expect(importarCartoes(d, v2.pacote, () => `c${++n}`, 2).corrigidos).toBe(1)
    expect(d.cartoes.find((c) => c.frente === 'Drive')!.verso).toBe('Comentador')
    // editado por você: a errata não mexe
    d.cartoes.find((c) => c.frente === 'Drive')!.verso = 'Comentarista (anotei errado)'
    expect(importarCartoes(d, v2.pacote, () => `c${++n}`, 3).corrigidos).toBe(0)
  })
})
