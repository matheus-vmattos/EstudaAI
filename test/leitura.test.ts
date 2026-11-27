import { describe, expect, it } from 'vitest'
import { faixaDoTexto, lerEnunciado, marcar, paragrafos, pedacos } from '../src/shared/leitura'

describe('leitura da questão', () => {
  it('tira o número do caderno e separa o texto de apoio', () => {
    const l = lerEnunciado(
      '[Questão 11] Leia o texto:\n\nPrimeiro.\nSegundo.\n\nIdentifica-se no texto'
    )
    expect(l.numero).toBe('11')
    expect(l.apoio).toBe('Primeiro.\nSegundo.')
    expect(l.antes).toBe('Identifica-se no texto')
    expect(paragrafos(l.apoio!)).toEqual([
      { ini: 0, texto: 'Primeiro.' },
      { ini: 10, texto: 'Segundo.' }
    ])
  })

  it('põe I, II, III um por linha e separa o comando', () => {
    const l = lerEnunciado(
      'Considere as afirmativas. I. A taxa é anual. II. O prazo é de 30 dias. III. Vale para todos. Está correto o que se afirma APENAS em'
    )
    expect(l.antes).toBe('Considere as afirmativas.')
    expect(l.itens.map((i) => i.marca)).toEqual(['I.', 'II.', 'III.'])
    expect(l.itens[2].texto).toBe('Vale para todos.')
    expect(l.depois).toBe('Está correto o que se afirma APENAS em')
  })

  it('comando sem frase conhecida: a última frase sem ponto final', () => {
    const l = lerEnunciado(
      'Considere: I. CDB; II. ações; III. cotas de fundos. Pelas regras gerais, integra a categoria garantida pelo FGC'
    )
    expect(l.itens).toHaveLength(3)
    expect(l.itens[2].texto).toBe('cotas de fundos.')
    expect(l.depois).toBe('Pelas regras gerais, integra a categoria garantida pelo FGC')
  })

  it('V/F com ( ) e "As afirmativas são, respectivamente,"', () => {
    const l = lerEnunciado(
      'Assinale V ou F. ( ) O BCB é autarquia. ( ) O BCB emite moeda. As afirmativas são, respectivamente,'
    )
    expect(l.itens.map((i) => i.texto)).toEqual(['O BCB é autarquia.', 'O BCB emite moeda.'])
    expect(l.depois).toBe('As afirmativas são, respectivamente,')
  })

  it('não inventa lista: um "I." solto não vira item', () => {
    const t = 'Pelo art. 5º, inciso I. da lei, o prazo é de 30 dias. Assinale a correta.'
    expect(lerEnunciado(t)).toEqual({
      numero: undefined,
      apoio: undefined,
      antes: t,
      itens: [],
      depois: ''
    })
  })

  it('marca-texto junta trechos sobrepostos e divide o parágrafo', () => {
    let t = marcar([], [5, 10])
    t = marcar(t, [8, 14])
    t = marcar(t, [20, 18])
    expect(t).toEqual([
      [5, 14],
      [18, 20]
    ])
    expect(pedacos(10, '0123456789', t)).toEqual([
      { ini: 10, texto: '0123', marcado: true },
      { ini: 14, texto: '4567', marcado: false },
      { ini: 18, texto: '89', marcado: true }
    ])
  })

  it('faixa: as questões vizinhas do mesmo texto', () => {
    const q = (e: string): { enunciado: string } => ({ enunciado: e })
    const qs = [
      q('Sem texto'),
      q('Leia o texto:\n\nX\n\nA'),
      q('Leia o texto:\n\nX\n\nB'),
      q('Fim')
    ]
    expect(faixaDoTexto(qs, 2)).toEqual([2, 3])
    expect(faixaDoTexto(qs, 0)).toEqual([1, 1])
  })
})
