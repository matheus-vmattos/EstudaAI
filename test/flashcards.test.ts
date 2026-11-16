import { describe, expect, it } from 'vitest'
import {
  agendaNova,
  filaDoDia,
  formatarIntervalo,
  lacunaDaAnotacao,
  mostrarLacuna,
  NOVOS_POR_DIA,
  podeMostrar,
  previsoes,
  responder
} from '../src/shared/flashcards'
import {
  descendentes,
  deslocamentoParaMostrar,
  montarArvore,
  posicionar,
  vistaQueMostra
} from '../src/shared/mapa'
import {
  acharNo,
  adicionarFilho,
  adicionarIrmao,
  apagarNo,
  gravarNota,
  nosDaMateria,
  renomearLugar
} from '../src/shared/arvore'
import { DADOS_VAZIOS, type Cartao, type Dados } from '../src/shared/tipos'

const agora = new Date('2026-11-16T10:00:00')
const cartao = (id: string, extra: Partial<Cartao> = {}): Cartao => ({
  id,
  assuntoId: 'a1',
  tipo: 'basico',
  frente: 'f',
  verso: 'v',
  agenda: agendaNova(agora),
  criadoEm: Number(id.replace(/\D/g, '')) || 0,
  ...extra
})

describe('agendamento (FSRS)', () => {
  it('nota maior leva mais longe', () => {
    const p = previsoes(agendaNova(agora), agora)
    expect(p[1]).toBeLessThan(p[3])
    expect(p[3]).toBeLessThanOrEqual(p[4])
  })
  it('acertar várias vezes empurra para dias', () => {
    let a = agendaNova(agora)
    let t = agora
    for (let i = 0; i < 4; i++) {
      a = responder(a, 3, t)
      t = new Date(a.due)
    }
    expect(new Date(a.due).getTime() - agora.getTime()).toBeGreaterThan(86400000)
  })
  it('formata o intervalo', () => {
    expect(formatarIntervalo(30000)).toBe('<1 min')
    expect(formatarIntervalo(8 * 60000)).toBe('8 min')
    expect(formatarIntervalo(3 * 86400000)).toBe('3 dias')
    expect(formatarIntervalo(86400000)).toBe('1 dia')
  })
})

describe('fila do dia', () => {
  it('revisões de hoje entram, as de amanhã não', () => {
    const revisado = responder(responder(agendaNova(agora), 4, agora), 4, agora)
    const hoje = { ...revisado, due: new Date('2026-11-16T22:00:00').toISOString() }
    const amanha = { ...revisado, due: new Date('2026-11-17T08:00:00').toISOString() }
    const f = filaDoDia([cartao('c1', { agenda: hoje }), cartao('c2', { agenda: amanha })], agora)
    expect(f.revisar.map((c) => c.id)).toEqual(['c1'])
  })
  it('respeita o limite de novos por dia', () => {
    const muitos = Array.from({ length: 30 }, (_, i) => cartao(`c${i}`))
    const ja = Array.from({ length: 5 }, (_, i) =>
      cartao(`v${i}`, {
        agenda: responder(agendaNova(agora), 3, agora),
        primeiraRevisao: agora.getTime()
      })
    )
    expect(filaDoDia([...muitos, ...ja], agora).novos).toHaveLength(NOVOS_POR_DIA - 5)
  })
})

describe('lacunas', () => {
  it('esconde na frente e mostra no verso', () => {
    const l = mostrarLacuna('Próclise com {{c1::palavras atrativas}}.')
    expect(l.frente).toBe('Próclise com [...].')
    expect(l.verso).toBe('Próclise com ==palavras atrativas==.')
  })
  it('vira lacuna a partir da anotação, sem a marcação', () => {
    const nota =
      '## Título\n- ==Não== **me** diga isso.\n> **PEGADINHA** Não se inicia frase com oblíquo.'
    expect(lacunaDaAnotacao(nota, 'me')).toBe('Não {{c1::me}} diga isso.')
    expect(lacunaDaAnotacao(nota, 'oblíquo')).toBe('Não se inicia frase com {{c1::oblíquo}}.')
    expect(lacunaDaAnotacao(nota, 'inexistente')).toBeNull()
  })
})

describe('mapa mental', () => {
  const dados: Dados = {
    ...DADOS_VAZIOS,
    materias: [
      {
        id: 'm',
        nome: 'Português',
        aberta: true,
        assuntos: [
          { id: 'a1', nome: 'Pronomes', nota: '', atualizadoEm: 0 },
          { id: 'a2', nome: 'Crase', nota: '', atualizadoEm: 0 }
        ]
      }
    ],
    topicos: [
      { id: 't1', assuntoId: 'a1', paiId: null, nome: 'Colocação', nota: '' },
      { id: 't2', assuntoId: 'a1', paiId: 't1', nome: 'Próclise', nota: '' },
      { id: 't3', assuntoId: 'a2', paiId: null, nome: 'Casos', nota: '' }
    ]
  }
  it('monta matéria → assuntos → tópicos e posiciona o pai no meio', () => {
    const raiz = montarArvore(dados, 'm')!
    const { nos } = posicionar(raiz)
    expect(nos).toHaveLength(6)
    const y = (id: string): number => nos.find((n) => n.no.id === id)!.y
    expect(y('m')).toBe((y('a1') + y('a2')) / 2)
    expect(nos.find((n) => n.no.id === 't2')!.x).toBeGreaterThan(
      nos.find((n) => n.no.id === 't1')!.x
    )
  })
  it('recolhido esconde os filhos mas conta quantos são', () => {
    const raiz = montarArvore({ ...dados, mapaRecolhidos: ['a1'] }, 'm')!
    const a1 = raiz.filhos.find((f) => f.id === 'a1')!
    expect(a1.filhos).toHaveLength(0)
    expect(a1.totalFilhos).toBe(1)
  })
  it('apagar tópico leva os descendentes', () => {
    expect(descendentes(dados, 't1').sort()).toEqual(['t1', 't2'])
  })
})

describe('achados da revisão', () => {
  it('revisão marcada para mais tarde hoje já pode ser mostrada', () => {
    const revisado = responder(responder(agendaNova(agora), 4, agora), 4, agora)
    const c = cartao('c1', {
      agenda: { ...revisado, due: new Date('2026-11-16T22:00:00').toISOString() }
    })
    expect(podeMostrar(c, agora)).toBe(true)
    const aprendendo = cartao('c2', { agenda: responder(agendaNova(agora), 1, agora) })
    expect(podeMostrar(aprendendo, agora)).toBe(false)
  })
  it('limite de novos conta todos os assuntos, mesmo filtrando um', () => {
    const feitosEmA = Array.from({ length: NOVOS_POR_DIA }, (_, i) =>
      cartao(`a${i}`, {
        agenda: responder(agendaNova(agora), 3, agora),
        primeiraRevisao: agora.getTime()
      })
    )
    const novosEmB = Array.from({ length: 5 }, (_, i) => cartao(`b${i}`, { assuntoId: 'a2' }))
    const f = filaDoDia([...feitosEmA, ...novosEmB], agora, new Set(['a2']))
    expect(f.novos).toHaveLength(0)
  })
})

describe('árvore única (v0.1.5)', () => {
  const dados: Dados = {
    ...DADOS_VAZIOS,
    materias: [
      {
        id: 'm',
        nome: 'Português',
        aberta: true,
        assuntos: [{ id: 'a1', nome: 'Morfologia', nota: '', atualizadoEm: 0 }]
      }
    ],
    topicos: [
      { id: 't1', assuntoId: 'a1', paiId: null, nome: 'Estrutura', nota: '' },
      { id: 't2', assuntoId: 'a1', paiId: 't1', nome: 'Radicais', nota: 'nota dos radicais' }
    ],
    cartoes: [cartao('c1', { assuntoId: 't2' }), cartao('c2', { assuntoId: 'a1' })],
    links: [
      { id: 'l', titulo: 'x', url: 'https://x.com', materiaId: 'm', assuntoId: 't2', criadoEm: 0 }
    ]
  }
  it('lista assunto e tópicos em ordem, com caminho e nível', () => {
    expect(
      nosDaMateria(dados, dados.materias[0]).map((n) => `${n.nivel}:${n.caminho.join(' › ')}`)
    ).toEqual(['0:Morfologia', '1:Morfologia › Estrutura', '2:Morfologia › Estrutura › Radicais'])
  })
  it('acha o tópico com a nota e o assunto dele', () => {
    const n = acharNo(dados, 't2')!
    expect([n.tipo, n.nota, n.assuntoId]).toEqual(['topico', 'nota dos radicais', 'a1'])
  })
  it('apagar o assunto leva tópicos e cartões, e o link perde só o lugar', () => {
    const d = structuredClone(dados)
    apagarNo(d, 'a1')
    expect([
      d.topicos.length,
      d.cartoes.length,
      d.links[0].assuntoId,
      d.materias[0].assuntos.length
    ]).toEqual([0, 0, null, 0])
  })
  it('grava a nota no tópico', () => {
    const d = structuredClone(dados)
    gravarNota(d, 't2', 'nova', 5)
    expect(d.topicos[1]).toMatchObject({ nota: 'nova', atualizadoEm: 5 })
  })
})

describe('mapa vertical', () => {
  it('níveis viram linhas e o pai fica no meio dos filhos na horizontal', () => {
    const dados: Dados = {
      ...DADOS_VAZIOS,
      materias: [
        {
          id: 'm',
          nome: 'P',
          aberta: true,
          assuntos: [
            { id: 'a1', nome: 'A', nota: '', atualizadoEm: 0 },
            { id: 'a2', nome: 'B', nota: '', atualizadoEm: 0 }
          ]
        }
      ]
    }
    const { nos } = posicionar(montarArvore(dados, 'm')!, true)
    const p = (id: string) => nos.find((n) => n.no.id === id)!
    expect(p('a1').y).toBe(p('a2').y)
    expect(p('a1').y).toBeGreaterThan(p('m').y)
    expect(p('m').x).toBe((p('a1').x + p('a2').x) / 2)
  })
})

describe('criar no mapa em qualquer nível (v0.1.6)', () => {
  const base = (): Dados => ({
    ...DADOS_VAZIOS,
    materias: [
      {
        id: 'm',
        nome: 'Português',
        aberta: false,
        assuntos: [{ id: 'a1', nome: 'Morfologia', nota: '', atualizadoEm: 0 }]
      }
    ],
    topicos: [{ id: 't1', assuntoId: 'a1', paiId: null, nome: 'Estrutura', nota: '' }],
    mapaRecolhidos: ['m', 't1']
  })
  it('filho da matéria vira assunto e a matéria se abre', () => {
    const d = base()
    expect(adicionarFilho(d, { tipo: 'materia', id: 'm' }, 'a2', 1)).toBe('assunto')
    expect(d.materias[0].assuntos.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(d.mapaRecolhidos).not.toContain('m')
  })
  it('filho de assunto e de tópico vira tópico no lugar certo', () => {
    const d = base()
    expect(adicionarFilho(d, { tipo: 'assunto', id: 'a1' }, 't2', 1)).toBe('topico')
    expect(adicionarFilho(d, { tipo: 'topico', id: 't1' }, 't3', 1)).toBe('topico')
    expect(d.topicos.find((t) => t.id === 't2')).toMatchObject({ assuntoId: 'a1', paiId: null })
    expect(d.topicos.find((t) => t.id === 't3')).toMatchObject({ assuntoId: 'a1', paiId: 't1' })
    expect(d.mapaRecolhidos).not.toContain('t1')
  })
  it('irmão fica no mesmo pai; matéria não tem irmão', () => {
    const d = base()
    expect(adicionarIrmao(d, { tipo: 'assunto', id: 'a1' }, 'a2', 1)).toBe('assunto')
    expect(adicionarIrmao(d, { tipo: 'topico', id: 't1' }, 't2', 1)).toBe('topico')
    expect(d.topicos.find((t) => t.id === 't2')).toMatchObject({ assuntoId: 'a1', paiId: null })
    expect(adicionarIrmao(d, { tipo: 'materia', id: 'm' }, 'x', 1)).toBeNull()
  })
  it('renomeia qualquer nível e ignora nome vazio', () => {
    const d = base()
    renomearLugar(d, 'm', 'Língua Portuguesa')
    renomearLugar(d, 'a1', 'Morfologia I')
    renomearLugar(d, 't1', '  ')
    expect([d.materias[0].nome, d.materias[0].assuntos[0].nome, d.topicos[0].nome]).toEqual([
      'Língua Portuguesa',
      'Morfologia I',
      'Estrutura'
    ])
  })
})

describe('ajustar a vista do mapa (v0.1.8)', () => {
  it('mapa grande cabe na área, sem passar de 100%', () => {
    const v = vistaQueMostra({ x: 0, y: 0, largura: 2000, altura: 1000 }, 826, 677)
    expect(v.zoom).toBeCloseTo((826 - 64) / 2000)
    // centro do mapa no centro da área
    expect(v.x + 1000 * v.zoom).toBeCloseTo(413)
    expect(vistaQueMostra({ x: 0, y: 0, largura: 200, altura: 50 }, 826, 677).zoom).toBe(1)
  })
  it('anda só o necessário para mostrar a caixa', () => {
    const v = { x: 0, y: 0, zoom: 1 }
    expect(
      deslocamentoParaMostrar({ x: 100, y: 100, largura: 240, altura: 52 }, v, 826, 677)
    ).toEqual({ dx: 0, dy: 0 })
    expect(
      deslocamentoParaMostrar({ x: 100, y: 844, largura: 240, altura: 52 }, v, 826, 677)
    ).toEqual({ dx: 0, dy: 677 - 24 - 896 })
  })
})

describe('vertical empilha folhas', () => {
  it('10 folhas irmãs descem em coluna em vez de abrir 10 colunas', () => {
    const dados: Dados = {
      ...DADOS_VAZIOS,
      materias: [
        {
          id: 'm',
          nome: 'P',
          aberta: true,
          assuntos: [{ id: 'a', nome: 'Classes', nota: '', atualizadoEm: 0 }]
        }
      ],
      topicos: Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        assuntoId: 'a',
        paiId: null,
        nome: `C${i}`,
        nota: ''
      }))
    }
    const { nos, largura } = posicionar(montarArvore(dados, 'm')!, true)
    expect(largura).toBeLessThan(400)
    const folhas = nos.filter((n) => n.empilhado)
    expect(folhas).toHaveLength(10)
    expect(new Set(folhas.map((f) => f.x)).size).toBe(1)
  })
})
