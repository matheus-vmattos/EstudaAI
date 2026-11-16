import { app, ipcMain, type BrowserWindow } from 'electron'
import { appendFileSync } from 'fs'
import { join } from 'path'
import type { AppUpdater } from 'electron-updater'
import type { EstadoDaAtualizacao } from '../shared/tipos'

const PRIMEIRA_CHECAGEM_MS = 5000
const CHECAR_A_CADA_MS = 4 * 60 * 60 * 1000

function log(linha: string): void {
  try {
    appendFileSync(
      join(app.getPath('userData'), 'atualizacao.log'),
      `[${new Date().toISOString()}] ${linha}\n`
    )
  } catch {
    /* sem log não é motivo para travar nada */
  }
}

/** Procura versão nova nas Releases do GitHub, baixa em segundo plano e
 *  avisa a tela. Instala ao fechar o app, ou na hora se a pessoa clicar em
 *  "Reiniciar agora" — nunca no meio de um simulado.
 *  ponytail: o feed vem direto das Releases do repositório público, sem a
 *  assinatura extra do feed que o EsquecAI faz. Limite: quem controlar a
 *  conta do GitHub controla a atualização; se o app passar a ter outros
 *  usuários, trazer a verificação de assinatura do EsquecAI
 *  (verificacaoDoAtualizador.ts). */
export function iniciarAtualizador(janela: () => BrowserWindow | null): void {
  let estado: EstadoDaAtualizacao = { estado: 'parado' }
  const avisar = (novo: EstadoDaAtualizacao): void => {
    estado = novo
    janela()?.webContents.send('atualizacao:estado', novo)
  }
  ipcMain.handle('atualizacao:estado', () => estado)
  ipcMain.handle('app:versao', () => app.getVersion())

  // em desenvolvimento não há instalador para trocar
  if (!app.isPackaged) {
    ipcMain.handle('atualizacao:procurar', () =>
      avisar({ estado: 'erro', mensagem: 'A atualização só funciona no app instalado.' })
    )
    return
  }

  // ponytail: o electron-updater pesa para carregar; entra só depois que a
  // janela abriu
  const carregar = import('electron-updater').then((m) => {
    // CommonJS: o autoUpdater é um getter que o import() só mostra no default
    const u: AppUpdater = (m.default ?? m).autoUpdater
    u.autoDownload = true
    u.autoInstallOnAppQuit = true
    u.on('update-available', (info) => {
      log(`versão nova: ${info.version}`)
      avisar({ estado: 'baixando', versao: info.version, porcento: 0 })
    })
    u.on('update-not-available', () => {
      // já baixada e esperando reiniciar continua "pronta"
      if (estado.estado !== 'pronta') avisar({ estado: 'emDia', verificadoEm: Date.now() })
    })
    u.on('download-progress', (p) => {
      if (estado.estado === 'baixando') avisar({ ...estado, porcento: Math.round(p.percent) })
    })
    u.on('update-downloaded', (info) => {
      log(`baixada: ${info.version}`)
      avisar({ estado: 'pronta', versao: info.version })
    })
    u.on('error', (erro) => {
      log(`erro: ${erro.message}`)
      if (estado.estado !== 'pronta') avisar({ estado: 'erro', mensagem: mensagemDoErro(erro) })
    })
    return u
  })

  const checar = (): void => {
    if (estado.estado === 'baixando' || estado.estado === 'pronta') return
    void carregar
      .then((u) => {
        log(`checando (rodando ${app.getVersion()})`)
        return u.checkForUpdates()
      })
      .catch((e) => {
        log(`checagem falhou: ${e}`)
        avisar({ estado: 'erro', mensagem: mensagemDoErro(e) })
      })
  }
  setTimeout(checar, PRIMEIRA_CHECAGEM_MS)
  setInterval(checar, CHECAR_A_CADA_MS).unref()

  // "Procurar agora" da engrenagem: mesma checagem, na hora
  ipcMain.handle('atualizacao:procurar', () => {
    if (estado.estado === 'baixando' || estado.estado === 'pronta') return
    avisar({ estado: 'procurando' })
    checar()
  })

  ipcMain.handle('atualizacao:reiniciar', async () => {
    if (estado.estado !== 'pronta') return
    // a tela grava o que estiver pendente no beforeunload antes de fechar
    ;(await carregar).quitAndInstall(true, true)
  })
}

/** erro técnico → frase que a pessoa entende */
function mensagemDoErro(erro: unknown): string {
  const t = String(erro instanceof Error ? erro.message : erro)
  if (
    /ENOTFOUND|ETIMEDOUT|ECONNRE|EAI_AGAIN|net::ERR_(INTERNET|NAME|CONNECTION|NETWORK|TIMED)/i.test(
      t
    )
  ) {
    return 'Sem internet. Tente de novo quando conectar.'
  }
  return 'Não consegui verificar agora. Tente de novo em alguns minutos.'
}
