import { BrowserWindow, ipcMain, screen } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { gravarArquivoSeguro, lerDados, salvarDados } from './dados'
import { salvouNoPc } from './nuvem'
import { aplicarOps, lerNotasDoBloco } from '../shared/bloco'
import type { ConfigDoBloco, NotaDoBloco } from '../shared/tipos'

/** Bloco de notas em janelinha flutuante (o mesmo sistema do esquecAI:
 *  sempre por cima, canto da tela, trava para mover, opacidade).
 *
 *  As notas moram em `dados.blocoDeNotas` (sincronizam com a nuvem, então o
 *  Claude lê as dúvidas no check-in). Quem grava é SEMPRE a janela principal
 *  (a dona do estado): a janelinha manda a lista para cá, daqui vai para a
 *  principal ("bloco:aplicar"), e a principal devolve o que ficou valendo
 *  ("bloco:publicar"), que volta para a janelinha. */

const LARGURA = 340
const ALTURA = 440
const MARGEM = 16
const PADRAO: ConfigDoBloco = { bounds: null, opacidade: 0.95, travado: true }

const caminho = (): string => join(app.getPath('userData'), 'bloco.json')
let config: ConfigDoBloco = { ...PADRAO }
let janela: BrowserWindow | null = null
let ultimas: NotaDoBloco[] | null = null
let selecionarAoAbrir: string | null = null
let recentes: { ops: unknown[]; em: number }[] = []
const vigiadas = new WeakSet<BrowserWindow>()

/** sem a janela principal (fechando), as operações vão direto para o arquivo */
function aplicarNoArquivo(ops: unknown): void {
  try {
    const d = lerDados()
    d.blocoDeNotas = aplicarOps(d.blocoDeNotas ?? [], ops)
    salvarDados(d)
    salvouNoPc()
    ultimas = d.blocoDeNotas
  } catch {
    // arquivo ilegível: lerDados já trata; aqui não há o que salvar
  }
}

function lerConfig(): void {
  try {
    if (existsSync(caminho()))
      config = { ...PADRAO, ...JSON.parse(readFileSync(caminho(), 'utf8')) }
  } catch {
    config = { ...PADRAO }
  }
}
const gravarConfig = (): void => gravarArquivoSeguro(caminho(), JSON.stringify(config))

/** canto de baixo, à direita, na tela onde está o mouse */
function lugarPadrao(): ConfigDoBloco['bounds'] & object {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  return {
    x: workArea.x + workArea.width - LARGURA - MARGEM,
    y: workArea.y + workArea.height - ALTURA - MARGEM,
    width: LARGURA,
    height: ALTURA
  }
}

/** o lugar salvo só vale se ainda cabe em alguma tela (monitor desligado) */
function lugarValido(): ConfigDoBloco['bounds'] & object {
  const b = config.bounds
  if (!b) return lugarPadrao()
  const visivel = screen.getAllDisplays().some(({ workArea: w }) => {
    return (
      b.x + 40 < w.x + w.width &&
      b.x + b.width - 40 > w.x &&
      b.y >= w.y - 8 &&
      b.y + 40 < w.y + w.height
    )
  })
  return visivel ? b : lugarPadrao()
}

function abrir(principal: () => BrowserWindow | null, notaId?: string): void {
  if (notaId) selecionarAoAbrir = notaId
  if (janela && !janela.isDestroyed()) {
    janela.showInactive()
    janela.focus()
    if (notaId) janela.webContents.send('bloco:selecionar', notaId)
    return
  }
  const b = lugarValido()
  janela = new BrowserWindow({
    ...b,
    minWidth: 240,
    minHeight: 200,
    frame: false,
    // ponytail: sem transparent: sem aceleração de vídeo, janela transparente
    // fica preta no Windows (lição do esquecAI); a opacidade é pelo SO
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#04070a',
    title: 'Bloco de notas',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  // 'pop-up-menu': acima da barra de tarefas e do navegador em tela cheia
  janela.setAlwaysOnTop(true, 'pop-up-menu')
  janela.setOpacity(config.opacidade)
  janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  janela.webContents.on('will-navigate', (e) => e.preventDefault())
  const guardarLugar = (): void => {
    if (!janela || janela.isDestroyed()) return
    config = { ...config, bounds: janela.getBounds() }
    gravarConfig()
  }
  janela.on('moved', guardarLugar)
  janela.on('resized', guardarLugar)
  janela.on('closed', () => (janela = null))
  janela.once('ready-to-show', () => janela?.show())
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void janela.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/bloco')
  } else {
    void janela.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/bloco' })
  }
  // a principal fechou: o que acabou de ir para ela pode ter chegado depois
  // da última gravação dela. Reaplicar no arquivo é seguro (a edição mais nova
  // vence; apagar duas vezes não muda nada). E a janelinha vai junto (senão o
  // app ficaria aberto sem tela); ao fechar, ela descarrega o que esperava.
  const p = principal()
  if (p && !vigiadas.has(p)) {
    vigiadas.add(p)
    p.once('closed', () => {
      const ops = recentes.flatMap((r) => r.ops)
      recentes = []
      if (ops.length) aplicarNoArquivo(ops)
      janela?.close()
    })
  }
}

export function iniciarBloco(principal: () => BrowserWindow | null): void {
  lerConfig()
  ipcMain.handle('bloco:abrir', (_e, notaId?: string) =>
    abrir(principal, typeof notaId === 'string' ? notaId : undefined)
  )
  ipcMain.handle('bloco:fechar', () => janela?.close())
  ipcMain.handle('bloco:config', () => config)
  ipcMain.handle('bloco:mudarConfig', (e, patch: Partial<ConfigDoBloco>) => {
    if (!janela || e.sender !== janela.webContents) return config
    if (typeof patch.opacidade === 'number')
      config.opacidade = Math.min(1, Math.max(0.4, patch.opacidade))
    if (typeof patch.travado === 'boolean') config.travado = patch.travado
    janela.setOpacity(config.opacidade)
    gravarConfig()
    return config
  })
  // a janelinha pede as notas ao abrir (e qual abrir, se veio do "anotar dúvida")
  ipcMain.handle('bloco:ler', () => {
    const sel = selecionarAoAbrir
    selecionarAoAbrir = null
    return { notas: ultimas ?? lerDados().blocoDeNotas ?? [], selecionar: sel }
  })
  // da janelinha: operações (salvar/apagar uma nota), nunca a lista inteira.
  // Vão para a principal (a dona do estado); sem a principal, direto no arquivo.
  const receber = (
    e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
    ops: unknown
  ): boolean => {
    if (!janela || e.sender !== janela.webContents || !Array.isArray(ops)) return false
    const p = principal()
    if (p && !p.isDestroyed()) {
      recentes.push({ ops, em: Date.now() })
      recentes = recentes.filter((r) => Date.now() - r.em < 5000)
      p.webContents.send('bloco:aplicar', ops)
    } else aplicarNoArquivo(ops)
    return true
  }
  ipcMain.handle('bloco:ops', (e, ops: unknown) => void receber(e, ops))
  // ao fechar a janelinha, o que estava esperando sai na hora (síncrono)
  ipcMain.on('bloco:opsAgora', (e, ops: unknown) => {
    e.returnValue = receber(e, ops)
  })
  // da principal para a janelinha: o que ficou valendo (edição, nuvem, outro PC)
  ipcMain.on('bloco:publicar', (e, notas: NotaDoBloco[]) => {
    if (e.sender !== principal()?.webContents) return
    ultimas = lerNotasDoBloco(notas)
    if (janela && !janela.isDestroyed()) janela.webContents.send('bloco:mudou', ultimas)
  })
}
