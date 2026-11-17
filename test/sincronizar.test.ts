import { describe, expect, it } from 'vitest'
import { dadosVazios, decidir, mensagemDoLogin } from '../src/shared/sincronizar'
import { DADOS_VAZIOS } from '../src/shared/tipos'

const pc = (base: number, alterado: boolean) => ({ base, alterado, mudouEm: 0 })

describe('o que fazer depois de ler a nuvem', () => {
  it('nuvem vazia: este PC manda o que tem', () => {
    expect(decidir(pc(0, false), false, null)).toBe('enviar')
  })
  it('PC novo e vazio (o de casa, na primeira vez): só recebe', () => {
    expect(decidir(pc(0, false), true, { versao: 7 })).toBe('baixar')
  })
  it('PC novo que já tem coisa: pergunta, não passa por cima', () => {
    expect(decidir(pc(0, true), false, { versao: 7 })).toBe('conflito')
  })
  it('mesma versão: manda se mudou aqui, senão nada', () => {
    expect(decidir(pc(7, true), false, { versao: 7 })).toBe('enviar')
    expect(decidir(pc(7, false), false, { versao: 7 })).toBe('nada')
  })
  it('a nuvem andou (o outro PC salvou): recebe; se os dois mudaram, pergunta', () => {
    expect(decidir(pc(7, false), false, { versao: 9 })).toBe('baixar')
    expect(decidir(pc(7, true), false, { versao: 9 })).toBe('conflito')
  })
  it('dados vazios = nada a perder', () => {
    expect(dadosVazios(structuredClone(DADOS_VAZIOS))).toBe(true)
    expect(
      dadosVazios({
        ...structuredClone(DADOS_VAZIOS),
        materias: [{ id: 'm', nome: 'P', aberta: true, assuntos: [] }]
      })
    ).toBe(false)
  })
})

describe('erro do login em português', () => {
  it('traduz as respostas do Supabase', () => {
    expect(mensagemDoLogin(400, '{"error_description":"Invalid login credentials"}')).toBe(
      'E-mail ou senha errados.'
    )
    expect(mensagemDoLogin(400, '{"msg":"Email not confirmed"}')).toMatch(/confirmar o e-mail/)
    expect(mensagemDoLogin(429, 'too many')).toMatch(/Muitas tentativas/)
    expect(mensagemDoLogin(500, 'boom')).toBe(
      'Não consegui (erro 500). Tente de novo em instantes.'
    )
  })
})
