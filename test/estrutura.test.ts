import { describe, expect, it } from 'vitest'
import {
  importarEstrutura,
  lerEstrutura,
  sobAMateria,
  type NoDoTexto
} from '../src/shared/estrutura'
import { nosDaMateria } from '../src/shared/arvore'
import { DADOS_VAZIOS, type Dados } from '../src/shared/tipos'

const resumo = (nos: NoDoTexto[], nivel = 0): string[] =>
  nos.flatMap((n) => [`${'  '.repeat(nivel)}${n.nome}`, ...resumo(n.filhos, nivel + 1)])

const ARVORE = `PORTUGUÊS
├─ Fonologia
│  ├─ Fonema e letra
│  └─ Acentuação gráfica e ortografia
├─ Morfologia
│  ├─ Estrutura das palavras
│  │  └─ Radical · Afixos · Desinências · Vogal temática
│  └─ Classes de palavras
└─ Sintaxe
   └─ Crase`

describe('ler estrutura', () => {
  it('desenho de árvore, com "·" virando irmãos', () => {
    expect(resumo(lerEstrutura(ARVORE))).toEqual([
      'PORTUGUÊS',
      '  Fonologia',
      '    Fonema e letra',
      '    Acentuação gráfica e ortografia',
      '  Morfologia',
      '    Estrutura das palavras',
      '      Radical',
      '      Afixos',
      '      Desinências',
      '      Vogal temática',
      '    Classes de palavras',
      '  Sintaxe',
      '    Crase'
    ])
  })
  it('recuo com espaços, tab, traços e números', () => {
    const texto =
      '```\nDireito Constitucional\n  - Direitos fundamentais\n\t1. Art. 5º\n  - Organização do Estado\n```'
    expect(resumo(lerEstrutura(texto))).toEqual([
      'Direito Constitucional',
      '  Direitos fundamentais',
      '    Art. 5º',
      '  Organização do Estado'
    ])
  })
})

describe('importar estrutura', () => {
  const existente = (): Dados => ({
    ...DADOS_VAZIOS,
    materias: [
      {
        id: 'm',
        nome: 'Portugues',
        aberta: true,
        assuntos: [{ id: 'a1', nome: 'Morfologia', nota: 'minha nota', atualizadoEm: 0 }]
      }
    ],
    topicos: [{ id: 't1', assuntoId: 'a1', paiId: null, nome: 'Estrutura das palavras', nota: '' }]
  })
  it('aproveita o que já existe (sem ligar para acento) e cria só o que falta', () => {
    const d = existente()
    let n = 0
    const r = importarEstrutura(d, lerEstrutura(ARVORE), () => `n${n++}`, 1)
    expect(r.aproveitados).toBe(3) // Português, Morfologia, Estrutura das palavras
    expect(r.criados).toBe(10)
    expect(d.materias).toHaveLength(1)
    expect(d.materias[0].assuntos.map((a) => a.nome)).toEqual([
      'Morfologia',
      'Fonologia',
      'Sintaxe'
    ])
    expect(d.materias[0].assuntos[0].nota).toBe('minha nota')
    const caminhos = nosDaMateria(d, d.materias[0]).map((x) => x.caminho.join(' › '))
    expect(caminhos).toContain('Morfologia › Estrutura das palavras › Radical')
    expect(caminhos).toContain('Sintaxe › Crase')
  })
  it('importar duas vezes não duplica', () => {
    const d = existente()
    let n = 0
    importarEstrutura(d, lerEstrutura(ARVORE), () => `n${n++}`, 1)
    const r = importarEstrutura(d, lerEstrutura(ARVORE), () => `x${n++}`, 1)
    expect(r.criados).toBe(0)
  })
  it('colado com a matéria escolhida: o texto sem a matéria vira assuntos dela', () => {
    expect(resumo(sobAMateria(lerEstrutura('Pontuação\n  Vírgula'), 'Português'))).toEqual([
      'Português',
      '  Pontuação',
      '    Vírgula'
    ])
    expect(sobAMateria(lerEstrutura(ARVORE), 'Português')[0].nome).toBe('PORTUGUÊS')
  })
})

describe('conteúdo publicado na caixa', () => {
  it('a estrutura de Português, no mapa do Matheus já renomeado, não duplica nada', async () => {
    const fs = await import('fs')
    const texto = fs.readFileSync('conteudo/portugues-estrutura.txt', 'utf-8')
    const caixa = JSON.parse(fs.readFileSync('conteudo/caixa.json', 'utf-8'))
    expect(
      caixa.itens.every((i: { arquivo: string }) => fs.existsSync(`conteudo/${i.arquivo}`))
    ).toBe(true)
    // o mapa da captura, depois dos 3 renomes pedidos na descrição
    const d: Dados = {
      ...DADOS_VAZIOS,
      materias: [
        {
          id: 'm',
          nome: 'PORTUGUES',
          aberta: true,
          assuntos: [
            { id: 'a1', nome: 'Fonologia', nota: '', atualizadoEm: 0 },
            { id: 'a2', nome: 'Morfologia', nota: '', atualizadoEm: 0 },
            { id: 'a3', nome: 'Sintaxe', nota: '', atualizadoEm: 0 }
          ]
        }
      ],
      topicos: [
        { id: 't1', assuntoId: 'a2', paiId: null, nome: 'Estrutura das palavras', nota: '' }
      ]
    }
    let n = 0
    const r = importarEstrutura(d, lerEstrutura(texto), () => `n${n++}`, 1)
    expect(r.aproveitados).toBe(5)
    expect(d.materias).toHaveLength(1)
    expect(d.materias[0].assuntos.map((a) => a.nome)).toEqual([
      'Fonologia',
      'Morfologia',
      'Sintaxe',
      'Pontuação',
      'Semântica',
      'Interpretação de texto'
    ])
    const classes = nosDaMateria(d, d.materias[0]).filter(
      (x) => x.caminho[1] === 'Classes de palavras'
    )
    expect(classes).toHaveLength(11) // o tópico e as 10 classes
  })
})

describe('nível pelo recuo, não pelo marcador', () => {
  it('"10." não fica mais fundo que "9."', () => {
    expect(resumo(lerEstrutura('Português\n  9. Sintaxe\n  10. Pontuação'))).toEqual([
      'Português',
      '  Sintaxe',
      '  Pontuação'
    ])
  })
  it('linha com traço e linha sem traço no recuo maior: é filho', () => {
    expect(resumo(lerEstrutura('Português\n  - Sintaxe\n    Crase'))).toEqual([
      'Português',
      '  Sintaxe',
      '    Crase'
    ])
  })
  it('árvore em ASCII (|--)', () => {
    expect(resumo(lerEstrutura('Português\n|-- Sintaxe\n|   |-- Crase\n|-- Pontuação'))).toEqual([
      'Português',
      '  Sintaxe',
      '    Crase',
      '  Pontuação'
    ])
  })
})
