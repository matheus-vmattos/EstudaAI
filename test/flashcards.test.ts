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
import { descendentes, montarArvore, posicionar } from '../src/shared/mapa'
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
