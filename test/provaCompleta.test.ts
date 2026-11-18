import { describe, expect, it } from 'vitest'
import {
  blocosDaProva,
  montagemDaProva,
  notaDaProva,
  ordenarBloco,
  promptDoBloco,
  simuladoDaProva
} from '../src/shared/provaCompleta'
import {
  diaDe,
  planoDoDia,
  registrarDiaDeEstudo,
  sequenciaDeDias,
  tarefaFeita
} from '../src/shared/estudoDoDia'
import { agendaNova } from '../src/shared/flashcards'
import { DADOS_VAZIOS, type Dados, type Edital, type Questao } from '../src/shared/tipos'

const MATERIAS: [string, string, number, number][] = [
  ['port', 'Português', 10, 1],
  ['rl', 'Matemática e Raciocínio Lógico', 10, 1],
  ['atu', 'Atualidades do Mercado Financeiro', 5, 1],
  ['etica', 'Ética, Compliance e ESG', 5, 1],
  ['banc', 'Conhecimentos Bancários', 15, 2],
  ['mf', 'Matemática Financeira', 5, 2],
  ['est', 'Probabilidade e Estatística', 5, 2],
  ['info', 'Informática e Comportamentos Digitais', 5, 2],
  ['vendas', 'Vendas, Negociação e Atendimento', 10, 2]
]
const montar = (): { d: Dados; e: Edital } => {
  const d: Dados = structuredClone(DADOS_VAZIOS)
  for (const [id, nome] of MATERIAS)
    d.materias.push({
      id,
      nome,
      aberta: true,
      assuntos: [{ id: `${id}-a`, nome: 'Assunto', nota: '', atualizadoEm: 0 }]
    })
  const e: Edital = {
    nome: 'Banestes · TB',
    banca: 'FCC',
    dataProva: '2027-01-24',
    notaMinima: 6,
    duracaoMin: 240,
    materias: MATERIAS.map(([materiaId, , questoes, peso]) => ({
      materiaId,
      questoes,
      peso,
      texto: `conteúdo de ${materiaId}`
    }))
  }
  d.edital = e
  return { d, e }
}
const q = (materia: string | undefined, gabarito = 'A'): Questao => ({
  enunciado: 'e',
  alternativas: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({ letra, texto: letra })),
  gabarito,
  resolucao: 'r',
  ...(materia ? { materia } : {})
})

describe('prova completa: blocos', () => {
  it('Banestes: Gerais 30 num bloco; Específicos 40 em 20 + 20, sem partir matéria', () => {
    const { d, e } = montar()
    const b = blocosDaProva(d, e)
    expect(b.map((x) => x.materias.map((m) => `${m.materiaId}:${m.questoes}`).join(' '))).toEqual([
      'port:10 rl:10 atu:5 etica:5',
      'banc:15 mf:5',
      'est:5 info:5 vendas:10'
    ])
  })
  it('o prompt do bloco pede a quantidade de cada matéria, o campo "materia" e o edital', () => {
    const { d, e } = montar()
    const p = promptDoBloco(e, blocosDaProva(d, e), 1, 'claude')
    expect(p).toContain('parte 2 de 3')
    expect(p).toContain('- Conhecimentos Bancários: 15 questões')
    expect(p).toContain('"materia"')
    expect(p).toContain('conteúdo de banc')
    expect(p).toContain('banca FCC')
    expect(p).toContain('Crie 20 questões')
  })
})

describe('prova completa: ordenar o que a IA mandou', () => {
  const materias = [
    { materiaId: 'banc', nome: 'Conhecimentos Bancários', questoes: 2, peso: 2 },
    { materiaId: 'mf', nome: 'Matemática Financeira', questoes: 1, peso: 2 }
  ]
  it('pelo campo "materia", mesmo fora de ordem e sem acento', () => {
    const r = ordenarBloco(materias, [
      q('Matematica Financeira'),
      q('Conhecimentos Bancários'),
      q('conhecimentos bancarios')
    ])
    expect(r.ok && r.porMateria).toEqual([2, 1])
    expect(r.ok && r.questoes.map((x) => x.materia)).toEqual([
      'Conhecimentos Bancários',
      'conhecimentos bancarios',
      'Matematica Financeira'
    ])
  })
  it('sem o campo, vale a ordem se a quantidade bater; senão, avisa', () => {
    expect(ordenarBloco(materias, [q(undefined), q(undefined), q(undefined)]).ok).toBe(true)
    expect(ordenarBloco(materias, [q(undefined), q(undefined)])).toEqual({
      ok: false,
      erro: 'Vieram 2 questões sem dizer a matéria; o bloco pede 3. Peça de novo à IA.'
    })
    expect(ordenarBloco(materias, [q('Conhecimentos Bancários')]).ok).toBe(false)
  })
  it('com o campo, cada matéria precisa vir com a quantidade pedida (a mais, sobra fora)', () => {
    // 1 + 1 num bloco que pede 2 + 1: mudaria o tamanho e o peso da prova
    expect(
      ordenarBloco(materias, [q('Conhecimentos Bancários'), q('Matemática Financeira')])
    ).toEqual({
      ok: false,
      erro: 'Conhecimentos Bancários: vieram 1 de 2 questões. Peça de novo à IA.'
    })
    const r = ordenarBloco(materias, [
      q('Conhecimentos Bancários'),
      q('Conhecimentos Bancários'),
      q('Conhecimentos Bancários'),
      q('Matemática Financeira'),
      q('Matemática Financeira')
    ])
    expect(r.ok && r.porMateria).toEqual([2, 1])
  })
})

describe('prova completa: montagem salva', () => {
  it('vale só para o edital em que foi montada', () => {
    const { d, e } = montar()
    d.provaEmMontagem = { criadoEm: 1, blocos: blocosDaProva(d, e) }
    d.provaEmMontagem.blocos[0].questoes = [q('Português')]
    expect(montagemDaProva(d, e)).toBe(d.provaEmMontagem)
    // trocou o edital (outras matérias e quantidades): começa do zero
    const outro: Edital = {
      ...e,
      nome: 'Outro',
      materias: e.materias.slice(0, 2).map((m) => ({ ...m, questoes: 20 }))
    }
    const m = montagemDaProva(d, outro)
    // 40 questões de um peso só passam de 30: dois blocos de 20
    expect(m.blocos.map((b) => b.materias.map((x) => x.questoes))).toEqual([[20], [20]])
    expect(m.blocos.every((b) => b.questoes === null)).toBe(true)
  })
})

describe('prova completa: nota como a banca calcula', () => {
  it('(Gerais + 2 × Específicos) ÷ 3 e o mínimo de 6', () => {
    const { d, e } = montar()
    const blocos = blocosDaProva(d, e)
    for (const b of blocos)
      b.questoes = b.materias.flatMap((m) => Array.from({ length: m.questoes }, () => q(m.nome)))
    const s = simuladoDaProva(e, { criadoEm: 0, blocos }, 'p', 1)!
    expect(s.questoes).toHaveLength(70)
    expect(s.config.tempoMin).toBe(240)
    expect(s.prova!.materias.find((m) => m.materiaId === 'banc')).toMatchObject({ de: 30, ate: 45 })
    // Gerais: 22 de 30 certas; Específicos: 25 de 40 (Bancários, 30–44, erra 10;
    // Vendas, 60–69, erra as 5 últimas)
    s.respostas = s.questoes.map((_, i) => {
      if (i < 30) return i < 22 ? 'A' : 'B'
      return i < 40 || i >= 65 ? 'B' : 'A'
    })
    const n = notaDaProva(s)!
    expect(n.provas.map((p) => [p.peso, p.acertos, p.total])).toEqual([
      [1, 22, 30],
      [2, 25, 40]
    ])
    expect(n.final).toBeCloseTo((22 / 3 + 2 * 6.25) / 3)
    expect(n.passaria).toBe(true)
    expect(n.porMateria[0].materiaId).toBe('banc') // a que mais custou nota
  })
  it('fica null enquanto falta bloco', () => {
    const { d, e } = montar()
    expect(simuladoDaProva(e, { criadoEm: 0, blocos: blocosDaProva(d, e) }, 'p', 1)).toBeNull()
  })
})

describe('estudo do dia', () => {
  const agora = new Date('2026-11-18T10:00:00')
  it('cartões, simulado da matéria mais urgente e um tópico ainda não estudado', () => {
    const { d } = montar()
    d.cartoes.push({
      id: 'c',
      assuntoId: 'etica-a',
      tipo: 'basico',
      frente: 'f',
      verso: 'v',
      agenda: agendaNova(agora),
      criadoEm: 1
    })
    const p = planoDoDia(d, agora)
    expect(p.dia).toBe('2026-11-18')
    expect(p.tarefas.map((t) => t.titulo)).toEqual([
      'Revisar 1 cartão',
      'Simulado curto: Conhecimentos Bancários',
      'Tópico novo: Assunto'
    ])
    const topico = p.tarefas[2]
    expect(topico.tipo === 'topico' && topico.lugarId).toBe('banc-a')
  })
  it('a tarefa conta como feita pelo que aconteceu ou pela marcação', () => {
    const { d } = montar()
    const p = planoDoDia(d, agora)
    const [simulado, topico] = p.tarefas
    expect(tarefaFeita(d, p, simulado, agora)).toBe(false)
    d.simulados.push({
      id: 's',
      config: {
        tema: 't',
        assuntoId: null,
        materiaId: 'banc',
        nivel: 'medio',
        tipo: 'multipla',
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
      criadoEm: 0,
      entregueEm: agora.getTime()
    })
    expect(tarefaFeita(d, p, simulado, agora)).toBe(true)
    expect(tarefaFeita(d, p, topico, agora)).toBe(false)
    d.materias[4].assuntos[0].nota = 'estudei'
    expect(tarefaFeita(d, p, topico, agora)).toBe(true)
    expect(tarefaFeita(d, { ...p, marcadas: ['x'] }, { ...topico, chave: 'x' }, agora)).toBe(true)
  })
  it('sequência de dias seguidos (hoje ainda vazio conta até ontem)', () => {
    const { d } = montar()
    const dia = (n: number): number => new Date(2026, 10, 18 - n, 15).getTime()
    d.simulados.push(
      ...[1, 2, 3, 5].map((n) => ({
        id: `s${n}`,
        config: {
          tema: 't',
          assuntoId: null,
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
        criadoEm: 0,
        entregueEm: dia(n)
      }))
    )
    expect(sequenciaDeDias(d, agora)).toBe(3)
    expect(diaDe(new Date(dia(0)))).toBe('2026-11-18')
  })
  it('não perde os dias do meio quando o mesmo cartão é revisado de novo', () => {
    const d: Dados = structuredClone(DADOS_VAZIOS)
    const c = {
      id: 'c',
      assuntoId: 'x',
      frente: 'f',
      verso: 'v',
      agenda: agendaNova(new Date(2026, 10, 16)),
      primeiraRevisao: 0
    }
    d.cartoes.push(c as Dados['cartoes'][number])
    // revisado seg, ter e qua; o app registra o dia a cada mudança
    for (const dia of [16, 17, 18]) {
      const quando = new Date(2026, 10, dia, 20)
      if (!c.primeiraRevisao) c.primeiraRevisao = quando.getTime()
      c.agenda = { ...c.agenda, last_review: quando.toISOString() } as typeof c.agenda
      registrarDiaDeEstudo(d, quando)
    }
    expect(sequenciaDeDias(d, new Date(2026, 10, 18, 21))).toBe(3)
  })
})
