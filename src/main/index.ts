import { app, BrowserWindow, clipboard, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { lerDados, salvarDados } from './dados'
import { iniciarAtualizador } from './atualizador'
import type { Dados } from '../shared/tipos'

/** só link de verdade: fica de fora file:, javascript: e protocolos do
 *  Windows que já foram usados para rodar programa a partir de um "link" */
function abrirLinkExterno(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    void shell.openExternal(u.toString())
    return true
  } catch {
    return false
  }
}

let principal: BrowserWindow | null = null

function criarJanela(): void {
  const janela = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#04070a',
    autoHideMenuBar: true,
    title: 'EstudaAI',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  principal = janela
  janela.on('closed', () => (principal = null))
  janela.once('ready-to-show', () => janela.show())

  // nenhum link troca a tela do app nem abre janela nova: vai pro navegador
  janela.webContents.setWindowOpenHandler(({ url }) => {
    abrirLinkExterno(url)
    return { action: 'deny' }
  })
  janela.webContents.on('will-navigate', (e, url) => {
    if (url !== janela.webContents.getURL()) {
      e.preventDefault()
      abrirLinkExterno(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void janela.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void janela.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Duas cópias abertas gravariam o mesmo arquivo uma por cima da outra e
// apagariam o que a outra salvou: a segunda só traz a primeira para a frente.
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => {
  if (!principal) return
  if (principal.isMinimized()) principal.restore()
  principal.show()
  principal.focus()
})

app.whenReady().then(() => {
  ipcMain.handle('dados:ler', () => lerDados())
  ipcMain.handle('dados:salvar', (_e, dados: Dados) => salvarDados(dados))
  // ao fechar (ou reiniciar para atualizar) a tela grava de forma síncrona:
  // um invoke assíncrono podia se perder no meio do fechamento
  ipcMain.on('dados:salvarAgora', (e, dados: Dados) => {
    try {
      salvarDados(dados)
      e.returnValue = true
    } catch {
      e.returnValue = false
    }
  })
  // área de transferência pelo processo principal: a do navegador pede
  // permissão e falha sem foco
  ipcMain.handle('clipboard:ler', () => clipboard.readText())
  ipcMain.handle('clipboard:escrever', (_e, texto: string) => clipboard.writeText(String(texto)))
  ipcMain.handle('link:abrir', (_e, url: string) => abrirLinkExterno(url))
  iniciarAtualizador(() => principal)

  criarJanela()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
