import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { lerDados, salvarDados } from './dados'
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

app.whenReady().then(() => {
  ipcMain.handle('dados:ler', () => lerDados())
  ipcMain.handle('dados:salvar', (_e, dados: Dados) => salvarDados(dados))
  ipcMain.handle('link:abrir', (_e, url: string) => abrirLinkExterno(url))

  criarJanela()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
