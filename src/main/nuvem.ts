import { BrowserWindow, ipcMain, net, safeStorage } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { hostname } from 'os'
import { join } from 'path'
import { app } from 'electron'
import { gravarArquivoSeguro, guardarCopia, lerDados, salvarDados } from './dados'
import {
  dadosVazios,
  decidir,
  mensagemDoLogin,
  type EstadoDaNuvem,
  type MemoriaDaNuvem
} from '../shared/sincronizar'
import type { Dados } from '../shared/tipos'

/** Sincronização entre PCs: os dados de cada conta numa linha do Supabase
 *  (projeto painelfin, tabela estudaai_dados). O PC continua sendo a fonte:
 *  sem internet tudo funciona e sobe quando voltar.
 *  ponytail: fetch direto nas rotas do Supabase em vez do SDK -- são cinco
 *  chamadas, e o SDK traria dezenas de arquivos para o instalador. */
// ESTUDAAI_NUVEM_URL/CHAVE: só para os testes apontarem para outro lugar
const URL_NUVEM = process.env['ESTUDAAI_NUVEM_URL'] ?? 'https://jkmgrwtsdusrwbkuvovm.supabase.co'
// chave pública (feita para ir dentro do app): só abre o que as regras do
// banco deixam -- cada conta lê e grava a própria linha, e nada do painelfin
const CHAVE =
  process.env['ESTUDAAI_NUVEM_CHAVE'] ?? 'sb_publishable_ztQXNDQLYxe-HpbZTfCZgQ_ry1Wx1RV'

interface Memoria extends MemoriaDaNuvem {
  email: string
  userId: string
  /** token de renovação, cifrado pelo Windows quando dá */
  renovar: string
  cifrado: boolean
  ultimaSync: number
}

interface Remoto {
  dados: Dados
  versao: number
  aparelho: string
  atualizado_em: string
}

class SemInternet extends Error {}
class SessaoPerdida extends Error {}
class Conflito extends Error {}

const caminho = (): string => join(app.getPath('userData'), 'nuvem.json')
let memoria: Memoria | null = null
let acesso: { token: string; expiraEm: number } | null = null
let estado: EstadoDaNuvem = { situacao: 'desconectado', email: '', ultimaSync: 0, mensagem: '' }
let janela: () => BrowserWindow | null = () => null
// quantas vezes o PC salvou: se mudou durante um envio, o envio não "limpa" a mudança
let edicoes = 0

function lerMemoria(): void {
  if (!existsSync(caminho())) return
  try {
    memoria = JSON.parse(readFileSync(caminho(), 'utf-8')) as Memoria
  } catch {
    memoria = null
  }
}
const gravarMemoria = (): void => {
  if (memoria) gravarArquivoSeguro(caminho(), JSON.stringify(memoria))
}

const tokenGuardado = (m: Memoria): string =>
  m.cifrado ? safeStorage.decryptString(Buffer.from(m.renovar, 'base64')) : m.renovar
function guardarToken(token: string): void {
  if (!memoria) return
  // ponytail: no Windows o safeStorage cifra com a conta do usuário (DPAPI);
  // onde não houver cofre, fica em texto na pasta do app, como o resto dos dados
  const cifrar = safeStorage.isEncryptionAvailable()
  memoria.renovar = cifrar ? safeStorage.encryptString(token).toString('base64') : token
  memoria.cifrado = cifrar
}

function emitir(mudanca: Partial<EstadoDaNuvem>): void {
  estado = { ...estado, ...mudanca }
  janela()?.webContents.send('nuvem:estado', estado)
}

async function pedir(rota: string, init: RequestInit = {}, comToken = true): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: CHAVE,
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>)
  }
  if (comToken) headers['Authorization'] = `Bearer ${await token()}`
  try {
    return await net.fetch(URL_NUVEM + rota, { ...init, headers })
  } catch {
    throw new SemInternet()
  }
}

async function guardarSessao(r: Response, email: string): Promise<void> {
  const s = (await r.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    user: { id: string }
  }
  // outra conta neste PC: começa do zero com a nuvem dela
  if (!memoria || memoria.userId !== s.user.id)
    memoria = {
      email,
      userId: s.user.id,
      renovar: '',
      cifrado: false,
      base: 0,
      alterado: true,
      mudouEm: 0,
      ultimaSync: 0
    }
  memoria.email = email
  guardarToken(s.refresh_token)
  acesso = { token: s.access_token, expiraEm: Date.now() + s.expires_in * 1000 }
  gravarMemoria()
}

async function token(): Promise<string> {
  if (acesso && acesso.expiraEm - 60_000 > Date.now()) return acesso.token
  if (!memoria?.renovar) throw new SessaoPerdida()
  const r = await pedir(
    '/auth/v1/token?grant_type=refresh_token',
    { method: 'POST', body: JSON.stringify({ refresh_token: tokenGuardado(memoria) }) },
    false
  )
  if (r.status === 400 || r.status === 401) throw new SessaoPerdida()
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  await guardarSessao(r, memoria.email)
  return acesso!.token
}

async function puxar(): Promise<Remoto | null> {
  const r = await pedir('/rest/v1/estudaai_dados?select=dados,versao,aparelho,atualizado_em')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const linhas = (await r.json()) as Remoto[]
  return linhas[0] ?? null
}

/** grava na nuvem só se ela ainda estiver na versão que este PC conhece */
async function enviar(dados: Dados, versaoDaNuvem: number | null): Promise<void> {
  const contagem = edicoes
  const nova = (versaoDaNuvem ?? 0) + 1
  const corpo = JSON.stringify({
    dados,
    versao: nova,
    aparelho: hostname(),
    atualizado_em: new Date().toISOString()
  })
  const r =
    versaoDaNuvem === null
      ? await pedir('/rest/v1/estudaai_dados', {
          method: 'POST',
          body: corpo,
          headers: { Prefer: 'return=representation' }
        })
      : await pedir(`/rest/v1/estudaai_dados?versao=eq.${versaoDaNuvem}`, {
          method: 'PATCH',
          body: corpo,
          headers: { Prefer: 'return=representation' }
        })
  if (r.status === 409) throw new Conflito()
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  if (((await r.json()) as unknown[]).length === 0) throw new Conflito()
  memoria!.base = nova
  memoria!.alterado = edicoes !== contagem
  gravarMemoria()
}

// ---------- perguntas para a tela (quem tem o estado é ela) ----------

let proximaPergunta = 0
const respostas = new Map<number, (r: string | null) => void>()
function perguntar(canal: string, dados: unknown, esperaMs?: number): Promise<string | null> {
  const w = janela()
  if (!w) return Promise.resolve(null)
  const id = ++proximaPergunta
  return new Promise((resolve) => {
    respostas.set(id, resolve)
    w.webContents.send(canal, { id, ...(dados as object) })
    // janela fechada no meio da pergunta: ninguém vai responder
    w.once('closed', () => {
      if (respostas.delete(id)) resolve(null)
    })
    if (esperaMs)
      setTimeout(() => {
        if (respostas.delete(id)) resolve(null)
      }, esperaMs)
  })
}

/** troca os dados deste PC pelos da nuvem. A tela confirma primeiro: se
 *  ela tem uma mudança ainda não salva, recusa, salva e o próximo ciclo
 *  vê os dois lados mudados (e pergunta) */
async function baixar(remoto: Remoto): Promise<boolean> {
  const r = await perguntar('nuvem:trocar', { dados: remoto.dados }, 15_000)
  if (r !== 'aceitou') return false
  const local = lerDados()
  if (!dadosVazios(local)) guardarCopia(local, 'antes-da-nuvem')
  salvarDados(remoto.dados)
  memoria!.base = remoto.versao
  memoria!.alterado = false
  gravarMemoria()
  return true
}

async function umCiclo(): Promise<void> {
  if (!memoria) return
  const remoto = await puxar()
  const decisao = decidir(memoria, dadosVazios(lerDados()), remoto)
  if (decisao === 'enviar') return enviar(lerDados(), remoto?.versao ?? null)
  if (decisao === 'baixar') {
    await baixar(remoto!)
    return
  }
  if (decisao === 'conflito') {
    const escolha = await perguntar('nuvem:conflito', {
      esteMudouEm: memoria.mudouEm,
      outroMudouEm: Date.parse(remoto!.atualizado_em),
      outroAparelho: remoto!.aparelho
    })
    if (escolha === 'este') {
      guardarCopia(remoto!.dados, 'da-nuvem')
      return enviar(lerDados(), remoto!.versao)
    }
    if (escolha === 'outro' && (await baixar(remoto!))) return
    throw new Error('escolha')
  }
}

let fila: Promise<void> = Promise.resolve()
let ultimaTentativa = 0

/** um ciclo por vez; conflito de versão (alguém gravou no meio) tenta de novo */
export function sincronizar(): Promise<void> {
  fila = fila.then(async () => {
    if (!memoria?.renovar) return emitir({ situacao: 'desconectado', email: '' })
    ultimaTentativa = Date.now()
    emitir({ situacao: 'sincronizando', email: memoria.email, mensagem: '' })
    try {
      try {
        await umCiclo()
      } catch (e) {
        if (!(e instanceof Conflito)) throw e
        await umCiclo()
      }
      memoria.ultimaSync = Date.now()
      gravarMemoria()
      emitir({ situacao: 'ok', ultimaSync: memoria.ultimaSync })
    } catch (e) {
      if (e instanceof SemInternet)
        emitir({
          situacao: 'semInternet',
          mensagem: 'Sem internet: salvo neste PC, sobe quando voltar.'
        })
      else if (e instanceof SessaoPerdida) {
        memoria.renovar = ''
        acesso = null
        gravarMemoria()
        emitir({ situacao: 'desconectado', mensagem: 'A sessão expirou. Entre de novo.' })
      } else if ((e as Error).message === 'escolha')
        emitir({
          situacao: 'erro',
          mensagem: 'Os dois PCs mudaram. Clique em Sincronizar agora para escolher qual fica.'
        })
      else
        emitir({
          situacao: 'erro',
          mensagem: 'Não consegui sincronizar agora. Tento de novo em instantes.'
        })
    }
  })
  return fila
}

let timer: NodeJS.Timeout | undefined
const agendar = (ms: number): void => {
  clearTimeout(timer)
  timer = setTimeout(() => void sincronizar(), ms)
}

/** o PC salvou: marca e manda em 3 s (junta uma rajada de edições) */
export function salvouNoPc(): void {
  edicoes++
  if (!memoria?.renovar) return
  memoria.alterado = true
  memoria.mudouEm = Date.now()
  gravarMemoria()
  agendar(3000)
}

export const precisaSubir = (): boolean => !!memoria?.renovar && memoria.alterado

/** ao fechar: se ficou mudança sem subir, tenta uma vez (até 5 s) */
export async function antesDeFechar(): Promise<void> {
  if (!precisaSubir()) return
  clearTimeout(timer)
  await Promise.race([sincronizar(), new Promise((r) => setTimeout(r, 5000))])
}

export function iniciarNuvem(obterJanela: () => BrowserWindow | null): void {
  janela = obterJanela
  lerMemoria()
  if (memoria?.renovar) estado = { ...estado, email: memoria.email, ultimaSync: memoria.ultimaSync }

  ipcMain.handle('nuvem:estado', () => estado)
  ipcMain.handle('nuvem:sincronizar', () => sincronizar())
  ipcMain.on('nuvem:resposta', (_e, id: number, resposta: string | null) => {
    respostas.get(id)?.(resposta)
    respostas.delete(id)
  })

  ipcMain.handle('nuvem:entrar', async (_e, email: string, senha: string) => {
    try {
      const r = await pedir(
        '/auth/v1/token?grant_type=password',
        {
          method: 'POST',
          body: JSON.stringify({ email: String(email).trim(), password: String(senha) })
        },
        false
      )
      if (!r.ok) return { erro: mensagemDoLogin(r.status, await r.text()) }
      await guardarSessao(r, String(email).trim())
      void sincronizar()
      return { ok: true }
    } catch {
      return { erro: 'Sem internet agora. Tente de novo quando conectar.' }
    }
  })

  ipcMain.handle('nuvem:criarConta', async (_e, email: string, senha: string) => {
    try {
      const r = await pedir(
        '/auth/v1/signup',
        {
          method: 'POST',
          body: JSON.stringify({ email: String(email).trim(), password: String(senha) })
        },
        false
      )
      const texto = await r.text()
      if (!r.ok) return { erro: mensagemDoLogin(r.status, texto) }
      // com confirmação de e-mail ligada, a conta nasce sem sessão
      if (!(JSON.parse(texto) as { access_token?: string }).access_token) return { confirmar: true }
      await guardarSessao(new Response(texto), String(email).trim())
      void sincronizar()
      return { ok: true }
    } catch {
      return { erro: 'Sem internet agora. Tente de novo quando conectar.' }
    }
  })

  ipcMain.handle('nuvem:sair', async () => {
    try {
      if (memoria?.renovar) await pedir('/auth/v1/logout', { method: 'POST' })
    } catch {
      // sem internet: a sessão vence sozinha; aqui ela já some
    }
    memoria = null
    acesso = null
    gravarArquivoSeguro(caminho(), '{}')
    emitir({ situacao: 'desconectado', email: '', ultimaSync: 0, mensagem: '' })
  })

  // de tempos em tempos e ao voltar para a janela: o outro PC pode ter mudado
  setInterval(() => void sincronizar(), 5 * 60_000)
  app.on('browser-window-focus', () => {
    if (Date.now() - ultimaTentativa > 60_000) agendar(0)
  })
}
