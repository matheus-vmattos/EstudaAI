import { describe, expect, it } from 'vitest'
import { importarEstrutura, lerEstrutura } from '../src/shared/estrutura'
import { destinosPara, moverNo, nosDaMateria, procurarDestino } from '../src/shared/arvore'
import { agendaNova, filaDoDia, revezar } from '../src/shared/flashcards'
import { importarCartoes, lerPacoteDeCartoes } from '../src/shared/pacoteDeCartoes'
import { lerPacoteDeEdital } from '../src/shared/edital'
import { DADOS_VAZIOS, type Cartao, type Dados } from '../src/shared/tipos'

// a árvore do print do Matheus: Pronome e Variáveis são irmãos
const ARVORE = `Português
├─ Morfologia
│  └─ Classes de palavras
│     └─ Pronome · Verbo · Variáveis · Invariáveis
│        (filhos de Pronome abaixo)
└─ Sintaxe
   └─ Crase`

function montar(): { d: Dados; id: (nome: string) => string } {
  const d: Dados = structuredClone(DADOS_VAZIOS)
  let n = 0
  importarEstrutura(d, lerEstrutura(ARVORE.replace(/\n.*\(filhos.*\)/, '')), () => `n${++n}`, 1)
  const id = (nome: string): string => {
    const no = d.materias.flatMap((m) => nosDaMateria(d, m)).find((x) => x.nome === nome)
    if (no) return no.id
    return d.materias.find((m) => m.nome === nome)!.id
  }
  // Pronome tem um filho, uma anotação, um cartão e um link
  d.topicos.push({
    id: 'pess',
    assuntoId: id('Morfologia'),
    paiId: id('Pronome'),
    nome: 'Pessoais',
    nota: ''
  })
  d.cartoes.push({
    id: 'c1',
    assuntoId: id('Pronome'),
    tipo: 'basico',
    frente: 'f',
    verso: 'v',
    agenda: agendaNova(),
    criadoEm: 1
  })
  d.links.push({
    id: 'l1',
    titulo: 'aula',
    url: 'https://youtube.com/x',
    materiaId: id('Português'),
    assuntoId: 'pess',
    criadoEm: 1
  })
  return { d, id }
}

describe('mover nó', () => {
  it('Pronome vai para dentro de Variáveis levando filho, cartão e link', () => {
    const { d, id } = montar()
    expect(moverNo(d, id('Pronome'), { tipo: 'topico', id: id('Variáveis') })).toBe(true)
    const pronome = d.topicos.find((t) => t.nome === 'Pronome')!
    expect(pronome.paiId).toBe(id('Variáveis'))
    expect(d.topicos.find((t) => t.id === 'pess')!.paiId).toBe(pronome.id)
    expect(d.cartoes[0].assuntoId).toBe(pronome.id)
    const m = d.materias[0]
    expect(nosDaMateria(d, m).find((n) => n.nome === 'Pessoais')!.caminho).toEqual([
      'Morfologia',
      'Classes de palavras',
      'Variáveis',
      'Pronome',
      'Pessoais'
    ])
  })

  it('não deixa ir para dentro de si mesmo nem para o lugar onde já está', () => {
    const { d, id } = montar()
    const antes = JSON.stringify(d)
    expect(moverNo(d, id('Pronome'), { tipo: 'topico', id: 'pess' })).toBe(false)
    expect(moverNo(d, id('Pronome'), { tipo: 'topico', id: id('Pronome') })).toBe(false)
    expect(moverNo(d, id('Pronome'), { tipo: 'topico', id: id('Classes de palavras') })).toBe(false)
    expect(JSON.stringify(d)).toBe(antes)
    const ids = destinosPara(d, id('Pronome')).map((x) => x.id)
    expect(ids).not.toContain('pess')
    expect(ids).not.toContain(id('Classes de palavras'))
    expect(ids).toContain(id('Variáveis'))
  })

  it('tópico vira assunto de outra matéria e o link acompanha a matéria', () => {
    const { d, id } = montar()
    d.materias.push({ id: 'gram', nome: 'Gramática', aberta: true, assuntos: [] })
    expect(moverNo(d, id('Pronome'), { tipo: 'materia', id: 'gram' })).toBe(true)
    expect(d.materias[1].assuntos.map((a) => a.nome)).toEqual(['Pronome'])
    expect(d.topicos.some((t) => t.nome === 'Pronome')).toBe(false)
    const pess = d.topicos.find((t) => t.id === 'pess')!
    expect([pess.assuntoId, pess.paiId]).toEqual([id('Pronome'), null])
    expect(d.links[0].materiaId).toBe('gram')
  })

  it('assunto vira tópico: os tópicos dele passam a ser filhos', () => {
    const { d, id } = montar()
    const sintaxe = id('Sintaxe')
    expect(moverNo(d, sintaxe, { tipo: 'assunto', id: id('Morfologia') })).toBe(true)
    expect(d.materias[0].assuntos.map((a) => a.nome)).toEqual(['Morfologia'])
    const crase = d.topicos.find((t) => t.nome === 'Crase')!
    expect([crase.assuntoId, crase.paiId]).toEqual([id('Morfologia'), sintaxe])
  })

  it('o destino recolhido abre para o nó aparecer', () => {
    const { d, id } = montar()
    d.mapaRecolhidos = [id('Variáveis'), id('Classes de palavras'), id('Sintaxe')]
    moverNo(d, 'pess', { tipo: 'topico', id: id('Variáveis') })
    expect(d.mapaRecolhidos).toEqual([id('Sintaxe')])
  })

  it('a busca acha por parte do nome, sem acento, e o nome vem antes do caminho', () => {
    const { d, id } = montar()
    const achados = procurarDestino(destinosPara(d, id('Pronome')), 'vari')
    expect(achados[0].nome).toBe('Variáveis')
    expect(achados[0].acima).toEqual(['Português', 'Morfologia', 'Classes de palavras'])
    expect(procurarDestino(destinosPara(d, 'pess'), 'sintaxe crase').map((x) => x.nome)).toEqual([
      'Crase'
    ])
  })
})

describe('cartões mesclados', () => {
  it('revezar: um de cada grupo por vez, mantendo a ordem dentro do grupo', () => {
    const r = revezar(['a1', 'a2', 'a3', 'b1', 'c1', 'c2'], (x) => x[0])
    expect(r).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3'])
  })

  it('novos do dia saem revezando os tópicos, não cinco de crase seguidos', () => {
    const agora = new Date('2026-11-16T12:00:00')
    const novo = (id: string, lugar: string, criadoEm: number): Cartao => ({
      id,
      assuntoId: lugar,
      tipo: 'basico',
      frente: id,
      verso: '',
      agenda: agendaNova(agora),
      criadoEm
    })
    const cartoes = [
      ...[1, 2, 3, 4, 5].map((i) => novo(`crase${i}`, 'crase', i)),
      ...[1, 2].map((i) => novo(`reg${i}`, 'regencia', 10 + i)),
      novo('conc1', 'concordancia', 20)
    ]
    expect(filaDoDia(cartoes, agora).novos.map((c) => c.id)).toEqual([
      'crase1',
      'reg1',
      'conc1',
      'crase2',
      'reg2',
      'crase3',
      'crase4',
      'crase5'
    ])
  })

  it('revisão atrasada vem antes; as de hoje revezam', () => {
    const agora = new Date('2026-11-16T12:00:00')
    const rev = (id: string, lugar: string, due: string): Cartao => ({
      id,
      assuntoId: lugar,
      tipo: 'basico',
      frente: id,
      verso: '',
      agenda: { ...agendaNova(agora), state: 2, due: new Date(due).toISOString() },
      criadoEm: 0
    })
    const fila = filaDoDia(
      [
        rev('a-hoje1', 'a', '2026-11-16T08:00:00'),
        rev('a-hoje2', 'a', '2026-11-16T09:00:00'),
        rev('b-hoje', 'b', '2026-11-16T10:00:00'),
        rev('a-ontem', 'a', '2026-11-15T10:00:00')
      ],
      agora
    )
    expect(fila.revisar.map((c) => c.id)).toEqual(['a-ontem', 'a-hoje1', 'b-hoje', 'a-hoje2'])
  })
})

describe('pacote de cartões da caixa', () => {
  const PACOTE = JSON.stringify({
    materia: 'Português',
    cartoes: [
      { lugar: ['Sintaxe', 'Crase'], frente: 'Antes de palavra masculina, {{c1::não}} há crase.' },
      { lugar: ['Sintaxe', 'Crase'], frente: 'Crase antes de verbo?', verso: 'Nunca.' },
      {
        lugar: ['Sintaxe', 'Regência verbal e nominal'],
        frente: 'Assistir (ver) pede?',
        verso: 'Preposição "a".'
      }
    ]
  })

  it('frentes que só diferem no acento são cartões diferentes', () => {
    const { d } = montar()
    const r = lerPacoteDeCartoes(
      JSON.stringify({
        materia: 'Português',
        cartoes: [
          { lugar: ['Sintaxe', 'Crase'], frente: 'Explique o uso de "por".', verso: 'Preposição.' },
          { lugar: ['Sintaxe', 'Crase'], frente: 'Explique o uso de "pôr".', verso: 'Verbo.' }
        ]
      })
    )
    if (!r.ok) throw new Error(r.erro)
    let n = 0
    expect(importarCartoes(d, r.pacote, () => `y${++n}`, 1).novos).toBe(2)
  })

  it('lê lacuna e frente/verso; recusa cartão incompleto', () => {
    const r = lerPacoteDeCartoes(PACOTE)
    expect(r.ok && r.pacote.cartoes.map((c) => c.tipo)).toEqual(['lacuna', 'basico', 'basico'])
    const ruim = lerPacoteDeCartoes(
      JSON.stringify({
        materia: 'Português',
        cartoes: [{ lugar: ['Sintaxe'], frente: 'sem verso' }]
      })
    )
    expect(ruim).toEqual({ ok: false, erro: 'O cartão 1 do arquivo está incompleto.' })
    expect(lerPacoteDeCartoes('{').ok).toBe(false)
  })

  it('põe no lugar existente (sem ligar para acento), cria o que falta e não duplica', () => {
    const { d, id } = montar()
    d.materias[0].nome = 'PORTUGUES' // a pessoa escreveu diferente
    const r = lerPacoteDeCartoes(PACOTE)
    if (!r.ok) throw new Error(r.erro)
    let n = 0
    const novoId = (): string => `x${++n}`
    const res = importarCartoes(d, r.pacote, novoId, 1000)
    // corrigidos: errata (v0.1.19); este pacote não traz nenhuma
    expect(res).toEqual({ novos: 3, repetidos: 0, lugaresCriados: 1, corrigidos: 0 })
    expect(d.materias).toHaveLength(1)
    const daCrase = d.cartoes.filter((c) => c.assuntoId === id('Crase'))
    expect(daCrase.map((c) => c.criadoEm)).toEqual([1000, 1001])
    const regencia = d.topicos.find((t) => t.nome === 'Regência verbal e nominal')!
    expect(regencia.assuntoId).toBe(id('Sintaxe'))
    expect(importarCartoes(d, r.pacote, novoId, 2000)).toEqual({
      novos: 0,
      repetidos: 3,
      lugaresCriados: 0,
      corrigidos: 0
    })
  })
})

describe('o que está publicado na caixa', () => {
  it('todo item aponta para um arquivo que existe e que o app consegue ler', async () => {
    const { readFileSync } = await import('node:fs')
    const ler = (nome: string): string => readFileSync(`conteudo/${nome}`, 'utf-8')
    const caixa = JSON.parse(ler('caixa.json')) as { itens: { tipo: string; arquivo: string }[] }
    for (const item of caixa.itens) {
      const texto = ler(item.arquivo)
      if (item.tipo === 'cartoes') {
        const r = lerPacoteDeCartoes(texto)
        expect(r.ok, item.arquivo).toBe(true)
      } else if (item.tipo === 'estrutura') expect(lerEstrutura(texto).length).toBeGreaterThan(0)
      else if (item.tipo === 'edital') expect(lerPacoteDeEdital(texto).ok, item.arquivo).toBe(true)
    }
  })
})
