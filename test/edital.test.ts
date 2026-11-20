import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  acharMateria,
  dataDoEdital,
  diasAte,
  estudadoPonderado,
  importarEdital,
  lerEditalColado,
  lerPacoteDeEdital,
  pesoNaNota,
  proximoPasso,
  simuladoDaCaixa,
  simuladosDaMateria,
  situacaoDoEdital
} from '../src/shared/edital'
import { agendaNova } from '../src/shared/flashcards'
import { DADOS_VAZIOS, type Dados, type Edital } from '../src/shared/tipos'

const banestes = (): Edital => ({
  nome: 'Banestes',
  banca: 'FCC',
  dataProva: '2027-01-24',
  materias: [
    ['port', 10, 1],
    ['rl', 10, 1],
    ['atu', 5, 1],
    ['etica', 5, 1],
    ['banc', 15, 2],
    ['mf', 5, 2],
    ['est', 5, 2],
    ['info', 5, 2],
    ['vendas', 10, 2]
  ].map(([materiaId, questoes, peso]) => ({
    materiaId: materiaId as string,
    questoes: questoes as number,
    peso: peso as number,
    texto: ''
  }))
})

describe('peso de cada matéria na nota', () => {
  it('Banestes: Gerais ×1 (30 questões) e Específicos ×2 (40 questões)', () => {
    const p = pesoNaNota(banestes())
    const pct = (id: string): number => Math.round((p.get(id) ?? 0) * 1000) / 10
    expect(pct('banc')).toBe(25)
    expect(pct('vendas')).toBe(16.7)
    expect(pct('port')).toBe(11.1)
    expect(pct('mf')).toBe(8.3)
    expect(pct('etica')).toBe(5.6)
    expect([...p.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
  it('uma prova só: proporcional ao número de questões', () => {
    const p = pesoNaNota({
      ...banestes(),
      materias: [
        { materiaId: 'a', questoes: 30, peso: 1, texto: '' },
        { materiaId: 'b', questoes: 10, peso: 1, texto: '' }
      ]
    })
    expect([p.get('a'), p.get('b')]).toEqual([0.75, 0.25])
  })
})

describe('datas', () => {
  it('dias até a prova e formatos aceitos', () => {
    expect(diasAte('2027-01-24', new Date('2026-11-18T20:00:00'))).toBe(67)
    expect(diasAte('', new Date())).toBeNull()
    expect(dataDoEdital('24/01/2027')).toBe('2027-01-24')
    expect(dataDoEdital('2027-01-24')).toBe('2027-01-24')
    expect(dataDoEdital('janeiro')).toBe('')
  })
})

describe('colar edital', () => {
  it('acha as matérias pelo nome em maiúsculas antes dos dois-pontos', () => {
    const texto = `LÍNGUA PORTUGUESA: Ortografia e acentuação. Emprego do sinal indicativo de
crase. Pronomes.
ÉTICA, COMPLIANCE E ESG: Ética e moral: conceitos. Noções da Lei Geral de Proteção de Dados Pessoais (LGPD).
CONHECIMENTOS GERAIS – APENAS para o Cargo TB – TÉCNICO BANCÁRIO
MATEMÁTICA/RACIOCÍNIO LÓGICO E QUANTITATIVO: Frações. Regra de três.`
    const r = lerEditalColado(texto)
    expect(r.map((m) => m.nome)).toEqual([
      'Língua Portuguesa',
      'Ética, Compliance e ESG',
      'Matemática/Raciocínio Lógico e Quantitativo'
    ])
    expect(r[0].itens).toBe(3)
    expect(r[0].texto).toContain('sinal indicativo de crase')
    // "(LGPD)" dentro do texto não vira matéria; "Ética e moral:" também não
    expect(r).toHaveLength(3)
  })

  it('"Língua Portuguesa" do edital acha a matéria "Português" do app', () => {
    const d: Dados = structuredClone(DADOS_VAZIOS)
    d.materias.push({ id: 'p', nome: 'Português', aberta: true, assuntos: [] })
    expect(acharMateria(d, 'Língua Portuguesa')).toBe('p')
    expect(acharMateria(d, 'PORTUGUÊS')).toBe('p')
    expect(acharMateria(d, 'Informática')).toBeNull()
  })
})

describe('situação do edital', () => {
  it('ordena pelo peso × o que falta e sugere o próximo passo', () => {
    const d: Dados = structuredClone(DADOS_VAZIOS)
    for (const id of ['port', 'banc', 'etica'])
      d.materias.push({
        id,
        nome: id,
        aberta: true,
        assuntos: [{ id: `${id}-a`, nome: 'A', nota: '', atualizadoEm: 0 }]
      })
    d.edital = {
      ...banestes(),
      materias: banestes().materias.filter((m) => ['port', 'banc', 'etica'].includes(m.materiaId))
    }
    // Português: anotação e simulado com 9/10
    d.materias[0].assuntos[0].nota = 'estudei'
    d.simulados.push({
      id: 's',
      config: {
        tema: 'x',
        assuntoId: 'port-a',
        nivel: 'medio',
        tipo: 'multipla',
        quantidade: 10,
        tempoMin: 30,
        banca: 'FCC'
      },
      questoes: Array.from({ length: 10 }, () => ({
        enunciado: 'e',
        alternativas: [],
        gabarito: 'A',
        resolucao: 'r'
      })),
      respostas: [...Array(9).fill('A'), 'B'],
      revisar: [],
      tempoPorQuestao: [],
      decorridoMs: 0,
      atual: 0,
      criadoEm: 1,
      entregueEm: 2
    })
    // Ética: um cartão novo para estudar
    d.cartoes.push({
      id: 'c',
      assuntoId: 'etica-a',
      tipo: 'basico',
      frente: 'f',
      verso: 'v',
      agenda: agendaNova(),
      criadoEm: 1
    })
    const s = situacaoDoEdital(d)
    expect(s.map((x) => x.materiaId)).toEqual(['banc', 'etica', 'port'])
    expect(s.map((x) => proximoPasso(x).texto)).toEqual([
      'Gerar 1º simulado',
      'Revisar 1 cartão',
      'Novo simulado'
    ])
    expect(s.find((x) => x.materiaId === 'port')!.acerto).toBeCloseTo(0.9)
    expect(estudadoPonderado(s)).toBeGreaterThan(0)
  })
})

describe('simulado conta na matéria certa', () => {
  it('ligado a um assunto que mudou de matéria, conta só onde o assunto está agora', async () => {
    const { simuladosDaMateria } = await import('../src/shared/edital')
    const d: Dados = structuredClone(DADOS_VAZIOS)
    d.materias.push(
      { id: 'A', nome: 'A', aberta: true, assuntos: [] },
      {
        id: 'B',
        nome: 'B',
        aberta: true,
        assuntos: [{ id: 'x', nome: 'X', nota: '', atualizadoEm: 0 }]
      }
    )
    const sim = (id: string, assuntoId: string | null, materiaId?: string) => ({
      id,
      config: {
        tema: 't',
        assuntoId,
        materiaId,
        nivel: 'medio' as const,
        tipo: 'multipla' as const,
        quantidade: 1,
        tempoMin: 1,
        banca: ''
      },
      questoes: [],
      respostas: [],
      revisar: [],
      tempoPorQuestao: [],
      decorridoMs: 0,
      atual: 0,
      criadoEm: 1,
      entregueEm: 2
    })
    // 'velho' foi criado quando X estava em A (materiaId ficou 'A'); X agora está em B
    d.simulados.push(sim('velho', 'x', 'A'), sim('materia', null, 'A'))
    expect(simuladosDaMateria(d, 'A').map((s) => s.id)).toEqual(['materia'])
    expect(simuladosDaMateria(d, 'B').map((s) => s.id)).toEqual(['velho'])
  })
})

describe('edital pela caixa', () => {
  it('o do Banestes publicado é lido e liga as matérias pelo nome', () => {
    const r = lerPacoteDeEdital(readFileSync('conteudo/banestes-tb-edital.json', 'utf-8'))
    if (!r.ok) throw new Error(r.erro)
    expect(r.pacote.materias).toHaveLength(9)
    expect(r.pacote.materias.reduce((n, m) => n + m.questoes, 0)).toBe(70)
    const d: Dados = structuredClone(DADOS_VAZIOS)
    d.materias.push({ id: 'p', nome: 'Português', aberta: true, assuntos: [] })
    let n = 0
    const res = importarEdital(d, r.pacote, () => `m${++n}`)
    expect(res).toEqual({ materias: 9, criadas: 8 })
    expect(d.edital!.materias[0].materiaId).toBe('p')
    expect(d.edital!.dataProva).toBe('2027-01-24')
    expect(
      Math.round((pesoNaNota(d.edital!).get(d.edital!.materias[4].materiaId) ?? 0) * 100)
    ).toBe(25)
  })
  it('recusa arquivo incompleto', () => {
    expect(
      lerPacoteDeEdital('{"nome":"x","materias":[{"nome":"a","questoes":0,"peso":1}]}').ok
    ).toBe(false)
    expect(lerPacoteDeEdital('{').ok).toBe(false)
  })
})

describe('simulado pronto da caixa', () => {
  it('entra na matéria que o arquivo diz, com a banca', async () => {
    const { lerRespostaDaIa } = await import('../src/shared/questoes')
    const d: Dados = structuredClone(DADOS_VAZIOS)
    d.materias.push({
      id: 'inf',
      nome: 'Informática e Comportamentos Digitais',
      aberta: true,
      assuntos: []
    })
    const leitura = lerRespostaDaIa(
      readFileSync('conteudo/banestes-missao1-informatica.json', 'utf-8')
    )
    if (!leitura.ok) throw new Error(leitura.erro)
    const s = simuladoDaCaixa(d, leitura, 'Simulado', 's1', 1)
    expect(s.config.materiaId).toBe('inf')
    expect(s.config.banca).toBe('FCC')
    expect(s.questoes).toHaveLength(10)
    // só simulado entregue conta na matéria
    d.simulados.push({ ...s, entregueEm: 2 })
    expect(simuladosDaMateria(d, 'inf').map((x) => x.id)).toEqual(['s1'])
  })
})
