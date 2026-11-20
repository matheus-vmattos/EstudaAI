import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import katex from 'katex'
import { separarFormulas } from '../src/shared/formulas'
import { lerPacoteDeCartoes } from '../src/shared/pacoteDeCartoes'
import { lerPacoteDeAnotacoes } from '../src/shared/anotacoesDoClaude'
import { lerPacoteDeMissao } from '../src/shared/missao'
import { lerRespostaDaIa } from '../src/shared/questoes'

/** Portão de qualidade do que vai para a caixa "Do Claude": todo arquivo
 *  publicado lê sem erro no app, toda fórmula renderiza no KaTeX em modo
 *  estrito, todo item aponta para um arquivo que existe e toda tarefa de
 *  missão aponta para um item que existe. */
const PASTA = 'conteudo/'
const caixa = JSON.parse(readFileSync(PASTA + 'caixa.json', 'utf-8')) as {
  itens: { id: string; tipo: string; arquivo: string }[]
}
const ler = (arquivo: string): string => readFileSync(PASTA + arquivo, 'utf-8')

const formulasDe = (texto: string): string[] =>
  separarFormulas(texto).flatMap((p) => (typeof p === 'string' ? [] : [p.tex]))
const renderiza = (tex: string): void => {
  katex.renderToString(tex, {
    throwOnError: true,
    strict: (codigo: string) => {
      throw new Error(`KaTeX (${codigo}): ${tex}`)
    }
  })
}

describe('conteúdo publicado na caixa', () => {
  it('ids únicos e arquivos que existem', () => {
    const ids = caixa.itens.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    const arquivos = new Set(readdirSync(PASTA))
    for (const i of caixa.itens) expect(arquivos.has(i.arquivo), i.arquivo).toBe(true)
  })

  for (const item of caixa.itens) {
    it(`${item.id}: lê no app e as fórmulas renderizam`, () => {
      const texto = ler(item.arquivo)
      const textos: string[] = []
      if (item.tipo === 'cartoes') {
        const r = lerPacoteDeCartoes(texto)
        if (!r.ok) throw new Error(r.erro)
        for (const c of r.pacote.cartoes) textos.push(c.frente, c.verso)
      } else if (item.tipo === 'anotacoes') {
        const r = lerPacoteDeAnotacoes(texto)
        if (!r.ok) throw new Error(r.erro)
        for (const n of r.pacote.notas) textos.push(n.texto)
      } else if (item.tipo === 'simulado') {
        const r = lerRespostaDaIa(texto)
        if (!r.ok) throw new Error(r.erro)
        for (const q of r.questoes)
          textos.push(
            q.enunciado,
            q.resolucao,
            q.conceito ?? '',
            ...q.alternativas.map((a) => a.texto)
          )
      } else if (item.tipo === 'missao') {
        const r = lerPacoteDeMissao(texto, item.id, 0)
        if (!r.ok) throw new Error(r.erro)
        const existentes = new Set(caixa.itens.map((i) => i.id))
        for (const t of r.missao.tarefas)
          if ('item' in t) expect(existentes.has(t.item), `${t.id} → ${t.item}`).toBe(true)
      }
      for (const t of textos) for (const tex of formulasDe(t)) renderiza(tex)
    })
  }
})
