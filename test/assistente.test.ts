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
  // o simulado de Bancários de 19/11 (27/30), resumido. Desde a 0.1.24 a base
  // é o tempo MÉDIO (o mesmo número do topo do resultado), não a mediana
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
    const media = (24 * 23 + 101 + 37 + 36 + 21 + 44 + 38) / 30
    expect(r.ritmo).toBeCloseTo(media * 1000)
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
    expect(r.porFaixa.fragil[0].vezes).toBeCloseTo(
      101 / ((24 * 23 + 101 + 37 + 36 + 21 + 44 + 38) / 30)
    )
  })
  it('a frase diz o que o placar esconde', () => {
    expect(r.frase).toBe(
      'Acertou bastante, mas mostrou lacuna em Títulos públicos federais. Você não sabia Cheque e Garantias do crédito.'
    )
  })
  it('certa demorada (mais que o dobro do tempo médio) sem dúvida também é frágil', () => {
    // média 14 s: 30 s é mais que o dobro
    const x = raioX(
      sim([
        ['a', true, 10],
        ['b', true, 10],
        ['c', true, 10],
        ['e', true, 10],
        ['d', true, 30]
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

describe('compatibilidade: missão nova em app antigo', () => {
  it('tarefa de tipo desconhecido é pulada; o resto da missão vale', () => {
    const r = lerPacoteDeMissao(
      JSON.stringify({
        de: 'a',
        ate: 'b',
        tarefas: [
          { id: 'x', tipo: 'algo-do-futuro', titulo: 'Novidade', pontos: 10 },
          { id: 'atr', tipo: 'atrasados', titulo: 'Zerar', pontos: 5 }
        ]
      }),
      'm',
      0
    )
    expect(r.ok && r.missao.tarefas.map((t) => t.id)).toEqual(['atr'])
  })
  it('versão mínima do item da caixa', async () => {
    const { versaoAtende } = await import('../src/shared/versao')
    expect(versaoAtende('0.1.19', '0.1.9')).toBe(true)
    expect(versaoAtende('0.1.18', '0.1.19')).toBe(false)
    expect(versaoAtende('0.2.0', '0.1.19')).toBe(true)
    expect(versaoAtende('0.1.18')).toBe(true)
  })
})

describe('revisão do Codex (PR 23)', () => {
  it('importar anotações (que criam tópicos) não vira dia de estudo', async () => {
    const { lerPacoteDeAnotacoes, importarAnotacoes } =
      await import('../src/shared/anotacoesDoClaude')
    const { sequenciaDeDias } = await import('../src/shared/estudoDoDia')
    const d = dadosDoEdital()
    const r = lerPacoteDeAnotacoes(
      JSON.stringify({ materia: 'est', notas: [{ lugar: ['a', 'Mediana'], texto: 'meio' }] })
    )
    if (!r.ok) throw new Error(r.erro)
    const hoje = new Date(2026, 10, 21, 10)
    importarAnotacoes(d, r.pacote, () => 'novo', hoje.getTime())
    expect(d.topicos.find((t) => t.nome === 'Mediana')).toBeTruthy()
    expect(sequenciaDeDias(d, hoje)).toBe(0)
  })
})

describe('revisão: uma matéria por vez', () => {
  const cartao = (id: string, assuntoId: string, frente = id) => ({
    id,
    assuntoId,
    tipo: 'basico' as const,
    frente,
    verso: 'v',
    agenda: agendaNova(new Date(2026, 10, 20)),
    criadoEm: Number(id.replace(/\D/g, ''))
  })
  it('a fila do dia (como era) mistura matérias; a da sessão vem em blocos', async () => {
    const { filaDoDia, filaDaSessao } = await import('../src/shared/flashcards')
    const d = dadosDoEdital()
    d.cartoes.push(
      cartao('v1', 'vendas-a'),
      cartao('e2', 'est-a'),
      cartao('v3', 'vendas-a'),
      cartao('e4', 'est-a')
    )
    const agora = new Date(2026, 10, 21, 10)
    const antes = filaDoDia(d.cartoes, agora).novos.map((c) => c.id)
    expect(antes).toEqual(['v1', 'e2', 'v3', 'e4']) // o problema: Vendas, Estatística, Vendas…
    expect(filaDaSessao(d, agora, { assuntos: null }).map((c) => c.id)).toEqual([
      'v1',
      'v3',
      'e2',
      'e4'
    ])
  })
  it('tarefa de cartões da missão: só os do pacote', async () => {
    const { filaDaSessao } = await import('../src/shared/flashcards')
    const d = dadosDoEdital()
    d.cartoes.push(
      cartao('v1', 'vendas-a'),
      cartao('e2', 'est-a', 'Mediana'),
      cartao('e4', 'est-a', 'Moda')
    )
    const agora = new Date(2026, 10, 21, 10)
    expect(
      filaDaSessao(d, agora, { assuntos: null, frentes: ['Mediana', 'Moda '] }).map((c) => c.id)
    ).toEqual(['e2', 'e4'])
  })
})

describe('revisão do pacote com muitos cartões novos de outras matérias', () => {
  it('o limite de novos do dia não corta os do pacote', async () => {
    const { filaDaSessao, NOVOS_POR_DIA } = await import('../src/shared/flashcards')
    const d = dadosDoEdital()
    const novo = (id: string, assuntoId: string, frente: string, criadoEm: number) => ({
      id,
      assuntoId,
      tipo: 'basico' as const,
      frente,
      verso: 'v',
      agenda: agendaNova(new Date(2026, 10, 19)),
      criadoEm
    })
    // muitos novos de Bancários, importados antes
    // cada um num tópico diferente, como no mapa real
    for (let i = 0; i < NOVOS_POR_DIA + 5; i++)
      d.cartoes.push(novo(`b${i}`, `banc-${i}`, `banc ${i}`, i))
    d.cartoes.push(novo('e1', 'est-a', 'Mediana', 1000), novo('e2', 'est-a', 'Moda', 1001))
    const fila = filaDaSessao(d, new Date(2026, 10, 21, 10), {
      assuntos: null,
      frentes: ['Mediana', 'Moda']
    })
    expect(fila.map((c) => c.id)).toEqual(['e1', 'e2'])
  })
})

describe('revisão do Codex (PR 25)', () => {
  it('cartões novos de fora do pacote no MESMO tópico não ocupam o limite', async () => {
    const { filaDaSessao, NOVOS_POR_DIA } = await import('../src/shared/flashcards')
    const d = dadosDoEdital()
    const novo = (id: string, frente: string, criadoEm: number) => ({
      id,
      assuntoId: 'est-a',
      tipo: 'basico' as const,
      frente,
      verso: 'v',
      agenda: agendaNova(new Date(2026, 10, 19)),
      criadoEm
    })
    for (let i = 0; i < NOVOS_POR_DIA; i++) d.cartoes.push(novo(`x${i}`, `antigo ${i}`, i))
    d.cartoes.push(novo('e1', 'Mediana', 1000), novo('e2', 'Moda', 1001))
    const fila = filaDaSessao(d, new Date(2026, 10, 21, 10), {
      assuntos: null,
      frentes: ['Mediana', 'Moda']
    })
    expect(fila.map((c) => c.id)).toEqual(['e1', 'e2'])
  })
})

describe('Explique depois dos exercícios e retorno do Claude', () => {
  it('pede até 3 conceitos, do que mais precisa, com as questões que puxaram cada um', async () => {
    const { pedidosDeExplicar } = await import('../src/shared/explicar')
    const s = sim([
      ['MDC', false, 60],
      ['MDC', false, 70],
      ['Regra inversa', false, 5],
      ['Porcentagem', true, 30, true],
      ['Frações', true, 30],
      ['Frações', true, 31]
    ])
    s.questoes[2].explicar = 'Por que mais operários fazem a obra em menos dias?'
    const p = pedidosDeExplicar(s, raioX(s))
    expect(p.map((x) => x.topico)).toEqual(['MDC', 'Regra inversa', 'Porcentagem'])
    expect(p[0].indices).toEqual([0, 1]) // as duas de MDC, num pedido só
    expect(p[0].motivo).toContain('1 e 2')
    expect(p[1].pergunta).toBe('Por que mais operários fazem a obra em menos dias?')
    // sem pergunta no conteúdo: a geral do conceito, não "explique esta questão"
    expect(p[0].pergunta).toMatch(/^O que é MDC e como você reconhece/)
  })
  it('a mesma pergunta de conceito em várias questões vira um pedido só; conceito já "Certo" não volta', async () => {
    const { pedidosDeExplicar } = await import('../src/shared/explicar')
    const s = sim([
      ['Regra de três direta', false, 60],
      ['Regra de três inversa', false, 70],
      ['O que fica fixo', false, 80]
    ])
    s.questoes[0].explicar = s.questoes[1].explicar = 'Como você decide se é direta ou inversa?'
    s.questoes[2].explicar = 'Por que o que fica fixo decide?'
    const d = dadosDoEdital()
    expect(pedidosDeExplicar(s, raioX(s), d).map((x) => x.pergunta)).toEqual([
      'Como você decide se é direta ou inversa?',
      'Por que o que fica fixo decide?'
    ])
    d.explicacoes = [
      {
        id: 'c1',
        criadoEm: 1,
        topico: 'Regra de três direta',
        pergunta: 'Como você decide se é direta ou inversa?',
        texto: 'pelo que fica fixo'
      }
    ]
    d.retornos = [
      {
        explicacaoId: 'c1',
        veredito: 'certo',
        texto: 'isso',
        textoAvaliado: 'pelo que fica fixo',
        criadoEm: 2
      }
    ]
    expect(pedidosDeExplicar(s, raioX(s), d).map((x) => x.pergunta)).toEqual([
      'Por que o que fica fixo decide?'
    ])
  })
  it('o retorno vale só para o texto avaliado; reescreveu, volta a esperar', async () => {
    const { mesclarRetornos, situacaoDe, placarDeExplicacoes } =
      await import('../src/shared/explicar')
    const d = dadosDoEdital()
    d.explicacoes = [
      { id: 'x1', criadoEm: 1, topico: 'MDC', pergunta: 'p', texto: 'o maior divisor comum' }
    ]
    expect(situacaoDe(d, d.explicacoes[0])).toBe('esperando')
    const r = {
      explicacaoId: 'x1',
      veredito: 'quase' as const,
      texto: 'faltou o exemplo',
      textoAvaliado: 'o maior divisor comum',
      criadoEm: 2
    }
    expect(mesclarRetornos(d, [r])).toBe(true)
    expect(mesclarRetornos(d, [r])).toBe(false) // não repete
    expect(situacaoDe(d, d.explicacoes[0])).toBe('quase')
    d.explicacoes[0].texto = 'o maior número que divide os dois sem sobra'
    expect(situacaoDe(d, d.explicacoes[0])).toBe('esperando')
    expect(placarDeExplicacoes(d)).toEqual({ certo: 0, quase: 0, revisar: 0, esperando: 1 })
  })
})

describe('Codex no PR 28', () => {
  it('o retorno mais novo vence, chegue na ordem que chegar', async () => {
    const { mesclarRetornos, retornoDe } = await import('../src/shared/explicar')
    const d = dadosDoEdital()
    d.explicacoes = [{ id: 'x1', criadoEm: 1, topico: 'MDC', pergunta: 'p', texto: 't' }]
    const velho = {
      explicacaoId: 'x1',
      veredito: 'revisar' as const,
      texto: 'antes',
      textoAvaliado: 't',
      criadoEm: 10
    }
    const novo = { ...velho, veredito: 'certo' as const, texto: 'corrigido', criadoEm: 20 }
    expect(mesclarRetornos(d, [novo, velho])).toBe(true) // a nuvem manda do mais novo ao mais velho
    expect(retornoDe(d, d.explicacoes[0])?.veredito).toBe('certo')
    expect(mesclarRetornos(d, [novo, velho])).toBe(false) // a mesma busca não grava de novo
  })
  it('reescrever uma explicação antiga conta como estudo no dia em que reescreveu', async () => {
    const { registrarDiaDeEstudo } = await import('../src/shared/estudoDoDia')
    const d = dadosDoEdital()
    const ontem = new Date(2026, 10, 22, 10).getTime()
    const hoje = new Date(2026, 10, 23, 10)
    d.explicacoes = [
      {
        id: 'x1',
        criadoEm: ontem,
        atualizadoEm: hoje.getTime(),
        topico: 'MDC',
        pergunta: 'p',
        texto: 't2'
      }
    ]
    registrarDiaDeEstudo(d, hoje)
    expect(d.diasDeEstudo).toContain('2026-11-23')
  })
})

describe('Missão republicada na mesma semana', () => {
  it('mantém o que já foi feito, os cartões de cada tarefa e o início', async () => {
    const { continuarMissao } = await import('../src/shared/missao')
    type M = import('../src/shared/tipos').Missao
    const tarefa = (id: string) => ({
      id,
      tipo: 'atrasados' as const,
      titulo: id,
      detalhe: '',
      pontos: 10
    })
    const antiga: M = {
      itemId: 'm-v1',
      de: '2026-11-23',
      ate: '2026-12-06',
      frase: '',
      recebidaEm: 100,
      tarefas: [tarefa('a'), tarefa('b')],
      feitas: ['a', 'b'],
      cartoesFrentes: { a: ['x'] }
    }
    const nova: M = {
      itemId: 'm-v2',
      de: '2026-11-23',
      ate: '2026-12-06',
      frase: '',
      recebidaEm: 900,
      tarefas: [tarefa('a'), tarefa('c')],
      feitas: []
    }
    const m = continuarMissao(nova, antiga)
    expect(m.feitas).toEqual(['a']) // 'b' saiu da missão
    expect(m.cartoesFrentes).toEqual({ a: ['x'] })
    expect(m.recebidaEm).toBe(100)
    expect(m.itemId).toBe('m-v2')
    // semana nova: começa do zero
    expect(continuarMissao({ ...nova, de: '2026-12-07' }, antiga).feitas).toEqual([])
  })
})

describe('Codex no PR 30: explicações da 0.1.22 continuam valendo', () => {
  it('acha a explicação antiga do Raio-X (com simuladoId) pela mesma pergunta, ou pelo tópico daquele simulado', async () => {
    const { explicacaoDoConceito, pedidosDeExplicar } = await import('../src/shared/explicar')
    const d = dadosDoEdital()
    const s = sim([['Economia circular', false, 60]])
    d.explicacoes = [
      {
        id: 'velha',
        criadoEm: 1,
        topico: 'Economia circular',
        pergunta:
          'Explique com suas palavras esta questão de Economia circular: o que ela cobra e como se chega na resposta certa.',
        texto: 'reutilizar',
        simuladoId: s.id,
        indice: 0
      },
      {
        id: 'mesma',
        criadoEm: 1,
        topico: 'X',
        pergunta: 'Como você decide?',
        texto: 't',
        simuladoId: 'outro',
        indice: 3
      }
    ]
    expect(explicacaoDoConceito(d, 'Como você decide?')?.id).toBe('mesma')
    expect(
      explicacaoDoConceito(d, 'O que é Economia circular e…', {
        simuladoId: s.id,
        topico: 'Economia circular'
      })?.id
    ).toBe('velha')
    // avaliada como "Certo" na 0.1.22: não volta a ser pedida
    d.retornos = [
      {
        explicacaoId: 'velha',
        veredito: 'certo',
        texto: 'ok',
        textoAvaliado: 'reutilizar',
        criadoEm: 2
      }
    ]
    expect(pedidosDeExplicar(s, raioX(s), d)).toEqual([])
  })
})

describe('Raio-X polido (0.1.24): o diagnóstico', () => {
  it('mostra o padrão por tópico, cada erro com o engano e a troca de assunto (o Treino 8 dele)', async () => {
    const { diagnostico } = await import('../src/shared/raioX')
    // como o Treino 8 real: 4 de "Direta ou inversa?", 32 de inversa em bloco
    // (errou a 31, de conta), e 4 de "Direta ou inversa?" no fim (errou 39 e 40)
    const linhas: [string, boolean, number, boolean?][] = [
      ...Array.from({ length: 4 }, (): [string, boolean, number] => [
        'Direta ou inversa?',
        true,
        30
      ]),
      ...Array.from({ length: 32 }, (_, i): [string, boolean, number] => [
        'Regra de três inversa',
        i !== 26,
        50
      ]),
      ['Direta ou inversa?', true, 96],
      ['Direta ou inversa?', true, 114, true],
      ['Direta ou inversa?', false, 84],
      ['Direta ou inversa?', false, 34]
    ]
    const s = sim(linhas)
    s.questoes[38].comentarios = { B: 'É a conta da regra DIRETA. O lote é fixo.' }
    const d = diagnostico(s, raioX(s))
    expect(d.frase).toBe(
      'Em “Regra de três inversa” você está firme (31/32). Onde perde ponto: “Direta ou inversa?” (6/8).'
    )
    expect(d.erros.map((e) => e.indice + 1)).toEqual([31, 39, 40])
    expect(d.erros[1].motivo).toBe('É a conta da regra DIRETA. O lote é fixo.')
    expect(d.erros[1].marcada).toBe('B')
    expect(d.pontos.some((p) => p.startsWith('2 erros foram rápidos'))).toBe(true) // a 31 e a 40, abaixo da média
    expect(d.inseguras.map((x) => x.indice + 1)).toContain(38)
  })
  it('sem erros: tudo firme, ou acertou todas com insegurança', async () => {
    const { diagnostico } = await import('../src/shared/raioX')
    const firme = sim([
      ['a', true, 10],
      ['b', true, 10]
    ])
    expect(diagnostico(firme, raioX(firme)).frase).toMatch(/^Tudo firme/)
    const inseguro = sim([
      ['a', true, 10],
      ['b', true, 10, true]
    ])
    expect(diagnostico(inseguro, raioX(inseguro)).frase).toMatch(/^Acertou todas, mas 1/)
  })
})

describe('Bloco de notas (0.1.24)', () => {
  it('só aceita o que tem forma de nota, sem repetir id, com limite de tamanho', async () => {
    const { lerNotasDoBloco } = await import('../src/shared/bloco')
    const n = lerNotasDoBloco([
      { id: 'a', titulo: 'x'.repeat(500), texto: 't', criadoEm: 1, atualizadoEm: 2 },
      { id: 'a', titulo: 'repetida' },
      { titulo: 'sem id' },
      'lixo',
      { id: 'b', texto: 42 }
    ])
    expect(n.map((x) => x.id)).toEqual(['a', 'b'])
    expect(n[0].titulo).toHaveLength(200)
    expect(n[1].texto).toBe('')
    expect(lerNotasDoBloco('não é lista')).toEqual([])
  })
  it('a dúvida nasce com a questão e a resposta certa', async () => {
    const { notaDeDuvida } = await import('../src/shared/bloco')
    const n = notaDeDuvida(q('MDC'), 7, 'Treino 9', 'id1', 5)
    expect(n.titulo).toBe('Dúvida: questão 7 · Treino 9')
    expect(n.texto).toContain('sobre MDC')
    expect(n.texto).toContain('Certa: A) A')
    expect(n.texto.endsWith('Minha dúvida: ')).toBe(true)
  })
})

describe('Raio-X polido: não chama de firme o que não é', () => {
  it('melhor tópico abaixo de 80% não é "firme"; sem tempo medido não fala em "tempo de sobra"', async () => {
    const { diagnostico } = await import('../src/shared/raioX')
    const linhas: [string, boolean, number][] = [
      ...Array.from({ length: 13 }, (_, i): [string, boolean, number] => ['Inversa', i < 4, 0]),
      ...Array.from({ length: 6 }, (): [string, boolean, number] => ['Montar a conta', false, 0])
    ]
    const s = sim(linhas)
    const d = diagnostico(s, raioX(s))
    expect(d.frase).toBe(
      'Onde mais perde ponto: “Montar a conta” (0/6). O melhor foi “Inversa” (4/13), ainda abaixo de 80%.'
    )
    expect(d.pontos.join(' ')).not.toContain('tempo de sobra')
    expect(d.pontos.join(' ')).toContain('não mediu o tempo')
  })
})
