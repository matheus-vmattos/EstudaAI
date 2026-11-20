import { ipcMain, net } from 'electron'
import type { ItemDaCaixa } from '../shared/tipos'

/** Conteúdo que o Claude prepara (mapas, simulados, cartões) fica na pasta
 *  conteudo/ do repositório público; o app só lê. */
// ESTUDAAI_CAIXA_URL: só para os testes apontarem para uma pasta local
const BASE =
  process.env['ESTUDAAI_CAIXA_URL'] ??
  'https://raw.githubusercontent.com/matheus-vmattos/EstudaAI/main/conteudo/'
// só nome simples de arquivo: nada de ../ nem endereço de fora
const NOME_VALIDO = /^[a-z0-9][a-z0-9-]*\.(txt|json)$/
const TIPOS = new Set(['estrutura', 'simulado', 'cartoes', 'edital', 'missao'])

async function baixar(nome: string): Promise<string> {
  const r = await net.fetch(BASE + nome + `?t=${Date.now()}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

const mensagem = (e: unknown): string =>
  /HTTP 404/.test(String(e))
    ? 'Ainda não há nada na caixa.'
    : 'Não consegui buscar agora (sem internet?). Tente de novo em instantes.'

export function iniciarCaixa(): void {
  ipcMain.handle('caixa:listar', async (): Promise<{ itens: ItemDaCaixa[] } | { erro: string }> => {
    try {
      const bruto = JSON.parse(await baixar('caixa.json')) as { itens?: unknown }
      const itens = (Array.isArray(bruto.itens) ? bruto.itens : []).filter(
        (i): i is ItemDaCaixa =>
          !!i &&
          typeof i === 'object' &&
          typeof (i as ItemDaCaixa).id === 'string' &&
          typeof (i as ItemDaCaixa).titulo === 'string' &&
          TIPOS.has((i as ItemDaCaixa).tipo) &&
          NOME_VALIDO.test(String((i as ItemDaCaixa).arquivo))
      )
      return { itens }
    } catch (e) {
      return { erro: mensagem(e) }
    }
  })
  ipcMain.handle(
    'caixa:arquivo',
    async (_e, nome: string): Promise<{ texto: string } | { erro: string }> => {
      if (!NOME_VALIDO.test(String(nome))) return { erro: 'Arquivo inválido.' }
      try {
        return { texto: await baixar(nome) }
      } catch (e) {
        return { erro: mensagem(e) }
      }
    }
  )
}
