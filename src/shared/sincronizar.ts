import type { Dados } from './tipos'

/** O que este PC sabe da última vez que falou com a nuvem */
export interface MemoriaDaNuvem {
  /** versão da nuvem que este PC tem; 0 = nunca sincronizou */
  base: number
  /** mudou algo aqui depois da última sincronização */
  alterado: boolean
  /** quando mudou aqui pela última vez (para a pergunta de conflito) */
  mudouEm: number
}

export type Decisao = 'nada' | 'enviar' | 'baixar' | 'conflito'

/** O que fazer depois de ler a nuvem. Nunca passa por cima de mudança
 *  dos dois lados sem perguntar. */
export function decidir(
  local: MemoriaDaNuvem,
  localVazio: boolean,
  remoto: { versao: number } | null
): Decisao {
  if (!remoto) return 'enviar'
  // PC que nunca sincronizou: se está vazio, só recebe; se já tem coisa, pergunta
  if (local.base === 0) return localVazio ? 'baixar' : 'conflito'
  if (remoto.versao === local.base) return local.alterado ? 'enviar' : 'nada'
  if (remoto.versao > local.base) return local.alterado ? 'conflito' : 'baixar'
  // a nuvem voltou para trás (apagada e recriada): o PC manda o que tem
  return 'enviar'
}

/** sem matéria, cartão, link nem simulado: nada a perder */
export const dadosVazios = (d: Dados): boolean =>
  !d.materias.length && !d.cartoes.length && !d.links.length && !d.simulados.length

export type SituacaoDaNuvem = 'desconectado' | 'sincronizando' | 'ok' | 'semInternet' | 'erro'

export interface EstadoDaNuvem {
  situacao: SituacaoDaNuvem
  email: string
  ultimaSync: number
  mensagem: string
}

/** O erro do servidor em português de gente, para quem está entrando */
export function mensagemDoLogin(status: number, corpo: string): string {
  const t = corpo.toLowerCase()
  if (t.includes('invalid login credentials')) return 'E-mail ou senha errados.'
  if (t.includes('email not confirmed'))
    return 'Falta confirmar o e-mail: abra o link que chegou na sua caixa de entrada.'
  if (t.includes('already registered') || t.includes('already exists'))
    return 'Já existe uma conta com esse e-mail. Use Entrar.'
  if (t.includes('password') && (t.includes('at least') || t.includes('weak')))
    return 'Senha fraca: use pelo menos 6 caracteres.'
  if (t.includes('signups not allowed') || t.includes('signup is disabled'))
    return 'Cadastro fechado. Use Entrar com a conta que já existe.'
  if (status === 429 || t.includes('rate limit'))
    return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
  if (t.includes('invalid') && t.includes('email')) return 'Esse e-mail não parece válido.'
  return `Não consegui (erro ${status}). Tente de novo em instantes.`
}
